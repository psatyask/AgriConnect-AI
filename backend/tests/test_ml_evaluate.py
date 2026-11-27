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
