# WEC model hierarchy — 2026-11-10

Both all-car arms use the same rows and verified event corrections. The fresh production arm is a separate reference with its normal top-three data. Partial results are not acceptance evidence. A group or model gain below 0.1 pp at n of 5 or 6 is not established.

| Fixed setting | Value |
|---|---:|
| Tolerance / iteration cap | 0.0001 / 2000 |
| Shrink strength / log difference scale | 8 / 0.1 |
| Optimizer step | 0.08 |

| Group | Status | Cars | Tracks | Completed folds | Cap hits |
|---|---|---:|---:|---:|---:|
| wec-lmdh/2025 | complete | 45 | 5 | 9 | 0 |
| wec-lmdh/2026 | complete | 48 | 6 | 10 | 0 |
| wec-lmh/2025 | complete | 45 | 5 | 9 | 0 |
| wec-lmh/2026 | complete | 54 | 6 | 10 | 0 |

| Group | Hidden-track n | All-model base RMS, % | All-model candidate RMS, % | Class-best base RMS, % | Class-best candidate RMS, % | Production class-best RMS, % |
|---|---:|---:|---:|---:|---:|---:|
| wec-lmdh/2025 | 5 | 1.555579 | 1.539785 | 1.684012 | 1.729234 | 1.281673 |
| wec-lmdh/2026 | 6 | 1.105933 | 1.096921 | 1.178463 | 1.206808 | 1.055043 |
| wec-lmh/2025 | 5 | 1.694380 | 1.423168 | 1.726714 | 1.486128 | 1.112168 |
| wec-lmh/2026 | 6 | 1.213176 | 1.212137 | 1.334708 | 1.392195 | 1.110032 |

| Pooled test | Track groups, n | Base RMS, % | Candidate RMS, % | Gate |
|---|---:|---:|---:|---|
| Hypercar | 22 | 1.391909 | 1.314548 | accepted: held-out error lower beyond noise |

| Group / main car | Drag cdA | Downforce clA | Grip muY | Bound hits |
|---|---:|---:|---:|---|
| wec-lmdh/2025 / control | 1.110568 | 7.000000 | 1.537544 | clA upper |
| wec-lmdh/2025 / hierarchy class base | 1.113067 | 6.993508 | 1.538119 | none |
| wec-lmdh/2025 / Alpine A424 | 1.118472 | 6.988736 | 1.528883 | none |
| wec-lmdh/2025 / BMW M Hybrid V8 | 1.110759 | 6.999998 | 1.542658 | clA upper |
| wec-lmdh/2025 / Cadillac V-Series.R | 1.113958 | 7.000000 | 1.546418 | clA upper |
| wec-lmdh/2025 / Porsche 963 | 1.109179 | 6.987104 | 1.534941 | none |
| wec-lmdh/2026 / control | 0.971473 | 6.227203 | 1.528952 | none |
| wec-lmdh/2026 / hierarchy class base | 0.970272 | 6.302171 | 1.524058 | none |
| wec-lmdh/2026 / Alpine A424 | 0.970762 | 6.309323 | 1.532242 | none |
| wec-lmdh/2026 / BMW M Hybrid V8 | 0.970733 | 6.293595 | 1.516220 | none |
| wec-lmdh/2026 / Cadillac V-Series.R | 0.968333 | 6.305731 | 1.527475 | none |
| wec-lmdh/2026 / Genesis GMR-001-Hypercar | 0.971424 | 6.299116 | 1.520811 | none |
| wec-lmh/2025 / control | 1.057002 | 7.000000 | 1.529561 | clA upper |
| wec-lmh/2025 / hierarchy class base | 1.058478 | 6.966309 | 1.525697 | none |
| wec-lmh/2025 / Aston Martin Valkyrie | 1.065177 | 6.935309 | 1.494710 | none |
| wec-lmh/2025 / Ferrari 499P | 1.047818 | 7.000000 | 1.558726 | clA upper |
| wec-lmh/2025 / Peugeot 9X8 | 1.066703 | 6.965978 | 1.517093 | none |
| wec-lmh/2025 / Toyota GR010 - Hybrid | 1.054223 | 6.966472 | 1.533405 | none |
| wec-lmh/2026 / control | 0.969212 | 6.388640 | 1.515383 | none |
| wec-lmh/2026 / hierarchy class base | 0.968883 | 6.473571 | 1.509701 | none |
| wec-lmh/2026 / Aston Martin Valkyrie | 0.967780 | 6.469062 | 1.505359 | none |
| wec-lmh/2026 / Ferrari 499P | 0.970353 | 6.478421 | 1.515492 | none |
| wec-lmh/2026 / Peugeot 9X8 | 0.967901 | 6.474129 | 1.510113 | none |
| wec-lmh/2026 / Toyota TR010 Hybrid | 0.969383 | 6.472368 | 1.507966 | none |

