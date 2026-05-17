# FRONTEND_REDESIGN_REQUEST.md

## 1. 작업 개요

현재 프로젝트는 MVP 수준의 핵심 기능이 어느 정도 구현되어 있다.  
이번 작업의 목표는 **기능 추가 중심이 아니라**, 기존 MVP의 목적과 기능을 유지하면서 프론트엔드 UI/UX를 전면적으로 고도화하는 것이다.

Codex는 현재 코드베이스를 분석한 뒤, 서비스의 목적에 맞는 화면 구조, 사용자 흐름, 컴포넌트 배치, 디자인 시스템, 반응형 UI, 인터랙션 품질을 개선해야 한다.

---

## 2. 핵심 목표

### 2.1 최종 목표

현재 MVP를 다음 수준으로 개선한다.

- 사용자가 서비스 목적을 첫 화면에서 즉시 이해할 수 있는 구조
- 주요 기능까지 자연스럽게 이어지는 UX 흐름
- 기존 서비스들과 비교해도 어색하지 않은 완성도 높은 UI
- 일관된 디자인 시스템
- 모바일 / 태블릿 / 데스크톱 대응
- 실제 서비스처럼 보이는 랜딩 페이지, 대시보드, 작업 화면, 결과 화면
- 불필요한 MVP 느낌 제거
- 사용자의 행동을 유도하는 명확한 CTA 구조
- 기존 기능을 깨뜨리지 않는 안정적인 리디자인

---

## 3. 작업 전 반드시 분석할 것

Codex는 구현을 시작하기 전에 현재 프로젝트를 먼저 분석한다.

### 3.1 프로젝트 구조 분석

다음 항목을 확인한다.

- 사용 중인 프레임워크
  - 예: React, Next.js, Vue, Svelte 등
- 라우팅 구조
- 주요 페이지 목록
- 주요 컴포넌트 목록
- 상태 관리 방식
- API 호출 방식
- 인증 흐름 존재 여부
- 업로드 / 생성 / 저장 / 다운로드 등 핵심 기능 흐름
- 현재 스타일링 방식
  - CSS
  - CSS Modules
  - Tailwind CSS
  - styled-components
  - shadcn/ui
  - MUI
  - Chakra UI
  - 기타 UI 라이브러리
- 현재 디자인의 문제점
- 중복 컴포넌트 여부
- 재사용 가능한 UI 컴포넌트 후보

### 3.2 현재 서비스 목적 추론

코드, 페이지명, 컴포넌트명, 텍스트, API 이름, 폴더 구조를 기반으로 현재 서비스의 목적을 추론한다.

아래 질문에 답할 수 있도록 분석한다.

- 이 서비스는 어떤 문제를 해결하는가?
- 핵심 사용자는 누구인가?
- 사용자가 가장 먼저 수행해야 하는 행동은 무엇인가?
- 사용자가 최종적으로 얻는 결과물은 무엇인가?
- 사용자의 반복 사용 이유는 무엇인가?
- 현재 MVP에서 가장 중요한 기능은 무엇인가?

분석 결과를 바탕으로 UI/UX 구조를 설계한다.

---

## 4. 리디자인 방향

### 4.1 기본 방향

기존 MVP의 기능을 유지하되, 화면 구성과 디자인을 전면적으로 개선한다.

중점은 다음과 같다.

- 기능 나열식 화면을 목적 중심 화면으로 재구성
- 사용자가 다음 행동을 자연스럽게 알 수 있도록 UX 흐름 정리
- 시각적 위계 정리
- CTA 명확화
- 복잡한 기능은 단계형 흐름으로 정리
- 빈 화면, 로딩 화면, 오류 화면, 완료 화면까지 서비스 품질 반영
- 전체 화면의 톤앤매너 통일
- 실제 SaaS 서비스 수준의 완성도 확보

---

## 5. 참고할 레퍼런스 서비스 유형

Codex가 직접 외부 웹사이트를 탐색할 수 없다면, 아래 서비스들의 일반적인 UI/UX 패턴을 참고해 설계한다.  
단, 특정 서비스의 디자인을 그대로 복제하지 않는다.  
레이아웃 구조, 정보 배치 방식, 사용자 흐름, 컴포넌트 패턴만 참고한다.

### 5.1 AI 문서 자동화 / 문서 생성 서비스

