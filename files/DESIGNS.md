# DESIGNS.md — UI/UX 디자인 가이드

> Dock Live 커뮤니티의 전체 화면 구조, 컴포넌트 디자인, 인터랙션 패턴을 정의합니다.
> 개발 시 이 파일을 기준으로 UI를 구현하세요.

---

## 🎨 디자인 방향성

**컨셉:** Instagram 구조 + Linear 감성 + 한국 공공서비스 신뢰감

- 인스타그램처럼 **피드 기반**으로 공고를 소비
- Linear처럼 **다크 테마 + 깔끔한 카드** 레이아웃
- 복잡한 공고문을 **친근하고 읽기 쉽게** 변환

---

## 🖌️ 디자인 시스템

### 컬러 팔레트

```css
:root {
  /* Background */
  --bg:         #0C0C12;   /* 최외곽 배경 */
  --card:       #141420;   /* 기본 카드, 헤더 */
  --card2:      #1C1C2A;   /* 중첩 카드, 입력창 */

  /* Border */
  --border:     rgba(255, 255, 255, 0.07);

  /* Primary */
  --primary:      #7C6FF7;                    /* 메인 액션, 강조 */
  --primary-soft: rgba(124, 111, 247, 0.15);  /* 배지 배경, 호버 */

  /* Accent */
  --accent:     #E8845C;   /* 팀 모집, 보조 강조 */

  /* Status */
  --green:      #4ADE80;   /* safe — D-7 이상 */
  --yellow:     #FBBF24;   /* warning — D-7 이하 */
  --red:        #F87171;   /* danger — D-3 이하 */

  /* Text */
  --text:       #F0F0F8;   /* 주요 텍스트 */
  --text2:      #8888AA;   /* 보조 텍스트 */
  --text3:      #4A4A6A;   /* 비활성, 힌트 */
}
```

### 타이포그래피

```css
font-family: 'Noto Sans KR', sans-serif;

/* 계층별 */
제목 (post-title):   14~15px  font-weight: 600
소제목 (org, label): 12~13px  font-weight: 600
본문 (desc):         12~13px  font-weight: 400
캡션 (meta, time):   10~11px  font-weight: 400  color: var(--text2)
뱃지 (badge, chip):  10~11px  font-weight: 600  (대문자 없음)
```

### 간격 & 반경

```css
/* Border Radius */
카드 (large):   border-radius: 16px ~ 20px
카드 (medium):  border-radius: 12px ~ 14px
뱃지/칩:        border-radius: 6px ~ 8px
아바타 (sq):    border-radius: 10px
아바타 (round): border-radius: 50%
버튼:           border-radius: 8px ~ 14px

/* Padding */
페이지 좌우:   20px
카드 내부:     14px ~ 16px
뱃지 내부:     3px 8px
```

---

## 📱 앱 전체 구조

```
┌─────────────────────────────┐
│         상단 헤더            │  ← 로고 + 알림/메시지 아이콘
├─────────────────────────────┤
│                             │
│          콘텐츠 영역          │  ← 페이지별 다름
│                             │
├─────────────────────────────┤
│       하단 네비게이션         │  ← 5개 탭 (중앙 = 업로드)
└─────────────────────────────┘
```

---

## 🗂️ 화면별 상세 설계

---

### 1. 홈 피드 (/)

**구조:**
```
헤더 (Dock Live 로고 + 🔔 ✉️)
──────────────────────────────
스토리 바 (카테고리 필터)
──────────────────────────────
[공고 카드]
[공고 카드]
[공고 카드]
...
──────────────────────────────
하단 네비
```

**스토리 바**
- 인스타그램 스토리 형태로 카테고리 필터 역할
- 항목: ➕내 공고 / 🏛️정부지원 / 🎨디자인 / 💻IT개발 / 🔬연구과제
- 링 색상: `linear-gradient(135deg, var(--primary), #E8845C)`
- 선택 시 링 두꺼워짐

**공고 카드 구조:**
```
┌─────────────────────────────────────────┐
│  [기관 아이콘]  기관명          [유형 뱃지] │
│               N시간 전                   │
├─────────────────────────────────────────┤
│  공고문 제목 (2줄 이내)                   │
├─────────────────────────────────────────┤
│  ┌─ AI 분석 미리보기 ─────────────────┐  │
│  │  ✦ AI 분석   주요 일정            │  │
│  │  [접수마감 D-3] [서류발표 D-16] ...│  │
│  └───────────────────────────────────┘  │
│                                         │
│  👥 팀원 모집 중 · 2/4명   (있을 때만)   │
├─────────────────────────────────────────┤
│  ❤️ 24    💬 7    🔖 저장    ↗️ 공유   │
└─────────────────────────────────────────┘
```

