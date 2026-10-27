from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://soundscape:devpassword@localhost:5432/soundscape"
    redis_url: str = "redis://localhost:6379"
    model_dir: str = "./models"
    api_url: str = "http://localhost:3001"
    log_level: str = "INFO"

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"


settings = Settings()
