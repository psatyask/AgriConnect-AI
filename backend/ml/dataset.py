"""Training table for the gradient-boosting forecast experiment (offline; the web app never imports this).

One row = one price line on one date on which it was actually reported, with only information known on that date:
    features: recent price changes, volatility, level vs its own 90-day mean and vs a year ago, how often the price
              was unchanged, calendar, and what the same product did in OTHER markets over the last 1 and 7 days
    target:   y = log(price 7 days later / price today), kept only when a real report exists on both dates (never filled)
A price older than 5 days is not carried forward, so a stale line stops producing rows instead of repeating itself.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

HORIZON = 7
CARRY_DAYS = 5          # a missing day takes the last report, if it is at most this old
SEASON = 364            # same weekday one year earlier
NUMERIC = ["r1", "r3", "r7", "r14", "r28", "vol28", "z90", "yoy", "flat28", "cm_r1", "cm_r7", "cm_n",
           "xm_r1", "xm_r7", "xm_n", "sm_r7", "sm_n", "dow", "woy", "month"]
CATEGORICAL = ["commodity_code", "market_code", "unit_code"]
# cm = all other lines of the same product; xm = strictly OTHER markets; sm = other lines in the SAME market (other packages, grades)
CM, XM, SM = ["cm_r1", "cm_r7", "cm_n"], ["xm_r1", "xm_r7", "xm_n"], ["sm_r7", "sm_n"]
CROSS = CM + XM + SM


def load_panel(engine, source: str = "ams", country: str = "US") -> pd.DataFrame:
    """One price per line per day from the database (modal, else the midpoint of low and high)."""
    from sqlalchemy import func, select

    from app.models import PriceObservation as P
    value = func.coalesce(P.modal_price, (P.min_price + P.max_price) / 2, P.min_price, P.max_price)
    q = (select(P.market, P.commodity, P.variety, P.grade, P.unit, P.obs_date, func.avg(value).label("price"))
         .where(P.country == country, P.source == source, P.commodity.is_not(None), P.period == "daily", value > 0)
         .group_by(P.market, P.commodity, P.variety, P.grade, P.unit, P.obs_date))
    df = pd.read_sql(q, engine)
    df["price"] = df["price"].astype(float)
    return df


def _peer_means(values: np.ndarray, commodity: np.ndarray, market: np.ndarray) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """For each column (a price line), the mean of `values` over its peers and the number of peers reporting, three ways:
    all: every other line of the same product; other: same product in OTHER markets; same: same product, same market."""
    shape = values.shape
    out = {k: (np.full(shape, np.nan, dtype=np.float32), np.zeros(shape, dtype=np.float32)) for k in ("all", "other", "same")}
    ok = ~np.isnan(values)
    z = np.where(ok, values, 0.0)

    def fill(name: str, cols: np.ndarray, total: np.ndarray, n: np.ndarray) -> None:
        with np.errstate(invalid="ignore", divide="ignore"):
            out[name][0][:, cols] = np.where(n > 0, total / np.where(n > 0, n, 1), np.nan)
        out[name][1][:, cols] = n
    for g in np.unique(commodity):
        cg = np.where(commodity == g)[0]
        tg, ng = z[:, cg].sum(axis=1, keepdims=True), ok[:, cg].sum(axis=1, keepdims=True)
        fill("all", cg, tg - z[:, cg], ng - ok[:, cg])
        for m in np.unique(market[cg]):
            cm_ = cg[market[cg] == m]
            tm, nm = z[:, cm_].sum(axis=1, keepdims=True), ok[:, cm_].sum(axis=1, keepdims=True)
            fill("other", cm_, np.broadcast_to(tg - tm, (shape[0], len(cm_))), np.broadcast_to(ng - nm, (shape[0], len(cm_))))
            fill("same", cm_, tm - z[:, cm_], nm - ok[:, cm_])
    return out


def build(panel: pd.DataFrame, unlabeled_days: int = 0) -> pd.DataFrame:
    """Features and target for every (line, date) with a real report today and 7 days later.

    With `unlabeled_days` > 0 the most recent days are kept too, with y = NaN: their outcome is not known yet, and these are the
    rows a forecast is made from.
    """
    panel = panel.copy()
    panel["obs_date"] = pd.to_datetime(panel["obs_date"])
    panel["line"] = panel[["market", "commodity", "variety", "grade", "unit"]].astype(str).agg("|".join, axis=1)
    days = pd.date_range(panel["obs_date"].min(), panel["obs_date"].max(), freq="D")
    wide = panel.pivot_table(index="obs_date", columns="line", values="price", aggfunc="mean").reindex(days).astype("float32")
    meta = panel.drop_duplicates("line").set_index("line").loc[wide.columns]
    raw = wide.to_numpy()
    logp = np.log(wide.ffill(limit=CARRY_DAYS)).astype("float32")  # last known price, looking backwards only
    lp = logp.to_numpy()

    def shift(a: np.ndarray, k: int) -> np.ndarray:  # value k days earlier
        out = np.full_like(a, np.nan)
        out[k:] = a[:-k]
        return out
    feats = {f"r{k}": lp - shift(lp, k) for k in (1, 3, 7, 14, 28)}
    step = pd.DataFrame(lp - shift(lp, 1), index=days)
    feats["vol28"] = step.rolling(28, min_periods=10).std().to_numpy()
    feats["flat28"] = (step == 0).where(step.notna()).rolling(28, min_periods=10).mean().to_numpy()
    feats["z90"] = lp - pd.DataFrame(lp, index=days).rolling(90, min_periods=30).mean().to_numpy()
    feats["yoy"] = lp - shift(lp, SEASON)
    codes = {c: meta[c].astype("category").cat.codes.to_numpy() for c in ("commodity", "market", "unit")}
    p1 = _peer_means(feats["r1"], codes["commodity"], codes["market"])
    p7 = _peer_means(feats["r7"], codes["commodity"], codes["market"])
    feats["cm_r1"], feats["cm_n"] = p1["all"]
    feats["cm_r7"] = p7["all"][0]
    feats["xm_r1"], feats["xm_n"] = p1["other"]
    feats["xm_r7"] = p7["other"][0]
    feats["sm_r7"], feats["sm_n"] = p7["same"]
    with np.errstate(invalid="ignore"):
        target = np.log(np.roll(raw, -HORIZON, axis=0)) - np.log(raw)
    target[-HORIZON:] = np.nan  # nothing exists beyond the last day
    known = ~np.isnan(target)
    if unlabeled_days:
        known[-unlabeled_days:] = True  # the outcome is still in the future: keep the row, y stays NaN
    ti, cj = np.nonzero(~np.isnan(raw) & known)  # a real report today AND (a real report 7 days later, or not yet known)
    out = pd.DataFrame({k: v[ti, cj] for k, v in feats.items()})
    out["date"], out["line"], out["y"] = days[ti], wide.columns[cj], target[ti, cj]
    out["commodity"], out["market"] = meta["commodity"].to_numpy()[cj], meta["market"].to_numpy()[cj]
    out["variety"], out["grade"], out["unit"] = meta["variety"].to_numpy()[cj], meta["grade"].to_numpy()[cj], meta["unit"].to_numpy()[cj]
    out["dow"], out["woy"], out["month"] = out["date"].dt.dayofweek, out["date"].dt.isocalendar().week.astype(int), out["date"].dt.month
    for c, name in (("commodity", "commodity_code"), ("market", "market_code"), ("unit", "unit_code")):
        out[name] = codes[c][cj]
    return out.dropna(subset=["r1", "r7", "vol28", "z90"]).reset_index(drop=True)
