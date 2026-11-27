from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import PriceObservation as P, utcnow

router = APIRouter(prefix="/api/prices")
Db = Annotated[Session, Depends(get_db)]
Country = Annotated[str, Query(pattern=r"^[A-Z]{2}$")]
Crop = Annotated[str, Query(pattern=r"^[a-z][a-z0-9_]{1,39}$")]
Place = Annotated[str | None, Query(max_length=200)]

SOURCES = {"agmarknet": "Agmarknet (Government of India)", "nass": "USDA NASS, prices received by farmers",
           "ams": "USDA AMS Market News, terminal markets"}


def _scope(stmt, country: str, commodity: str, state: str | None, district: str | None, market: str | None):
    stmt = stmt.where(P.country == country, P.commodity == commodity)
    for col, val in ((P.state, state), (P.district, district), (P.market, market)):
        if val:
            stmt = stmt.where(col == val)
    return stmt


@router.get("/locations")
def locations(db: Db, country: Country, commodity: Crop) -> dict:
    """Only places that actually have reported prices for this crop, as state > district > market."""
    rows = db.execute(select(P.state, P.district, P.market).where(P.country == country, P.commodity == commodity)
                      .distinct().order_by(P.state, P.district, P.market)).all()
    tree: dict[str, dict[str, list[str]]] = {}
    for state, district, market in rows:
        tree.setdefault(state, {}).setdefault(district, []).append(market)
    latest = db.scalar(select(func.max(P.obs_date)).where(P.country == country, P.commodity == commodity))
    return {"as_of": latest.isoformat() if latest else None,
            "states": [{"state": s, "districts": [{"district": d, "markets": m} for d, m in ds.items()]} for s, ds in tree.items()]}


@router.get("")
def latest(db: Db, country: Country, commodity: Crop, state: Place = None, district: Place = None, market: Place = None,
           limit: Annotated[int, Query(ge=1, le=500)] = 50) -> dict:
    """The most recent reported price for each market/variety/grade/package in scope. Nothing is estimated."""
    base = _scope(select(P, func.row_number().over(
        partition_by=(P.market, P.variety, P.grade, P.unit), order_by=P.obs_date.desc()).label("rn")), country, commodity, state, district, market)
    ranked = base.subquery()  # works on every SQLAlchemy 2.x (no PostgreSQL-only DISTINCT ON helper)
    total = db.scalar(select(func.count()).select_from(ranked).where(ranked.c.rn == 1)) or 0  # so the page can say when it shows only part
    rows = db.execute(select(ranked).where(ranked.c.rn == 1).order_by(ranked.c.obs_date.desc(), ranked.c.market).limit(limit)).mappings().all()
    checked = max((r["fetched_at"] for r in rows), default=None)
    return {"total": total, "checked_at": checked.isoformat() if checked else None, "items": [{
        "state": r["state"], "district": r["district"], "market": r["market"], "variety": r["variety"], "grade": r["grade"],
        "date": r["obs_date"].isoformat(), "min": float(r["min_price"]) if r["min_price"] is not None else None,
        "max": float(r["max_price"]) if r["max_price"] is not None else None, "modal": float(r["modal_price"]) if r["modal_price"] is not None else None,
        "unit": r["unit"], "currency": r["currency"], "period": r["period"], "source": r["source"], "source_label": SOURCES.get(r["source"], r["source"]),
    } for r in rows]}


@router.get("/history")
def history(db: Db, country: Country, commodity: Crop, state: Place = None, district: Place = None, market: Place = None,
            variety: Place = None, unit: Place = None, days: Annotated[int, Query(ge=7, le=730)] = 90) -> dict:
    """Daily average price in scope; days with no report are simply absent (no interpolation).

    Sources with a modal price are charted by modal. Range-only sources (USDA terminal markets) are charted by the midpoint
    of the reported low-high range. Prices quoted per different packages are never averaged together, and range-only data
    is not averaged across different varieties: the caller is told to pick one (`needs`).
    """
    since = (utcnow() - timedelta(days=days)).date()

    def scoped(stmt):
        stmt = _scope(stmt, country, commodity, state, district, market).where(P.obs_date >= since)
        if variety:
            stmt = stmt.where(P.variety == variety)
        if unit:
            stmt = stmt.where(P.unit == unit)
        return stmt

    n_units, n_varieties, n_no_modal, only_unit = db.execute(scoped(select(
        func.count(func.distinct(P.unit)), func.count(func.distinct(P.variety)).filter(P.variety != ""),
        func.count().filter(P.modal_price.is_(None)), func.min(P.unit)))).one()
    basis = "midpoint" if n_no_modal else "modal"
    out = {"points": [], "basis": basis, "unit": only_unit if n_units == 1 else None, "needs": None}
    if n_units > 1:
        return {**out, "needs": "unit"}
    if basis == "midpoint" and n_varieties > 1:
        return {**out, "needs": "variety"}
    value = func.coalesce(P.modal_price, (P.min_price + P.max_price) / 2, P.min_price, P.max_price)
    rows = db.execute(scoped(select(P.obs_date, func.avg(value), func.count())).where(value.is_not(None)).group_by(P.obs_date).order_by(P.obs_date)).all()
    return {**out, "points": [{"date": d.isoformat(), "price": round(float(a), 2), "reports": n} for d, a, n in rows]}
