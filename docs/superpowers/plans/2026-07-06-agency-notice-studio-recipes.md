# Agency Notice Studio Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a recipe-driven agency notice studio where users choose a notice type and direction first, then fill only relevant fields, select matching references, edit table/box blocks, and export validated HWPX.

**Architecture:** Keep Ver2 Agency NoticeOps APIs compatible by adding optional recipe fields and block output to the existing `AgencyNoticeBrief` and `AgencyNoticeDraft` contracts. The frontend owns the guided six-stage studio and recipe metadata; the backend owns grounded section/block generation and HWPX export conversion.

**Tech Stack:** FastAPI/Pydantic backend, Next.js 14 React frontend, Vitest/Testing Library, Python unittest contracts, existing HWPX XML toolchain, InsForge CLI frontend deployments.

---

## File Map

- Modify `backend/models/schemas.py`: add recipe ids, lab-specific brief fields, `AgencyNoticeBlock`, and optional draft block metadata.
- Modify `backend/services/agency_noticeops.py`: branch draft generation for `lab_recruitment`, preserve support-program clause behavior, and convert blocks into `NoticeDocument.documentModel` for export.
- Modify `backend/tests/contracts/test_agency_noticeops_contracts.py`: add recipe contract tests before backend implementation.
- Create `frontend/lib/noticeRecipes.ts`: recipe catalog, direction options, field metadata, reference chips, and default brief helper.
- Modify `frontend/lib/types.ts`: mirror backend recipe/block types.
- Modify `frontend/components/agency/AgencyStudio.tsx`: six-stage recipe workflow.
- Modify `frontend/components/agency/NoticeBriefForm.tsx`: render recipe fields instead of fixed support-program groups.
- Modify `frontend/components/agency/IrisNoticeFeed.tsx`: accept recommended keyword/chips after recipe selection.
- Modify `frontend/components/agency/NoticeDocumentEditor.tsx`: render `draft.blocks` as table and notice-box blocks when present.
- Modify `frontend/__tests__/agency-studio.test.tsx`: add tests for type-first flow, lab-specific fields, reference chips, and block preview.

## Task 1: Backend Recipe Contract

**Files:**
- Modify: `backend/tests/contracts/test_agency_noticeops_contracts.py`
- Modify: `backend/models/schemas.py`
- Modify: `backend/services/agency_noticeops.py`

- [ ] **Step 1: Write failing lab recipe tests**

Add tests proving a CVR lab brief produces lab sections/blocks and does not require budget/legal/appeal fields:

```python
def test_lab_recruitment_recipe_creates_focused_blocks_without_support_program_fields(self):
    brief = AgencyNoticeBrief(
        recipe_id="lab_recruitment",
        direction_id="friendly_recruitment",
        organization_id=str(uuid4()),
        author_id="cvr-student",
        author_name="CVR lab",
        title="CVR 연구실 학부연구생 모집공고",
        agency_name="CVR 연구실",
        lab_name="CVR 연구실",
        lab_intro="컴퓨터 비전과 로보틱스 지능을 연구합니다.",
        research_topics="3D vision, robot perception",
        target_applicants="컴퓨터공학 전공 학부생",
        openings="2명 내외",
        activities="논문 리뷰, 데이터셋 정리, 실험 보조",
        required_qualifications="Python 기초",
        preferred_qualifications="PyTorch 경험",
        activity_period="2026년 9월부터 6개월",
        weekly_commitment="주 8시간",
        submission_method="이메일 접수",
        required_documents=["자기소개서", "성적표"],
        contact="cvr@example.edu",
    )

    draft = create_agency_notice_draft(brief)

    self.assertEqual(draft.recipe_id, "lab_recruitment")
    self.assertEqual(draft.direction_id, "friendly_recruitment")
    self.assertEqual(draft.mandatory_clause_checks, [])
    self.assertFalse(any("예산" in item or "법적" in item or "이의" in item for item in draft.confirmation_required))
    self.assertTrue(any(block.type == "infoTable" for block in draft.blocks))
    self.assertTrue(any(block.type == "noticeBox" for block in draft.blocks))
    self.assertIn("CVR 연구실", "\n".join(section.content_markdown for section in draft.sections))
```

