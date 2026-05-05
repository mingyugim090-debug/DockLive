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
        SUPABASE_URL: str = ""
        SUPABASE_SERVICE_ROLE_KEY: str = ""
        SUPABASE_ANON_KEY: str = ""
        SUPABASE_STORAGE_BUCKET: str = "livedock-documents"
        OPENAI_ANALYSIS_MODEL: str = "gpt-4o-mini"
        OPENAI_DRAFT_MODEL: str = "gpt-4o-mini"
        GEMMA_ANALYSIS_MODEL: str = "gemma-4-26b-a4b-it"
        GEMMA_DRAFT_MODEL: str = "gemma-4-31b-it"
        HWPX_SKILL_DIR: str = ""
        HWPX_TEMPLATE_DIR: str = ""
        HWPX_EXPORT_ENABLED: bool = False
        MAX_DRAFT_INPUT_LENGTH: int = 60_000
        WORKFLOW_TTL_SECONDS: int = 7 * 24 * 3600

        class Config:
            env_file = ".env"

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
        SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
        SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
        SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET", "livedock-documents")
        OPENAI_ANALYSIS_MODEL: str = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-4o-mini")
        OPENAI_DRAFT_MODEL: str = os.getenv("OPENAI_DRAFT_MODEL", "gpt-4o-mini")
        GEMMA_ANALYSIS_MODEL: str = os.getenv("GEMMA_ANALYSIS_MODEL", "gemma-4-26b-a4b-it")
        GEMMA_DRAFT_MODEL: str = os.getenv("GEMMA_DRAFT_MODEL", "gemma-4-31b-it")
        HWPX_SKILL_DIR: str = os.getenv("HWPX_SKILL_DIR", "")
        HWPX_TEMPLATE_DIR: str = os.getenv("HWPX_TEMPLATE_DIR", "")
        HWPX_EXPORT_ENABLED: bool = os.getenv("HWPX_EXPORT_ENABLED", "false").lower() == "true"
        MAX_DRAFT_INPUT_LENGTH: int = int(os.getenv("MAX_DRAFT_INPUT_LENGTH", "60000"))
        WORKFLOW_TTL_SECONDS: int = int(os.getenv("WORKFLOW_TTL_SECONDS", str(7 * 24 * 3600)))


settings = Settings()