해당 프로젝트가 문서 자동화, AI 문서 생성, HWP/HWPX 처리, 보고서 자동 생성, 템플릿 기반 문서 생성 서비스라면 다음 유형을 참고한다.

- Notion AI
- Gamma
- Tome
- Canva Docs
- Microsoft Copilot in Word
- Google Docs Gemini
- Beautiful.ai
- Pitch
- PandaDoc
- DocuSign
- Typeform

참고할 UI/UX 포인트:

- 사용자가 작업을 시작하는 진입 화면
- 문서 업로드 영역
- 템플릿 선택 구조
- 프롬프트 입력 영역
- 생성 옵션 설정 영역
- 생성 결과 미리보기
- 편집 패널
- 좌측 사이드바
- 우측 속성 패널
- 작업 히스토리
- 다운로드 / 내보내기 CTA
- 빈 상태 화면
- 생성 중 로딩 상태

### 5.2 AI SaaS / 생산성 도구

서비스가 AI Agent, 업무 자동화, 생산성 도구 성격이라면 다음 유형을 참고한다.

- ChatGPT
- Claude
- Perplexity
- Linear
- Vercel
- Raycast
- Replit
- Cursor
- Zapier
- Make

참고할 UI/UX 포인트:

- 명령 입력 중심 인터페이스
- 대시보드 카드 구조
- 프로젝트 단위 관리
- 최근 작업 목록
- 빠른 실행 버튼
- 워크플로우 진행 상태
- 로그 / 결과 확인 패널
- 설정 화면
- 사용자 온보딩

### 5.3 B2B SaaS / 대시보드 서비스

관리형 서비스, 데이터 처리, 관리자 대시보드 성격이라면 다음 유형을 참고한다.

- Linear
- Stripe Dashboard
- Vercel Dashboard
- InsForge Dashboard
- Retool
- Airtable
- Slack Admin
- Figma Admin

참고할 UI/UX 포인트:

- 좌측 네비게이션
- 상단 작업 바
- 카드 기반 요약 정보
- 테이블 UI
- 필터 / 정렬 / 검색
- 상태 배지
- 작업 상세 패널
- 설정 페이지
- 권한 / 계정 관리

---

## 6. 권장 정보 구조 IA

현재 서비스 목적에 맞게 조정하되, 기본적으로 다음 구조를 고려한다.

```text
/
├─ Landing Page
│  ├─ Hero Section
│  ├─ Problem Section
│  ├─ Solution Section
│  ├─ Core Features
│  ├─ How It Works
│  ├─ Use Cases
│  ├─ Demo Preview
│  ├─ Pricing or Plan Section, if needed
│  └─ Final CTA
│
├─ Dashboard
│  ├─ Recent Projects
│  ├─ Quick Start Actions
│  ├─ Templates
│  ├─ Usage Summary, if needed
│  └─ Activity History
│
├─ Workspace / Editor
│  ├─ Input Panel
│  ├─ Upload Area
│  ├─ Option Panel
│  ├─ Preview Area
│  ├─ Generation Status
│  └─ Export Actions
│
├─ Result Page
│  ├─ Generated Output Preview
│  ├─ Edit Options
│  ├─ Download / Export
│  └─ Regenerate / Save
│
├─ Templates
│  ├─ Template Gallery
│  ├─ Category Filter
│  └─ Template Detail
│
├─ History / Projects
│  ├─ Project List
│  ├─ Search / Filter
│  └─ Detail View
│
└─ Settings
   ├─ Profile
   ├─ API / Integration
   ├─ Export Options
   └─ Preferences
```

불필요한 페이지는 만들지 않는다.  
현재 MVP 기능상 필요한 화면만 우선 구현한다.

---

## 7. 핵심 UX 플로우 설계

### 7.1 신규 사용자 플로우

사용자가 처음 들어왔을 때 다음 흐름이 자연스러워야 한다.

```text
Landing Page
→ 서비스 목적 이해
→ 주요 기능 확인
→ CTA 클릭
→ 작업 시작 화면 진입
→ 파일 업로드 또는 입력
→ 옵션 선택
→ 생성 실행
→ 결과 확인
→ 수정 또는 다운로드
```

### 7.2 기존 사용자 플로우

기존 사용자는 빠르게 작업을 이어갈 수 있어야 한다.

