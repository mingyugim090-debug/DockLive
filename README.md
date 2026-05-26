# LiveDock

> 한국 공고문 → 제출용 문서 자동 생성 Agent

공모전·지원사업·장학금·연구과제 공고문을 PDF, URL, 텍스트로 입력하면 AI가 요구사항을 추출하고, 필요한 정보만 질문하고, 섹션별 초안을 생성해 **HWPX·PDF·HTML**로 내보냅니다.

**Production:** [dock-live.vercel.app](https://dock-live.vercel.app)

---

## 왜 만들었나

공모전이나 지원사업에 지원할 때 가장 시간이 걸리는 건 공고문 해석과 양식 작성입니다.  
공고마다 양식이 다르고, 한국 행정 문서는 HWPX(한글) 파일이 표준입니다.  
LiveDock은 이 과정 전체를 6단계 Agent 워크플로우로 자동화합니다.

---

## 6단계 워크플로우

```
1. Input      PDF / URL / 텍스트 / Demo 버튼
      ↓
2. Analysis   공고 핵심 정보 추출 (마감일·자격·서류·평가기준·혜택)
      ↓
3. Questions  부족한 정보만 사용자에게 질문
      ↓
4. Draft      섹션별 초안 SSE 스트리밍 생성
      ↓
5. Review     인라인 편집 / AI 재작성 / confirmation_required 확인
      ↓
6. Download   HWPX · PDF · HTML export
```

Agent는 공고 원문에 없는 마감일·자격·금액·기관명을 절대 임의로 생성하지 않습니다.  
불확실한 항목은 `uncertain_fields` 또는 `confirmation_required`로 표시해 사용자 확인을 요청합니다.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| AI | OpenAI GPT-4o (기본) / Gemini (선택) |
| Document | HWPX toolchain (ZIP+XML), LibreOffice PDF 변환 |
| 배포 | Vercel (frontend) · Render (backend) |

---

## 주요 기능

- **다양한 입력** — PDF 업로드, URL 크롤링, 텍스트 붙여넣기, HWP/HWPX 양식 직접 업로드
- **구조화된 분석** — `AnalysisResult`: 타임라인, 자격요건, 체크리스트, 누락 질문 자동 추출
- **SSE 스트리밍 초안** — 섹션 단위 실시간 생성, 중간 저장 지원
- **HWPX 소스 보존** — 사용자가 제공한 HWPX 양식의 표·스타일·문단 구조 유지
- **워크플로우 복구** — 세션 중단 시 자동 복구 (`workflow_recovery`)
- **Quality Gate** — 생성된 HWPX는 namespace fix → validation → verify 통과 후 제공

---

## 프로젝트 구조

```
LiveDock/
├── frontend/                  Next.js 14 프론트엔드
│   ├── app/app/page.tsx       메인 6단계 워크플로우 UI
│   ├── components/workspace/  HwpxFormEditor, 섹션 뷰어
│   └── lib/                   API client, 타입 정의
│
├── backend/                   FastAPI 백엔드
│   ├── routers/               analyze / workflow / hwpx API
│   ├── services/
│   │   ├── analyzer.py        공고문 AI 분석
│   │   ├── drafting_service.py초안 생성 + HWPX export
│   │   ├── hwpx_form_session.py HWPX 폼 세션 편집
│   │   ├── source_preserving_export.py 소스 보존 export
│   │   └── workflow_recovery.py세션 복구
│   └── hwpx_toolchain/scripts/ HWPX 검증 스크립트 (수정 주의)
│
├── harness/                   Quality gate spec, 오류 fingerprint registry
├── docs/                      제품·아키텍처·HWPX·평가 문서
└── tools/hwp-mcp/             Windows 한글 자동화 로컬 MCP helper
```

---

## 빠른 실행

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env        # OPENAI_API_KEY 설정
python -m uvicorn main:app --reload
# → http://localhost:8000
```

### Frontend

```powershell
cd frontend
npm install
copy .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
# → http://localhost:3000
```

---

## 환경변수

### Backend (`backend/.env`)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `AI_PROVIDER` | `openai` 또는 `gemma` | `openai` |
| `OPENAI_API_KEY` | OpenAI 사용 시 필수 | — |
| `GEMINI_API_KEY` | Gemini 사용 시 필수 | — |
| `MOCK_MODE` | 데모 fixture 사용 여부 | `false` |
| `HWPX_EXPORT_ENABLED` | HWPX export toolchain 활성화 | `true` |
| `REDIS_URL` | 워크플로우 세션 저장 (선택) | — |

### Frontend (`frontend/.env.local`)

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API base URL |

---

## API 엔드포인트

```
POST /api/analyze                          PDF·HWP·HWPX 업로드 분석
POST /api/analyze/text                     텍스트 직접 분석
POST /api/analyze/url                      URL 공고 분석
GET  /api/demo                             데모 fixture (업로드 불필요)

GET  /api/workflow/{id}                    워크플로우 세션 조회
POST /api/workflow/{id}/inputs             사용자 답변 저장
GET  /api/workflow/{id}/draft/stream       SSE 스트리밍 초안 생성
POST /api/workflow/{id}/draft/{sid}/revise 섹션 AI 재작성
POST /api/workflow/{id}/confirm            확인 항목 체크
POST /api/workflow/{id}/finalize           최종 문서 생성
GET  /api/workflow/{id}/export/hwpx        HWPX export
GET  /api/workflow/{id}/export/pdf         PDF export
GET  /api/workflow/{id}/export/html        HTML export (fallback)
```

---

## HWPX 생성 전략

HWPX는 한국 행정 문서의 표준 포맷입니다. LiveDock의 접근 방식:

1. HWPX = ZIP + XML로 분해해 직접 파싱
2. 사용자가 제공한 `.hwpx` 양식 → 텍스트 치환 방식으로 표·스타일·구조 보존
3. `.hwp` 입력 시 먼저 `.hwpx`로 변환 후 처리
4. 생성 후 namespace fix → `validate.py` → `verify_hwpx.py` 통과 필수

---

## 검증

```powershell
# 하네스 (권장)
.\scripts\harness.ps1 -Profile quick
.\scripts\harness.ps1 -Profile agent

# 프론트엔드 빌드
cd frontend && npm run build

# 백엔드 계약 테스트
cd backend && python -m pytest tests/contracts/

# HWPX 수동 검증
cd backend && python tests/manual/manual_hwpx_soccer_application.py
```

---

## 개발 로드맵

| Phase | 상태 | 내용 |
|-------|------|------|
| Phase 1 | ✅ 완료 | Demo 버튼, HWPX 다운로드, 세션 저장, 에러 복구 |
| Phase 2 | ✅ 완료 | 인라인 편집, 섹션 AI 재작성, 스트리밍 delta |
| Phase 3 | ✅ 완료 | 템플릿 갤러리, 문서 유형별 fixture 5종 |
| Phase 4 | 🔜 예정 | 다운로드 이력, 공유 링크, 모바일 최적화 |

---

## 문서

- [아키텍처](./docs/engineering/architecture.md)
- [배포 가이드](./docs/engineering/deployment.md)
- [HWPX export 상세](./docs/hwpx/gemma-hwpx-workflow.md)
- [평가 기준](./docs/evaluation/evals.md)
- [Codex 개발 규칙](./AGENTS.md)
