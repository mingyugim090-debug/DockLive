import argparse
import os
import re
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
SITE_PACKAGES = BACKEND / "venv" / "Lib" / "site-packages"
for path in (str(BACKEND), str(SITE_PACKAGES)):
    if path not in sys.path:
        sys.path.insert(0, path)

from models.schemas import FinalDocument  # noqa: E402
from services.analyzer import build_analysis_result  # noqa: E402
from services.drafting_service import clone_hwpx_template, create_workflow_session  # noqa: E402
from core.config import settings  # noqa: E402


def _cells(section_xml: str) -> list[str]:
    return re.findall(r"<hp:tc[\s\S]*?</hp:tc>", section_xml)


def _replace_cell_text(cell_xml: str, text: str) -> str:
    escaped = escape(text)
    if re.search(r"<hp:run([^>/]*)/>", cell_xml):
        return re.sub(
            r"<hp:run([^>/]*)/>",
            rf"<hp:run\1><hp:t>{escaped}</hp:t></hp:run>",
            cell_xml,
            count=1,
        )
    return re.sub(
        r"<hp:t>[\s\S]*?</hp:t>",
        f"<hp:t>{escaped}</hp:t>",
        cell_xml,
        count=1,
    )


def _cell_replacements(source_path: Path) -> dict[str, str]:
    with zipfile.ZipFile(source_path, "r") as zf:
        section_xml = zf.read("Contents/section0.xml").decode("utf-8")
    cells = _cells(section_xml)

    values = {
        3: "축구동아리 지원서",
        6: "■ 축구동아리  □ 공모전  □ 연구",
        8: "LiveDock FC",
        12: "인문사회대학",
        14: "스포츠문화학과",
        16: "20261234",
        18: "홍길동",
        20: "soccer.club@example.com",
        22: "010-1234-5678",
        26: "인문사회대학",
        28: "스포츠문화학과",
        30: "20260001",
        32: "김민수",
        34: (
            "LiveDock FC는 축구를 매개로 학생들의 협업, 체력 증진, 경기 운영 역량을 기르는 동아리입니다. "
            "정기 훈련과 친선전을 통해 건강한 학교 문화를 만들고, 신입 부원의 참여 장벽을 낮춘 공개 훈련을 운영하고자 지원합니다."
        ),
        37: (
            "정기 훈련과 경기 분석을 통해 기초 체력, 전술 이해, 팀 커뮤니케이션을 높입니다. "
            "2026년 교내 풋살 리그와 지역 대학 친선전에 참가하고, 경기 기록을 활동 보고서로 정리합니다."
        ),
        39: (
            "주 2회 훈련을 기본으로 하고 월 1회 친선전을 진행합니다. "
            "훈련은 준비운동, 기본기, 전술 훈련, 미니게임, 피드백 순서로 운영합니다."
        ),
        41: (
            "활동비 60만원은 공용 축구공, 팀 조끼, 구급용품, 훈련 장소 대관에 사용합니다. "
            "추가활동비 40만원은 교내외 대회 참가비와 경기 운영 물품 구입에 사용합니다."
        ),
        46: "6월~8월",
        47: "신입 부원 모집, 기초 체력 측정, 패스/슈팅 기본기 훈련, 포지션별 역할 이해",
        48: "주 2회 정기 훈련, 조별 미니게임, 경기 영상 피드백",
        49: "9월~11월",
        50: "교내 풋살 리그 참가, 지역 대학 친선전, 활동 결과 보고서 작성",
        51: "실전 경기 운영, 주장단 회의, 월별 회고와 개선 과제 정리",
    }

    replacements: dict[str, str] = {}
    for index, value in values.items():
        old = cells[index - 1]
        replacements[old] = _replace_cell_text(old, value)
    return replacements


def _workflow():
    raw = {
        "doc_type": "competition",
        "title": "축구동아리 지원서",
        "organization": "서울과학기술대학교 교수학습개발센터",
        "summary": "축구동아리 운영 계획과 지원금 사용 계획을 포함한 동아리 참여 신청서입니다.",
        "timeline": [],
        "checklist": [{"label": "동아리 지원서", "category": "required", "description": "HWPX 양식", "file_format": "HWPX"}],
        "document_sections": [
            {"title": "동아리 정보", "hint": "동아리명과 구분", "order": 1},
            {"title": "대표 인적사항", "hint": "대표자 정보", "order": 2},
            {"title": "활동계획서", "hint": "목표, 운영방법, 예산, 월별 계획", "order": 3},
        ],
        "uncertain_fields": [],
        "source_evidence": [{"field": "template", "quote": "참여 신청서 (공모전/연구동아리)", "page": 1}],
    }
    workflow = create_workflow_session(build_analysis_result(raw, source_type="demo", source_name="withUS HWPX template"))
    workflow.final_document = FinalDocument(
        title="축구동아리 지원서",
        content_markdown=(
            "# 축구동아리 지원서\n\n"
            "LiveDock FC는 정기 훈련, 친선전, 교내 풋살 리그 참가를 중심으로 운영되는 축구동아리입니다."
        ),
        created_at="2026-05-05T00:00:00Z",
    )
    workflow.status = "finalized"
    return workflow


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a soccer club HWPX application from a provided withUS template.")
    parser.add_argument("--source", required=True, help="Source .hwpx template")
    parser.add_argument("--output", required=True, help="Output .hwpx path")
    parser.add_argument("--skill-dir", default=str(Path.home() / ".codex" / "skills" / "hwpx"))
    args = parser.parse_args()

    source = Path(args.source)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir = output.parent / "_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    os.environ["TEMP"] = str(tmp_dir)
    os.environ["TMP"] = str(tmp_dir)
    tempfile.tempdir = str(tmp_dir)

    settings.HWPX_EXPORT_ENABLED = True
    settings.HWPX_SKILL_DIR = args.skill_dir

    keywords = {
        "2026 년     월     일": "2026년 5월 5일",
        "동아리 대표 : 0 0 0 (서명 또는 인)": "동아리 대표 : 홍길동 (서명 또는 인)",
    }
    filename, content = clone_hwpx_template(
        source.read_bytes(),
        _workflow(),
        replacements=_cell_replacements(source),
        keywords=keywords,
    )
    output.write_bytes(content)
    print(f"generated={output}")
    print(f"service_filename={filename}")


if __name__ == "__main__":
    main()
