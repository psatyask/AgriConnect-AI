"""USDA AMS Market News (MARS API): daily terminal market prices for vegetables.

Auth is HTTP Basic with the API key as the username and an empty password. The key is never printed.
Prices are quoted per package ("25 lb sacks loose"), as a low-high range. Nothing is converted or estimated:
the package is kept as the unit, and there is no modal price (USDA's "mostly" range is not one).
"""
import time
from datetime import datetime
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

import requests

from ..config import settings
from .base import PriceRecord

SOURCE = "ams"
BASE = "https://marsapi.ams.usda.gov/services/v1.2"
# Strict, like the other sources: a product is mapped only by an exact USDA name, so crops are never merged by accident
# (sweet potatoes are not potatoes, green onions are not dry onions). The names below are copied from real import output.
# Everything else is counted and listed by the import, so the next names to add are visible.
COMMODITY_MAP = {
    "tomatoes": "tomato", "onions, dry": "onion", "onions dry": "onion", "dry onions": "onion",
    "potatoes": "potato", "sweet potatoes": "sweet_potato", "mushrooms": "mushroom", "peppers, bell type": "bell_pepper",
    "carrots": "carrot", "cucumbers": "cucumber", "garlic": "garlic", "cabbage": "cabbage", "eggplant": "eggplant", "broccoli": "broccoli",
}
STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado", "CT": "Connecticut",
    "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming", "PR": "Puerto Rico",
}


def _get(path: str, params: dict | None = None):
    if not settings.mars_api_key:
        raise RuntimeError("MARS_API_KEY is not set in .env")
    try:
        r = requests.get(f"{BASE}/{path}", params=params, auth=(settings.mars_api_key, ""), timeout=60)
    except requests.RequestException as e:
        raise RuntimeError(f"Could not reach the MARS API ({type(e).__name__})") from None
    if r.status_code != 200:
        raise RuntimeError(f"MARS API returned HTTP {r.status_code} for {path}")
    return r.json()


def list_reports(keyword: str = "") -> list[dict]:
    data = _get("reports")
    items = data if isinstance(data, list) else data.get("results", [])
    k = keyword.lower()
    return [i for i in items if not k or all(w in str(i.get("report_title", "")).lower() for w in k.split())]


def sample_report(slug_id: str, limit: int = 3):
    return _get(f"reports/{slug_id}", {"allSections": "true"})


def report_rows(slug_id: str, begin: str, end: str | None = None, section: str = "Report Details"):
    """One section of a report for a date or date range (MM/DD/YYYY): reports/<id>/<section>?q=report_begin_date=<a>[:<b>]."""
    span = f"{begin}:{end}" if end else begin
    return _get(f"reports/{slug_id}/{quote(section)}", {"q": f"report_begin_date={span}"})


def rows_of(data) -> list[dict]:
    """The price rows from a response, whether it is one section (an object) or a list of sections."""
    sections = data if isinstance(data, list) else [data]
    return [row for s in sections if isinstance(s, dict) for row in s.get("results", [])]


def terminal_reports() -> list[dict]:
    """Current terminal market reports for vegetables, onions/potatoes and fruit. Discontinued ones are skipped.

    Fruit is fetched so that its product names show up in the import's "unmapped" list, ready to be added.
    """
    out = []
    for r in list_reports("terminal market"):
        title = str(r.get("report_title", "")).lower()
        if "discontinued" not in title and any(k in title for k in ("vegetable", "onion", "potato", "fruit")):
            out.append(r)
    return out


def fetch_report_rows(slug_id: str, begin: str, end: str) -> list[dict]:
    time.sleep(0.15)  # be polite to a free public service
    return rows_of(report_rows(slug_id, begin, end))


def _clean(v: object) -> str:
    s = str(v if v is not None else "").strip()
    return "" if s.upper() in ("", "N/A", "NA", "NONE", "NULL") else s


def _price(v: object) -> Decimal | None:
    try:
        d = Decimal(str(v).replace(",", "").replace("$", "").strip())
    except (InvalidOperation, ValueError):
        return None
    return d if d > 0 else None


def _read(raw: dict):
    """-> (fields, None) when the row can be trusted, else (None, reason)."""
    try:
        obs = datetime.strptime(str(raw.get("report_date") or raw.get("report_begin_date")), "%m/%d/%Y").date()
    except ValueError:
        return None, "bad date"
    market, name = _clean(raw.get("market_location_name")), _clean(raw.get("commodity"))
    state = STATES.get(_clean(raw.get("market_location_state")).upper())
    unit = _clean(raw.get("package")) or _clean(raw.get("unit_sales"))  # a price without its package is meaningless
    low, high = _price(raw.get("low_price")), _price(raw.get("high_price"))
    if not (market and name):
        return None, "no market or product"
    if not state:
        return None, "market not in a US state"
    if not unit:
        return None, "no package or unit"
    if low is None and high is None:
        return None, "no price"
    if low and high and low > high:
        return None, "low price above high price"
    return (obs, market, name, state, unit, low, high), None


def reject_reason(raw: dict) -> str | None:
    return _read(raw)[1]


def parse_record(raw: dict) -> PriceRecord | None:
    """One report row -> a price for one market, product, package and day, or None if it cannot be trusted."""
    fields, _ = _read(raw)
    if fields is None:
        return None
    obs, market, name, state, unit, low, high = fields
    origin = ", ".join(x for x in (_clean(raw.get("origin")), _clean(raw.get("district"))) if x)
    # Everything that distinguishes one reported line from another, so different lines never overwrite each other.
    parts = [_clean(raw.get(k)) for k in ("grade", "item_size", "appearance", "quality", "condition", "crop", "environment", "storage", "repack",
                                         "transportation_mode", "properties")]
    sold_by = _clean(raw.get("unit_sales"))
    parts += [f"sold {sold_by}"] if sold_by and sold_by != unit else []
    organic = _clean(raw.get("organic")).upper()
    parts += [f"organic {organic.lower()}" if organic not in ("Y", "YES") else "organic"] if organic not in ("", "N", "NO", "N/A", "NA") else []
    parts += [f"from {origin}"] if origin else []
    note = _clean(raw.get("reporter_comment"))  # USDA's own note; it is what separates otherwise identical lines (e.g. pink vs regular oyster)
    parts += [f"note: {note[:80]}"] if note else []
    return PriceRecord(
        country="US", source=SOURCE, state=state, district="", market=market, commodity_raw=name,
        commodity=COMMODITY_MAP.get(name.lower()), variety=_clean(raw.get("variety"))[:200], grade=" · ".join(p for p in parts if p)[:200],
        obs_date=obs, min_price=low, max_price=high, modal_price=None, unit=unit[:100], currency="USD",
    )


def differing_fields(a: dict, b: dict) -> list[str]:
    """Names of the raw USDA fields whose values differ between two rows (used to find what separates look-alike lines)."""
    return sorted(k for k in set(a) | set(b) if _clean(a.get(k)) != _clean(b.get(k)))
