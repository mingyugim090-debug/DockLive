# Dock Live Demo Script

## Purpose

Dock Live is an Agent MVP that reads public notices, extracts source-grounded requirements, asks only for missing user information, drafts submission documents section by section, and exports editable HTML/HWPX.

## One-Line Pitch

공고를 업로드하면 요구사항과 근거를 정리하고, 부족한 정보만 질문한 뒤 제출 초안을 HWPX로 내보내는 Agent입니다.

## 5-Minute Lab Meeting Demo

### 1. Landing

Say:

> Dock Live는 공고문을 새로 만드는 서비스가 아니라, 공고를 읽고 제출 문서 초안을 준비하는 Agent입니다.

Show:

- Hero message: 공고를 읽고 제출 초안을 준비합니다.
- Core flow: 원문 분석, 확인 질문, 섹션별 초안, HWPX export.
- Emphasize: 공고에 없는 사실은 임의로 채우지 않고 확인 질문으로 남깁니다.

### 2. Start With Demo Notice

Say:

> 오늘은 파일 변수 없이 대표 fixture로 흐름을 보여드리겠습니다. 실제 사용에서는 PDF, HWPX, URL, 텍스트 공고를 넣을 수 있습니다.

Action:

- Open workspace.
- Choose one demo notice, preferably `지원사업` or `공모전`.

### 3. Analysis

Say:

> Agent가 마감일, 제출 서류, 자격, 평가 기준을 원문 기준으로 분리합니다. 중요한 점은 불확실한 항목을 억지로 채우지 않는다는 것입니다.

Show:

- 공고 분석 요약
- 일정과 제출서류
- 원문 근거
- 불확실한 항목

### 4. Missing Inputs

Say:

> 공고에서 알 수 없는 지원자 정보만 질문합니다. 사용자가 이미 아는 정보까지 다시 요구하지 않는 것이 목표입니다.

Action:

- Fill required fields briefly.
- Keep one optional field empty if you want to show that optional inputs are not blockers.

### 5. Section Draft

Say:

> 초안은 전체 문서 한 번에 뭉쳐서 만드는 대신 섹션별로 생성합니다. 그래서 사용자가 필요한 부분만 검토하고 수정할 수 있습니다.

Show:

- Section generation progress.
- Draft review.
- AI rewrite or direct edit if time allows.

### 6. Finalize And Export

Say:

> 최종 문서는 제출 전 검토용입니다. HWPX를 우선 제공하고, 실패하거나 환경이 다르면 HTML fallback으로 작업을 보존합니다.

Show:

- Final document preview.
- HWPX export button.
- HTML fallback mention.

## What To Emphasize

- Groundedness first: 공고에 없는 마감일, 기관명, 제출 서류를 만들지 않습니다.
- User burden reduction: 부족한 정보만 질문합니다.
- Section-level control: 초안은 섹션별로 검토합니다.
- Korean document workflow: HWPX export와 검증 경로가 있습니다.

## Known Boundaries

- Real AI quality is model/provider dependent, so deterministic fixture gates and real-AI eval are separated.
- Complex official forms may need template cloning or manual review.
- HWPX 실패 시 HTML export로 작업을 보존하는 fallback을 유지합니다.
