import html
import json
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
GENERIC_TEMPLATE_ID = "generic-hwpx-form-v1"

WITHUS_FIELD_DEFAULTS: dict[str, str] = {
    "document_title": "공모전/연구동아리 참여 신청서",
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
    "monthly_plan": "",
    "monthly_method": "",
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
    """Create an HWPX draft from an uploaded HWPX form.

    Known templates can be handled with template-specific field names. Unknown official
    forms are still supported by preserving the original package and appending a clearly
    labeled auto-written draft section, so users are not blocked by template detection.
    """
    if not settings.HWPX_EXPORT_ENABLED:
        raise AnalysisError("HWPX 자동 작성이 비활성화되어 있습니다. HWPX_EXPORT_ENABLED=true로 설정해 주세요.")
    if not template_content.startswith(b"PK"):
        raise AnalysisError("업로드한 파일이 HWPX ZIP 패키지 형식이 아닙니다.")
    if len(request_text.strip()) < 20:
        raise AnalysisError("요청사항을 20자 이상 입력해야 HWPX 자동 작성을 시작할 수 있습니다.")

    scripts = _require_hwpx_scripts("fix_namespaces.py", "validate.py", "verify_hwpx.py", "text_extract.py")

    tmpdir = _compose_temp_root() / f"compose_{uuid.uuid4().hex}"
    tmpdir.mkdir(parents=True, exist_ok=False)
    try:
        source_path = tmpdir / "template.hwpx"
        output_path = tmpdir / "composed.hwpx"
        verify_path = tmpdir / "verify.json"
        source_path.write_bytes(template_content)

        template_id = detect_template(source_path)
        if template_id == WITHUS_TEMPLATE_ID:
            generated = generate_withus_fields(request_text, applicant_context, title)
            composed_markdown = _render_withus_markdown(generated)
            warnings: list[str] = []
        else:
            generated = generate_generic_fields(request_text, applicant_context, title, source_path)
            composed_markdown = _render_generic_markdown(generated)
            warnings = [
                "알 수 없는 HWPX 양식입니다. 원본 양식 구조는 보존하고 자동작성 내용을 새 섹션으로 추가했습니다. "
                "정확한 칸 매핑이 필요한 공식 양식은 다음 단계에서 템플릿 매핑을 추가해 주세요."
            ]

        _copy_hwpx_with_appended_section(source_path, output_path, composed_markdown)

        python_bin = sys.executable or "python"
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
            raise AnalysisError("생성된 HWPX에서 자동작성 핵심 문구를 확인하지 못했습니다.")

        document_title = generated.get("document_title") or title or "LiveDock HWPX 자동작성"
        filename = f"{_safe_title(document_title)}_자동작성.hwpx"
        return {
            "success": True,
            "filename": filename,
            "content_type": "application/vnd.hancom.hwpx",
            "content": hwpx_bytes_to_base64(output_path.read_bytes()),
            "encoding": "base64",
            "warnings": warnings,
            "validation_summary": verification,
            "template_id": template_id,
            "verification": verification,
            "generated_fields": generated,
            "confirmation_required": _confirmation_items(generated, template_id),
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def detect_template(hwpx_path: Path) -> str:
    texts = _extract_texts_from_zip(hwpx_path)
    joined = "\n".join(texts)
    markers = ["참여 신청서", "공모전", "연구동아리", "동아리 소개", "활동계획서"]
    if all(marker in joined for marker in markers):
        return WITHUS_TEMPLATE_ID
    return GENERIC_TEMPLATE_ID


def generate_withus_fields(request_text: str, applicant_context: str = "", title: str = "") -> dict[str, str]:
    if should_use_mock_ai() and settings.MOCK_MODE:
        return _mock_withus_fields(request_text, applicant_context, title)

    system_prompt = (
        "당신은 한국어 공모전/연구동아리 HWPX 신청서를 작성하는 문서 자동화 AI입니다. "
        "사용자 요청사항과 신청자 맥락만 근거로 지정된 JSON 필드를 한국어로 작성하세요. "
        "입력에 없는 개인정보, 날짜, 소속, 학번, 연락처는 지어내지 말고 빈 문자열로 두세요."
    )
    user_payload = {
        "request_text": request_text,
        "applicant_context": applicant_context,
        "title": title,
        "fields": list(WITHUS_FIELD_DEFAULTS.keys()),
    }
    user_prompt = (
        "아래 입력을 withUS 공모전/연구동아리 참여 신청서 필드 JSON으로 변환하세요.\n"
        "응답 형식은 {\"fields\": { ... }, \"confirmation_required\": [\"...\"]} 입니다.\n"
        "필수 본문 필드는 2~5문장으로 구체적으로 작성하세요.\n\n"
        + json.dumps(user_payload, ensure_ascii=False)
    )
    data = call_json("draft", system_prompt, user_prompt, max_tokens=4096)
    raw_fields = data.get("fields", data)
    if not isinstance(raw_fields, dict):
        raise AnalysisError(f"{provider_name()}가 HWPX 필드 JSON을 반환하지 않았습니다.")
    fields = _normalize_withus_fields(raw_fields, request_text, applicant_context, title)
    confirmations = data.get("confirmation_required", [])
    if isinstance(confirmations, list):
        fields["_confirmation_required"] = "\n".join(str(item).strip() for item in confirmations if str(item).strip())
    return fields


def generate_generic_fields(request_text: str, applicant_context: str, title: str, source_path: Path) -> dict[str, str]:
    source_excerpt = "\n".join(_extract_texts_from_zip(source_path))[:5000]
    if should_use_mock_ai() and settings.MOCK_MODE:
        return _mock_generic_fields(request_text, applicant_context, title, source_excerpt)

    system_prompt = (
        "당신은 한국어 공식 양식에 넣을 신청서 초안을 작성하는 문서 자동화 AI입니다. "
        "HWPX/XML 파일을 직접 만들지 말고, 원본 양식에 덧붙일 수 있는 구조화된 JSON만 반환하세요. "
        "입력에 없는 마감일, 기관명, 개인정보, 금액은 지어내지 말고 confirmation_required에 적으세요."
    )
    payload = {
        "request_text": request_text,
        "applicant_context": applicant_context,
        "title": title,
        "template_text_excerpt": source_excerpt,
    }
    prompt = (
        "아래 정보를 바탕으로 HWPX 양식에 삽입할 자동작성 초안을 JSON으로 작성하세요.\n"
        "형식: {\"document_title\":\"...\", \"summary\":\"...\", \"draft_content\":\"...\", "
        "\"confirmation_required\":[\"...\"]}\n\n"
        + json.dumps(payload, ensure_ascii=False)
    )
    data = call_json("draft", system_prompt, prompt, max_tokens=4096)
    if not isinstance(data, dict):
        raise AnalysisError(f"{provider_name()}가 HWPX 자동작성 JSON을 반환하지 않았습니다.")
    return _normalize_generic_fields(data, request_text, applicant_context, title, source_excerpt)


def _normalize_withus_fields(raw: dict, request_text: str, applicant_context: str, title: str) -> dict[str, str]:
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
        fields["goals"] = "요청사항을 바탕으로 공모전 참여 목표를 구체화하고 결과물 제작까지 이어지는 실행 역량을 기르는 것을 목표로 합니다."
    if not fields["operation_plan"]:
        fields["operation_plan"] = "정기 회의와 역할 분담을 통해 자료 조사, 초안 작성, 검토, 보완을 단계적으로 진행합니다."
    if not fields["budget_plan"]:
        fields["budget_plan"] = "지원금은 회의 운영, 자료 조사, 인쇄, 결과물 제작 및 제출 준비에 사용합니다."
    if not fields["monthly_plan"]:
        fields["monthly_plan"] = "공고 분석, 주제 선정, 자료 조사, 신청서 및 제안서 초안 작성"
    if not fields["monthly_method"]:
        fields["monthly_method"] = "정기 회의, 역할별 리서치, 문서 초안 리뷰, 피드백 반영"
    if not fields["competition_plan"]:
        fields["competition_plan"] = "참여 예정 공모전은 사용자 요청사항과 공고 요건을 기준으로 선정하며, 접수 일정과 자격 요건은 제출 전 확인합니다."
    if not fields["follow_up_plan"]:
        fields["follow_up_plan"] = "결과물을 자체 검토하고 제출 전 요구 양식, 증빙, 서명 여부를 최종 확인합니다."
    if not fields["representative_signature"]:
        fields["representative_signature"] = f"동아리 대표: {fields['applicant_name']} (서명 또는 인)"
    return fields


def _normalize_generic_fields(raw: dict, request_text: str, applicant_context: str, title: str, source_excerpt: str) -> dict[str, str]:
    document_title = str(raw.get("document_title") or title or _guess_title(source_excerpt) or "LiveDock HWPX 자동작성").strip()
    summary = str(raw.get("summary") or "").strip()
    draft_content = str(raw.get("draft_content") or "").strip()
    if not summary:
        summary = _compact(request_text, 500)
    if not draft_content:
        draft_content = "\n\n".join(part for part in [request_text.strip(), applicant_context.strip()] if part)
    confirmations = raw.get("confirmation_required", [])
    confirmation_text = "\n".join(str(item).strip() for item in confirmations if str(item).strip()) if isinstance(confirmations, list) else ""
    return {
        "document_title": _compact(document_title, 120),
        "summary": _compact(summary, 900),
        "applicant_context": _compact(applicant_context, 900),
        "draft_content": _compact(draft_content, 3000),
        "_confirmation_required": confirmation_text,
    }


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
            "submission_date": "2026년 5월 7일",
            "representative_signature": "동아리 대표: 김라이브 (서명 또는 인)",
        }
    )
    return _normalize_withus_fields(fields, request_text, applicant_context, title)


