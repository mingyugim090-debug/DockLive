"""사용자 파일 자동 백업 — 불변 규칙 #1의 구현체."""
from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

BACKUP_DIR = Path(__file__).resolve().parents[2] / "workspace" / "backups"


def ensure_backup(path: str) -> Path:
    """원본을 workspace/backups/에 타임스탬프 붙여 복사. 백업 경로를 반환."""
    src = Path(path)
    if not src.exists():
        raise FileNotFoundError(f"파일이 없음: {path}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = BACKUP_DIR / f"{src.stem}_{stamp}{src.suffix}"
    shutil.copy2(src, dst)
    return dst


def restore_backup(backup_path: str, original_path: str) -> None:
    """크래시/오작업 시 백업본으로 원복."""
    shutil.copy2(backup_path, original_path)
