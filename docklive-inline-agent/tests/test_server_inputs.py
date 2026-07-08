"""server.py 요청 구성 단위 테스트 — 저장 폴더 정규화와 업로드 저장."""
import base64
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

pytest.importorskip("fastapi")

import server  # noqa: E402


class TestNormalizeOutputDir:
    def test_folder_path_unchanged(self, tmp_path):
        assert server._normalize_output_dir(str(tmp_path)) == str(tmp_path)

    def test_file_path_falls_back_to_parent(self, tmp_path):
        file_path = tmp_path / "견적서양식.xlsx"
        file_path.write_bytes(b"PK")
        assert server._normalize_output_dir(str(file_path)) == str(tmp_path)

    def test_nonexistent_path_with_suffix_uses_parent(self, tmp_path):
        assert server._normalize_output_dir(str(tmp_path / "결과.xlsx")) == str(tmp_path)

    def test_quotes_are_stripped(self, tmp_path):
        assert server._normalize_output_dir(f'"{tmp_path}"') == str(tmp_path)

    def test_empty_returns_empty(self):
        assert server._normalize_output_dir("") == ""


class TestBuildRequestWithUploads:
    def test_output_dir_pointing_at_file_still_materializes_uploads(self, tmp_path):
        blocker = tmp_path / "견적서양식.xlsx"
        blocker.write_bytes(b"PK")
        payload = {
            "request": "지역별로 차트로 정리해줘",
            "output_dir": str(blocker),  # 사용자가 파일 경로를 붙여넣은 실수
            "source_uploads": [
                {
                    "name": "목록.xlsx",
                    "content_base64": base64.b64encode(b"PK-upload").decode(),
                }
            ],
        }
        built = server._build_request(payload)
        assert built.output_dir == str(tmp_path)
        materialized = Path(built.source_files[0])
        assert materialized.exists()
        assert materialized.parent == tmp_path / server._UPLOAD_INPUT_DIR
        assert built.mode == "excel"

    def test_invalid_base64_is_value_error(self, tmp_path):
        payload = {
            "request": "정리해줘",
            "output_dir": str(tmp_path),
            "source_uploads": [{"name": "a.xlsx", "content_base64": "%%%"}],
        }
        with pytest.raises(ValueError):
            server._build_request(payload)
