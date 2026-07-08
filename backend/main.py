import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from routers import agency, agent, analyze, demo, hwpx, notices, workflow, workspaces

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LiveDock API",
    version="1.1.0",
    description="공고문 분석, 사용자 입력 수집, 제출 문서 초안 작성, HWPX/HTML export를 지원하는 LiveDock 문서 자동화 API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3010",
        "http://localhost:3011",
        "http://localhost:3111",
        "http://127.0.0.1:3111",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent.router, prefix="/api/agent")
app.include_router(analyze.router, prefix="/api")
app.include_router(demo.router, prefix="/api")
app.include_router(hwpx.router, prefix="/api")
app.include_router(notices.router, prefix="/api")
app.include_router(agency.router, prefix="/api/agency")
app.include_router(workflow.router, prefix="/api/workflow")
app.include_router(workspaces.router, prefix="/api/workspaces")

# 로컬 Excel 자동화 에이전트(DockLiveAgent.exe) 배포 파일. 빌드는
# docklive-inline-agent/scripts/build_agent_exe.ps1 참조 — 재배포 시 다시 복사해 둘 것.
_downloads_dir = Path(__file__).resolve().parent / "static" / "downloads"
if _downloads_dir.is_dir():
    app.mount("/downloads", StaticFiles(directory=str(_downloads_dir)), name="downloads")


@app.on_event("startup")
async def startup_event():
    logger.info("LiveDock API started")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "LiveDock API"}
