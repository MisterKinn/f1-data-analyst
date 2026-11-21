#!/usr/bin/env bash
# Publish a data refresh straight to main (owner 2026-11-21: refreshed data goes live without hand work).
# Run from a workflow job after the generators wrote their files:
#   scripts/publish-refresh.sh -m "commit message" -g "regenerate command" [-c "real-change test"] [-b branch-prefix] -- path...
# - stages the paths; stops when nothing changed (-c: a command that exits 0 only on a real change, e.g. not just a timestamp)
# - runs the CI checks (same as the `test` workflow); on failure pushes <prefix>-<time> and stops with the reason in the summary
# - pushes to main; when main moved meanwhile it resets to the new main, runs -g again (generated files are rebuilt,
#   never hand-merged) and retries, up to 3 times
# - asks the stored-views workflow to rebuild (a push made with GITHUB_TOKEN starts no other workflow by itself)
set -uo pipefail
msg=""; regen=""; changed=""; prefix="lapsim-learn/refresh"
while [ $# -gt 0 ]; do case "$1" in -m) msg=$2; shift 2;; -g) regen=$2; shift 2;; -c) changed=$2; shift 2;; -b) prefix=$2; shift 2;; --) shift; break;; *) break;; esac; done
paths=("$@"); summary=${GITHUB_STEP_SUMMARY:-/dev/stdout}
[ -n "$msg" ] && [ ${#paths[@]} -gt 0 ] || { echo "usage: publish-refresh.sh -m msg -g cmd [-c cmd] [-b prefix] -- paths..."; exit 2; }
git config user.name "github-actions[bot]"; git config user.email "41898283+github-actions[bot]@users.noreply.github.com"
checks() {
  npm ci --no-audit --no-fund >/dev/null && KONGBODA_FEATURES=all node --test tests/*.test.mjs >/tmp/checks.log 2>&1 \
    && node --test tests/features-off.test.mjs >>/tmp/checks.log 2>&1 && npm run build >>/tmp/checks.log 2>&1 && npm run validate >>/tmp/checks.log 2>&1
}
for attempt in 1 2 3; do
  if [ "$attempt" -gt 1 ]; then
    git fetch -q origin main && git reset -q --hard origin/main || exit 1
    echo "main moved: regenerating on $(git rev-parse --short HEAD)"; bash -c "$regen" || { echo "::error::regenerate failed"; exit 1; }
  fi
  git add -- "${paths[@]}"
  if git diff --cached --quiet -- "${paths[@]}"; then echo "No change" | tee -a "$summary"; exit 0; fi
  if [ -n "$changed" ] && ! bash -c "$changed"; then echo "Only build dates changed; nothing published" | tee -a "$summary"; git reset -q; exit 0; fi
  git commit -q -m "$msg"
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
