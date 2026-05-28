# LiveDock

> 한국 공고문과 HWPX 양식을 제출용 문서로 바꾸는 Agent MVP

공모전, 지원사업, 장학금, 연구과제 공고문을 PDF, URL, 텍스트, HWP/HWPX 양식으로 입력하면 LiveDock이 요구사항을 분석하고, 부족한 정보만 질문한 뒤, 섹션별 초안을 생성해 **HWPX, PDF, HTML**로 내보냅니다.

**Production:** [dock-live.vercel.app](https://dock-live.vercel.app)

---

## 서비스 핵심 개요

LiveDock은 한국형 공고문/행정 양식 작성에 특화된 문서 자동화 Agent입니다. 사용자가 공고문을 하나하나 해석하고 HWPX 양식을 직접 채우는 부담을 줄이는 것이 목표입니다.

핵심 원칙은 **근거 기반 작성**입니다. Agent는 공고 원문에 없는 마감일, 기관명, 지원금, 자격요건, 제출 방법을 임의로 만들지 않습니다. 불확실한 값은 `uncertain_fields` 또는 `confirmation_required`로 남기고 사용자 확인을 요청합니다.

---

## 워크플로우

```mermaid
flowchart LR
  A["1. Input<br/>PDF / URL / Text / HWPX"] --> B["2. Analysis<br/>공고 핵심 정보 추출"]
  B --> C["3. Questions<br/>부족 정보만 질문"]
  C --> D["4. Draft<br/>섹션별 초안 생성"]
  D --> E["5. Review<br/>수정 / 재작성 / 확인"]
  E --> F["6. Export<br/>HWPX / PDF / HTML"]
```

| 단계 | 역할 | 주요 결과 |
| --- | --- | --- |
| Input | PDF, URL, 텍스트, HWP/HWPX 양식 입력 | 원문 또는 양식 파일 |
| Analysis | 마감일, 자격, 제출서류, 평가기준, 혜택 추출 | `AnalysisResult` |
| Questions | 작성에 필요한 사용자별 누락 정보만 수집 | `UserInputField` |
| Draft | 공고 분석과 사용자 입력을 근거로 섹션별 초안 생성 | `DraftSection` |
| Review | 인라인 편집, AI 재작성, 확인 필요 항목 검토 | `confirmation_required` |
| Export | 최종 문서를 검증 가능한 형식으로 내보내기 | HWPX, PDF, HTML |

---

## MVP 범위

현재 MVP는 커뮤니티나 소셜 기능이 아니라 **공고문 기반 제출 문서 작성**에 집중합니다.

- **문서 입력**: PDF 업로드, URL 수집, 텍스트 붙여넣기, HWP/HWPX 양식 업로드
- **근거 기반 분석**: 원문 evidence를 포함한 구조화 JSON 분석
- **부족 정보 수집**: 사용자에게 꼭 필요한 정보만 질문
- **섹션별 초안 생성**: SSE 스트리밍 기반 초안 생성과 섹션 단위 재작성
- **사용자 확인 게이트**: 불확실한 주장과 제출 전 확인 항목 유지
- **HWPX 중심 export**: HWPX ZIP/XML 생성, namespace fix, validation, verify
- **워크플로우 복구**: 세션 저장, export 이력, 장애 fallback
- **하네스 검증**: backend contract, deterministic agent eval, frontend build, HWPX validation

---

## HWPX 문서 자동화 Skills

LiveDock은 HWPX 문서 자동화를 위해 project-local skills와 외부 HWPX toolchain skill을 함께 사용합니다. Skills는 웹서비스 런타임 자체가 아니라, Agent가 구현과 검증 과정에서 따라야 하는 작업 지침입니다. 실제 사용자 workflow, 저장, 검증, export API는 FastAPI backend가 담당합니다.

```mermaid
flowchart LR
  A["livedock-agent-mvp<br/>제품 guardrail"] --> B["livedock-section-draft<br/>섹션 초안"]
  B --> C["livedock-hwpx-intake<br/>HWP/HWPX 분석"]
  C --> D["livedock-hwpx-render-edit<br/>페이지/영역 편집"]
  D --> E["livedock-hwpx-content<br/>치환 JSON 생성"]
  E --> F["livedock-hwpx-export<br/>HWPX 생성/클론"]
  F --> G["livedock-hwpx-validate<br/>검증"]
```

| Skill | 역할 | 핵심 책임 |
| --- | --- | --- |
| `livedock-agent-mvp` | 제품 범위 고정 | 공고 분석, 부족 정보 질문, 섹션 초안, 확인 게이트, export 흐름을 Agent MVP 안에 유지 |
| `livedock-section-draft` | 섹션별 초안 생성 | `AnalysisResult`와 사용자 입력만 사용해 작성 항목별 초안을 만들고 `confirmation_required` 유지 |
| `livedock-hwpx-intake` | HWP/HWPX 입력 분석 | `.hwp`는 `.hwpx`로 변환하고, 업로드 양식의 표/이미지/빈 칸/placeholder 구조를 분석 |
| `livedock-hwpx-render-edit` | 양식 미리보기와 영역 편집 | HWPX 페이지 preview, editable region, `source_ref` 기반 XML 치환 대상을 관리 |
| `livedock-hwpx-content` | 치환 데이터 생성 | AI가 HWPX 파일을 직접 만들지 않고 `replacements`, `keywords`, `section_content` JSON만 생성 |
| `livedock-hwpx-export` | 실제 HWPX 생성 | 일반 문서는 Markdown-to-HWPX, 공식 양식은 clone/replace 방식으로 표, 이미지, 스타일 보존 |
| `livedock-hwpx-validate` | export 품질 게이트 | `fix_namespaces.py`, `validate.py`, `verify_hwpx.py`, 텍스트 추출 검증 후 파일 제공 |
| `livedock-hwp-mcp-local` | 로컬 HWP 보조 도구 | Windows/Hancom HWP가 있는 개발 환경에서만 렌더링 확인이나 수동 점검에 사용 |
| `hwpx` global skill | HWPX toolchain workflow | Markdown/Text to HWPX, placeholder replacement, form clone, official writing rules, HWP to HWPX conversion |

핵심 경계는 명확합니다. OpenAI/Gemini는 구조화 JSON과 초안을 만들고, backend service는 workflow 상태와 검증을 관리하며, HWPX scripts가 실제 ZIP/XML 패키지를 생성합니다. `hwp-mcp`는 production dependency가 아니라 로컬 Windows 검증 보조 도구입니다.

---

## 기술 아키텍처

```mermaid
flowchart LR
  U["User"] --> FE["Next.js Frontend<br/>Vercel"]
  FE --> API["FastAPI Backend<br/>Python Runtime / Render"]

  API --> Parser["Ingestion Layer<br/>PDF / URL / Text / HWP / HWPX"]
  API --> AI["AI Provider<br/>OpenAI / Gemini-Gemma"]
  API --> Workflow["Workflow Service<br/>analysis / inputs / drafts / export"]
  Workflow --> Store["InsForge<br/>Auth / Postgres / Storage"]
  Store -.-> PgApi["PostgREST / Supabase-compatible client layer"]
  Workflow --> Cache["Redis<br/>in-memory/file fallback"]
  Workflow --> HWPX["HWPX Toolchain<br/>ZIP/XML / clone / replace"]
  HWPX --> Validate["Validation<br/>fix_namespaces / validate / verify"]

  Dev["Codex / Claude Code"] --> Harness["Harness Engineering<br/>quality gates / error memory"]
  Harness --> API
  Harness --> FE
```

### 런타임 책임 분리

- **Frontend**: 업로드, 분석 결과 검토, 사용자 입력, 섹션 초안 리뷰, export UI
- **Backend**: 파싱, AI provider 호출, Pydantic 검증, workflow 상태, export orchestration
- **AI Provider**: 구조화 JSON 분석과 섹션별 초안 생성
- **InsForge**: 사용자/auth, 분석 결과, workflow session, 업로드 문서, 생성 export 저장
- **HWPX Toolchain**: 실제 `.hwpx` 패키지 생성, 공식 양식 clone/replace, 검증
- **Harness**: 반복 가능한 품질 게이트와 오류 fingerprint 관리

---

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS |
| Frontend State/UI | Zustand, React Dropzone, Framer Motion |
| Backend | FastAPI, Python 3.11+, Pydantic |
| AI | OpenAI API, Gemini/Gemma provider option |
| 문서 파싱 | PyMuPDF, URL ingestion, HWP/HWPX intake |
| HWPX | ZIP/XML toolchain, `lxml`, `python-hwpx`, HWPX clone/replace scripts |
| Persistence | InsForge Auth, Postgres, Storage |
| Data API Layer | PostgREST / Supabase-compatible client layer through InsForge SDK |
| Cache/Fallback | Redis, in-memory/file cache |
| Export | HWPX, PDF, editable HTML fallback |
| Deployment | Vercel frontend, Render or Vercel-compatible Python backend |
| Verification | `scripts/harness.ps1`, backend contracts, agent eval, frontend build, HWPX validation |

---

## 프로젝트 구조

```text
LiveDock/
  frontend/                       Next.js frontend
    app/app/page.tsx              6단계 Agent workflow 메인 화면
    app/app/templates/            HWPX 템플릿 기반 시작 흐름
    components/workspace/         업로드, 진행 상태, 리뷰, HWPX 폼 편집 UI
    lib/api.ts                    FastAPI client
    lib/types.ts                  frontend 공유 타입
    lib/insforge.ts               InsForge SDK client

  backend/                        FastAPI backend
    main.py                       FastAPI entrypoint, CORS, router 등록
    models/schemas.py             Pydantic API contracts
    routers/                      analyze, workflow, hwpx, notices API
    services/analyzer.py          공고문 분석 orchestration
    services/drafting_service.py  섹션 초안, finalize, HWPX export
    services/document_ingestion.py PDF/HWP/HWPX intake
    services/hwpx_form_session.py HWPX 양식 세션 편집
    services/source_preserving_export.py 원본 양식 보존 export
    services/storage.py           InsForge/Redis/fallback 저장소
    hwpx_toolchain/scripts/       HWPX clone, namespace, validate 도구
    tests/contracts/              backend contract tests
    tests/evals/                  deterministic Agent MVP eval

  harness/                        Agent harness
    state-spec.yaml               제품 불변 조건과 Agent 계약
    quality-gates.yaml            quick/backend/agent/frontend/full/hwpx profile
    memory/                       durable project/user workflow memory
    errors/registry.json          반복 실패 fingerprint registry

  docs/                           제품, 아키텍처, 배포, HWPX, 평가 문서
  tools/                          harness runner, handoff, HWP MCP helper
  .claude/skills/                 LiveDock 단계별 Agent skill 정의
```

---

## 주요 API

LiveDock API는 화면의 6단계 workflow를 그대로 따라갑니다. 사용자는 하나의 문서 작성 흐름을 경험하지만, backend에서는 분석, 입력 수집, 초안 생성, 확인, export가 분리되어 관리됩니다.

| 사용자 흐름 | 대표 API | 설명 |
| --- | --- |
| 공고/양식 입력 | `POST /api/analyze`, `POST /api/analyze/text`, `POST /api/analyze/url` | PDF, HWP/HWPX, 텍스트, URL에서 원문을 추출하고 공고 요구사항을 분석합니다. |
| 데모 시작 | `GET /api/demo` | 업로드 없이 샘플 공고로 전체 Agent 흐름을 빠르게 확인합니다. |
| 작업 상태 조회 | `GET /api/workflow/{id}` | 분석 결과, 사용자 입력, 초안, export 상태를 하나의 workflow session으로 불러옵니다. |
| 부족 정보 입력 | `POST /api/workflow/{id}/inputs` | Agent가 질문한 사용자별 정보만 저장합니다. |
| 섹션 초안 생성 | `GET /api/workflow/{id}/draft/stream` | 작성 항목별 초안을 SSE 스트리밍으로 생성합니다. |
| 섹션 재작성 | `POST /api/workflow/{id}/draft/{section_id}/revise` | 사용자의 피드백을 반영해 특정 섹션만 다시 작성합니다. |
| 확인 및 최종화 | `POST /api/workflow/{id}/confirm`, `POST /api/workflow/{id}/finalize` | 불확실한 주장과 확인 필요 항목을 처리한 뒤 최종 문서 본문을 확정합니다. |
| 문서 내보내기 | `GET /api/workflow/{id}/export/hwpx`, `GET /api/workflow/{id}/export/pdf`, `GET /api/workflow/{id}/export/html` | HWPX를 우선 제공하고, PDF/HTML fallback으로 사용자 작업을 보존합니다. |
| HWPX 준비 상태 | `GET /api/hwpx/status` | 서버에 HWPX toolchain, namespace fix, validation 경로가 준비되어 있는지 확인합니다. |

---

## 문서

- [Architecture](./docs/engineering/architecture.md)
- [Deployment](./docs/engineering/deployment.md)
- [Agent Harness](./docs/agent/agent-harness.md)
- [Skills and Technical Patterns](./docs/agent/skills.md)
- [HWPX Workflow](./docs/hwpx/gemma-hwpx-workflow.md)
- [Evaluation](./docs/evaluation/evals.md)
