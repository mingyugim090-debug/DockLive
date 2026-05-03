# LiveDock

LiveDock는 공고문 분석부터 사용자 입력 수집, 섹션별 초안 작성, 최종 문서 export까지 이어주는 문서 자동화 Agent 프로젝트입니다.

## Folder Structure

```text
LiveDock/
  backend/      FastAPI backend, AI analysis/drafting, workflow/export APIs
  frontend/     Next.js frontend
  docs/         product docs, development plans, evals, assets
  AGENTS.md     Codex/agent project guide
  render.yaml   deployment configuration
```

Codex global state, installed skills, pets, logs, and caches stay outside this repository under `C:\Users\<user>\.codex`.

자세한 제품 방향과 개발 문서는 [docs/README.md](./docs/README.md)를 기준으로 확인하세요.

## Quick Start

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
