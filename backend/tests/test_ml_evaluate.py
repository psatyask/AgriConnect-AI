"""Pipeline tests on made-up prices: a real signal must be found, and no signal must not be."""
import numpy as np
import pandas as pd
import pytest

pytest.importorskip("lightgbm")
pytest.importorskip("xgboost")
pytest.importorskip("sklearn")
from ml.dataset import CATEGORICAL, NUMERIC, build  # noqa: E402
from ml.evaluate import make_windows, run, skill  # noqa: E402

FEATURES = NUMERIC + CATEGORICAL


def walk_panel(n_lines=12, n_days=420, seed=0, mean_revert=0.0):
    """Random walks per line; mean_revert > 0 makes prices snap back toward their 30-day level (a learnable pattern)."""
    rng, rows = np.random.default_rng(seed), []
    for li in range(n_lines):
        p, hist = 30.0, [30.0]
        for d in pd.date_range("2025-01-01", periods=n_days):
            level = np.mean(hist[-30:])
            p *= float(np.exp(rng.normal(0, 0.03) - mean_revert * np.log(p / level)))
            hist.append(p)
            rows.append({"market": f"M{li}", "commodity": "tomato", "variety": "", "grade": "", "unit": "25 lb", "obs_date": d, "price": p})
    return pd.DataFrame(rows)


def test_windows_are_in_time_order_with_a_gap_and_never_overlap():
    ws = make_windows(pd.Timestamp("2026-11-01"), 3)
    for a, b in zip(ws, ws[1:]):
        assert a.test_end < b.test_end and a.test_end - a.test_start == pd.Timedelta(days=55)
    for w in ws:
        assert w.train_end + pd.Timedelta(days=7) < w.val_start and w.val_end + pd.Timedelta(days=7) < w.test_start


def test_a_learnable_pattern_is_found_on_unseen_dates():
    df = build(walk_panel(mean_revert=0.25))
    test = run(df, ["ridge", "lgbm", "xgb"], 2, 200_000, FEATURES)
    assert len(test) > 1000
    for m in ("ridge", "lgbm", "xgb"):
        assert skill(test["y"].to_numpy(), test[m].to_numpy()) > 0.10, m


def test_a_pure_random_walk_gives_no_skill():
    df = build(walk_panel(seed=3))
    test = run(df, ["ridge", "lgbm", "xgb"], 2, 200_000, FEATURES)
    for m in ("ridge", "lgbm", "xgb"):
        assert skill(test["y"].to_numpy(), test[m].to_numpy()) < 0.03, m


def test_shuffling_the_target_inside_each_line_removes_the_skill_of_a_learnable_pattern():
    df = build(walk_panel(mean_revert=0.25))
    rng = np.random.default_rng(1)
    df["y"] = df.groupby("line")["y"].transform(lambda s: rng.permutation(s.to_numpy()))
    test = run(df, ["lgbm"], 2, 200_000, FEATURES)
    assert skill(test["y"].to_numpy(), test["lgbm"].to_numpy()) < 0.03


def test_a_market_that_first_appears_after_the_training_period_does_not_break_xgboost():
    """Real data crashed on this: the late market's code was unknown to the training set."""
    p = walk_panel(n_lines=8)
    late = walk_panel(n_lines=1, seed=9)
    late["market"] = "LATE MARKET"
    late = late[late.obs_date >= pd.Timestamp("2025-12-01")]
    df = build(pd.concat([p, late], ignore_index=True))
    test = run(df, ["xgb", "lgbm"], 2, 200_000, FEATURES)
    assert "LATE MARKET" in set(test["line"].str.split("|").str[0]) and test["xgb"].notna().all()


def test_squared_error_task_finds_a_planted_pattern_and_move_task_beats_chance_only_when_there_is_something_to_find(capsys):
    from sklearn.metrics import roc_auc_score
    from ml.evaluate import MOVE
    df = build(walk_panel(mean_revert=0.25))
    test = run(df, ["lgbm"], 2, 200_000, FEATURES, task="rmse")
    assert 1 - np.sqrt(np.mean((test["y"] - test["lgbm"]) ** 2)) / np.sqrt(np.mean(test["y"] ** 2)) > 0.05
    # volatility that comes in bursts: lines that have been moving keep moving, so "will it move" is learnable
    rng, rows = np.random.default_rng(4), []
    for li in range(10):
        p, stormy = 30.0, False
        for d in pd.date_range("2025-01-01", periods=420):
            if rng.random() < 0.04:  # regimes last about 25 days
                stormy = not stormy
            p *= float(np.exp(rng.normal(0, 0.03 if stormy else 0.002)))
            rows.append({"market": f"M{li}", "commodity": "tomato", "variety": "", "grade": "", "unit": "25 lb", "obs_date": d, "price": p})
    t2 = run(build(pd.DataFrame(rows)), ["lgbm"], 2, 200_000, FEATURES, task="move")
    moved = (t2["y"].abs() >= MOVE).astype(int)
    assert 0.0 < moved.mean() < 1.0 and roc_auc_score(moved, t2["lgbm"]) > 0.6
    # on plain random walks there is nothing to rank beyond chance
    t3 = run(build(walk_panel(seed=6)), ["lgbm"], 2, 200_000, FEATURES, task="move")
    m3 = (t3["y"].abs() >= MOVE).astype(int)
    assert roc_auc_score(m3, t3["lgbm"]) < 0.56


def test_direction_task_finds_reversion_and_finds_nothing_in_random_walks():
    from sklearn.metrics import roc_auc_score
    t = run(build(walk_panel(mean_revert=0.25)), ["lgbm"], 2, 200_000, FEATURES, task="direction")
    assert roc_auc_score((t["y"] > 0).astype(int), t["lgbm"]) > 0.65
    assert (t["y"].abs() >= 0.02).all()  # only lines that really moved are scored
    t2 = run(build(walk_panel(seed=8)), ["lgbm"], 2, 200_000, FEATURES, task="direction")
    assert roc_auc_score((t2["y"] > 0).astype(int), t2["lgbm"]) < 0.56


def test_direction_report_prints_each_window_and_a_calibration_table(capsys):
    from ml.evaluate import report_direction
    t = run(build(walk_panel(mean_revert=0.25)), ["lgbm", "ridge"], 2, 200_000, FEATURES, task="direction")
    report_direction(t, ["lgbm", "ridge"])
    out = capsys.readouterr().out
    assert "AUC in each test window" in out and out.count("said ") >= 8 and "Calibration, lgbm" in out