def _mock_generic_fields(request_text: str, applicant_context: str, title: str, source_excerpt: str) -> dict[str, str]:
    return _normalize_generic_fields(
        {
            "document_title": title.strip() or _guess_title(source_excerpt) or "HWPX 자동작성 초안",
            "summary": "사용자 요청사항을 바탕으로 공식 양식에 반영할 신청서 초안을 작성했습니다.",
            "draft_content": (
                f"요청사항: {request_text.strip()}\n\n"
                f"신청자/팀 정보: {applicant_context.strip() or '추가 입력 필요'}\n\n"
                "위 내용을 바탕으로 제출 전 확인 가능한 초안을 구성했습니다. 양식의 세부 칸 매핑은 공식 서식을 확인해 보완해야 합니다."
            ),
            "confirmation_required": ["공식 양식의 각 입력 칸에 맞게 자동작성 내용이 들어갔는지 제출 전 확인해 주세요."],
        },
        request_text,
        applicant_context,
        title,
        source_excerpt,
    )


def _render_withus_markdown(fields: dict[str, str]) -> str:
    return "\n".join(
        [
            "# LiveDock 자동작성 내용",
            f"문서 제목: {fields['document_title']}",
            f"동아리명: {fields['team_or_club_name']}",
            f"신청자: {fields['applicant_name']}",
            "",
            "## 신청동기",
            fields["motivation"],
            "",
            "## 동아리 목표",
            fields["goals"],
            "",
            "## 참여 예정 공모전",
            fields["competition_plan"],
            "",
            "## 운영방법",
            fields["operation_plan"],
            "",
            "## 지원금 사용계획",
            fields["budget_plan"],
            fields["budget_items"],
            "",
            "## 활동계획",
            f"- 학습내용: {fields['monthly_plan']}",
            f"- 학습방법: {fields['monthly_method']}",
            f"- 사후계획: {fields['follow_up_plan']}",
            "",
            fields["representative_signature"],
        ]
    )


