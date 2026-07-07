"""트레이 상주 실행기 (Phase 5) — 로컬 서버를 백그라운드로 켠 채 트레이 아이콘으로 관리.

사용: python src/tray.py
- 시작 시 uvicorn 서버(127.0.0.1:8765)를 데몬 스레드로 기동
- 트레이 메뉴: 상태 표시 / 종료
"""
from __future__ import annotations

import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

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
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


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
    main()
