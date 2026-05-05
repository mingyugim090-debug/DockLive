# LiveDock UI/UX Guide

## Direction

LiveDock should feel like a focused student-friendly work tool, not a marketing page.

The v1 experience is:

1. Add announcement
2. See extracted requirements
3. Fill missing inputs
4. Generate section-level drafts
5. Review and confirm
6. Export final document

Community screens can borrow the concise rhythm of Everytime-style apps later, but v1 should prioritize document work.

## Layout Principles

- Mobile-first, desktop-friendly.
- Dense enough for repeated work.
- Keep the main workflow visible.
- Avoid decorative UI that competes with the document.
- Use cards for repeated items and framed tools only.
- Show errors and recovery actions close to the failed step.

## Core Screens

### Upload / Ingestion

- Input mode selector: PDF, URL, Text
- Optional user/team profile panel
- Clear backend readiness/error state
- Primary action: "Agent로 분석하고 워크플로우 만들기"

### Analysis Result

Tabs:

1. Analysis
2. Inputs
3. Drafts
4. Final

The analysis tab must show:

- Summary
- Timeline
- Required documents
- Eligibility
- Benefits
- Evaluation criteria
- Cautions
- Uncertain fields
- Source evidence

### Input Collection

- Each required user input appears as a form field.
- Required fields are marked.
- Missing required fields are summarized before draft generation.

### Drafting

- Drafts are shown by section.
- Each section supports feedback and revision.
- Confirmation-required claims are highlighted.
- Live streaming should be section-level, not an uncontrolled full-document stream.

### Final Document

- Show final markdown/text.
- Offer HTML export.
- Offer HWPX export when the backend HWPX toolchain is enabled.
- Remind users that final submission requires manual review.

## Visual Style

- Background: dark neutral.
- Primary action: indigo/purple.
- Warning: yellow.
- Error: red.
- Success: green.
- Border radius: 8-12px for app controls.
- Text should be compact and readable.

Avoid:

- Huge hero sections
- Marketing copy
- Decorative gradients that reduce legibility
- Community/feed UI before Agent MVP is reliable
