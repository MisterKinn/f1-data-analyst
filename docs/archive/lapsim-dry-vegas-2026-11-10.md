# Dry Las Vegas geometry — 2026-11-10

| Arm / season | Held-out n | Complete | Held-out RMS, % |
|---|---:|---|---:|
| control / 2025 | 11 | false | 0.622745 |
| control / 2026 | 0 | false |  |
| candidate / 2025 | 11 | false | 0.641319 |
| candidate / 2026 | 0 | false |  |

| Arm / Vegas season | Wet | Real, s | Sim, s | Error, s | Corner bias, km/h | Trap error, km/h |
|---|---|---:|---:|---:|---:|---:|
| control / 2023 | false | 92.726000 | 93.009826 | 0.283826 | -6.899624 | 6.603202 |
| control / 2024 | false | 92.312000 | 92.168891 | -0.143109 | -0.642982 | -1.754202 |
| control / 2025 | true | 107.934000 | 91.947602 | -15.986398 | 18.338004 | 16.597495 |
| candidate / 2023 | false | 92.726000 | 92.991002 | 0.265002 | -7.751577 | 2.237430 |
| candidate / 2024 | false | 92.312000 | 92.166458 | -0.145542 | -2.832794 | -6.699283 |
| candidate / 2025 | true | 107.934000 | 92.039954 | -15.894046 | 17.136179 | 10.460581 |

| Arm | Grip | Drag | Vegas prediction, s | Main rounds | Last score decrease, % |
|---|---:|---:|---:|---:|---:|
| control | 0.947102 | 0.900731 | 93.875294 | 6 | 0.773481 |
| candidate | 0.932803 | 0.940554 | 94.491136 | 6 | 0.584693 |

| Pass check | Result |
|---|---|
| complete | false |
| converged | false |
| noCapHits | true |
| heldoutNotWorse | false |
| dryVegasNotWorse | false |
| reproduction | false |

| Arm / fit | Scores by round | Converged | Cap hit |
|---|---|---|---|
| control / fit-1.json | 36.527708, 27.802206, 25.911498, 25.186932, 24.930901, 24.738065 | true | false |
| control / fit-2.json | 36.886756, 29.156029, 27.243706, 26.230496, 25.951926, 25.739488 | true | false |
| control / fit-3.json | 34.785622, 28.070719, 26.477567, 25.763740, 25.545719 | true | false |
| candidate / fit-1.json | 36.976092, 28.341503, 26.164278, 25.405780, 25.129316, 24.982387 | true | false |
| candidate / fit-2.json | 37.548181, 28.653219, 26.641698, 26.168971, 25.970289 | true | false |
| candidate / fit-3.json | 35.332939, 28.247491, 26.371263, 25.649613, 25.377565, 25.252141 | true | false |
| candidate / fit-4.json | 36.732244 | false | false |

The time box or fit cap ended this experiment. Partial results are not accepted.

Checkpoint replay only, no refit. Partial held-out RMS is not an acceptance result.
Wet Vegas rows are diagnostics only and excluded from the declared dry-row pass.
Trap error is simulated lap maximum minus measured trace maximum.
Reproduction is unverified for the unfinished fitted candidates; false here is a missing acceptance check, not a production reproduction failure. The separate current-production audit reproduces all 39 dry F1 rows exactly.