```text
Dashboard
→ 최근 작업 확인
→ 새 작업 시작
→ 템플릿 선택
→ 생성 / 편집
→ 저장 / 다운로드
```

### 7.3 작업 화면 플로우

작업 화면은 다음 구조를 우선 고려한다.

```text
좌측: 작업 단계 / 템플릿 / 프로젝트 목록
중앙: 메인 입력 또는 결과 미리보기
우측: 옵션 / 설정 / 세부 속성
하단 또는 상단: 주요 CTA
```

화면이 좁은 경우에는 패널을 탭 또는 드로어 형태로 전환한다.

---

## 8. 페이지별 리디자인 요구사항

## 8.1 Landing Page

랜딩 페이지가 존재하지 않거나 부족하다면 새로 구성한다.

### 목적

- 사용자가 서비스를 즉시 이해하게 한다.
- 핵심 문제와 해결 방식을 명확히 보여준다.
- 작업 시작 CTA로 자연스럽게 유도한다.

### 포함할 섹션

1. Hero Section
   - 강한 한 줄 메시지
   - 보조 설명
   - Primary CTA
   - Secondary CTA
   - 제품 UI 미리보기 mockup

2. Problem Section
   - 사용자가 겪는 문제를 3개 정도로 정리
   - 과장된 마케팅 문구보다 실제 사용 맥락 중심

3. Solution Section
   - 이 서비스가 어떻게 문제를 줄여주는지 설명

4. Core Features
   - 핵심 기능 3~6개 카드형 구성

5. How It Works
   - 3단계 또는 4단계 프로세스
   - 예: 업로드 → 옵션 선택 → AI 처리 → 결과 다운로드

6. Use Cases
   - 실제 사용 사례 중심
   - 예: 과제 문서, 보고서, 계약서, 발표자료, 행정 문서 등
   - 현재 서비스 목적에 맞게 수정

7. Demo Preview
   - 실제 서비스 화면 일부를 미리 보여주는 영역

8. Final CTA
   - 작업 시작 유도

### 디자인 기준

- 너무 장식적인 랜딩보다 제품 중심 SaaS 느낌
- 여백 충분히 확보
- 명확한 타이포그래피
- CTA 색상 일관성 유지
- Hero 영역에서 제품의 핵심 가치가 드러나야 함

---

## 8.2 Dashboard

### 목적

사용자가 현재 상태를 파악하고 빠르게 작업을 시작할 수 있어야 한다.

### 포함 요소

- 환영 메시지
- 새 작업 시작 버튼
- 최근 프로젝트 / 최근 작업
- 템플릿 바로가기
- 작업 상태 카드
- 사용량 또는 처리 이력, 필요한 경우
- 빈 상태 화면

### UI 구조

- 좌측 사이드바
- 상단 헤더
- 메인 카드 그리드
- 최근 작업 테이블 또는 리스트
- 빠른 실행 카드

### 빈 상태 예시

최근 작업이 없는 경우 단순히 빈 화면으로 두지 말고, 다음 행동을 안내한다.

```text
아직 생성한 문서가 없습니다.
첫 작업을 시작하고 AI 문서 자동화를 경험해보세요.
[새 작업 시작]
```

---

## 8.3 Workspace / Editor

### 목적

사용자가 실제 작업을 수행하는 핵심 화면이다.  
가장 높은 완성도가 필요하다.

### 기본 구조

데스크톱 기준:

```text
┌─────────────────────────────────────────────┐
│ Top Bar: Project name / Save / Export        │
├──────────────┬────────────────┬─────────────┤
│ Left Panel   │ Main Canvas     │ Right Panel │
│ Steps        │ Preview/Input   │ Options     │
│ Templates    │ Result          │ Settings    │
└──────────────┴────────────────┴─────────────┘
```

### 포함 요소

- 파일 업로드 영역
- 직접 입력 영역
- 템플릿 선택
- 생성 옵션
- AI 생성 버튼
- 진행 상태 표시
- 결과 미리보기
- 수정 요청 입력
- 재생성 버튼
- 저장 버튼
- 다운로드 버튼

### UX 요구사항

- 사용자가 지금 몇 번째 단계에 있는지 보여준다.
- 필수 입력값이 없으면 명확한 안내를 제공한다.
- 생성 중에는 로딩 상태와 진행 메시지를 제공한다.
- 실패 시 원인과 복구 행동을 제공한다.
- 결과가 생성되면 다운로드 / 수정 / 재생성 행동을 분리해서 제공한다.

