"""Offline job: train the direction model, score it per product on dates it never saw, write the results for the web app.

    python -m ml.predict                      # needs: pip install -r requirements-ml.txt, and US prices loaded
    python -m ml.predict --max-train-rows 300000

The question the model answers: IF this price moves 2% or more in the next 7 days, how likely is it to be UP?
It says nothing about whether the price will move. A product gets a signal on the site only when its held-out evidence passes the
gate below; the other products show nothing. The web app never imports this file or any ML library, it only reads two tables.
"""
from __future__ import annotations

import argparse

import numpy as np
import pandas as pd

from .dataset import CATEGORICAL, HORIZON, NUMERIC, build
from .evaluate import GAP, MOVE, fit_best, make_windows, run

# Gate. Shuffling outcomes inside each line (keeps how often each line goes up) scores AUC 0.575, so a product must be clearly above that.
MIN_TESTS = 300          # price moves of 2%+ scored on dates the model never saw
MIN_AUC_LOW = 0.60       # lower end of the 95% interval (resampling whole weeks)
MIN_WINDOW_AUC = 0.55    # worst of the test windows: the edge must not come from one lucky stretch
VAL_DAYS = 56
FEATURES = NUMERIC + CATEGORICAL


def _auc(up: np.ndarray, p: np.ndarray) -> float:
    from sklearn.metrics import roc_auc_score
    return float(roc_auc_score(up, p)) if 0 < up.sum() < len(up) else float("nan")


def product_evidence(test: pd.DataFrame, model: str = "lgbm", reps: int = 300, seed: int = 0) -> pd.DataFrame:
    """Per product: AUC on unseen dates, its 95% interval, the worst window, and whether it passes the gate."""
    rng, rows = np.random.default_rng(seed), []
    test = test.assign(up=(test["y"] > 0).astype(int), week=test["date"].dt.to_period("W").astype(str))
    for commodity, g in test.groupby("commodity"):
        auc = _auc(g["up"].to_numpy(), g[model].to_numpy())
        wins = [_auc(w["up"].to_numpy(), w[model].to_numpy()) for _, w in g.groupby("window")]
        wins = [a for a in wins if not np.isnan(a)]
        by_week = [(w["up"].to_numpy(), w[model].to_numpy()) for _, w in g.groupby("week")]
        boots = []
        for _ in range(reps):
            pick = rng.integers(0, len(by_week), len(by_week))
            a = _auc(np.concatenate([by_week[i][0] for i in pick]), np.concatenate([by_week[i][1] for i in pick]))
            if not np.isnan(a):
                boots.append(a)
        lo, hi = (float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))) if boots else (float("nan"), float("nan"))
        min_w = min(wins) if wins else float("nan")
        passes = bool(len(g) >= MIN_TESTS and lo >= MIN_AUC_LOW and min_w >= MIN_WINDOW_AUC)
        rows.append({"commodity": commodity, "auc": auc, "auc_low": lo, "auc_high": hi, "min_window_auc": min_w,
                     "tests": int(len(g)), "passes": passes})
    return pd.DataFrame(rows)


def latest_reads(df: pd.DataFrame, model: str = "lgbm", max_train_rows: int = 1_500_000, seed: int = 0) -> pd.DataFrame:
    """Train on everything whose outcome is known and read the newest report of each line (its outcome is not known yet)."""
    labeled = df[df["y"].notna() & (df["y"].abs() >= MOVE)]
    last = df.loc[df["y"].notna(), "date"].max()
    val_start = last - pd.Timedelta(days=VAL_DAYS - 1)
    tr = labeled[labeled.date <= val_start - pd.Timedelta(days=GAP + 1)]  # 7-day gap: targets look 7 days ahead
    va = labeled[labeled.date >= val_start]
    if len(tr) < 1000 or len(va) < 200:
        return pd.DataFrame()
    if len(tr) > max_train_rows:
        tr = tr.iloc[np.random.default_rng(seed).choice(len(tr), max_train_rows, replace=False)]
    now = df[df["y"].isna()].sort_values("date").groupby("line").tail(1).copy()
    if now.empty:
        return pd.DataFrame()
    from . import evaluate
    evaluate.CAT_TYPES.update({c: pd.CategoricalDtype(sorted(df[c].unique())) for c in CATEGORICAL})  # a market first seen today is still known
    evaluate.NUMERIC_USED = list(NUMERIC)
    now["p_up"] = fit_best(model, tr, va, now, FEATURES, "direction")
    now["trained_through"] = last
    return now


