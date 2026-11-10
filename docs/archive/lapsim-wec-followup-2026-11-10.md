# WEC BoP and sector follow-up — 2026-11-10

Production remains the baseline. Each independent arm uses the same repository geometry and current transfer table at R. No settings were selected from the held-out results.

| Group | n | Control RMS, % | Model-matched BoP RMS, % | Sector weight 2 RMS, % |
|---|---:|---:|---:|---:|
| wec-lmh/2025 | 5 | 1.112168 | 1.402441 | 1.114725 |
| wec-lmh/2026 | 6 | 1.110032 | 1.110032 | 1.068161 |
| wec-lmdh/2025 | 5 | 1.281673 | 1.609595 | 1.422169 |
| wec-lmdh/2026 | 6 | 1.055043 | 1.055043 | 1.040133 |
| wec-lmgt3/2025 | 5 | 1.377708 | 1.377708 | 1.353591 |
| wec-lmgt3/2026 | 6 | 1.077016 | 1.077016 | 1.186143 |
| Pooled | 33 | 1.166709 | 1.271006 | 1.196784 |

| Arm | Pass | Pooled gate | Any class-season worse | Cap hits | Exact dry rows | Largest reproduction error, s | Hypercar 2025 trap RMS, km/h |
|---|---|---|---|---:|---:|---:|---:|
| control | reference |  |  | 0 | 33 | 0.000000 | 11.023611 |
| bop | no | rejected: worse on held-out rows | true | 0 | 33 | 0.000000 | 12.246551 |
| sector2 | no | rejected: worse on held-out rows | true | 0 | 33 | 0.000000 | 11.015988 |

The trap diagnostic compares simulated lap maximum with a measured trap. It does not verify trap position. A gain below the declared threshold at small group counts is not established. Austin wet rows are excluded by the same list as the fit.

| Arm / group | μY | ClA, m² | CdA, m² | Bound hits | pooled / bop / grip source | Main iterations |
|---|---:|---:|---:|---|---|---:|
| control / wec-lmh/2025 | 1.566682 | 7.000000 | 1.085898 | clA:upper | true / false / f1 | 86 |
| control / wec-lmh/2026 | 1.521487 | 6.551861 | 0.964469 | none | false / null / transfer | 73 |
| control / wec-lmdh/2025 | 1.558905 | 7.000000 | 1.104641 | clA:upper | false / false / transfer | 71 |
| control / wec-lmdh/2026 | 1.530347 | 6.398381 | 0.953725 | none | false / null / transfer | 68 |
| control / wec-lmgt3/2025 | 1.589234 | 3.500000 | 1.285003 | clA:upper | false / null / transfer | 120 |
| control / wec-lmgt3/2026 | 1.608860 | 3.500000 | 1.300000 | clA:upper, cdA:upper | true / null / transfer | 103 |
| bop / wec-lmh/2025 | 1.570760 | 7.000000 | 1.088690 | clA:upper | true / true / f1 | 92 |
| bop / wec-lmh/2026 | 1.521487 | 6.551861 | 0.964469 | none | false / null / transfer | 73 |
| bop / wec-lmdh/2025 | 1.560930 | 7.000000 | 1.108605 | clA:upper | false / true / transfer | 99 |
| bop / wec-lmdh/2026 | 1.530347 | 6.398381 | 0.953725 | none | false / null / transfer | 68 |
| bop / wec-lmgt3/2025 | 1.589234 | 3.500000 | 1.285003 | clA:upper | false / null / transfer | 120 |
| bop / wec-lmgt3/2026 | 1.608860 | 3.500000 | 1.300000 | clA:upper, cdA:upper | true / null / transfer | 103 |
| sector2 / wec-lmh/2025 | 1.561992 | 7.000000 | 1.074343 | clA:upper | true / false / f1 | 82 |
| sector2 / wec-lmh/2026 | 1.581298 | 5.515679 | 0.962904 | none | false / null / transfer | 85 |
| sector2 / wec-lmdh/2025 | 1.552301 | 7.000000 | 1.089217 | clA:upper | false / false / transfer | 82 |
| sector2 / wec-lmdh/2026 | 1.567800 | 5.747139 | 0.951516 | none | false / null / transfer | 77 |
| sector2 / wec-lmgt3/2025 | 1.586671 | 3.500000 | 1.300000 | clA:upper, cdA:upper | false / null / transfer | 93 |
| sector2 / wec-lmgt3/2026 | 1.613450 | 3.500000 | 1.258223 | clA:upper | false / null / f1 | 132 |

| Candidate / group | Change in held-out RMS, pp | Downforce left bound | Group gate |
|---|---:|---|---|
| bop / wec-lmh/2025 | 0.290274 | false | rejected: worse on held-out rows; gain not established |
| bop / wec-lmh/2026 | 0.000000 | false | rejected: worse on held-out rows; gain not established |
| bop / wec-lmdh/2025 | 0.327922 | false | rejected: worse on held-out rows; gain not established |
| bop / wec-lmdh/2026 | 0.000000 | false | rejected: worse on held-out rows; gain not established |
| bop / wec-lmgt3/2025 | 0.000000 | false | rejected: worse on held-out rows; gain not established |
| bop / wec-lmgt3/2026 | 0.000000 | false | rejected: worse on held-out rows; gain not established |
| sector2 / wec-lmh/2025 | 0.002558 | false | rejected: worse on held-out rows; gain not established |
| sector2 / wec-lmh/2026 | -0.041871 | false | rejected: gain within noise; gain not established |
| sector2 / wec-lmdh/2025 | 0.140496 | false | rejected: worse on held-out rows; gain not established |
| sector2 / wec-lmdh/2026 | -0.014910 | false | rejected: gain within noise; gain not established |
| sector2 / wec-lmgt3/2025 | -0.024118 | false | rejected: gain within noise; gain not established |
| sector2 / wec-lmgt3/2026 | 0.109128 | false | rejected: worse on held-out rows; gain not established |

Full-precision errors, car fields, selections, exclusions, iteration diagnostics and source hashes are retained on the experiment branch. Production runtime files and the gate remain unchanged.
