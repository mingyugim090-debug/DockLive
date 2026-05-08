import html
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from pathlib import Path
from xml.etree import ElementTree
from xml.sax.saxutils import escape

from core.config import settings
from core.errors import AnalysisError
from services.ai_provider import call_json, provider_name, should_use_mock_ai
from services.drafting_service import (
    _hwpx_subprocess_env,
    _require_hwpx_scripts,
    _safe_title,
    hwpx_bytes_to_base64,
)


WITHUS_TEMPLATE_ID = "withus-club-application-v1"

WITHUS_FIELD_DEFAULTS: dict[str, str] = {
    "document_title": "공모전·연구동아리 참여 신청서",
    "team_or_club_name": "LiveDock 동아리",
    "applicant_name": "신청자",
    "university": "서울과학기술대학교",
    "college": "미래융합대학",
    "department": "인공지능응용학과",
    "student_id": "",
    "email": "",
    "phone": "",
    "advisor_college": "미래융합대학",
    "advisor_department": "인공지능응용학과",
    "advisor_id": "",
    "advisor_name": "",
    "motivation": "",
    "goals": "",
    "competition_plan": "",
    "operation_plan": "",
    "budget_plan": "",
    "budget_items": "예상 항목: 회의비, 인쇄비, 자료구입비, 참가비, 결과물 제작비",
    "first_month": "6월",
    "monthly_plan": "",
    "monthly_method": "",
    "second_period": "9월~11월",
    "follow_up_plan": "",
    "submission_date": "",
    "representative_signature": "",
}

WITHUS_REQUIRED_FIELDS = [
    "document_title",
    "team_or_club_name",
    "applicant_name",
    "motivation",
    "goals",
    "competition_plan",
    "operation_plan",
    "budget_plan",
    "monthly_plan",
    "monthly_method",
]


