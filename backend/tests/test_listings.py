import pytest

PW = "correct horse battery"
LISTING = {"region_code": "IN", "commodity": "tomato", "variety": "Hybrid", "grade": "A", "place": "Guntur, Andhra Pradesh",
           "unit": "quintal", "quantity": "40", "price": "2200.00", "currency": "INR"}


def signup(client, email, role, name=""):
    r = client.post("/api/auth/register", json={"email": email, "password": PW, "role": role, "name": name})
    assert r.status_code == 201
    return r


def as_user(client, email, role, name=""):
    client.post("/api/auth/logout")
    signup(client, email, role, name)


@pytest.fixture
def listing_id(client):
    signup(client, "f@example.com", "farmer", "Farmer Fay")
    r = client.post("/api/listings", json=LISTING)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_only_farmers_create_listings(client):
    assert client.post("/api/listings", json=LISTING).status_code == 401
    signup(client, "b@example.com", "buyer")
    assert client.post("/api/listings", json=LISTING).status_code == 403


@pytest.mark.parametrize("patch", [{"price": "0"}, {"price": "-5"}, {"quantity": "0"}, {"commodity": "Tomato!"},
                                   {"region_code": "india"}, {"currency": "inr"}, {"unit": "Quintal"}])
def test_invalid_listing_rejected(client, patch):
    signup(client, "f@example.com", "farmer")
    assert client.post("/api/listings", json={**LISTING, **patch}).status_code == 422


def test_browse_is_public_filters_and_hides_email(client, listing_id):
    client.post("/api/listings", json={**LISTING, "region_code": "US", "commodity": "corn", "unit": "bushel", "currency": "USD", "price": "4.40", "place": "Story County, Iowa"})
    client.post("/api/auth/logout")
    body = client.get("/api/listings").json()
    assert body["total"] == 2
    assert "f@example.com" not in client.get("/api/listings").text
    assert {i["farmer_name"] for i in body["items"]} == {"Farmer Fay"}
    assert [i["commodity"] for i in client.get("/api/listings?region=US").json()["items"]] == ["corn"]
    assert client.get("/api/listings?commodity=tomato").json()["total"] == 1
    assert client.get("/api/listings?q=iowa").json()["total"] == 1
    assert client.get("/api/listings?region=usa").status_code == 422


def test_owner_updates_and_closed_listings_leave_browse(client, listing_id):
    r = client.patch(f"/api/listings/{listing_id}", json={"price": "2300", "status": "sold"})
    assert r.status_code == 200 and r.json()["price"] == 2300 and r.json()["status"] == "sold"
    assert client.get("/api/listings").json()["total"] == 0
    assert client.get(f"/api/listings/{listing_id}").status_code == 404
    assert client.get("/api/farmer/listings").json()["items"][0]["status"] == "sold"


def test_cannot_touch_someone_elses_listing(client, listing_id):
    as_user(client, "other@example.com", "farmer")
    assert client.patch(f"/api/listings/{listing_id}", json={"price": "1"}).status_code == 404
    assert client.get("/api/farmer/listings").json()["items"] == []


def test_inquiry_flow_hides_buyer_contact(client, listing_id):
    as_user(client, "buyer@example.com", "buyer", "Bo Buyer")
    r = client.post(f"/api/listings/{listing_id}/inquiries", json={"message": "Is 20 quintals available this week?"})
    assert r.status_code == 201
    assert client.get("/api/buyer/inquiries").json()["items"][0]["commodity"] == "tomato"
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "f@example.com", "password": PW})
    got = client.get("/api/farmer/inquiries")
    item = got.json()["items"][0]
    assert item["buyer_name"] == "Bo Buyer" and "20 quintals" in item["message"]
    assert "buyer@example.com" not in got.text
    assert client.get("/api/farmer/listings").json()["items"][0]["inquiry_count"] == 1


def test_inquiry_rules(client, listing_id):
    assert client.post(f"/api/listings/{listing_id}/inquiries", json={"message": "farmer asking own"}).status_code == 403
    as_user(client, "buyer@example.com", "buyer")
    assert client.post(f"/api/listings/{listing_id}/inquiries", json={"message": "hi"}).status_code == 422
    assert client.post("/api/listings/00000000-0000-0000-0000-000000000000/inquiries", json={"message": "valid message"}).status_code == 404
    assert client.get("/api/farmer/inquiries").status_code == 403