- [ ] **Step 2: Run test to verify RED**

Run: `python -m unittest backend.tests.contracts.test_agency_noticeops_contracts.AgencyNoticeOpsContractTests.test_lab_recruitment_recipe_creates_focused_blocks_without_support_program_fields`

Expected: FAIL because `recipe_id`, lab fields, or `blocks` do not exist.

- [ ] **Step 3: Add schema fields**

Add optional recipe fields to `AgencyNoticeBrief`, `AgencyNoticeDraft`, and `AgencyNoticeBlock` in `backend/models/schemas.py`:

```python
NoticeRecipeId = Literal["lab_recruitment", "rnd_support", "event_program", "education_camp", "custom"]
NoticeBlockType = Literal["titleBox", "infoTable", "scheduleTable", "eligibilityTable", "procedureTable", "documentListTable", "noticeBox", "paragraphSection", "contactBox"]

class AgencyNoticeBlock(BaseModel):
    id: str
    type: NoticeBlockType
    title: str = ""
    role: str = ""
    body: str = ""
    rows: list[list[str]] = Field(default_factory=list)
    source_evidence_ids: list[str] = Field(default_factory=list)
    source_traces: list[AgencySourceTrace] = Field(default_factory=list)
    confirmation_required: list[str] = Field(default_factory=list)
```

- [ ] **Step 4: Add lab generation branch**

In `create_agency_notice_draft`, use `brief.recipe_id == "lab_recruitment"` to build lab sections, empty mandatory clause checks, lab confirmation items, and lab blocks. Keep the current support-program path unchanged for all other recipes.

- [ ] **Step 5: Run backend contract test to verify GREEN**

Run the same unittest command. Expected: PASS.

## Task 2: Backend HWPX Block Export

**Files:**
- Modify: `backend/tests/contracts/test_agency_noticeops_contracts.py`
- Modify: `backend/services/agency_noticeops.py`

- [ ] **Step 1: Write failing export conversion test**

Add a test that converts a lab draft to `NoticeDocument` and asserts `documentModel` contains a table block and title.

```python
def test_lab_recruitment_export_document_uses_document_model_tables(self):
    brief = AgencyNoticeBrief(recipe_id="lab_recruitment", title="CVR 연구실 학부연구생 모집공고", lab_name="CVR 연구실", submission_method="이메일 접수", contact="cvr@example.edu")
    draft = create_agency_notice_draft(brief)
    document = agency_notice_to_notice_document(draft)
    blocks = document.documentModel["pages"][0]["blocks"]
    self.assertEqual(document.title, "CVR 연구실 학부연구생 모집공고")
    self.assertTrue(any(block["type"] == "table" for block in blocks))
```

- [ ] **Step 2: Run test to verify RED**

Run that single unittest. Expected: FAIL because `documentModel` is missing for agency lab drafts.

- [ ] **Step 3: Implement `AgencyNoticeBlock` to HWPX document model conversion**

Add helper functions in `agency_noticeops.py` that map `infoTable`, `scheduleTable`, `eligibilityTable`, `documentListTable`, and `contactBox` to `HwpxTableBlock` dictionaries and map `titleBox`, `noticeBox`, and `paragraphSection` to heading/paragraph blocks.

- [ ] **Step 4: Run test to verify GREEN**

Run the single unittest. Expected: PASS.

## Task 3: Frontend Recipe Metadata And Tests

**Files:**
- Create: `frontend/lib/noticeRecipes.ts`
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/__tests__/agency-studio.test.tsx`

- [ ] **Step 1: Write failing frontend tests**

Add tests that render `AgencyStudio`, expect `studio-stage-type` first, choose `lab_recruitment`, and confirm budget/legal/appeal inputs are absent while lab fields are visible.

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- agency-studio.test.tsx`

