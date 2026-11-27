"""Short-horizon price forecast that is only offered when it has beaten a plain baseline on past data.

Nothing here is trained on invented data and nothing is shown unless the evidence below passes:

* Series: one daily price line (market, product, package, variety), the same one the history chart draws.
* Baseline: "the next reading equals the latest report" (naive). With ~90 days of history there is no previous season,
  so a seasonal baseline cannot be tested yet; the module says so instead of pretending.
* Candidates: 5-report average, exponential smoothing, damped recent trend and, once a year of earlier history is stored,
  last year's price for the same week and today's price plus last year's change. Each is scored on past dates using only
  the data that existed at that date (rolling origin).
* Split in time order, 50% / 25% / 25%: the first part picks the best candidate, the second is the gate (must beat the
  baseline by MIN_SKILL), the last is a holdout (MIN_HOLDOUT_SKILL), and it must be closer than the baseline on MIN_WIN_RATE
  of all those tests. Skill is reported from the holdout. These bars are calibrated so that pure random walks, where nothing can
  truly beat the baseline, are rarely let through (see null_pass_rate and tests/test_forecast.py); a weaker gate passed 6-10% of them.
* The range shown is the 10th-90th percentile of that candidate's own past errors, widened if needed to contain the value.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from statistics import mean

HORIZON_DAYS = 7
MIN_TRAIN = 20        # reports needed before the first test date
MIN_FOLDS = 8         # tests needed in each of the gate and holdout parts
MIN_SKILL = 0.15      # candidate must cut the baseline's average error by at least this much on the gate part
MIN_HOLDOUT_SKILL = 0.10  # ...and by at least this much on the holdout part
MIN_WIN_RATE = 0.65    # ...and be closer than the baseline on at least this share of all gate + holdout tests
MAX_STALE_DAYS = 7    # no forecast from data older than this
CANDIDATES = ("ma5", "ses", "trend")

Point = tuple[date, float]


SEASON_DAYS = 364     # 52 weeks: same weekday one year earlier
SEASON_WIDTH = 3      # average the reports within +/- 3 days of that date, so one noisy day does not set the forecast
SEASONAL = ("seas", "seas_adj")
BASE_CANDIDATES = ("ma5", "ses", "trend")
CANDIDATES = BASE_CANDIDATES + SEASONAL  # seasonal ones only exist when a full year of earlier history is stored


def _ses_levels(values: list[float], alpha: float = 0.3) -> list[float]:
    """Exponential smoothing level after each report, computed once so every test date costs O(1)."""
    out, level = [], values[0]
    for v in values:
        level = alpha * v + (1 - alpha) * level
        out.append(level)
    out[0] = values[0]
    return out


def _season_ref(by_date: dict[date, float], day: date) -> float | None:
    near = [by_date[d] for k in range(-SEASON_WIDTH, SEASON_WIDTH + 1) if (d := day - timedelta(days=SEASON_DAYS - k)) in by_date]
    return mean(near) if near else None


def _predict_at(points: list[Point], i: int, levels: list[float], by_date: dict[date, float], h: int) -> dict[str, float]:
    """Every method's value for `h` days after report i, using reports 0..i only (the seasonal lookups are all earlier dates)."""
    day, last = points[i]
    out = {"naive": last, "ma5": mean(v for _, v in points[max(0, i - 4): i + 1]), "ses": levels[i], "trend": last}
    window = [((d - day).days, v) for d, v in points[max(0, i - 20): i + 1] if (day - d).days <= 14]
    if len(window) >= 5:
        mx, my = mean(x for x, _ in window), mean(y for _, y in window)
        sxx = sum((x - mx) ** 2 for x, _ in window)
        if sxx:
            slope = sum((x - mx) * (y - my) for x, y in window) / sxx  # price change per day
            out["trend"] = last + 0.5 * slope * h  # damped: recent drift rarely continues in full
    target = day + timedelta(days=h)
    ref_t = _season_ref(by_date, target)
    ref_0 = _season_ref(by_date, day)
    if ref_t is not None:
        out["seas"] = ref_t                                   # what this time of year looked like last year
        if ref_0 is not None:
            out["seas_adj"] = last + (ref_t - ref_0)          # today's price plus last year's change over the same week
    return {k: max(0.0, v) for k, v in out.items()}


def predict(hist: list[Point], h: int = HORIZON_DAYS) -> dict[str, float]:
    """Every method's value for the date `h` days after the last report, from `hist` only."""
    return _predict_at(hist, len(hist) - 1, _ses_levels([v for _, v in hist]), dict(hist), h)


@dataclass
class Folds:
    actual: list[float]
    preds: dict[str, list[float]]


def _mae(actual: list[float], pred: list[float]) -> float:
    return mean(abs(a - p) for a, p in zip(actual, pred)) if actual else float("nan")


def _slice(f: Folds, a: int, b: int) -> Folds:
    return Folds(f.actual[a:b], {k: v[a:b] for k, v in f.preds.items()})


