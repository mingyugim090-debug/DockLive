import os

try:
    from pydantic_settings import BaseSettings
except ImportError:  # Allows lightweight local checks without installed backend deps.
    BaseSettings = None


if BaseSettings:

    class Settings(BaseSettings):
        AI_PROVIDER: str = "openai"
        OPENAI_API_KEY: str = ""
        GEMINI_API_KEY: str = ""
        GOOGLE_API_KEY: str = ""
        FRONTEND_URL: str = "http://localhost:3000"
        MAX_PDF_SIZE_MB: int = 20
        MOCK_MODE: bool = False
        REDIS_URL: str = ""
        INSFORGE_BASE_URL: str = ""
        INSFORGE_API_KEY: str = ""
        INSFORGE_ANON_KEY: str = ""
        INSFORGE_STORAGE_BUCKET: str = "livedock-documents"
        INSFORGE_TIMEOUT_SECONDS: int = 10
        OPENAI_ANALYSIS_MODEL: str = "gpt-4o-mini"
        OPENAI_DRAFT_MODEL: str = "gpt-4o-mini"
        OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
        GEMMA_ANALYSIS_MODEL: str = "gemma-4-26b-a4b-it"
        GEMMA_DRAFT_MODEL: str = "gemma-4-31b-it"
        HWPX_SKILL_DIR: str = ""
        HWPX_TEMPLATE_DIR: str = ""
        HWPX_EXPORT_ENABLED: bool = True
        HWPX_PDF_EXPORT_ENABLED: bool = True
        HWPX_PDF_PYTHON_PATH: str = ""
        HWPX_PDF_TIMEOUT_SECONDS: int = 90
        MAX_DRAFT_INPUT_LENGTH: int = 60_000
        WORKFLOW_TTL_SECONDS: int = 7 * 24 * 3600

        class Config:
            env_file = ".env"
            extra = "ignore"

else:

    class Settings:
        AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai")
        OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
        GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
        GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
        FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
        MAX_PDF_SIZE_MB: int = int(os.getenv("MAX_PDF_SIZE_MB", "20"))
        MOCK_MODE: bool = os.getenv("MOCK_MODE", "false").lower() == "true"
        REDIS_URL: str = os.getenv("REDIS_URL", "")
        INSFORGE_BASE_URL: str = os.getenv("INSFORGE_BASE_URL", "")
        INSFORGE_API_KEY: str = os.getenv("INSFORGE_API_KEY", "")
        INSFORGE_ANON_KEY: str = os.getenv("INSFORGE_ANON_KEY", "")
        INSFORGE_STORAGE_BUCKET: str = os.getenv("INSFORGE_STORAGE_BUCKET", "livedock-documents")
        INSFORGE_TIMEOUT_SECONDS: int = int(os.getenv("INSFORGE_TIMEOUT_SECONDS", "10"))
        OPENAI_ANALYSIS_MODEL: str = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-4o-mini")
        OPENAI_DRAFT_MODEL: str = os.getenv("OPENAI_DRAFT_MODEL", "gpt-4o-mini")
        OPENAI_EMBEDDING_MODEL: str = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        GEMMA_ANALYSIS_MODEL: str = os.getenv("GEMMA_ANALYSIS_MODEL", "gemma-4-26b-a4b-it")
        GEMMA_DRAFT_MODEL: str = os.getenv("GEMMA_DRAFT_MODEL", "gemma-4-31b-it")
        HWPX_SKILL_DIR: str = os.getenv("HWPX_SKILL_DIR", "")
        HWPX_TEMPLATE_DIR: str = os.getenv("HWPX_TEMPLATE_DIR", "")
        HWPX_EXPORT_ENABLED: bool = os.getenv("HWPX_EXPORT_ENABLED", "true").lower() == "true"
        HWPX_PDF_EXPORT_ENABLED: bool = os.getenv("HWPX_PDF_EXPORT_ENABLED", "true").lower() == "true"
        HWPX_PDF_PYTHON_PATH: str = os.getenv("HWPX_PDF_PYTHON_PATH", "")
        HWPX_PDF_TIMEOUT_SECONDS: int = int(os.getenv("HWPX_PDF_TIMEOUT_SECONDS", "90"))
        MAX_DRAFT_INPUT_LENGTH: int = int(os.getenv("MAX_DRAFT_INPUT_LENGTH", "60000"))
        WORKFLOW_TTL_SECONDS: int = int(os.getenv("WORKFLOW_TTL_SECONDS", str(7 * 24 * 3600)))


settings = Settings()
