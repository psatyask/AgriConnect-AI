from sqlalchemy import select

from app.db import SessionLocal
from app.models import Role, User

PW = "correct horse battery"


def register(client, email="a@example.com", role="farmer", pw=PW):
    return client.post("/api/auth/register", json={"email": email, "password": pw, "name": "A", "role": role})


def test_register_login_me_logout(client):
    r = register(client)
    assert r.status_code == 201 and r.json()["role"] == "farmer"
    assert client.get("/api/auth/me").json()["email"] == "a@example.com"
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "A@Example.com", "password": PW}).status_code == 200


def test_wrong_password_and_unknown_email_look_the_same(client):
    register(client)
    client.post("/api/auth/logout")
    bad = client.post("/api/auth/login", json={"email": "a@example.com", "password": "nope-nope-nope"})
    unknown = client.post("/api/auth/login", json={"email": "who@example.com", "password": "nope-nope-nope"})
    assert bad.status_code == unknown.status_code == 401 and bad.json() == unknown.json()


def test_short_password_and_duplicate_email_rejected(client):
    assert register(client, pw="short").status_code == 422
    assert register(client).status_code == 201
    assert register(client).status_code == 409


def test_cannot_register_as_admin(client):
    assert register(client, role="admin").status_code == 422


def test_session_cookie_is_httponly_and_token_not_stored_plain(client):
    register(client)
    header = client.cookies.jar
    cookie = next(iter(header))
    assert cookie.has_nonstandard_attr("HttpOnly")
    with SessionLocal() as db:
        from app.models import AuthSession
        assert db.scalar(select(AuthSession).where(AuthSession.token_hash == cookie.value)) is None


def test_roles_enforced_on_server(client):
    register(client, "f@example.com", "farmer")
    assert client.get("/api/farmer/overview").status_code == 200
    assert client.get("/api/buyer/overview").status_code == 403
    client.post("/api/auth/logout")
    assert client.get("/api/farmer/overview").status_code == 401


def test_expired_session_rejected(client):
    register(client)
    with SessionLocal() as db:
        from datetime import timedelta
        from app.models import AuthSession, utcnow
        s = db.scalars(select(AuthSession)).one()
        s.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_foreign_origin_post_blocked(client):
    r = client.post("/api/auth/register", headers={"Origin": "https://evil.example"},
                    json={"email": "x@example.com", "password": PW, "role": "farmer"})
    assert r.status_code == 403


def test_google_new_user_needs_role_then_signs_in(client, fake_google):
    fake_google["tok-1234567890"] = {"sub": "g-1", "email": "G@Example.com", "email_verified": True, "name": "Gina"}
    assert client.post("/api/auth/google", json={"credential": "tok-1234567890"}).json()["detail"] == "role_required"
    r = client.post("/api/auth/google", json={"credential": "tok-1234567890", "role": "buyer"})
    assert r.status_code == 200 and r.json()["role"] == "buyer" and r.json()["email"] == "g@example.com"
    client.post("/api/auth/logout")
    # Returning user: no role needed, and a client-sent role never changes the stored one.
    r2 = client.post("/api/auth/google", json={"credential": "tok-1234567890", "role": "farmer"})
    assert r2.status_code == 200 and r2.json()["role"] == "buyer"


def test_invalid_google_token_rejected(client, fake_google):
    assert client.post("/api/auth/google", json={"credential": "forged-token-value"}).status_code == 401


def test_google_cannot_pick_admin(client, fake_google):
    fake_google["tok-1234567890"] = {"sub": "g-1", "email": "g@example.com", "email_verified": True}
    assert client.post("/api/auth/google", json={"credential": "tok-1234567890", "role": "admin"}).status_code == 422


def test_google_links_existing_account_and_drops_unverified_password(client, fake_google):
    # An attacker pre-registers the victim's email with a password the victim does not know.
    register(client, "victim@example.com", "farmer", pw="attacker-chosen-pass")
    client.post("/api/auth/logout")
    fake_google["tok-1234567890"] = {"sub": "g-9", "email": "victim@example.com", "email_verified": True, "name": "V"}
    assert client.post("/api/auth/google", json={"credential": "tok-1234567890"}).status_code == 200
    client.post("/api/auth/logout")
    # The attacker's password no longer works.
    assert client.post("/api/auth/login", json={"email": "victim@example.com", "password": "attacker-chosen-pass"}).status_code == 401
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.email == "victim@example.com"))
        assert u.google_sub == "g-9" and u.email_verified and u.password_hash is None and u.role == Role.farmer


def test_real_verifier_rejects_garbage_without_network(client):
    # No monkeypatch: the real verifier must reject a malformed token (fails before any network use).
    r = client.post("/api/auth/google", json={"credential": "not-a-jwt-at-all"})
    assert r.status_code == 401


def test_google_unreachable_is_503_not_a_crash(client, monkeypatch):
    from google.auth.exceptions import TransportError
    from google.oauth2 import id_token

    def boom(*a, **k):
        raise TransportError("offline")

    monkeypatch.setattr(id_token, "verify_oauth2_token", boom)
    assert client.post("/api/auth/google", json={"credential": "aaaa.bbbb.cccc"}).status_code == 503


def test_config_exposes_client_id_only(client):
    body = client.get("/api/config").json()
    assert body == {"googleClientId": "test-client-id.apps.googleusercontent.com"}