def _skill(f: Folds, model: str) -> float | None:
    base = _mae(f.actual, f.preds["naive"])
    if not f.actual or not base:  # no tests, or a flat series that nothing can beat
        return None
    return 1 - _mae(f.actual, f.preds[model]) / base


def collect_folds(points: list[Point], h: int = HORIZON_DAYS) -> Folds:
    """Rolling-origin tests: at each report date, predict the price h days later and keep what actually happened.

    With a year or more of earlier history, only dates where the seasonal methods can be computed are used, so every
    method is scored on the same dates. Otherwise the seasonal methods are left out.
    """
    by_date, levels = dict(points), _ses_levels([v for _, v in points])
    rows = []
    for i in range(MIN_TRAIN - 1, len(points)):
        target = points[i][0] + timedelta(days=h)
        if target in by_date:
            rows.append((by_date[target], _predict_at(points, i, levels, by_date, h)))
    seasonal_rows = [r for r in rows if all(k in r[1] for k in SEASONAL)]
    if len(seasonal_rows) >= 3 * MIN_FOLDS:
        rows, keys = seasonal_rows, ("naive", *CANDIDATES)
    else:
        keys = ("naive", *BASE_CANDIDATES)
    return Folds([a for a, _ in rows], {k: [p[k] for _, p in rows] for k in keys})


def evaluate(points: list[Point], today: date | None = None, h: int = HORIZON_DAYS) -> dict:
    """The forecast (or the reason there is none) with the evidence behind it. `points` are (date, price), ascending."""
    points = [(d, float(v)) for d, v in points if v is not None and v > 0]
    base = {"horizon_days": h, "history_reports": len(points)}
    if len(points) < MIN_TRAIN + h:
        return {**base, "status": "no_forecast", "reason": "too_little_history"}
    last_day = points[-1][0]
    if today and (today - last_day).days > MAX_STALE_DAYS:
        return {**base, "status": "no_forecast", "reason": "stale"}
    f = collect_folds(points, h)
    n = len(f.actual)
    a, b = n // 2, n // 2 + n // 4
    select, gate, hold = _slice(f, 0, a), _slice(f, a, b), _slice(f, b, n)
    if len(gate.actual) < MIN_FOLDS or len(hold.actual) < MIN_FOLDS:
        return {**base, "status": "no_forecast", "reason": "too_little_history", "tests": n}
    model = min((k for k in f.preds if k != "naive"), key=lambda k: _mae(select.actual, select.preds[k]))
    gate_skill, hold_skill = _skill(gate, model), _skill(hold, model)
    evidence = {**base, "model": model, "tests": n, "gate_skill": gate_skill, "holdout_skill": hold_skill,
                "holdout_tests": len(hold.actual), "baseline_error": _mae(hold.actual, hold.preds["naive"]),
                "model_error": _mae(hold.actual, hold.preds[model])}
    judged = _slice(f, a, n)
    wins = mean(abs(x - m) < abs(x - b) for x, m, b in zip(judged.actual, judged.preds[model], judged.preds["naive"]))
    evidence["win_rate"] = wins
    if (gate_skill is None or hold_skill is None or gate_skill < MIN_SKILL or hold_skill <= MIN_HOLDOUT_SKILL or wins < MIN_WIN_RATE):
        return {**evidence, "status": "no_forecast", "reason": "not_better_than_baseline"}
    errs = sorted(x - y for x, y in zip(f.actual[a:], f.preds[model][a:]))
    q = lambda p: errs[min(len(errs) - 1, max(0, round(p * (len(errs) - 1))))]  # noqa: E731
    value = predict(points, h)[model]
    return {**evidence, "status": "ok", "target_date": (last_day + timedelta(days=h)).isoformat(),
            "last_report": last_day.isoformat(), "value": round(value, 2),
            "low": round(max(0.0, value + min(q(0.1), 0.0)), 2), "high": round(value + max(q(0.9), 0.0), 2)}  # the range always contains the value


def null_pass_rate(n_reports: int, trials: int = 500, seed: int = 0) -> tuple[float, int]:
    """Share of simulated random walks (nothing to predict) that still get a forecast: the false-positive rate of the gate.

    Returns (rate, walks that were testable). Skill is scale-free, so the walk's size does not matter.
    """
    import random
    rng, ok, tested = random.Random(seed), 0, 0
    for _ in range(trials):
        v, vals = 30.0, []
        for _ in range(n_reports):
            v = max(v + rng.gauss(0, 1.0), 1.0)
            vals.append(v)
        pts, d = [], date(2026, 1, 5)
        for x in vals:
            while d.weekday() >= 5:
                d += timedelta(days=1)
            pts.append((d, x))
            d += timedelta(days=1)
        r = evaluate(pts)
        tested += r.get("holdout_skill") is not None
        ok += r["status"] == "ok"
    return (ok / tested if tested else 0.0), tested
