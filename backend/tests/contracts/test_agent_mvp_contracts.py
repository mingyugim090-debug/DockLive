import json
import os
import sys
import unittest
from unittest.mock import patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MOCK_MODE", "true")

try:
    from core.config import settings  # noqa: E402
    from models.schemas import (  # noqa: E402
        AnalysisResult,
        DocumentStyleProfile,
        ExportListResponse,
        ExportMetadata,
        HwpxStatusResponse,
        NoticeDocument,
        NoticeExportRequest,
    )
    from services.ai_provider import provider_name, should_use_mock_ai  # noqa: E402
    from services.analyzer import build_analysis_result  # noqa: E402
    from services.document_ingestion import convert_hwp_to_hwpx, ingest_uploaded_document  # noqa: E402
    from services.drafting_service import (  # noqa: E402
        build_template_replacements,
        clone_hwpx_template,
        confirm_workflow,
        create_hwpx_placeholder_map,
        create_workflow_session,
        export_markdown_to_hwpx,
        finalize_document,
        generate_drafts,
        get_hwpx_toolchain_status,
        stream_draft_events,
        update_inputs,
    )
    from services.hwpx_compose_service import (  # noqa: E402
        WITHUS_TEMPLATE_ID,
        compose_hwpx,
        detect_template,
    )
    from services.mock_data import get_mock_result  # noqa: E402
    from services.storage import list_export_files, load_export_file, save_export_file  # noqa: E402
except ModuleNotFoundError as exc:  # pragma: no cover - local minimal Python fallback
    if exc.name != "pydantic":
        raise
    settings = None
    AnalysisResult = None
    DocumentStyleProfile = None
    ExportMetadata = None
    ExportListResponse = None
    HwpxStatusResponse = None
    NoticeDocument = None
    NoticeExportRequest = None
    provider_name = None
    should_use_mock_ai = None
    build_analysis_result = None
    build_template_replacements = None
    create_hwpx_placeholder_map = None
    clone_hwpx_template = None
    confirm_workflow = None
    create_workflow_session = None
    export_markdown_to_hwpx = None
    finalize_document = None
    generate_drafts = None
    get_hwpx_toolchain_status = None
    stream_draft_events = None
    update_inputs = None
    ingest_uploaded_document = None
    convert_hwp_to_hwpx = None
    get_mock_result = None
    list_export_files = None
    load_export_file = None
    save_export_file = None
    WITHUS_TEMPLATE_ID = None
    compose_hwpx = None
    detect_template = None

try:
    from services.hwpx_template_analysis import analyze_hwpx_template_bytes  # noqa: E402
except ModuleNotFoundError:
    analyze_hwpx_template_bytes = None