def _render_generic_markdown(fields: dict[str, str]) -> str:
    return "\n".join(
        [
            "# LiveDock 자동작성 내용",
            f"문서 제목: {fields['document_title']}",
            "",
            "## 요약",
            fields["summary"],
            "",
            "## 신청자/팀 정보",
            fields["applicant_context"] or "추가 입력 필요",
            "",
            "## 자동작성 초안",
            fields["draft_content"],
        ]
    )


def _copy_hwpx_with_appended_section(source_path: Path, output_path: Path, markdown: str) -> None:
    paragraphs = _markdown_to_hwpx_paragraphs(markdown)
    with zipfile.ZipFile(source_path, "r") as zin:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "Contents/section0.xml":
                    text = data.decode("utf-8", errors="replace")
                    insert = "\n" + "\n".join(paragraphs) + "\n"
                    if "</hs:sec>" in text:
                        text = text.replace("</hs:sec>", insert + "</hs:sec>", 1)
                    else:
                        text += insert
                    data = text.encode("utf-8")
                if item.filename == "mimetype":
                    zout.writestr(item, data, compress_type=zipfile.ZIP_STORED)
                else:
                    zout.writestr(item, data)


def _markdown_to_hwpx_paragraphs(markdown: str) -> list[str]:
    lines = [line.rstrip() for line in markdown.splitlines()]
    paragraphs: list[str] = []
    next_para_id = 900000
    for raw in lines:
        text = raw.strip()
        if not text:
            continue
        text = re.sub(r"^#{1,6}\s+", "", text)
        text = re.sub(r"^\s*[-*]\s+", "- ", text)
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"`(.+?)`", r"\1", text)
        paragraphs.append(
            f'<hp:p id="{next_para_id}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="0"><hp:t>{escape(text)}</hp:t></hp:run>'
            f'</hp:p>'
        )
        next_para_id += 1
    return paragraphs


