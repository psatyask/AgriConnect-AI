"""The forecast logic is tested on made-up series (test fixtures only; the app never loads them)."""
import random
from datetime import date, datetime, timedelta, timezone

from app import price_api
from app.db import SessionLocal
from app.forecast import MIN_TRAIN, evaluate
from app.prices.base import PriceRecord
from app.prices.ingest import upsert

START = date(2026, 6, 1)


def series(values, skip_weekends=True):
    out, d = [], START
    for v in values:
        while skip_weekends and d.weekday() >= 5:
            d += timedelta(days=1)
        out.append((d, v))
        d += timedelta(days=1)
    return out


def test_too_little_history_gives_no_forecast():
    r = evaluate(series([10.0] * 15))
    assert (r["status"], r["reason"]) == ("no_forecast", "too_little_history")


def test_a_steady_trend_is_forecast_and_beats_the_baseline_on_held_out_dates():
    rng = random.Random(1)
    pts = series([20 + 0.4 * i + rng.uniform(-0.3, 0.3) for i in range(110)], skip_weekends=False)
    r = evaluate(pts)
    assert r["status"] == "ok" and r["model"] == "trend"
    assert r["gate_skill"] >= 0.15 and r["holdout_skill"] >= 0.10 and r["win_rate"] >= 0.65 and r["model_error"] < r["baseline_error"]
    assert r["value"] > pts[-1][1] and r["low"] <= r["value"] <= r["high"]
    assert r["target_date"] == (pts[-1][0] + timedelta(days=7)).isoformat()


def test_a_random_walk_is_not_forecast_because_nothing_beats_the_baseline():
    rng, v, vals = random.Random(3), 50.0, []
    for _ in range(120):
        v += rng.gauss(0, 1.5)
        vals.append(v)
    r = evaluate(series(vals, skip_weekends=False))
    assert (r["status"], r["reason"]) == ("no_forecast", "not_better_than_baseline")
    assert "value" not in r  # no number is offered when the evidence fails


def test_a_flat_series_cannot_be_improved_on():
    r = evaluate(series([12.0] * 100, skip_weekends=False))
    assert (r["status"], r["reason"]) == ("no_forecast", "not_better_than_baseline")


def test_stale_data_is_not_projected_forward():
    pts = series([20 + 0.4 * i for i in range(110)], skip_weekends=False)
    r = evaluate(pts, today=pts[-1][0] + timedelta(days=30))
    assert (r["status"], r["reason"]) == ("no_forecast", "stale")


def test_the_model_never_sees_the_future(monkeypatch):
    """Changing prices after a test date must not change what was predicted for that date."""
    from app.forecast import collect_folds
    pts = series([20 + (i % 7) for i in range(80)], skip_weekends=False)
    base = collect_folds(pts)
    changed = collect_folds(pts[:60] + [(d, v + 100) for d, v in pts[60:]])
    # the first fold's target is 7 days after its origin (index 19), still before index 60, so it is unaffected
    assert changed.preds["ma5"][0] == base.preds["ma5"][0] and changed.actual[0] == base.actual[0]


def _rec(day, price, variety="ROUND", unit="25 lb cartons"):
    return PriceRecord(country="US", source="ams", state="Georgia", district="", market="Test Market", commodity_raw="Tomatoes", commodity="tomato",
                       variety=variety, grade="", obs_date=day, min_price=price - 1, max_price=price + 1, modal_price=None, unit=unit, currency="USD")


def test_forecast_endpoint_uses_the_same_series_rules_as_history(client, monkeypatch):
    monkeypatch.setattr(price_api, "utcnow", lambda: datetime(2026, 11, 27, tzinfo=timezone.utc))
    rng = random.Random(4)
    days = [date(2026, 11, 26) - timedelta(days=i) for i in range(110)][::-1]
    with SessionLocal() as db:
        upsert(db, [_rec(d, 20 + 0.4 * i + rng.uniform(-0.3, 0.3)) for i, d in enumerate(days)])
        upsert(db, [_rec(days[-1], 9, unit="10 lb cartons")])
    base = "/api/prices/forecast?country=US&commodity=tomato"
    assert client.get(base).json()["reason"] == "needs_unit"  # packages are never mixed
    r = client.get(base + "&unit=25 lb cartons").json()
    assert r["status"] == "ok" and r["basis"] == "midpoint" and r["unit"] == "25 lb cartons" and r["holdout_skill"] > 0
    assert client.get("/api/prices/forecast?country=US&commodity=onion").json()["reason"] == "too_little_history"


def test_backtest_report_counts_every_line_and_does_not_hide_the_losers(client, capsys, monkeypatch):
    from datetime import date as real_date
    from app.prices import backtest
    rng = random.Random(5)
    days = [real_date.today() - timedelta(days=i) for i in range(110)][::-1]
    with SessionLocal() as db:
        upsert(db, [_rec(d, 20 + 0.4 * i + rng.uniform(-0.3, 0.3), variety="TREND") for i, d in enumerate(days)])
        walk, v = [], 50.0
        for _ in days:
            v += rng.gauss(0, 1.5)
            walk.append(max(v, 1.0))
        upsert(db, [_rec(d, p, variety="WALK") for d, p in zip(days, walk)])
    monkeypatch.setattr("sys.argv", ["backtest"])
    backtest.main()
    out = capsys.readouterr().out
    assert "Each method on its own" in out and out.startswith("2 price lines") and "1 ok" in out and "1 not_better_than_baseline" in out
    assert "Forecast offered for 1 lines (50.0% of the 2 lines that could be tested)" in out and "simulated random walks" in out and "all tested lines, winners and losers" in out


def test_the_gate_lets_almost_no_random_walks_through():
    """Calibration guard: on pure random walks nothing can beat the baseline, so passes are false positives."""
    from app.forecast import null_pass_rate
    rate, tested = null_pass_rate(90, trials=400, seed=1)
    assert tested >= 380 and rate <= 0.04, f"{rate:.1%} of random walks got a forecast"


def test_a_real_yearly_cycle_is_forecast_from_last_years_pattern_once_two_years_are_stored():
    import math
    rng = random.Random(7)
    vals = [30 + 10 * math.sin(2 * math.pi * i / 364) + rng.gauss(0, 0.6) for i in range(800)]
    r = evaluate(series(vals, skip_weekends=False))
    assert r["status"] == "ok" and r["model"] in ("seas", "seas_adj") and r["holdout_skill"] >= 0.10


def test_the_seasonal_methods_are_left_out_when_less_than_a_year_is_stored():
    from app.forecast import collect_folds
    assert set(collect_folds(series([20.0 + i % 5 for i in range(120)], skip_weekends=False)).preds) == {"naive", "ma5", "ses", "trend"}


def test_the_gate_also_holds_with_a_long_history_and_seasonal_candidates():
    from app.forecast import null_pass_rate
    rate, tested = null_pass_rate(500, trials=150, seed=2)
    assert tested >= 140 and rate <= 0.05
