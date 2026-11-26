"""United States: USDA NASS Quick Stats, "prices received by farmers".

NASS publishes these monthly, per state (and nationally). It does NOT publish county or city prices,
so the US picker is state-level. Values are US dollars per bushel. Suppressed values such as "(D)" are
skipped, never estimated. Run `python -m app.prices.ingest probe-nass` to check the live format.
"""
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Iterator

import requests

from ..config import settings
from .base import PriceRecord

SOURCE = "nass"
API = "https://quickstats.nass.usda.gov/api/api_GET/"
COMMODITY_MAP = {"CORN": "corn", "SOYBEANS": "soybeans", "WHEAT": "wheat"}  # NASS commodity_desc -> pack id
MONTHS = {m: i for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], 1)}


def _value(v: object) -> Decimal | None:
    try:
        d = Decimal(str(v).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None  # "(D)", "(NA)", "(Z)" ... = withheld or not available
    return d if d > 0 else None


def parse_record(raw: dict) -> PriceRecord | None:
    """One Quick Stats row -> a state-month price, or None if it is not exactly that."""
    if str(raw.get("agg_level_desc", "STATE")).upper() != "STATE":
        return None
    if "PRICE RECEIVED" not in str(raw.get("statisticcat_desc", "PRICE RECEIVED")).upper():
        return None
    if str(raw.get("freq_desc", "MONTHLY")).upper() != "MONTHLY":
        return None
    if str(raw.get("unit_desc", "")).replace(" ", "").upper() != "$/BU":
        return None  # e.g. corn silage is $/ton: a different product, never mixed in
    if str(raw.get("domain_desc", "TOTAL")).upper() != "TOTAL" or str(raw.get("class_desc", "ALL CLASSES")).upper() != "ALL CLASSES":
        return None  # organic or a single wheat class is a different series
    commodity = COMMODITY_MAP.get(str(raw.get("commodity_desc", "")).upper())
    month = MONTHS.get(str(raw.get("reference_period_desc", "")).upper()[:3])
    value, state = _value(raw.get("Value")), str(raw.get("state_name", "")).strip().title()
    try:
        year = int(raw.get("year"))
    except (TypeError, ValueError):
        return None
    if not (commodity and month and value and state):
        return None
    return PriceRecord(
        country="US", source=SOURCE, state=state, district="", market="State average", commodity_raw=str(raw["commodity_desc"]),
        commodity=commodity, variety="", grade="", obs_date=date(year, month, 1), min_price=None, max_price=None,
        modal_price=value, unit="bushel", currency="USD", period="monthly",
    )


def fetch_rows(limit: int | None = None, years_back: int = 3) -> Iterator[dict]:
    if not settings.nass_api_key:
        raise RuntimeError("NASS_API_KEY is not set in .env (free key: https://quickstats.nass.usda.gov/api)")
    this_year = date.today().year
    for name in COMMODITY_MAP:
        try:
            resp = requests.get(API, timeout=60, params={
                "key": settings.nass_api_key, "source_desc": "SURVEY", "sector_desc": "CROPS", "commodity_desc": name,
                "statisticcat_desc": "PRICE RECEIVED", "agg_level_desc": "STATE", "freq_desc": "MONTHLY",
                "year__GE": this_year - years_back, "format": "JSON",
            })
            resp.raise_for_status()
            data = resp.json().get("data", [])
        except requests.RequestException as exc:
            msg = str(exc).replace(settings.nass_api_key, "***")  # never show the key
            raise RuntimeError(f"Could not reach USDA NASS ({type(exc).__name__}): {msg[:200]}") from None
        yield from (data[:limit] if limit else data)
        if limit:
            return
