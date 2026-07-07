"""backup.py 단위 테스트 — 원본 보존/복원 계약."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from executor import backup  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_backup_dir(monkeypatch, tmp_path):
    monkeypatch.setattr(backup, "BACKUP_DIR", tmp_path / "backups")


def test_ensure_backup_copies_original(tmp_path):
    src = tmp_path / "원본.xlsx"
    src.write_bytes(b"original-bytes")

    dst = backup.ensure_backup(str(src))

    assert dst.exists()
    assert dst.read_bytes() == b"original-bytes"
    assert dst.name.startswith("원본_") and dst.suffix == ".xlsx"
    assert src.read_bytes() == b"original-bytes"  # 원본은 그대로


def test_ensure_backup_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        backup.ensure_backup(str(tmp_path / "없음.xlsx"))


def test_restore_backup_overwrites_original(tmp_path):
    src = tmp_path / "원본.xlsx"
    src.write_bytes(b"v1")
    dst = backup.ensure_backup(str(src))

    src.write_bytes(b"corrupted")
    backup.restore_backup(str(dst), str(src))

    assert src.read_bytes() == b"v1"
