# FRONTEND_DESIGN_REFERENCES.md

## 1. 목적

이 문서는 현재 MVP 프론트엔드를 전면 리디자인할 때 참고할 수 있는 프론트엔드 디자인 / 웹사이트 / SaaS 레퍼런스를 정리한 문서다.

Codex는 아래 레퍼런스를 그대로 복제하지 말고, 다음 요소만 분석해서 현재 서비스에 맞게 재구성해야 한다.

- 정보 구조
- 사용자 흐름
- 화면 구성 방식
- 컴포넌트 배치
- CTA 배치
- 대시보드 구조
- 작업 화면 구조
- 문서 생성 / 편집 / 다운로드 흐름
- 빈 상태 / 로딩 상태 / 오류 상태 처리
- 반응형 대응 방식
- 전체적인 제품 완성도

---

## 2. 레퍼런스 사용 원칙

### 2.1 복제 금지

아래 레퍼런스 사이트의 디자인을 그대로 복제하지 않는다.

금지되는 작업:

- 동일한 레이아웃을 그대로 복사
- 동일한 카피 문구 사용
- 동일한 색상 조합을 그대로 사용
- 특정 서비스의 브랜드 톤을 그대로 모방
- 특정 UI 컴포넌트를 거의 동일하게 재현

### 2.2 참고해야 할 것

다음 관점만 참고한다.

- 사용자가 첫 화면에서 서비스를 이해하는 방식
- 핵심 기능으로 진입시키는 방식
- 업로드 / 입력 / 생성 / 편집 / 다운로드 흐름
- 대시보드에서 정보를 정리하는 방식
- 작업 화면에서 패널을 배치하는 방식
- 결과물을 보여주는 방식
- 템플릿을 탐색하게 하는 방식
- 상태값을 표시하는 방식
- 모바일 화면에서 복잡한 기능을 단순화하는 방식

---

## 3. 현재 서비스에 적합한 레퍼런스 유형

현재 서비스가 다음 중 하나에 해당한다면 이 문서의 레퍼런스를 적극적으로 참고한다.

- AI 문서 자동화 서비스
- HWP / HWPX 문서 처리 서비스
- AI 문서 생성 Agent
- 보고서 자동 생성 서비스
- 템플릿 기반 문서 생성 서비스
- 업무 자동화 SaaS
- AI 생산성 도구
- 파일 업로드 기반 AI 작업 서비스
- 결과물 다운로드 중심 서비스
- B2B 문서 처리 서비스

---

## 4. 핵심 레퍼런스 우선순위

현재 서비스가 문서 자동화 Agent 또는 AI 문서 생성 서비스라면 다음 순서로 우선 참고한다.

```text
1. ForgeDocs
2. Spell
3. PandaDoc
4. Documentero
5. Ema Doc Gen
6. Notion
7. Linear
8. Vercel
9. Supabase
10. Stripe Dashboard
```

단, Codex가 한 번에 너무 많은 레퍼런스를 섞지 않도록 실제 구현에서는 아래 조합을 우선 사용한다.

```text
ForgeDocs + Spell + PandaDoc + Linear + Vercel
```

---

## 5. 핵심 레퍼런스 상세

## 5.1 ForgeDocs

### 참고 목적

AI 문서 자동화 Agent, 문서 생성 Workspace, 파일 기반 작업 흐름을 참고한다.

### 참고할 포인트

- Workspace 기반 문서 작업 구조
- 파일 업로드 후 AI에게 작업을 요청하는 흐름
- 문서 생성 / 수정 / 편집을 하나의 작업 공간에서 처리하는 방식
- 기존 문서 파일을 기반으로 새 결과물을 만드는 구조
- 문서 버전 관리 느낌
- 파일 목록과 대화형 작업 영역의 결합
- 결과물을 DOCX / XLSX / PPTX 같은 실제 파일로 다루는 방식

### 현재 서비스에 적용할 수 있는 방향

HWP / HWPX 기반 문서 자동화 서비스라면 ForgeDocs와 유사하게 다음 구조를 고려한다.

```text
Dashboard
→ Workspace 생성
→ 파일 업로드
→ 작업 명령 입력
→ AI 처리
→ 결과 미리보기
→ 수정 요청
→ 다운로드
```

### Codex 적용 지시

