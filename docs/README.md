# LiveDock Docs

이 폴더는 LiveDock의 제품 방향, 아키텍처, Agent workflow, 평가 fixture, 배포, HWPX export, skills/MCP 운영 문서를 모아 둔 곳입니다.

LiveDock의 현재 목표는 공고문을 분석하고, 필요한 사용자 입력을 모으고, 제출 문서 초안을 만들고, 중요한 주장에 대한 확인을 받은 뒤, HWPX를 포함한 편집 가능한 최종 문서로 export하는 Agent MVP를 안정화하는 것입니다.

## 현재 우선순위

현재 제품 우선순위는 문서 자동화입니다. 커뮤니티, 추천, 팀 모집, 프로필 기능은 Agent MVP가 안정화된 뒤 확장합니다.

Agent MVP의 기준 흐름은 다음과 같습니다.

1. PDF, URL, 붙여넣은 텍스트, 데모 fixture에서 공고를 받습니다.
2. 원문 근거와 함께 요구사항을 추출합니다.
3. 사용자가 추가로 제공해야 하는 자료와 정보를 식별합니다.
4. 정확한 초안 작성에 필요한 정보만 질문합니다.
5. 제출 문서를 섹션 단위로 생성합니다.
6. 중요한 주장에는 `confirmation_required`를 남깁니다.
7. 최종 신청서, 지원서, 공문, 제출 문서를 완성합니다.
8. HWPX를 중심으로 편집 가능한 형식으로 export합니다.

## 문서 범주

### 제품 방향

- [PRODUCT_PLAN.md](./PRODUCT_PLAN.md): 제품 비전, Agent MVP 범위, 장기 방향
- [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md): 마일스톤 단위 개발 계획
- [TASKS.md](./TASKS.md): 현재 작업 백로그와 완료된 작업
- [DESIGNS.md](./DESIGNS.md): UI와 workflow 설계 메모

### 시스템과 개발

- [ARCHITECTURE.md](./ARCHITECTURE.md): 프론트엔드, 백엔드, 저장소, AI, export 구조
- [ENVIRONMENT.md](./ENVIRONMENT.md): 로컬 환경변수와 설정 안내
- [DEPLOYMENT.md](./DEPLOYMENT.md): Vercel 프론트엔드와 Render 백엔드 배포 메모
- [CODEX.md](./CODEX.md): 이 repository에서 Codex를 사용하는 방식
- [AGENT_HARNESS.md](./AGENT_HARNESS.md): Agent harness와 테스트 workflow

### 평가와 fixture

- [EVALS.md](./EVALS.md): 평가 계획과 기대 Agent 동작
- [fixtures/](./fixtures/): 공모전, 장학금, 창업지원, 연구 프로그램, 모호한 공고 fixture

### HWPX, skills, MCP

- [SKILLS.md](./SKILLS.md): 문서 자동화 skill 사용 방향
- [GEMMA_HWPX_WORKFLOW.md](./GEMMA_HWPX_WORKFLOW.md): Gemma, skills, MCP, HWPX export 책임 분리
- [HWP_MCP_GUIDE.md](./HWP_MCP_GUIDE.md): HWP MCP 로컬 설정과 운영 가이드
- [SKILLS_MCP_ARCHITECTURE.md](./SKILLS_MCP_ARCHITECTURE.md): Claude skills와 MCP 구조 정리

### 예시 자료

- [examples/withus_hwpx/](./examples/withus_hwpx/): HWPX 예시 파일과 템플릿 치환 mapping

## Agent MVP 원칙

- 공고 원문에 없는 마감일, 자격, 금액, 기관명, 제출 파일, 제출 방법을 만들지 않습니다.
- 중요한 요구사항에는 source evidence를 남깁니다.
- 애매한 필드는 uncertain 상태로 두고 사용자 확인을 요청합니다.
- 초안은 전체 문서를 한 번에 만들지 않고 섹션 단위로 생성합니다.
- 사용자 검토가 필요한 주장에는 `confirmation_required`를 유지합니다.
- HWPX output은 validate를 통과한 뒤 준비 완료로 봅니다.
