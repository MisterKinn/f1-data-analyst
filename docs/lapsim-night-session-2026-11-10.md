# Physics follow-up session — 2026-11-10

No production adoption, merge or Vercel action. Experiments run in isolated copies. Current production is the baseline for every later block unless a declared model passes and is recorded in a separate draft model PR. No held-out result is used to choose a new setting.

## Block 0 — done: consistent candidate failed

All three arms had completed before the follow-up instruction arrived; their saved completion marker, input hashes, result hashes and production integrity checks were verified. No run was stopped, changed or restarted. The converged-B candidate failed the pooled WEC check, despite exact dry reproduction, unchanged F1 seasons/projections and no cap hits. The round-five secondary is diagnostic only: its B main fit fails the convergence rule. Current production remains the baseline for later blocks; no consistent-baseline model PR is opened. Production F1 also fails the convergence rule in its existing log; it was not rerun for this report.

| Check | Control | Candidate | Secondary |
|---|---:|---:|---:|
| Pooled WEC RMS %, n=33 | 1.166709 | 1.179080 | 1.094332 |
| B main rounds | — | 7 | 5 |
| Last B score decrease % | — | 0.344391 | 1.344223 |
| Dry WEC rows / maximum error s | 33 / 0 | 33 / 0 | 33 / 0 |
| Cap hits | 0 | 0 | 0 |
| Production F1 last two scores | 23.9813 → 23.6060 | unchanged | unchanged |
| Production F1 decrease % | 1.56497 — fails | — | — |

Detailed evidence: `scripts/sim/results/wec-consistent-rounds-2026-11-10/`, verified on PR #154 at `ca18431050c3bc9df0e48ff4fee7a76546b87d48`.

## Declared remaining blocks

| Block | Budget minutes | Baseline and pass rule |
|---|---:|---|
| 1: rules | 20 | Documentation only; preserve numerical rules and record the new authorization |
| 2: dry Las Vegas | 90 | Same-run production F1 fit on current versus dry-source geometry; converge main and folds; no worse F1 seasons or Las Vegas rows; exact reproduction |
| 3: WEC fixed inputs, BoP, sectors | 100 | Production configuration at R; each candidate tested separately against same-run control; pooled accepted and no class-season worse |
| 4: per-model Hypercar | 120 | Class base versus shrunk model offsets; same-run R; hide track and model; pooled accepted, no class-season worse, F1 unchanged |
| 5: measured gears | 60 | Measurement only; hidden-team gear validation; no kernel change |
| 6: review split and handoff | 30 | Core review branch has no runners/results or result files above 100 KB; handoff status at most 150 lines |

When a dependent fact cannot be verified, two pass checks fail, or a time box ends, park that block and continue. End the session for a production raced-session reproduction failure, a changed production runtime/gate hash, or an input hash mismatch. Every model change stays in a draft PR.

## Block 1 — done: working rules updated

Updated sections 3.3, 5.1 and 5.3, added the pre-approved actions, and replaced section 9 with current dated status. A missing dependent fact parks the affected block; the three session hard stops still end all work. Numerical convergence rules and the gate are unchanged. Model candidates remain isolated and require owner review before production adoption.

## Block 2 — declared before fitting

Control: repository geometry and its pinned matching trace distances. Candidate: only Las Vegas rebuilt from zero-rain qualifying session 9640; all Las Vegas laps projected onto that line with the existing builder. Measured speed, throttle, brake, lap times and sectors must match the pinned data. Other tracks and traces stay identical. Source downloader uses the existing ranking, best-lap selection, telemetry cleaning and weather rules.

| Setting | Value |
|---|---:|
| Geometry drivers / trace drivers | 14 / 10 |
| Position K / curvature K | 0.4 / 0.8 |
| Sigma / curvature smoothing / minimum sigma / distance step, m | 7 / 6 / 3 / 5 |
| F1 BCD iterations per round | 200 |
| Main and fold minimum / maximum rounds | 5 / 10 |
| Required last-round score decrease | non-negative and below 1% |
| Time / sector / prior weights | 20 / 2 / 8 |
| Per-track drag / teams | on / on |
| Held-out seasons | 2025, 2026 |

