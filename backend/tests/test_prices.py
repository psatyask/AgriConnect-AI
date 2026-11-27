import sys
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
    assert client.get("/api/prices?country=IN&commodity=tomato&market=Nowhere").json() == {"total": 0, "checked_at": None, "items": []}
    assert client.get("/api/prices?country=US&commodity=corn").json() == {"total": 0, "checked_at": None, "items": []}
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


NASS_RAW = json.loads((Path(__file__).parent / "fixtures" / "nass_format_sample.json").read_text())["data"]


def nass_records():
    from app.prices import nass
    return [r for r in map(nass.parse_record, NASS_RAW) if r]


def test_nass_parser_keeps_only_monthly_state_dollar_per_bushel_prices():
    recs = nass_records()
    # kept: corn Oct, corn Sep, soybeans Oct. Dropped: (D), $/TON, organic, national, annual, oats.
    assert sorted((r.state, r.commodity, r.obs_date.isoformat(), float(r.modal_price)) for r in recs) == [
        ("Test State One", "corn", "2026-09-01", 3.95), ("Test State One", "corn", "2026-10-01", 4.1),
        ("Test State Two", "soybeans", "2026-10-01", 10.25)]
    assert all(r.unit == "bushel" and r.currency == "USD" and r.period == "monthly" and r.min_price is None for r in recs)


def test_us_prices_through_the_api_are_state_level_and_labeled(client, monkeypatch):
    from datetime import datetime, timezone
    from app import price_api
    monkeypatch.setattr(price_api, "utcnow", lambda: datetime(2026, 11, 27, tzinfo=timezone.utc))
    with SessionLocal() as db:
        upsert(db, nass_records())
    body = client.get("/api/prices?country=US&commodity=corn").json()["items"]
    assert [(i["state"], i["date"], i["modal"], i["period"], i["min"]) for i in body] == [("Test State One", "2026-10-01", 4.1, "monthly", None)]
    assert body[0]["source_label"].startswith("USDA NASS")
    loc = client.get("/api/prices/locations?country=US&commodity=corn").json()
    assert [s["state"] for s in loc["states"]] == ["Test State One"]
    hist = client.get("/api/prices/history?country=US&commodity=corn&state=Test State One&days=730").json()["points"]
    assert [(p["date"], p["price"]) for p in hist] == [("2026-09-01", 3.95), ("2026-10-01", 4.1)]


def test_duplicate_rows_in_one_batch_do_not_crash_the_upsert():
    recs = nass_records()
    with SessionLocal() as db:
        assert upsert(db, recs + recs) == 3


def test_nass_errors_never_contain_the_key(monkeypatch):
    import pytest, requests
    from app.config import settings
    from app.prices import nass
    monkeypatch.setattr(settings, "nass_api_key", "NASSSECRET9")
    def boom(*a, **k):
        raise requests.ConnectionError("failed ...?key=NASSSECRET9&format=JSON")
    monkeypatch.setattr(requests, "get", boom)
    with pytest.raises(RuntimeError) as e:
        list(nass.fetch_rows())
    assert "NASSSECRET9" not in str(e.value)


def test_ceda_bulk_format_with_since_filter(client, capsys):
    from datetime import date
    from app.prices.ingest import load_csv
    load_csv(str(Path(__file__).parent / "fixtures" / "ceda_format_sample.csv"), since=date(2020, 1, 1))
    out = capsys.readouterr().out
    assert "4 rows read: 2 stored, 0 unusable, 1 for crops the app does not map, 1 before the start date" in out
    loc = client.get("/api/prices/locations?country=IN&commodity=chilli").json()
    assert loc["as_of"] == "2021-12-30" and loc["states"][0]["state"] == "Test State"
    assert client.get("/api/prices?country=IN&commodity=tomato").json()["items"][0]["modal"] == 2200


AMS_RAW = json.loads((Path(__file__).parent / "fixtures" / "ams_format_sample.json").read_text())["results"]


def test_ams_parser_keeps_package_as_the_unit_and_never_invents_a_modal():
    from app.prices import ams
    recs = [r for r in map(ams.parse_record, AMS_RAW) if r]
    # kept: 3 tomato lines, 2 dry-onion days, 1 pearl-onion line (unmapped). Dropped: no package, no price, low>high, bad date, unknown state.
    assert len(recs) == 6
    t = recs[0]
    assert (t.commodity, t.state, t.market, t.unit, t.currency) == ("tomato", "North Carolina", "Test Terminal Market", "25 lb cartons", "USD")
    assert (t.min_price, t.max_price, t.modal_price) == (20, 24, None)  # the "mostly" range is not a modal price
    assert t.grade == "US No. 1 · large · from Mexico, SINALOA"
    assert next(r for r in recs if r.commodity_raw == "Onions, Pearl").commodity is None  # never merged with dry onions


