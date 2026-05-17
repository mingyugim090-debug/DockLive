# Environment Setup

## Local Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

For mock mode:

```env
MOCK_MODE=true
OPENAI_API_KEY=
```

For real Agent mode:

```env
MOCK_MODE=false
OPENAI_API_KEY=sk-proj-...
```

## Local Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

## InsForge

Create a project and prepare:

- Backend base URL
- anon key
- API key for server-side backend access
- storage bucket: `livedock-documents`

Run the InsForge schema import before enabling production persistence:

```bash
npx @insforge/cli db import docs/engineering/insforge-schema.sql
npx @insforge/cli storage create-bucket livedock-documents --private
```

Production persistence should use InsForge. Redis/in-memory is only a temporary fallback.

## HWPX Skill

The skill was installed from:

```text
https://github.com/jkf87/hwpx-skill
```

Local path on this machine:

```text
C:\Users\alseh\.codex\skills\hwpx
```

After installing a new Codex skill, restart Codex to have it appear in the active skill list.

Do not copy the full `hwpx` skill into the LiveDock repository. It is a Codex/global toolchain, not app source code. LiveDock should reference it through `HWPX_SKILL_DIR` locally and install the same toolchain in the backend deployment environment when HWPX export is enabled.

Backend HWPX export requires:

```env
HWPX_EXPORT_ENABLED=true
HWPX_SKILL_DIR=C:\Users\alseh\.codex\skills\hwpx
```

Required Python dependencies:

```bash
pip install python-hwpx lxml
pip install pyhwp5 olefile
```

## GitHub

Use GitHub for source control and future CI:

- Run frontend build on PR
- Run backend compile/schema checks on PR
- Add eval fixture checks before release

## Vercel

Vercel hosts the frontend. Set:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
NEXT_PUBLIC_INSFORGE_BASE_URL=https://your-app.region.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your_insforge_anon_key
```
