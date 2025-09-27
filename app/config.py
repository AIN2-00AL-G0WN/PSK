from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    RESERVATION_TTL_MINUTES: int = 5  # kept for backward-compat; not used when infinite

    class Config:
        env_file = ".env"

settings = Settings()
