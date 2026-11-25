#!/usr/bin/env bash
# One command: bash scripts/sim/scoreboard/build.sh [out.md]
# Reads step 32's committed traces from the fork branch step32-empirical (read-only), then scores rows.json.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
git -C "$here" fetch -q --depth 1 https://github.com/kangjeongmin1229/f1-data-analyst-deploy step32-empirical
for f in traces-top10 normalisation; do git -C "$here" show "FETCH_HEAD:scripts/sim/data/step32/$f.json" > "$tmp/$f.json"; done
python3 -I "$here/apex_floor.py" "$tmp/traces-top10.json" "$tmp/normalisation.json" > "$tmp/floors.json"
python3 -I "$here/score.py" "$here/rows.json" "$tmp/floors.json" > "${1:-/dev/stdout}"
