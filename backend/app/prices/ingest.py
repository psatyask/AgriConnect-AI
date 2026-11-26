"""Pull prices from the configured sources into PostgreSQL.

    python -m app.prices.ingest probe        # print the real field names of one response (verifies the parser)
    python -m app.prices.ingest run          # fetch all mapped crops and upsert
    python -m app.prices.ingest probe-nass   # US: check the real USDA response format
    python -m app.prices.ingest nass         # US: load monthly state prices received (needs NASS_API_KEY)
    python -m app.prices.ingest csv FILE     # load a CSV downloaded from data.gov.in / Agmarknet (no API needed)
"""
import csv
import sys
from collections import Counter

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import PriceObservation, utcnow
from . import agmarknet, nass
from .base import PriceRecord

KEYS = ["source", "state", "district", "market", "commodity_raw", "variety", "grade", "obs_date"]


def upsert(db: Session, records: list[PriceRecord]) -> int:
    """Idempotent: re-running updates a day's price (sources correct values) instead of duplicating it."""
    if not records:
        return 0
    unique = {tuple(getattr(r, k) for k in KEYS): r for r in records}  # later rows win; one row per key per statement
    rows = [{**{k: getattr(r, k) for k in (
        "country", "source", "state", "district", "market", "commodity_raw", "commodity", "variety", "grade",
        "obs_date", "min_price", "max_price", "modal_price", "unit", "currency", "period")}, "fetched_at": utcnow()} for r in unique.values()]
    for i in range(0, len(rows), 1000):
        stmt = insert(PriceObservation).values(rows[i:i + 1000])
        update = {c: stmt.excluded[c] for c in ("country", "commodity", "min_price", "max_price", "modal_price", "unit", "currency", "period", "fetched_at")}
        db.execute(stmt.on_conflict_do_update(constraint="uq_price_observation", set_=update))
    db.commit()
    return len(rows)


def run_nass() -> None:
    """US: USDA NASS monthly prices received by farmers, by state."""
    batch, skipped = [], 0
    for raw in nass.fetch_rows():
        rec = nass.parse_record(raw)
        if rec is None:
            skipped += 1
        else:
            batch.append(rec)
    with SessionLocal() as db:
        n = upsert(db, batch)
    print(f"NASS: stored {n} state-month prices, skipped {skipped} rows (suppressed, not a monthly state price, or other units).")


def probe_nass() -> None:
    for raw in nass.fetch_rows(limit=3):
        print("fields:", sorted(raw))
        print("parsed:", nass.parse_record(raw))
        return
    print("NASS returned no rows.")


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


def load_csv(path: str) -> None:
    """Import a downloaded Agmarknet CSV. Same parsing and filtering rules as the API path."""
    batch: list[PriceRecord] = []
    rows = skipped = unmapped = 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        for raw in csv.DictReader(f):
            rows += 1
            rec = agmarknet.parse_record(raw)
            if rec is None:
                skipped += 1
            elif rec.commodity is None:
                unmapped += 1  # a crop the app does not show yet; kept out to keep the table small
            else:
                batch.append(rec)
    with SessionLocal() as db:
        n = upsert(db, batch)
    print(f"{rows} rows read: {n} stored, {skipped} unusable, {unmapped} for crops the app does not map.")
    if rows and n == 0:
        print("Nothing stored. Check the CSV header names, e.g. State, District, Market, Commodity, Arrival_Date, Min_Price, Max_Price, Modal_Price.")


def probe() -> None:
    for raw in agmarknet.fetch_pages("Tomato", limit=3, max_pages=1):
        print("fields:", sorted(raw))
        print("parsed:", agmarknet.parse_record(raw))
        return
    print("The API returned no rows for Tomato.")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "csv" and len(sys.argv) == 3:
        load_csv(sys.argv[2])
    elif cmd in ("run", "probe", "nass", "probe-nass"):
        {"run": run, "probe": probe, "nass": run_nass, "probe-nass": probe_nass}[cmd]()
    else:
        sys.exit(__doc__)