```text
ForgeDocs는 문서 자동화 Agent형 서비스의 작업 구조를 참고하기 위한 레퍼런스다.
디자인을 그대로 따라하지 말고, workspace 중심 구조와 파일 기반 작업 흐름만 참고해줘.
특히 파일 업로드, 작업 명령, 생성 결과, 다운로드 흐름을 현재 서비스 목적에 맞게 재구성해줘.
```

---

## 5.2 Spell

### 참고 목적

자연어 기반 문서 생성 흐름을 참고한다.

### 참고할 포인트

- 사용자가 만들고 싶은 문서를 자연어로 설명하는 방식
- 프롬프트 입력 후 문서 초안을 생성하는 흐름
- 생성된 결과를 다시 자연어로 수정하는 구조
- 에디터 중심의 AI 문서 생성 UX
- 복잡한 설정 없이 빠르게 결과물을 만드는 흐름

### 현재 서비스에 적용할 수 있는 방향

사용자가 “무엇을 만들지” 설명하면 AI가 문서 초안을 생성하고, 이후 추가 요청으로 수정하는 흐름을 만들 수 있다.

```text
작업 설명 입력
→ 템플릿 또는 문서 유형 선택
→ AI 생성
→ 결과 미리보기
→ 수정 요청 입력
→ 재생성 또는 다운로드
```

### Codex 적용 지시

```text
Spell은 자연어 입력 기반 문서 생성 플로우를 참고하기 위한 레퍼런스다.
현재 서비스의 핵심 작업 입력창, 생성 버튼, 결과 수정 요청 흐름에 이 UX 패턴을 반영해줘.
```

---

## 5.3 PandaDoc

### 참고 목적

문서 자동화 / 계약서 / 제안서 / 템플릿 기반 B2B SaaS 구조를 참고한다.

### 참고할 포인트

- B2B 문서 서비스 랜딩 페이지 구성
- 문서 템플릿 중심 UX
- 문서 작성 → 공유 → 승인 → 다운로드 흐름
- 신뢰감 있는 SaaS 톤
- Hero Section의 제품 가치 설명 방식
- 고객 사례 / 기능 섹션 / CTA 배치
- 문서 관리 대시보드 구성

### 현재 서비스에 적용할 수 있는 방향

문서 자동화 서비스의 랜딩 페이지와 템플릿 구조를 만들 때 PandaDoc의 UX 패턴을 참고한다.

```text
Hero Section
→ 문제 제시
→ 문서 자동화 솔루션 설명
→ 템플릿 / 기능 소개
→ 작업 흐름 설명
→ CTA
```

### Codex 적용 지시

```text
PandaDoc은 문서 자동화 SaaS의 랜딩 페이지와 템플릿 기반 UX를 참고하기 위한 레퍼런스다.
현재 서비스의 첫 화면, 템플릿 선택 화면, 문서 관리 화면의 정보 구조를 개선할 때 참고해줘.
```

---

## 5.4 Documentero

### 참고 목적

템플릿 기반 문서 자동화와 API / Form / Spreadsheet 기반 문서 생성 UX를 참고한다.

### 참고할 포인트

- Word / Excel / PDF 결과물 중심 문서 자동화 흐름
- 템플릿 업로드
- 폼 기반 문서 생성
- 외부 데이터와 문서 템플릿 연결
- API 기반 자동화 설명 구조
- 문서 생성 결과 다운로드 흐름

### 현재 서비스에 적용할 수 있는 방향

템플릿 파일을 업로드하고, 입력값을 받아 결과 문서를 생성하는 서비스라면 Documentero 구조가 적합하다.

```text
템플릿 업로드
→ 입력 필드 구성
→ 데이터 입력
→ 문서 생성
→ 결과 다운로드
```

### Codex 적용 지시

```text
Documentero는 템플릿 기반 문서 자동화 흐름을 참고하기 위한 레퍼런스다.
현재 서비스에 템플릿 업로드, 입력값 매핑, 결과 다운로드 기능이 있다면 이 구조를 반영해줘.
```

---

## 5.5 Ema Doc Gen

### 참고 목적

Agentic AI 기반 문서 생성 및 팀 협업형 문서 생성 흐름을 참고한다.

### 참고할 포인트

- AI Agent가 문서 생성을 단계적으로 수행하는 방식
- 연구 / 작성 / 편집 / 승인 흐름
- 진행 상태 추적
- 섹션 단위 문서 생성
- 팀 협업형 문서 생성 구조
- 업무용 문서 생성 서비스의 신뢰감 있는 표현 방식

