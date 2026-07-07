# Inline Agent Workspace Review

## 현재 구현 현황

### 1. `docklive-inline-agent`

- Excel COM 자동화의 기본 골격은 Phase 1-5까지 구현되어 있다.
- `src/tools/excel_tools.py`가 open/list/read/write/formula/format/save를 담당하고, 쓰기 전에 `src/executor/backup.py`가 원본 백업을 만든다.
- `src/agent/loop.py`는 OpenAI tool-call 루프를 돌며, `src/executor/dispatcher.py`가 런타임 도구를 실행한다.
- `src/server.py`와 `src/tray.py`로 웹 UI와 로컬 Windows 실행기를 WebSocket으로 연결하는 1차 통합이 되어 있다.
- HWP/HWPX는 네이티브 HWP COM 편집보다 HWPX 직접 조작 쪽으로 방향이 정리되어 있다.

### 2. Backend 문서 프로젝트

- `/api/workspaces` 라우터가 프로젝트 생성, 파일 추가, 공고 분석, 구조 설계, 문서 생성, 블록 변환, export, Excel artifact를 제공한다.
- `workspace_service.py`가 워크스페이스 상태와 파일 수명주기를 관리한다.
- `spreadsheet_ingestion.py`는 CSV/XLSX 값을 그대로 파싱하며, 이미지/OCR과 미지원 파일은 경고로 남긴다.
- `blueprint_service.py`는 업로드된 공고 분석과 표 자료만 사용해 문서 섹션과 시각 블록을 만든다.
- `workspace_export.py`는 Markdown/HTML/DOCX/HWPX/PDF export를 제공하고, 차트는 표 fallback으로 내보낸다.
- `excel_artifacts.py`는 분석 요약/제출서류/차트/근거 시트를 가진 XLSX 산출물과 저장 동기화를 담당한다.

### 3. Frontend 문서 프로젝트

- `/app/projects`가 Inline-AI-style 문서 작업대 역할을 한다.
- 업로드, 공고 분석, 구조 설계, 문서 생성, 블록 단위 변환, HWPX/PDF/DOCX/HTML/Markdown export가 연결되어 있다.
- 로컬 Excel 에이전트 패널이 프로젝트 우측 패널에 연결되어 있고, health check와 WebSocket 이벤트 로그를 표시한다.

## 부족한 점

- 사용자가 다음에 무엇을 눌러야 하는지보다 내부 상태, 로그, 분석/구조 정보가 먼저 보인다.
- 로컬 에이전트는 강력하지만 현재는 원시 tool-call 로그 중심이라 실제 사용자에게는 부담스럽다.
- 업로드 시 공고문, 참고자료, 데이터 파일의 역할을 사용자가 명확히 지정하거나 수정하는 UI가 없다.
- 분석 근거, 누락 정보, 확인 필요 항목이 문서 편집 흐름 안에서 충분히 드러나지 않는다.
- Excel artifact는 생성/열기/동기화가 가능하지만, 웹 문서와 로컬 Excel 편집 결과가 어떤 관계인지 설명하는 제품 흐름이 약하다.
- OCR, 네이티브 HWP 편집, 쓰기 전 diff 승인, 문서 버전 히스토리는 아직 backlog 또는 미구현이다.

## 문서 프로젝트 보완 방향

1. 작업 화면은 항상 하나의 주 액션을 보여준다.
   - 자료 없음: 업로드 안내
   - 자료 있음: 공고 분석
   - 분석 완료: 문서 구조 설계
   - 구조 완료: 문서 생성
   - 문서 생성 완료: 검토/export/Excel 산출물

2. 보조 정보는 접을 수 있게 둔다.
   - 공고 핵심 정보만 항상 표시한다.
   - 문서 구조, 로컬 PC 자동화, 작업 로그는 필요할 때 펼친다.
   - 원시 tool-call 로그는 기본 화면에서 숨긴다.

3. 사용자가 확인해야 하는 항목은 별도 패널로 승격한다.
   - `needs_input` 블록 목록
   - source evidence
   - export 전 확인 항목
   - 로컬 Excel에서 사용자가 수정한 셀 요약

4. 로컬 Excel 에이전트는 “고급 실행기”보다 “현재 문서의 산출물 편집기”로 보이게 한다.
   - 웹에서 만든 Excel 산출물을 열고
   - 사용자가 Excel에서 수정하고
   - 저장 동기화 후 웹 문서/근거 패널에서 변경 요약을 확인하는 흐름이 필요하다.

## 권장 폴더 분류

### Root

```text
backend/                  FastAPI, parsing, analysis, workspace, export
frontend/                 Next.js app and user-facing workflow
docklive-inline-agent/    Windows local runtime agent for Excel/HWP-side automation
desktop/                  Desktop helper integration experiments
docs/                     Product and engineering decisions
harness/                  Agent quality gates, memory, error registry
migrations/               InsForge/Postgres schema changes
scripts/                  Local command wrappers
tools/                    Harness and developer automation
```

### Frontend

```text
frontend/components/projects/
  ProjectWorkspace.tsx        page orchestrator: state, API handlers, layout
  WorkspaceNextAction.tsx     current-step guidance and primary action
  WorkspacePanels.tsx         analysis summary, artifact, logs, advanced panels
  WorkspaceUploader.tsx       file intake
  DocumentCanvas.tsx          document paper surface
  BlockRenderer.tsx           block rendering
  InlineCommandMenu.tsx       block transform controls
  ChartBlock.tsx              chart preview
  ExportBar.tsx               export commands
  LocalAgentPanel.tsx         local Excel agent bridge
```

Longer term, this group can move under `frontend/features/document-workspace/` with a compatibility re-export from `components/projects/ProjectWorkspace.tsx`.

### Backend

```text
backend/routers/workspaces.py             HTTP contract
backend/services/workspace_service.py     workspace state and uploaded files
backend/services/spreadsheet_ingestion.py CSV/XLSX/image intake
backend/services/blueprint_service.py     deterministic structure and document generation
backend/services/block_transforms.py      inline paragraph/table/chart transforms
backend/services/workspace_drafting.py    grounded paragraph rewriting
backend/services/workspace_export.py      Markdown/HTML/DOCX/HWPX/PDF export
backend/services/excel_artifacts.py       Excel artifact planning, rendering, sync
```

### Local Agent

```text
docklive-inline-agent/src/
  agent/       LLM tool-call loop and prompts
  executor/    dispatcher and backup guard
  tools/       runtime tool schemas and Excel/document tools
  cli.py       local CLI demo
  server.py    local HTTP/WebSocket bridge
  tray.py      Windows tray process
```

## 이번 정리에서 반영한 UI 원칙

- `ProjectWorkspace`에서 보조 패널과 다음 작업 UI를 분리했다.
- 오른쪽 패널은 공고 핵심 정보만 먼저 보여주고, 문서 구조/로컬 자동화/작업 로그는 접을 수 있게 했다.
- 로컬 Excel 에이전트 로그는 최근 상태만 먼저 보여주고 상세 로그는 접는다.
- 기술 용어(`artifact`, raw status)는 사용자 문구로 바꾸었다.
