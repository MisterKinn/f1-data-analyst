# Partial checkpoint save — 2026-11-11

Owner-authorized immediate save to the PR #154 branch, before the local time limit.

`checkpoints-and-logs.tar.gz` contains every available checkpoint and log from the original run and both local continuation attempts, with exact runner source snapshots and production reproduction audits. `manifest.json` records SHA-256 for every archived file.

Each arm's `main-fit-checkpoint.json` is its completed six-round main fit (all fitted parameter vectors, track factors, team/development adjustments and objective history). `fit-2.json` and `fit-3.json` are the two previously completed held-out folds. Later fit files are explicitly partial unless their own status says otherwise. These are optimizer checkpoints; final exported calibration and full validation are not yet available.

No production values were adopted. No merge or Vercel action. The main fit and finished folds are preserved; the owner's new fold stopping rule will apply only to unfinished folds.