Both arms start from the same priors, bounds, rows and production settings. Each main fit and fold uses the same convergence rule; no settings are chosen from held-out errors. Pass requires both season errors and dry Las Vegas row errors not worse, exact raced reproduction and no cap hits. Wet Las Vegas rows are reported separately. Source or time-box failure parks this block without adoption.

## Block 3 — declared before fitting

Source verification began while the Las Vegas fits were running. Baseline remains production. The independent WEC arms below use the same pinned repository geometry, current transfer table, row exclusions, priors, bounds and weights. Each runs at R. No candidate combines the sector and BoP changes.

| Arm | Change | Pass |
|---|---|---|
| control | Current production configuration refit at R | Reference, exact dry reproduction |
| bop | Exact season/event/entry-to-model join; verified event BoP applied for dry Hypercar events in 2025 | Pooled gate accepts and no class-season worse; no cap hits; F1 unchanged |
| sector2 | Existing frozen-eligibility sector term, weight 2, at R | Pooled gate accepts and no class-season worse; no cap hits; F1 unchanged |

The BoP arm keeps the existing relative mass/power formula and reference means; this is a test of the existing event correction with verified model identity. It forces that correction for the experimental fit so its car and bounds can be reported even if the gate rejects it. The gate itself is unchanged and its verdict is still recorded. This does not replace total running mass with a dry minimum, or treat wheel power as engine power. Those conversions need separately verified inputs. Historical Timing71 rows without entry identities keep their existing base inputs. Unpublished or unverified event values stay empty.

| Shared WEC setting | Value |
|---|---:|
| Tolerance / cap | 0.0001 / 2000 |
| Frozen sector length ratio | 0.98–1.02 |
| Sector-sum tolerance, s | 0.002 |
| Maximum production sector-share difference, pp | 3 |
| Gain called unestablished at group n | below 0.1 pp at 5 or 6 |
| Official model classification files / identities | 24 / 426 |
| Verified dry-event Hypercar BoP rows / events | 40 / 5 |

Any class failing the frozen sector-share check excludes the whole track-year from the sector term. No trap-position or aero-ratio assumption is added. BoP documents were read from official FIA PDFs; all verified mass, power, energy and high-speed power adjustments agree with the existing table. A numerical aero coefficient limit was not yet verified and will not be supplied to a fit.

## Block 5 — measurement declared before analysis

This independent download runs while the physics fits finish. Use every available ranked driver's selected qualifying lap at Monza in each source season. This is a common-track measurement, not a claim about all circuits. No kernel or fitted car changes.

| Setting | Declared value |
|---|---:|
| Seasons / OpenF1 sessions | 2023 / 9153; 2024 / 9586; 2025 / 9908; 2026 / 11357 |
| Download driver ceiling (includes all ranked entries) | 30 |
| Ratio sample minimum speed / RPM | 50 km/h / 5000 rpm |
| Ratio sample throttle / brake | at least 98% / zero |
| Valid distance interval | above 0 and at most 1 s |
| Minimum samples for a reported gear ratio | 5 |

Measure median RPM divided by road speed for stable-gear samples, and each gear relative to the highest observed gear of the same team-season. Absolute gearbox ratios require loaded tyre radius and final-drive ratio; these are not assumed. Report observed timestamp spacing and its equivalent sampling frequency. For validation, hide one whole team's gear channel in a season. From all other teams, learn each gear's distance-weighted median speed. Predict the nearest median using speed alone, then measure correct-gear distance. Repeat for every team, with no tuning. Neutral/invalid gear and long telemetry gaps are excluded and counted. No accuracy threshold is used to choose a model; report measurement coverage and errors.

## Block 4 — declared before fitting

