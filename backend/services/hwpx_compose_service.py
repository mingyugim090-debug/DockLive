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
            _copy_known_application_form(source_path, output_path, generated)
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
            "document_title": title.strip() or _guess_title(source_excerpt) or "HWPX 작성 문서",
            "summary": "사용자 요청사항을 바탕으로 공식 양식에 반영할 신청서 초안을 작성했습니다.",
            "draft_content": (
                f"요청사항: {request_text.strip()}\n\n"
                f"신청자/팀 정보: {applicant_context.strip() or '제출 전 확인'}\n\n"
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
            "# 작성 내용",
            fields["document_title"],
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
            "# 작성 내용",
            fields["document_title"],
            "",
            "## 개요",
            fields["summary"],
            "",
            "## 신청자 정보",
            fields["applicant_context"] or "제출 전 확인",
            "",
            "## 본문",
            fields["draft_content"],
        ]
    )


def _copy_known_application_form(source_path: Path, output_path: Path, fields: dict[str, str]) -> None:
    """Preserve a known club/application HWPX form and replace field-level text."""
    title = _compact(fields.get("document_title") or "동아리 신청서", 80)
    generated_note = "사용자 요청을 바탕으로 학교 제출용 신청서 문체에 맞춰 작성한 내용입니다."
    confirmation = "제출 전 이름, 소속, 연락처, 지도교수, 실제 일정과 금액을 확인해 주세요."
    submission_date = fields.get("submission_date") or _today_korean()
    signature = fields.get("representative_signature") or "동아리 대표 : 확인 필요 (서명 또는 인)"

    replacements = {
        2: title,
        3: generated_note,
        26: _compact(fields.get("motivation", ""), 620),
        29: _compact(fields.get("goals", ""), 520),
        30: _compact(fields.get("competition_plan", ""), 520),
        34: _compact(fields.get("operation_plan", ""), 360),
        36: _compact(fields.get("budget_plan", ""), 300),
        37: _compact(fields.get("budget_items", ""), 180),
        43: _compact(fields.get("monthly_plan", ""), 250),
        45: _compact(fields.get("monthly_method", ""), 230),
        47: confirmation,
        48: submission_date,
        49: signature,
    }
    replacements = {key: value for key, value in replacements.items() if value}
    preview_text = _render_withus_markdown(fields)
    modified = _iso_now()

    with zipfile.ZipFile(source_path, "r") as zin:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "Contents/section0.xml":
                    text = data.decode("utf-8", errors="replace")
                    data = _replace_nonempty_hwpx_texts(text, replacements).encode("utf-8")
                elif item.filename == "Contents/content.hpf":
                    text = data.decode("utf-8", errors="replace")
                    text = re.sub(
                        r"(<opf:title>).*?(</opf:title>)",
                        lambda match: f"{match.group(1)}{escape(title)}{match.group(2)}",
                        text,
                        flags=re.DOTALL,
                    )
                    text = re.sub(
                        r'(<opf:meta name="ModifiedDate" content="text">).*?(</opf:meta>)',
                        lambda match: f"{match.group(1)}{modified}{match.group(2)}",
                        text,
                        flags=re.DOTALL,
                    )
                    data = text.encode("utf-8")
                elif item.filename == "Preview/PrvText.txt":
                    data = _compact(preview_text, 4000).encode("utf-8")

                if item.filename == "mimetype":
                    zout.writestr(item, data, compress_type=zipfile.ZIP_STORED)
                else:
                    zout.writestr(item, data)


def _replace_nonempty_hwpx_texts(xml_text: str, replacements: dict[int, str]) -> str:
    nonempty_index = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal nonempty_index
        raw = match.group(2)
        clean = re.sub(r"<[^>]+>", "", raw).strip()
        if not clean:
            return match.group(0)
        nonempty_index += 1
        value = replacements.get(nonempty_index)
        if value is None:
            return match.group(0)
        return f"{match.group(1)}{escape(value)}{match.group(3)}"

    return re.sub(r"(<hp:t\b(?![^>]*/>)[^>]*>)(.*?)(</hp:t>)", replace, xml_text, flags=re.DOTALL)


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