### 현재 서비스에 적용할 수 있는 방향

문서 생성 과정이 단순 텍스트 생성이 아니라 여러 단계의 작업으로 구성된다면 다음 구조를 고려한다.

```text
문서 유형 선택
→ 자료 업로드
→ AI 분석
→ 초안 생성
→ 섹션별 수정
→ 최종 검토
→ 다운로드
```

### Codex 적용 지시

```text
Ema Doc Gen은 Agentic AI 문서 생성 흐름을 참고하기 위한 레퍼런스다.
현재 서비스가 여러 단계의 문서 생성 작업을 수행한다면 진행 상태, 단계 표시, 섹션별 결과 구조를 반영해줘.
```

---

## 6. 디자인 품질 참고용 레퍼런스

아래 서비스들은 문서 자동화와 직접적으로 같지는 않지만, 프론트엔드 완성도와 SaaS UI 품질을 참고하기 좋다.

---

## 6.1 Linear

### 참고 목적

고품질 SaaS 대시보드, 사이드바, 리스트 UI, 상태 표시 방식을 참고한다.

### 참고할 포인트

- 좌측 사이드바
- 미니멀한 레이아웃
- 리스트와 상세 패널 구조
- 상태 배지
- 빠른 액션
- 일관된 spacing
- 복잡한 정보를 단순하게 정리하는 방식

### 현재 서비스에 적용할 수 있는 방향

프로젝트 목록, 문서 목록, 작업 히스토리, 상태 관리 화면에 적합하다.

```text
Sidebar
→ Project List
→ Status Badge
→ Detail Panel
→ Quick Actions
```

---

## 6.2 Vercel

### 참고 목적

고급 SaaS 랜딩 페이지, 대시보드 카드, 개발자 도구형 UI 감성을 참고한다.

### 참고할 포인트

- 강한 Hero Section
- 제품 중심 랜딩 페이지
- 카드형 기능 설명
- 깔끔한 CTA 구조
- 대시보드 카드 레이아웃
- 다크/라이트 톤 모두 대응 가능한 디자인
- 배포 / 상태 / 로그 화면과 유사한 구조

### 현재 서비스에 적용할 수 있는 방향

서비스의 랜딩 페이지와 대시보드 첫 화면에 적합하다.

---

## 6.3 Supabase

### 참고 목적

개발자 친화적인 대시보드와 명확한 정보 구조를 참고한다.

### 참고할 포인트

- 프로젝트 기반 대시보드
- 설정 화면 구조
- 테이블 UI
- 사이드바 네비게이션
- 문서화된 제품 설명 방식
- 기술 서비스의 신뢰감 있는 인터페이스

### 현재 서비스에 적용할 수 있는 방향

문서 자동화 Agent가 개발자/API 기능을 포함한다면 Supabase식 대시보드 구조가 적합하다.

---

## 6.4 Stripe Dashboard

### 참고 목적

정보 밀도가 높은 B2B 대시보드, 테이블, 필터, 상태 관리 UI를 참고한다.

### 참고할 포인트

- 데이터 테이블
- 필터 / 검색 / 정렬
- 상태 배지
- 상세 패널
- 설정 페이지
- 사용량 / 결제 / 이력 관리 UI
- 복잡한 정보를 깔끔하게 보여주는 방식

### 현재 서비스에 적용할 수 있는 방향

작업 히스토리, 사용량, 문서 생성 이력, 결제/플랜, 로그 관리 화면에 적합하다.

---

## 6.5 Notion

### 참고 목적

문서 편집 화면, 사이드바, 빈 페이지 UX, 블록 기반 편집 흐름을 참고한다.

### 참고할 포인트

- 문서 중심 화면
- 좌측 사이드바
- 빈 페이지 상태
- 깔끔한 에디터
- 콘텐츠 중심 레이아웃
- 과하지 않은 인터페이스
- 작성과 편집이 자연스럽게 이어지는 구조

### 현재 서비스에 적용할 수 있는 방향

결과 문서 미리보기, 생성된 문서 편집, 섹션 단위 수정 화면에 적합하다.

---

## 6.6 ChatGPT / Claude

### 참고 목적

대화형 AI 작업 UX와 결과 수정 흐름을 참고한다.

### 참고할 포인트