Keep every timed car from the pinned WEC archive. Join its model by season, track and exact entry number. The inventory has one retained best qualifying/Hyperpole lap per car-event; it does not claim to contain every lap driven. Source qualifying lap counts are reported separately.

| Arm | Data and model |
|---|---|
| production | Fresh normal top-three production-configuration WEC fit at R in the same experiment |
| all-car base | All timed cars; one class car; unchanged class priors/bounds and first-lap/non-first-lap weights; frozen production grip-source choices |
| all-car models | Same all-car rows and settings; class base plus model differences in log drag, log downforce and log grip |

Verified relative event BoP corrections are fixed in both all-car arms for dry Hypercar events in 2025. Other years have no invented BoP. Timing71 rows lack entry/model identity and are omitted from both all-car arms, including hide-model folds. The production arm keeps its normal pipeline and is reported separately, so the all-car data change is visible.

| Model setting | Declared value |
|---|---:|
| Shrink penalty | 8 × mean over models of summed squared (log difference / 0.1) |
| Nelder–Mead step | 0.08 |
| Tolerance / iteration cap | 0.0001 / 2000 |
| Hidden-track folds | one circuit each |
| Hidden-model folds | one whole model each |
| Fit weights | fastest class car 1; every other car 0.5 |

The class base is fitted first on each training fold. The hierarchy starts from that training-only base with zero model differences. A hidden model receives the class base; its own offset is never fitted. Every effective car stays inside the existing class bounds. The penalty strength is not tuned. Freeze the source table hashes before the first fit.

Report class-best errors and each model's best-entry errors. For pooled tests, aggregate model squared errors by class-season-track before calling the unchanged gate; this avoids treating several cars at one track as independent tracks. A model may keep its own values only if its hidden-track test beats the class base beyond noise; a gain below 0.1 pp with only 5 or 6 tracks is not established. Do not re-score the same held-out data after choosing which model offsets to keep.

Pass requires pooled held-out improvement beyond noise, no worse class-season against both the all-car base and the fresh production arm, no cap hits, and unchanged F1. Report the hide-model test separately. Shown Hypercar output stays class-level. Any main fit reaching the cap is parked before its folds; do not label its scores as converged. Start LMGT3 only if Hypercar finishes inside the box.


## Block 5 — done: measurement only

The whole-team gear test finished without fitting a physics model. All selected laps have zero-rain source weather. Every test team is absent from its training set. Source hashes were checked again after analysis. Absolute gearbox ratios remain empty because tyre radius and final drive were not verified.

| Season | Team folds | Laps | Observed samples/s | Correct gear distance, % |
|---|---:|---:|---:|---:|
| 2023 | 10 | 20 | 3.760 | 81.640 |
| 2024 | 10 | 20 | 3.819 | 83.255 |
| 2025 | 10 | 20 | 3.748 | 83.439 |
| 2026 | 11 | 22 | 3.751 | 79.857 |

| Coverage or exclusion | Count |
|---|---:|
| Raw car-data samples | 25033 |
| Frozen or invalid-throttle samples | 104 |
| Long or invalid timestamp intervals | 33 |
| Team-season-gear rows with enough ratio samples | 189 |
| Total team-season-gear rows | 328 |

The derived table is `scripts/sim/data/f1-gear-measurements.json`; the readable report is `docs/lapsim-f1-gears-2026-11-10.md`. Selected normalized source sessions are archived with their hashes on the experiment branch; the raw HTTP response cache stays local. Accuracy covers selected Monza qualifying laps only. Low gears often have too few stable, full-throttle samples; those values stay blank. No claim is made about other circuits or absolute gearbox ratios.


## Block 3 — done: both tests rejected

The fixed-input source audit is in `docs/lapsim-wec-fixed-inputs-2026-11-10.md`. Missing homologation aero limits and unverified event values remain blank. No prior or bound changed. Both paired tests finished at R. The control is exactly equal to the earlier flags-off R control for the saved WEC series; F1 seasons and projections are unchanged.

