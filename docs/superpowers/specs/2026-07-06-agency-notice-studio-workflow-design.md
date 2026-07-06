# Agency Notice Studio Workflow Redesign

Date: 2026-07-06

## Purpose

Redesign the agency notice studio so users start from the notice they want to
create, not from a fixed government-support-program form. The studio should let
the user choose a notice type step by step, collect only relevant inputs, suggest
IRIS or prior-notice references that match the chosen direction, and export a
less plain HWPX document that uses official-document blocks such as tables,
procedure grids, and notice boxes.

The motivating example is a CVR lab undergraduate researcher recruitment notice.
That user should not be asked for support-program-only fields such as budget,
legal basis, fair competition clauses, or appeal processes unless they explicitly
choose a government R&D/support-program notice type.

## Current Problems

- The current agency studio is organized as discover, brief, edit, review, and
  export. It already has IRIS discovery, but the first meaningful authoring step
  is still a support-program brief.
- The brief model is too rigid for smaller notice types such as lab or team
  recruitment. It asks for fields that are irrelevant to that workflow.
- The generated document is section-oriented and markdown-like. It does not yet
  consistently produce the dense table and boxed-guide structure seen in real
  IRIS HWPX notices.
- A sampled HFSP IRIS HWPX notice contains 25 tables, one image, 452 paragraphs,
  830 runs, 68 border fills, 274 character styles, and 120 paragraph styles. A
  plain section draft will feel visually thin beside that reference.

## Product Principles

- Start from user intent: ask what kind of notice the user wants to make before
  showing IRIS references.
- Reduce input burden: each notice type controls its own required and optional
  questions.
- Use references for structure, tone, and formatting patterns, not for invented
  facts.
- Keep missing facts explicit. Deadlines, budgets, legal bases, eligibility
  rules, organizations, and submission methods must remain confirmation-required
  unless provided by the user or grounded source material.
- Make the UI friendly and soft, while keeping the exported document credible
  and official enough for use.
- Preserve existing Ver2 responsibilities: agency drafts stay
  organization-scoped, versioned, reviewable, and exportable.

## Recommended Approach

Use a recipe-driven notice studio.

Each `NoticeRecipe` defines:

- notice type and label
- user-facing description
- required and optional input fields
- direction/tone choices
- recommended IRIS search terms or reference categories
- document block plan
- HWPX export style
- validation expectations

This avoids forcing every notice through the same `AgencyNoticeBrief` shape.

## User Workflow

The new studio has six stages:

1. Notice type
   The user chooses the kind of notice: lab/team recruitment, government
   R&D/support program, event/program participation, scholarship/education/camp,
   or custom.

2. Direction
   The user chooses the intended feel: official IRIS-like, friendly recruitment,
   concise campus notice, research-lab introduction, or custom guidance.

3. Focused inputs
   The studio shows only recipe-relevant questions. For `lab_recruitment`, this
   means lab introduction, target applicants, roles, required and preferred
   qualifications, activity period, application method, required materials, and
   contact.

4. References
   The studio recommends matching IRIS notices, prior notices, or uploaded HWPX
   forms. References are shown as reusable structural patterns, such as
   eligibility table, schedule table, application-method table, or notice box.

5. Block editor
   The draft is edited as an A4 document made of blocks. The right-side tooling
   offers actions such as add table, convert to schedule table, add notice box,
   and attach source trace.

6. Export
   The user downloads HWPX, with validation summary and fallback warnings when
   the HWPX toolchain cannot produce a validated file.

## Notice Recipes

### Lab Or Team Recruitment

Example: CVR lab undergraduate researcher recruitment notice.

Inputs:

- notice title
- lab/team name
- short lab introduction
- research topics or project themes
- target applicants
- number of openings, if known
- role and expected activities
- required qualifications
- preferred qualifications
- activity period and expected weekly commitment
- application documents
- application method
- deadline, if known
- contact
- notes or cautions

Hidden by default:

- budget
- legal basis
- fair competition clause
- privacy clause
- appeal process
- support amount
- government submission system

Default document blocks:

- title box
- recruitment overview table
- lab introduction notice box
- activity details table
- eligibility and preferred qualifications table
- application method table
- schedule table, if dates are provided
- notes box
- contact box

### Government R&D Or Support Program

Inputs:

- agency name
- notice title
- program purpose
- budget
- program period
- eligibility rules
- support details
- evaluation criteria
- submission method
- required documents
- contact
- legal basis
- privacy policy
- fair competition clause
- appeal process

Default document blocks:

- official notice number/title area
- program overview table
- support details table
- eligibility table
- application procedure table
- required documents table
- evaluation criteria table
- schedule table
- mandatory clauses box
- contact table

### Event Or Program Participation

Inputs:

- event/program name
- host
- purpose
- target participants
- schedule
- location or format
- participation benefit
- application method
- contact

Default document blocks:

- event overview table
- target participants table
- schedule table
- application method box
- benefits box
- contact box

### Scholarship, Education, Or Camp

Inputs:

- program name
- host
- target applicants
- selection size
- benefit
- education or activity period
- selection process
- required documents
- application method
- contact

Default document blocks:

- recruitment guide table
- benefit table
- selection process table
- required documents table
- application method table
- notes box

### Custom

The user writes a short description. The system recommends the nearest recipe
and shows which fields and blocks it will use before draft generation.

## Reference Matching

IRIS references should be selected after the recipe and direction are known.

Reference cards should expose:

- parsed title, agency, dates, and status when available
- matched reason, such as similar eligibility structure or schedule format
- reusable structure chips, such as `eligibility table`, `schedule table`,
  `procedure table`, `notice box`, and `submission documents table`
