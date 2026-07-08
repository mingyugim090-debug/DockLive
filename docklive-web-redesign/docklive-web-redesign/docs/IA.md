# IA — 정보 구조 개편

## Before → After

| 현재 섹션 | 개편 후 |
|---|---|
| Workspace | **프로젝트 상세** (파이프라인 화면)로 흡수 |
| 문서 프로젝트 | **프로젝트 목록** (홈)으로 승격 |
| Document | 프로젝트 상세의 산출물 탭으로 흡수 (별도 섹션 폐지) |
| 공고 스튜디오 | 프로젝트 **1단계(공고 입력)**로 흡수 |
| Templates | **4단계(양식 선택)** 내 "템플릿에서 선택" 탭으로 흡수 |
| Billing | 우측 상단 계정 메뉴 항목 |
| Settings | 우측 상단 계정 메뉴 항목 |

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

## 리다이렉트 표 (기존 URL → 새 URL, 301)

| 기존 | 새 |
|---|---|
| /app/workspace | /app (또는 마지막 프로젝트 /app/p/:id) |
| /app/projects | /app |
| /app/documents, /app/documents/:id | /app, /app/p/:id 산출물 탭 |
| /app/studio (공고 스튜디오) | /app/new |
| /app/templates | /app/new?mode=form (4단계 직행) |
| /app/billing, /app/settings | /account/billing, /account/settings |

실제 기존 라우트는 레포에서 확인 후 이 표를 갱신할 것 (위는 추정 경로).

## 폐지 판단 기준
"이 화면이 없으면 공고→제출본 파이프라인이 멈추는가?" — 아니오면 폐지 후보.
폐지 시: legacy/ 이동 → 리다이렉트 등록 → 2주 사용량 확인 후 제거.
