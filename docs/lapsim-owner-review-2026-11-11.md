# LapSim owner review — 2026-11-11 07:42 KST

Status: partial; active fits untouched. This report does not adopt a model.

## Failed sector attempt
Run 42913368752, job 130169443782 failed at scripts/sim/wec-eligibility.mjs:71:
`throw new Error(`Fixed WEC eligibility input mismatch: ${key}`);`
Error: Fixed WEC eligibility input mismatch: geometry.
All six production WEC reproduction groups passed before this failure (33 rows, maximum 0 seconds).

The runner selected the older eligibility file. Prior fix 067c10641e009f942bfe737d0b42d0a811c261a7 changed only the selected table path and pinned its bytes; recovery workflow 70c680db6121d98527765a6ad056430926553457 launched only sector2 in run 42913698920. No new rerun was launched in this review. The failed attempt remains failed. The recovery was already active before the latest owner instruction.

Fresh independent verification: restored table is byte-identical to original night-session/wec-fit/eligibility.json, SHA256 7f7a91620cf845b5b19d408e8f376e35d48370632a2675871061ea4bc094c6f6, 99 rows. verifyEligibility passed all input hashes against the unchanged prepared inputs. No eligibility row, geometry, model, assertion, or acceptance threshold was edited. Keep Block 3c acceptance pending until recovery output and provenance are audited; any further input/model assertion parks it without another rerun.

## Independent work completed during active fits
- Block 3a: four pinned data-file hashes passed (fixed sources, verified BoP, exact model identities, gear measurements). Verified BoP table contains 40 model-event rows. This is a saved-input integrity check, not a new retrieval of source documents. Unverified 2026 event BoP, LMGT3 numeric inputs, and numeric aero limits remain unknown.
- Block 4: independently reran check-wec-model-report.py against an isolated copy of original inputs and results. All four complete Hypercar class-season fold inventories and arithmetic passed; 38 folds total. LMGT3 remains incomplete. No fitting or setting changes.
- Block 5: recomputed report-f1-gears.py from pinned normalized session snapshots in an isolated directory. Both the derived JSON and Markdown report are byte-identical to saved files. 41 team-season tests, 82 laps. Accuracy by season: 2023 81.640118%, 2024 83.255351%, 2025 83.439495%, 2026 79.856754%. Absolute gearbox ratios remain unknown without loaded tyre radius and final drive.

## Block state
| Block | Status | Evidence |
|---|---|---|
| 0 consistent candidate | Failed; historical completed comparison | Control 1.166709%, candidate 1.179080%, n33, at R. No model PR. |
| 1 rules | Updated | Section 5.1 has revised fold rule; main 5–10 rounds, unfinished folds stop below 1% nonnegative score decrease or own main round count (6), whichever first. Cap is not convergence. |
| 2 dry Las Vegas | Active, not validated | Six preserved folds, ten active at review. Final export/reproduction/physics/gate run 42914814278 waits for original fits. |
| 3a fixed inputs | Saved table integrity passed; coverage partial | 40 verified model-event rows; unknown values remain blank. |
| 3b model-matched BoP | Fit job completed; comparison pending | Original run BoP job succeeded. Historical 1.271006%, n33 is not the fresh result. |
| 3c sector term | Original attempt failed; earlier recovery active, acceptance pending | Run 42913698920. Historical 1.196784%, n33 is not the fresh result. |
| 4 per-model Hypercar | Rejected; audit passed | All-model pooled 1.391909% to 1.314548%, n22, but all four class-best results worse than production. LMGT3 parked at cap2000. |
| 5 gear measurements | Measurement/recompute complete; absolute ratios unknown | 41 tests, 82 laps; no unseen-circuit accuracy claim. |

## Finish procedure
Read original run 42913368752, sector recovery 42913698920, F1 finalizer 42914814278, and independent WEC comparison 42915252418. Cancelled duplicate run 42914964554 is not canonical completion evidence.
Download final artifacts, verify ZIP and internal hashes, preserve run/commit provenance, then report F1 held-out n/RMS by season, all Las Vegas rows, main/per-fold rounds and stop reasons, exact dry reproduction, per-model BoP joins and sector-at-R results.
Apply all declared baseline, paired, per-season, physical and reproduction checks. Missing checks remain unfinished; limit stops are not numerical convergence. Only fully passing candidates may become separate draft model PRs; no merge.
WEC reporting is independent of F1 completion. Keep production, main, Vercel, bounds, weights and gates unchanged.

PR #154 (reusable code/rules/audits): https://github.com/MisterKinn/f1-data-analyst/pull/154
PR #155 (draft dry-source guard): https://github.com/MisterKinn/f1-data-analyst/pull/155
Canonical runs: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913368752
Sector recovery: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913698920
F1 verification: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42914814278
WEC verification: https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42915252418
