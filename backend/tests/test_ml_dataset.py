"""Dataset tests use made-up prices (test fixtures only; the experiment itself reads the real database)."""
import numpy as np
import pandas as pd
import pytest

pytest.importorskip("pandas")
from ml.dataset import HORIZON, build  # noqa: E402


def panel(n_days=150, lines=("A", "B"), seed=0):
    rng, rows = np.random.default_rng(seed), []
    for li, m in enumerate(lines):
        p = 30.0 + li
        for d in pd.date_range("2026-01-01", periods=n_days):
            p *= float(np.exp(rng.normal(0, 0.02)))
            rows.append({"market": m, "commodity": "tomato", "variety": "", "grade": "", "unit": "25 lb", "obs_date": d, "price": p})
    return pd.DataFrame(rows)


def test_target_is_the_real_seven_day_log_change_and_features_exist():
    p = panel()
    df = build(p)
    row = df.iloc[10]
    a = p[(p.market == row.line.split("|")[0])].set_index("obs_date")["price"]
    assert row.y == pytest.approx(np.log(a[row.date + pd.Timedelta(days=HORIZON)] / a[row.date]), abs=1e-5)
    assert {"r7", "z90", "cm_r7", "commodity_code"} <= set(df.columns) and df[["r1", "vol28"]].notna().all().all()


def test_features_never_see_the_future():
    """Changing any price after a date must not change that date's features."""
    p = panel()
    cut = pd.Timestamp("2026-04-01")
    base = build(p)
    changed = p.copy()
    changed.loc[changed.obs_date > cut, "price"] *= 3.0
    after = build(changed)
    cols = ["r1", "r3", "r7", "r14", "r28", "vol28", "flat28", "z90", "cm_r1", "cm_r7", "cm_n"]
    a = base[base.date <= cut].set_index(["date", "line"])[cols].sort_index()
    b = after[after.date <= cut].set_index(["date", "line"])[cols].sort_index()
    common = a.index.intersection(b.index)
    assert len(common) > 100
    pd.testing.assert_frame_equal(a.loc[common], b.loc[common], check_exact=False, rtol=1e-5, atol=1e-6)


def test_other_market_feature_excludes_the_line_itself():
    p = panel(lines=("A", "B", "C"))
    df = build(p)
    assert (df["cm_n"] == 2).all()
    one = df[df.date == df.date.iloc[0]].set_index("line")
    ret7 = one["r7"]
    for line in one.index:
        others = ret7.drop(line).mean()
        assert one.loc[line, "cm_r7"] == pytest.approx(others, abs=1e-5)


def test_a_line_with_no_report_seven_days_later_gets_no_row():
    p = panel(lines=("A",))
    p = p[p.obs_date != pd.Timestamp("2026-03-15")]
    df = build(p)
    assert pd.Timestamp("2026-03-08") not in set(df.date)  # its target day is missing, and is never filled in
