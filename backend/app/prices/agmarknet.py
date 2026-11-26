"""India: Agmarknet daily wholesale (mandi) prices, via the Government of India open data API (data.gov.in).

Prices are Rs per quintal: minimum, maximum and modal. The response format below follows the
published dataset; run `python -m app.prices.ingest probe` once with your key to confirm the real
field names (the parser is tolerant of case and spacing differences).
"""
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Iterator

import requests

from ..config import settings
from .base import PriceRecord

SOURCE = "agmarknet"
API = "https://api.data.gov.in/resource/{resource}"

# Agmarknet commodity name (lower case, exact) -> canonical id of the India country pack.
# Deliberately strict: "Green Chilli" is a different product from dry chillies, so it is NOT mapped.
COMMODITY_MAP = {
    "tomato": "tomato",
    "onion": "onion",
    "rice": "rice",
    "dry chillies": "chilli",
    "maize": "maize",
}
# Names to ask the API for (one request series per crop).
REQUEST_NAMES = {"tomato": "Tomato", "onion": "Onion", "rice": "Rice", "chilli": "Dry Chillies", "maize": "Maize"}


def _key(k: str) -> str:
    """Normalise field names: case, spaces and SharePoint-style '_x0020_' escapes."""
    return re.sub(r"[^a-z0-9]+", "_", k.replace("_x0020_", "_").lower()).strip("_")


def _price(v: object) -> Decimal | None:
    try:
        d = Decimal(str(v).strip())
    except (InvalidOperation, ValueError):
        return None
    return d if d > 0 else None  # 0 / negative / NA means "not reported"


def _date(v: object) -> date | None:
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(v).strip(), fmt).date()
        except ValueError:
            continue
    return None


def parse_record(raw: dict) -> PriceRecord | None:
    """Turn one API row into a PriceRecord, or None if it cannot be trusted."""
    r = {_key(k): (v.strip() if isinstance(v, str) else v) for k, v in raw.items()}
    obs = _date(r.get("arrival_date"))
    lo, hi, modal = _price(r.get("min_price")), _price(r.get("max_price")), _price(r.get("modal_price"))
    market, state, name = r.get("market") or "", r.get("state") or "", r.get("commodity") or ""
    if not (obs and market and state and name) or modal is None:
        return None
    if lo is not None and hi is not None and lo > hi:
        return None  # inconsistent row: drop rather than guess which side is wrong
    return PriceRecord(
        country="IN", source=SOURCE, state=state, district=r.get("district") or "", market=market,
        commodity_raw=name, commodity=COMMODITY_MAP.get(name.lower()), variety=r.get("variety") or "",
        grade=r.get("grade") or "", obs_date=obs, min_price=lo, max_price=hi, modal_price=modal,
        unit="quintal", currency="INR",
    )


def fetch_pages(commodity_name: str, limit: int = 1000, max_pages: int = 20) -> Iterator[dict]:
    if not settings.data_gov_in_api_key:
        raise RuntimeError("DATA_GOV_IN_API_KEY is not set in .env")
    url = API.format(resource=settings.agmarknet_resource_id)
    for page in range(max_pages):
        resp = requests.get(url, timeout=30, params={
            "api-key": settings.data_gov_in_api_key, "format": "json", "limit": limit, "offset": page * limit,
            "filters[commodity]": commodity_name,
        })
        resp.raise_for_status()
        records = resp.json().get("records", [])
        yield from records
        if len(records) < limit:
            return
