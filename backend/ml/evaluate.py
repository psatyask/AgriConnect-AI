"""Walk-forward test of Ridge, LightGBM and XGBoost against "same price as today" on real stored prices.

    pip install -r requirements-ml.txt
    python -m ml.evaluate                       # all models, 4 test windows
    python -m ml.evaluate --null                # same pipeline with the target shuffled inside each line (must show no skill)
    python -m ml.evaluate --ablate cross        # without the other-markets features
    python -m ml.evaluate --models lgbm --windows 2 --max-train-rows 300000    # quicker

Target: y = log(price in 7 days / price today). The baseline predicts y = 0 ("same as today").
Skill = 1 - (model MAE / baseline MAE) on dates the model never saw; 0 means no better than the baseline.

Rules that keep the test honest: windows are in time order; every window trains on the past only, with a 7-day gap before
validation and again before the test (targets look 7 days ahead); hyper-parameters are chosen from a small fixed grid on the
validation dates only; the test dates are scored once; the confidence interval resamples whole weeks, because neighbouring days
share information.
"""
from __future__ import annotations

import argparse
import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd

from .dataset import CATEGORICAL, CROSS, HORIZON, NUMERIC, build

warnings.filterwarnings("ignore")
GAP = HORIZON
CAT_TYPES: dict[str, pd.CategoricalDtype] = {}  # filled by run() from ALL rows, so a market first seen in test is a known category


@dataclass
class Window:
    train_end: pd.Timestamp
    val_start: pd.Timestamp
    val_end: pd.Timestamp
    test_start: pd.Timestamp
    test_end: pd.Timestamp


def make_windows(last: pd.Timestamp, n: int, test_days: int = 56, val_days: int = 56) -> list[Window]:
    out = []
    for w in range(n):
        test_end = last - pd.Timedelta(days=(n - 1 - w) * test_days)
        test_start = test_end - pd.Timedelta(days=test_days - 1)
        val_end = test_start - pd.Timedelta(days=GAP + 1)
        val_start = val_end - pd.Timedelta(days=val_days - 1)
        out.append(Window(val_start - pd.Timedelta(days=GAP + 1), val_start, val_end, test_start, test_end))
    return out


def _grid(name: str) -> list[dict]:
    if name == "lgbm":
        return [{"num_leaves": nl, "objective": ob} for nl in (15, 63) for ob in ("huber", "l1")]
    return [{"max_depth": d, "objective": ob} for d in (4, 8) for ob in ("reg:pseudohubererror", "reg:absoluteerror")]


def _fit_predict(name: str, params: dict, X_tr, y_tr, X_va, y_va, X_te) -> tuple[np.ndarray, np.ndarray]:
    """Fit one configuration; return (validation predictions, test predictions)."""
    if name == "ridge":
        from sklearn.impute import SimpleImputer
        from sklearn.linear_model import Ridge
        from sklearn.pipeline import make_pipeline
        from sklearn.preprocessing import StandardScaler
        m = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), Ridge(alpha=10.0))
        m.fit(X_tr[NUMERIC_USED], y_tr)
        return m.predict(X_va[NUMERIC_USED]), m.predict(X_te[NUMERIC_USED])
    if name == "lgbm":
        import lightgbm as lgb
        m = lgb.LGBMRegressor(n_estimators=600, learning_rate=0.05, min_child_samples=200, subsample=0.8, subsample_freq=1,
                              colsample_bytree=0.8, alpha=0.05, verbose=-1, n_jobs=-1, **params)
        m.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], eval_metric="l1", categorical_feature=[c for c in CATEGORICAL if c in X_tr],
              callbacks=[lgb.early_stopping(30, verbose=False)])
        return m.predict(X_va), m.predict(X_te)
    import xgboost as xgb
    Xs = [x.astype({c: CAT_TYPES[c] for c in CATEGORICAL if c in x}) for x in (X_tr, X_va, X_te)]  # same categories in every part
    extra = {"huber_slope": 0.05} if params["objective"] == "reg:pseudohubererror" else {}
    m = xgb.XGBRegressor(n_estimators=600, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, min_child_weight=50,
                         tree_method="hist", enable_categorical=True, eval_metric="mae", early_stopping_rounds=30, n_jobs=-1, **params, **extra)
    m.fit(Xs[0], y_tr, eval_set=[(Xs[1], y_va)], verbose=False)
    return m.predict(Xs[1]), m.predict(Xs[2])


