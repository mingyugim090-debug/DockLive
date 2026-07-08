"""트레이 상주 실행기 (Phase 5) — 로컬 서버를 백그라운드로 켠 채 트레이 아이콘으로 관리.

사용: python src/tray.py
- 시작 시 uvicorn 서버(127.0.0.1:8765)를 데몬 스레드로 기동
- 트레이 메뉴: 상태 표시 / 종료
"""
from __future__ import annotations

import os
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def _log_path() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("TMPDIR") or str(Path.home())
    log_dir = Path(base) / "DockLiveAgent"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / "agent.log"


def _ensure_std_streams() -> None:
    """pythonw.exe / --windowed 환경에서는 sys.stdout·stderr가 None이라
    uvicorn 로깅 등이 첫 로그에서 크래시한다(서버 스레드 조용히 사망).
    로그 파일로 리다이렉트해 안정화하고, 동시에 진단 로그를 확보한다."""
    if sys.stdout is not None and sys.stderr is not None:
        return
    stream = open(_log_path(), "a", encoding="utf-8", buffering=1)
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream


_ensure_std_streams()

from server import HOST, PORT, app  # noqa: E402

BRAND_GREEN = "#245D50"
BRAND_SOFT = "#EDF7F2"


def make_icon_image(size: int = 64):
    """DockLive 그린 배경에 'D'를 그린 트레이 아이콘 이미지."""
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (size, size), BRAND_GREEN)
    draw = ImageDraw.Draw(img)
    # 외곽 라운드 느낌의 밝은 사각 테두리 + 문자 D
    margin = size // 8
    draw.rectangle([margin, margin, size - margin, size - margin], outline=BRAND_SOFT, width=max(2, size // 24))
    draw.text((size * 0.36, size * 0.26), "D", fill=BRAND_SOFT)
    return img


def _run_server() -> None:
    import traceback

    import uvicorn

    try:
        # log_config=None: uvicorn 기본 로깅(ext://sys.stderr 핸들러)이 무콘솔 환경에서
        # 크래시하는 것을 피하고, 상위에서 리다이렉트한 스트림만 사용한다.
        uvicorn.run(app, host=HOST, port=PORT, log_level="warning", log_config=None)
    except Exception:
        # 서버 스레드가 죽어도 트레이는 남으므로, 원인을 로그에 남겨 진단 가능하게.
        traceback.print_exc()


def main() -> None:
    import pystray

    server_thread = threading.Thread(target=_run_server, name="agent-server", daemon=True)
    server_thread.start()

    icon = pystray.Icon(
        "docklive-inline-agent",
        make_icon_image(),
        "DockLive Inline Agent",
        menu=pystray.Menu(
            pystray.MenuItem(f"실행 중 — {HOST}:{PORT}", None, enabled=False),
            pystray.MenuItem("종료", lambda icon, item: icon.stop()),
        ),
    )
    icon.run()  # 블로킹. 종료 메뉴 → 프로세스 종료 (서버는 데몬 스레드라 함께 내려감)


if __name__ == "__main__":
    import traceback

    try:
        main()
    except Exception:
        traceback.print_exc()
        raise