def test_ams_lines_that_differ_only_by_package_or_organic_are_kept_apart(client):
    from app.prices import ams
    recs = [r for r in map(ams.parse_record, AMS_RAW) if r and r.commodity == "tomato"]
    with SessionLocal() as db:
        upsert(db, recs)
        upsert(db, recs)
        assert db.query(PriceObservation).count() == 3  # 25 lb, 20 lb and organic stay separate; re-run adds nothing
    items = client.get("/api/prices?country=US&commodity=tomato").json()["items"]
    assert sorted((i["unit"], i["min"], i["modal"]) for i in items) == [("20 lb cartons", 17, None), ("25 lb cartons", 20, None), ("25 lb cartons", 30, None)]
    loc = client.get("/api/prices/locations?country=US&commodity=tomato").json()
    assert loc["states"] == [{"state": "North Carolina", "districts": [{"district": "", "markets": ["Test Terminal Market"]}]}]
    assert items[0]["source_label"] == "USDA AMS Market News, terminal markets"


def test_ams_import_command_reports_unmapped_products_and_rejects_nothing_silently(client, monkeypatch, capsys):
    from app.prices import ams, ingest
    monkeypatch.setattr(ams, "terminal_reports", lambda: [{"slug_id": 1, "report_title": "Test Terminal Market Vegetables Prices"}, {"slug_id": 2, "report_title": "Broken"}])

    def fake(slug, begin, end):
        if slug == "2":
            raise RuntimeError("MARS API returned HTTP 500 for reports/2/Report%20Details")
        return AMS_RAW
    monkeypatch.setattr(ams, "fetch_report_rows", fake)
    monkeypatch.setattr(sys, "argv", ["ingest", "ams", "7"])
    ingest.run_ams()
    out = capsys.readouterr().out
    assert "5 price rows stored, 5 unusable rows" in out and "no package or unit (1)" in out and "no price (1)" in out and "1 rows for products the app does not map" in out
    assert "Unmapped products (1)" in out and "Onions, Pearl (1)" in out and "FAILED: Broken: MARS API returned HTTP 500" in out


def test_latest_reports_the_true_total_when_the_page_limit_cuts_it_short(client):
    from app.prices import ams
    recs = [r for r in map(ams.parse_record, AMS_RAW) if r and r.commodity == "tomato"]
    with SessionLocal() as db:
        upsert(db, recs)
    full = client.get("/api/prices?country=US&commodity=tomato").json()
    cut = client.get("/api/prices?country=US&commodity=tomato&limit=2").json()
    assert full["total"] == 3 and len(full["items"]) == 3
    assert cut["total"] == 3 and len(cut["items"]) == 2  # the page can say "2 of 3", never silently hide the rest


def _terminal(day, variety, unit, low, high, grade=""):
    from datetime import date as d
    from decimal import Decimal
    from app.prices.base import PriceRecord
    return PriceRecord(country="US", source="ams", state="North Carolina", district="", market="Test Terminal Market", commodity_raw="Tomatoes",
                       commodity="tomato", variety=variety, grade=grade, obs_date=d(2026, 11, day), min_price=Decimal(low), max_price=Decimal(high),
                       modal_price=None, unit=unit, currency="USD")


def test_history_of_range_only_prices_uses_the_midpoint_and_never_mixes_packages_or_varieties(client, monkeypatch):
    from datetime import datetime, timezone
    from app import price_api
    monkeypatch.setattr(price_api, "utcnow", lambda: datetime(2026, 11, 27, tzinfo=timezone.utc))
    recs = [_terminal(16, "ROUND", "25 lb cartons", "20", "24", "a"), _terminal(16, "ROUND", "25 lb cartons", "30", "34", "b"),
            _terminal(20, "ROUND", "25 lb cartons", "22", "26"),   # 17-19 have no report: left blank, not interpolated
            _terminal(20, "ROUND", "10 lb cartons", "8", "9"), _terminal(20, "ROMA", "25 lb cartons", "40", "44")]
    with SessionLocal() as db:
        upsert(db, recs)
    base = "/api/prices/history?country=US&commodity=tomato&days=30"
    assert client.get(base).json()["needs"] == "unit"  # 25 lb and 10 lb cartons are never averaged together
    r = client.get(base + "&unit=25 lb cartons").json()
    assert r["needs"] == "variety" and r["points"] == []  # ROUND and ROMA are not averaged together either
    r = client.get(base + "&unit=25 lb cartons&variety=ROUND").json()
    assert r["needs"] is None and r["basis"] == "midpoint" and r["unit"] == "25 lb cartons"
    assert r["points"] == [{"date": "2026-11-16", "price": 27.0, "reports": 2}, {"date": "2026-11-20", "price": 24.0, "reports": 1}]  # (22+34)/2 and 24


