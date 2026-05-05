# LiveDock Tools

이 폴더는 LiveDock 서비스 개발과 문서 자동화를 돕는 로컬 보조 도구를 보관합니다.

서비스 런타임 핵심 코드는 `frontend/`와 `backend/`에 있고, `tools/`는 개발자 또는 Agent가 로컬에서 사용하는 helper 영역입니다.

## 구조

```text
tools/
  README.md
  hwp-mcp/      Windows HWP 자동화 MCP 서버
```

## 원칙

- 서비스 배포 코드와 로컬 자동화 도구를 분리합니다.
- 도구별 README와 tests를 도구 폴더 안에 둡니다.
- `.venv`, log, cache, generated files는 커밋하지 않습니다.
