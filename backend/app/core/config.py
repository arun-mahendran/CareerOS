from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(30, gt=0, validation_alias=AliasChoices("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "ACCESS_TOKEN_EXPIRE_MINUTES"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(14, gt=0)
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    AI_TIMEOUT_SECONDS: int = 30

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    FRONTEND_URL: str = "http://localhost:8080"
    CORS_ORIGINS: str = ""

    # Optional SMTP for password-reset and notification emails
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    APP_ENV: str = "development"

    # Job aggregation
    JOB_SYNC_INTERVAL_MINUTES: int = Field(30, ge=5)
    NEW_JOB_WINDOW_HOURS: int = Field(24, gt=0)

    @property
    def cors_origins(self) -> list[str]:
        raw = self.CORS_ORIGINS or self.FRONTEND_URL
        return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]

    @property
    def google_enabled(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()  # type: ignore[call-arg]
    if len(s.JWT_SECRET_KEY) < 32:
        raise RuntimeError("JWT_SECRET_KEY must be set in .env (32+ characters)")
    return s
