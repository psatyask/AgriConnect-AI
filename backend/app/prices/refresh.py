"""Keep prices current without anyone running a command.

While the web app is running, a background thread checks every 30 minutes whether each configured source is due
(last fetched more than PRICE_REFRESH_HOURS ago) and, if so, pulls the latest. A source without its API key is skipped.
A PostgreSQL advisory lock stops two app processes from refreshing at the same time.
Nothing here invents data: it calls the same importers as the manual commands.
"""
import logging
import threading
import time

from sqlalchemy import func, select, text

from ..config import settings
from ..db import SessionLocal, engine
from ..models import PriceObservation, utcnow

log = logging.getLogger("agri.refresh")
LOCK_ID = 727_001
CHECK_EVERY_SECONDS = 30 * 60
RETRY_AFTER_SECONDS = 60 * 60  # after an attempt (even a failed or empty one), do not hit the source again for an hour
_last_attempt: dict[str, float] = {}


def _sources() -> dict:
    """source id -> (is it configured, runner). Imported lazily so importing this module stays cheap."""
    from . import ingest
    return {
        "ams": (bool(settings.mars_api_key), lambda: ingest.run_ams(days=5)),
        "nass": (bool(settings.nass_api_key), ingest.run_nass),
    }


def last_fetched(source: str):
    with SessionLocal() as db:
        return db.scalar(select(func.max(PriceObservation.fetched_at)).where(PriceObservation.source == source))


def is_due(source: str, hours: int, now: float | None = None) -> bool:
    now = now if now is not None else time.time()
    if now - _last_attempt.get(source, 0) < RETRY_AFTER_SECONDS:
        return False
    last = last_fetched(source)
    return last is None or (utcnow() - last).total_seconds() > hours * 3600


def refresh_once(force: bool = False) -> dict[str, str]:
    """Run every configured source that is due (or all of them when forced). Returns a status per source."""
    status: dict[str, str] = {}
    with engine.connect() as lock_conn:
        if not lock_conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_ID}).scalar():
            return {"all": "another process is refreshing"}
        try:
            for source, (configured, run) in _sources().items():
                if not configured:
                    status[source] = "skipped: no API key"
                elif not force and not is_due(source, settings.price_refresh_hours):
                    status[source] = "up to date"
                else:
                    _last_attempt[source] = time.time()
                    try:
                        run()
                        status[source] = "refreshed"
                    except Exception as exc:  # one failing source must not stop the others or kill the thread
                        status[source] = f"failed: {type(exc).__name__}: {str(exc)[:200]}"
                        log.warning("price refresh for %s failed: %s", source, status[source])
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_ID})
    return status


def _loop() -> None:
    time.sleep(20)  # let the app finish starting first
    while True:
        try:
            refresh_once()
        except Exception:
            log.exception("price refresh loop error")
        time.sleep(CHECK_EVERY_SECONDS)


def start_background() -> None:
    if settings.price_refresh_hours > 0:
        threading.Thread(target=_loop, name="price-refresh", daemon=True).start()