def _today_korean() -> str:
    from datetime import datetime

    now = datetime.now()
    return f"{now.year} 년  {now.month} 월  {now.day} 일"


def _iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _compact(text: str, limit: int) -> str:
    value = re.sub(r"\s+", " ", text).strip()
    return value[:limit].rstrip()


def _compose_temp_root() -> Path:
    root = Path(__file__).resolve().parents[2] / "outputs" / "tmp"
    root.mkdir(parents=True, exist_ok=True)
    return root


# Quality-focused overrides for the Agent MVP HWPX compose workflow.
def detect_template(hwpx_path: Path) -> str:
    texts = _extract_texts_from_zip(hwpx_path)
    joined = "\n".join(texts)
    marker_groups = [
        ["참여 신청서", "동아리 정보", "동아리 소개", "활동계획서"],
        ["동아리목표", "운영방법", "지원금 사용계획", "활동계획"],
    ]
    if all(any(marker in joined for marker in group) for group in marker_groups):
        return WITHUS_TEMPLATE_ID
    return GENERIC_TEMPLATE_ID


def generate_withus_fields(request_text: str, applicant_context: str = "", title: str = "") -> dict[str, str]:
    if should_use_mock_ai():
        return _mock_withus_fields(request_text, applicant_context, title)

    system_prompt = (
        "당신은 한국 대학 동아리/공모전/연구동아리 HWPX 신청서를 작성하는 문서 자동화 AI입니다. "
        "원본 양식의 각 칸에 들어갈 한국어 문장만 JSON으로 작성하세요. "
        "서비스 설명, MVP, mock, 업로드, 다운로드, AI Agent 같은 내부 구현 표현은 절대 쓰지 마세요. "
        "문체는 학교 제출용으로 단정하고 공식적이어야 하며, 과장하지 말고 확인되지 않은 개인정보·금액·일정은 지어내지 마세요. "
        "개인정보성 필드는 사용자가 제공하지 않았으면 빈 문자열로 두고, 확인이 필요한 사실은 confirmation_required에만 적으세요."
    )
    user_payload = {
        "request_text": request_text,
        "applicant_context": applicant_context,
        "title": title,
        "target_fields": [
            "document_title",
            "team_or_club_name",
            "applicant_name",
            "university",
            "college",
            "department",
            "student_id",
            "email",
            "phone",
            "advisor_college",
            "advisor_department",
            "advisor_id",
            "advisor_name",
            "motivation",
            "goals",
            "competition_plan",
            "operation_plan",
            "budget_plan",
            "budget_items",
            "monthly_plan",
            "monthly_method",
            "follow_up_plan",
            "submission_date",
            "representative_signature",
        ],
        "style_rules": [
            "motivation은 동아리 소개와 신청동기를 합쳐 3~4문장으로 작성",
            "goals는 활동 목표를 2~3문장으로 작성",
            "competition_plan은 참여 예정 활동이나 대회 계획을 1~2문장으로 작성",
            "operation_plan은 운영 방식과 안전 관리, 역할 분담을 2~3문장으로 작성",
            "budget_plan은 실제 금액을 모르면 항목 중심으로 작성",
            "monthly_plan과 monthly_method는 표 안에 들어갈 짧은 문장으로 작성",
        ],
    }
    user_prompt = (
        "아래 정보를 바탕으로 신청서 양식의 칸별 내용을 JSON으로 작성하세요.\n"
        "응답 형식은 {\"fields\": {...}, \"confirmation_required\": [\"...\"]} 입니다.\n\n"
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


def _normalize_withus_fields(raw: dict, request_text: str, applicant_context: str, title: str) -> dict[str, str]:
    fields = dict(WITHUS_FIELD_DEFAULTS)
    for key in fields:
        value = raw.get(key)
        if value is not None:
            fields[key] = _compact(str(value), 900)

    inferred_title = title.strip() or _infer_document_title(request_text) or "동아리 신청서"
    fields["document_title"] = _compact(fields.get("document_title") or inferred_title, 90)
    fields["team_or_club_name"] = _compact(fields.get("team_or_club_name") or _infer_club_name(request_text) or "확인 필요", 40)

    if not fields.get("motivation"):
        fields["motivation"] = _quality_application_copy(request_text)["motivation"]
    if not fields.get("goals"):
        fields["goals"] = _quality_application_copy(request_text)["goals"]
    if not fields.get("competition_plan"):
        fields["competition_plan"] = _quality_application_copy(request_text)["competition_plan"]
    if not fields.get("operation_plan"):
        fields["operation_plan"] = _quality_application_copy(request_text)["operation_plan"]
    if not fields.get("budget_plan"):
        fields["budget_plan"] = _quality_application_copy(request_text)["budget_plan"]
    if not fields.get("budget_items"):
        fields["budget_items"] = _quality_application_copy(request_text)["budget_items"]
    if not fields.get("monthly_plan"):
        fields["monthly_plan"] = _quality_application_copy(request_text)["monthly_plan"]
    if not fields.get("monthly_method"):
        fields["monthly_method"] = _quality_application_copy(request_text)["monthly_method"]
    if not fields.get("follow_up_plan"):
        fields["follow_up_plan"] = "활동 결과를 정리하고 다음 학기 운영 계획과 개선 사항을 검토합니다."
    if not fields.get("submission_date"):
        fields["submission_date"] = _today_korean()
    if not fields.get("representative_signature"):
        applicant = fields.get("applicant_name") or "확인 필요"
        fields["representative_signature"] = f"동아리 대표 : {applicant} (서명 또는 인)"

    for private_key in (
        "applicant_name",
        "university",
        "college",
        "department",
        "student_id",
        "email",
        "phone",
        "advisor_college",
        "advisor_department",
        "advisor_id",
        "advisor_name",
    ):
        if raw.get(private_key) is None:
            fields[private_key] = ""
    return fields


def _mock_withus_fields(request_text: str, applicant_context: str, title: str) -> dict[str, str]:
    copy = _quality_application_copy(request_text)
    fields = dict(WITHUS_FIELD_DEFAULTS)
    fields.update(
        {
            "document_title": title.strip() or _infer_document_title(request_text) or "축구 동아리 신청서",
            "team_or_club_name": _infer_club_name(request_text) or "축구 동아리",
            "applicant_name": "",
            "university": "",
            "college": "",
            "department": "",
            "student_id": "",
            "email": "",
            "phone": "",
            "advisor_college": "",
            "advisor_department": "",
            "advisor_id": "",
            "advisor_name": "",
            "motivation": copy["motivation"],
            "goals": copy["goals"],
            "competition_plan": copy["competition_plan"],
            "operation_plan": copy["operation_plan"],
            "budget_plan": copy["budget_plan"],
            "budget_items": copy["budget_items"],
            "monthly_plan": copy["monthly_plan"],
            "monthly_method": copy["monthly_method"],
            "follow_up_plan": "활동 종료 후 훈련 참여도, 경기 운영 기록, 부원 만족도를 정리해 다음 학기 운영 개선안에 반영합니다.",
            "submission_date": _today_korean(),
            "representative_signature": "동아리 대표 : 확인 필요 (서명 또는 인)",
            "_confirmation_required": "대표자 이름, 학번, 연락처, 지도교수 정보\n실제 활동 일정과 지원금 사용 가능 항목",
        }
    )
    return _normalize_withus_fields(fields, request_text, applicant_context, title)


def _quality_application_copy(request_text: str) -> dict[str, str]:
    lowered = request_text.lower()
    is_soccer = any(token in lowered for token in ("축구", "football", "풋살", "soccer"))
    if is_soccer:
        return {
            "motivation": (
                "본 동아리는 축구 활동을 통해 학생들의 체력 증진과 협동심 함양을 목표로 하는 자율 활동 모임입니다. "
                "정기적인 훈련과 경기 참여를 통해 구성원들이 책임감 있게 역할을 수행하고, 건강한 교내 스포츠 문화를 형성하고자 합니다. "
                "또한 전공과 학년이 다른 학생들이 운동을 매개로 교류할 수 있는 장을 마련하여 학교 공동체 활성화에 기여하고자 합니다."
            ),
            "goals": (
                "기초 체력과 축구 기본기를 꾸준히 향상시키고, 포지션별 역할 이해와 팀 전술 수행 능력을 높이는 것을 목표로 합니다. "
                "정기 훈련, 자체 경기, 교내 친선전을 단계적으로 운영하여 참여 학생들이 협동심과 스포츠맨십을 체득하도록 하겠습니다."
            ),
            "competition_plan": (
                "교내 체육대회와 학과 간 친선 경기 참여를 우선 검토하고, 부원 구성과 훈련 수준에 따라 지역 또는 대학생 축구 대회 참가를 준비하겠습니다. "
                "대회 참가 여부와 일정은 실제 모집 공고와 학교 승인 절차를 확인한 뒤 확정하겠습니다."
            ),
            "operation_plan": (
                "주 1회 정기 훈련을 기본으로 하며, 훈련 전 준비운동과 안전 수칙 안내를 의무화합니다. "
                "주장, 기록 담당, 장비 담당을 지정해 출석과 장비 관리를 체계화하고, 월 1회 경기 리뷰를 통해 개선점을 공유하겠습니다."
            ),
            "budget_plan": (
                "지원금은 훈련 장비 보강, 경기 운영 물품, 응급 안전용품, 대회 참가 준비에 우선 사용하겠습니다. "
                "구체적인 금액은 학교 지원 기준과 실제 구매 가능 항목을 확인한 뒤 집행하겠습니다."
            ),
            "budget_items": "예상 항목: 축구공, 팀 조끼, 라바콘, 구급용품, 경기 기록지, 대회 참가 준비 물품",
            "monthly_plan": "신입 부원 모집, 기초 체력 점검, 패스·슈팅 기본기 훈련, 포지션별 전술 훈련, 교내 친선전 준비",
            "monthly_method": "정기 훈련, 조별 전술 연습, 자체 경기, 경기 후 피드백 회의, 안전 수칙 점검",
        }
    return {
        "motivation": (
            "본 동아리는 구성원들이 공동의 관심사를 바탕으로 학습과 실천을 함께 이어가기 위해 운영됩니다. "
            "정기적인 모임과 역할 분담을 통해 활동의 지속성을 높이고, 결과물을 학교 공동체 안에서 공유하는 것을 목표로 합니다."
        ),
        "goals": "정기 활동을 통해 구성원의 역량을 높이고, 활동 결과를 구체적인 산출물로 정리하는 것을 목표로 합니다.",
        "competition_plan": "참여 예정 프로그램과 외부 활동은 실제 공고와 학교 승인 절차를 확인한 뒤 확정하겠습니다.",
        "operation_plan": "주기적인 회의와 역할 분담을 통해 활동을 운영하고, 활동 결과를 기록해 다음 계획에 반영하겠습니다.",
        "budget_plan": "지원금은 활동 운영, 자료 준비, 결과물 제작 등 동아리 목적에 직접 필요한 항목에 사용하겠습니다.",
        "budget_items": "예상 항목: 회의 운영비, 자료 준비비, 활동 물품, 결과물 제작비",
        "monthly_plan": "구성원 모집, 활동 주제 확정, 자료 조사, 실행 활동, 결과 정리",
        "monthly_method": "정기 회의, 역할별 조사, 활동 기록, 결과 공유, 피드백 반영",
    }


def _infer_document_title(text: str) -> str:
    if "축구" in text:
        return "축구 동아리 신청서"
    return ""


def _infer_club_name(text: str) -> str:
    if "축구" in text:
        return "축구 동아리"
    return ""
