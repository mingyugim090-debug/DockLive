# Deployment Guide

## Target Setup

- Frontend: Vercel
- Backend: FastAPI service, deployable on Render or Vercel-compatible Python runtime
- Persistence: Supabase
- Optional cache fallback: Redis
- Optional HWPX export: local/server-installed `hwpx` skill toolchain

## Frontend Environment

Set in Vercel:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
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

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_STORAGE_BUCKET=livedock-documents
SUPABASE_TIMEOUT_SECONDS=10

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
5. Enable Supabase persistence.
6. Enable HWPX export only after server toolchain validation passes.

## Secret Rotation

The Supabase service role key must live only in the backend deployment provider.
If it is ever pasted into chat, logs, or a client-side environment, rotate it in
Supabase and update the backend deployment secret before the next production
release.
