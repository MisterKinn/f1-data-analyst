### 22.2 B rounds and saved transfer tables

The required rerun continued from each saved round state. B held-out folds were not run because the transfer exporter does not use them. No convergence claim is made for those folds. The first five printed scores were checked against the stopped run.

| Phase | Round | Score | Decrease (%) | Interlagos grip (unrounded) |
|---|---|---|---|---|
| 1 | 1 | 37.331252429 | — | 0.947605643 |
| 1 | 2 | 28.861197702 | 22.688911 | 0.953571463 |
| 1 | 3 | 27.096892536 | 6.113070 | 0.958617854 |
| 1 | 4 | 26.543546564 | 2.042101 | 0.961360991 |
| 1 | 5 | 26.186742181 | 1.344223 | 0.962344598 |
| 1 | 6 | 25.713567195 | 1.806926 | 0.965567282 |
| 1 | 7 | 25.625011965 | 0.344391 | 0.965463440 |

Round-five snapshots saved during the required rerun; same outlier exclusion set.

| Exported Interlagos factor | Current table | Round five | Final | Final − round five |
|---|---|---|---|---|
| Rounded table value | 0.9823 | 0.9623 | 0.9655 | 0.0032 |

### 22.3 Paired WEC result at R

Control means current production inputs refitted at R with the existing B table. Candidate uses the converged B table. Secondary uses the saved round-five B table. All use repository geometry, tolerance 1e-4 and cap 2000. The frozen production replay is reported separately. Full-precision predictions drive the comparisons; all car fields and selection candidates are saved in results.json.

| Arm | Group | Held-out RMS (%) | n | μy | ClA (m²) | CdA (m²) | Mass (kg) | Power (kW) | Bounds | pooled / bop / gripSource |
|---|---|---|---|---|---|---|---|---|---|---|
| control | wec-lmh/2025 | 1.112168 | 5 | 1.566682 | 7.000000 | 1.085898 | 1120.0 | 500.000 | clA upper | true / false / f1 |
| control | wec-lmh/2026 | 1.110032 | 6 | 1.521487 | 6.551861 | 0.964469 | 1120.0 | 500.000 | none | false / none / transfer |
| control | wec-lmdh/2025 | 1.281673 | 5 | 1.558905 | 7.000000 | 1.104641 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| control | wec-lmdh/2026 | 1.055043 | 6 | 1.530347 | 6.398381 | 0.953725 | 1120.0 | 500.000 | none | false / none / transfer |
| control | wec-lmgt3/2025 | 1.377708 | 5 | 1.589234 | 3.500000 | 1.285003 | 1400.0 | 380.000 | clA upper | false / none / transfer |
| control | wec-lmgt3/2026 | 1.077016 | 6 | 1.608860 | 3.500000 | 1.300000 | 1400.0 | 380.000 | clA upper, cdA upper | true / none / transfer |
| candidate | wec-lmh/2025 | 0.994992 | 5 | 1.569174 | 7.000000 | 1.090870 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| candidate | wec-lmh/2026 | 1.158233 | 6 | 1.568847 | 5.823316 | 0.976345 | 1120.0 | 500.000 | none | false / none / transfer |
| candidate | wec-lmdh/2025 | 1.268680 | 5 | 1.560749 | 7.000000 | 1.105001 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| candidate | wec-lmdh/2026 | 1.157331 | 6 | 1.570276 | 5.804265 | 0.964333 | 1120.0 | 500.000 | none | false / none / transfer |
| candidate | wec-lmgt3/2025 | 1.361022 | 5 | 1.591092 | 3.500000 | 1.284597 | 1400.0 | 380.000 | clA upper | false / none / transfer |
| candidate | wec-lmgt3/2026 | 1.120445 | 6 | 1.621114 | 3.500000 | 1.300000 | 1400.0 | 380.000 | clA upper, cdA upper | false / none / transfer |
| secondary | wec-lmh/2025 | 0.941279 | 5 | 1.570862 | 7.000000 | 1.090099 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| secondary | wec-lmh/2026 | 1.082699 | 6 | 1.578688 | 5.668301 | 0.976340 | 1120.0 | 500.000 | none | false / none / transfer |
| secondary | wec-lmdh/2025 | 1.221450 | 5 | 1.563042 | 7.000000 | 1.105927 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| secondary | wec-lmdh/2026 | 1.075989 | 6 | 1.574504 | 5.739056 | 0.963723 | 1120.0 | 500.000 | none | false / none / transfer |
| secondary | wec-lmgt3/2025 | 1.336136 | 5 | 1.592236 | 3.500000 | 1.280354 | 1400.0 | 380.000 | clA upper | false / none / transfer |
| secondary | wec-lmgt3/2026 | 0.887280 | 6 | 1.612133 | 3.500000 | 1.300000 | 1400.0 | 380.000 | clA upper, cdA upper | true / none / transfer |

