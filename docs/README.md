# LiveDock Docs

LiveDock은 공고문 분석부터 제출 문서 초안, 사용자 확인, 최종 export까지 이어지는 문서 자동화 Agent 서비스입니다.

## 현재 우선순위

1. 공고문 입력: PDF, URL, 텍스트, 데모 fixture
2. 공고 분석: 일정, 자격, 제출서류, 평가기준, 혜택, 주의사항, 원문 근거
3. 사용자 입력 수집: 초안 작성에 꼭 필요한 정보만 질문
4. 섹션별 초안 작성: 한 번에 완성본을 만들지 않고 항목별로 생성
5. 사용자 확인: 중요한 주장과 불확실 항목은 제출 전 확인
6. 최종 문서 생성: Markdown/HTML/HWPX export
7. HWPX 공식 양식 대응: 템플릿 클로닝과 텍스트 치환

커뮤니티, 추천, 팀 모집, 프로필 기능은 Agent MVP가 안정화된 뒤 확장합니다.

## 주요 문서

- [PRODUCT_PLAN.md](./PRODUCT_PLAN.md): 제품 방향
- [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md): 마일스톤
- [TASKS.md](./TASKS.md): 작업 백로그
- [ARCHITECTURE.md](./ARCHITECTURE.md): 시스템 구조
- [EVALS.md](./EVALS.md): 평가 fixture와 품질 기준
- [SKILLS.md](./SKILLS.md): HWPX 등 Codex skill 사용 방향
- [GEMMA_HWPX_WORKFLOW.md](./GEMMA_HWPX_WORKFLOW.md): Gemma 4, skills, MCP, HWPX export 책임 분리
- [SKILLS_MCP_ARCHITECTURE.md](./SKILLS_MCP_ARCHITECTURE.md): Claude skills와 MCP 운영 구조
- [DEPLOYMENT.md](./DEPLOYMENT.md): 배포 환경

## Agent MVP 원칙

- 공고 원문에 없는 마감일, 자격, 금액, 제출 방법을 조용히 만들지 않습니다.
- 중요한 필드는 가능한 한 source evidence를 남깁니다.
- 불확실한 항목은 `uncertain_fields`와 `confirmation_required`로 사용자 확인을 요구합니다.
- HWPX는 최종 한국어 문서 형식입니다. 생성 후 namespace fix와 validate를 통과해야 준비 완료로 봅니다.
