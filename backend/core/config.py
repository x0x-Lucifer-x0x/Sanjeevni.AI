from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    groq_api_key: str
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"
    secret_key: str = "dev-secret"
    yolo_enabled: bool = True
    yolo_model: str = "yolov8n.pt"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()