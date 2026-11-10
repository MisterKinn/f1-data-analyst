# Dry Las Vegas: terminal validation report — 2026-11-11

Computation and checkpoint export finished. Candidate rejected. The production-baseline validity check also failed, so this run does not establish an acceptable production improvement. No model PR.

Source fit run [42913368752](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913368752), commit `c4a2b9f4ba107b5e2b1655de1a370e37092fb033`. Final export/comparison [42914814278](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42914814278), commit `a526068fb85ea284a360c4b87ef04e0066c24126`.

## Paired held-out results

| Season | n per arm | Control RMS % | Candidate RMS % | Verdict |
|---|---:|---:|---:|---|
| 2025 | 20 | 0.841682 | 0.851894 | rejected: worse on held-out rows |
| 2026 | 14 | 1.194146 | 1.306054 | rejected: worse on held-out rows |

These are season-unseen tests, not completely unseen circuits. Las Vegas itself has no row in these held-out seasons: 2025 was wet and excluded; 2026 was a future prediction.

## Las Vegas main-fit raw replay

This is in-sample model replay before the raced-session correction, not held-out error. The earlier main states are JSON-identical to the final archived main checkpoints, so their full-precision saved replay applies unchanged.

| Year | Wet? | Real s | Control s | Candidate s | Control error s | Candidate error s |
|---|---|---:|---:|---:|---:|---:|
| 2023 | False | 92.726000 | 93.009826 | 92.991002 | 0.283826 | 0.265002 |
| 2024 | False | 92.312000 | 92.168891 | 92.166458 | -0.143109 | -0.145542 |
| 2025 | True | 107.934000 | 91.947602 | 92.039954 | -15.986398 | -15.894046 |

The 2024 absolute raw error worsens, failing the declared dry-row non-increase check. The wet 2025 row is diagnostic only and is not a failure of the dry reproduction audit.

| 2026 prediction | Lap s |
|---|---:|
| Frozen production | 92.840 |
| Experiment control | 93.875294 |
| Dry geometry candidate | 94.491136 |

Both experiment predictions use 2024 dry weather and the 2026 recharge setting. The stored prediction date is a model input, not a newly verified race schedule. No observed 2026 Las Vegas lap was available.

## Rounds and stop reasons

Inner iterations remain 200; both main fits converged in 6 rounds. Zero optimizer rounds were executed during final export.

| Arm | Season | Fold (zero-based) | Rounds | Numerical convergence | Stop reason |
|---|---:|---:|---:|---|---|
| control | 2025 | 0 | 6 | True | preserved-completed-fold |
| control | 2025 | 1 | 5 | True | preserved-completed-fold |
| control | 2025 | 2 | 6 | True | preserved-completed-fold |
| control | 2025 | 3 | 6 | True | score-decrease-below-one-percent |
| control | 2026 | 0 | 5 | True | score-decrease-below-one-percent |
| control | 2026 | 1 | 5 | True | score-decrease-below-one-percent |
| control | 2026 | 2 | 6 | True | score-decrease-below-one-percent |
| control | 2026 | 3 | 6 | True | score-decrease-below-one-percent |
| candidate | 2025 | 0 | 5 | True | preserved-completed-fold |
| candidate | 2025 | 1 | 6 | True | preserved-completed-fold |
| candidate | 2025 | 2 | 6 | True | preserved-completed-fold |
| candidate | 2025 | 3 | 5 | True | score-decrease-below-one-percent |
| candidate | 2026 | 0 | 5 | True | score-decrease-below-one-percent |
| candidate | 2026 | 1 | 6 | False | main-round-limit |
| candidate | 2026 | 2 | 6 | True | score-decrease-below-one-percent |
| candidate | 2026 | 3 | 6 | True | score-decrease-below-one-percent |

Candidate 2026 fold 1 finished at the owner’s main-round limit, not numerical convergence. Previously finished folds were preserved.

## Acceptance and physical checks

| Check | Result |
|---|---|
| F1 protection | Failed in both held-out seasons |
| Baseline within 0.05 pp of production per season | Failed: 2026 production about 0.900%, control 1.194% (stored-precision comparison) |
| Dry Vegas raw lap non-increase | Failed for 2024 |
| Exact dry F1 reproduction | Passed: 39 rows per arm, largest error 0 s |
| Checkpoint hashes | 18/18 passed; nine states per arm |
| ZIP hashes | All three final artifact digests matched GitHub |
| Production adoption | None |

| Season | Corner absolute-bias change km/h | Trap RMS change km/h | New parameter-bound hits |
|---|---:|---:|---|
| 2023 | -0.045800 | 0.169689 | [] |
| 2024 | 0.232667 | 0.606996 | [] |
| 2025 | 0.225000 | 0.582245 | [] |
| 2026 | 0.194235 | 2.678554 | [] |

Positive physical changes are worse. These diagnostics are in-sample; they are not held-out corner/trap accuracy. The no-worse physical check is not satisfied. Run-specific track-factor bound validation is unavailable in the exported calibration metadata.

## Hashes and restart

| Artifact | ZIP SHA256 |
|---|---|
| final-f1-control | `b1a79eec040e8c798d1d5381b8276f95432ec2eb0ec1d6931c0cfaa682c7de2e` |
| final-f1-candidate | `8842bb8e99ecfa4172ee97f611a439fa1148d036ca3030757ac4274166b89038` |
| final-f1-comparison | `a99209400d03b3d5fffff4165c0c2bc9d8390ea1802fb706cc741bc793b160b5` |

Full internal checkpoint hashes, group/training/options replay checks, holdout rows, validation JSON and logs are on the evidence branch. Original pinned inputs: archive SHA256 `268039a6acd2fd589336fede690e3321d723f6f50665718a55f6021cde1ac186`; saved pre-Actions checkpoints SHA256 `58feef22a9bdf8e1e1edb92e5aaa80da4de645343129d34357213e92d94d1a11`.

No fit restart is needed. To reproduce reporting, use the final-export commit in an isolated checkout, download the three named final artifacts, verify ZIP hashes, and run `node scripts/sim/owner-compare-final.mjs <artifact-root>`. Folders must be `<artifact-root>/final-f1-control/control` and `<artifact-root>/final-f1-candidate/candidate`. To reproduce calibration export, use `owner-finalize.mjs` with all original sixteen fold artifacts and pinned archives; it verifies the nine states and runs zero optimizer rounds. Never replace the saved final checkpoints with older pre-Actions ones.
