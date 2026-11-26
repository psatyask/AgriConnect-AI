import json
from datetime import date
from pathlib import Path

from app.db import SessionLocal
from app.models import PriceObservation
from app.prices import agmarknet
from app.prices.ingest import upsert

RAW = json.loads((Path(__file__).parent / "fixtures" / "agmarknet_format_sample.json").read_text())["records"]


def parsed():
    return [r for r in map(agmarknet.parse_record, RAW) if r]


def test_parser_keeps_good_rows_and_drops_untrustworthy_ones():
    recs = parsed()
    assert len(recs) == 4  # zero prices, min>max and unparseable date are dropped
    first = recs[0]
    assert (first.commodity, first.modal_price, first.unit, first.currency) == ("tomato", 2200, "quintal", "INR")
    assert first.obs_date == date(2026, 11, 26)


def test_parser_tolerates_other_field_spellings():
    r = agmarknet.parse_record(RAW[2])  # Capitalised keys, '_x0020_' spaces
    assert r and r.market == "Test Mandi 2" and r.modal_price == 2250


def test_unmapped_crops_are_stored_but_not_given_a_canonical_id():
    green = next(r for r in parsed() if r.commodity_raw == "Green Chilli")
    assert green.commodity is None  # never silently merged with dry chillies


def test_ingest_is_idempotent_and_updates_corrected_prices():
    recs = parsed()
    with SessionLocal() as db:
        upsert(db, recs)
        upsert(db, recs)
        assert db.query(PriceObservation).count() == 4
        corrected = [r.__class__(**{**r.__dict__, "modal_price": 2300}) if r.market == "Test Mandi 1" and r.commodity == "tomato" else r for r in recs]
        upsert(db, corrected)
        row = db.query(PriceObservation).filter_by(market="Test Mandi 1", commodity="tomato").one()
        assert float(row.modal_price) == 2300


def seed():
    with SessionLocal() as db:
        upsert(db, parsed())


def test_locations_only_lists_places_with_data(client):
    seed()
    body = client.get("/api/prices/locations?country=IN&commodity=tomato").json()
    assert body["as_of"] == "2026-11-26"
    districts = {d["district"]: d["markets"] for s in body["states"] for d in s["districts"]}
    assert districts == {"Test District A": ["Test Mandi 1"], "Test District B": ["Test Mandi 2"]}
    assert client.get("/api/prices/locations?country=IN&commodity=rice").json() == {"as_of": None, "states": []}


def test_latest_returns_newest_row_per_market_with_source(client):
    seed()
    items = client.get("/api/prices?country=IN&commodity=tomato").json()["items"]
    assert {i["market"] for i in items} == {"Test Mandi 1", "Test Mandi 2"}
    assert all(i["source_label"] == "Agmarknet (Government of India)" for i in items)
    one = client.get("/api/prices?country=IN&commodity=tomato&district=Test District B").json()["items"]
    assert len(one) == 1 and one[0]["modal"] == 2250 and one[0]["date"] == "2026-11-25"


def test_nothing_is_invented_for_unknown_places_or_countries(client):
    seed()
    assert client.get("/api/prices?country=IN&commodity=tomato&market=Nowhere").json() == {"items": []}
    assert client.get("/api/prices?country=US&commodity=corn").json() == {"items": []}
    assert client.get("/api/prices?country=india&commodity=tomato").status_code == 422


def test_history_skips_days_without_reports(client, monkeypatch):
    seed()
    from app import price_api
    from datetime import datetime, timezone
    monkeypatch.setattr(price_api, "utcnow", lambda: datetime(2026, 11, 27, tzinfo=timezone.utc))
    pts = client.get("/api/prices/history?country=IN&commodity=tomato&days=30").json()["points"]
    assert pts == [{"date": "2026-11-25", "price": 2250.0, "reports": 1}, {"date": "2026-11-26", "price": 2200.0, "reports": 1}]


def test_csv_import_matches_api_rules(client, capsys):
    from app.prices.ingest import load_csv
    load_csv(str(Path(__file__).parent / "fixtures" / "agmarknet_format_sample.csv"))
    out = capsys.readouterr().out
    assert "4 rows read: 2 stored, 1 unusable, 1 for crops the app does not map" in out
    assert client.get("/api/prices?country=IN&commodity=tomato").json()["items"][0]["market"] in {"Test Mandi 1", "Test Mandi 2"}


def test_column_aliases_from_other_exports():
    r = agmarknet.parse_record({"state": "S", "district": "D", "market_name": "M", "commodity_name": "Onion", "date": "2026-11-26",
                                "min": "1", "max": "3", "modal": "2"})
    assert r and (r.market, r.commodity, r.modal_price) == ("M", "onion", 2)


def test_api_errors_never_contain_the_key(monkeypatch):
    import pytest, requests
    from app.config import settings
    monkeypatch.setattr(settings, "data_gov_in_api_key", "SECRETKEY123")
    def boom(*a, **k):
        raise requests.ConnectionError("failed https://api.data.gov.in/x?api-key=SECRETKEY123&format=json")
    monkeypatch.setattr(requests, "get", boom)
    with pytest.raises(RuntimeError) as e:
        list(agmarknet.fetch_pages("Tomato"))
    assert "SECRETKEY123" not in str(e.value) and "csv FILE" in str(e.value)
