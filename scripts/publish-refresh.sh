#!/usr/bin/env bash
# Publish a data refresh straight to main (owner 2026-11-21: refreshed data goes live without hand work).
# Run from a workflow job after the generators wrote their files:
#   scripts/publish-refresh.sh -m "commit message" -g "regenerate command" [-c "real-change test"] [-b branch-prefix] [-k] -- path...
# - stages the paths; stops when nothing changed (-c: a command that exits 0 only on a real change, e.g. not just a timestamp)
# - runs the CI checks (same as the `test` workflow); on failure pushes <prefix>-<time> and stops with the reason in the summary
# - pushes to main; when main moved meanwhile it resets to the new main, runs -g again (generated files are rebuilt,
#   never hand-merged) and retries, up to 3 times. -k (fetched data that does not depend on main: lap tables read from the web):
#   keep the files already written across the reset instead of fetching again (a 45 min refetch outlived the job limit)
# - asks the stored-views workflow to rebuild (a push made with GITHUB_TOKEN starts no other workflow by itself)
# Gate G (AGENTS.md): refreshes are data fixes and ship even if held-out error rises, but every commit carries one line with held-out
# RMS before/after on the same rows (scripts/heldout-line.mjs). A model setting (lapsim-data.yml flags, calibrate.mjs, kernel.js,
# cars.js) is a model change: never published here; it goes to a branch for Session C with the experiment numbers.
set -uo pipefail
msg=""; regen=""; changed=""; prefix="lapsim-learn/refresh"; keep=""
while [ $# -gt 0 ]; do case "$1" in -m) msg=$2; shift 2;; -g) regen=$2; shift 2;; -c) changed=$2; shift 2;; -b) prefix=$2; shift 2;; -k) keep=1; shift;; --) shift; break;; *) break;; esac; done
paths=("$@"); summary=${GITHUB_STEP_SUMMARY:-/dev/stdout}
[ -n "$msg" ] && [ ${#paths[@]} -gt 0 ] || { echo "usage: publish-refresh.sh -m msg -g cmd [-c cmd] [-b prefix] -- paths..."; exit 2; }
git config user.name "github-actions[bot]"; git config user.email "41898283+github-actions[bot]@users.noreply.github.com"
checks() {
  npm ci --no-audit --no-fund >/dev/null && KONGBODA_FEATURES=all node --test tests/*.test.mjs >/tmp/checks.log 2>&1 \
    && node --test tests/features-off.test.mjs >>/tmp/checks.log 2>&1 && npm run build >>/tmp/checks.log 2>&1 && npm run validate >>/tmp/checks.log 2>&1
}
for attempt in 1 2 3; do
  if [ "$attempt" -gt 1 ]; then
    if [ -n "$keep" ]; then
      saved=$(mktemp -d); for p in "${paths[@]}"; do [ -e "$p" ] && mkdir -p "$saved/$(dirname "$p")" && cp -a "$p" "$saved/$p"; done
      git fetch -q origin main && git reset -q --hard origin/main || exit 1
      cp -a "$saved/." . && rm -rf "$saved"; echo "main moved: kept the fetched files on $(git rev-parse --short HEAD)"
    else
      git fetch -q origin main && git reset -q --hard origin/main || exit 1
      echo "main moved: regenerating on $(git rev-parse --short HEAD)"; bash -c "$regen" || { echo "::error::regenerate failed"; exit 1; }
    fi
  fi
  git add -- "${paths[@]}"
  if git diff --cached --quiet -- "${paths[@]}"; then echo "No change" | tee -a "$summary"; exit 0; fi
  if [ -n "$changed" ] && ! bash -c "$changed"; then echo "Only build dates changed; nothing published" | tee -a "$summary"; git reset -q; exit 0; fi
  model=$(git diff --cached --name-only | grep -E '^(\.github/workflows/lapsim-data\.yml|scripts/sim/calibrate\.mjs|worker/lapsim/(kernel|cars)\.js)$' || true)
  if [ -n "$model" ]; then
    git commit -q -m "$msg (model change, not published)"; b="$prefix-model-$(date -u +%Y%m%d-%H%M)"; git push -q origin HEAD:"refs/heads/$b"
    { echo "Model change, not published (Gate G): $model"; echo "Branch: $b — hand to Session C with the experiment numbers."; } | tee -a "$summary"; exit 3
  fi
  # LapSim × BoPSim × SetupSim (owner 2026-11-21): a change to a Hypercar maker input rebuilds the per-maker table in the same commit;
  # the script's held-out and "BoP-fastest" lines (bopRank 1 of a track changed) go to the commit and run summary (the refresh log)
  maker=""
  if git diff --cached --name-only | grep -qE "^(scripts/sim/data/learn/endurance-cars\.csv\.gz|worker/lapsim/(wec-bop|bop-estimate|bop-virtual|calibration|learned|tracks)-data\.js)$"; then
    if [ -f scripts/sim/learn/hypercar-makers.mjs ]; then
      out=$(node scripts/sim/learn/hypercar-makers.mjs --write) || { echo "::error::hypercar-makers.mjs failed"; exit 1; }
      git add -- worker/lapsim/hypercar-maker-data.js; maker=$(grep -iE 'held-out|BoP-fastest' <<<"$out" || true)
    else echo "::warning::Hypercar maker input changed but scripts/sim/learn/hypercar-makers.mjs is not on main yet"; fi
  fi
  # step 29b: a changed calibration rebuilds the Δ ranges (±) in the same commit
  if git diff --cached --name-only | grep -qx worker/lapsim/calibration-data.js && [ -f scripts/sim/delta-intervals.mjs ]; then
    node scripts/sim/delta-intervals.mjs --run "${GITHUB_RUN_ID:-local}" --mode refit || { echo "::error::delta-intervals.mjs failed"; exit 1; }
    git add -- worker/lapsim/delta-intervals-data.js
  fi
  mkdir -p .gate-tmp && git show origin/main:worker/lapsim/calibration-data.js > .gate-tmp/before.js 2>/dev/null || rm -f .gate-tmp/before.js
  held=$(node scripts/heldout-line.mjs .gate-tmp/before.js worker/lapsim/calibration-data.js 2>/dev/null || true); rm -rf .gate-tmp
  git commit -q -m "$msg" ${held:+-m "$held"} ${maker:+-m "$maker"}
  [ -n "$held" ] && echo "$held" >> "$summary"; [ -n "$maker" ] && echo "$maker" >> "$summary"
  if ! ${PUBLISH_CHECKS:-checks}; then
    b="$prefix-$(date -u +%Y%m%d-%H%M)"; git push -q origin HEAD:"refs/heads/$b"
    { echo "Checks failed, not published. Branch: $b"; echo '```'; tail -40 /tmp/checks.log; echo '```'; } >> "$summary"; exit 1
  fi
  if git push -q origin HEAD:main; then
    echo "Published to main: $(git rev-parse --short HEAD) — $msg" >> "$summary"
    if [ -n "${GH_TOKEN:-}" ]; then gh workflow run lapsim-views.yml --ref main >/dev/null 2>&1 || echo "::warning::could not start the stored-views rebuild"; fi
    exit 0
  fi
done
echo "::error::main kept moving; not published after 3 tries"; exit 1
