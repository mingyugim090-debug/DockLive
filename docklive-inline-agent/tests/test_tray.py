"""tray.py 단위 테스트 — 아이콘 이미지 생성만 검증 (트레이 자체는 GUI 통합)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

pytest.importorskip("PIL")

import tray  # noqa: E402


def test_make_icon_image_size_and_mode():
    img = tray.make_icon_image(64)
    assert img.size == (64, 64)
    assert img.mode == "RGB"


def test_make_icon_image_uses_brand_green_background():
    img = tray.make_icon_image(32)
    # 모서리는 배경색(브랜드 그린)이어야 한다.
    r, g, b = img.getpixel((1, 1))
    assert (r, g, b) == (0x24, 0x5D, 0x50)
