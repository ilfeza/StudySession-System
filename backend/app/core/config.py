from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'Платформа совместной работы'
    app_env: str = 'development'
    secret_key: str = '<SECRET>'
    access_token_expire_minutes: int = 60 * 24
    algorithm: str = 'HS256'

    database_url: str = 'postgresql+psycopg2://postgres:postgres@postgres:5432/study_platform'
    uploads_dir: str = '/app/data/uploads'

    livekit_url: str = 'ws://livekit:7880'
    livekit_api_key: str = 'devkey'
    livekit_api_secret: str = 'devkey_super_secure_32_chars_minimum_2026'


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
