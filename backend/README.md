# LiveDock Backend

FastAPI 기반의 LiveDock Agent backend입니다.

공고문 파싱, AI 분석, 섹션별 draft 생성, workflow 상태 관리, export API, HWPX 템플릿 클로닝을 담당합니다.

## 구조

```text
backend/
  main.py              FastAPI app entrypoint
  core/                runtime config, shared errors
  models/              Pydantic schemas
  routers/             API routes
    analyze.py         공고 분석 API
    demo.py            demo fixture API
    workflow.py        workflow, draft, export API
  services/            parsing, AI provider, drafting, storage, export logic
  tests/
    contracts/         API/schema contract tests
    manual/            manual HWPX generation checks
```

## 실행

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn main:app --reload
```

기본 주소는 `http://localhost:8000`입니다.

## 주요 환경변수

- `AI_PROVIDER`: `openai` 또는 `gemma`
- `OPENAI_API_KEY`: OpenAI 사용 시 필요
- `GEMINI_API_KEY`: Gemma/Gemini 계열 provider 사용 시 필요
- `MOCK_MODE`: demo/fallback 동작 사용 여부
- `REDIS_URL`: workflow 결과 저장소
- `HWPX_EXPORT_ENABLED`: HWPX export 활성화 여부
- `HWPX_SKILL_DIR`: 로컬 HWPX skill 경로

실제 `backend/.env`는 커밋하지 않습니다.

## 검증

```powershell
python -m pytest tests/contracts/test_agent_mvp_contracts.py
python tests/manual/manual_hwpx_soccer_application.py
```
