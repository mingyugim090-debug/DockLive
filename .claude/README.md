# LiveDock Local Agent Setup

이 폴더는 LiveDock workflow에 맞춘 로컬 Agent 설정을 보관합니다.

서비스 런타임 코드가 아니라, Codex/Claude가 HWPX 문서 자동화 작업을 수행할 때 참고하는 local skills와 MCP 예시 설정입니다.

## 구조

```text
.claude/
  README.md
  skills/      LiveDock Agent/HWPX workflow skills
  mcp/         HWP MCP local server 설정 예시
```

## Skills

- `livedock-agent-mvp`: 공고 분석부터 제출 문서 생성까지의 Agent MVP 원칙
- `livedock-hwpx-intake`: HWPX 입력 파일 분석과 구조 파악
- `livedock-hwpx-content`: HWPX 필드/섹션 content mapping 생성
- `livedock-hwpx-export`: HWPX 템플릿 클로닝과 export
- `livedock-hwpx-validate`: namespace fix, validation, 구조 검증
- `livedock-hwp-mcp-local`: Windows 한글 프로그램 자동화 MCP helper

## MCP

`.claude/mcp/hwp-mcp.local.example.json`은 로컬 Windows 환경에서 `tools/hwp-mcp/hwp_mcp_stdio_server.py`를 연결하는 예시입니다.
