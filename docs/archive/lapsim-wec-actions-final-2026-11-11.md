# WEC at R: verified Actions result — 2026-11-11

All three fitting jobs completed. Original sector attempt failed before fit; separate recovery succeeded. The first comparison workflow failed because of artifact directory nesting; named-artifact extraction fixed only reporting. No new fit. Corrected comparison run: [42918109977](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42918109977).

| Group | n | Control RMS % | Model-matched BoP RMS % | Sector term RMS % |
|---|---:|---:|---:|---:|
| wec-lmh/2025 | 5 | 1.112168 | 1.402441 | 1.114725 |
| wec-lmh/2026 | 6 | 1.110032 | 1.110032 | 1.068161 |
| wec-lmdh/2025 | 5 | 1.281673 | 1.609595 | 1.422169 |
| wec-lmdh/2026 | 6 | 1.055043 | 1.055043 | 1.040133 |
| wec-lmgt3/2025 | 5 | 1.377708 | 1.377708 | 1.353591 |
| wec-lmgt3/2026 | 6 | 1.077016 | 1.077016 | 1.186143 |
| Pooled | 33 | 1.166709 | 1.271006 | 1.196784 |

Both candidates fail the paired gate and no-group-worse checks. No draft model PR. BoP is matched by exact model/event/entry, but this experiment predicts class-best laps; it is not a per-model lap-output validation. Per-model results are separate.

| Check | Control | BoP | Sector2 |
|---|---:|---:|---:|
| Optimizer cap hits | 0 | 0 | 0 |
| Dry WEC reproduction rows | 33 | 33 | 33 |
| Maximum reproduction error, seconds | 0 | 0 | 0 |
| Hypercar 2025 trap RMS, km/h (n=10) | 11.023611 | 12.246551 | 11.015988 |

Four class-season downforce values remain at the upper fitting bound (LMH 2025, LMDh 2025, LMGT3 2025 and 2026). The two 2026 Hypercar groups were already below that bound. No previously bound downforce value left its bound. All fits stopped by the declared tolerance. F1 seasons and projections remained unchanged in every WEC job. Austin 2025 wet rows remain excluded. WEC corner measurements and positioned-trap validation are unavailable; trap values compare simulated lap maximum with measured trap.

## Verified artifact provenance

| Arm | Run | Artifact | ZIP SHA256 |
|---|---|---|---|
| control | 42913368752 | 13810331387 | `b5e3bc1f325c77b57da862cbb2bae9c8188b79c1b14d56451831f98abf787c5c` |
| bop | 42913368752 | 13809395766 | `628d3312fc3a4edc2be3730eb11dead112003cb27cc6747b681999b13c616f24` |
| sector2 | 42913698920 | 13808524879 | `4982456a575463f64e1c10942cebd75968d4fadba2cfecc19cdd77f00e5c5e46` |

Each ZIP digest matched the GitHub artifact digest. Complete status, input checks, full-precision paired row identities, objective stop reasons and reproduction were checked. The exact original eligibility table was restored; no data/model assertion occurred in recovery.

| Group | Control clA | BoP clA | Sector2 clA |
|---|---:|---:|---:|
| wec-lmh/2025 | 7.000000 | 7.000000 | 7.000000 |
| wec-lmh/2026 | 6.551861 | 6.551861 | 5.515679 |
| wec-lmdh/2025 | 7.000000 | 7.000000 | 7.000000 |
| wec-lmdh/2026 | 6.398381 | 6.398381 | 5.747139 |
| wec-lmgt3/2025 | 3.500000 | 3.500000 | 3.500000 |
| wec-lmgt3/2026 | 3.500000 | 3.500000 | 3.500000 |

Sector2 also introduces a drag upper-bound hit for LMGT3 2025, so the physical acceptance check fails independently of its worse held-out result.