---

## 8.4 Templates Page

템플릿 기능이 있다면 다음 구조로 개선한다.

### 포함 요소

- 템플릿 카테고리
- 검색
- 필터
- 템플릿 카드
- 미리보기
- 추천 템플릿
- 최근 사용 템플릿

### 카드 구성

각 템플릿 카드는 다음 정보를 포함한다.

- 템플릿 이름
- 짧은 설명
- 사용 목적
- 예상 결과물
- 태그
- 선택 버튼

---

## 8.5 Result Page

### 목적

생성된 결과물을 신뢰감 있게 보여주고, 다음 행동을 명확히 제공한다.

### 포함 요소

- 결과 미리보기
- 문서 요약
- 품질 체크 상태
- 수정 요청 입력
- 다시 생성
- 저장
- 다운로드
- 공유, 필요한 경우

### 결과 화면 UX

- 결과물이 단순 텍스트 덩어리처럼 보이지 않게 한다.
- 문서 구조가 있으면 섹션 단위로 보여준다.
- 다운로드 버튼은 항상 명확하게 보이도록 배치한다.
- 실패 결과나 불완전 결과에 대한 안내도 포함한다.

---

## 9. 디자인 시스템 요구사항

기존 스타일 방식에 맞게 구현하되, 전체 UI에 일관된 디자인 시스템을 적용한다.

### 9.1 Color Token

다음 역할을 가진 색상 토큰을 정의한다.

```text
background
foreground
primary
primary-foreground
secondary
secondary-foreground
muted
muted-foreground
accent
accent-foreground
border
input
ring
destructive
success
warning
info
card
card-foreground
```

### 9.2 Typography

타이포그래피는 다음 기준을 따른다.

- 제목, 본문, 캡션의 위계를 명확히 한다.
- 랜딩 페이지의 Hero 문구는 강한 시각적 위계를 가진다.
- 대시보드와 작업 화면은 가독성을 우선한다.
- 폰트 크기, 줄 간격, 굵기를 일관되게 유지한다.

권장 스케일:

```text
display
h1
h2
h3
body-lg
body
body-sm
caption
```

### 9.3 Spacing

