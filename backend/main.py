from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from routers import analyze, demo

app = FastAPI(
    title="LiveDock API",
    version="1.0.0",
    description="공고문 AI 분석 서비스 — LiveDock",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api")
app.include_router(demo.router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "LiveDock API"}