- 하단 입력창
- 대화형 작업 요청
- 결과 확인 후 추가 수정 요청
- 파일 첨부 기반 작업
- AI 응답 상태
- 생성 중 피드백
- 작업 맥락 유지

### 현재 서비스에 적용할 수 있는 방향

AI 문서 생성 Agent라면 사용자가 자연어로 작업을 요청하고, 결과를 다시 수정하는 흐름에 적합하다.

```text
파일 첨부
→ 작업 요청 입력
→ AI 응답
→ 결과 생성
→ 추가 수정 요청
→ 최종 다운로드
```

---

## 6.7 Cursor / Replit / Raycast

### 참고 목적

AI 생산성 도구, 개발자 도구, 명령 중심 인터페이스를 참고한다.

### 참고할 포인트

- 명령 입력 중심 UI
- 작업 공간 중심 UX
- 빠른 실행
- 프로젝트 관리
- 사용자가 “무엇을 할지” 바로 입력하는 구조
- 제품의 핵심 가치를 강하게 전달하는 랜딩 페이지

### 현재 서비스에 적용할 수 있는 방향

문서 자동화 Agent가 “명령을 입력하면 문서를 처리해주는 도구”라면 이 계열의 UX가 적합하다.

---

## 7. 화면별 추천 레퍼런스

## 7.1 Landing Page

### 추천 레퍼런스

- PandaDoc
- Vercel
- Raycast
- Cursor
- Gamma
- Tome

### 참고할 포인트

- Hero Section의 메시지 구조
- 제품 UI 미리보기 mockup
- 문제 → 해결 → 기능 → 사용 사례 → CTA 흐름
- 첫 CTA와 보조 CTA 배치
- 신뢰감 있는 SaaS 톤
- 너무 장식적이지 않은 제품 중심 디자인

### 적용 방향

```text
Hero Section
→ Problem Section
→ Solution Section
→ Core Features
→ How It Works
→ Use Cases
→ Product Preview
→ Final CTA
```

---

## 7.2 Dashboard

### 추천 레퍼런스

- Linear
- Vercel Dashboard
- Supabase Dashboard
- Stripe Dashboard
- Notion

### 참고할 포인트

- 좌측 사이드바
- 최근 작업 목록
- 빠른 시작 카드
- 상태 배지
- 프로젝트 카드
- 작업 히스토리
- 검색 / 필터
- 빈 상태 화면

### 적용 방향

```text
Sidebar
→ Header
→ Quick Start
→ Recent Projects
→ Templates
→ Activity History
```

---

## 7.3 Workspace / Editor

### 추천 레퍼런스

- ForgeDocs
- Spell
- Notion
- ChatGPT
- Claude
- Cursor

### 참고할 포인트

- 파일 업로드 영역
- 자연어 명령 입력창
- 결과 미리보기
- 좌측 작업 목록
- 우측 옵션 패널
- 생성 상태 표시
- 재생성 / 수정 / 다운로드 버튼
- 대화형 수정 흐름

### 적용 방향

```text
Left Panel: 프로젝트 / 단계 / 파일 목록
Center: 입력 또는 결과 미리보기
Right Panel: 옵션 / 설정 / 문서 정보
Bottom or Top CTA: 생성 / 저장 / 다운로드
```

---

## 7.4 Template Page

### 추천 레퍼런스

- PandaDoc
- Documentero
- Canva
- Gamma
- Tome

### 참고할 포인트

- 템플릿 카드
- 카테고리 필터
- 검색
- 미리보기
- 추천 템플릿
- 최근 사용 템플릿
- 템플릿 선택 후 작업 시작 흐름

### 적용 방향

```text
Template Gallery
→ Category Filter
→ Search
→ Template Preview
→ Select Template
→ Start Workflow
```

---

## 7.5 Result Page

### 추천 레퍼런스

- Spell
- Notion
- ForgeDocs
- ChatGPT
- Claude
- Documentero

### 참고할 포인트

- 생성 결과 미리보기
- 섹션 단위 결과 표시
- 수정 요청 입력
- 다운로드 CTA
- 재생성 버튼
- 저장 버튼
- 품질 체크 표시
- 오류 또는 불완전 결과 안내

### 적용 방향

```text
Result Preview
→ Summary
→ Edit Request
→ Regenerate
→ Save
→ Download
```

---

## 8. Codex에게 줄 레퍼런스 분석 지시

아래 문구를 Codex에게 그대로 전달할 수 있다.

