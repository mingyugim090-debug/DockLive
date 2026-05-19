# Deployment Guide

## Target Setup

- Frontend: Vercel
- Backend: FastAPI service, deployable on Render or Vercel-compatible Python runtime
- Persistence: InsForge
- Optional cache fallback: Redis
- Optional HWPX export: local/server-installed `hwpx` skill toolchain

## Frontend Environment

Set in Vercel:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
NEXT_PUBLIC_INSFORGE_BASE_URL=https://your-app.region.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your_insforge_anon_key
INSFORGE_BASE_URL=https://your-app.region.insforge.app
INSFORGE_API_KEY=your_insforge_api_key
NEXT_PUBLIC_TOSS_CLIENT_KEY=your_toss_client_key
TOSS_SECRET_KEY=your_toss_secret_key
PAYMENT_ORDER_SECRET=random_32_bytes_or_longer
```

## Backend Environment

Set in backend deployment provider:

```env
OPENAI_API_KEY=sk-proj-...
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
OPENAI_DRAFT_MODEL=gpt-4o-mini
FRONTEND_URL=https://your-frontend.vercel.app
MAX_PDF_SIZE_MB=20
MOCK_MODE=false

INSFORGE_BASE_URL=https://your-app.region.insforge.app
INSFORGE_API_KEY=your_insforge_api_key
INSFORGE_ANON_KEY=your_insforge_anon_key
INSFORGE_STORAGE_BUCKET=livedock-documents
INSFORGE_TIMEOUT_SECONDS=10

REDIS_URL=
WORKFLOW_TTL_SECONDS=604800

HWPX_EXPORT_ENABLED=false
HWPX_SKILL_DIR=/app/skills/hwpx
HWPX_TEMPLATE_DIR=
MAX_DRAFT_INPUT_LENGTH=60000
```

## HWPX Export Deployment Notes

The `hwpx` skill must exist on the backend server filesystem for `/api/workflow/{id}/export/hwpx`.

Required toolchain from `jkf87/hwpx-skill`:

- `scripts/md2hwpx.py`
- `scripts/fix_namespaces.py`
- `scripts/validate.py`
- templates and references used by those scripts

Recommended backend setup:

```bash
pip install python-hwpx lxml
pip install pyhwp5 olefile
```

Then set:

```env
HWPX_EXPORT_ENABLED=true
HWPX_SKILL_DIR=/absolute/path/to/hwpx-skill
```

If HWPX export is disabled or misconfigured, HTML export should remain available.

## Smoke Checks

Backend:

```bash
GET /health
GET /api/hwpx/status
POST /api/analyze/text
GET /api/workflow/{id}
POST /api/workflow/{id}/draft
POST /api/workflow/{id}/finalize
GET /api/workflow/{id}/export/html
GET /api/workflow/{id}/exports
GET /api/workflow/{id}/exports/{export_id}
```

Production smoke script:

```bash
python backend/tests/evals/run_production_smoke.py --base-url https://your-backend.example.com
```

Use `--require-hwpx` only after the deployed backend HWPX toolchain is confirmed.

Frontend:

```bash
cd frontend
npm run build
```

Backend:

```bash
cd backend
python -m compileall .
```

## Rollout Order

1. Deploy backend with `MOCK_MODE=true`.
2. Verify frontend can call `/health` and demo workflow.
3. Add OpenAI key and set `MOCK_MODE=false`.
4. Verify analysis with one representative fixture.
5. Enable InsForge persistence.
6. Check `/api/hwpx/status` and confirm `validation_available=true`.
7. Enable HWPX export only after server toolchain validation passes.
8. Run production smoke again with `--require-hwpx` only after HWPX readiness is confirmed.

## Secret Rotation

The InsForge API key must live only in the backend deployment provider. If it
is ever pasted into chat, logs, or a client-side environment, rotate it in
InsForge and update the backend deployment secret before the next production
release.
