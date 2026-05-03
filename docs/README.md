# LiveDock

LiveDock는 공모전, 정부지원사업, 장학금, 연구과제, 창업지원 공고를 분석하고 제출 문서 초안까지 이어주는 문서 자동화 Agent입니다.

## 현재 목표

1차 목표는 커뮤니티가 아니라 **Agent MVP 안정화**입니다.

핵심 흐름:

1. PDF, URL, 텍스트 공고를 수집한다.
2. 공고 원문에서 핵심 요건을 구조화한다.
3. 사용자가 제공해야 할 정보를 체크리스트로 만든다.
4. 필요한 정보만 질문한다.
5. 섹션별 초안을 생성한다.
6. 사용자가 확인/수정한다.
7. 최종 문서를 HTML/HWPX로 export한다.

## 장기 비전

Agent MVP가 안정화된 뒤에는 대학생과 초기 팀을 위한 공고/공모전 커뮤니티로 확장합니다.

- 공고 사이트 모음과 탐색 피드
- 관심사 기반 추천
- 팀 모집과 팀원 매칭
- 참여 이력과 포트폴리오
- Agent 분석 결과 공유

이 기능들은 v2 로드맵이며, 현재 구현 우선순위가 아닙니다.

## 기술 스택

| 영역 | 기본 스택 |
| --- | --- |
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11+ |
| AI | OpenAI API |
| PDF Parsing | PyMuPDF |
| Persistence Target | Supabase Postgres/Auth/Storage |
| Temporary Cache | Redis or in-memory fallback |
| Frontend Deploy | Vercel |
| Backend Deploy | Vercel/Render-compatible FastAPI deployment |
| Korean Document Export | HWPX toolchain based on `jkf87/hwpx-skill` |

## 문서 지도

- [PRODUCT_PLAN.md](./PRODUCT_PLAN.md): 제품 방향과 단계별 로드맵
- [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md): 구현 순서와 마일스톤
- [ARCHITECTURE.md](./ARCHITECTURE.md): 시스템 구조와 API 흐름
- [AGENT_HARNESS.md](./AGENT_HARNESS.md): Agent 품질 하네스
- [EVALS.md](./EVALS.md): 공고 fixture와 eval 기준
- [ENVIRONMENT.md](./ENVIRONMENT.md): 로컬, GitHub, Vercel, Supabase 환경 세팅
- [CODEX.md](./CODEX.md): Codex 작업 규칙
- [SKILLS.md](./SKILLS.md): 사용 기술과 HWPX skill 운영 규칙
- [DESIGNS.md](./DESIGNS.md): UI/UX 원칙
- [TASKS.md](./TASKS.md): 작업 백로그
- [DEPLOYMENT.md](./DEPLOYMENT.md): 배포 가이드

## 로컬 실행

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

환경 변수는 `backend/.env.example`, `frontend/.env.example`을 기준으로 설정합니다.
