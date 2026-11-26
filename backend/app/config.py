from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Reads the single project-root .env (see .env.example). Real environment variables win."""

    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://agri:agri_dev_pw@localhost:5432/agriconnect"
    google_oauth_client_id: str = ""
    allowed_origins: str = "http://localhost:8000,http://localhost:5173"
    cookie_secure: bool = False
    session_days: int = 7
    data_gov_in_api_key: str = ""
    nass_api_key: str = ""
    # data.gov.in resource id of the Agmarknet daily price dataset; confirm with `ingest probe`.
    agmarknet_resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070"

    @field_validator("database_url")
    @classmethod
    def use_psycopg3_driver(cls, v: str) -> str:
        """Accept plain postgresql:// or postgres:// URLs; this project uses the psycopg (v3) driver."""
        for plain in ("postgresql://", "postgres://"):
            if v.startswith(plain):
                return "postgresql+psycopg://" + v[len(plain):]
        return v

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def google_configured(self) -> bool:
        v = self.google_oauth_client_id.strip()
        return bool(v) and not v.startswith("your-")


settings = Settings()