**AI 분석 미리보기 칩 (타임라인 미니):**
```
┌──────────┐
│ 접수 마감 │  ← t-label (10px, var(--text2))
│  05.15   │  ← t-date  (11px, bold)
│   D-3    │  ← dday 뱃지 (색상: 상태별)
└──────────┘
```

**D-Day 상태별 색상:**
| 상태 | 조건 | 배경 | 텍스트 |
|------|------|------|--------|
| safe | D-8 이상 | `rgba(74,222,128,0.15)` | `#4ADE80` |
| warning | D-4 ~ D-7 | `rgba(251,191,36,0.15)` | `#FBBF24` |
| danger | D-0 ~ D-3 | `rgba(248,113,113,0.15)` | `#F87171` |
| passed | 지남 | `rgba(255,255,255,0.05)` | `#4A4A6A` |

**유형 뱃지 색상:**
| 유형 | 배경 | 텍스트 |
|------|------|--------|
| 공모전 | `rgba(124,111,247,0.15)` | `#B89EFF` |
| 연구과제 | `rgba(59,130,246,0.15)` | `#7DB9FF` |
| 장학금 | `rgba(74,222,128,0.15)` | `#4ADE80` |
| 창업지원 | `rgba(232,132,92,0.15)` | `#F8A87C` |

---

### 2. 팀 찾기 (/team)

**구조:**
```
헤더 (팀 찾기 + ➕ 방 개설)
──────────────────────────────
검색바 (공모전명, 역할로 검색)
──────────────────────────────
필터 칩 (전체 / 디자이너 모집 / 개발자 모집 / 기획자 모집 / D-7 이내)
──────────────────────────────
섹션 타이틀: 모집 중인 팀
[팀 모집 카드]
[팀 모집 카드]
...
──────────────────────────────
하단 네비
```

**팀 모집 방 카드 구조:**
```
┌────────────────────────────────────────┐
│  공모전/대외활동 이름          [D-3 뱃지] │
│                                        │
│  [👤] 팀장 이름  · 학부 N학년           │
│                                        │
│  [🎨 디자이너 1명]  [💻 개발자 1명]     │
│                                        │
│  [●][●][○][○] 2/4명       [참가 신청]  │
└────────────────────────────────────────┘
```

**멤버 도트:**
- 채워진 슬롯: `background: var(--primary-soft)` + `border: 1px solid var(--primary)` (22x22px, radius 6px)
- 빈 슬롯: `background: var(--bg)` + `border: 1px dashed var(--border)` (22x22px, radius 6px)

**참가 신청 버튼:**
```css
background: var(--primary-soft);
color: var(--primary);
border: 1px solid rgba(124,111,247,0.25);
border-radius: 8px;
padding: 5px 12px;
font-size: 12px;
font-weight: 600;

/* 호버 */
background: var(--primary);
color: white;
```

---

### 3. 공고 분석 — 업로드 (중앙 버튼)

**구조:**
```
헤더 (공고 분석)
──────────────────────────────
[업로드 드롭존]
──────────────────────────────
섹션 타이틀: 분석 결과 미리보기
[3단계 스텝 카드]
──────────────────────────────
[PDF 파일 선택 버튼]
──────────────────────────────
하단 네비
```

**업로드 드롭존:**
```css
border: 2px dashed var(--border);
border-radius: 20px;
padding: 40px 20px;
text-align: center;

/* 드래그 오버 시 */
border-color: var(--primary);
background: var(--primary-soft);
```

**3단계 스텝 카드:**
```
┌─────────────────────────────────┐
│  [1]  📅 인터랙티브 타임라인      │
│       마감일·일정을 D-Day 로드맵으로│
├─────────────────────────────────┤
│  [2]  ✅ 서류 준비 체크리스트     │
│       필수·선택 서류 자동 정리    │
├─────────────────────────────────┤
│  [3]  📝 제출 문서 틀 생성       │
│       공고 유형별 문서 구조 제시  │
└─────────────────────────────────┘
```

**스텝 번호 뱃지:**
```css
width: 28px; height: 28px;
border-radius: 8px;
background: var(--primary-soft);
border: 1px solid rgba(124,111,247,0.2);
color: var(--primary);
font-size: 12px; font-weight: 700;
```

**PDF 선택 버튼:**
```css
background: linear-gradient(135deg, #7C6FF7, #B89EFF);
border-radius: 14px;
padding: 14px;
font-size: 15px; font-weight: 700;
color: white;
box-shadow: 0 8px 24px rgba(124,111,247,0.35);
```

---

### 4. 내 프로필 (/profile)

