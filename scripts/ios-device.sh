#!/usr/bin/env bash
# Bundled iOS install over USB. No shared Wi-Fi with the Mac.
# Usage: npm run ios:device
#        npm run ios:device -- "iPad Air 11 RJ"

set -euo pipefail

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export APPLE_DEVELOPMENT_TEAM="${APPLE_DEVELOPMENT_TEAM:-3LAHNFWNT3}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WANTED_NAME="${1:-}"
JSON="$(mktemp -t easy-notes-devices)"
BUILD_LOG="$(mktemp -t easy-notes-ios-build)"
trap 'rm -f "$JSON" "$BUILD_LOG"' EXIT

xcrun devicectl list devices --json-output "$JSON" >/dev/null

DEVICE="$(
	python3 - "$JSON" "$WANTED_NAME" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
wanted = sys.argv[2].strip()
devices = data.get("result", {}).get("devices", [])
pads = []
for device in devices:
    hardware = device.get("hardwareProperties") or {}
    props = device.get("deviceProperties") or {}
    conn = device.get("connectionProperties") or {}
    if hardware.get("deviceType") != "iPad":
        continue
    if hardware.get("reality") != "physical":
        continue
    if conn.get("pairingState") != "paired":
        continue
    udid = hardware.get("udid")
    name = props.get("name") or ""
    if not udid:
        continue
    pads.append((conn.get("transportType") == "wired", name, udid))
if wanted:
    match = [item for item in pads if item[1] == wanted]
    if not match:
        names = ", ".join(item[1] for item in pads) or "none"
        raise SystemExit(f'iPad "{wanted}" not found. Paired iPads: {names}')
    print(f"{match[0][1]}\t{match[0][2]}")
    raise SystemExit(0)
pads.sort(key=lambda item: (not item[0], item[1]))
if not pads:
    raise SystemExit("No paired physical iPad found. Connect it with USB and trust this Mac.")
print(f"{pads[0][1]}\t{pads[0][2]}")
PY
)"

DEVICE_NAME="${DEVICE%%	*}"
DEVICE_UDID="${DEVICE#*	}"
echo "Installing Easy Notes on ${DEVICE_NAME} (${DEVICE_UDID}) over USB."

if [[ ! -f src-tauri/gen/apple/project.yml ]]; then
	npx tauri ios init --ci --skip-targets-install
fi

python3 - <<'PY'
from pathlib import Path
path = Path("src-tauri/gen/apple/project.yml")
text = path.read_text()
old = "--configuration ${CONFIGURATION:?} ${FORCE_COLOR} ${ARCHS:?}"
new = "--configuration ${CONFIGURATION:?} ${ARCHS:?}"
if old in text:
    path.write_text(text.replace(old, new, 1))
    print("Patched iOS xcode-script (dropped FORCE_COLOR).")
PY

ICON_SRC="src-tauri/icons/ios"
ICON_DST="src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset"
if [[ -d "$ICON_SRC" && -d "$ICON_DST" ]]; then
	cp -f "$ICON_SRC"/*.png "$ICON_DST/"
	echo "Copied iOS app icons into Xcode assets."
fi

(
	cd src-tauri/gen/apple
	xcodegen generate
)

set +e
npx tauri ios run --no-watch "$DEVICE_NAME" 2>&1 | tee "$BUILD_LOG"
set -e
if ! grep -q "BUILD SUCCEEDED" "$BUILD_LOG"; then
	echo "iOS build failed." >&2
	exit 1
fi

shopt -s nullglob
apps=( "$HOME"/Library/Developer/Xcode/DerivedData/easy-notes-*/Build/Products/debug-iphoneos/"Easy Notes.app" )
if [[ ${#apps[@]} -eq 0 ]]; then
	echo "Built app not found under DerivedData." >&2
	exit 1
fi
APP="${apps[0]}"

xcrun devicectl device uninstall app --device "$DEVICE_UDID" com.renejesser.easynotes >/dev/null 2>&1 || true
xcrun devicectl device install app --device "$DEVICE_UDID" "$APP"
xcrun devicectl device process launch --device "$DEVICE_UDID" com.renejesser.easynotes
echo "Easy Notes is running on ${DEVICE_NAME}."
