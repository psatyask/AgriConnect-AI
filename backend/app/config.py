from pathlib import Path

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

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def google_configured(self) -> bool:
        v = self.google_oauth_client_id.strip()
        return bool(v) and not v.startswith("your-")


settings = Settings()