| Group | Candidate − control (pp) | Gate | Choice flip |
|---|---|---|---|
| wec-lmh/2025 | -0.117176 | accepted: held-out error lower beyond noise | yes |
| wec-lmh/2026 | 0.048201 | rejected: worse on held-out rows | no |
| wec-lmdh/2025 | -0.012993 | rejected: gain within noise | no |
| wec-lmdh/2026 | 0.102288 | rejected: worse on held-out rows | no |
| wec-lmgt3/2025 | -0.016686 | rejected: gain within noise | no |
| wec-lmgt3/2026 | 0.043429 | rejected: worse on held-out rows | yes |

| Pooled held-out rows | Control RMS (%) | Candidate RMS (%) | Round-five RMS (%) | Final − round-five (pp) | Gate |
|---|---|---|---|---|---|
| 33 | 1.166709 | 1.179080 | 1.094332 | 0.084748 | rejected: worse on held-out rows |

| Group | Round five − control (pp) | Final − round five (pp) | Round-five gate |
|---|---|---|---|
| wec-lmh/2025 | -0.170888 | 0.053712 | accepted: held-out error lower beyond noise |
| wec-lmh/2026 | -0.027333 | 0.075534 | rejected: gain within noise |
| wec-lmdh/2025 | -0.060223 | 0.047230 | rejected: gain within noise |
| wec-lmdh/2026 | 0.020946 | 0.081342 | rejected: worse on held-out rows |
| wec-lmgt3/2025 | -0.041573 | 0.024887 | rejected: gain within noise |
| wec-lmgt3/2026 | -0.189736 | 0.233165 | accepted: held-out error lower beyond noise |

The declared primary candidate fails because pooled WEC error rises. The saved round-five arm lowers pooled error, but remains diagnostic: its B main fit fails the agreed convergence rule. The extra B rounds lower the F1 training score while making WEC held-out error higher in every group. No arm is substituted after seeing the held-out results.

With held-out n=5/6, a gain below about 0.1 pp remains unestablished even if the unchanged gate accepts it. No model or values are adopted.

### 22.4 Dry raced-session audit and Interlagos replay

The fit and audit share wet-sessions.json plus rain-marked rows. The audit checks the public result exactly at its reported precision. The physics replay below uses the season car, saved track grip and weather. It bypasses the raced-session correction and any per-event BoP patch; it is a separate diagnostic. results.json also stores the original fitted track residual.

| Arm | Dry WEC rows | Largest absolute error (s) | Excluded wet rows |
|---|---|---|---|
| control | 33 | 0.000 | 3 |
| candidate | 33 | 0.000 | 3 |
| secondary | 33 | 0.000 | 3 |

| Group | Dry raced rows | Control max error (s) | Candidate max error (s) | Round-five max error (s) |
|---|---|---|---|---|
| wec-lmh/2025 | 5 | 0.000 | 0.000 | 0.000 |
| wec-lmh/2026 | 6 | 0.000 | 0.000 | 0.000 |
| wec-lmdh/2025 | 5 | 0.000 | 0.000 | 0.000 |
| wec-lmdh/2026 | 6 | 0.000 | 0.000 | 0.000 |
| wec-lmgt3/2025 | 5 | 0.000 | 0.000 | 0.000 |
| wec-lmgt3/2026 | 6 | 0.000 | 0.000 | 0.000 |

| Excluded group | Track | Reason |
|---|---|---|
| wec-lmh/2025 | austin | wet-sessions.json |
| wec-lmdh/2025 | austin | wet-sessions.json |
| wec-lmgt3/2025 | austin | wet-sessions.json |

| Group | Frozen production error (s) | Control R error (s) | Candidate R error (s) | Round-five R error (s) |
|---|---|---|---|---|
| wec-lmh/2025 | -0.322721 | -0.280787 | -0.494593 | -0.424751 |
| wec-lmh/2026 | -0.919871 | -0.902545 | -0.460589 | -0.365165 |
| wec-lmdh/2025 | -0.440449 | -0.373878 | 0.155082 | 0.218164 |
| wec-lmdh/2026 | -0.577043 | -0.558115 | -0.094176 | 0.008934 |
| wec-lmgt3/2025 | -1.114375 | -1.093671 | -0.583736 | -0.513114 |
| wec-lmgt3/2026 | -1.503135 | -1.364714 | -1.071678 | -0.787288 |

F1 seasons and projections are exactly unchanged in every arm. The frozen dry F1 audit reproduces exactly.

| F1 dry audit | Rows | Maximum absolute error (s) |
|---|---|---|
| 2025 | 22 | 0.000 |
| 2026 | 17 | 0.000 |

