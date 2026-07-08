from __future__ import annotations

import os
import shutil
import stat
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
BUILD_DIR = ROOT / "dist" / "macos-bootstrap"
APP_DIR = BUILD_DIR / "DockLiveAgent.app"
RESOURCES = APP_DIR / "Contents" / "Resources"
AGENT_DIR = RESOURCES / "agent"
EXECUTABLE = APP_DIR / "Contents" / "MacOS" / "DockLiveAgent"
OUTPUT = ROOT / "dist" / "DockLiveAgent-mac.zip"


def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(
        src,
        dst,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", "workspace", "dist", "build"),
    )


def write_text(path: Path, content: str, executable: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    if executable:
        path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def zip_app(app_dir: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(app_dir.rglob("*")):
            rel = path.relative_to(app_dir.parent).as_posix()
            info = zipfile.ZipInfo(rel + ("/" if path.is_dir() else ""))
            mode = path.stat().st_mode
            info.external_attr = (mode & 0o777) << 16
            if path.is_dir():
                zf.writestr(info, b"")
            else:
                zf.writestr(info, path.read_bytes())


def main() -> None:
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)

    (APP_DIR / "Contents" / "MacOS").mkdir(parents=True, exist_ok=True)
    copy_tree(ROOT / "src", AGENT_DIR / "src")
    shutil.copy2(ROOT / "requirements.txt", AGENT_DIR / "requirements.txt")
    env_path = ROOT / ".env"
    if env_path.exists():
        shutil.copy2(env_path, AGENT_DIR / ".env")

    write_text(
        APP_DIR / "Contents" / "Info.plist",
        """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>DockLive Agent</string>
  <key>CFBundleExecutable</key>
  <string>DockLiveAgent</string>
  <key>CFBundleIdentifier</key>
  <string>site.insforge.trgf5yzm.docklive.agent</string>
  <key>CFBundleName</key>
  <string>DockLiveAgent</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
</dict>
</plist>
""",
    )

    write_text(
        EXECUTABLE,
        """#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/../Resources/agent" && pwd)"
cd "$APP_ROOT"

notify() {
  /usr/bin/osascript -e "display notification \"$1\" with title \"DockLive Agent\"" >/dev/null 2>&1 || true
}

fail_dialog() {
  /usr/bin/osascript -e "display dialog \"$1\" with title \"DockLive Agent\" buttons {\"OK\"} default button \"OK\"" >/dev/null 2>&1 || true
  exit 1
}

if ! command -v python3 >/dev/null 2>&1; then
  fail_dialog "Python 3가 필요합니다. python.org 또는 Homebrew로 Python 3를 설치한 뒤 다시 실행해 주세요."
fi

if [ ! -d ".venv" ]; then
  notify "첫 실행 준비 중입니다. 잠시만 기다려 주세요."
  python3 -m venv .venv || fail_dialog "가상환경을 만들 수 없습니다."
  .venv/bin/python -m pip install --upgrade pip >/dev/null 2>&1 || fail_dialog "pip를 업데이트할 수 없습니다."
  .venv/bin/python -m pip install -r requirements.txt >/dev/null 2>&1 || fail_dialog "Agent 의존성을 설치할 수 없습니다. 네트워크 연결을 확인해 주세요."
fi

notify "Agent를 시작합니다."
exec .venv/bin/python src/tray.py
""",
        executable=True,
    )

    write_text(
        RESOURCES / "README_FIRST.txt",
        """DockLive Agent for macOS

1. DockLiveAgent.app을 Applications 또는 원하는 폴더로 옮깁니다.
2. 앱을 엽니다.
3. macOS가 확인되지 않은 개발자 경고를 표시하면 시스템 설정 > 개인정보 보호 및 보안에서 열기를 허용합니다.
4. 메뉴 막대에 DockLive Agent가 뜨면 DockLive 웹 화면에서 다시 확인을 누릅니다.

이 bootstrap 패키지는 첫 실행 때 Python 의존성을 설치합니다. 정식 무경고 배포에는 Apple Developer ID 서명과 notarization이 필요합니다.
""",
    )

    zip_app(APP_DIR, OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
