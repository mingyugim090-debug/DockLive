# LiveDock — Claude Code 프로젝트 가이드

## 목적
한국 공고문(공모전/지원사업/장학금/연구과제)을 PDF·URL·텍스트로 입력하면,
AI가 요구사항을 추출하고, 부족한 정보만 질문하고, 섹션별 초안을 생성하고,
HWPX·PDF·HTML로 내보내는 **문서 자동화 Agent**.

---

## 6단계 워크플로우 (핵심 제품)

```
1. Input     → PDF 업로드 / URL / 텍스트 붙여넣기 / Demo 버튼
2. Analysis  → POST /api/analyze → 공고 핵심 정보 추출 표시
3. Questions → POST /api/workflow/{id}/inputs → user_inputs 필드 입력
4. Draft     → GET /api/workflow/{id}/draft/stream → SSE 스트리밍 초안 생성
5. Review    → 섹션별 확인/편집/AI 재작성, confirmation_required 체크
6. Download  → GET /api/workflow/{id}/export/{hwpx|pdf|html}
```

---

## 핵심 파일 위치

| 역할 | 경로 |
|------|------|
| 메인 6단계 워크플로우 | `frontend/app/app/page.tsx` |
| HWPX 양식 직접 편집 | `frontend/components/workspace/HwpxFormEditor.tsx` |
| 모든 API 함수 | `frontend/lib/api.ts` |
| TypeScript 타입 | `frontend/lib/types.ts` |
| 백엔드 분석 라우터 | `backend/routers/analyze.py` |
| 백엔드 워크플로우 라우터 | `backend/routers/workflow.py` |
| 백엔드 HWPX 라우터 | `backend/routers/hwpx.py` |
| AI 초안 생성 + HWPX export | `backend/services/drafting_service.py` |
| HWPX 폼 세션 편집 | `backend/services/hwpx_form_session.py` |
| HWPX 스크립트 (수정 주의) | `backend/hwpx_toolchain/scripts/` |
| 목 데이터 (데모용) | `backend/services/mock_data.py` |

---

## 컬러 시스템 (page.tsx에 하드코딩됨 — 임의 변경 금지)

```
Primary dark:   #245D50    Primary mid:    #3A7A68
Primary light:  #6A9C89    Primary soft:   #EDF7F2
Border:         #DDE7E2    Surface muted:  #F8FBFA
Text dark:      #24312D    Text mid:       #40504B
Text muted:     #65736E
```

---

## API 엔드포인트 전체 참조

```
POST /api/analyze                              파일(PDF/HWP/HWPX) 업로드 분석
POST /api/analyze/text                         텍스트 직접 분석 (100자 이상)
POST /api/analyze/url                          URL 공고 분석
GET  /api/demo                                 데모 픽스처 (업로드 불필요)

GET  /api/workflow/{id}                        워크플로우 세션 조회
POST /api/workflow/{id}/inputs                 사용자 답변 저장
GET  /api/workflow/{id}/draft/stream           SSE 초안 스트리밍
POST /api/workflow/{id}/draft/{sid}/feedback   섹션 피드백 저장
POST /api/workflow/{id}/draft/{sid}/revise     섹션 AI 재작성
POST /api/workflow/{id}/confirm                확인 필요 항목 체크
POST /api/workflow/{id}/finalize               최종 문서 생성
GET  /api/workflow/{id}/exports                export 목록 조회
GET  /api/workflow/{id}/exports/{eid}          저장된 export 다운로드
GET  /api/workflow/{id}/export/hwpx            HWPX export
GET  /api/workflow/{id}/export/pdf             PDF export
GET  /api/workflow/{id}/export/html            HTML export (fallback)

POST /api/hwpx/sessions                        HWPX 폼 세션 생성 (90s timeout)
GET  /api/hwpx/sessions/{id}                   세션 조회
PATCH /api/hwpx/sessions/{id}/regions/{rid}    필드 값 저장
POST /api/hwpx/sessions/{id}/regions/{rid}/draft  AI 필드 초안
POST /api/hwpx/sessions/{id}/components        구성요소 추가
POST /api/hwpx/sessions/{id}/export            HWPX 다운로드 생성
```

---

## 핵심 타입 요약 (frontend/lib/types.ts)

```typescript
WorkflowSession   // id, analysis, user_inputs[], draft_sections[], final_document
AnalysisResult    // id, title, organization, timeline[], checklist[], document_template[],
                  // eligibility[], missing_questions[], uncertain_fields[]
DraftSection      // id, title, content_markdown, status, confirmation_required[]
UserInputField    // id, label, field_type, required, value, description
HwpxFormSession   // id, source_filename, pages[], regions[], status
ExportResponse    // filename, content (base64|text), content_type, encoding, warnings[]
```

---

## 하면 안 되는 것 (금지사항 8가지)

1. `backend/hwpx_toolchain/scripts/` 직접 수정 후 `validate.py` + `verify_hwpx.py` 실행 안 하기
2. HWPX/ZIP 파일을 AI가 직접 생성하기 (반드시 toolchain 스크립트 경유)
3. `confirmation_required` 항목을 사용자 확인 전에 건너뛰기
4. 커뮤니티/소셜 기능 추가 (Agent MVP 우선)
5. 앱 전체 디자인 시스템을 위 컬러값 외로 임의 변경하기
6. `frontend/lib/store.ts` Zustand store를 `app/app/page.tsx`에 연결하기 (로컬 state 사용)
7. `/finalize` 호출 전에 `/export/hwpx` 호출하기
8. `MOCK_MODE=true`인 채로 프로덕션 배포하기

---

## 로컬 실행

```bash
# 백엔드
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env   # OPENAI_API_KEY 설정 필요
uvicorn main:app --reload  # localhost:8000

# 프론트엔드
cd frontend
npm install
# .env.local에 NEXT_PUBLIC_API_URL=http://localhost:8000 설정
npm run dev   # localhost:3000
```

---

## 테스트 방법

```bash
# 타입 체크 + 빌드 검증
cd frontend && npm run build

# 백엔드 테스트
pytest backend/tests/

# HWPX 검증
python backend/hwpx_toolchain/scripts/validate.py <output.hwpx>

# 전체 흐름 수동 테스트
GET /api/demo → workflow ID 확인 → 6단계 완주 → HWPX 다운로드
```

---

## 개발 로드맵 참조

계획 파일: `C:\Users\alseh\.claude\plans\harmonic-yawning-island.md`

- Phase 1 (Jotform 모방): Demo 버튼, HWPX 다운로드 수정, 세션 저장, 에러 복구
- Phase 2 (PandaDoc 모방): 인라인 편집, 섹션 AI 재작성, 스트리밍 delta 표시
- Phase 3 (Formstack 모방): 템플릿 갤러리, 문서 유형별 fixture
- Phase 4: 다운로드 이력, 공유 링크, 모바일 최적화