def compose_hwpx(
    template_content: bytes,
    request_text: str,
    applicant_context: str = "",
    title: str = "",
) -> dict:
    """Fill the first supported HWPX sample form from natural-language input."""
    if not settings.HWPX_EXPORT_ENABLED:
        raise AnalysisError("HWPX 자동 작성이 비활성화되어 있습니다. HWPX_EXPORT_ENABLED=true로 설정하세요.")
    if not template_content.startswith(b"PK"):
        raise AnalysisError("업로드한 파일이 HWPX ZIP 패키지 형식이 아닙니다.")
    if len(request_text.strip()) < 20:
        raise AnalysisError("요청사항을 20자 이상 입력해야 HWPX 자동 작성을 시작할 수 있습니다.")

    scripts = _require_hwpx_scripts(
        "clone_form.py",
        "fix_namespaces.py",
        "validate.py",
        "verify_hwpx.py",
        "text_extract.py",
    )

    tmpdir = _compose_temp_root() / f"compose_{uuid.uuid4().hex}"
    tmpdir.mkdir(parents=True, exist_ok=False)
    try:
        source_path = tmpdir / "template.hwpx"
        output_path = tmpdir / "composed.hwpx"
        map_path = tmpdir / "replacements.json"
        keyword_path = tmpdir / "keywords.json"
        verify_path = tmpdir / "verify.json"
        source_path.write_bytes(template_content)

        template_id = detect_template(source_path)
        if template_id != WITHUS_TEMPLATE_ID:
            raise AnalysisError("현재 샘플 withUS HWPX 양식만 지원합니다. 다른 공식 양식 자동 해석은 다음 단계 범위입니다.")

        generated = generate_withus_fields(request_text, applicant_context, title)
        replacements, keywords = build_withus_replacements(source_path, generated)
        map_path.write_text(json.dumps(replacements, ensure_ascii=False, indent=2), encoding="utf-8")
        keyword_path.write_text(json.dumps(keywords, ensure_ascii=False, indent=2), encoding="utf-8")

        python_bin = sys.executable or "python"
        _run_required(
            [
                python_bin,
                str(scripts["clone_form.py"]),
                str(source_path),
                str(output_path),
                "--map",
                str(map_path),
                "--keywords",
                str(keyword_path),
                "--title",
                generated["document_title"],
                "--creator",
                "LiveDock Agent",
                "--validate",
            ],
            "HWPX 양식 복제",
        )
        _run_required([python_bin, str(scripts["fix_namespaces.py"]), str(output_path)], "HWPX namespace 보정")
        validation = _validate_with_fallback(scripts["validate.py"], output_path)
        verify_report = _verify_with_fallback(scripts["verify_hwpx.py"], source_path, output_path, verify_path)
        extracted_text, extraction_method = _extract_text_with_fallback(scripts["text_extract.py"], output_path)

        content_ok = _contains_generated_content(extracted_text, generated)
        verification = {
            "validation_passed": validation["passed"],
            "validation_method": validation["method"],
            "validation_errors": validation["errors"],
            "structure_status": verify_report.get("status", "UNKNOWN"),
            "structure_preserved": verify_report.get("status") in {"PASS", "WARN"},
            "text_extraction_method": extraction_method,
            "text_contains_generated_content": content_ok,
            "extracted_text_excerpt": extracted_text[:1200],
            "verify_report": verify_report,
        }
        if not validation["passed"]:
            raise AnalysisError("생성된 HWPX 구조 검증에 실패했습니다: " + "; ".join(validation["errors"]))
        if not content_ok:
            raise AnalysisError("생성된 HWPX에서 AI 작성 핵심 문구를 확인하지 못했습니다.")

        safe_title = _safe_title(generated["document_title"])
        filename = f"{safe_title}_자동작성.hwpx"
        return {
            "success": True,
            "filename": filename,
            "content_type": "application/vnd.hancom.hwpx",
            "content": hwpx_bytes_to_base64(output_path.read_bytes()),
            "encoding": "base64",
            "template_id": template_id,
            "verification": verification,
            "generated_fields": generated,
            "confirmation_required": _confirmation_items(generated),
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def detect_template(hwpx_path: Path) -> str:
    texts = _extract_texts_from_zip(hwpx_path)
    joined = "\n".join(texts)
    markers = [
        "참여 신청서",
        "공모전/연구동아리",
        "동아리 소개",
        "활동계획서",
    ]
    if all(marker in joined for marker in markers):
        return WITHUS_TEMPLATE_ID
    return "unsupported"


def generate_withus_fields(request_text: str, applicant_context: str = "", title: str = "") -> dict[str, str]:
    if should_use_mock_ai() and settings.MOCK_MODE:
        return _mock_withus_fields(request_text, applicant_context, title)

    system_prompt = """당신은 한국 대학 공모전/연구동아리 HWPX 신청서를 작성하는 문서 자동화 AI입니다.
사용자 요청사항과 신청자 맥락만 근거로 삼아, 지정된 JSON 필드값을 한국어로 작성하세요.
날짜, 소속, 학번, 지도교수 정보처럼 입력에 없는 개인정보는 지어내지 말고 빈 문자열로 두세요.
HWPX/XML을 만들지 말고 JSON 객체만 반환하세요."""
    user_payload = {
        "request_text": request_text,
        "applicant_context": applicant_context,
        "title": title,
        "fields": list(WITHUS_FIELD_DEFAULTS.keys()),
    }
    user_prompt = (
        "아래 입력을 withUS 공모전/연구동아리 참여 신청서 필드 JSON으로 변환하세요.\n"
        "응답 형식은 {\"fields\": { ... }, \"confirmation_required\": [\"...\"]} 입니다.\n"
        "필수 본문 필드는 2~5문장으로 구체적으로 작성하세요.\n"
        "monthly_plan과 monthly_method는 한 줄 일정표에 들어갈 수 있게 120자 이내로 작성하세요.\n\n"
        + json.dumps(user_payload, ensure_ascii=False)
    )
    data = call_json("draft", system_prompt, user_prompt, max_tokens=4096)
    raw_fields = data.get("fields", data)
    if not isinstance(raw_fields, dict):
        raise AnalysisError(f"{provider_name()}가 HWPX 필드 JSON을 반환하지 않았습니다.")
    fields = _normalize_fields(raw_fields, request_text, applicant_context, title)
    confirmations = data.get("confirmation_required", [])
    if isinstance(confirmations, list):
        fields["_confirmation_required"] = "\n".join(str(item).strip() for item in confirmations if str(item).strip())
    return fields


def build_withus_replacements(source_path: Path, fields: dict[str, str]) -> tuple[dict[str, str], dict[str, str]]:
    section_xml = _read_section_xml(source_path)
    cells = _cells(section_xml)

    cell_values = {
        3: fields["document_title"],
        8: fields["team_or_club_name"],
        12: fields["college"],
        14: fields["department"],
        16: fields["student_id"],
        18: fields["applicant_name"],
        20: fields["email"],
        22: fields["phone"],
        26: fields["advisor_college"],
        28: fields["advisor_department"],
        30: fields["advisor_id"],
        32: fields["advisor_name"],
        34: fields["motivation"],
        37: f"{fields['goals']}\n{fields['competition_plan']}",
        39: fields["operation_plan"],
        41: f"{fields['budget_plan']}\n{fields['budget_items']}",
        46: fields["first_month"],
        47: fields["monthly_plan"],
        48: fields["monthly_method"],
        49: fields["second_period"],
        50: fields["competition_plan"],
        51: fields["follow_up_plan"],
    }
    replacements: dict[str, str] = {}
    for index, value in cell_values.items():
        if index <= len(cells) and value:
            old_cell = cells[index - 1]
            replacements[old_cell] = _replace_cell_text(old_cell, value)

    keywords = {
        "○○ 공모전·연구": fields["document_title"],
        "공공서비스 AI 자동화 연구": fields["document_title"],
        "○○ 대학교": fields.get("university", ""),
        "해당 신청 안내 문구를 삭제 후 총 3페이지 이내로 작성해 주시기 바랍니다.": _intro_notice(fields),
        "자동화 예시: 아래 내용은 LiveDock Agent가 사용자의 입력값과 공고 요건을 바탕으로 초안 작성한 샘플입니다.": _intro_notice(fields),
        "동아리 소개 및 프로그램 취지와 목적에 맞게 신청 동기 작성": fields["motivation"],
        "동아리 목표와 연계하여 구체적으로 학습하고자 하는 목표 작성": fields["goals"],
        "참여할 공모전 작성": fields["competition_plan"],
        "동아리 운영 방법 설명": fields["operation_plan"],
        "활동비 60만원 + 추가활동비 계획 작성": fields["budget_plan"],
        "물품구입비 회의비 수수료비 참가비 등": fields["budget_items"],
        "해당 월에 학습 또는 활동한 내용을 구체적으로 기술": fields["monthly_plan"],
        "학습진행 방식기술": fields["monthly_method"],
        "2026 년    월    일": fields["submission_date"],
        "2026 년  5 월  3 일": fields["submission_date"],
        "동아리 대표: 0 0 0 (서명 또는 인)": fields["representative_signature"],
        "동아리 대표 : 김라이브 (서명 또는 인)": fields["representative_signature"],
    }
    return replacements, {key: value for key, value in keywords.items() if key and value}


def _normalize_fields(raw: dict, request_text: str, applicant_context: str, title: str) -> dict[str, str]:
    fields = dict(WITHUS_FIELD_DEFAULTS)
    for key in fields:
        value = raw.get(key)
        if value is not None:
            fields[key] = _compact(str(value), 900)
    if title.strip():
        fields["document_title"] = title.strip()
    if not fields["motivation"]:
        fields["motivation"] = _compact(request_text, 700)
    if not fields["goals"]:
        fields["goals"] = "요청사항을 바탕으로 공모전 참여 목표를 구체화하고, 결과물 제작까지 이어지는 실행 역량을 기르는 것을 목표로 합니다."
    if not fields["operation_plan"]:
        fields["operation_plan"] = "정기 회의와 역할 분담을 통해 자료 조사, 초안 작성, 검토, 보완을 단계적으로 진행합니다."
    if not fields["budget_plan"]:
        fields["budget_plan"] = "지원금은 회의 운영, 자료 조사, 인쇄, 결과물 제작 및 공모전 참여 준비에 사용합니다."
    if not fields["monthly_plan"]:
        fields["monthly_plan"] = "공고 분석, 주제 선정, 자료 조사, 신청서 및 제안서 초안 작성"
    if not fields["monthly_method"]:
        fields["monthly_method"] = "정기 회의, 역할별 리서치, 문서 리뷰, 피드백 반영"
    if not fields["competition_plan"]:
        fields["competition_plan"] = "참여 예정 공모전은 요청사항을 기준으로 선정하며, 접수 일정과 자격 요건은 제출 전 재확인합니다."
    if not fields["follow_up_plan"]:
        fields["follow_up_plan"] = "결과물을 점검하고 제출 전 요구 양식, 증빙, 서명 여부를 최종 확인합니다."
    if not fields["representative_signature"]:
        fields["representative_signature"] = f"동아리 대표 : {fields['applicant_name']} (서명 또는 인)"
    return fields


def _mock_withus_fields(request_text: str, applicant_context: str, title: str) -> dict[str, str]:
    fields = dict(WITHUS_FIELD_DEFAULTS)
    fields.update(
        {
            "document_title": title.strip() or "LiveDock HWPX 자동작성 MVP",
            "team_or_club_name": "LiveDock Lab",
            "applicant_name": "김라이브",
            "motivation": f"본 동아리는 {request_text.strip()} 요청을 바탕으로 HWPX 자동작성 MVP를 검증하기 위해 구성되었습니다. 공모전 양식을 이해하고 필요한 내용을 자동으로 채우는 과정을 실험합니다.",
            "goals": "HWPX 양식 분석, AI 필드 생성, 문서 치환, 검증 자동화를 학습하고 실제 제출 가능한 결과물을 만드는 것을 목표로 합니다.",
            "competition_plan": "참여 예정 공모전은 문서 자동화와 공공서비스 개선을 주제로 한 교내외 공모전입니다.",
            "operation_plan": "매주 1회 회의를 열어 요구사항 정리, 작성 결과 검토, HWPX 검증 결과 확인을 진행합니다.",
            "budget_plan": "활동비는 회의 운영, 자료 조사, 문서 검증, 결과물 제작에 사용합니다.",
            "monthly_plan": "샘플 HWPX 양식 분석, 요청사항 기반 필드 생성, 자동작성 결과 검토",
            "monthly_method": "정기 회의, 역할별 테스트, 생성 파일 검증, 피드백 반영",
            "submission_date": "2026 년 5 월 7 일",
            "representative_signature": "동아리 대표 : 김라이브 (서명 또는 인)",
        }
    )
    return _normalize_fields(fields, request_text, applicant_context, title)


def _confirmation_items(fields: dict[str, str]) -> list[str]:
    items = [
        "신청자명, 소속, 학번, 연락처, 지도교수 정보는 실제 제출 전 반드시 확인하세요.",
        "공모전명, 지원금 사용계획, 활동 일정은 공고 원문과 일치하는지 확인하세요.",
    ]
    extra = fields.get("_confirmation_required", "")
    if extra:
        items.extend(line.strip("- ").strip() for line in extra.splitlines() if line.strip())
    return list(dict.fromkeys(items))


def _run_required(command: list[str], label: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=_hwpx_subprocess_env(),
        )
    except subprocess.CalledProcessError as exc:
        detail = "\n".join(part for part in [exc.stdout, exc.stderr] if part).strip()
        raise AnalysisError(f"{label} 실패: {detail or exc}") from exc


def _run_optional(command: list[str]) -> tuple[bool, str]:
    try:
        done = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=_hwpx_subprocess_env(),
        )
        return True, (done.stdout or "") + (done.stderr or "")
    except subprocess.CalledProcessError as exc:
        return False, ((exc.stdout or "") + (exc.stderr or "")).strip()


