#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python -m pip install -r requirements-wec.txt
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.wec-browsers"
python -m playwright install --only-shell chromium
# Fail the build if the existing native runtime lacks a required browser library.
python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    browser.close()
print('WEC browser runtime verified (no provider login attempted).')
PY
