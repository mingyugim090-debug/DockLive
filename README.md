# LiveDock

LiveDock은 공고문을 분석하고, 사용자 입력을 수집한 뒤, 섹션별 제출 초안과 최종 문서 export까지 이어 주는 문서 자동화 Agent 프로젝트입니다.

현재 우선순위는 커뮤니티 기능이 아니라 **Agent MVP**입니다. 핵심 흐름은 PDF, URL, 붙여넣은 텍스트, 데모 fixture를 받아 공고 요구사항을 분석하고, 필요한 사용자 정보를 묻고, 제출 문서를 생성하는 것입니다.

## Folder Structure

```text
LiveDock/
  backend/      FastAPI backend, AI analysis/drafting, workflow/export APIs
  frontend/     Next.js frontend
  docs/         product docs, development plans, evals, assets
  AGENTS.md     Codex/agent project guide
  render.yaml   deployment configuration
```

Codex global state, installed skills, logs, and caches stay outside this repository under `C:\Users\<user>\.codex`.

자세한 제품 방향과 개발 문서는 [docs/README.md](./docs/README.md)를 기준으로 확인하세요.

## Quick Start

Backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