def _validate_with_fallback(validate_script: Path, output_path: Path) -> dict:
    ok, output = _run_optional([sys.executable or "python", str(validate_script), str(output_path)])
    if ok:
        return {"passed": True, "method": "validate.py", "errors": []}
    if "ModuleNotFoundError" not in output:
        return {"passed": False, "method": "validate.py", "errors": [output or "validate.py failed"]}
    errors = _internal_validate(output_path)
    return {
        "passed": not errors,
        "method": "internal-zip-xml-fallback",
        "errors": errors,
    }


def _verify_with_fallback(verify_script: Path, source_path: Path, output_path: Path, verify_path: Path) -> dict:
    ok, output = _run_optional(
        [
            sys.executable or "python",
            str(verify_script),
            "--source",
            str(source_path),
            "--result",
            str(output_path),
            "--json",
            str(verify_path),
        ]
    )
    if ok and verify_path.exists():
        return json.loads(verify_path.read_text(encoding="utf-8"))
    report = _internal_verify(source_path, output_path)
    report["warnings"].append(output or "verify_hwpx.py failed; used internal fallback")
    return report


def _extract_text_with_fallback(text_extract_script: Path, output_path: Path) -> tuple[str, str]:
    ok, output = _run_optional([sys.executable or "python", str(text_extract_script), str(output_path), "--include-tables"])
    if ok:
        return output, "text_extract.py"
    return "\n".join(_extract_texts_from_zip(output_path)), "internal-zip-fallback"