def compute(df: pd.DataFrame, windows: int = 4, max_train_rows: int = 1_500_000, model: str = "lgbm"):
    """Returns (evidence per product, reads for the products that pass)."""
    labeled = df[df["y"].notna()]
    test = run(labeled, [model], windows, max_train_rows, FEATURES, task="direction")
    if test.empty:
        return pd.DataFrame(), pd.DataFrame()
    evidence = product_evidence(test, model)
    evidence["evaluated_through"] = labeled["date"].max()
    reads = latest_reads(df, model, max_train_rows)
    if not reads.empty:
        reads = reads[reads["commodity"].isin(evidence.loc[evidence["passes"], "commodity"])]
    return evidence, reads


def save(db, evidence: pd.DataFrame, reads: pd.DataFrame, country: str = "US", source: str = "ams") -> None:
    """Replace both tables in one transaction, so the site never sees half of a run."""
    from sqlalchemy import delete

    from app.models import PriceSignal, SignalEvidence
    db.execute(delete(PriceSignal).where(PriceSignal.country == country))
    db.execute(delete(SignalEvidence).where(SignalEvidence.country == country))
    for r in evidence.itertuples():
        db.add(SignalEvidence(commodity=r.commodity, country=country, auc=r.auc, auc_low=r.auc_low, auc_high=r.auc_high,
                              min_window_auc=r.min_window_auc, tests=r.tests, passes=bool(r.passes),
                              evaluated_through=r.evaluated_through.date()))
    for r in reads.itertuples():
        xm = None if pd.isna(r.xm_r7) else float(r.xm_r7)
        db.add(PriceSignal(country=country, source=source, market=r.market, commodity=r.commodity, variety=r.variety or "",
                           grade=r.grade or "", unit=r.unit, as_of=r.date.date(), p_up=float(r.p_up), other_markets_change=xm,
                           trained_through=r.trained_through.date()))
    db.commit()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--windows", type=int, default=4)
    ap.add_argument("--max-train-rows", type=int, default=1_500_000)
    a = ap.parse_args()
    from app.db import SessionLocal, engine
    from .dataset import load_panel
    print("Loading prices and building features (a few minutes)...")
    panel = load_panel(engine)
    if panel.empty:
        print("No US daily prices are stored yet. Load them first: python -m app.prices.ingest ams 365")
        return
    df = build(panel, unlabeled_days=HORIZON)
    evidence, reads = compute(df, a.windows, a.max_train_rows)
    if evidence.empty:
        print("Not enough history to make test windows; load more prices.")
        return
    print(f"\nHeld-out evidence per product (gate: AUC low end >= {MIN_AUC_LOW}, worst window >= {MIN_WINDOW_AUC}, >= {MIN_TESTS} moves):")
    for r in evidence.sort_values("auc", ascending=False).itertuples():
        print(f"  {r.commodity:16s} AUC {r.auc:.3f} [{r.auc_low:.3f}, {r.auc_high:.3f}]  worst window {r.min_window_auc:.3f}  "
              f"{r.tests:6,d} moves  {'SHOWN' if r.passes else 'hidden'}")
    print(f"\n{int(evidence['passes'].sum())} of {len(evidence)} products pass. {len(reads):,} price lines have a current read.")
    with SessionLocal() as db:
        save(db, evidence, reads)
    print("Saved. The site now shows the signal for the passing products.")


if __name__ == "__main__":
    main()
