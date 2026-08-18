from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    secret_key: str = "change-me-in-production"
    database_url: str = "sqlite:///./data/portfolio.db"
    admin_email: str = "admin@example.com"
    admin_password: str = "changeme"
    cors_origins: str = "http://localhost:5173,http://localhost:80,http://localhost"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24


settings = Settings()
