from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    MAX_PDF_SIZE_MB: int = 20
    MOCK_MODE: bool = False  # True로 설정 시 Claude API 없이 샘플 데이터 반환

    class Config:
        env_file = ".env"


settings = Settings()
