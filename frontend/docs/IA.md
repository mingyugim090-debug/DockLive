# IA — 정보 구조 개편

## Before → After

| 현재 섹션 | 개편 후 |
|---|---|
| Workspace (`/app`) | **4~6단계**로 흡수 (HWPX 양식 작성 + 초안 + export) |
| 문서 프로젝트 (`/app/projects`) | **프로젝트 목록** (홈)으로 승격 |
| Document (`/app/documents`) | 프로젝트 상세의 산출물 탭으로 흡수 (별도 섹션 폐지) |
| 공고 스튜디오 (`/app/agency`) | 프로젝트 **1단계(공고 입력)**로 흡수 |
| Templates (`/app/templates`) | **4단계(양식 선택)** 내 "템플릿에서 선택" 탭으로 흡수 |
| Billing (`/app/billing`) | 우측 상단 계정 메뉴 항목 |
| Settings (`/app/settings`) | 우측 상단 계정 메뉴 항목 |

사이드바 = 로고 + "새 프로젝트" 버튼 + 프로젝트 목록(상태 배지 포함) + 하단 계정.
그 외 어떤 네비게이션 항목도 두지 않는다.

## 라우트 맵 (개편 후)

```
/                          → 랜딩
/app                       → 프로젝트 목록 (비어있으면 새 프로젝트 시작 화면)
/app/new                   → 새 프로젝트: "공고 붙여넣기" 단일 입력 (+ "양식만 채우기" 링크)
/app/p/:id                 → 프로젝트 상세 (현재 단계로 자동 이동)
/app/p/:id/1-notice        → 1 공고 입력
/app/p/:id/2-analysis      → 2 요구사항 분석 (근거 카드)
/app/p/:id/3-questions     → 3 확인 질문
/app/p/:id/4-form          → 4 양식 업로드/템플릿 + 슬롯 매핑
/app/p/:id/5-draft         → 5 항목별 작성 (2패널 캔버스)
/app/p/:id/6-export        → 6 무결성 검사 + export
/account/billing, /account/settings
```

## 리다이렉트 표 (기존 URL → 새 URL, 301) — 실측 갱신 완료 (2026-07-08)

레포 실측 라우트 기준. Phase A 동안 기존 화면은 아래 "이행 경로"로 접근 가능하며,
301 적용은 Phase C에서 일괄 수행한다.

| 기존 (실측) | 새 | 비고 |
|---|---|---|
| `/app` (구 Workspace 6단계 화면) | `/app` = 프로젝트 목록. 구 화면은 `/app/workspace`로 이동 | Phase A에서 이동, Phase B에서 4~6단계로 흡수 |
| `/app/workspace` (이행 경로) | `/app/p/:id/4-form` 흡수 후 legacy | Phase C |
| `/app/projects` (문서 프로젝트) | `/app` | 워크스페이스 실험 화면 — 목록으로 통합 |
| `/app/agency` (공고 스튜디오) | `/app/new` | 1~3단계로 이식 |
| `/app/documents` | `/app` | 산출물 탭으로 흡수 |
| `/app/documents/:id` | `/app/p/:id/6-export` | 산출물 = 6단계 export 이력 |
| `/app/templates` | `/app/new?mode=form` | 4단계 직행 |
| `/app/history` | `/app` | 다운로드 이력 = 산출물 탭 |
| `/app/upload` | `/app/new` | 업로드 = 공고 입력 |
| `/app/billing` | `/account/billing` | 계정 메뉴 |
| `/app/settings` | `/account/settings` | 계정 메뉴 |
| `/dashboard` | `/app` | 구 대시보드 |
| `/hwpx` | `/app/new?mode=form` | 독립 HWPX 양식 화면 → 4단계 직행 |
| `/result/:id` | `/app/p/:id/2-analysis` | 분석 결과 = 2단계 |
| `/auth`, `/app/payments/success`, `/app/payments/fail` | 유지 | 인증·결제 콜백은 파이프라인 외부 |

## 폐지 판단 기준
"이 화면이 없으면 공고→제출본 파이프라인이 멈추는가?" — 아니오면 폐지 후보.
폐지 시: legacy/ 이동 → 리다이렉트 등록 → 2주 사용량 확인 후 제거.
