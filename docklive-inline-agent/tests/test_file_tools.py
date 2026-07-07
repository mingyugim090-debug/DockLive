"""file_tools 단위 테스트 — 문서 파싱 계약과 관련 섹션 추출 (Phase 4)."""
import sys
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from tools import file_tools  # noqa: E402

HWPX_SECTION = """<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">
  <hp:p><hp:run><hp:t>2026년 지원사업 공고</hp:t></hp:run></hp:p>
  <hp:p><hp:run><hp:t>지원 대상: 중소기업</hp:t></hp:run></hp:p>
  <hp:p><hp:run><hp:t></hp:t></hp:run></hp:p>
</hs:sec>
"""


def test_read_document_missing_file():
    out = file_tools.read_document("C:/없는문서.hwpx")
    assert out["ok"] is False and "파일이 없음" in out["error"]


def test_read_document_unknown_suffix(tmp_path):
    p = tmp_path / "자료.pptx"
    p.write_bytes(b"x")
    out = file_tools.read_document(str(p))
    assert out["ok"] is False and "지원하지 않는" in out["error"]


def test_read_hwpx_extracts_paragraphs(tmp_path):
    p = tmp_path / "공고.hwpx"
    with zipfile.ZipFile(p, "w") as zf:
        zf.writestr("Contents/section0.xml", HWPX_SECTION)
    out = file_tools.read_document(str(p))
    assert out["ok"] is True
    assert out["data"]["paragraphs"] == ["2026년 지원사업 공고", "지원 대상: 중소기업"]


def test_read_docx_extracts_paragraphs_and_tables(tmp_path):
    docx = pytest.importorskip("docx")
    document = docx.Document()
    document.add_paragraph("사업 개요입니다.")
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "예산"
    table.rows[0].cells[1].text = "5000만원"
    p = tmp_path / "계획서.docx"
    document.save(str(p))

    out = file_tools.read_document(str(p))
    assert out["ok"] is True
    assert "사업 개요입니다." in out["data"]["paragraphs"]
    assert "예산 | 5000만원" in out["data"]["paragraphs"]


def test_read_pdf_without_text_reports_error(tmp_path):
    pypdf = pytest.importorskip("pypdf")
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=200, height=200)
    p = tmp_path / "스캔본.pdf"
    with p.open("wb") as f:
        writer.write(f)

    out = file_tools.read_document(str(p))
    assert out["ok"] is False and "추출하지 못함" in out["error"]


class TestRelevantExcerpt:
    PARAGRAPHS = [
        "1. 사업 개요: 지역 중소기업 지원",
        "2. 지원 대상: 업력 7년 이내 중소기업",
        "3. 예산: 총 9억원, 기업당 5000만원 한도",
        "4. 문의처: 02-1234-5678",
    ]

    def test_keyword_match_keeps_relevant_paragraphs_in_order(self):
        excerpt = file_tools.relevant_excerpt(self.PARAGRAPHS, "지원 대상과 예산 알려줘")
        assert "지원 대상" in excerpt
        assert "예산" in excerpt
        assert "문의처" not in excerpt
        # 원문 순서 유지
        assert excerpt.index("지원 대상") < excerpt.index("예산: 총")

    def test_empty_request_falls_back_to_document_head(self):
        excerpt = file_tools.relevant_excerpt(self.PARAGRAPHS, "", max_chars=40)
        assert excerpt.startswith("1. 사업 개요")
        assert len(excerpt) <= 40

    def test_budget_limits_total_size(self):
        paragraphs = [f"예산 항목 {i} " + "내용" * 50 for i in range(50)]
        excerpt = file_tools.relevant_excerpt(paragraphs, "예산", max_chars=500)
        assert len(excerpt) <= 500
