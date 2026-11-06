# Claude Code guide — Kongboda Motorsports

Read AGENTS.md and docs/answer-principles.md first; they are the product rules.

## Where to work (PC, web or phone)

- Production repo: `MisterKinn/f1-data-analyst`. A merge to `main` deploys automatically (Vercel Git integration). Do not deploy through Vercel directly.
- Claude Code sessions push to the owner's fork `kangjeongmin1229/f1-data-analyst-deploy` (the Claude GitHub App has access there), then open a PR into `MisterKinn/f1-data-analyst:main`.
- The fork's `main` is synced from upstream every hour by `.github/workflows/sync-fork.yml`. Every scheduled workflow job except sync-fork must have `if: github.repository == 'MisterKinn/f1-data-analyst'` so it does not also run on the fork. Always branch from `upstream/main` anyway:
  `git remote add upstream https://github.com/MisterKinn/f1-data-analyst && git fetch upstream main && git checkout -b <branch> upstream/main`
- If the PR cannot be created or merged through the GitHub connector (403 for the upstream repo), use the browser: open
  `https://github.com/MisterKinn/f1-data-analyst/compare/main...kangjeongmin1229:f1-data-analyst-deploy:<branch>?expand=1`, create the PR, wait for the `test` check, then merge. The owner wants merges done without asking each time.
- The Vercel status on fork PRs ("Authorization required to deploy") is only the preview build; production deploys from `main`.

## Before every PR

- `npm ci && node --test tests/*.test.mjs && npm run build && npm run validate`
- Python collector tests need `fastf1` and `signalrcore`; failures from missing packages locally are not regressions (CI installs them).
- When a change touches existing files that main may have changed, rebase on the latest `upstream/main` and rerun the tests.

## After merge

- Check the live result with Firecrawl (owner rule), e.g. the changed page or `/api/rules/state`, `/api/...` JSON.
- Rules and race-document monitor: Actions → "Rules and race-document monitor" → Run workflow (optional `source`, `force`). Docs: knowledge/RULES.md.

## Owner preferences

- Chat replies in English (B1–B2, concise) even when the content is Korean.
- Enter the repo directly without asking; do the merge yourself.
- Release patches are also saved to the claude.ai Project under `claude/release/` when a push is not possible.

## Plugins for this repo

- **Graphify**: a SessionStart hook (`scripts/graphify-hook.mjs`) installs `graphifyy` if needed and rebuilds the code map in `graphify-out/` (AST only, free, not committed). Before grepping or reading many files, run `graphify query "<question>"`, `graphify explain "<name>"` or `graphify path "<A>" "<B>"`. Read raw files only for lines the graph located. Put this rule in subagent prompts that explore code.
- **Ponytail** (`ponytail@ponytail`, enabled in `.claude/settings.json`): keep changes small, reuse existing code and the standard library. Run `/ponytail-review` on the diff before opening a PR.
- **cua-driver** runs on the owner's PC; use it only as a fallback when the built-in browser cannot create or merge a PR.
- OmniRoute is not used (the site barely calls AI models).
