# Agent Release Signing

DockLive Agent is a local desktop program. Browser and OS trust prompts are
controlled by Windows SmartScreen and macOS Gatekeeper, not by the web app.

## Windows

Build a signed Windows release when an Authenticode code-signing certificate is
available:

```powershell
$env:WINDOWS_CERT_SHA1 = "<certificate-thumbprint>"
powershell -ExecutionPolicy Bypass -File docklive-inline-agent\scripts\build_agent_exe.ps1
powershell -ExecutionPolicy Bypass -File docklive-inline-agent\scripts\package_agent_downloads.ps1
```

If `signtool.exe` is not on `PATH`, set `WINDOWS_SIGNTOOL_PATH`.

Unsigned `.exe` downloads can trigger Edge's "not commonly downloaded" warning.
DockLive serves the user-facing Windows release as `DockLiveAgent-windows.zip`
to avoid direct executable downloads, but a fully warning-free production
experience requires a reputable signed binary.

## macOS

Build, sign, notarize, and package on macOS:

```bash
export APPLE_DEVELOPER_ID_APPLICATION="Developer ID Application: Your Company (TEAMID)"
export APPLE_NOTARY_PROFILE="docklive-notary"
bash docklive-inline-agent/scripts/build_agent_app_macos.sh
```

`APPLE_NOTARY_PROFILE` should be created once with `xcrun notarytool
store-credentials`.

Without Developer ID signing and notarization, macOS may require the user to
allow the app in System Settings > Privacy & Security. The Windows-generated
bootstrap ZIP is only a fallback for making the download path usable until the
native notarized artifact is produced on a Mac build machine.