**구조:**
```
헤더 (내 프로필 + ⚙️)
──────────────────────────────
[프로필 상단 — 아바타 + 이름/학부/역할태그]
──────────────────────────────
[통계 — 분석한 공고 | 참여한 팀 | 수상 실적]
──────────────────────────────
섹션 타이틀: 참여 이력
[이력 카드]
[이력 카드]
...
──────────────────────────────
하단 네비
```

**프로필 아바타:**
```css
width: 72px; height: 72px;
border-radius: 20px;
background: linear-gradient(135deg, var(--primary), #E8845C);
```

**역할 태그 (스킬 태그):**
```css
font-size: 11px;
padding: 2px 8px;
border-radius: 6px;
background: var(--primary-soft);
color: #B89EFF;
border: 1px solid rgba(124,111,247,0.2);
```

**통계 섹션:**
- 3개 항목을 동일 비율로 나눔
- 항목 사이 `border-left: 1px solid var(--border)`로 구분
- 숫자: 20px bold / 라벨: 11px var(--text2)

**참여 이력 카드:**
```
┌──────────────────────────────────────┐
│ [이모지]  공모전/활동 이름   [결과 뱃지] │
│           팀 N명 · YYYY.MM           │
└──────────────────────────────────────┘
```

**결과 뱃지:**
| 결과 | 배경 | 텍스트 |
|------|------|--------|
| 수상/선발 | `rgba(74,222,128,0.15)` | `#4ADE80` |
| 결과 대기 | `rgba(251,191,36,0.15)` | `#FBBF24` |
| 미선발 | `rgba(248,113,113,0.15)` | `#F87171` |

---

## 🔻 하단 네비게이션

```
[🏠 홈]  [👥 팀찾기]  [📄 중앙버튼]  [🔍 탐색]  [👤 프로필]
```

**중앙 업로드 버튼:**
```css
width: 46px; height: 46px;
background: linear-gradient(135deg, var(--primary), #B89EFF);
border-radius: 14px;
box-shadow: 0 4px 16px rgba(124,111,247,0.4);
```

**활성 탭:**
```css
.nav-label { color: var(--primary); }
.nav-icon  { transform: scale(1.1); }
```

---

## 🔼 상단 헤더 공통 패턴

```css
/* 헤더 컨테이너 */
padding: 16px 20px 12px;
border-bottom: 1px solid var(--border);
background: var(--card);
position: sticky; top: 0; z-index: 10;

/* 아이콘 버튼 */
width: 34~36px; height: 34~36px;
border-radius: 10px;
background: var(--card2);
border: 1px solid var(--border);
```

---

## ✨ 인터랙션 & 애니메이션

| 요소 | 인터랙션 |
|------|----------|
| 공고 카드 | hover → `background: rgba(255,255,255,0.02)` |
| 팀 모집 카드 | hover → `border-color: rgba(124,111,247,0.3)` + `background: rgba(124,111,247,0.05)` |
| 업로드 드롭존 | dragover → `border-color: var(--primary)` + `background: var(--primary-soft)` |
| 참가 신청 버튼 | hover → `background: var(--primary)` + `color: white` |
| 스토리 링 | hover → `transform: scale(1.08)` |
| 중앙 업로드 버튼 | hover → `transform: scale(1.05)` + 글로우 강화 |
| 페이지 전환 | `transition: all 0.2s` 기본 적용 |

**Framer Motion 애니메이션 (페이지/리스트):**
```typescript
// 페이지 진입
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  exit:    { opacity: 0, y: -16 }
};

// 리스트 아이템 순차 등장
const itemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.2 }
  })
};
```

---

## 📐 레이아웃 규칙

- **모바일 우선** (375px 기준 설계)
- 콘텐츠 좌우 패딩: `20px` (헤더/스토리) / `16px` (카드)
- 카드 간격: `margin-bottom: 12px`
- 피드 카드는 구분선(`border-bottom: 1px solid var(--border)`)으로 분리
- 스크롤바 숨김: `::-webkit-scrollbar { display: none; }`
- 하단 네비 높이 고려한 페이지 하단 패딩: `padding-bottom: 80px`

---

## 🗺️ v1.0 → v2.0 화면 확장 계획

| 화면 | v1.0 | v2.0 |
|------|------|------|
| 홈 피드 | 공고 변환 결과 카드 | 커뮤니티 피드 (공유된 공고) |
| 팀 찾기 | - | ✅ 팀 모집 방 목록 |
| 공고 분석 | ✅ PDF 업로드 → 3단계 변환 | 분석 결과 → 피드에 공유 |
| 탐색 | - | 카테고리별 공고 탐색 |
| 프로필 | - | ✅ 참여 이력, 수상, 역할 태그 |
| 방 상세 | - | 팀원 목록, AI 분석 결과 공유, 오픈카톡 링크 |
