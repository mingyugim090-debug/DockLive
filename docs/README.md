# LiveDock Docs

이 폴더는 LiveDock의 제품 방향, 아키텍처, Agent workflow, 평가 fixture, 배포, HWPX export, skills/MCP 운영 문서를 범주별로 보관합니다.

현재 목표는 공고문을 분석하고, 필요한 사용자 입력을 모으고, 제출 문서 초안을 만들고, 중요한 주장에 대한 확인을 받은 뒤, HWPX를 포함한 편집 가능한 최종 문서로 export하는 Agent MVP를 안정화하는 것입니다.

## 문서 구조

```text
docs/
  README.md
  product/       제품 방향, 개발 계획, 작업 목록, 디자인 메모
    archive/     이전 디자인 요청과 사용하지 않는 UI 초안 보관
  engineering/   시스템 아키텍처, 환경변수, 배포, Codex 운영
  agent/         Agent harness, skills, MCP workflow
  hwpx/          HWPX export, Gemma, HWP MCP 가이드
  evaluation/    평가 기준과 공고 fixture
  examples/      HWPX 예시 산출물과 mapping
```

## 제품 방향

- [product/product-plan.md](./product/product-plan.md): 제품 비전, Agent MVP 범위, 장기 방향
- [product/development-plan.md](./product/development-plan.md): 마일스톤 단위 개발 계획
- [product/tasks.md](./product/tasks.md): 현재 작업 백로그와 완료된 작업
- [product/designs.md](./product/designs.md): UI와 workflow 설계 메모
- [product/archive/](./product/archive/): 이전 프론트엔드 디자인 참고와 사용하지 않는 랜딩 컴포넌트 보관

## 시스템과 개발

- [engineering/architecture.md](./engineering/architecture.md): 프론트엔드, 백엔드, 저장소, AI, export 구조
- [engineering/environment.md](./engineering/environment.md): 로컬 환경변수와 설정 안내
- [engineering/deployment.md](./engineering/deployment.md): Vercel 프론트엔드와 Render 백엔드 배포 메모
- [engineering/codex.md](./engineering/codex.md): 이 repository에서 Codex를 사용하는 방식
- [engineering/insforge.md](./engineering/insforge.md): InsForge SDK/MCP 규칙

## Agent, Skills, MCP

- [agent/agent-harness.md](./agent/agent-harness.md): Agent harness와 테스트 workflow
- [agent/skills.md](./agent/skills.md): 문서 자동화 skill 사용 방향
- [agent/skills-mcp-architecture.md](./agent/skills-mcp-architecture.md): Claude skills와 MCP 구조 정리
- [../harness/](../harness/): 실행 가능한 하네스 state spec, quality gates, error memory

## HWPX

- [hwpx/gemma-hwpx-workflow.md](./hwpx/gemma-hwpx-workflow.md): Gemma, skills, MCP, HWPX export 책임 분리
- [hwpx/hwp-mcp-guide.md](./hwpx/hwp-mcp-guide.md): HWP MCP 로컬 설정과 운영 가이드

## 평가와 예시

- [evaluation/evals.md](./evaluation/evals.md): 평가 계획과 기대 Agent 동작
- [evaluation/fixtures/](./evaluation/fixtures/): 공모전, 장학금, 창업지원, 연구 프로그램, 모호한 공고 fixture
- [examples/withus-hwpx/](./examples/withus-hwpx/): HWPX 예시 파일과 템플릿 치환 mapping

## Agent MVP 원칙

- 공고 원문에 없는 마감일, 자격, 금액, 기관명, 제출 파일, 제출 방법을 만들지 않습니다.
- 중요한 요구사항에는 source evidence를 남깁니다.
- 애매한 필드는 uncertain 상태로 두고 사용자 확인을 요청합니다.
- 초안은 전체 문서를 한 번에 만들지 않고 섹션 단위로 생성합니다.
- 사용자 검토가 필요한 주장에는 `confirmation_required`를 유지합니다.
- HWPX output은 validate를 통과한 뒤 준비 완료로 봅니다.
