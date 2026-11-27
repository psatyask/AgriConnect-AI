import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

# Tests need a real PostgreSQL database (docker compose up -d db). They wipe the tables, so use a test DB.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://agri:agri_dev_pw@localhost:5432/agriconnect")
os.environ["PRICE_REFRESH_HOURS"] = "0"  # tests never start the background refresh
os.environ["GOOGLE_OAUTH_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"

from app import google as google_mod  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.create_all(engine)
    with engine.begin() as c:
        c.execute(text("TRUNCATE price_observations, inquiries, listings, auth_sessions, users CASCADE"))
    yield


@pytest.fixture
def client():
    return TestClient(app, base_url="http://localhost:8000")


@pytest.fixture
def fake_google(monkeypatch):
    """Replace Google's network verification with a lookup table of fake credentials -> claims."""
    claims: dict[str, dict] = {}

    def verify(credential: str) -> dict:
        if credential not in claims:
            raise google_mod.GoogleTokenError("Invalid Google credential")
        return claims[credential]

    monkeypatch.setattr(google_mod, "verify_google_credential", verify)
    return claims
