"""한글 자동화 보안 모듈(FilePathCheckerModule) 레지스트리 등록.

최초 1회 실행 (Windows 전용). 등록해야 파일 열기/저장 시 보안 팝업이 뜨지 않는다.
DLL은 한컴 개발자 사이트의 FilePathCheckerModuleExample.dll 을 사용하거나
사내 서명 DLL 경로로 교체할 것.
"""
from __future__ import annotations

import sys
from pathlib import Path

MODULE_NAME = "FilePathCheckerModule"


def main() -> int:
    if sys.platform != "win32":
        print("Windows 전용 스크립트입니다.")
        return 1
    import winreg  # noqa: PLC0415

    if len(sys.argv) < 2:
        print("사용법: python scripts/register_hwp_module.py <FilePathCheckerModule.dll 절대경로>")
        return 1
    dll = Path(sys.argv[1]).resolve()
    if not dll.exists():
        print(f"DLL이 없음: {dll}")
        return 1

    key_path = r"Software\HNC\HwpAutomation\Modules"
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, key_path) as key:
        winreg.SetValueEx(key, MODULE_NAME, 0, winreg.REG_SZ, str(dll))
    print(f"등록 완료: HKCU\\{key_path}\\{MODULE_NAME} = {dll}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