일관된 spacing scale을 적용한다.

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
80px
```

### 9.4 Radius

카드, 버튼, 입력창, 모달의 radius를 통일한다.

```text
small
medium
large
xl
full
```

### 9.5 Shadow

그림자는 과하게 쓰지 않는다.  
카드 구분, floating panel, modal 정도에 제한적으로 사용한다.

---

## 10. 컴포넌트 리디자인 요구사항

다음 공통 컴포넌트를 정리하거나 새로 만든다.

### 10.1 Layout Components

- AppShell
- Sidebar
- Header
- MainContainer
- PageHeader
- Section
- SplitPanel
- EmptyState
- LoadingState
- ErrorState

### 10.2 UI Components

- Button
- Input
- Textarea
- Select
- Checkbox
- Radio
- Switch
- Tabs
- Modal
- Drawer
- Tooltip
- Badge
- Card
- Table
- Progress
- Skeleton
- Toast
- Dropdown
- FileUpload
- Stepper

### 10.3 Product Components

서비스 목적에 맞게 다음 컴포넌트를 구성한다.

- ProjectCard
- TemplateCard
- RecentActivityItem
- UploadPanel
- PromptInput
- GenerationOptions
- PreviewPanel
- ResultViewer
- ExportButton
- HistoryList
- StatusBadge

---

## 11. 상태별 UI 요구사항

모든 주요 화면은 다음 상태를 고려한다.

### 11.1 Loading

- Skeleton UI 사용
- 버튼 클릭 후 중복 실행 방지
- 생성 중 상태 메시지 표시

### 11.2 Empty

- 단순히 비워두지 않는다.
- 사용자가 다음에 해야 할 행동을 명확히 안내한다.
- Primary CTA를 제공한다.

### 11.3 Error

- 오류 원인을 가능한 범위에서 설명한다.
- 재시도 버튼 제공
- 입력값 문제인지, 서버 문제인지 구분

### 11.4 Success

- 작업 완료 상태 명확히 표시
- 다음 행동 제공
  - 다운로드
  - 저장
  - 공유
  - 새 작업 시작

---

## 12. 반응형 디자인 요구사항

반드시 다음 화면 폭을 고려한다.

```text
Mobile: 360px ~ 767px
Tablet: 768px ~ 1023px
Desktop: 1024px 이상
Large Desktop: 1440px 이상
```

### 모바일

- 좌측 사이드바는 drawer로 전환
- 우측 옵션 패널은 bottom sheet 또는 accordion으로 전환
- 주요 CTA는 하단 fixed 영역 고려
- 카드 그리드는 1열
- 긴 테이블은 카드형 리스트로 변환

### 태블릿

- 2열 레이아웃 가능
- 보조 패널은 접기 가능하게 구성

### 데스크톱

- 사이드바 + 메인 + 옵션 패널 구조 가능
- 작업 화면에서는 충분한 미리보기 영역 확보

---

## 13. 접근성 요구사항

최소한 다음 기준을 지킨다.

- 버튼, 링크, 입력창에 명확한 focus state 제공
- 키보드 탐색 가능
- 텍스트 대비 확보
- form label 연결
- aria-label이 필요한 곳에 적용
- 아이콘만 있는 버튼에는 접근 가능한 이름 제공
- 모달 / 드로어 열림 시 focus trap 고려
- 이미지에는 alt 제공

---

## 14. 인터랙션 요구사항

과도한 애니메이션은 피하고, 제품 품질을 높이는 수준에서만 사용한다.

### 적용 가능한 인터랙션

- 버튼 hover / active / disabled
- 카드 hover
- 탭 전환
- 사이드바 접기 / 펼치기
- 파일 업로드 drag & drop
- 생성 진행 상태
- Toast 알림
- Modal / Drawer open-close
- Result preview transition

### 주의

- 애니메이션이 기능 이해를 방해하면 제거한다.
- 느린 애니메이션 금지
- 핵심 작업 버튼은 항상 명확해야 한다.

---

## 15. 카피라이팅 기준

UI 문구는 짧고 명확하게 작성한다.

### 원칙

- 기술 설명보다 사용자 행동 중심
- 버튼은 동사형
- 오류 메시지는 복구 행동 포함
- 빈 상태는 다음 행동 안내
- 과장된 마케팅 문구 지양

### 버튼 예시

```text
새 작업 시작
문서 업로드
AI로 생성하기
다시 생성
결과 저장
다운로드
템플릿 선택
설정 적용
```

### 상태 메시지 예시

```text
문서를 분석하고 있습니다.
결과를 생성하는 중입니다.
필수 입력값을 확인해주세요.
생성이 완료되었습니다.
오류가 발생했습니다. 다시 시도해주세요.
```

---

## 16. 구현 원칙

### 16.1 기존 기능 보존

- 기존 API 연결을 임의로 제거하지 않는다.
- 기존 주요 기능을 깨뜨리지 않는다.
- 함수명, 데이터 구조, API 응답 형태를 변경해야 할 경우 영향 범위를 먼저 확인한다.
- 기능 변경이 필요한 경우 최소 변경으로 처리한다.

### 16.2 점진적 리팩토링

- 한 번에 모든 구조를 무리하게 갈아엎지 않는다.
- 먼저 공통 레이아웃과 디자인 토큰을 정리한다.
- 이후 페이지 단위로 리디자인한다.
- 마지막에 상태 UI와 반응형을 보완한다.

### 16.3 컴포넌트 재사용

- 중복 UI는 공통 컴포넌트로 분리한다.
- 페이지별로 같은 버튼, 카드, 입력창 스타일이 반복되지 않게 한다.
- 디자인 토큰을 직접 색상값보다 우선 사용한다.

---

## 17. 권장 작업 순서

Codex는 다음 순서로 작업한다.

### Step 1. 코드베이스 분석

- 프로젝트 구조 파악
- 주요 페이지와 컴포넌트 확인
- 현재 UI 문제점 정리
- 핵심 사용자 플로우 도출

### Step 2. 디자인 방향 수립

- 서비스 목적에 맞는 레이아웃 방향 결정
- 참고할 서비스 유형 선택
- 컬러, 타이포그래피, spacing 기준 정의

### Step 3. 공통 레이아웃 구현

- AppShell
- Header
- Sidebar
- Main Layout
- Page Container

### Step 4. 디자인 시스템 정리

- 색상 토큰
- 버튼 스타일
- 카드 스타일
- 입력 컴포넌트
- 상태 컴포넌트

### Step 5. 주요 페이지 리디자인

우선순위는 다음과 같다.

1. Landing Page
2. Dashboard
3. Workspace / Editor
4. Result Page
5. Templates Page
6. History / Settings

현재 프로젝트에 존재하지 않는 페이지는 서비스 목적상 필요한 경우에만 추가한다.

### Step 6. 반응형 대응

- 모바일
- 태블릿
- 데스크톱
- 대형 화면

### Step 7. 상태 UI 보강

- Loading
- Empty
- Error
- Success
- Disabled
- Validation

### Step 8. 최종 검증

- 기존 기능 정상 동작 확인
- 라우팅 확인
- API 호출 확인
- 빌드 오류 확인
- 타입 오류 확인
- 접근성 기본 확인
- 모바일 화면 확인

---

## 18. Codex 작업 결과물 요구사항

작업 완료 후 다음 내용을 요약한다.

### 18.1 변경 요약

- 어떤 페이지를 변경했는지
- 어떤 컴포넌트를 추가했는지
- 어떤 컴포넌트를 수정했는지
- 디자인 시스템을 어떻게 정리했는지
- 사용자 흐름이 어떻게 개선되었는지

### 18.2 검증 결과

다음 명령을 실행하고 결과를 보고한다.

```bash
npm run lint
npm run build
npm run test
```

프로젝트에 해당 명령이 없으면 package.json에 있는 실제 명령 기준으로 실행한다.

### 18.3 남은 개선 사항

시간상 구현하지 못한 부분이나 후속 개선이 필요한 부분을 정리한다.

---

## 19. 금지 사항

다음 작업은 하지 않는다.

- 기존 핵심 기능 제거
- API 연동 임의 삭제
- 인증 흐름 임의 변경
- 데이터 구조 대규모 변경
- 의미 없는 애니메이션 남발
- 과도한 그라데이션 / 장식 요소 사용
- 모든 화면을 랜딩 페이지처럼 과장되게 디자인
- 모바일 대응 없는 데스크톱 전용 UI 구현
- 하드코딩된 임시 텍스트 남발
- 접근성 무시
- 빌드 오류가 남은 상태로 작업 종료

---

## 20. 최종 품질 기준

이번 리디자인은 단순히 “예쁘게 꾸미는 작업”이 아니다.  
다음 기준을 만족해야 한다.

- 사용자가 서비스 목적을 빠르게 이해한다.
- 주요 작업까지의 클릭 수가 줄어든다.
- 화면마다 역할이 명확하다.
- CTA가 명확하다.
- 핵심 기능이 더 잘 드러난다.
- MVP 특유의 임시 화면 느낌이 줄어든다.
- 제품형 SaaS처럼 보인다.
- 모바일에서도 사용할 수 있다.
- 코드 구조가 유지보수 가능하다.
- 빌드와 기본 검증을 통과한다.

---

## 21. Claude Code에게 전달할 최종 명령

아래 내용을 기준으로 실제 작업을 시작한다.

```text
현재 MVP 프론트엔드를 전면 리디자인해줘.

먼저 코드베이스를 분석해서 서비스 목적, 주요 사용자 플로우, 현재 페이지 구조, 컴포넌트 구조, 스타일링 방식을 파악해줘.

그 다음 이 서비스와 유사한 AI SaaS / 문서 자동화 / 생산성 도구 / B2B SaaS 서비스들의 일반적인 UI/UX 패턴을 참고해서, 기존 기능을 유지한 채 화면 구조와 디자인을 고도화해줘.

특히 랜딩 페이지, 대시보드, 작업 화면, 결과 화면의 정보 구조와 CTA 흐름을 정리하고, 공통 디자인 시스템과 재사용 가능한 컴포넌트를 만들어줘.

단순히 색상만 바꾸지 말고, 사용자가 서비스를 이해하고 핵심 기능을 실행하기까지의 흐름이 더 명확해지도록 IA, UX flow, layout, component hierarchy, responsive design까지 함께 개선해줘.

작업 후에는 변경 요약, 실행한 검증 명령, 남은 개선 사항을 정리해줘.
```