| Arm | Pooled held-out n | RMS, % | Change from control, pp | Gate | Cap hits | Dry reproduced rows | Largest error, s |
|---|---:|---:|---:|---|---:|---:|---:|
| control | 33 | 1.166709 | +0.000000 | reference | 0 | 33 | 0.000000 |
| bop | 33 | 1.271006 | +0.104298 | rejected: worse on held-out rows | 0 | 33 | 0.000000 |
| sector2 | 33 | 1.196784 | +0.030075 | rejected: worse on held-out rows | 0 | 33 | 0.000000 |

Model-matched BoP worsens both Hypercar classes in the tested season. The sector retest worsens several class-seasons and pooled WEC. Keep both flags off; no further sector retest is authorized by this block. Neither test supplies a reason to loosen the downforce bound. The detailed report records car values, bound hits, selections, trap diagnostics and each class-season error. Production stays the baseline for Block 4.

The optional LMGT3 extension in Block 4 is assessed separately. It cannot alter the predeclared Hypercar pooled gate or rescue a failed Hypercar result. No model retention choice is used to re-score the same held-out data.


## Block 6 — done: review PR separated

The existing PR now contains a clean commit on current main with reusable convergence/timing diagnostics, shared audit scope, tests, verified tables and documentation. Full experiment runners, forced BoP fitting, per-model fitting and result files are preserved on `exp/lapsim-physics-night-2026-11-10`. The experiment branch is not proposed for main.

| Review check | Result |
|---|---:|
| Changed core files at split | 38 |
| Added core files above 100 KB | 0 |
| Offline Node 22 tests passed / total | 432 / 432 |
| Production runtime and gate hashes unchanged | 45 |
| Handoff status lines at the first split | 56 |

Build and artifact validation passed. The GitHub test workflow also passed. The automatic Vercel check requests authorization; it was left untouched. The PR has no base conflict and was marked ready for review. No merge was made. Its title and description were updated on the GitHub page because the connector cannot edit PR metadata.

The earlier continuation sections were preserved under `docs/archive/`; the current handoff has one concise status section. Remaining experiment outcomes will update that status and this report, while full outputs stay on the experiment branch. A plan for predicting factors on never-raced circuits is saved without a new fit.


## Block 2 — parked: time box ended before held-out completion

The declared clock ended with both main fits converged, but most held-out folds unfinished. No final calibration was exported. The completed dry Las Vegas replay also worsens the later dry row slightly; corner bias and trap checks are mixed. These diagnostics do not support adoption. Keep current geometry. Montreal and Zandvoort were not started because the geometry time box was used up.

| Check | Control | Dry-source candidate |
|---|---:|---:|
| Main rounds | 6 | 6 |
| Last main score decrease, % | 0.773481 | 0.584693 |
| Completed held-out folds / required | 2 / 8 | 2 / 8 |
| Partial F1 2025 held-out n / RMS, % | 11 / 0.622745 | 11 / 0.641319 |
| F1 2026 completed held-out rows | 0 | 0 |
| Las Vegas 2023 dry raw replay error, s | +0.283826 | +0.265002 |
| Las Vegas 2024 dry raw replay error, s | -0.143109 | -0.145542 |
| Las Vegas grip factor | 0.947102 | 0.932803 |
| Las Vegas 2026 main-fit prediction, s | 93.875294 | 94.491136 |
| Fit cap hits | 0 | 0 |

The partial held-out RMS is not a season result or an acceptance result. The saved predictions use the same latest dry source weather in both arms. Wet Vegas data is diagnostic only. Current production still reproduces all dry F1 rows exactly; the unfinished candidates have no final reproduction result. Full per-round scores, corner/trap errors, source hashes and checkpoints are in the experiment archive; the readable summary is [dry Vegas](archive/lapsim-dry-vegas-2026-11-10.md).
