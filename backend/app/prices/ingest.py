"""Pull prices from the configured sources into PostgreSQL.

    python -m app.prices.ingest probe        # print the real field names of one response (verifies the parser)
    python -m app.prices.ingest run          # fetch all mapped crops and upsert
"""
import sys
from collections import Counter

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import PriceObservation, utcnow
from . import agmarknet
from .base import PriceRecord

KEYS = ["source", "state", "district", "market", "commodity_raw", "variety", "grade", "obs_date"]


def upsert(db: Session, records: list[PriceRecord]) -> int:
    """Idempotent: re-running updates a day's price (sources correct values) instead of duplicating it."""
    if not records:
        return 0
    rows = [{**{k: getattr(r, k) for k in (
        "country", "source", "state", "district", "market", "commodity_raw", "commodity", "variety", "grade",
        "obs_date", "min_price", "max_price", "modal_price", "unit", "currency")}, "fetched_at": utcnow()} for r in records]
    for i in range(0, len(rows), 1000):
        stmt = insert(PriceObservation).values(rows[i:i + 1000])
        update = {c: stmt.excluded[c] for c in ("country", "commodity", "min_price", "max_price", "modal_price", "unit", "currency", "fetched_at")}
        db.execute(stmt.on_conflict_do_update(constraint="uq_price_observation", set_=update))
    db.commit()
    return len(rows)


def run() -> None:
    total, skipped = 0, Counter()
    with SessionLocal() as db:
        for canonical, name in agmarknet.REQUEST_NAMES.items():
            batch: list[PriceRecord] = []
            for raw in agmarknet.fetch_pages(name):
                rec = agmarknet.parse_record(raw)
                if rec is None:
                    skipped[canonical] += 1
                elif rec.commodity == canonical:  # the API filter can be loose; keep only exact matches
                    batch.append(rec)
            n = upsert(db, batch)
            total += n
            print(f"{canonical}: stored {n}, skipped {skipped[canonical]} unusable rows")
    print(f"Done. {total} price rows stored.")


def probe() -> None:
    for raw in agmarknet.fetch_pages("Tomato", limit=3, max_pages=1):
        print("fields:", sorted(raw))
        print("parsed:", agmarknet.parse_record(raw))
        return
    print("The API returned no rows for Tomato.")


if __name__ == "__main__":
    {"run": run, "probe": probe}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()
