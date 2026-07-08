#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f ".env" ]]; then
  echo "warning: .env is missing; AGENT_PROXY_TOKEN will not be bundled." >&2
fi

python3 -m pip install -q pyinstaller

pyinstaller_args=(
  --noconfirm
  --windowed
  --name DockLiveAgent
  --paths src
  --collect-submodules uvicorn
  --collect-data xlwings
)

if [[ -f ".env" ]]; then
  pyinstaller_args+=(--add-data ".env:.")
fi

pyinstaller_args+=(src/tray.py)

python3 -m PyInstaller "${pyinstaller_args[@]}"

if [[ -n "${APPLE_DEVELOPER_ID_APPLICATION:-}" ]]; then
  codesign --force --deep --options runtime --sign "$APPLE_DEVELOPER_ID_APPLICATION" dist/DockLiveAgent.app
  echo "Code signed dist/DockLiveAgent.app"
else
  echo "warning: APPLE_DEVELOPER_ID_APPLICATION is missing; macOS may show a Gatekeeper warning." >&2
fi

rm -f dist/DockLiveAgent-mac.zip
ditto -c -k --sequesterRsrc --keepParent dist/DockLiveAgent.app dist/DockLiveAgent-mac.zip

if [[ -n "${APPLE_NOTARY_PROFILE:-}" ]]; then
  xcrun notarytool submit dist/DockLiveAgent-mac.zip --keychain-profile "$APPLE_NOTARY_PROFILE" --wait
  xcrun stapler staple dist/DockLiveAgent.app
  rm -f dist/DockLiveAgent-mac.zip
  ditto -c -k --sequesterRsrc --keepParent dist/DockLiveAgent.app dist/DockLiveAgent-mac.zip
  echo "Notarized and stapled dist/DockLiveAgent.app"
else
  echo "warning: APPLE_NOTARY_PROFILE is missing; notarization was skipped." >&2
fi

echo "Build complete: dist/DockLiveAgent-mac.zip"