def _internal_validate(hwpx_path: Path) -> list[str]:
    errors: list[str] = []
    try:
        with zipfile.ZipFile(hwpx_path, "r") as zf:
            names = zf.namelist()
            for required in ["mimetype", "Contents/content.hpf", "Contents/header.xml", "Contents/section0.xml"]:
                if required not in names:
                    errors.append(f"Missing required file: {required}")
            if names and names[0] != "mimetype":
                errors.append("mimetype is not the first ZIP entry")
            if "mimetype" in names and zf.getinfo("mimetype").compress_type != zipfile.ZIP_STORED:
                errors.append("mimetype should use ZIP_STORED")
            for name in names:
                if name.endswith(".xml") or name.endswith(".hpf"):
                    try:
                        ElementTree.fromstring(zf.read(name))
                    except ElementTree.ParseError as exc:
                        errors.append(f"Malformed XML in {name}: {exc}")
    except zipfile.BadZipFile:
        errors.append("Not a valid ZIP archive")
    return errors


def _internal_verify(source_path: Path, output_path: Path) -> dict:
    source = _structure_counts(source_path)
    result = _structure_counts(output_path)
    issues: list[str] = []
    warnings: list[str] = []
    for key in ("tables", "images"):
        if result.get(key, 0) < source.get(key, 0):
            issues.append(f"{key} count decreased")
    if result.get("runs", 0) < source.get("runs", 0):
        warnings.append("run count decreased")
    return {
        "status": "FAIL" if issues else "WARN" if warnings else "PASS",
        "issues": issues,
        "warnings": warnings,
        "source": source,
        "result": result,
    }


