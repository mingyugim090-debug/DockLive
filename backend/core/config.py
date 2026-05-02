import os

try:
    from pydantic_settings import BaseSettings
except ImportError:  # Allows lightweight local checks without installed backend deps.
    BaseSettings = None


if BaseSettings:

    class Settings(BaseSettings):
        OPENAI_API_KEY: str = ""
        FRONTEND_URL: str = "http://localhost:3000"
        MAX_PDF_SIZE_MB: int = 20
        MOCK_MODE: bool = False
        REDIS_URL: str = ""
        OPENAI_ANALYSIS_MODEL: str = "gpt-4o-mini"
        OPENAI_DRAFT_MODEL: str = "gpt-4o-mini"
        MAX_DRAFT_INPUT_LENGTH: int = 60_000
        WORKFLOW_TTL_SECONDS: int = 7 * 24 * 3600

        class Config:
            env_file = ".env"

else:

    class Settings:
        OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
        FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
        MAX_PDF_SIZE_MB: int = int(os.getenv("MAX_PDF_SIZE_MB", "20"))
        MOCK_MODE: bool = os.getenv("MOCK_MODE", "false").lower() == "true"
        REDIS_URL: str = os.getenv("REDIS_URL", "")
        OPENAI_ANALYSIS_MODEL: str = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-4o-mini")
        OPENAI_DRAFT_MODEL: str = os.getenv("OPENAI_DRAFT_MODEL", "gpt-4o-mini")
        MAX_DRAFT_INPUT_LENGTH: int = int(os.getenv("MAX_DRAFT_INPUT_LENGTH", "60000"))
        WORKFLOW_TTL_SECONDS: int = int(os.getenv("WORKFLOW_TTL_SECONDS", str(7 * 24 * 3600)))


settings = Settings()
