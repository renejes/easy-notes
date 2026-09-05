#!/usr/bin/env bash
# Signed, notarized macOS DMG (native arch, here Apple Silicon).
# Usage:
#   APPLE_ID=… APPLE_PASSWORD=… APPLE_TEAM_ID=3LAHNFWNT3 npm run macos:release

set -euo pipefail

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${APPLE_PASSWORD:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
	export APPLE_PASSWORD="$APPLE_APP_SPECIFIC_PASSWORD"
fi

: "${APPLE_ID:?Set APPLE_ID to the Apple ID email}"
: "${APPLE_PASSWORD:?Set APPLE_PASSWORD to an app-specific password}"
export APPLE_TEAM_ID="${APPLE_TEAM_ID:-3LAHNFWNT3}"
export APPLE_SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-Developer ID Application: Rene Jesser (3LAHNFWNT3)}"

npx tauri build --bundles app,dmg

BUNDLE_ROOT="${CARGO_TARGET_DIR:-$ROOT/src-tauri/target}/release/bundle"
shopt -s nullglob
dmgs=("$BUNDLE_ROOT"/dmg/*.dmg)
if [[ ${#dmgs[@]} -eq 0 ]]; then
	echo "No DMG under $BUNDLE_ROOT/dmg." >&2
	exit 1
fi
DMG="${dmgs[0]}"
APP="$BUNDLE_ROOT/macos/Easy Notes.app"

if ! xcrun stapler validate "$DMG" >/dev/null 2>&1; then
	echo "Staple missing — submitting the DMG to Apple notarization."
	xcrun notarytool submit "$DMG" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
	xcrun stapler staple "$DMG"
	if [[ -d "$APP" ]]; then
		xcrun stapler staple "$APP"
	fi
fi

DEST="$HOME/Desktop/$(basename "$DMG")"
cp -f "$DMG" "$DEST"
xcrun stapler validate "$DEST"
codesign --verify --deep --strict --verbose=2 "$APP"
echo "Installer: $DEST"
