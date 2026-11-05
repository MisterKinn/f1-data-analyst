#!/bin/bash
# Refresh <ROOT>/collector from GitHub main (macOS/Linux). Skips while a session is being
# recorded (data/active-window.json exists) unless --force. New code is installed only when
# collector-release.json carries the owner's release signature for exactly these files
# (checked with the verifier and keys already installed; see release_verify.py).
set -euo pipefail
ROOT="${1:-$HOME/Library/Application Support/Kongboda}"
ZIP_URL="${KONGBODA_ZIP_URL:-https://codeload.github.com/MisterKinn/f1-data-analyst/zip/refs/heads/main}"
if [ -f "$ROOT/data/active-window.json" ] && [ "${2:-}" != "--force" ]; then echo 'Recording in progress; update skipped.'; exit 0; fi
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$ZIP_URL" -o "$TMP/main.zip"
unzip -q "$TMP/main.zip" -d "$TMP"
SRC=$(find "$TMP" -maxdepth 2 -type d -name collector | head -n 1)
[ -f "$SRC/host_runner.py" ] || { echo 'Downloaded code has no host_runner.py'; exit 1; }
MANIFEST="$(dirname "$SRC")/collector-release.json"
PY="$ROOT/venv/bin/python"
if [ -f "$ROOT/collector/release_verify.py" ] && [ -x "$PY" ]; then
  if ! "$PY" "$ROOT/collector/release_verify.py" check "$SRC" "$MANIFEST" "$ROOT/collector/host/release-keys.txt"; then
    echo 'Unsigned or changed code: update refused.'; exit 0
  fi
fi
if [ -f "$ROOT/data/release.json" ] && [ -f "$MANIFEST" ] && cmp -s "$ROOT/data/release.json" "$MANIFEST"; then
  echo 'Collector code is current.'; exit 0
fi
mkdir -p "$ROOT/collector" "$ROOT/data"
rsync -a --delete "$SRC/" "$ROOT/collector/"
[ -f "$MANIFEST" ] && cp "$MANIFEST" "$ROOT/data/release.json"
# Packages added in later versions (keyring keeps the F1 password in the macOS Keychain).
if [ -x "$PY" ] && ! "$PY" -c 'import keyring' 2>/dev/null; then "$PY" -m pip install -q keyring || true; fi
# Power-saving AWS servers book their own wake-up with boto3 (collector/power.py).
if [ -x "$PY" ] && grep -q '^POWER_SAVE=aws' "$ROOT/host.env" 2>/dev/null && ! "$PY" -c 'import boto3' 2>/dev/null; then "$PY" -m pip install -q boto3 || true; fi
echo 'Collector code updated.'