def test_refresh_runs_due_sources_skips_unconfigured_and_isolates_failures(client, monkeypatch):
    from app.prices import refresh
    calls = []

    def ok():
        calls.append("ok")

    def boom():
        raise RuntimeError("USDA down")
    monkeypatch.setattr(refresh, "_sources", lambda: {"ams": (True, ok), "nass": (True, boom), "other": (False, ok)})
    refresh._last_attempt.clear()
    st = refresh.refresh_once()
    assert st["ams"] == "refreshed" and st["other"] == "skipped: no API key"
    assert st["nass"].startswith("failed: RuntimeError: USDA down")  # one broken source does not stop the others
    assert refresh.refresh_once()["ams"] == "up to date"  # just attempted: not hit again within the hour
    assert refresh.refresh_once(force=True)["ams"] == "refreshed" and calls == ["ok", "ok"]


def test_refresh_is_due_only_when_the_stored_data_is_older_than_the_limit(client):
    from sqlalchemy import text
    from app.prices import ams, refresh
    refresh._last_attempt.clear()
    assert refresh.is_due("ams", 6)  # nothing loaded yet
    with SessionLocal() as db:
        upsert(db, [r for r in map(ams.parse_record, AMS_RAW) if r])
    assert not refresh.is_due("ams", 6)  # fetched just now
    with SessionLocal() as db:
        db.execute(text("UPDATE price_observations SET fetched_at = now() - interval '10 hours' WHERE source = 'ams'"))
        db.commit()
    assert refresh.is_due("ams", 6) and not refresh.is_due("ams", 24)


def test_refresh_does_not_run_twice_at_once_and_prices_report_when_they_were_checked(client, monkeypatch):
    from sqlalchemy import text
    from app.db import engine
    from app.prices import ams, refresh
    monkeypatch.setattr(refresh, "_sources", lambda: {"ams": (True, lambda: None)})
    refresh._last_attempt.clear()
    with engine.connect() as other:
        other.execute(text("SELECT pg_advisory_lock(:k)"), {"k": refresh.LOCK_ID})
        assert refresh.refresh_once(force=True) == {"all": "another process is refreshing"}
        other.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": refresh.LOCK_ID})
    with SessionLocal() as db:
        upsert(db, [r for r in map(ams.parse_record, AMS_RAW) if r and r.commodity == "tomato"])
    from datetime import datetime
    checked = client.get("/api/prices?country=US&commodity=tomato").json()["checked_at"]
    assert checked and datetime.fromisoformat(checked).year >= 2026
    assert client.get("/api/prices?country=US&commodity=corn").json()["checked_at"] is None


def test_ams_maps_only_exact_product_names_and_keeps_look_alikes_apart():
    from app.prices import ams
    def commodity(name):
        r = ams.parse_record({"report_date": "11/23/2026", "market_location_name": "M", "market_location_state": "NC", "commodity": name, "package": "50 lb sacks", "low_price": "1", "high_price": "2"})
        return r.commodity
    assert [commodity(n) for n in ("Potatoes", "Sweet Potatoes", "Peppers, Bell Type", "Mushrooms", "Carrots", "Cucumbers", "Garlic", "Cabbage", "Eggplant", "Broccoli")] == \
        ["potato", "sweet_potato", "bell_pepper", "mushroom", "carrot", "cucumber", "garlic", "cabbage", "eggplant", "broccoli"]
    assert [commodity(n) for n in ("Peppers, Hot Type", "Onions, Pearl", "Potato Salad", "Tomatillo Salsa")] == [None, None, None, None]  # near misses are not merged in


def test_ams_report_selection_takes_current_vegetable_onion_potato_and_fruit_terminal_reports(monkeypatch):
    from app.prices import ams
    titles = ["Atlanta, GA Terminal Market Vegetables Prices (X)", "Atlanta, GA Terminal Market Onions and Potatoes Prices (X)", "Chicago, IL Terminal Market Fruits Prices (X)",
              "Old Terminal Market Vegetables Prices (Discontinued)", "Somewhere Terminal Market Cattle Report"]
    monkeypatch.setattr(ams, "list_reports", lambda kw="": [{"slug_id": i, "report_title": t} for i, t in enumerate(titles)])
    assert [r["slug_id"] for r in ams.terminal_reports()] == [0, 1, 2]


