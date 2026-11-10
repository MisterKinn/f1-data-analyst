# Fork checkpoint continuation — 2026-11-11

Status at 07:22 KST: running, not accepted or fully validated.

- Source: kangjeongmin1229/f1-data-analyst-deploy, `exp/lapsim-owner-jobs-2026-11-11`.
- F1 + WEC run: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913368752 (commit c4a2b9f4ba107b5e2b1655de1a370e37092fb033).
- Sector-only recovery: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913698920 (commit 70c680db6121d98527765a6ad056430926553457).
- Archived checkpoints: commit 203e22850e355539241f2c2d30eb36a9d1224304, `scripts/sim/results/vegas-owner-save-2026-11-11/`; archive SHA256 58feef22a9bdf8e1e1edb92e5aaa80da4de645343129d34357213e92d94d1a11.

Both main fits converged in six rounds. Three finished folds per arm were replayed without refitting and uploaded as artifacts. Ten unfinished folds are computing independently. The revised fold rule stops at nonnegative score decrease <1% or that arm's main-fit round count, whichever comes first; report cap stops separately from numerical convergence. Inner iterations remain 200. Existing settings and production files are unchanged.

WEC control and BoP started independently at R=1e-4, cap=2000. Sector2 initially failed before fitting because the runner selected an older eligibility table. The recovery uses the exact original Block 3 table, hash 7f7a91620cf845b5b19d408e8f376e35d48370632a2675871061ea4bc094c6f6. All eligibility input hashes and 99 row entries were checked locally before restart. No table was recalculated or selected from results. The other active jobs were not restarted.

Verification: 45 production/gate file hashes and 12 original input hashes passed; two fold-rule unit tests passed; preserved control 2025 fold 0 and candidate 2025 fold 2 replayed successfully. Original prelaunch 436 tests/build/validation passed. Production dry reproduction: F1 39 rows and WEC 33 rows, max error 0 seconds. The WEC job also reproduced all six production class-season groups exactly before fitting.

Next: download artifacts from both runs. Keep complete original main fits plus all eight fold states per arm. Export paired F1 calibrations by replaying checkpoints (no new fit), verify training/options digests, run exact dry reproduction, report n and RMS by season, physical checks and paired gate. The generic workflow summary deliberately does not claim acceptance, and its first-run sector failure must be reconciled with the separate recovery run. Preserve all failures. No candidate adoption, merge, main or Vercel action.

Restart instructions: use the pinned branch commit and Node 22.23.4. Download archives from `scripts/sim/owner-actions-plan.json`, with filenames `.cache/owner-inputs.tgz` and `.cache/owner-checkpoints.tar.gz`; the runner verifies hashes. Run `node scripts/sim/owner-f1-actions.mjs fold <control|candidate> <2025|2026> <0..3>` or `node scripts/sim/owner-f1-actions.mjs wec <control|bop|sector2>` in an isolated checkout. Use the recovery commit for sector2. Before restarting a later interrupted fold, carry its newest artifact checkpoint into a newly pinned archive and update the plan; the initial archive alone would restart from the pre-Actions checkpoint. Do not run duplicate jobs while Actions is active.