| F1 group | Held-out RMS (%) | Held-out n | Interlagos replay error (s) | Wet Interlagos excluded |
|---|---|---|---|---|
| f1/2023 | — | 0 | — | yes |
| f1/2024 | — | 0 | — | yes |
| f1/2025 | 0.839655 | 20 | 0.099256 | no |
| f1/2026 | 0.899973 | 14 | — | yes |

### 22.5 Physical diagnostics, stopping and pass checks

WEC corner measurements are unavailable. The trap diagnostic is simulated lap maximum minus the measured trap, not a verified trap-position comparison. A positive change below is worse.

| Group | Control trap RMS (km/h) | Candidate trap RMS (km/h) | Change (km/h) | New bound hits |
|---|---|---|---|---|
| wec-lmh/2025 | 10.002800 | 10.050572 | 0.047773 | none |
| wec-lmh/2026 | 3.366007 | 3.377573 | 0.011567 | none |
| wec-lmdh/2025 | 11.957592 | 11.917131 | -0.040461 | none |
| wec-lmdh/2026 | 3.406171 | 3.463524 | 0.057353 | none |
| wec-lmgt3/2025 | 5.818419 | 5.823916 | 0.005497 | none |
| wec-lmgt3/2026 | 8.295682 | 8.222733 | -0.072949 | none |

| Arm | Group | Main iterations | Fold iteration range | Fit attempts in folds | Cap hits |
|---|---|---|---|---|---|
| control | wec-lmh/2025 | 86 | 74–119 | 22 | 0 |
| control | wec-lmh/2026 | 73 | 51–93 | 19 | 0 |
| control | wec-lmdh/2025 | 71 | 68–162 | 21 | 0 |
| control | wec-lmdh/2026 | 68 | 58–112 | 19 | 0 |
| control | wec-lmgt3/2025 | 120 | 62–130 | 16 | 0 |
| control | wec-lmgt3/2026 | 103 | 76–148 | 20 | 0 |
| candidate | wec-lmh/2025 | 79 | 72–119 | 21 | 0 |
| candidate | wec-lmh/2026 | 64 | 64–95 | 19 | 0 |
| candidate | wec-lmdh/2025 | 88 | 58–118 | 21 | 0 |
| candidate | wec-lmdh/2026 | 76 | 58–141 | 19 | 0 |
| candidate | wec-lmgt3/2025 | 94 | 62–119 | 16 | 0 |
| candidate | wec-lmgt3/2026 | 92 | 78–190 | 20 | 0 |
| secondary | wec-lmh/2025 | 80 | 70–137 | 21 | 0 |
| secondary | wec-lmh/2026 | 67 | 62–95 | 19 | 0 |
| secondary | wec-lmdh/2025 | 90 | 68–122 | 21 | 0 |
| secondary | wec-lmdh/2026 | 81 | 58–112 | 19 | 0 |
| secondary | wec-lmgt3/2025 | 99 | 62–121 | 16 | 0 |
| secondary | wec-lmgt3/2026 | 83 | 83–127 | 20 | 0 |

| Check | Primary candidate | Round-five secondary |
|---|---|---|
| dryReproduction | PASS | PASS |
| f1Unchanged | PASS | PASS |
| pooledWecNotWorse | FAIL | PASS |
| noCapHits | PASS | PASS |
| declaredCandidatePass | FAIL | Diagnostic only; B convergence fails |

The declared pass is separate from the full statistical and physical checks above. Production F1 still fails the score convergence rule in section 22.1; it was not rerun. The owner will decide any later F1 work.

Geometry remains unchanged: Interlagos uses dry session 9865 (2025). Las Vegas 9854 (2025), Montreal 11287 (2026), and Zandvoort 11349 (2026) remain rain-marked sources on hold. PR #155 remains separate. Sector objective b2 stays rejected and off; trap position and aero ratio remain on hold. No production, bounds, weights, gate or geometry changes; no model PR, merge or Vercel action.

Evidence: scripts/sim/results/wec-consistent-rounds-2026-11-10/. Input checks, full-precision results, saved tables, derived calibrations, compressed objective logs, reproduction audits, source hashes and production integrity checks are included.

Fresh-checkout recipe (Node 22.23.4; archive saved one directory above the checkout):

```sh
node scripts/sim/prepare-wec-consistent.mjs ../lapsim-inputs.tgz
node scripts/sim/run-wec-consistent.mjs
node scripts/sim/report-wec-consistent.mjs
node scripts/sim/archive-wec-consistent.mjs
```

The runners refuse existing run directories. Use a fresh checkout for reproduction. Per-round B snapshots contain xs, factors and adj for the fitter warm-start API; they are derived state, not replacement inputs.
