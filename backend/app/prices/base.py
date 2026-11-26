from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class PriceRecord:
    """One reported wholesale price, normalised across countries. Never estimated or filled in."""

    country: str          # ISO 3166-1 alpha-2, e.g. "IN"
    source: str           # e.g. "agmarknet"
    state: str
    district: str         # district (IN) / county (US) when the source reports one, else ""
    market: str           # the reporting market (mandi, terminal market, grain location)
    commodity_raw: str    # name exactly as the source reports it
    commodity: str | None  # canonical id used by country packs, None if we do not map it
    variety: str
    grade: str
    obs_date: date
    min_price: Decimal | None
    max_price: Decimal | None
    modal_price: Decimal | None  # most common / average price
    unit: str             # unit id the price is quoted per, e.g. "quintal"
    currency: str
