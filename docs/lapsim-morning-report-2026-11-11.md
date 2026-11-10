# Morning report — 11 November 2026
Status checked at approximately 07:34 KST. Work remains in progress; no candidate is adopted.

## Durable save
Before the 07:28 limit, all available checkpoints, completed main fits, completed folds and logs were saved to PR #154 branch feat/lapsim-wec-timing at commit 203e22850e355539241f2c2d30eb36a9d1224304.
Archive: scripts/sim/results/vegas-owner-save-2026-11-11/checkpoints-and-logs.tar.gz.
SHA256: 58feef22a9bdf8e1e1edb92e5aaa80da4de645343129d34357213e92d94d1a11.
69 files; incomplete fits are labelled partial. Resume from these states or newer Actions artifacts, never restart completed work.

## Blocks
| Block | Status | Key result | Review |
|---|---|---|---|
| 0 | Complete; candidate rejected | WEC control RMS 1.166709%, candidate 1.179080%, n=33; candidate main converged at round 7 | PR #154 |
| 1 | Complete; owner revision saved | Fold stops at first nonnegative score decrease <1% or own main convergence round, whichever first. Main-fit rule unchanged. | PR #154, rules §5.1 |
| 2 | Running on fork; paired result incomplete | Both main fits: 6 rounds. Three completed folds per arm; ten unfinished fold jobs continue independently. Partial 2025 held-out RMS control 0.842106%, candidate 0.861934%, n=16 each; not a final gate result. | PR #154; Actions below |
| 3 | Prior comparison complete/rejected; independent confirmation at R running | Historical control 1.166709%, BoP 1.271006%, sector2 1.196784%, n=33. New confirmation has no final result yet. | PR #154; separate sector recovery below |
| 4 | Hypercar rejected; LMGT3 parked | Hypercar all-model RMS 1.391909% to 1.314548%, n=22, but class-best results worse than production. LMGT3 hit 2000-iteration cap. | PR #154 |
| 5 | Complete | 41 team-season tests, 82 Monza laps; correct gear distance 79.857–83.439%. Absolute gear ratios remain unknown. | PR #154 |

## Preserved fold rounds
Fold indices are zero-based.
| Arm | Main | 2025 fold 0 | 2025 fold 1 | 2025 fold 2 | 2025 fold 3 | 2026 folds 0–3 |
|---|---:|---:|---:|---:|---|---|
| Control | 6 | 6 | 5 | 6 | 1 saved round; resumed | Running |
| Candidate | 6 | 5 | 6 | 6 | 1 saved round; resumed | Running |
Completed folds remain unchanged. New round-limit stops must be labelled separately from numerical convergence.

## Active fork runs
- F1 and independent WEC control/BoP: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913368752
- WEC sector2 recovery: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913698920
- Final F1 checkpoint export, waiting for existing jobs: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42914814278
- The original sector2 job failed before fitting due to an older eligibility table; recovery uses the frozen original Block 3 table. Preserve the failure record.
- A duplicate launch, run 42914964554, was discovered after another session's active runs were found. Its branch was changed to cancel that duplicate through concurrency and retain the earlier runs. Do not use this duplicate as the canonical continuation.
- Exact checkpoint/input hashes and recovery instructions: docs/lapsim-actions-handoff-2026-11-11.md.
- Fork only. No workflow was added to the production repository.

## Verification and decisions
438 tests passed with external network blocked. Before launch, all 45 production/gate hashes matched; F1 39 dry rows and WEC 33 dry rows reproduced production with maximum error 0 seconds.
PR: https://github.com/MisterKinn/f1-data-analyst/pull/154
Dry-source guard draft: https://github.com/MisterKinn/f1-data-analyst/pull/155
Owner decisions: review reusable code in #154 and draft guard #155. No model adoption decision is ready for incomplete Block 2. Existing failed candidates remain rejected; no approval is needed to continue the already-authorized fork jobs.
No merge, production or Vercel change.