```text
아래 레퍼런스들을 참고하되, 디자인을 그대로 복제하지 말고 다음 관점만 분석해서 현재 서비스에 맞게 반영해줘.

1. 첫 화면에서 서비스 목적을 설명하는 방식
2. 사용자가 첫 작업을 시작하는 CTA 구조
3. 문서 업로드 / 입력 / 생성 / 결과 확인 흐름
4. 대시보드에서 최근 작업과 템플릿을 보여주는 방식
5. 작업 화면에서 입력 패널, 미리보기 패널, 옵션 패널을 배치하는 방식
6. 결과 화면에서 다운로드, 수정, 재생성 버튼을 제공하는 방식
7. 빈 상태, 로딩 상태, 오류 상태를 처리하는 방식
8. 모바일에서 복잡한 작업 화면을 단순화하는 방식
9. 사이드바, 카드, 테이블, 배지, 탭, 모달 같은 공통 컴포넌트의 일관성
10. MVP 느낌을 줄이고 실제 SaaS 제품처럼 보이게 만드는 시각적 완성도
```

---

## 9. Codex에게 제공할 레퍼런스 목록

```md
## Reference Websites

### Core References
- ForgeDocs
  - Use for AI document automation workspace structure.
  - Focus on file-based workflow, AI document generation, document editing, and export flow.

- Spell
  - Use for natural language based document generation.
  - Focus on prompt input, AI draft generation, edit request, and result refinement flow.

- PandaDoc
  - Use for B2B document automation SaaS structure.
  - Focus on landing page, template system, document management, and CTA flow.

- Documentero
  - Use for template-based document generation.
  - Focus on template upload, form-based generation, document export, and automation flow.

- Ema Doc Gen
  - Use for agentic AI document generation.
  - Focus on staged generation, progress tracking, review flow, and enterprise document workflow.

### UI Quality References
- Linear
  - Use for dashboard, sidebar, list UI, status badges, and clean SaaS layout.

- Vercel
  - Use for landing page, high-quality product presentation, card layout, and dashboard style.

- Supabase
  - Use for developer-friendly dashboard, settings pages, table UI, and project-based navigation.

- Stripe Dashboard
  - Use for data-heavy dashboard, filters, tables, status indicators, and account/settings UI.

- Notion
  - Use for document editor, sidebar, empty state, and content-centered layout.

- ChatGPT / Claude
  - Use for conversational AI workflow, file attachment, prompt input, generation status, and result refinement.

- Cursor / Replit / Raycast
  - Use for AI productivity tool UX, command-centered interface, workspace design, and strong product messaging.
```

---

## 10. 추천 조합

### 10.1 문서 자동화 Agent 중심

```text
ForgeDocs + Spell + Documentero + Notion + ChatGPT
```

적합한 경우:

- 파일 업로드 기반
- AI가 문서를 생성 / 수정
- 결과물을 다운로드
- 작업 공간 중심
- 사용자가 자연어로 명령 입력

---

### 10.2 B2B SaaS 중심

```text
PandaDoc + Linear + Stripe Dashboard + Vercel + Supabase
```

적합한 경우:

- 팀 단위 사용
- 관리자 대시보드 필요
- 작업 이력 관리
- 템플릿 관리
- 사용량 / 플랜 / 설정 화면 필요

---

### 10.3 랜딩 페이지 중심

```text
Vercel + Raycast + PandaDoc + Cursor + Gamma
```

적합한 경우:

- 첫인상 개선
- 서비스 가치 전달
- CTA 전환율 개선
- 제품 미리보기 강조

---

### 10.4 작업 화면 중심

```text
ForgeDocs + Notion + ChatGPT + Claude + Cursor
```

적합한 경우:

- 사용자가 실제로 오래 머무는 작업 화면이 중요
- 입력 / 결과 / 수정 / 다운로드 흐름이 핵심
- AI Agent형 작업 UX가 중요

---

## 11. 최종 적용 방향

현재 서비스가 AI 문서 자동화 Agent라면 최종적으로 다음 방향이 가장 적합하다.

```text
Landing Page: PandaDoc + Vercel + Raycast
Dashboard: Linear + Vercel + Supabase
Workspace: ForgeDocs + Spell + Notion + ChatGPT
Template Page: PandaDoc + Documentero + Canva
Result Page: Spell + Notion + ForgeDocs
Settings / History: Stripe Dashboard + Supabase
```

---

