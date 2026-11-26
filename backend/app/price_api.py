from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session

from .db import get_db
from .models import PriceObservation as P, utcnow

router = APIRouter(prefix="/api/prices")
Db = Annotated[Session, Depends(get_db)]
Country = Annotated[str, Query(pattern=r"^[A-Z]{2}$")]
Crop = Annotated[str, Query(pattern=r"^[a-z][a-z0-9_]{1,39}$")]
Place = Annotated[str | None, Query(max_length=200)]

SOURCES = {"agmarknet": "Agmarknet (Government of India)"}


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
           limit: Annotated[int, Query(ge=1, le=200)] = 50) -> dict:
    """The most recent reported price for each market/variety/grade in scope. Nothing is estimated."""
    base = _scope(select(P), country, commodity, state, district, market)
    newest = base.ext(distinct_on(P.market, P.variety, P.grade)).order_by(P.market, P.variety, P.grade, P.obs_date.desc()).subquery()
    rows = db.execute(select(newest).order_by(newest.c.obs_date.desc(), newest.c.market).limit(limit)).mappings().all()
    return {"items": [{
        "state": r["state"], "district": r["district"], "market": r["market"], "variety": r["variety"], "grade": r["grade"],
        "date": r["obs_date"].isoformat(), "min": float(r["min_price"]) if r["min_price"] is not None else None,
        "max": float(r["max_price"]) if r["max_price"] is not None else None, "modal": float(r["modal_price"]) if r["modal_price"] is not None else None,
        "unit": r["unit"], "currency": r["currency"], "source": r["source"], "source_label": SOURCES.get(r["source"], r["source"]),
    } for r in rows]}


@router.get("/history")
def history(db: Db, country: Country, commodity: Crop, state: Place = None, district: Place = None, market: Place = None,
            days: Annotated[int, Query(ge=7, le=730)] = 90) -> dict:
    """Daily average of the modal price in scope. Days with no report are simply absent (no interpolation)."""
    since = (utcnow() - timedelta(days=days)).date()
    stmt = _scope(select(P.obs_date, func.avg(P.modal_price), func.count()), country, commodity, state, district, market)
    rows = db.execute(stmt.where(P.obs_date >= since, P.modal_price.is_not(None)).group_by(P.obs_date).order_by(P.obs_date)).all()
    return {"points": [{"date": d.isoformat(), "price": round(float(a), 2), "reports": n} for d, a, n in rows]}