def run(df: pd.DataFrame, models: list[str], n_windows: int, max_train_rows: int, features: list[str], seed: int = 0):
    """Returns the test rows with each model's prediction in a column named after it."""
    global NUMERIC_USED
    CAT_TYPES.update({c: pd.CategoricalDtype(sorted(df[c].unique())) for c in CATEGORICAL})
    NUMERIC_USED = [c for c in NUMERIC if c in features]
    rng = np.random.default_rng(seed)
    parts = []
    for w in make_windows(df["date"].max(), n_windows):
        tr = df[df.date <= w.train_end]
        va = df[(df.date >= w.val_start) & (df.date <= w.val_end)]
        te = df[(df.date >= w.test_start) & (df.date <= w.test_end)].copy()
        if len(tr) < 1000 or len(va) < 200 or te.empty:
            continue
        if len(tr) > max_train_rows:
            tr = tr.iloc[rng.choice(len(tr), max_train_rows, replace=False)]
        te["window"] = f"{w.test_start.date()}..{w.test_end.date()}"
        for name in models:
            best = None
            for params in ([{}] if name == "ridge" else _grid(name)):
                pv, pt = _fit_predict(name, params, tr[features], tr["y"], va[features], va["y"], te[features])
                score = float(np.mean(np.abs(va["y"].to_numpy() - pv)))  # validation dates only
                if best is None or score < best[0]:
                    best = (score, pt)
            te[name] = best[1]
        parts.append(te)
    return pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()


def skill(y: np.ndarray, pred: np.ndarray) -> float:
    base = np.mean(np.abs(y))
    return float("nan") if base == 0 else 1 - float(np.mean(np.abs(y - pred))) / base


def week_bootstrap(test: pd.DataFrame, model: str, reps: int = 1000, seed: int = 0) -> tuple[float, float]:
    """95% interval for pooled skill, resampling whole weeks (days within a week are not independent)."""
    week = test["date"].dt.to_period("W").astype(str)
    em = (test["y"] - test[model]).abs().groupby(week).sum()
    en = test["y"].abs().groupby(week).sum()
    rng = np.random.default_rng(seed)
    w = rng.multinomial(len(em), np.ones(len(em)) / len(em), size=reps)
    s = 1 - (w @ em.to_numpy()) / (w @ en.to_numpy())
    return float(np.percentile(s, 2.5)), float(np.percentile(s, 97.5))


def report(test: pd.DataFrame, models: list[str]) -> None:
    y = test["y"].to_numpy()
    print(f"\n{len(test):,} test rows over {test['window'].nunique()} windows, {test['line'].nunique():,} price lines, "
          f"{test['date'].min().date()} to {test['date'].max().date()}")
    print(f"Share of test rows where the price did not change at all in 7 days: {np.mean(y == 0):.0%}  (the baseline is exactly right on these)")
    print("\nSkill vs 'same as today' on unseen dates (positive = better; 95% interval resamples whole weeks):")
    for m in models:
        lo, hi = week_bootstrap(test, m)
        per_w = test.groupby("window").apply(lambda g: skill(g["y"].to_numpy(), g[m].to_numpy()), include_groups=False)
        print(f"  {m:6s} pooled {skill(y, test[m].to_numpy()):+.1%}  [{lo:+.1%}, {hi:+.1%}]   by window: " +
              "  ".join(f"{v:+.1%}" for v in per_w.to_numpy()))
    best = max(models, key=lambda m: skill(y, test[m].to_numpy()))
    print(f"\nBy product for the best model ({best}), pooled over the windows:")
    rows = []
    for c, g in test.groupby("commodity"):
        if len(g) >= 300:
            rows.append((c, len(g), skill(g["y"].to_numpy(), g[best].to_numpy())))
    rows.sort(key=lambda r: -r[2])
    for c, n, s in rows[:8] + ([("...", 0, float("nan"))] if len(rows) > 16 else []) + rows[-8:] if len(rows) > 16 else rows:
        print(f"  {c:14s} {s:+.1%}   ({n:,} rows)" if n else "  ...")
    print(f"  products better than baseline: {sum(r[2] > 0 for r in rows)} of {len(rows)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default="ridge,lgbm,xgb")
    ap.add_argument("--windows", type=int, default=4)
    ap.add_argument("--max-train-rows", type=int, default=1_500_000)
    ap.add_argument("--null", action="store_true", help="shuffle the target inside each line: any 'skill' is then a pipeline bug")
    ap.add_argument("--ablate", choices=["cross"], help="drop a feature group to see what it adds")
    a = ap.parse_args()
    from app.db import engine
    from .dataset import load_panel
    print("Loading prices and building features (a few minutes)...")
    df = build(load_panel(engine))
    print(f"{len(df):,} rows (price line x report date with a real report 7 days later)")
    if a.null:
        rng = np.random.default_rng(1)
        df["y"] = df.groupby("line")["y"].transform(lambda s: rng.permutation(s.to_numpy()))
        print("NULL RUN: targets shuffled inside each line.")
    features = [c for c in NUMERIC + CATEGORICAL if not (a.ablate == "cross" and c in CROSS)]
    models = a.models.split(",")
    test = run(df, models, a.windows, a.max_train_rows, features)
    if test.empty:
        print("Not enough history to make test windows; load more prices.")
        return
    report(test, models)


if __name__ == "__main__":
    main()