class AgentMvpContractTests(unittest.TestCase):
    def test_ai_provider_uses_mock_when_mock_mode_enabled(self):
        if should_use_mock_ai is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        self.assertIn(provider_name(), {"openai", "gemma"})
        self.assertTrue(should_use_mock_ai())

    def test_fixture_metadata_is_complete(self):
        fixture_dir = ROOT / "docs" / "evaluation" / "fixtures"
        fixtures = sorted(fixture_dir.glob("*.json"))
        self.assertEqual(len(fixtures), 5)

        for path in fixtures:
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertTrue(data["announcement_text"])
            self.assertIn("expected", data)
            self.assertIn("fail_if", data)
            self.assertIn("uncertainty_rule", data)

    def test_mock_analysis_result_validates_with_required_contracts(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        restored = AnalysisResult(**result.model_dump(mode="json"))

        self.assertEqual(restored.doc_type, "startup")
        self.assertIn("청년 창업", restored.title)
        self.assertTrue(restored.organization)
        self.assertGreaterEqual(len(restored.checklist), 1)
        self.assertGreaterEqual(len(restored.document_template), 1)
        self.assertGreaterEqual(len(restored.source_evidence), 1)
        self.assertGreaterEqual(len(restored.missing_questions), 1)

    def test_export_metadata_contract(self):
        if ExportMetadata is None:
            self.skipTest("pydantic is not installed in this Python environment")
        metadata = ExportMetadata(
            id="export-1",
            workflow_id="workflow-1",
            filename="final.html",
            content_type="text/html; charset=utf-8",
            export_type="html",
            size_bytes=1024,
            created_at="2026-05-13T00:00:00Z",
        )
        response = ExportListResponse(success=True, data=[metadata])
        self.assertEqual(response.data[0].workflow_id, "workflow-1")
        self.assertEqual(response.data[0].export_type, "html")
        self.assertEqual(response.data[0].status, "success")

    def test_notice_export_accepts_document_style_profile_contract(self):
        if NoticeExportRequest is None or DocumentStyleProfile is None:
            self.skipTest("pydantic is not installed in this Python environment")

        style_profile = DocumentStyleProfile(
            id="official-preserve",
            name="공식 양식 보존",
            description="공식 HWPX 구조를 유지합니다.",
            mode="preserve-official-form",
            colors={
                "primary": "#245D50",
                "primarySoft": "#F3F8F5",
                "accent": "#6A9C89",
                "accentSoft": "#EEF7F2",
                "text": "#142033",
                "muted": "#65736E",
                "border": "#C5D1CC",
                "surface": "#FFFFFF",
                "tableHeaderBg": "#F3F7F5",
                "tableHeaderText": "#24312D",
            },
            typography={
                "fontFamily": "system-ui",
                "titleSize": "24px",
                "titleWeight": 800,
                "headingWeight": 800,
                "bodySize": "13px",
                "lineHeight": "1.75",
            },
            section={"headingStyle": "plain-underlined", "spacing": "normal"},
            table={"headerStyle": "preserve", "borderColor": "#C5D1CC", "zebra": False, "density": "comfortable"},
            preview={
                "pageBackground": "#E2E8E5",
                "documentBackground": "#FFFFFF",
                "selectedOutline": "#245D50",
                "note": "검토 UI에 제한 적용",
            },
        )
        document = NoticeDocument(
            documentType="notice",
            title="계약 테스트 공고",
            organization="DockLive",
            purpose="스타일 프로필 계약 확인",
        )
        request = NoticeExportRequest(document=document, style_profile=style_profile)

        self.assertEqual(request.style_profile.id, "official-preserve")
        self.assertEqual(request.style_profile.mode, "preserve-official-form")
        self.assertEqual(request.document.title, "계약 테스트 공고")

    def test_hwpx_status_contract(self):
        if HwpxStatusResponse is None:
            self.skipTest("pydantic is not installed in this Python environment")
        status = HwpxStatusResponse(**get_hwpx_toolchain_status())
        self.assertIsInstance(status.scripts_found, dict)
        self.assertIn("validate.py", status.scripts_found)
        self.assertIsInstance(status.warnings, list)

    def test_export_file_fallback_can_list_and_reload(self):
        if save_export_file is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        workflow_id = "contract-export-workflow"
        row = save_export_file(
            workflow_id,
            "contract.html",
            "<h1>계약 테스트</h1>".encode("utf-8"),
            "text/html; charset=utf-8",
            "contract_html",
            validation_summary={"validation_passed": True},
        )

        self.assertIsNotNone(row)
        exports = list_export_files(workflow_id)
        self.assertTrue(any(item["id"] == row["id"] for item in exports))
        self.assertEqual(row["status"], "success")
        self.assertTrue(row["validation_summary"]["validation_passed"])
        loaded = load_export_file(workflow_id, row["id"])
        self.assertIsNotNone(loaded)
        self.assertIn("계약 테스트".encode("utf-8"), loaded["content"])

    def test_mock_workflow_reaches_final_document(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        workflow = create_workflow_session(result)
        updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}

        workflow = update_inputs(workflow, updates)
        workflow = generate_drafts(workflow)
        self.assertEqual(workflow.status, "reviewing")
        self.assertTrue(all(draft.content_markdown for draft in workflow.draft_sections))
        self.assertTrue(all(draft.confirmation_required is not None for draft in workflow.draft_sections))

        workflow = confirm_workflow(workflow)
        workflow = finalize_document(workflow)
        self.assertEqual(workflow.status, "finalized")
        self.assertIsNotNone(workflow.final_document)
        self.assertIn("제출 전 확인 필요", workflow.final_document.content_markdown)

    def test_mock_stream_draft_events_emit_section_done(self):
        if AnalysisResult is None or stream_draft_events is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        workflow = create_workflow_session(result)
        updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}
        workflow = update_inputs(workflow, updates)

        events = list(stream_draft_events(workflow))
        event_types = [event["type"] for event in events]

        self.assertIn("section_done", event_types)
        self.assertEqual(event_types[-1], "workflow_done")
        self.assertTrue(any(event.get("draft_section") for event in events))

    def test_hwpx_upload_ingestion_extracts_text_with_fallback(self):
        if ingest_uploaded_document is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        sample = ROOT / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx"

        ingested = ingest_uploaded_document(sample.read_bytes(), sample.name)

        self.assertEqual(ingested.source_type, "hwpx")
        self.assertGreater(len(ingested.text), 20)
        self.assertEqual(ingested.source_name, sample.name)

    def test_hwp_conversion_preserves_converter_warnings(self):
        if convert_hwp_to_hwpx is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        import subprocess

        from services import document_ingestion

        def fake_run(command, **kwargs):
            script_name = Path(command[1]).name
            if script_name == "convert_hwp.py":
                output_path = Path(command[command.index("-o") + 1])
                output_path.write_bytes(b"PK\x03\x04converted")
                return subprocess.CompletedProcess(
                    command,
                    0,
                    stdout=json.dumps(
                        {
                            "output": str(output_path),
                            "conversion_method": "preview-text-to-hwpx-fallback",
                            "warnings": ["fallback warning"],
                        },
                        ensure_ascii=False,
                    ),
                    stderr="",
                )
            return subprocess.CompletedProcess(command, 0, stdout="ok", stderr="")

        with patch.object(document_ingestion.subprocess, "run", side_effect=fake_run):
            content, warnings = convert_hwp_to_hwpx(b"hwp bytes", "sample.hwp")

        self.assertEqual(content, b"PK\x03\x04converted")
        self.assertIn("fallback warning", warnings)
        self.assertTrue(any("HWP 원본을 HWPX로 변환" in warning for warning in warnings))

    def test_hwpx_template_analysis_preserves_table_spans_and_blank_cells(self):
        if analyze_hwpx_template_bytes is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        sample = ROOT / "backend" / "hwpx_toolchain" / "templates" / "reference.hwpx"

        analysis = analyze_hwpx_template_bytes(sample.read_bytes(), sample.name)
        cells = [
            cell
            for block in analysis["blocks"]
            if block["type"] == "table"
            for row in block["rows"]
            for cell in row
        ]

        self.assertTrue(str(analysis.get("preview_image", "")).startswith("data:image/"))
        self.assertTrue(any(cell["col_span"] > 1 or cell["row_span"] > 1 for cell in cells))
        self.assertTrue(any(cell["text"] == "" for cell in cells))

    def test_markdown_hwpx_export_returns_zip_package(self):
        if export_markdown_to_hwpx is None:
            self.skipTest("backend dependencies are not installed in this Python environment")

        filename, content = export_markdown_to_hwpx("# 테스트 문서\n\n본문입니다.", "테스트 문서")

        self.assertTrue(filename.endswith(".hwpx"))
        self.assertGreater(len(content), 500)
        self.assertEqual(content[:2], b"PK")

    def test_template_replacements_include_final_document_and_sections(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        workflow = create_workflow_session(result)
        updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}
        workflow = update_inputs(workflow, updates)
        workflow = finalize_document(generate_drafts(workflow))

        replacements = build_template_replacements(workflow, {"동아리명": "LiveDock"})
        self.assertIn("{{content}}", replacements)
        self.assertIn("청년 창업", replacements["{{announcement_title}}"])
        self.assertIn("LiveDock", replacements["동아리명"])
        self.assertTrue(any(key.startswith("{{section:") for key in replacements))

    def test_hwpx_placeholder_map_contains_brief_contract_keys(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        workflow = create_workflow_session(result)
        updates = {field.id: f"{field.label} 테스트 입력" for field in workflow.user_inputs if field.required}
        workflow = finalize_document(generate_drafts(update_inputs(workflow, updates)))

        placeholder_map, warnings = create_hwpx_placeholder_map(workflow)

        self.assertIn("{title}", placeholder_map)
        self.assertIn("{applicant_name}", placeholder_map)
        self.assertIn("{section_1_title}", placeholder_map)
        self.assertIn("{section_1_content}", placeholder_map)
        self.assertIsInstance(warnings, list)

    def test_hwpx_clone_requires_enabled_toolchain(self):
        if AnalysisResult is None:
            self.skipTest("pydantic is not installed in this Python environment")
        result = build_analysis_result(get_mock_result(), source_type="demo", source_name="mock")
        workflow = finalize_document(
            generate_drafts(
                update_inputs(
                    create_workflow_session(result),
                    {
                        "applicant_name": "LiveDock",
                        "applicant_profile": "문서 자동화 팀",
                        "project_summary": "공고 분석과 제출 문서 자동화",
                    },
                )
            )
        )

        old_enabled = settings.HWPX_EXPORT_ENABLED
        try:
            settings.HWPX_EXPORT_ENABLED = False
            with self.assertRaises(Exception) as ctx:
                clone_hwpx_template(b"PK\x03\x04", workflow)
            self.assertIn("HWPX", str(ctx.exception))
        finally:
            settings.HWPX_EXPORT_ENABLED = old_enabled

    def test_withus_sample_template_is_detected(self):
        if detect_template is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        sample = ROOT / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx"
        self.assertEqual(detect_template(sample), WITHUS_TEMPLATE_ID)

    def test_hwpx_compose_requires_enabled_toolchain(self):
        if compose_hwpx is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        sample = ROOT / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx"
        old_enabled = settings.HWPX_EXPORT_ENABLED
        try:
            settings.HWPX_EXPORT_ENABLED = False
            with self.assertRaises(Exception) as ctx:
                compose_hwpx(sample.read_bytes(), "HWPX 자동 작성 테스트 요청입니다. 샘플 양식을 채워 주세요.")
            self.assertIn("HWPX", str(ctx.exception))
        finally:
            settings.HWPX_EXPORT_ENABLED = old_enabled

    def test_hwpx_compose_generates_base64_with_mock_fields(self):
        if compose_hwpx is None:
            self.skipTest("backend dependencies are not installed in this Python environment")
        sample = ROOT / "docs" / "examples" / "withus-hwpx" / "withus-sample-filled.hwpx"
        skill_dir = Path.home() / ".codex" / "skills" / "hwpx"
        if not skill_dir.exists():
            self.skipTest("hwpx skill is not installed")

        old_enabled = settings.HWPX_EXPORT_ENABLED
        old_skill_dir = settings.HWPX_SKILL_DIR
        old_mock = settings.MOCK_MODE
        try:
            settings.HWPX_EXPORT_ENABLED = True
            settings.HWPX_SKILL_DIR = str(skill_dir)
            settings.MOCK_MODE = True
            response = compose_hwpx(
                sample.read_bytes(),
                "HWPX 자동작성 MVP를 검증하는 AI 문서 자동화 동아리 신청서를 만들어 주세요.",
                "대표자 김라이브, 미래통합대학교 인공지능융합학과",
                "LiveDock HWPX 자동작성 MVP",
            )
            self.assertTrue(response["success"])
            self.assertEqual(response["template_id"], WITHUS_TEMPLATE_ID)
            self.assertEqual(response["encoding"], "base64")
            self.assertGreater(len(response["content"]), 1000)
            self.assertTrue(response["verification"]["validation_passed"])
            self.assertTrue(response["verification"]["text_contains_generated_content"])
        finally:
            settings.HWPX_EXPORT_ENABLED = old_enabled
            settings.HWPX_SKILL_DIR = old_skill_dir
            settings.MOCK_MODE = old_mock


if __name__ == "__main__":
    unittest.main()
