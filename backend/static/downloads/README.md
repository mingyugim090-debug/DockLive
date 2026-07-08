# downloads/

배포용 바이너리를 놓는 폴더. `*.exe`는 git에 커밋하지 않는다 (`.gitignore` 참조).

## DockLiveAgent.exe (로컬 Excel 자동화 에이전트)

1. `docklive-inline-agent`에서 `.env`에 `AGENT_PROXY_TOKEN`을 설정 (백엔드와 같은 값).
2. `powershell -File docklive-inline-agent/scripts/build_agent_exe.ps1` 실행 →
   `docklive-inline-agent/dist/DockLiveAgent.exe` 생성.
3. 그 파일을 이 폴더에 `DockLiveAgent.exe`로 복사.
4. 백엔드를 재배포하면 `https://<backend>/downloads/DockLiveAgent.exe`로 서빙된다.

토큰을 교체(rotate)하면 위 과정을 반복해 재빌드·재배포해야 배포판이 계속 동작한다.
