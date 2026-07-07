# LiveDock Desktop

Electron shell for the Windows-first LiveDock desktop experience.

The shell starts the local FastAPI backend, the Next.js frontend, and passes the
Excel helper path through environment variables. The first route loaded is
`/app/projects`, so the existing project workspace remains the product entry.
The backend receives `LIVEDOCK_EXCEL_HELPER_DIR` and
`LIVEDOCK_EXCEL_HELPER_PYTHON`, then uses the helper for Excel open/sync actions
instead of requiring COM dependencies in server deployments.

## Requirements

- Windows with Microsoft Excel for the Excel automation loop.
- Python dependencies from the backend.
- Frontend dependencies from `frontend/package.json`.
- Electron installed in this package when running the desktop app.

## Commands

```powershell
npm install
npm run dev
```

The app stores local desktop workspaces under Electron `userData/workspaces` and
keeps generated Excel files outside committed source.
