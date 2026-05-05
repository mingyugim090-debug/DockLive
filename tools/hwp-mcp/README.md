# HWP MCP Tool

`tools/hwp-mcp`는 Windows 환경에서 한글(HWP) 프로그램을 제어하기 위한 로컬 MCP helper입니다.

LiveDock 서비스의 핵심 backend는 HWPX export를 우선 목표로 하지만, `.hwp` 변환이나 로컬 한글 프로그램 자동화가 필요할 때 이 도구를 사용할 수 있습니다.

## 구조

```text
tools/hwp-mcp/
  README.md
  hwp_mcp_stdio_server.py      MCP stdio server entrypoint
  requirements.txt             Python dependencies
  src/
    tools/                     HWP controller and table helpers
    utils/                     command parser and utilities
  tests/                       unit tests
  docs/
    architecture.md            internal tool structure notes
  security_module/             Hancom file path checker DLL example
```

## 실행 전제

- Windows
- 한글 프로그램 설치
- Python 3.7+
- `requirements.txt` 의존성 설치

## 설치

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## MCP 연결 예시

`.claude/mcp/hwp-mcp.local.example.json`을 참고해 로컬 MCP client 설정에 등록합니다.

```json
{
  "mcpServers": {
    "hwp": {
      "command": "python",
      "args": ["tools/hwp-mcp/hwp_mcp_stdio_server.py"]
    }
  }
}
```

## 테스트

```powershell
python -m pytest tests
```

## 커밋하지 않는 파일

- `.venv/`
- `__pycache__/`
- `*.log`
- `*.hwp`
- `pytest-cache-files-*/`
