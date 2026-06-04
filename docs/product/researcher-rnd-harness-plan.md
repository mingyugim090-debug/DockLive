# University And Researcher R&D Harness Plan

Goal: extend the IRIS/government R&D MVP from company-only submission drafts to
university, researcher, and research-lab submission documents while preserving
the grounded notice-analysis and validated HTML/HWPX export path.

## Phase R0 - Contract Anchor

Status: done

- Add a compact fixture based on the uploaded 2026 bio/medical R&D HWPX notice.
- Keep the raw HWPX out of the repository.
- Represent the notice as `government_rnd` with `applicant_kind:
  university_researcher`.
- Preserve public-notice facts as source evidence: ministry, NRF, RFP, research
  topic, IRIS submission path, applicant deadlines, required attachments,
  evaluation criteria, and future schedule.

## Phase R1 - Researcher Input Collection

Status: done

- Ask for research-lab and researcher facts, not company-only facts.
- Required inputs include lead research institution/lab, principal
  investigator, project title, RFP alignment, research objectives, methodology,
  team and partner structure, DMP, budget plan, and expected outcomes.
- Do not duplicate missing questions already covered by those input fields.

## Phase R2 - Table-First Research Plan Drafting

Status: done

- Generate sections for business overview, RFP alignment, research objectives,
  methodology and execution plan, research team and collaboration system, data
  management plan, budget plan, outcomes, and submission checklist.
- Drafts must include tables for RFP summary, evaluation criteria, schedule,
  budget, attachments, and confirmation-required items.
- Notice facts remain source-grounded; research-lab claims only come from user
  inputs.

## Phase R3 - Export And Future Inline AI

Status: pending

- Reuse existing HTML/HWPX validation for table sections and extracted text.
- Keep Inline AI editing as the next product phase after the researcher harness
  is stable.
- Future Inline AI should stream section edits into the same `WorkflowSession`
  and `DraftSection` contract rather than creating a separate authoring model.
