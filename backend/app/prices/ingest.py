"""Pull prices from the configured sources into PostgreSQL.

    python -m app.prices.ingest probe        # print the real field names of one response (verifies the parser)
    python -m app.prices.ingest run          # fetch all mapped crops and upsert
    python -m app.prices.ingest probe-nass   # US: check the real USDA response format
    python -m app.prices.ingest nass         # US: load monthly state prices received (needs NASS_API_KEY)
    python -m app.prices.ingest ams [DAYS]   # US terminal market vegetable prices, last DAYS days (default 14); needs MARS_API_KEY
    python -m app.prices.ingest refresh      # refresh every configured source now (the running app also does this itself, see PRICE_REFRESH_HOURS)
    python -m app.prices.ingest probe-ams [KEYWORD|REPORT_ID [BEGIN [END]]]   # US daily markets: list reports, or show one report's raw shape
    python -m app.prices.ingest csv FILE [--since 2019-01-01]   # load a downloaded Agmarknet CSV (data.gov.in or CEDA), no API needed
"""
import csv
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path
from collections import Counter

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import PriceObservation, utcnow
import json

from . import agmarknet, ams, nass
from .base import PriceRecord

KEYS = ["source", "state", "district", "market", "commodity_raw", "variety", "grade", "obs_date", "unit"]


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


def _outline(x, name="root", depth=0) -> None:
    pad = "  " * depth
    if isinstance(x, dict):
        print(f"{pad}{name}: object, keys={list(x)}")
        for k, v in list(x.items())[:12]:
            if isinstance(v, (dict, list)) and depth < 3:
                _outline(v, k, depth + 1)
    elif isinstance(x, list):
        print(f"{pad}{name}: list of {len(x)}")
        if x and depth < 3:
            _outline(x[0], name + "[0]", depth + 1)
            if isinstance(x[0], dict):
                print(f"{pad}  first item: {json.dumps(x[0], default=str)[:2500]}")


def probe_ams(arg: str = "") -> None:
    if arg.isdigit():
        data = ams.sample_report(arg)
        Path(f"ams_{arg}.json").write_text(json.dumps(data, indent=1, default=str))
        print(f"--- A) report description (saved to ams_{arg}.json) ---")
        _outline(data)
        begin = sys.argv[3] if len(sys.argv) > 3 else (date.today() - timedelta(days=3)).strftime("%m/%d/%Y")
        end = sys.argv[4] if len(sys.argv) > 4 else None
        rows = ams.report_rows(arg, begin, end)
        Path(f"ams_{arg}_rows.json").write_text(json.dumps(rows, indent=1, default=str))
        print(f"--- B) Report Details (the prices) {begin}{' to ' + end if end else ''} (saved to ams_{arg}_rows.json) ---")
        _outline(rows)
        found = ams.rows_of(rows)
        print(f"{len(found)} rows; report dates: {sorted({r.get('report_date') for r in found})}")
        print("sample parsed:", ams.parse_record(found[0]) if found else None)
        return
    found = ams.list_reports(arg)
    for r in found[:150]:
        print(r.get("slug_id"), "|", r.get("report_title"), "|", r.get("report_date"))
    print(f"{len(found)} reports match" + (" (showing 150; add another word to narrow)" if len(found) > 150 else ""))


