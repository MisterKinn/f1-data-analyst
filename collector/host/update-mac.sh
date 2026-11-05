#!/bin/bash
# Refresh <ROOT>/collector from GitHub main (macOS/Linux). Skips while a session is being
# recorded (data/active-window.json exists) unless --force.
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
mkdir -p "$ROOT/collector"
rsync -a --delete "$SRC/" "$ROOT/collector/"
echo 'Collector code updated.'
