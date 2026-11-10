# Historical physics record — 2026-11-10

This is the preserved record before the handoff was shortened. Decisions may have been replaced by the current [handoff](../lapsim-handoff-physics.md#14-current-status--2026-11-10). Local experiment runner/result paths in this record refer to the [experiment branch](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/tree/exp/lapsim-physics-night-2026-11-10), not the core review branch.


## 14. WEC timing experiment — task 9.5.2 (2026-11-10)

Owner-approved scope: trap position (a), sector objective (b); aerodynamic ratio (c) is on hold.
Code flags remain off by default. This is an experimental implementation, not approval to enable it in production.

### 14.1 Predeclared experiment

Base commit: 309fdfd8e214c5089072bcc5c06e51892bf63790 (PR #153).
Manifest: scripts/sim/wec-timing-experiment.json. Primary variants: baseline, a, b2, ab2.
Sensitivity-only variants: b1, b4, ab1, ab4. The acceptance decision uses weight 2 only. No best-weight selection from held-out results.

All runs: LAPSIM_ONLY=wec, LAPSIM_ITERS=70, LAPSIM_HOLDOUT_ITERS=25, unchanged production F1 seasons, projections and transfer factors.
The production workflow's F1 settings (BCD 5 rounds/200 iterations, lap 20, sector 2, prior 8, track drag and teams on) are retained in the environment but are not used to refit F1.
The WEC fitter actually uses lap weight 2 and trap weight 0.5; its approved new term is 2 times the sum of three squared sector errors in seconds.
Weights 1 and 4 are sensitivity checks only. Every original row weight, parameter bound, pooling/BoP decision and gate remains unchanged.

Pass: pooled WEC gate accepted, no class-season worse, F1 seasons/projections unchanged, zero new bound hits, no worse measured trap or corner errors.
Baseline must match production within 0.05 percentage points per group. Screen budget: under 60 minutes.
The production WEC fitter uses Nelder-Mead iterations, not F1 BCD rounds; F1 round settings are not evidence of WEC convergence.
WEC corner measurements are unavailable, so the physical corner check cannot be claimed as passed.

| Class | Year | Al Kamel laps | Eligible sectors | Positioned traps | Held-out tracks |
|---|---:|---:|---:|---:|---:|
| lmh | 2025 | 15 | 0 | 0 | 5 |
| lmh | 2026 | 18 | 0 | 0 | 6 |
| lmdh | 2025 | 15 | 0 | 0 | 5 |
| lmdh | 2026 | 18 | 0 | 0 | 6 |
| lmgt3 | 2025 | 15 | 0 | 0 | 5 |
| lmgt3 | 2026 | 18 | 0 | 0 | 6 |

Timing71 extra candidate rows have no verified year-specific timing positions and retain their original lap/trap observations.
The existing fit decides whether to use these extra rows; final fitted n is reported separately.

### 14.2 Source verification and eligibility

Official event manifests: https://files.alkamelcloud.com/wec/manifests/results_14_2025.json and https://files.alkamelcloud.com/wec/manifests/results_15_2026.json.
The derived table scripts/sim/data/wec-timing-positions.json records each source URL, page and SHA-256. Raw PDFs are not committed.
Distances below are metres from the finish timing line, not the separate grid start line; the maps label distances approximate.
No trap distance was inferred from a diagram's pixels or borrowed from F1. Le Mans has a numeric trap distance but no simulator geometry in this fit.

| Track | Year | Official length | S1 end | S2 end | Trap | Source |
|---|---:|---:|---:|---:|---:|---|
| lusail | 2025 | 5418 | 2072 | 3664 | unverified | [map](https://files.alkamelcloud.com/wec/results/14_2025/01_LOSAIL/00_Event%20Info/1_CircuitMap.pdf) |
| imola | 2025 | 4909 | 1214 | 2728 | unverified | [map](https://files.alkamelcloud.com/wec/results/14_2025/02_IMOLA/00_Event%20Info/Circuit%20Map.pdf) |
| spa-francorchamps | 2025 | 7003.9 | 2243.5 | 5112.7 | unverified | [map](https://files.alkamelcloud.com/wec/results/14_2025/03_SPA%20FRANCORCHAMPS/00_Circuit%20Info/Circuit%20Map.pdf) |
| interlagos | 2025 | 4309 | 1234 | 3155 | unverified | [map](https://files.alkamelcloud.com/wec/results/14_2025/05_SAO%20PAULO/00_Circuit%20Info/Circuit%20Map%20v2.pdf) |
| austin | 2025 | 5513 | 1311 | 3568 | unverified | [map](https://files.alkamelcloud.com/wec/results/14_2025/06_CIRCUIT%20OF%20THE%20AMERICAS/00_Event%20Info/Circuit%20Map%20v2.pdf) |
| sakhir | 2025 | 5412 | 1804 | 3562 | unverified | [map](https://files.alkamelcloud.com/wec/results/14_2025/08_BAHRAIN%20INTERNATIONAL%20CIRCUIT/00_Event%20Info/Circuit%20Map.pdf) |
| imola | 2026 | 4909 | 1214 | 2728 | unverified | [map](https://files.alkamelcloud.com/wec/results/15_2026/01_IMOLA/00_Event%20Info/1_Circuit%20Map.pdf) |
| spa-francorchamps | 2026 | 7003.9 | 2243.5 | 5112.7 | unverified | [map](https://files.alkamelcloud.com/wec/results/15_2026/02_SPA%20FRANCORCHAMPS/00_Event%20Info/Circuit%20Map.pdf) |
| interlagos | 2026 | 4309 | 1234 | 3155 | unverified | [map](https://files.alkamelcloud.com/wec/results/15_2026/04_SAO%20PAULO/00_Event%20Info/Circuit%20Map.pdf) |
| austin | 2026 | 5513 | 1311 | 3568 | unverified | [map](https://files.alkamelcloud.com/wec/results/15_2026/05_CIRCUIT%20OF%20THE%20AMERICAS/00_Event%20Info/Circuit%20Map%20v3.pdf) |
| catalunya | 2026 | 4657 | 1627 | 3395 | unverified | [map](https://files.alkamelcloud.com/wec/results/15_2026/07_BARCELONA-CATALUNYA/00_Event%20Info/Circuit%20Map%20v1.pdf) |
| monza | 2026 | 5793 | 2055 | 3727 | unverified | [map](https://files.alkamelcloud.com/wec/results/15_2026/08_AUTODROMO%20NAZIONALE%20DI%20MONZA/00_Event%20Info/Circuit%20Map%20v2.pdf) |
| le-mans | 2026 | 13625.7 | 1900.7 | 7672.13 | 3754.13 | [map](https://files.alkamelcloud.com/wec/results/15_2026/03_LE%20MANS/00_Event%20Info/Circuit%20Map%20v3.pdf) |

All 12 fitted track/year layouts differ in length by more than 0.5%, so every sector term is excluded.
A map can be verified while its mapping to the current geometry is ineligible. These two states are reported separately.
At most 0.5% length difference is allowed, measured relative to official length. Accepted distances are scaled to the simulation's distance scale.
Measured sectors must be positive and sum to the same real lap within 0.002 s, the maximum combined rounding error of three sectors and a lap published to 0.001 s.
Invalid rows retain lap and trap only and report the reason. WEC sector overrides copy the track object and never alter its F1 sector points.
Trap positions also require compatible geometry and a numeric source. A valid positioned trap bypasses the 92% filter; unknown positions keep the existing lap-maximum comparison and filter.

### 14.3 Aerodynamic ratio: held, no assumed numeric limit

- **2026 LMH Technical Regulations**, WMSC 16 October 2025, published 17 October 2025, clean issue, article 3.7.3: aerodynamic coefficients must meet criteria in the technical appendices. This clause gives no numeric downforce/drag ratio. Article 3.7.1 describes official wind-tunnel checks across ride heights. [Official document](https://www.fia.com/system/files/documents/2026_lmh_technical_regs_2025.10.16_published_2025.10.17_clean_version_0.pdf).
- **LMDh Technical Regulations**, revision 16 October 2025 (2026 rules), article 3.9.3, page 25: homologation requires aerodynamic performance inside the Target Window defined in the appendices. This clause gives no numeric downforce/drag ratio. Article 3.9.1 describes wind-tunnel maps over ride height and car attitude. [Official document](https://www.fia.com/system/files/documents/lmdh-technical-regulations-2025.10.16-blackline.pdf).

The applicable numeric appendix criteria have not been verified. Neither 4:1 nor another ratio has been implemented, and no aero bounds are changed. The owner decides the next step for (c).

### 14.4 Results and decision

Decision: **STOP under rule 5.3**. The flags-off baseline differs from production by more than 0.05 percentage points in four groups. No candidate or sensitivity run was started, no gate acceptance is claimed, and no model or code PR has been published. Owner direction is required before further experiments. The cause is not yet established; changing the iteration count or replacing geometry to make this pass would not be a valid silent correction.

| Class | Season | Production held-out RMS % | Run RMS % | Delta pp | Held-out n | Fitted laps | Grip muY | Downforce ClA | Drag CdA | Bound hits |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| lmh | 2025 | 1.43 | 1.54 | +0.11 | 5 | 15 | 1.568052 | 7.000000 | 1.087457 | clA upper 7 |
| lmh | 2026 | 1.04 | 1.10 | +0.06 | 6 | 18 | 1.521326 | 6.554535 | 0.964483 | none |
| lmdh | 2025 | 1.24 | 1.61 | +0.37 | 5 | 15 | 1.559939 | 7.000000 | 1.102774 | clA upper 7 |
| lmdh | 2026 | 1.07 | 1.05 | -0.02 | 6 | 18 | 1.530437 | 6.396914 | 0.953797 | none |
| lmgt3 | 2025 | 1.73 | 1.82 | +0.09 | 5 | 15 | 1.589101 | 3.500000 | 1.300000 | clA upper 3.5; cdA upper 1.3 |
| lmgt3 | 2026 | 1.37 | 1.36 | -0.01 | 6 | 18 | 1.613810 | 3.500000 | 1.291986 | clA upper 3.5 |

Downforce did **not** move off a bound in any group. LMH/LMDh 2026 were already below their upper bounds in production. LMDh 2025 also changed from 18 fitted rows to 15: the existing Timing71 pooling decision did not retain the extra rows in this baseline. This is diagnostic evidence, not evidence of a new timing feature's effect.

F1 seasons and projections are JSON-identical to production. The production calibration file has been restored byte-for-byte; the failed fit is retained only as a local experiment artifact.

| Check | Result |
|---|---|
| New timing tests plus existing report tests | 24/24 passed |
| Physics suite | 90/90 passed, including raced-session reproduction |
| Full suite, KONGBODA_FEATURES=all | 410/410 passed |
| npm run build / npm run validate | Both passed |
| Flags-off unit output compatibility | Passed |
| Full original-source vs modified-source byte comparison | Incomplete: control run cancelled when the stop condition was found |
| Production baseline tolerance | Failed: LMH 2025/2026, LMDh 2025, LMGT3 2025 |
| Primary candidates a, b2, ab2 | Not run: blocked by baseline failure |
| Sensitivity b1, b4, ab1, ab4 | Not run: blocked by baseline failure |
| Convergence and pooled WEC acceptance | Not established |

Reproduction inputs: archive SHA-256 268039a6acd2fd589336fede690e3321d723f6f50665718a55f6021cde1ac186, production geometry SHA-256 fe67d1ecf2a4c151f35f98e3da334d835881904ffb4ebda24488983952cee5eb. The archive includes older Interlagos geometry; only its raw timing cache was extracted, and the repository wet-session exclusions were applied. The production geometry was used unchanged.

Local evidence: .cache/wec-experiment/baseline.log, baseline.js, baseline-comparison.json, production.js, physics-tests.log and full-tests.log. These are preserved for baseline diagnosis; they are not published experiment artifacts or a completed PR.



## 15. Read-only baseline investigation (2026-11-10)

Owner limit: 45 minutes. No candidate sector/trap fit, model PR, merge, bound/weight/gate change or working geometry change. The revised eligibility rule is evaluated as an audit here; fitting code remains unchanged during this read-only investigation.

### 15.1 Input mismatch and selection decisions

Production calibration is byte-identical to PR #149, commit c08a72f66a8984013d5ede3b9b923bdb476eb734. PR #148 head is 82a8cadebc88ae1a4da6d2be02dfb1ccd4174810. Both PRs describe local WEC-only refits; neither records the original shell environment or raw local wec.json checksum. The reconstruction below is verified by execution, rather than represented as a recovered shell log.

The checked-in geometry is identical at PR #149 and the current base, but the geometry used to generate the PR #149 calibration differs at Interlagos. Archive Interlagos is session 11408 / source year 2026, 4227.802814 m; checked-in Interlagos is session 9865 / source year 2025, 4230.354610 m. Calling the archive geometry 'older' was inaccurate; these are different source snapshots. Curvature, grade, heading, sectors, corners and map differ, not only the length. Other 25 tracks are identical.

A saved-car replay with current geometry misses every PR #149 Interlagos stored lap by 0.091–0.223 s. The archive geometry reproduces all six at the stored 0.001 s precision. For PR #148 the reverse holds: current geometry reproduces all six stored Interlagos laps, and archive geometry does not.

| Class | Season | Grip: production → rerun | F1 / transfer RMS %: production → rerun | Pool RMS %: production → rerun | Pool used: production → rerun | BoP RMS %: production → rerun | BoP used |
|---|---:|---|---|---|---|---|---|
| lmh | 2025 | f1 → f1 | 1.43 / 1.74 → 1.54 / 1.61 | 1.43 → 1.49; 1.54 → 1.74 | false → false | 1.43 → 1.59; 1.54 → 1.80 | false → false |
| lmh | 2026 | transfer → transfer | 1.36 / 1.04 → 1.28 / 1.10 | 1.04 → 1.06; 1.10 → 1.14 | false → false | none; none | n/a → n/a |
| lmdh | 2025 | transfer → f1 | 1.74 / 1.34 → 1.61 / 1.66 | 1.34 → 1.24; 1.61 → 1.56 | true → false | 1.24 → 1.74; 1.61 → 1.64 | false → false |
| lmdh | 2026 | transfer → transfer | 1.42 / 1.07 → 1.40 / 1.05 | 1.07 → 1.03; 1.05 → 1.08 | false → false | none; none | n/a → n/a |
| lmgt3 | 2025 | transfer → transfer | 2.14 / 1.73 → 2.14 / 1.82 | 1.73 → 1.83; 1.82 → 1.79 | false → false | none; none | n/a → n/a |
| lmgt3 | 2026 | transfer → transfer | 1.49 / 1.37 → 1.48 / 1.36 | 1.37 → 1.35; 1.36 → 1.32 | false → false | none; none | n/a → n/a |

All BoP candidates are rejected in both files. The 2025 BoP references are identical: LMH 15 rows / 1048.7 kg / 500.9 kW; LMDh 15 rows / 1045.1 kg / 505.6 kW. Other BoP fields are null. Extra pool candidate counts are unchanged: 3 per Hypercar group and 5 per LMGT3 group. Every exact pooled, bop and gripSource field, including reason strings, is preserved in the investigation JSON.

| Group | Grip gate: production / failed rerun | Pool gate: production / failed rerun | BoP gate: production / failed rerun |
|---|---|---|---|
| lmh/2025 | rejected: worse on held-out rows / rejected: worse on held-out rows | rejected: worse on held-out rows / rejected: worse on held-out rows | rejected: worse on held-out rows / rejected: worse on held-out rows |
| lmh/2026 | accepted: held-out error lower beyond noise / rejected: gain within noise | rejected: worse on held-out rows / rejected: worse on held-out rows | null / null |
| lmdh/2025 | accepted: held-out error lower beyond noise / rejected: worse on held-out rows | accepted: held-out error lower beyond noise / rejected: gain within noise | rejected: worse on held-out rows / rejected: worse on held-out rows |
| lmdh/2026 | rejected: gain within noise / accepted: held-out error lower beyond noise | rejected: gain within noise / rejected: worse on held-out rows | null / null |
| lmgt3/2025 | rejected: gain within noise / rejected: gain within noise | rejected: worse on held-out rows / rejected: gain within noise | null / null |
| lmgt3/2026 | rejected: gain within noise / rejected: gain within noise | rejected: gain within noise / rejected: gain within noise | null / null |

LMDh 2025: production first selects transfer grip (1.74 → 1.34%); pooling then passes (1.34 → 1.24%), giving 15 Al Kamel plus 3 Timing71 rows. The mismatched rerun selects F1 grip (1.61 vs transfer 1.66%); pooling improves 1.61 → 1.56% but is within noise, so only 15 rows remain. No row was silently removed by the new timing flags.

Per-track input diff: **zero differing rows out of 33 paired class-season-track rows**. Track membership and the fields realLap, trapKph, car, event and weather are exactly equal. The saved calibration stores only the first lap per track, so the lower two laps are checked through the full historical reproduction rather than claimed to be present in that saved output.

### 15.2 Raw input and source provenance

| Class | Season | Archive sessions / selected laps | Dry sessions / laps | Wet exclusion | Timing71 candidates |
|---|---:|---:|---:|---|---:|
| lmh | 2025 | 6 / 18 | 5 / 15 | austin | 3 |
| lmh | 2026 | 6 / 18 | 6 / 18 | none | 3 |
| lmdh | 2025 | 6 / 18 | 5 / 15 | austin | 3 |
| lmdh | 2026 | 6 / 18 | 6 / 18 | none | 3 |
| lmgt3 | 2025 | 6 / 18 | 5 / 15 | austin | 5 |
| lmgt3 | 2026 | 6 / 18 | 6 / 18 | none | 5 |

The archive contains 36 class-session rows / 108 selected laps. Its only effective preprocessing change is rain=false → true for the three Austin 2025 class rows, following scripts/sim/data/wet-sessions.json; 9 laps are excluded and 99 remain. The pinned raw file is therefore not the final fit input until these exclusions are applied. No lap, trap, car, event, sector or numeric weather value is changed. Timing71 is the unchanged 11-row derived file: LMH 3, LMDh 3, LMGT3 5, all from 2024.

| Input | SHA-256 |
|---|---|
| archive | 268039a6acd2fd589336fede690e3321d723f6f50665718a55f6021cde1ac186 |
| archiveWec | aa40cae3646ea33a3d1692c0f523196a4716bd707b84b38476bcf96da9d54626 |
| excludedWec | ce25a479ab6b256d2ac597fa34c5941f7f3166db3bd4112e92cd355502a11960 |
| archiveGeometry | 4fc1b3ecb014434b70d54be520803da3af7bf9ff19b63508c9518f29dd3b67f1 |
| checkedInGeometry | fe67d1ecf2a4c151f35f98e3da334d835881904ffb4ebda24488983952cee5eb |
| transferB | b2d3bba7113685d1382415b4717bd26a6df2aa73f4664c0c88e64068d08e3705 |
| transferJ | c927fb77ef2681aafe9b47f327d7d001d83ffc7789a32430c0ebe0df43ca76e4 |
| timing71 | 4852d273a360192fe0007c756c3a1e0f70d5aefeeb2cd46198c49878a7c12a76 |
| seed149 | 47e7c24a6df9bc67fd59dcd4fa0de6ffee290cfc02810d1e6742bca901f39586 |
| seed148 | bc81688bc1f760ebbc6e2975e631d90eb0251cc0546efe7b7f134e84cc5efff3 |

PR #148 uses transfer-grip git blob 2fc61d5bf9ad83eabf68b0244ae2a5ef52fa21c4 (J); PR #149 uses 38b864d7f971d2ea8dd8eb98427378db6d1c1539 (B). All 26 values match their experiment artifacts exactly: probe-out/cal-J.js blob 9812395026352dc4098afa8f38169bd017c9c197 and cal-B.js blob 6c2215d44808b315532c884f76a7a2a4b2637f9e on the fork.

The documented WEC command is LAPSIM_ONLY=wec node scripts/sim/calibrate.mjs. Source defaults are LAPSIM_ITERS=70 and LAPSIM_HOLDOUT_ITERS=25. The production workflow's BCD 5 rounds / 200 iterations apply to F1, not the WEC Nelder–Mead fit. WEC lap/trap weights stay 2 / 0.5. Transfer generation is node scripts/sim/transfer-grip.mjs <cal-B.js or cal-J.js> <source label>; this investigation reads the already generated table without regenerating it.

Sources: [PR #149](https://github.com/MisterKinn/f1-data-analyst/pull/149), [commit c08a72f](https://github.com/MisterKinn/f1-data-analyst/commit/c08a72f66a8984013d5ede3b9b923bdb476eb734), [PR #148](https://github.com/MisterKinn/f1-data-analyst/pull/148), [pinned archive](https://raw.githubusercontent.com/kangjeongmin1229/f1-data-analyst-deploy/probe/lapsim-export/probe-out/lapsim-inputs.tgz.part-aa).

### 15.3 Revised sector eligibility, audited before any sector fit

Use ratio = simulated ds times point count / official centre-line length. Scale official S1/S2 distances by this ratio; accept abs(ratio - 1) <= 0.02. Positive sectors and absolute sum-minus-lap <= 0.002 s remain required. No F1 sector point is altered.

Sanity check declared before calculation: for each dry track-year, simulate the best real lap of each class with its saved production car, track grip and session weather. Exclude the whole track-year if any of its classes exceeds 3 percentage points in any sector share. No mapping is selected by the candidate's held-out result.

| Track | Season | Current length m | Official length m | Ratio % | Largest share difference pp | Status |
|---|---:|---:|---:|---:|---:|---|
| lusail | 2025 | 5387.457 | 5418 | 99.436261 | 0.327 | eligible |
| imola | 2025 | 4866.758 | 4909 | 99.139493 | 0.412 | eligible |
| spa-francorchamps | 2025 | 6947.286 | 7003.9 | 99.191678 | 1.256 | eligible |
| interlagos | 2025 | 4230.355 | 4309 | 98.174858 | 0.864 | eligible |
| austin | 2025 | 5422.794 | 5513 | 98.363760 | not tested | wet: excluded before sector check |
| sakhir | 2025 | 5337.455 | 5412 | 98.622592 | 0.471 | eligible |
| imola | 2026 | 4866.758 | 4909 | 99.139493 | 0.427 | eligible |
| spa-francorchamps | 2026 | 6947.286 | 7003.9 | 99.191678 | 1.208 | eligible |
| interlagos | 2026 | 4230.355 | 4309 | 98.174858 | 1.174 | eligible |
| austin | 2026 | 5422.794 | 5513 | 98.363760 | 0.227 | eligible |
| catalunya | 2026 | 4610.808 | 4657 | 99.008121 | 0.256 | eligible |
| monza | 2026 | 5759.499 | 5793 | 99.421692 | 1.946 | eligible |

All 12 track-years pass the length rule. Austin 2025 remains wet and is not admitted. All 33 dry class-season-track sanity checks pass; the largest absolute share difference is 1.946333 pp (LMGT3 Monza 2026). All 99 dry selected laps have positive sectors and pass the sum check.

| Class | Season | Dry Al Kamel laps | Sector terms | Held-out tracks with sectors | Positioned traps |
|---|---:|---:|---:|---:|---:|
| lmh | 2025 | 15 | 15 | 5 | 0 |
| lmh | 2026 | 18 | 18 | 6 | 0 |
| lmdh | 2025 | 15 | 15 | 5 | 0 |
| lmdh | 2026 | 18 | 18 | 6 | 0 |
| lmgt3 | 2025 | 15 | 15 | 5 | 0 |
| lmgt3 | 2026 | 18 | 18 | 6 | 0 |

Every group has at least 4 held-out tracks with sector observations (actually 5 or 6); no group is blocked by the requested minimum. Gate acceptance is not implied by sample count. Timing71 extra rows have no verified year-specific sector mapping and remain lap + trap only.

Historical archive Interlagos ratio is 98.115637%, also within 2%. Its sector-share check passes for all six groups (largest difference 1.046766 pp). Thus using the historical snapshot changes no eligibility count; its numeric shares are recorded separately.

| Class | Season | Track | Real S1/S2/S3 % | Sim S1/S2/S3 % | Largest difference pp | Result |
|---|---:|---|---|---|---:|---|
| lmh | 2025 | lusail | 36.301 / 33.634 / 30.065 | 36.475 / 33.737 / 29.788 | 0.277 | pass |
| lmdh | 2025 | lusail | 36.283 / 33.577 / 30.140 | 36.466 / 33.721 / 29.813 | 0.327 | pass |
| lmgt3 | 2025 | lusail | 36.268 / 33.089 / 30.644 | 36.475 / 32.812 / 30.713 | 0.277 | pass |
| lmh | 2025 | imola | 20.595 / 32.574 / 46.831 | 21.007 / 32.266 / 46.727 | 0.412 | pass |
| lmdh | 2025 | imola | 20.730 / 32.582 / 46.689 | 20.976 / 32.291 / 46.733 | 0.291 | pass |
| lmgt3 | 2025 | imola | 20.684 / 32.599 / 46.717 | 21.070 / 32.477 / 46.453 | 0.386 | pass |
| lmh | 2025 | spa-francorchamps | 28.332 / 46.251 / 25.417 | 29.588 / 45.136 / 25.277 | 1.256 | pass |
| lmdh | 2025 | spa-francorchamps | 28.420 / 45.920 / 25.660 | 29.647 / 45.031 / 25.321 | 1.227 | pass |
| lmgt3 | 2025 | spa-francorchamps | 28.512 / 45.816 / 25.672 | 29.663 / 44.939 / 25.398 | 1.151 | pass |
| lmh | 2025 | interlagos | 25.594 / 51.066 / 23.340 | 25.659 / 51.452 / 22.888 | 0.452 | pass |
| lmdh | 2025 | interlagos | 25.674 / 50.845 / 23.481 | 25.702 / 51.341 / 22.958 | 0.523 | pass |
| lmgt3 | 2025 | interlagos | 25.810 / 50.133 / 24.058 | 25.664 / 50.997 / 23.339 | 0.864 | pass |
| lmh | 2025 | sakhir | 31.812 / 36.855 / 31.333 | 31.958 / 36.438 / 31.605 | 0.418 | pass |
| lmdh | 2025 | sakhir | 31.747 / 36.863 / 31.389 | 31.892 / 36.493 / 31.615 | 0.370 | pass |
| lmgt3 | 2025 | sakhir | 31.693 / 36.572 / 31.735 | 31.751 / 36.102 / 32.148 | 0.471 | pass |
| lmh | 2026 | imola | 20.492 / 32.856 / 46.652 | 20.832 / 32.460 / 46.709 | 0.396 | pass |
| lmdh | 2026 | imola | 20.551 / 32.907 / 46.542 | 20.832 / 32.479 / 46.689 | 0.427 | pass |
| lmgt3 | 2026 | imola | 20.841 / 32.783 / 46.376 | 21.061 / 32.492 / 46.446 | 0.290 | pass |
| lmh | 2026 | spa-francorchamps | 28.168 / 46.604 / 25.228 | 29.376 / 45.549 / 25.074 | 1.208 | pass |
| lmdh | 2026 | spa-francorchamps | 28.151 / 46.412 / 25.437 | 29.342 / 45.595 / 25.064 | 1.191 | pass |
| lmgt3 | 2026 | spa-francorchamps | 28.721 / 45.498 / 25.781 | 29.741 / 44.844 / 25.414 | 1.021 | pass |
| lmh | 2026 | interlagos | 26.057 / 50.558 / 23.385 | 25.759 / 51.732 / 22.510 | 1.174 | pass |
| lmdh | 2026 | interlagos | 25.855 / 50.768 / 23.378 | 25.730 / 51.784 / 22.486 | 1.016 | pass |
| lmgt3 | 2026 | interlagos | 26.051 / 49.844 / 24.105 | 25.899 / 50.890 / 23.211 | 1.046 | pass |
| lmh | 2026 | austin | 21.335 / 37.895 / 40.770 | 21.364 / 37.985 / 40.651 | 0.118 | pass |
| lmdh | 2026 | austin | 21.335 / 37.912 / 40.753 | 21.373 / 37.970 / 40.657 | 0.095 | pass |
| lmgt3 | 2026 | austin | 21.625 / 38.258 / 40.117 | 21.797 / 38.313 / 39.890 | 0.227 | pass |
| lmh | 2026 | catalunya | 29.095 / 40.564 / 30.341 | 29.247 / 40.659 / 30.093 | 0.248 | pass |
| lmdh | 2026 | catalunya | 29.039 / 40.735 / 30.226 | 29.256 / 40.650 / 30.095 | 0.217 | pass |
| lmgt3 | 2026 | catalunya | 29.839 / 40.493 / 29.668 | 30.032 / 40.237 / 29.731 | 0.256 | pass |
| lmh | 2026 | monza | 32.210 / 34.017 / 33.772 | 33.690 / 32.374 / 33.935 | 1.643 | pass |
| lmdh | 2026 | monza | 32.278 / 33.960 / 33.762 | 33.655 / 32.377 / 33.968 | 1.583 | pass |
| lmgt3 | 2026 | monza | 32.073 / 33.853 / 34.074 | 33.576 / 31.907 / 34.517 | 1.946 | pass |

### 15.4 Trap hold and next experiment declaration

(a) is held: zero fitted tracks have a verified numeric trap distance. The existing implementation stays behind its off-by-default flag; no positioned-trap experiment is run. Potential official documents to request/check are the event timing Circuit Map in Al Kamel Event Info/Circuit Info, an FIA WEC Race Director Event Notes map appendix, or the timing provider's official loop-position/chainage schedule. They must give a numeric position from the timing line for the correct layout/year. A graphical TS marker alone is insufficient. The verified Le Mans 2026 Circuit Map v3 explicitly gives 3754.13 m, but Le Mans has no fitted geometry and contributes zero observations. No new trap source was fetched or assumed in this investigation.

Next declared primary variants: baseline and b2 only. Sensitivity: b1 and b4 only; no weight selection from held-out results. LAPSIM_ONLY=wec; lap weight 2; trap weight 0.5; sector weight 2 primary, 1/4 sensitivity. Both feature flags are off in the baseline; trap flag remains off in every variant. Pass: pooled WEC gate accepted, no class-season worse, F1 unchanged. Bounds and gate remain unchanged. Eligibility above is a diagnostic calculation, not a completed change to the fitting code: wire the approved 2% and share checks before any future sector run. (c) remains held.


### 15.5 Completed historical reproduction and byte identity

**Result A:** all model fields from PR #149 reproduce exactly with the pinned archive geometry, existing wet exclusions, B transfer table, LAPSIM_ONLY=wec, LAPSIM_ITERS=70 and LAPSIM_HOLDOUT_ITERS=25. Every car parameter, score, track row, held-out result, pooled/bop/gripSource object, F1 season and projection matches at full precision. The only file difference is generatedAt (2026-11-09 versus 2026-11-10); normalizing that metadata date makes every other byte identical. Section 5.2 records the exact historical recipe and checksums.

| Class | Season | Production RMS % | Failed current-geometry RMS % | Historical replay RMS % | Held-out n | Fitted laps | Grip muY | Downforce ClA | Drag CdA | Bound hits |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| lmh | 2025 | 1.43 | 1.54 | 1.43 | 5 | 15 | 1.568817 | 7.000000 | 1.086824 | clA upper 7 |
| lmh | 2026 | 1.04 | 1.10 | 1.04 | 6 | 18 | 1.518156 | 6.630406 | 0.963682 | none |
| lmdh | 2025 | 1.24 | 1.61 | 1.24 | 5 | 18 | 1.561175 | 7.000000 | 1.099404 | clA upper 7 |
| lmdh | 2026 | 1.07 | 1.05 | 1.07 | 6 | 18 | 1.528597 | 6.446839 | 0.953795 | none |
| lmgt3 | 2025 | 1.73 | 1.82 | 1.73 | 5 | 15 | 1.590430 | 3.500000 | 1.286196 | clA upper 3.5 |
| lmgt3 | 2026 | 1.37 | 1.36 | 1.37 | 6 | 18 | 1.615853 | 3.500000 | 1.300000 | clA upper 3.5; cdA upper 1.3 |

Downforce did not move off a bound. This reproduces the existing model; it does not introduce a new model. The failed current-geometry baseline is not promoted. The checked-in geometry/calibration inconsistency remains for the owner's decision.

PR #148 cross-check also passed: all model fields and all bytes except generatedAt match exactly, using the current checked-in geometry, J transfer table, the same preprocessed cache, and the same 70/25 WEC command. PR #148 and PR #149 both preserve identical F1 seasons. The original local shell logs were not recovered; these commands are experimentally verified reconstructions.

| Compatibility check | Result | Bytes |
|---|---|---:|
| Full calibration: modified flags-off source vs original source | byte-identical | 55407 |
| Calibration stdout | byte-identical | 5629 |
| Validation JSON | byte-identical | 24756 |
| Validation stdout | byte-identical | 2038 |

The first investigation was interrupted by a computer power loss after all three refit processes had exited. On reconnection, the saved PR #148 result was compared and the stored PR #149 and byte-identity evidence rechecked. No fit was restarted. All 44 working worker/lapsim JavaScript files, the production calibration, geometry and gate remain unchanged. Only documentation was updated in this read-only investigation; the approved 2% and sector-share rules were audited but still need implementation before any future sector fit. No candidate experiment, PR, merge or deployment was performed.

Evidence is saved locally in .cache/wec-investigation/: baseline-input-audit.json, sector-share-audit.json, archive-interlagos-sector-audit.json, provenance-hashes.json, pr149-exact-reproduction.json, pr148-exact-reproduction.json and flags-off-identity.json. These are local investigation artifacts, not a published experiment.

**Decision: report and wait.** Primary future variants are baseline/b2; b1/b4 are sensitivity only. Trap (a) and aero ratio (c) remain held.

## 16. Approved sector experiment and geometry investigation — 2026-11-10

**Decision: reject b2; keep both flags off. No model or geometry change.** The primary sector weight was fixed at 2 before the run. Pooled WEC held-out RMS rises from 1.321% to 1.329% (n=33); LMDh 2025 and LMGT3 2025 worsen. Sensitivity weights 1 and 4 do not replace the primary decision. This section supersedes the waiting state at the end of section 15.

**Small-sample caution, next to the result:** with n=5 or 6, a gain below about 0.1 percentage points is not established, even if the gate accepts it. Changing only the Interlagos input geometry moved LMDh 2025 by 0.37 pp. The accepted sensitivity cells below are all under 0.1 pp. They are not evidence for selecting a different weight.

### 16.1 Backup, declaration and fixed eligibility

The existing work was backed up first to `kangjeongmin1229/f1-data-analyst-deploy`, branch `feat/lapsim-wec-timing`, commit `f769d678f3cae1cdf03641da1411432ebc3ecad7`, with flags off. The experiment then used the exact section 5.2 PR #149 recipe: archive geometry, production F1 seed, B transfer table, existing wet exclusions and unchanged Timing71 input. Every pinned hash matched. Runs used isolated directories; the 44 production model files and the gate were not changed.

Predeclared settings: `LAPSIM_ONLY=wec`, `LAPSIM_ITERS=70`, `LAPSIM_HOLDOUT_ITERS=25`; lap weight 2, trap weight 0.5. Primary baseline/b2; b1/b4 sensitivity only. Trap off in every variant; aero ratio not implemented. All other LAPSIM overrides cleared. Pass: pooled WEC accepted, no class-season worse, F1 unchanged. Eligibility and coverage were reported before any fit. Baseline fit: 435.5 s; original-source control: 417.9 s. Candidate fits ran independently in parallel: b2 520.6 s, b1 504.4 s, b4 502.7 s. The baseline-plus-candidate screen completed within 19 minutes of baseline start, below the 60-minute limit.

The new rule scales official distances by model/official length, with an inclusive 2% limit. Positive sectors must sum to the observed lap within 0.002 s. The share check ran once, using each production class car, its saved track grip and observed weather on the best dry lap. Every sector must be within 3 pp of the real share. A failed class excludes the entire track-year; a bad lower-ranked sector sum excludes that row only. The frozen table is reused by every sector variant and input hashes are checked before fitting. F1 sector points are copied, never mutated.

| Track | Year | Official m | Model m | Ratio % | Disposition |
|---|---|---|---|---|---|
| lusail | 2025 | 5418.0 | 5387.457 | 99.436 | pass |
| imola | 2025 | 4909.0 | 4866.758 | 99.139 | pass |
| spa-francorchamps | 2025 | 7003.9 | 6947.286 | 99.192 | pass |
| interlagos | 2025 | 4309.0 | 4227.803 | 98.116 | pass |
| austin | 2025 | 5513.0 | 5422.794 | 98.364 | length passes; wet, excluded |
| sakhir | 2025 | 5412.0 | 5337.455 | 98.623 | pass |
| imola | 2026 | 4909.0 | 4866.758 | 99.139 | pass |
| spa-francorchamps | 2026 | 7003.9 | 6947.286 | 99.192 | pass |
| interlagos | 2026 | 4309.0 | 4227.803 | 98.116 | pass |
| austin | 2026 | 5513.0 | 5422.794 | 98.364 | pass |
| catalunya | 2026 | 4657.0 | 4610.808 | 99.008 | pass |
| monza | 2026 | 5793.0 | 5759.499 | 99.422 | pass |

No track is outside 2%. Le Mans has an official map but no model geometry and contributes no lap. All 33 class-track-year share checks pass; the maximum is 1.946333 pp (LMGT3, Monza 2026). All 99 dry selected laps have valid sector sums. Austin 2025 contributes 9 wet laps and remains excluded under the existing external exclusion list. The frozen JSON includes every signed sector-share difference and every row decision.

| Class | Season | Eligible sector laps | Held-out tracks with sectors | Positioned traps |
|---|---|---|---|---|
| lmh | 2025 | 15 | 5 | 0 |
| lmdh | 2025 | 15 | 5 | 0 |
| lmgt3 | 2025 | 15 | 5 | 0 |
| lmh | 2026 | 18 | 6 | 0 |
| lmdh | 2026 | 18 | 6 | 0 |
| lmgt3 | 2026 | 18 | 6 | 0 |

These counts apply to b1/b2/b4; baseline has no sector term because the flag is off. Every group has at least 4 eligible held-out tracks (the gate itself retains its existing settings). Timing71 rows have no verified mapping and keep lap + trap only, including the 3 extra rows used by baseline LMDh 2025. Fixed eligibility SHA-256: `72e2e2e866bbf2c964a7d774692f6db02bfd88d1e946252cd8b960ea05c0ad13`.

### 16.2 Primary result — baseline versus b2

| Group | n | Baseline RMS % | b2 RMS % | Delta pp | Gate |
|---|---|---|---|---|---|
| wec | 33 | 1.321 | 1.329 | +0.008 | rejected: worse on held-out rows |
| wec-lmh/2025 | 5 | 1.432 | 1.303 | -0.129 | rejected: gain within noise |
| wec-lmh/2026 | 6 | 1.041 | 0.978 | -0.063 | rejected: gain within noise |
| wec-lmdh/2025 | 5 | 1.238 | 1.418 | +0.180 | rejected: worse on held-out rows |
| wec-lmdh/2026 | 6 | 1.071 | 1.070 | -0.001 | rejected: gain within noise |
| wec-lmgt3/2025 | 5 | 1.733 | 1.799 | +0.066 | rejected: worse on held-out rows |
| wec-lmgt3/2026 | 6 | 1.370 | 1.353 | -0.017 | rejected: gain within noise |

| Variant | Class / season | Held-out RMS % | n | Fitted laps | muY | ClA | CdA | Bound hits | pooled.used | bop.used | gripSource.used |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | lmh/2025 | 1.432 | 5 | 15 | 1.568817 | 7.000000 | 1.086824 | clA upper | no | no | f1 |
| baseline | lmh/2026 | 1.041 | 6 | 18 | 1.518156 | 6.630406 | 0.963682 | none | no | n/a | transfer |
| baseline | lmdh/2025 | 1.238 | 5 | 18 | 1.561175 | 7.000000 | 1.099404 | clA upper | yes | no | transfer |
| baseline | lmdh/2026 | 1.071 | 6 | 18 | 1.528597 | 6.446839 | 0.953795 | none | no | n/a | transfer |
| baseline | lmgt3/2025 | 1.733 | 5 | 15 | 1.590430 | 3.500000 | 1.286196 | clA upper | no | n/a | transfer |
| baseline | lmgt3/2026 | 1.370 | 6 | 18 | 1.615853 | 3.500000 | 1.300000 | clA upper; cdA upper | no | n/a | transfer |
| b2 | lmh/2025 | 1.303 | 5 | 15 | 1.563367 | 7.000000 | 1.074092 | clA upper | no | no | f1 |
| b2 | lmh/2026 | 0.978 | 6 | 18 | 1.583538 | 5.487790 | 0.962826 | none | no | n/a | transfer |
| b2 | lmdh/2025 | 1.418 | 5 | 15 | 1.552789 | 7.000000 | 1.087961 | clA upper | no | no | transfer |
| b2 | lmdh/2026 | 1.070 | 6 | 18 | 1.574303 | 5.652061 | 0.952068 | none | no | n/a | transfer |
| b2 | lmgt3/2025 | 1.799 | 5 | 15 | 1.584653 | 3.500000 | 1.266720 | clA upper | no | n/a | transfer |
| b2 | lmgt3/2026 | 1.353 | 6 | 18 | 1.611594 | 3.500000 | 1.288184 | clA upper | no | n/a | transfer |

RMS above is reconstructed from the stored held-out errors and observed laps, as used by exp-compare; calibration summary RMS is rounded to two decimals. `n/a` means no BoP/pooling candidate was evaluated, not a failed candidate. Full `pooled`, `bop` and `gripSource` objects, including candidate errors and gate reasons, are retained in results.json and each calibration artifact.

**Downforce did not move off its bound in any previously bound group.** LMH 2025 and LMDh 2025 remain at ClA=7; LMGT3 2025/2026 remain at ClA=3.5. The two 2026 Hypercar values fall but were already inside the bounds. LMGT3 2026 drag moves off CdA=1.3 to 1.288184. There are no new bound hits.

**One primary selection flips:** LMDh 2025 `pooled.used` changes true → false, and fitted laps change 18 → 15. No baseline/b2 `gripSource.used` or `bop.used` choice flips. The fixed sector eligibility does not change when these existing fit choices change.

F1 seasons and projections are structurally identical in every run; the JSON serialization of each is also identical. F1 held-out RMS stays 0.840% (2025, n=20) and 0.900% (2026, n=14). The gate reports equal values as “rejected: worse on held-out rows” because it requires a strict improvement; this is not an F1 regression. No gate logic was changed.

### 16.3 Sensitivity only — no weight selection

| Variant | Pooled WEC n | Pooled RMS % | Gate | Decision role |
|---|---|---|---|---|
| b1 | 33 | 1.319 | rejected: gain within noise | sensitivity only |
| b2 | 33 | 1.329 | rejected: worse on held-out rows | primary; rejected |
| b4 | 33 | 1.350 | rejected: worse on held-out rows | sensitivity only |

| Variant | Class / season | Held-out RMS % | n | Fitted laps | muY | ClA | CdA | Bound hits | pooled.used | bop.used | gripSource.used |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1 | lmh/2025 | 1.304 | 5 | 15 | 1.564587 | 7.000000 | 1.083144 | clA upper | no | no | transfer |
| b1 | lmh/2026 | 0.954 | 6 | 18 | 1.554553 | 5.976520 | 0.964708 | none | no | n/a | transfer |
| b1 | lmdh/2025 | 1.450 | 5 | 15 | 1.556814 | 7.000000 | 1.098774 | clA upper | no | no | transfer |
| b1 | lmdh/2026 | 1.026 | 6 | 18 | 1.552049 | 6.033355 | 0.954753 | none | no | n/a | transfer |
| b1 | lmgt3/2025 | 1.793 | 5 | 15 | 1.586212 | 3.500000 | 1.272742 | clA upper | no | n/a | transfer |
| b1 | lmgt3/2026 | 1.329 | 6 | 18 | 1.615247 | 3.500000 | 1.292051 | clA upper | no | n/a | transfer |
| b4 | lmh/2025 | 1.471 | 5 | 15 | 1.557790 | 7.000000 | 1.065135 | clA upper | no | no | transfer |
| b4 | lmh/2026 | 1.013 | 6 | 18 | 1.585826 | 5.418620 | 0.952821 | none | no | n/a | transfer |
| b4 | lmdh/2025 | 1.501 | 5 | 15 | 1.550610 | 7.000000 | 1.082463 | clA upper | no | no | transfer |
| b4 | lmdh/2026 | 0.982 | 6 | 18 | 1.591197 | 5.364846 | 0.945055 | none | no | n/a | transfer |
| b4 | lmgt3/2025 | 1.783 | 5 | 15 | 1.579853 | 3.500000 | 1.242390 | clA upper | no | n/a | transfer |
| b4 | lmgt3/2026 | 1.306 | 6 | 18 | 1.604024 | 3.500000 | 1.228629 | clA upper | no | n/a | transfer |

b1 has accepted group gates for LMH 2026 (gain 0.087 pp), LMDh 2026 (0.045 pp), and LMGT3 2026 (0.041 pp). b4 has an accepted LMDh 2026 cell (0.089 pp). **All are under 0.1 pp and are not established at n=6.** Both sensitivity variants also worsen LMDh 2025 and LMGT3 2025. No sensitivity weight is promoted. LMH 2025 uses transfer grip in b1/b4, unlike baseline/b2; this sensitivity of the existing selection is reported, not tuned away.

### 16.4 Physical diagnostics

| Group | Matched traps n | Baseline trap RMS km/h | b2 trap RMS km/h | Delta km/h | WEC corner observations | New bound hits |
|---|---|---|---|---|---|---|
| wec-lmh/2025 | 5 | 10.020 | 9.999 | -0.022 | 0 / unavailable | 0 |
| wec-lmh/2026 | 5 | 3.366 | 3.633 | +0.267 | 0 / unavailable | 0 |
| wec-lmdh/2025 | 5 | 11.958 | 11.989 | +0.032 | 0 / unavailable | 0 |
| wec-lmdh/2026 | 5 | 3.411 | 3.538 | +0.127 | 0 / unavailable | 0 |
| wec-lmgt3/2025 | 5 | 5.804 | 5.577 | -0.227 | 0 / unavailable | 0 |
| wec-lmgt3/2026 | 6 | 8.291 | 8.368 | +0.077 | 0 / unavailable | 0 |

Trap (a) remains off: these residuals compare the simulated lap maximum with the measured trap, not speed at a known trap position. Their definitions are identical between variants, but they cannot validate physical drag accuracy. Four groups worsen on this metric. WEC corner minima have no measured observations; missing evidence is not a pass. F1 corner bias and trap RMS are exactly unchanged between variants on the fixed archive geometry. Section 15.4 lists the official documents that could supply numeric trap chainage; no pixel inference or new trap distance was introduced.

### 16.5 Doubled-iteration baseline diagnostic — not adopted

One further baseline used `LAPSIM_ITERS=140`, `LAPSIM_HOLDOUT_ITERS=50`, all timing flags off, the same production seed and pinned inputs. This is a diagnostic only. It does not replace the exact 70/25 production baseline and it is not used to accept b2.

| Variant | Class / season | Held-out RMS % | n | Fitted laps | muY | ClA | CdA | Bound hits | pooled.used | bop.used | gripSource.used |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline140 | lmh/2025 | 1.076 | 5 | 15 | 1.568868 | 7.000000 | 1.086312 | clA upper | no | no | f1 |
| baseline140 | lmh/2026 | 1.046 | 6 | 18 | 1.517850 | 6.635010 | 0.963651 | none | no | n/a | transfer |
| baseline140 | lmdh/2025 | 1.259 | 5 | 15 | 1.560082 | 7.000000 | 1.104799 | clA upper | no | no | transfer |
| baseline140 | lmdh/2026 | 0.977 | 6 | 18 | 1.528597 | 6.446839 | 0.953795 | none | no | n/a | transfer |
| baseline140 | lmgt3/2025 | 1.334 | 5 | 15 | 1.590303 | 3.500000 | 1.286063 | clA upper | no | n/a | transfer |
| baseline140 | lmgt3/2026 | 1.270 | 6 | 18 | 1.619744 | 3.500000 | 1.284389 | clA upper | no | n/a | f1 |

| Group | Delta held-out pp | Delta muY | Delta ClA | Delta CdA | 70/25 score | 140/50 score | Score change % |
|---|---|---|---|---|---|---|---|
| wec-lmh/2025 | -0.356 | +0.000051 | +0.000000 | -0.000512 | 4.912 | 4.912 | +0.000 |
| wec-lmh/2026 | +0.005 | -0.000306 | +0.004605 | -0.000031 | 0.956 | 0.956 | +0.000 |
| wec-lmdh/2025 | +0.021 | -0.001093 | +0.000000 | +0.005395 | 3.924 | 4.511 | +14.959 |
| wec-lmdh/2026 | -0.094 | +0.000000 | +0.000000 | +0.000000 | 1.057 | 1.057 | +0.000 |
| wec-lmgt3/2025 | -0.399 | -0.000127 | +0.000000 | -0.000133 | 2.584 | 2.584 | +0.000 |
| wec-lmgt3/2026 | -0.100 | +0.003891 | +0.000000 | -0.015611 | 2.880 | 3.529 | +22.535 |

The 140/50 diagnostic took 1108.3 s plus 0.9 s for validation. Pooled WEC RMS is 1.162% versus 1.321% at 70/25. The largest group change is LMGT3 2025, -0.399 pp; LMH 2025 changes -0.356 pp. LMDh 2025 changes pooled.used from true to false (18 to 15 fitted laps), and LMGT3 2026 changes gripSource from transfer to f1. Thus the displayed score deltas for those groups compare different selected fits, not the same fixed objective. Scores are saved rounded to three decimals; zero displayed change does not prove convergence. These movements show material held-out iteration sensitivity. No diagnostic values are adopted and the b2 rejection remains based only on the declared 70/25 comparison.

Iteration sensitivity is not the rule 5.1 proof that every main/held-out objective falls by less than 1% in its last two rounds. The WEC Nelder–Mead path does not record that per-fold history. No such convergence proof is claimed. This diagnostic is reported as requested and is not adopted.

### 16.6 Interlagos provenance and fixed-value replay

| Production piece | Interlagos geometry / evidence |
|---|---|
| F1 seasons 2023–2026 | Repository geometry: source year 2025, session 9865. Every F1 season equals the calibration in commit 9fb675e2. That commit also contains the exact current geometry blob 973641c280b0bc425758149667c892a5dd3d3d67. |
| Shared F1 Interlagos grip 0.9602 (drag 0.9914) | Same repository geometry and joint F1 fit. Only the 2025 season has a dry fitted Interlagos row; 2023/2024/2026 observations are marked rain and excluded. |
| B transfer Interlagos grip 0.9823 | Archive geometry: source year 2026, session 11408. Run 42558077604, B job 128968219459, unpacks the exported archive before calibration. Re-extracting all rounded track grip values from cal-B.js matches the production transfer table exactly. |
| PR #149 WEC cars | Archive geometry, as demonstrated by exact full reproduction in section 15.5 and again here. |

The repository geometry/calibration came from the Lap simulator data pipeline and is recorded in [commit 9fb675e2](https://github.com/MisterKinn/f1-data-analyst/commit/9fb675e2cb60de4ee5e2d395af5acabf45740e73), authored by kongboda-lapsim[bot] on 7 November at 21:17:13 UTC, committed at 22:16:49 UTC. [Its workflow](https://github.com/MisterKinn/f1-data-analyst/blob/9fb675e2cb60de4ee5e2d395af5acabf45740e73/.github/workflows/lapsim-data.yml) fetches data, tunes/builds geometry, fits cars, and commits derived files together. The exact original Actions run ID was not recovered; the commit and exact blob identity are the evidence.

The archive was generated separately by [export run 42544457411](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42544457411), started 9 November 01:13:59 UTC, using [workflow commit cdeca686](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/blob/cdeca686a164a9f4d45e605d81c7b04b07b7f1db/.github/workflows/probe-lapsim-export.yml). It fetched OpenF1 again and ran tune-geometry, then saved the archive in [commit a8f19241](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/commit/a8f19241e7bb9d91acddd42dc9204df82e1a241a) at 03:43:20 UTC. Both versions of build-geometry select the maximum available source year for each track, without filtering wet sessions for geometry. The export contains session 11408/2026; the earlier repository geometry records 9865/2025. This is a later input snapshot, not a different length-setting rule. The original raw index/fetch log was not recovered, so exactly why 11408 was unavailable to the earlier build is not established.

[B run 42558077604](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42558077604) used [workflow 3d21b2c9](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/blob/3d21b2c94c61a224065c2e79427dc832a7165c4e/.github/workflows/probe-lapsim-exp.yml): BCD 5 rounds / 200 iterations, lap 20, sector 2, teams on, prior 8, per-track drag off. The overall run was cancelled after other jobs timed out; **B itself succeeded** and uploaded its artifact. B source SHA-256 is `5c96aea699f06ae59fbf1c466e7305c2cbc9e83e45e373b5e6742b4799657072`.

The two lengths are 4230.354610 m (repository) and 4227.802814 m (archive). Curvature, grade, heading, F1 sector points, corners and map also differ. The other 25 track geometries are identical. The following replay holds cars, grip, weather and (for F1) drag/team/development values fixed. Positive error means slower than the real lap. F1 uses the saved rounded adjustment values, so sub-millisecond differences from saved fit times are expected.

| Group | Real lap s | Repository sim s | Error s | Archive sim s | Error s | Archive minus repo s |
|---|---|---|---|---|---|---|
| f1/2025 | 69.511 | 69.610 | +0.099 | 69.971 | +0.460 | +0.361 |
| wec-lmh/2025 | 82.948 | 82.625 | -0.323 | 82.848 | -0.100 | +0.222 |
| wec-lmh/2026 | 83.387 | 82.467 | -0.920 | 82.671 | -0.716 | +0.204 |
| wec-lmdh/2025 | 82.570 | 82.130 | -0.440 | 82.343 | -0.227 | +0.213 |
| wec-lmdh/2026 | 83.041 | 82.464 | -0.577 | 82.645 | -0.396 | +0.181 |
| wec-lmgt3/2025 | 93.849 | 92.735 | -1.114 | 92.833 | -1.016 | +0.099 |
| wec-lmgt3/2026 | 93.350 | 91.847 | -1.503 | 91.938 | -1.412 | +0.091 |

For completeness, excluded wet F1 observations are shown below. These are dry-model replays with the shared 2025 track factors, **not validation scores**; the model has no calibrated wet grip here.

| F1 year | Wet observed lap s | Repository dry-model error s | Archive dry-model error s |
|---|---|---|---|
| f1/2023 | 70.162 | +0.854 | +1.224 |
| f1/2024 | 83.405 | -13.154 | -12.818 |
| f1/2026 | 87.470 | -15.605 | -15.297 |

No F1 held-out row is Interlagos. A geometry swap cannot be assessed by reusing the saved held-out errors. Fresh F1 fitting/validation would be required in a separately approved model experiment.

| Option — owner decides | F1 effect | WEC effect | What remains unknown / required |
|---|---|---|---|
| Keep repository geometry; refit WEC | F1 values and geometry stay unchanged; 2025 replay error +0.099 s. | Existing isolated 70/25 refit: pooled 1.321% → 1.416%; LMDh 2025 1.238% → 1.611%. Gate rejects. | This result is not adopted. B factors were learned on archive geometry; consistent transfer-factor rebuilding may also be needed. Separate model PR/approval. |
| Adopt archive geometry globally | Fixed F1 2025 sim +0.361 s; error +0.099 → +0.460 s (about +0.519 pp). Other tracks unchanged at fixed values. | PR #149 values replay correctly; Interlagos sims become 0.091–0.222 s slower than repository geometry. | F1 refit and new held-out gate unknown; old saved held-out values cannot prove safety. Separate model PR/approval. |
| Explicit per-series geometry: repository for F1, archive for WEC | Fixed F1 replay unchanged: 0.000 s delta. | Restores the geometry used for PR #149; same 0.091–0.222 s correction and no refit needed to reproduce its stored numbers. | An engineering compatibility option, not proof that either line is physically better. Requires explicit per-series data/validation and separate approval; not implemented. |

### 16.7 Verification, artifacts and disposition

| Flags-off comparison against original source | Bytes | SHA-256 (same on both sides) |
|---|---|---|
| calibration | 55429 | `5d612afc8b13dc8018dba1718b9610d3b3e760821f3a4cb41eb6aaf17f10b5b0` |
| stdout | 5640 | `f02d6bfd89f152ebd7ab8d9a345416a9e9df1b1107e3c28c263d4f8bd268b433` |
| validation | 24754 | `202cedcac00754065e5e1ffbdb4066d35cdd836652d13c54241d49e0362d25c1` |
| validationStdout | 2038 | `464c43ba25eb4503924f2a46cfed8c6e026b042192998c1ab6e7df1359a06d66` |

Checks: original-source/full-production baseline identity passed (only generatedAt differs from the historical file); 416/416 tests passed with external fetch/socket access blocked, including raced-session reproduction; build and artifact validation passed. An initial unguarded full-suite attempt was blocked by automatic approval review for an unmocked collector.test logout fixture. The safe rerun used the saved offline guard and passed; application/collector code was not changed. Both timing flags default off. Trap remains held; aero ratio remains unimplemented. No new bounds, gate rules or production weights were installed.

Artifacts are in [scripts/sim/results/wec-sectors-2026-11-10](../scripts/sim/results/wec-sectors-2026-11-10/): all variant calibrations and logs, validation JSON, gate/physical comparisons, frozen eligibility, input/source hashes, exact baseline/byte checks, geometry replay, and test log. These are research outputs, not runtime model data. Full metadata and unrounded numbers are in results.json. The experiment manifest and the prepare/run/report/replay commands are committed with the code.

The code PR remains unmerged with flags off. No model PR, production geometry/calibration change, Vercel action, or deployment was performed. The next decision belongs to the owner: choose a geometry strategy before any production-model change.

## 17. WEC convergence ladder, geometry guard and consistent-baseline plan — 2026-11-10

### 17.1 A — fix the measurement settings first

**Result: none of the tested rungs meets the declared convergence check. No fitted value is adopted. b2 remains rejected and has not been judged again.**

This is deterministic iteration sensitivity, not variation between random runs. The owner approved the four-rung baseline ladder, including one exception to the 60-minute budget if needed. The stop is 280/200 even if it does not converge. The specific diagnostic criterion is: every class-season changes by less than 0.02 percentage points from the preceding rung and no pooled.used, bop.used or gripSource.used choice flips. The production gate itself is unchanged.

Inputs are the exact section 5.2 PR #149 recipe: archive geometry, original production seed, B transfer factors, existing wet exclusions and Timing71 rows. Input hashes are in the saved manifest. All runs are WEC only; all timing and physics flags are off; lap/trap weights stay at 2/0.5. There are 99 dry Al Kamel laps before optional Timing71 selection; n is 5 per class in 2025 and 6 in 2026. The two higher rungs ran in parallel. Their main-iteration limit is identical at 280; their held-out limits are 100 and 200.

The completed 70/25 and 140/50 runs were reused as authorized. An additional logging-off 70/25 run took 474.955 s plus 0.916 s validation and exactly reproduced production. Calibration, calibration stdout, validation JSON and validation stdout were byte-identical to the original-source control. F1 seasons and projections are unchanged in every rung.

| Rung (main/folds) | Pooled WEC RMS % | n | Fit wall time s |
|---|---|---|---|
| 70/25 | 1.321050 | 33 | 435.500 |
| 140/50 | 1.162445 | 33 | 1108.300 |
| 280/100 | 1.156973 | 33 | 1380.641 |
| 280/200 | 1.128121 | 33 | 1430.624 |

Run times are total wall time per rung, including parallel CPU contention. Separate per-group wall times were not instrumented. The older two runs have no per-iteration log; no history is invented for them.

| Rung | Class / season | Held-out RMS % | n | Fitted laps | muY | ClA | CdA | Bound hits | pooled | bop | gripSource |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 70/25 | lmh/2025 | 1.432493 | 5 | 15 | 1.568817 | 7.000000 | 1.086824 | clA upper | no | no | f1 |
| 70/25 | lmh/2026 | 1.040859 | 6 | 18 | 1.518156 | 6.630406 | 0.963682 | none | no | n/a | transfer |
| 70/25 | lmdh/2025 | 1.238337 | 5 | 18 | 1.561175 | 7.000000 | 1.099404 | clA upper | yes | no | transfer |
| 70/25 | lmdh/2026 | 1.070598 | 6 | 18 | 1.528597 | 6.446839 | 0.953795 | none | no | n/a | transfer |
| 70/25 | lmgt3/2025 | 1.733498 | 5 | 15 | 1.590430 | 3.500000 | 1.286196 | clA upper | no | n/a | transfer |
| 70/25 | lmgt3/2026 | 1.369955 | 6 | 18 | 1.615853 | 3.500000 | 1.300000 | clA upper; cdA upper | no | n/a | transfer |
| 140/50 | lmh/2025 | 1.076235 | 5 | 15 | 1.568868 | 7.000000 | 1.086312 | clA upper | no | no | f1 |
| 140/50 | lmh/2026 | 1.045749 | 6 | 18 | 1.517850 | 6.635010 | 0.963651 | none | no | n/a | transfer |
| 140/50 | lmdh/2025 | 1.259421 | 5 | 15 | 1.560082 | 7.000000 | 1.104799 | clA upper | no | no | transfer |
| 140/50 | lmdh/2026 | 0.976933 | 6 | 18 | 1.528597 | 6.446839 | 0.953795 | none | no | n/a | transfer |
| 140/50 | lmgt3/2025 | 1.334272 | 5 | 15 | 1.590303 | 3.500000 | 1.286063 | clA upper | no | n/a | transfer |
| 140/50 | lmgt3/2026 | 1.270218 | 6 | 18 | 1.619744 | 3.500000 | 1.284389 | clA upper | no | n/a | f1 |
| 280/100 | lmh/2025 | 1.076810 | 5 | 15 | 1.569573 | 7.000000 | 1.093458 | clA upper | no | no | transfer |
| 280/100 | lmh/2026 | 1.061336 | 6 | 18 | 1.517850 | 6.635010 | 0.963651 | none | no | n/a | transfer |
| 280/100 | lmdh/2025 | 1.270150 | 5 | 15 | 1.560082 | 7.000000 | 1.104799 | clA upper | no | no | transfer |
| 280/100 | lmdh/2026 | 0.983982 | 6 | 18 | 1.528597 | 6.446839 | 0.953795 | none | no | n/a | transfer |
| 280/100 | lmgt3/2025 | 1.353481 | 5 | 15 | 1.590303 | 3.500000 | 1.286063 | clA upper | no | n/a | transfer |
| 280/100 | lmgt3/2026 | 1.195955 | 6 | 18 | 1.619744 | 3.500000 | 1.284389 | clA upper | no | n/a | f1 |
| 280/200 | lmh/2025 | 1.076304 | 5 | 15 | 1.569573 | 7.000000 | 1.093458 | clA upper | no | no | transfer |
| 280/200 | lmh/2026 | 1.061336 | 6 | 18 | 1.517850 | 6.635010 | 0.963651 | none | no | n/a | transfer |
| 280/200 | lmdh/2025 | 1.269795 | 5 | 15 | 1.560082 | 7.000000 | 1.104799 | clA upper | no | no | transfer |
| 280/200 | lmdh/2026 | 0.983982 | 6 | 18 | 1.528597 | 6.446839 | 0.953795 | none | no | n/a | transfer |
| 280/200 | lmgt3/2025 | 1.353157 | 5 | 15 | 1.590303 | 3.500000 | 1.286063 | clA upper | no | n/a | transfer |
| 280/200 | lmgt3/2026 | 1.034453 | 6 | 23 | 1.608017 | 3.500000 | 1.295287 | clA upper | yes | n/a | transfer |

Errors above are reconstructed from stored held-out errors rounded to 0.001 s, rather than the saved RMS rounded to two decimals. Full car values are in results.json. The comparison is level B (class-unseen) and does not measure a wholly unseen track.

| Transition | Group | Delta error pp | Choice flips | Pass (<0.02 pp and no flip) |
|---|---|---|---|---|
| 70/25 to 140/50 | lmh/2025 | -0.356258 | none | no |
| 70/25 to 140/50 | lmh/2026 | +0.004890 | none | yes |
| 70/25 to 140/50 | lmdh/2025 | +0.021084 | {"pooled":true,"bop":false,"gripSource":"transfer"} to {"pooled":false,"bop":false,"gripSource":"transfer"} | no |
| 70/25 to 140/50 | lmdh/2026 | -0.093665 | none | no |
| 70/25 to 140/50 | lmgt3/2025 | -0.399226 | none | no |
| 70/25 to 140/50 | lmgt3/2026 | -0.099737 | {"pooled":false,"bop":null,"gripSource":"transfer"} to {"pooled":false,"bop":null,"gripSource":"f1"} | no |
| 140/50 to 280/100 | lmh/2025 | +0.000576 | {"pooled":false,"bop":false,"gripSource":"f1"} to {"pooled":false,"bop":false,"gripSource":"transfer"} | no |
| 140/50 to 280/100 | lmh/2026 | +0.015587 | none | yes |
| 140/50 to 280/100 | lmdh/2025 | +0.010729 | none | yes |
| 140/50 to 280/100 | lmdh/2026 | +0.007049 | none | yes |
| 140/50 to 280/100 | lmgt3/2025 | +0.019209 | none | yes |
| 140/50 to 280/100 | lmgt3/2026 | -0.074262 | none | no |
| 280/100 to 280/200 | lmh/2025 | -0.000506 | none | yes |
| 280/100 to 280/200 | lmh/2026 | +0.000000 | none | yes |
| 280/100 to 280/200 | lmdh/2025 | -0.000355 | none | yes |
| 280/100 to 280/200 | lmdh/2026 | +0.000000 | none | yes |
| 280/100 to 280/200 | lmgt3/2025 | -0.000324 | none | yes |
| 280/100 to 280/200 | lmgt3/2026 | -0.161503 | {"pooled":false,"bop":null,"gripSource":"f1"} to {"pooled":true,"bop":null,"gripSource":"transfer"} | no |

For 280/100 versus 280/200, unchanged choices are also checked to give exactly identical main-fit car values. A changed selection can change the main-fit training rows or track factors despite the same iteration limit. This is reported rather than hidden.

Optional logging uses LAPSIM_OBJECTIVE_LOG=<new JSONL path>. It records the objective before each Nelder–Mead iteration and at exit, by class-season, candidate (F1 grip, transfer grip, pooled Timing71, BoP or main), fold and start. There is one initial start and no restart loop in the current optimizer; every record therefore has restart: 0. No restart was added. The observer adds no objective evaluations and writes no stdout; tests compare the exact objective-call sequence and prediction bytes with logging on and off. Existing log paths are refused to protect evidence.

All objective histories for the new rungs are saved in compact lossless form with metadata, columns, final vectors and raw JSONL hashes. A small change in the final optimizer step alone is not used as proof of convergence. The predeclared adjacent-rung rule above is the decision rule.

Validation: 419/419 offline tests passed, including raced-session reproduction. Build and artifact validation passed. Runtime model files, bounds and gate are unchanged. Artifacts: [wec-ladder-2026-11-10](../scripts/sim/results/wec-ladder-2026-11-10/). Commands: node scripts/sim/run-wec-ladder.mjs, then node scripts/sim/report-wec-ladder.mjs and node scripts/sim/archive-wec-ladder.mjs. The runner refuses to overwrite a prior run directory.

The limiting group is LMGT3 2026: RMS changes from 1.195955% at 280/100 to 1.034453% at 280/200 (-0.161503 pp). gripSource changes from f1 to transfer; pooled.used changes from false to true; fitted laps rise from 18 to 23. The other five groups change by at most 0.000506 pp without a choice flip. There is no converged rung for all six groups. No run beyond 280/200 is authorized or performed. In unchanged F1-grip candidate folds, the objective still falls by 6.799% for LMGT3 2025/Spa and 6.686% for LMGT3 2026/Monza between 100 and 200 iterations. The full fold histories therefore also show why a flat-looking pooled number is insufficient.

### 17.2 B — weather confirmed; guard blocked by a requirement conflict

Direct OpenF1 requests on 10 November 2026 returned HTTP 200. Session metadata confirms both are Interlagos Qualifying sessions. The existing pipeline marks a session as rain when any session weather observation has rainfall > 0; these counts use that exact criterion, not an inference from slow laps.

| Geometry source | Session | OpenF1 weather rows | Rows with rainfall > 0 | Classification |
|---|---|---|---|---|
| Interlagos archive, 2026 | [11408](https://api.openf1.org/v1/sessions?session_key=11408) | 160 | 106 | wet |
| Interlagos repository, 2025 | [9865](https://api.openf1.org/v1/sessions?session_key=9865) | 82 | 0 | dry by the pipeline criterion |

Weather sources: [11408](https://api.openf1.org/v1/weather?session_key=11408), [9865](https://api.openf1.org/v1/weather?session_key=9865). Response hashes, observation windows and counts are saved in geometry-weather-evidence.json. All 10 cached derived traces for 11408 have rain=true; all 10 for 9865 have rain=false. The archive is not a dry-session source.

**Owner decision now applies: retain the repository Interlagos geometry (9865/2025), one geometry for every series. The per-series geometry option in section 16 is rejected. No geometry data has been changed.**

At canonical main 309fdfd8, [build-geometry.mjs](https://github.com/MisterKinn/f1-data-analyst/blob/309fdfd8e214c5089072bcc5c06e51892bf63790/scripts/sim/build-geometry.mjs) chooses the maximum year per circuit before inspecting session weather. With the currently available sessions, it selects 11408/2026. The [Lap simulator data workflow](https://github.com/MisterKinn/f1-data-analyst/blob/309fdfd8e214c5089072bcc5c06e51892bf63790/.github/workflows/lapsim-data.yml) fetches 2023–2026 and invokes tune-geometry, which invokes this builder. Thus the next successful rebuild with these inputs would generate the unwanted Interlagos replacement.

**Publication detail:** the scheduled/manual workflow pushes a lapsim/refresh-YYYYMMDD branch, not main; a push-triggered run writes its lapsim/** branch. The current workflow does not itself publish this geometry to production. This is an unreviewed geometry change waiting in generated refresh output if it is later merged without review, not an automatic direct-main change. The schedule is Tuesday 12:17 Korea time. The workflow was inspected, not edited or triggered.

A repository-wide audit then found that three existing production track geometries already point to rain-marked sessions. Direct OpenF1 rainfall requests confirmed the cached labels:

| Existing track | Current source | Rain observations / all | Latest dry source in the pinned trace inventory |
|---|---|---|---|
| Las Vegas | 9854 / 2025 | 34 / 85 | 9640 / 2024 |
| Montreal | 11287 / 2026 | 1 / 76 | 9959 / 2025 |
| Zandvoort | 11349 / 2026 | 5 / 77 | 9916 / 2025 |

Sources: [9854 weather](https://api.openf1.org/v1/weather?session_key=9854), [11287 weather](https://api.openf1.org/v1/weather?session_key=11287), [11349 weather](https://api.openf1.org/v1/weather?session_key=11349). A rain-marked session does not establish that every selected lap was wet; the requested guard is based on the session flag, and must still exclude these sessions. The dry alternatives above are inventory classifications, not newly rebuilt geometries.

**Stop under section 5.3:** a successful dry-only rebuild for every track cannot also reproduce today's entire repository geometry byte for byte. These three source identities must change or the tracks must disappear; even identical coordinates would still change year/session metadata. Keeping the old wet-source geometry silently would be an undocumented exception to the requested all-track exclusion. Installing replacement geometry would be an unapproved model change. Neither was done.

There is also a reproducibility limitation: the pinned archive contains derived tracks/traces, not index.json and the raw session position files. Fresh fetches choose 14 geometry drivers only for the latest year, but 10 trace drivers for older years in this workflow. Interlagos 9865's current geometry used 14 laps. Filtering only in build-geometry after a fresh fetch could therefore leave fewer fallback laps and no year-specific MultiViewer corners. A successful byte-identical dry rebuild cannot be claimed from the available derived archive alone.

**Concrete guard proposal for owner review (not implemented):** preflight every indexed session against its rain marker, raw rainfall samples and the series-appropriate wet-sessions.json entries. Skip wet candidates. If that exclusion would invalidate an existing track's source and require replacing its geometry, abort before writing either tracks or traces, list the affected tracks, and leave both files byte-identical. Do not grandfather wet sessions or install older dry geometry silently. A separate model review would approve replacements and their complete raw inputs.

Proposed tests for the separate small guard PR: rain-marked exclusion; wet-list exclusion even with rain=false; latest eligible dry selection across several circuits; all-wet input; rejected rebuild leaves both output hashes unchanged; dry-only fixture produces byte-identical output. **No guard implementation or separate guard PR was opened after discovering this conflict. Owner confirmation of fail-closed behavior is required before continuing B.**

### 17.3 C — conditional plan only; no consistent re-baseline run

This records the requested plan and its blockers. It is not a run authorization. There is no converged all-group rung from A, so M/H below is deliberately unset. It must not default to 280/200. The geometry guard conflict above also remains open.

Inputs for the future paired experiment:

- Pin canonical production commit 309fdfd8 and the original production calibration (SHA-256 47e7c24a6df9bc67fd59dcd4fa0de6ffee290cfc02810d1e6742bca901f39586).
- Use the single repository tracks-data.js for every arm and series: SHA-256 fe67d1ecf2a4c151f35f98e3da334d835881904ffb4ebda24488983952cee5eb. Do not adopt the archive geometry or a per-series override.
- Keep the recorded PR #149 WEC, wet exclusions, Timing71 and BoP inputs unchanged. Existing B table SHA-256 b2d3bba7113685d1382415b4717bd26a6df2aa73f4664c0c88e64068d08e3705 is the control table. The rebuilt B table gets a new recorded hash, not a guessed one.
- Rebuild F1 speed traces on the same repository geometry from the complete original raw inputs before rebuilding B. The archive traces were projected onto archive geometry; simply copying them would leave another geometry mismatch. Recover/pin the required raw positions and corner files first; do not substitute a reduced driver sample. If exact trace/geometry reproduction is unavailable, stop before fitting.
- Keep production F1 car values, shared track factors, model bounds and all objective weights unchanged in the deployed reference. B's experimental F1 fit supplies transfer factors only and is never installed as the production F1 model.

| Arm | Geometry | Transfer factors | WEC fit and held-out settings | Role |
|---|---|---|---|---|
| Frozen production reference | repository | current B | saved production cars; fixed-value replay | actual production errors and physical diagnostics, not a new held-out fit |
| Control re-evaluation | repository | current B | same owner-approved converged M/H | current production inputs re-evaluated at a common numerical setting |
| Consistent candidate | repository | B rebuilt on repository geometry and matching traces | identical M/H | candidate for comparison; never installed by the experiment |

This separates frozen-production replay from refitted held-out evaluation. Both fit arms use identical geometry, source rows, selection procedure, M/H and weights except the transfer table under test. Their held-out folds are refitted at the same converged setting; the old stored 70/25 RMS is not used as the numerical gate baseline. Changes from the frozen production car values are reported separately. This interpretation of the paired baseline must be approved before execution; no claim of exact historical production reproduction is made for a refit on different geometry/settings.

Proposed commands in isolated snapshots, after input reconstruction and after M/H has been approved (POSIX notation; clear every other LAPSIM_* override):

```sh
# Rebuild B from matching repository geometry/traces. This is not a production F1 replacement.
LAPSIM_SKIP_WEC=1 LAPSIM_FITTER=bcd LAPSIM_ROUNDS=5 LAPSIM_BCD_ITERS=200 \
LAPSIM_WTIME=20 LAPSIM_WSECTOR=2 LAPSIM_TRACK_DRAG=off LAPSIM_TEAMS=on LAPSIM_WPRIOR=8 \
node scripts/sim/calibrate.mjs
# Save the resulting B calibration as an artifact, then in the candidate snapshot:
node scripts/sim/transfer-grip.mjs B-repository-geometry.js 'B rebuilt on pinned repository geometry'
# Restore the unchanged production F1 seed in both WEC snapshots before the next command.
# M and H remain unset: A did not establish a converged rung.
: "${M:?No approved converged main-iteration setting}"
: "${H:?No approved converged fold-iteration setting}"
LAPSIM_ONLY=wec LAPSIM_ITERS="$M" LAPSIM_HOLDOUT_ITERS="$H" \
LAPSIM_WEC_TRAP_POSITION=off LAPSIM_WEC_SECTORS=off LAPSIM_OBJECTIVE_LOG=objectives.jsonl \
node scripts/sim/calibrate.mjs
node scripts/sim/validate.mjs control-or-candidate
node scripts/sim/exp-compare.mjs control.js candidate.js
```

Before these shell commands, enforce non-empty validated M/H and all pinned hashes; the calibration script otherwise defaults empty variables to 70/25. Run the two WEC arms in parallel only after B is built and their inputs are frozen. Do not choose another iteration count or transfer setting from candidate held-out results. Report pooled and per-class-season held-out results, n, all car values and bounds, selection flips, corner/trap diagnostics, unchanged F1 replay, and current-production versus candidate Interlagos errors. Acceptance needs the unchanged gate on pooled WEC, no class-season worse, F1 unchanged, and the physical checks; a sub-0.1 pp gain at n=5/6 remains unestablished. A model PR requires a separate owner review of that result.

Runtime estimate, not a promise: the historical B job took about 3 h 36 min on GitHub Actions; allow roughly 3–4 h for its reconstruction/fit, plus data recovery. The new WEC 280/100 and 280/200 runs took 23.0 and 23.8 min wall time in parallel on this PC. A future converged M/H is unknown, so the WEC phase has no firm estimate; 25–40 min at comparable cost is only a planning range. Overall allow approximately 3.5–5 h plus input recovery, subject to the final settings. This would require its own budget approval; the one-time exception granted for A is not reused. No part of this re-baseline experiment was run.

### 17.4 Open questions — not tasks or additional run authorizations

- Hypercar 2025 trap RMS is about 10–12 km/h versus about 3.4 km/h in 2026, and 2025 downforce is at its upper bound. Per-event BoP was rejected at 70/25. Once the measurement settings are stable, would a separately controlled BoP re-test explain the difference? The current lap-maximum/trap mismatch still limits the physical interpretation. No separate BoP re-test was started.
- All WEC classes are too fast at Interlagos on both geometries, up to about 1.5 s for LMGT3. The shared Interlagos factor is supported by one dry F1 season only. Does that factor transfer across classes, or does it absorb another missing effect? This is an open question, not authorization to change the factor.

Disposition: A stopped at the approved ceiling; B stopped at the explicit requirement conflict; C is a blocked conditional plan. Diagnostic code and results are backed up in PR #154. No production geometry/calibration change, model PR, merge, workflow trigger or Vercel action was performed.