def _confirmation_items(fields: dict[str, str], template_id: str) -> list[str]:
    items = [
        "제출 전 이름, 소속, 연락처, 날짜, 서명 등 개인정보와 제출 정보를 반드시 확인해 주세요.",
        "공고명, 지원금 사용계획, 활동 일정이 실제 공고 원문과 일치하는지 확인해 주세요.",
    ]
    if template_id == GENERIC_TEMPLATE_ID:
        items.append("알 수 없는 양식은 자동작성 내용을 별도 섹션으로 추가했습니다. 공식 입력 칸별 배치가 맞는지 확인해 주세요.")
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
    return {"passed": not errors, "method": "internal-zip-xml-fallback", "errors": errors}


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
    candidates: list[str] = []
    for key in ("team_or_club_name", "applicant_name", "document_title", "summary", "draft_content", "motivation", "goals"):
        value = fields.get(key, "")
        if value:
            candidates.append(value[:30])
    return any(candidate and candidate in text for candidate in candidates)


def _extract_texts_from_zip(hwpx_path: Path) -> list[str]:
    texts: list[str] = []
    with zipfile.ZipFile(hwpx_path, "r") as zf:
        for name in zf.namelist():
            if name.startswith("Contents/") and name.endswith(".xml"):
                data = zf.read(name).decode("utf-8", errors="replace")
                for match in re.finditer(r"<hp:t[^>]*>(.*?)</hp:t>", data, re.DOTALL):
                    clean = re.sub(r"<[^>]+>", "", match.group(1)).strip()
                    if clean:
                        texts.append(html.unescape(clean))
    return texts


def _guess_title(source_excerpt: str) -> str:
    for line in source_excerpt.splitlines():
        value = line.strip()
        if 4 <= len(value) <= 80 and any(token in value for token in ("신청서", "계획서", "공고", "지원", "모집")):
            return value
    return ""


def _compact(text: str, limit: int) -> str:
    value = re.sub(r"\s+", " ", text).strip()
    return value[:limit].rstrip()


def _compose_temp_root() -> Path:
    root = Path(__file__).resolve().parents[2] / "outputs" / "tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root