def run_ams(days: int | None = None) -> None:
    """US terminal market prices (vegetables, fruit) for the last N days (default 14). Needs MARS_API_KEY."""
    days = days if days is not None else int(sys.argv[2]) if len(sys.argv) > 2 else 14
    end, begin = date.today(), date.today() - timedelta(days=days)
    reports = ams.terminal_reports()
    print(f"{len(reports)} terminal market reports found; fetching {begin} to {end}")
    stored = collisions = 0
    unusable: Counter = Counter()
    conflicts: list[tuple[PriceRecord, PriceRecord]] = []
    unmapped: Counter = Counter()
    failed: list[str] = []
    with SessionLocal() as db:
        for rep in reports:
            title = str(rep.get("report_title", rep.get("slug_id")))
            try:
                raws = ams.fetch_report_rows(str(rep["slug_id"]), begin.strftime("%m/%d/%Y"), end.strftime("%m/%d/%Y"))
            except RuntimeError as exc:
                failed.append(f"{title}: {exc}")
                continue
            batch: list[PriceRecord] = []
            for raw in raws:
                rec = ams.parse_record(raw)
                if rec is None:
                    unusable[ams.reject_reason(raw) or "unknown"] += 1
                elif rec.commodity is None:
                    unmapped[rec.commodity_raw] += 1
                else:
                    batch.append(rec)
            seen: dict[tuple, PriceRecord] = {}
            for r in batch:
                k = tuple(getattr(r, f) for f in KEYS)
                if k in seen:
                    collisions += 1
                    if (seen[k].min_price, seen[k].max_price) != (r.min_price, r.max_price):
                        conflicts.append((seen[k], r))
                seen[k] = r
            stored += upsert(db, batch)
    print(f"Done. {stored} price rows stored, {sum(unusable.values())} unusable rows, "
          f"{sum(unmapped.values())} rows for products the app does not map, {collisions} rows with the same market, product, package, description and day as another (kept the last).")
    if unusable:
        print("Unusable rows by reason:", ", ".join(f"{n} ({c})" for n, c in unusable.most_common()))
    if collisions:
        print(f"Of the repeated rows, {len(conflicts)} had DIFFERENT prices (one of each pair was overwritten).")
        for a, b in conflicts[:3]:
            print(f"  e.g. {a.market} | {a.commodity_raw} | {a.variety} | {a.grade} | {a.unit} | {a.obs_date}: {a.min_price}-{a.max_price} vs {b.min_price}-{b.max_price}")
    if unmapped:
        print(f"Unmapped products ({len(unmapped)}), most common first:", ", ".join(f"{n} ({c})" for n, c in unmapped.most_common(60)))
    for f in failed[:10]:
        print("FAILED:", f)
    if stored == 0:
        print("Nothing stored. Run: python -m app.prices.ingest probe-ams <report id> to check the format.")


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


def load_csv(path: str, since: date | None = None) -> None:
    """Import an Agmarknet-style CSV (data.gov.in download or the CEDA bulk file). Same rules as the API path.

    Streams the file in chunks, so multi-gigabyte files do not need to fit in memory. `since` skips older rows.
    """
    chunk: list[PriceRecord] = []
    rows = skipped = unmapped = old = stored = 0
    with open(path, newline="", encoding="utf-8-sig") as f, SessionLocal() as db:
        for raw in csv.DictReader(f):
            rows += 1
            rec = agmarknet.parse_record(raw)
            if rec is None:
                skipped += 1
            elif rec.commodity is None:
                unmapped += 1  # a crop the app does not show (yet)
            elif since and rec.obs_date < since:
                old += 1
            else:
                chunk.append(rec)
            if len(chunk) >= 5000:
                stored += upsert(db, chunk)
                chunk = []
            if rows % 500_000 == 0:
                print(f"  ...{rows:,} rows read, {stored:,} stored", flush=True)
        stored += upsert(db, chunk)
    print(f"{rows:,} rows read: {stored:,} stored, {skipped:,} unusable, {unmapped:,} for crops the app does not map, {old:,} before the start date.")
    if rows and stored == 0:
        print("Nothing stored. Check the CSV header names, e.g. date, state_name, district_name, market_name, commodity_name, min_price, max_price, modal_price.")


def probe() -> None:
    for raw in agmarknet.fetch_pages("Tomato", limit=3, max_pages=1):
        print("fields:", sorted(raw))
        print("parsed:", agmarknet.parse_record(raw))
        return
    print("The API returned no rows for Tomato.")


def migrate() -> None:
    """Bring the database schema up to date first, so a new release never writes to an old table."""
    backend = Path(__file__).resolve().parents[2]
    result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=backend, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit("Could not update the database schema. Is the database running (docker compose up -d db)?\n" + result.stderr[-800:])


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd in ("run", "nass", "csv", "ams", "refresh"):
        migrate()
    if cmd == "csv" and len(sys.argv) in (3, 5) and (len(sys.argv) == 3 or sys.argv[3] == "--since"):
        load_csv(sys.argv[2], date.fromisoformat(sys.argv[4]) if len(sys.argv) == 5 else None)
    elif cmd == "ams":
        run_ams()
    elif cmd == "refresh":
        from . import refresh
        for src, msg in refresh.refresh_once(force=True).items():
            print(f"{src}: {msg}")
    elif cmd == "probe-ams":
        probe_ams(sys.argv[2] if len(sys.argv) > 2 else "")
    elif cmd in ("run", "probe", "nass", "probe-nass"):
        {"run": run, "probe": probe, "nass": run_nass, "probe-nass": probe_nass}[cmd]()
    else:
        sys.exit(__doc__)