| Group / model | Hidden-track n | Base RMS, % | Candidate RMS, % | Gain, pp | Own values supported |
|---|---:|---:|---:|---:|---|
| wec-lmdh/2025 / Alpine A424 | 5 | 1.505944 | 1.462530 | 0.043414 | false |
| wec-lmdh/2025 / BMW M Hybrid V8 | 5 | 1.533382 | 1.559552 | -0.026169 | false |
| wec-lmdh/2025 / Cadillac V-Series.R | 5 | 1.707687 | 1.663005 | 0.044682 | false |
| wec-lmdh/2025 / Porsche 963 | 5 | 1.464234 | 1.465253 | -0.001019 | false |
| wec-lmdh/2026 / Alpine A424 | 6 | 1.114739 | 1.077999 | 0.036740 | false |
| wec-lmdh/2026 / BMW M Hybrid V8 | 6 | 0.978411 | 0.966939 | 0.011472 | false |
| wec-lmdh/2026 / Cadillac V-Series.R | 6 | 1.072412 | 1.048312 | 0.024100 | false |
| wec-lmdh/2026 / Genesis GMR-001-Hypercar | 6 | 1.241915 | 1.271585 | -0.029670 | false |
| wec-lmh/2025 / Aston Martin Valkyrie | 5 | 2.027288 | 1.541225 | 0.486063 | true |
| wec-lmh/2025 / Ferrari 499P | 5 | 1.717607 | 1.353993 | 0.363614 | true |
| wec-lmh/2025 / Peugeot 9X8 | 5 | 1.543141 | 1.465058 | 0.078082 | false |
| wec-lmh/2025 / Toyota GR010 - Hybrid | 5 | 1.429103 | 1.321574 | 0.107529 | false |
| wec-lmh/2026 / Aston Martin Valkyrie | 6 | 1.284600 | 1.301285 | -0.016685 | false |
| wec-lmh/2026 / Ferrari 499P | 6 | 1.235271 | 1.180279 | 0.054993 | false |
| wec-lmh/2026 / Peugeot 9X8 | 6 | 1.225010 | 1.264249 | -0.039239 | false |
| wec-lmh/2026 / Toyota TR010 Hybrid | 6 | 1.100201 | 1.091959 | 0.008241 | false |

| Group | Hidden-model folds | Model-track cells | Base RMS, % | Candidate RMS, % |
|---|---:|---:|---:|---:|
| wec-lmdh/2025 | 4 | 20 | 1.285240 | 1.285348 |
| wec-lmdh/2026 | 4 | 24 | 0.873734 | 0.874998 |
| wec-lmh/2025 | 4 | 20 | 1.844460 | 1.829761 |
| wec-lmh/2026 | 4 | 24 | 0.854179 | 0.850683 |

| Pass check | Result |
|---|---|
| allHypercarComplete | true |
| productionComplete | true |
| pooledAccepted | true |
| noClassSeasonWorse | false |
| noCapHits | true |
| f1Unchanged | true |
| dryProductionReproduction | true |

No per-model values were adopted. The car values above are fitted effective values, not measured physical facts. The experiment branch retains the main car values, every bound hit, fold memberships, errors, source hashes and objective diagnostics. The displayed Hypercar model remains class-level.

Completed Hypercar checkpoint. Optional LMGT3 is still running in the original time box.
