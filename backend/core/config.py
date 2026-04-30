from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    MAX_PDF_SIZE_MB: int = 20
    MOCK_MODE: bool = False
    REDIS_URL: str = ""  # Upstash 등 Redis URL. 비어있으면 인메모리 캐시 사용

    class Config:
        env_file = ".env"


settings = Settings()