def test_ams_differing_fields_and_organic_values():
    from app.prices import ams
    a = {"low_price": "1", "organic": "N", "variety": "x"}
    assert ams.differing_fields(a, {**a, "organic": "Y", "extra": "z"}) == ["extra", "organic"]
    base = {"report_date": "11/25/2026", "market_location_state": "GA", "market_location_name": "Atlanta", "commodity": "Tomatoes",
            "package": "25 lb cartons loose", "low_price": "1", "high_price": "2"}
    assert "organic" not in (ams.parse_record({**base, "organic": "N"}).grade or "")
    assert ams.parse_record({**base, "organic": "Y"}).grade == "organic"
    assert "organic" in ams.parse_record({**base, "organic": "Certified"}).grade


def test_ams_reporter_comment_keeps_otherwise_identical_lines_apart():
    from app.prices import ams
    base = {"report_date": "11/25/2026", "market_location_state": "GA", "market_location_name": "Atlanta", "commodity": "Mushrooms",
            "variety": "OYSTER", "package": "3 lb cartons", "low_price": "34", "high_price": "35"}
    a = ams.parse_record({**base, "reporter_comment": "occasional higher (pink)"})
    b = ams.parse_record({**base, "reporter_comment": "occasional higher", "low_price": "24", "high_price": "27"})
    assert a.grade != b.grade and "occasional higher (pink)" in a.grade


def test_every_mapped_ams_crop_exists_in_the_us_region_pack_and_all_languages():
    """Drift guard: a crop the importer can store must be selectable and named in every language."""
    import re
    from app.prices import ams
    src = Path(__file__).resolve().parents[2] / "frontend" / "src"
    if not (src / "regions" / "us.ts").exists():
        import pytest
        pytest.skip("frontend sources not available")
    pack = (src / "regions" / "us.ts").read_text(encoding="utf-8")
    for crop in sorted(set(ams.COMMODITY_MAP.values())):
        assert f"id: '{crop}'," in pack, f"{crop} missing from regions/us.ts"
        for lang in ("en", "hi", "te", "es"):
            text = (src / "locales" / f"{lang}.ts").read_text(encoding="utf-8")
            assert re.search(rf"^\s+{crop}: ['\"]", text, re.M), f"{crop} has no {lang} name"


def test_ams_subtypes_share_one_crop_and_show_in_the_variety():
    from app.prices import ams
    base = {"report_date": "11/25/2026", "market_location_state": "GA", "market_location_name": "Atlanta",
            "package": "25 lb cartons", "low_price": "10", "high_price": "12"}
    plum = ams.parse_record({**base, "commodity": "Tomatoes, Plum Type", "variety": "ROMA"})
    rom = ams.parse_record({**base, "commodity": "Lettuce, Romaine"})
    ice = ams.parse_record({**base, "commodity": "Lettuce, Iceberg"})
    assert (plum.commodity, plum.variety) == ("tomato", "Plum ROMA")
    assert (rom.commodity, ice.commodity) == ("lettuce", "lettuce") and rom.variety == "Romaine" and ice.variety == "Iceberg"
    assert ams.parse_record({**base, "commodity": "Apples"}).commodity == "apple"
    assert ams.parse_record({**base, "commodity": "Peppers, Bell Type"}).commodity == "bell_pepper"  # unchanged


def test_ams_range_uses_the_exact_window_and_does_not_read_dates_as_a_day_count(client, monkeypatch, capsys):
    from datetime import date as d
    from app.prices import ams, ingest
    monkeypatch.setattr(ams, "terminal_reports", lambda: [{"slug_id": 1, "report_title": "Test Terminal Market Vegetables Prices"}])
    asked = []
    monkeypatch.setattr(ams, "fetch_report_rows", lambda slug, begin, end: asked.append((begin, end)) or AMS_RAW)
    monkeypatch.setattr(sys, "argv", ["ingest", "ams-range", "2026-07-22", "2026-07-29"])  # exactly what the command line gives
    ingest.run_ams(begin=d.fromisoformat(sys.argv[2]), end=d.fromisoformat(sys.argv[3]))
    assert "fetching 2026-07-22 to 2026-07-29" in capsys.readouterr().out
    assert asked == [("07/22/2026", "07/29/2026")]