Expected: FAIL because the current studio starts at IRIS discovery.

- [ ] **Step 3: Add recipe catalog**

Create `NOTICE_RECIPES`, `getNoticeRecipe`, `makeDefaultAgencyNoticeBrief`, and `applyRecipeDefaults` with recipe ids and field mappings. Include `lab_recruitment`, `rnd_support`, `event_program`, `education_camp`, and `custom`.

- [ ] **Step 4: Mirror TypeScript contract**

Add `NoticeRecipeId`, `NoticeDirectionOption`, `NoticeRecipeField`, `AgencyNoticeBlock`, and optional recipe/lab fields to `frontend/lib/types.ts`.

- [ ] **Step 5: Run frontend test to verify GREEN for metadata**

Run: `npm test -- agency-studio.test.tsx`

Expected: tests still fail only where UI has not yet been implemented.

## Task 4: Six-Stage Frontend Studio

**Files:**
- Modify: `frontend/components/agency/AgencyStudio.tsx`
- Modify: `frontend/components/agency/NoticeBriefForm.tsx`
- Modify: `frontend/components/agency/IrisNoticeFeed.tsx`
- Modify: `frontend/components/agency/NoticeDocumentEditor.tsx`

- [ ] **Step 1: Implement type and direction stages**

Change stages to `type`, `direction`, `inputs`, `references`, `edit`, `review`, `export`. Selecting a recipe updates `brief.recipe_id`, sets the first direction, and moves to direction.

- [ ] **Step 2: Implement recipe fields**

Render fields from `NoticeRecipe.fields`. For `lab_recruitment`, show lab/team inputs and hide support-only fields. Keep support-program fields when `rnd_support` is chosen.

- [ ] **Step 3: Move IRIS references after direction**

Render `IrisNoticeFeed` only in the `references` stage and pass recommended keyword/chips from the selected recipe/direction.

- [ ] **Step 4: Render block preview**

In `NoticeDocumentEditor`, if `draft.blocks` exists, render blocks as title boxes, tables, notice boxes, paragraph sections, and contact boxes. Fall back to the existing section markdown renderer for old drafts.

- [ ] **Step 5: Run frontend test to verify GREEN**

Run: `npm test -- agency-studio.test.tsx`

Expected: PASS.

## Task 5: Verification And InsForge Deploy

**Files:**
- No source files unless build/deploy config requires a minimal adjustment.

- [ ] **Step 1: Run backend quick contracts**

Run: `.\scripts\harness.ps1 -Profile quick`

Expected: PASS.

- [ ] **Step 2: Run frontend build gate**

Run: `.\scripts\harness.ps1 -Profile frontend`

Expected: PASS.

- [ ] **Step 3: Verify InsForge deployment env**

Run: `npx @insforge/cli deployments env list --json`

Expected: required frontend env keys such as `NEXT_PUBLIC_API_URL` are configured. Do not print secret values.

- [ ] **Step 4: Deploy frontend source**

Run: `npx @insforge/cli deployments deploy frontend --json`

Expected: deployment reaches `READY` and returns a live URL.

- [ ] **Step 5: Record deployment memory**

Run: `npx @insforge/cli memory remember "Agency Notice Studio recipe workflow deployed from codex/agency-notice-studio-recipes on 2026-07-06. Frontend starts with notice type/direction, supports lab recruitment inputs, block preview, and HWPX export via existing backend." --kind decision --title "Agency notice studio recipe deploy"`

Expected: memory command succeeds.

## Self-Review

- Spec coverage: recipe-first flow, lab recruitment fields, reference-after-direction flow, table/box blocks, HWPX export model, government R&D preservation, and InsForge deployment are covered.
- Placeholder scan: this plan avoids TBD/TODO wording and names concrete files, commands, and expected results.
- Type consistency: `recipe_id`, `direction_id`, `blocks`, `AgencyNoticeBlock`, and `documentModel` are used consistently across backend and frontend tasks.