- source trace summary

The user may choose an entire reference or only specific structure chips.

For a CVR lab recruitment notice, relevant IRIS-derived patterns are:

- use `program purpose` sections as inspiration for lab/recruitment background
- use `application eligibility` tables for applicant qualification structure
- use `application period and documents` tables for application method
- use `schedule` tables for recruitment timeline
- use warning or preparation boxes for notes before application

Facts from references must not be copied unless explicitly selected as source
material and still appropriate for the new notice.

## HWPX Output Design

The export layer should not rely only on markdown paragraphs. It should receive
a block model that can be rendered to both preview UI and HWPX:

```text
DocumentBlock =
  titleBox
  infoTable
  scheduleTable
  eligibilityTable
  procedureTable
  documentListTable
  noticeBox
  paragraphSection
  contactBox
```

The block model should preserve:

- stable block ids
- title and role
- source traces
- confirmation-required markers
- table row and cell data
- style profile

HWPX generation must follow existing repository rules:

- HWPX is a ZIP/XML package.
- Official or complex forms should prefer clone/replace when using a supplied
  HWPX template.
- Newly generated content-style HWPX must use the repository HWPX toolchain and
  preserve required package structure.
- Run namespace fix and validation after generation when available.
- Extract text and check expected title/content before treating export as ready.
- Do not directly rewrite XML runs in a way that destroys tables, images, or
  style structure.

## UI Direction

The UI should be friendly without making the document itself unserious.

Recommended UI tone:

- soft step cards for type and direction selection
- short prompts instead of long administrative labels
- warm empty states and progress hints
- lightweight decorative accents in the app chrome only
- A4 preview remains official and table-first
- block chips and icon buttons for adding tables, boxes, and schedule blocks

Avoid:

- making the first screen a raw IRIS search list
- asking for irrelevant fields just because they exist in another notice type
- turning the exported document into a cute poster
- copying visual designs or wording from third-party services

## Data And API Shape

Add or adapt API contracts so `AgencyNoticeDraft` can carry recipe-aware input
and block output.

Candidate shapes:

```ts
type NoticeRecipeId =
  | "lab_recruitment"
  | "rnd_support"
  | "event_program"
  | "education_camp"
  | "custom";

interface NoticeRecipe {
  id: NoticeRecipeId;
  label: string;
  description: string;
  fields: RecipeField[];
  directionOptions: RecipeDirection[];
  recommendedReferenceQueries: string[];
  documentBlocks: RecipeBlockPlan[];
  exportStyle: "iris_official" | "friendly_lab" | "campus_notice";
}

interface AgencyNoticeDraft {
  recipe_id: NoticeRecipeId;
  direction_id: string;
  brief: Record<string, unknown>;
  blocks: DocumentBlock[];
  confirmation_required: string[];
}
```

Implementation should keep existing APIs compatible where possible. If contracts
change, update backend schemas, frontend types, API clients, fixtures, and tests
together.

## Grounding And Safety

- AI may rewrite or structure user-provided content, but cannot invent legal,
  financial, eligibility, deadline, organization, or submission facts.
- Missing facts are rendered as confirmation-required fields.
- Reference-derived sections must carry source traces.
- A user can choose to use only the formatting pattern of a reference.
- Live publication remains out of scope.
- IRIS discovery remains on-demand only with TTL cache, no login automation, no
  background bulk crawling, and offline tests with fixtures.

## Acceptance Criteria

1. The studio starts with notice type selection, not IRIS discovery.
2. Choosing `lab_recruitment` exposes lab/team recruitment questions and hides
   government support-program-only fields.
3. A CVR lab undergraduate researcher sample can be drafted with recruitment
   overview, activity details, eligibility, application method, and contact
   blocks.
4. The document preview shows table and notice-box blocks rather than only
   markdown-like paragraphs.
5. Reference selection appears after type and direction choices and presents
   reusable structure chips.
6. Generated HWPX for the lab sample contains at least one table and expected
   title text.
7. Generated HWPX passes namespace fix, package validation, and text extraction
   checks when the toolchain is available.
8. The government R&D/support-program path still supports mandatory clause
   checks, source traces, approval workflow, and export.
9. Existing Ver1 applicant-facing workflows are not removed or degraded.
10. No unsupported facts are introduced into generated notices.

## Testing Plan

Frontend component tests:

- recipe step renders before IRIS discovery
- `lab_recruitment` hides support-program-only fields
- direction selection changes reference recommendations
- block editor renders table blocks and notice boxes
- source trace panel still works for selected blocks

Backend contract tests:

- recipe-specific draft generation creates the expected section/block ids
- lab recruitment does not require budget, legal basis, or appeal process
- government R&D still enforces mandatory-clause checks
- missing dates or contacts remain confirmation-required

HWPX tests:

- CVR lab fixture exports HWPX with nonzero table count
- extracted text contains notice title and application method
- validation summary is returned with warnings or pass status
- official template clone paths preserve table count when a source HWPX is used

Harness gates:

- frontend profile for UI work
- backend or quick profile for schema/service changes
- hwpx profile for HWPX export behavior
- full profile before merging cross-stack implementation

## Scope Notes

This design is a single implementation initiative but can be split into phases:

1. Add recipe model and recipe-driven UI flow with mock draft blocks.
2. Add backend recipe-aware draft generation and contract tests.
3. Add block-based document preview and editing tools.
4. Add HWPX block renderer and HWPX validation gates.
5. Polish friendly UI tone and empty states.

Do not add community, feed, recruiting marketplace, live publication, government
identity provider integration, or background IRIS crawling as part of this work.

