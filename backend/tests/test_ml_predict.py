"""The offline signal job on made-up prices: it must keep a real pattern, drop pure noise, and write only what passes."""
import numpy as np
import pandas as pd
import pytest

pytest.importorskip("lightgbm")
pytest.importorskip("sklearn")
from ml import predict  # noqa: E402
from ml.dataset import build  # noqa: E402


def panel(n_days=520, seed=0):
    """'tomato': every market follows one product-wide trend that persists for weeks (learnable from other markets). 'onion': pure noise."""
    rng, rows = np.random.default_rng(seed), []
    days = pd.date_range("2025-01-01", periods=n_days)
    trend = np.zeros(n_days)
    for i in range(1, n_days):
        trend[i] = 0.93 * trend[i - 1] + rng.normal(0, 0.006)
    for product in ("tomato", "onion"):
        for li in range(10):
            p = 30.0
            for i, d in enumerate(days):
                p *= float(np.exp(rng.normal(0, 0.02) + (trend[i] if product == "tomato" else 0.0)))
                rows.append({"market": f"M{li}", "commodity": product, "variety": "", "grade": "", "unit": "25 lb", "obs_date": d, "price": p})
    return pd.DataFrame(rows)


def test_build_keeps_unlabeled_recent_rows_only_when_asked():
    df = panel(n_days=200)
    plain, with_now = build(df), build(df, unlabeled_days=7)
    assert plain["y"].notna().all()
    assert with_now["y"].isna().any() and with_now["date"].max() > plain["date"].max()


def test_evidence_and_reads():
    df = build(panel(), unlabeled_days=7)
    evidence, reads = predict.compute(df, windows=3, max_train_rows=200000)
    assert set(evidence["commodity"]) == {"tomato", "onion"}
    ev = evidence.set_index("commodity")
    assert ev.loc["tomato", "auc"] > ev.loc["onion", "auc"]
    assert not ev.loc["onion", "passes"]                       # noise never earns a signal
    assert set(reads["commodity"]) <= set(evidence.loc[evidence["passes"], "commodity"])
    if not reads.empty:
        assert reads["p_up"].between(0, 1).all()
        assert reads["date"].max() > df.loc[df["y"].notna(), "date"].max() - pd.Timedelta(days=1)  # read comes from the newest reports
