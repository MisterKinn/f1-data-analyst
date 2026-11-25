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

- `npm ci && KONGBODA_FEATURES=all node --test tests/*.test.mjs && node --test tests/features-off.test.mjs && npm run build && npm run validate` (as CI does; without `KONGBODA_FEATURES=all` about 26 tests of hidden live-timing pages fail, which is not a regression)
- Python collector tests need `fastf1` and `signalrcore`; failures from missing packages locally are not regressions (CI installs them).
- When a change touches existing files that main may have changed, rebase on the latest `upstream/main` and rerun the tests.

## After merge

- Check the live result with Firecrawl (owner rule), e.g. the changed page or `/api/rules/state`, `/api/...` JSON.
- Rules and race-document monitor: Actions → "Rules and race-document monitor" → Run workflow (optional `source`, `force`). Docs: knowledge/RULES.md.

## Model honesty (owner rule, permanent; 2026-11-26)

LapSim model changes follow these rules. Source: claude.ai Project `claude/decision-central-0838-real-aero-no-lap-tuning-2026-11-26.md`.

1. **No lap-only tuning.** No parameter may be moved just to lower lap-time error. Every fitted value must also match its physical source (measured, rule, press) within its stated window. Lap time is a check, not the target.
2. **Real aero is fixed by its source.** F1: measured power and CdA (step 2a), ClA from a physical window (L/D 2.5–4.5). WEC Hypercar: ClA ≈ 4.15 m² (press window 4.05–4.25, tight prior), CdA from traps, BoP power at the wheel. LMGT3: rule wheel power, iRacing-derived priors (labelled). A fit that pushes an aero value out of its window is a FAIL, whatever the lap error.
3. **Leftover error is explained by physics or labelled.** It is never absorbed by aero. What can't be explained becomes a data limit with ±.
4. **Shipping.** The page keeps the shipped model until the honest model passes the gate. Then the honest model replaces it.
5. Every session and every future change follows this section.

Related rules (details in the Project):
- **Honest gate** (central 2026-11-25 19:35, `claude/decision-central-gate-honest-2026-11-25.md`): paired held-out lap harm one-sided 95 % UB ≤ 0.15 pp, no row worse than +1.0 pp, no fitted parameter at a bound (within 0.5 %). `LAPSIM_GATE=honest` in `scripts/sim/pipeline-report.mjs` where present.
- **Lane C** (central 2026-11-26 05:50, `claude/decision-central-0550-scoring-rules-2026-11-26.md`): kernel-fix-only changes ship with 0 new test failures, lap UB ≤ 0.10 pp per series and class, no track > +1.0 pp, no new bound hit vs shipped.
- **Rule A** (same doc): a scoreboard row whose shipped car has a fitted parameter at a bound scores at most 50 % of its weight.
- **Measured-derived = measured** (07:31, restored 08:35, `claude/decision-central-0835-merge-old-central-2026-11-26.md`): published timing/telemetry channels and values computed from them by a fixed, documented method (deceleration from speed, line radius from x/y, flap-open point, utilisation ratios such as the 0.66–0.73 band) are never changed, tuned or dropped; changing the method needs a pre-registration and the old values stay stored. Brake on/off timing is measured; brake amount inside "on", brake bias, disc temperature and fitted kernel parameters (μx/μy, ClA, k …) are model and labelled "model". Report-only screens may scan model parameters.

## Owner preferences

- Chat replies in English (B1–B2, concise) even when the content is Korean.
- Enter the repo directly without asking; do the merge yourself.
- Release patches are also saved to the claude.ai Project under `claude/release/` when a push is not possible.

## Plugins for this repo

- **Graphify**: a SessionStart hook (`scripts/graphify-hook.mjs`) installs `graphifyy` if needed and rebuilds the code map in `graphify-out/` (AST only, free, not committed). Before grepping or reading many files, run `graphify query "<question>"`, `graphify explain "<name>"` or `graphify path "<A>" "<B>"`. Read raw files only for lines the graph located. Put this rule in subagent prompts that explore code.
- **Ponytail** (`ponytail@ponytail`, enabled in `.claude/settings.json`): keep changes small, reuse existing code and the standard library. Run `/ponytail-review` on the diff before opening a PR.
- **cua-driver** runs on the owner's PC; use it only as a fallback when the built-in browser cannot create or merge a PR.
- OmniRoute is not used (the site barely calls AI models).
