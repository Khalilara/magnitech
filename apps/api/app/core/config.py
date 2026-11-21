from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str
    redis_url: str
    celery_broker_url: str
    celery_result_backend: str | None = None
    jwt_secret: str
    stripe_secret_key: str
    stripe_webhook_secret: str
    # "sendcloud:secret1,boxtal:secret2"
    carrier_webhook_secrets: str = ""
    default_commission_bps: int = 1200
    return_window_days: int = 14
    cors_origins: str = ""
    admin_email: str = ""
    auth_cookie_domain: str = ""
    storefront_url: str = "http://localhost:3000"
    dashboard_url: str = "http://localhost:3001"
    api_public_url: str = "http://localhost:8000"
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    session_ttl_days: int = 7

    @property
    def carrier_secrets(self) -> dict[str, str]:
        pairs = (p.split(":", 1) for p in self.carrier_webhook_secrets.split(",") if ":" in p)
        return {k.strip(): v.strip() for k, v in pairs}


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
