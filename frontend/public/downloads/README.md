# Agent downloads

This folder is a local staging area for Agent download packages. The deployed
frontend links to the public InsForge Storage bucket `agent-downloads` instead
of serving these ZIP files from the frontend source bundle.

Generated Agent binaries and ZIP packages are intentionally ignored by git.
Create and upload these files before deploying the frontend:

- `DockLiveAgent-windows.zip`
- `DockLiveAgent-mac.zip`

Use `docklive-inline-agent/scripts/package_agent_downloads.ps1` from the
repository root to refresh the Windows ZIP and the macOS bootstrap ZIP.
The generated ZIP files are excluded from frontend deployments by
`frontend/.vercelignore`.

For production releases, see
`docklive-inline-agent/docs/RELEASE_SIGNING.md` and replace the bootstrap
packages with signed/notarized releases.