def _structure_counts(hwpx_path: Path) -> dict:
    with zipfile.ZipFile(hwpx_path, "r") as zf:
        names = zf.namelist()
        section = zf.read("Contents/section0.xml").decode("utf-8") if "Contents/section0.xml" in names else ""
        return {
            "zip_entries": len(names),
            "bindata": len([name for name in names if name.startswith("BinData/")]),
            "paragraphs": len(re.findall(r"<hp:p ", section)),
            "runs": len(re.findall(r"<hp:run ", section)),
            "tables": len(re.findall(r"<hp:tbl ", section)),
            "images": len(re.findall(r"<hp:pic ", section)),
        }


def _contains_generated_content(text: str, fields: dict[str, str]) -> bool:
    candidates = [
        fields.get("team_or_club_name", ""),
        fields.get("applicant_name", ""),
        fields.get("motivation", "")[:30],
        fields.get("goals", "")[:30],
    ]
    return any(candidate and candidate in text for candidate in candidates)


def _read_section_xml(hwpx_path: Path) -> str:
    with zipfile.ZipFile(hwpx_path, "r") as zf:
        return zf.read("Contents/section0.xml").decode("utf-8")


def _extract_texts_from_zip(hwpx_path: Path) -> list[str]:
    texts: list[str] = []
    with zipfile.ZipFile(hwpx_path, "r") as zf:
        for name in zf.namelist():
            if name.startswith("Contents/") and name.endswith(".xml"):
                data = zf.read(name).decode("utf-8")
                for match in re.finditer(r"<hp:t>(.*?)</hp:t>", data, re.DOTALL):
                    clean = re.sub(r"<[^>]+>", "", match.group(1)).strip()
                    if clean:
                        texts.append(html.unescape(clean))
    return texts


def _cells(section_xml: str) -> list[str]:
    return re.findall(r"<hp:tc[\s\S]*?</hp:tc>", section_xml)


def _replace_cell_text(cell_xml: str, text: str) -> str:
    escaped = escape(text)
    if re.search(r"<hp:run([^>/]*)/>", cell_xml):
        return re.sub(r"<hp:run([^>/]*)/>", rf"<hp:run\1><hp:t>{escaped}</hp:t></hp:run>", cell_xml, count=1)
    if re.search(r"<hp:t>[\s\S]*?</hp:t>", cell_xml):
        return re.sub(r"<hp:t>[\s\S]*?</hp:t>", f"<hp:t>{escaped}</hp:t>", cell_xml, count=1)
    return re.sub(r"(</hp:subList>)", f'<hp:p id="999999" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>{escaped}</hp:t></hp:run></hp:p>\\1', cell_xml, count=1)


def _intro_notice(fields: dict[str, str]) -> str:
    return f"LiveDock Agent가 요청사항을 바탕으로 자동 작성한 {fields['document_title']} 초안입니다. 제출 전 개인정보와 공고 요건을 확인하세요."


def _compact(text: str, limit: int) -> str:
    value = re.sub(r"\s+", " ", text).strip()
    return value[:limit].rstrip()


def _compose_temp_root() -> Path:
    root = Path(__file__).resolve().parents[2] / "outputs" / "tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root
