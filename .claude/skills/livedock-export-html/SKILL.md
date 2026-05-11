---
name: livedock-export-html
description: Use when LiveDock needs an editable HTML export from a finalized markdown document, especially when no HWPX template is provided or HWPX validation fails.
---

# LiveDock Export HTML

HTML은 편집 가능한 fallback입니다. 공식 한국 문서 최종 목표는 HWPX지만, HWPX 도구나 검증이 실패하면 사용자에게 빈 결과를 주지 않기 위해 HTML을 제공합니다.

## When To Use

- No HWPX/HWP template was uploaded.
- User explicitly wants editable HTML.
- HWPX export or validation failed after retry.

Do not choose HTML as the main path when the user provided an official HWPX/HWP form.

## Preconditions

- Draft sections have been generated.
- Important `confirmation_required` items were shown to the user.
- The workflow has been finalized through the backend.

## API

```http
GET /api/workflow/{workflow_session_id}/export/html
```

The backend returns:

```json
{
  "success": true,
  "filename": "livedock_export.html",
  "content_type": "text/html; charset=utf-8",
  "content": "<!doctype html>...",
  "encoding": "text"
}
```

## Rules

- Preserve section headings and markdown hierarchy.
- Keep confirmation warnings in the document.
- Use UTF-8.
- Keep the output human-readable for editing.
- Clearly tell the user that HTML is fallback when HWPX validation failed.
