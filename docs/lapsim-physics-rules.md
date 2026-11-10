# Lap simulator physics: working rules

Scope: `worker/lapsim/`, `scripts/sim/`, `docs/lapsim-*.md`, `tests/lapsim-*.test.mjs`.
This file is the only source of rules for physics-model work. Read it before every physics task.
History and detailed results are in `docs/lapsim-handoff-physics.md`. If that file and this file disagree, this file wins.
Do not touch the website, accounts, collector, or deployment in a physics task.

Section 9 is dated status. Replace it when it is old. Sections 1–8 are standing rules.

---

## 1. Goal

Use the data that exists to predict what has no data, as accurately as possible, and state how accurate each prediction is.

Two accuracy targets. Never mix the two words.

| Term | Meaning | Target |
|---|---|---|
| **Reproduces** | A session that was already raced shows the real best lap | 0.000 % (tests enforce this) |
| **Held-out error** | Error on a track, car or series that the fit did not see | As low as possible. Lower limit about 0.16 % (pole vs P2). |

Planned outputs, in build order: optimal gear per corner, then a better car model, then the optimal racing line. See section 6.

## 2. Hard rules

1. **Gate.** Keep a model change only if held-out error is lower beyond noise (`scripts/sim/gate.mjs`). "Worse" and "gain within noise" both mean: do not use.
2. **F1 must not get worse.** A change that helps WEC but hurts F1 is used for WEC only.
3. **Never fit on the rows you test on.** Never choose settings by looking at held-out rows and then report those same rows as the result.
4. **One change, one flag, off by default.** With the flag off, output must be byte-identical to before.
5. **Declare before you run.** Write the variants, the baseline, the metrics, and the pass check before starting an experiment. No new variants after seeing results without a new declaration.
6. **Always run the production baseline in the same experiment, with the same settings.** Numbers from a different run or different settings are not comparable.
7. **Label every value** with its evidence layer (section 3) and its held-out error. Never show a fitted value as a known value.
8. **Report failures.** A rejected experiment is a result. Write it down with the reason.
9. **Raw third-party data stays out of git** (Timing71 files, paid telemetry). Commit only derived tables with a source line.
10. **Sim-racing data: iRacing only.** Do not use data from other simulators.
11. **Experiments never change production.** An experiment branch produces artifacts and a doc update. A model change is a separate PR after a full-settings confirmation and the owner's approval.
12. **One purpose per PR.** Do not mix website fixes with physics or experiment changes. `main` deploys to production automatically.
13. **Do not merge before your own stop condition is met.** If the PR text says "wait for X", wait for X.

## 3. Data handling method

### 3.1 Four evidence layers

Always use the highest layer available. Never fit a value that can be measured.

| Layer | Source | Examples | Label |
|---|---|---|---|
| 1. Fixed | Regulations, BoP tables, homologation | Mass, power or energy limits, tyre supplier | Known |
| 2. Measured | Direct from data | F1 gear ratios from RPM and speed, speed trap, sector times | High |
| 3. Inferred | Physics applied to layer 2 | Drag from straights, grip and downforce from slow and fast corners, torque curve from acceleration | Medium |
| 4. Borrowed | Similar cars that have good data | Gear spacing for a car with no RPM data, tyre behaviour from the same supplier | Low, wide range |

### 3.2 Hide-and-predict tests

Accuracy for unknown things is measured by hiding known things.

| Test | Hide | Predict from | Compare with |
|---|---|---|---|
| Track | One circuit | All other circuits | Real lap, sectors, corner minimum speeds |
| Car | One car model or team | Other cars plus the rules | Real laps of that car |
| Season | One season | Earlier seasons plus rule changes | Real laps |
| Series | One series | Other series | Real laps |
| Channel | One channel (for example gear) | Other channels | The real channel |

Every estimated value needs at least one such test. The error from the test is the number shown to users.

The current "held-out" number is weaker than it sounds. Say which level a number is:

| Level | What is hidden | In the code today |
|---|---|---|
| A. Season-unseen | This season's lap on a track. The track factor comes from another season. | F1 (`holdoutBCD`, 4 folds) |
| B. Class-unseen | This class's lap on a track. The track factor comes from F1. | WEC (`holdout`, leave one track out) |
| C. Track-unseen | A track with no factor from anyone | **Not tested.** New circuits have no measured accuracy. |

Level C needs its own test: hide a track from every season and class, predict it with factor 1 or with a factor from track features.

### 3.3 Checks before any fit

1. **Session conditions.** Do not trust the weather flag alone. Check lap time and speed trap against the same class at the same track in other years. A trap under 90 % means wet or disrupted: exclude and record the source in `scripts/sim/data/wet-sessions.json`.
2. **The right lap.** Pole is the fastest lap of the last qualifying segment, not the fastest lap of the day.
3. **Sample rate.** Low-rate telemetry misses the true corner minimum. Know the rate before reading corner speeds.
4. **Identity.** Map every row to track layout, car model, class, season and series. A layout change is a new track.
5. **Three-way check.** Where two or three sources cover the same session, compare them. Zero conflicts is required before use.
6. **Count the rows.** State n for every group. With n under 5 the gate rejects by rule. With n of 5 or 6, one track decides the result: say so.
7. **Geometry.** Build track geometry only from a verified zero-rain session: choose the latest eligible session, and keep the existing geometry if none exists. Missing weather is not zero-rain evidence. Use one geometry per track for every series. Existing rain-source geometry stays unchanged until its separately declared replacement passes; never silently replace production geometry.

### 3.4 No cancelling errors

Lap time can be right for the wrong reasons. Today the model is within about 1 % on lap time while corner minimum speeds are too low and some sim top speeds differ from the real trap by 10–20 km/h.

- Fit and judge on parts of the lap: corner minimum speed, end-of-straight speed, braking point, sectors. Lap time alone is not enough.
- Estimate one value at a time. Start with the value that has the most direct data. Fix it, then move on.
- Check each value against a different signal from the one it was fitted on.
- A value at its bound is a finding, not a result. Report it. It means physics is missing.

## 4. Model design rules

### 4.1 Fit per car model

Current state: F1 is one car per season with a small team multiplier. Hypercar is two cars (LMH, LMDh). LMGT3 is one car, and every other GT3 series borrows it. All three must be refitted per car model.

| Series | Fit level | Shown to users |
|---|---|---|
| GT3 | Per car model | Per car model predicted lap |
| WEC and IMSA Hypercar | Per car model | Class-level only |
| F1 | Per team car | Season-level only |

Method, because one car has few tracks per season:

1. Fit a class base car on all cars together.
2. Fit each car model as a small difference from the base (drag, downforce, grip, and power where it is not fixed). Shrink the difference toward zero when data is thin.
3. BoP is a fixed input per event (weight, power, energy, ride height). Never fit BoP.
4. Keep a car's own values only if they pass the gate against the class base on hidden tracks. Otherwise the car uses the base.
5. Add the hide-one-car test of section 3.2.

Reference data for the refit:

| Data | Where |
|---|---|
| WEC per-car laps, sectors, speed traps, manufacturer and team per row | Al Kamel files through `scripts/sim/fetch-wec.mjs` (rows carry `MANUFACTURER`, `TEAM`, car number). The current code keeps only the best three per class: keep all cars. |
| Hypercar BoP per event, 2024 and 2025 | `scripts/sim/data/wec-bop.json`, sources in `docs/lapsim-wec-bop.md`. 2026 event values were not verified in this session: mark as unknown. |
| GT3 in other series (IMSA, GTWC, DTM, IGTC, NLS, ELMS, ALMS, Macau) | `scripts/sim/data/t71-gt3.json`, `series-poles.json`, collector notes in `docs/lapsim-t71.md` |
| IMSA GTP energy per lap | `scripts/sim/data/t71-imsa-vft.json` |
| Stints and tyres | `wec-stints.json`, `t71-wec-stints.json`, `t71-lmgt3-stints.json`, `wec-tyres.json` |
| F1 per-team laps and telemetry | TracingInsights, existing F1 pipeline |
| Earlier result to re-test | Per-event BoP was rejected at class level. Re-test it at car level. |

### 4.2 GT3: the same car is a different car in each series

Model every GT3 entry in three layers plus a fitted part.

| Layer | Content | Fitted? |
|---|---|---|
| Car model base | Aero family, wheelbase, track width, weight distribution, engine type, gearbox. Shared across all series. | Partly |
| Series | Who sets BoP, how power is controlled, tyre supplier, fuel or energy rules | No, fixed |
| Event | BoP values for that event | No, fixed |
| Fitted | Only what no document gives | Yes |

Power control decides what can be fitted:

| Series type | Power is limited by | Model rule |
|---|---|---|
| Torque sensors | Measured driveshaft power, often by speed range, sometimes stint energy | Wheel power comes from the BoP table. Fit drag, downforce and grip only. |
| No torque sensors | Restrictor, boost, weight, ride height | Wheel power is unknown. Carry aero and grip from the sensor series, then fit effective power per car from acceleration and top speed. |

Order of work: fit each car's aero and grip in sensor series first, because power is known there. Then move to non-sensor series.
Keep hidden-case tests inside one control type first. Sensor to non-sensor is a separate, harder test.

**Verify first, from the current regulations, before any code:** which series use torque sensors and who sets BoP. Working assumption only: WEC LMGT3 (FIA and ACO, sensors), IMSA GTD (IMSA, sensors), SRO series such as GTWC and IGTC (SRO, no sensors). DTM, Nürburgring SP9, ELMS and Asian LMS are not checked. Store the result as a table in `scripts/sim/data/` with a source for each row.

### 4.3 What the code does today, and its known limits

Read from the code on 2026-11-10 (`worker/lapsim/kernel.js`, `scripts/sim/calibrate.mjs`, `calibrate-lib.mjs`, `joint-bcd.mjs`, `worker/lapsim/series.js`, `cars.js`).

Model: quasi-steady-state point mass on a fixed line. Lateral limit by bisection, backward braking pass, forward traction and power pass, friction ellipse, energy budget by a deploy cut-off speed. Fit: one car per season or class (5 values for F1, 3 for WEC), one grip factor per track shared by all groups, optional drag factor per track, team offsets and a development rate for F1.

| # | Limit in the code | Effect | Action |
|---|---|---|---|
| 1 | WEC is fitted on lap time and one speed trap only. Three values (grip, downforce, drag) from 5–6 tracks. | Grip and downforce cannot be separated. This alone can push downforce to its bound. | Add Al Kamel sector times to the WEC objective. First find where the WEC sector lines are on each track: they are not the F1 sector points stored in the track file. |
| 2 | The WEC trap is compared with the highest speed of the whole simulated lap, not with the speed at the trap position. Traps under 92 % of the median are dropped. | Fit and report compare different points. | Store the trap position per track and read the simulated speed there. |
| 3 | Bounds allow impossible cars. Hypercar downforce may reach 7.0 with drag near 1.1, a ratio above 6. | Layer 1 knowledge is not used. | Check the Hypercar homologation rule for the allowed downforce-to-drag ratio (working assumption: about 4 to 1) and enforce it as a constraint between the two values. Do the same for LMGT3 from homologation data. |
| 4 | Power is constant (`P / v`). No torque curve, no gears, no shift time. Rotating mass is one fixed factor. | Wrong acceleration shape on corner exit and at low speed. | Section 6 steps 1–3. |
| 5 | Low-drag zones (DRS, Straight Mode) are guessed from curvature (`autoStraights`: straights over 250 m). The FIA zone list is not used in calibration. | The low-drag value absorbs zone errors. | Use the real zones per track and year. |
| 6 | The axle model has only lateral load transfer. Braking and traction use four equal tyres. F1 priors have no aero balance or weight split of their own (defaults 0.55 and 0.55), so front and rear always limit together. Reference tyre load is 3000 N for every class. | The axle model cannot show a front-limited or rear-limited car. | Give each car its own weight split, aero balance, centre-of-gravity height and track width from regulations. Add longitudinal load transfer. |
| 7 | A lap more than 4 % off after the first fit is dropped. | Data is removed because the model cannot explain it. | Keep the rule as a warning only. Remove a session only with an outside source (section 3.3). |
| 8 | Held-out folds run one round fewer than the main fit (`rounds - 1`, minimum 2). | Held-out fits are less converged than the main fit. | Same rounds for both, and the convergence check of 5.1. |
| 9 | Per-event BoP is matched to a lap by the first word of the manufacturer name. LMGT3 has no BoP input at all. | Wrong or missing BoP for some cars. | Match by car model. Add LMGT3 BoP tables. Needed for section 4.1. |
| 10 | `fetch-wec.mjs` keeps the best three laps per class. | Per-car fitting has no data. | Keep every car. |
| 11 | Tyre temperature grip is an assumed curve (peak at 35 °C). Rolling resistance and drivetrain efficiency are assumed constants. | Layer 4 values. | Label them. Fit only with a gate. |

### 4.4 Missing physics, in priority order

1. Engine torque curve and gears (needed for section 6, and it replaces constant power).
2. Load transfer, aero balance and tyre load sensitivity (the axle model). It exists behind `LAPSIM_AXLE` and is not accepted yet. See section 9.
3. Track height and banking from better data than the current smoothed grade.
4. Tyre temperature. Only after 1–3.

## 5. Work method for every task

1. State the goal and the pass check in numbers.
2. State assumptions. If two readings of the task are possible, ask.
3. Make the smallest change, behind a flag.
4. Declare the experiment: variants, **production baseline**, settings, metrics, pass check, time budget.
5. Prove convergence before a long run: the fit score must stop falling between the last two rounds. If it still falls, the settings are too short.
6. Run. Inputs pinned by checksum. All outputs uploaded as artifacts, including the validation table.
7. Compare with `scripts/sim/exp-compare.mjs` (paired, per group).
8. Read physical sense, not only error: values at bounds, top speed against trap, corner minimum bias, sign of every effect.
9. Write the result in `docs/lapsim-handoff-physics.md`: table, decision, reason, what was rejected.
10. Model change: separate PR, full settings, gate passed, owner approval.

Time budget: use the owner-declared block budget; otherwise a screen must finish in under 60 minutes. When the time box ends, park the block and continue. Do not shorten a declared experiment or reduce iterations below convergence to make it pass. A smaller later screen needs its own declaration.

### 5.1 Numbers for the checks

When a time box ends, park and continue. Record incomplete fits and their convergence state; do not treat them as accepted results. A gain under 0.1 percentage points with n = 5 or 6 is not established.

| Check | Pass value |
|---|---|
| F1 BCD convergence | Fit score falls by less than 1 % between the last two rounds, in the main fit and in every held-out fold |
| WEC convergence | Compare two tolerances a factor of 100 apart on identical inputs and settings. Every class-season held-out RMS difference must be strictly below 0.02 percentage points, with no pooled/bop/gripSource choice flips. The main fit and folds must stop on both objective change and simplex size. |
| Baseline is valid | The baseline in the experiment is within 0.05 percentage points of the same baseline at production settings, per group. If not, the settings are too short: results are not usable. |
| Gate | `gate.mjs` says "accepted" on all rows, and no group is "worse" |
| F1 protection | F1 2025 and F1 2026 held-out error not higher than the baseline |
| Physical sense | No new value at a bound. Corner minimum bias and trap error not worse than the baseline. |
| Reproduction | `node --test tests/lapsim-*.test.mjs` passes (raced sessions stay at 0.000 %) |

**B transfer-only exception, accepted by the owner on 2026-11-10:** For the consistent-geometry candidate, the <1 % score-decrease rule applies to B's main fit only. Start with five rounds, then add one round at a time with the existing warm-start state, up to ten. Keep iterations, weights, priors, teams, bounds, drag off and repository geometry unchanged. Held-out folds run only if the transfer-table pipeline needs them; report their state without extending them for convergence. Save round five during the required run if possible and use it as a secondary WEC arm; do not add a B rerun just to recover that table. Report production F1 convergence from existing logs only.

The fit is deterministic (no random numbers in `calibrate.mjs`), so one run per variant is enough.

**Standard WEC setting, accepted by the owner on 2026-11-10:** R = `LAPSIM_WEC_NM_TOL=1e-4`, `LAPSIM_WEC_NM_CAP=2000`, for the main fit and every held-out fold. Use R for all later WEC experiments, with both the control and candidate measured at R. The comparison against 1e-6 passed all six groups: maximum change 0.001061 pp, no choice flips and no cap hits. If convergence is checked again, use two tolerances a factor of 100 apart and the WEC rule above; do not select the better held-out result afterward. Record iterations and cap hits. This standard changes experiment settings only: it does not adopt a calibration or change the default-off code path. Historical PR #149 reproduction retains its documented 70/25 recipe.

WEC historical reproduction must use the same exclusion list as the fit: `wet-sessions.json` plus rain-marked rows. All dry raced rows must reproduce exactly at the reported precision; report their count and largest absolute error. Report excluded wet rows separately. Austin 2025 is excluded as wet, not counted as a reproduction failure. A regression test must enforce agreement between fit and audit exclusions.

### 5.2 Commands

Full experiment runners, pinned result manifests and archived outputs are on the [experiment branch](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/tree/exp/lapsim-physics-night-2026-11-10). Commands that use those files must run from that branch. The core review branch keeps only reusable code, tests, derived tables and summaries.

| Purpose | Command or place |
|---|---|
| Tests | `node --test tests/*.test.mjs` (Node 22), then `npm run build` and `npm run validate` |
| One calibration | `LAPSIM_...=... node scripts/sim/calibrate.mjs` (needs `.cache/lapsim/` inputs from the pinned archive in `scripts/sim/experiments.json`) |
| F1 only / WEC only | `LAPSIM_SKIP_WEC=1` / `LAPSIM_ONLY=wec` |
| Fit length | `LAPSIM_ROUNDS`, `LAPSIM_BCD_ITERS` |
| Model flags | `LAPSIM_TRACK_DRAG`, `LAPSIM_AXLE`, `LAPSIM_LOADEXP`, `LAPSIM_ROLLFRONT`, `LAPSIM_KV`, `LAPSIM_BANK`, `LAPSIM_GRIP_LO`, `LAPSIM_GRIP_HI`, `LAPSIM_WEC_GRIP` |
| WEC tolerance stopping (off by default) | `LAPSIM_WEC_NM_TOL`, `LAPSIM_WEC_NM_CAP` (default cap 2000); main and folds, objective change plus simplex size. See the declared diagnostic below. |
| WEC objective diagnostics (off by default) | `LAPSIM_OBJECTIVE_LOG=<new JSONL path>` logs objective iterations and final values by group, candidate, fold and restart. Current WEC fit has one initial start (`restart: 0`) and no restarts. Adds no objective evaluations and writes no stdout. |
| WEC timing experiments (off by default, require `LAPSIM_ONLY=wec`) | `LAPSIM_WEC_TRAP_POSITION=on`, `LAPSIM_WEC_SECTORS=on`; `LAPSIM_WEC_SECTOR_WEIGHT=2` is the approved primary weight, `1` and `4` sensitivity only. Verified year-specific positions: `scripts/sim/data/wec-timing-positions.json`. Sector runs also require `LAPSIM_WEC_ELIGIBILITY=<fixed JSON>` prepared once with production values. |
| Parallel experiment | Edit `scripts/sim/experiments.json` (common settings and one entry per variant), push to a `lapsim-exp/<name>` branch. Workflow `lapsim-experiment.yml` runs every variant and a compare job. Do not open a PR from that branch to `main`. |
| Compare | `node scripts/sim/exp-compare.mjs base.js cand1.js cand2.js` |
| Corner, trap and braking check | `node scripts/sim/validate.mjs <name>` writes `probe-out/validate-<name>.json` |
| Summary of one run | `node scripts/sim/exp-summary.mjs <name>` |

A new flag must be read in `calibrate.mjs` from the environment in the same way as the existing flags, and listed in this table.


#### Optional WEC tolerance stopping (standard experiment setting in 5.1)

LAPSIM_WEC_NM_TOL enables a WEC-only Nelder–Mead stop rule for the main fit and every F1/transfer/pooled/BoP held-out fold. Both conditions must hold: the relative change in the best objective across 10 iterations is below the tolerance, and the largest coordinate distance from the best simplex vertex is below it. Coordinates are the existing log parameters; relative objective change divides by max(1, absolute current best). LAPSIM_WEC_NM_CAP is the iteration ceiling (default 2000). When enabled, the cap replaces LAPSIM_ITERS and LAPSIM_HOLDOUT_ITERS for WEC; those legacy limits still apply when unset. The rule replaces the old objective-spread-only stop only when enabled. Unset means exactly the previous behavior, including the 70/25 defaults. F1 fits do not receive this option.

The completed diagnostic compared 1e-4 and 1e-6 (100 times apart), cap 2000, on pinned PR #149 inputs with all timing flags off and unchanged weights. All six groups passed the <0.02 pp and no-choice-flip check within the diagnostic's 90-minute budget. R = 1e-4 is now the standard experiment setting under section 5.1; the historical conditional LMGT3 exception is not the convergence rule for later experiments. No calibration was adopted and b2 was not re-judged. Objective logs record iterations, cap hits, final simplex size, full-precision candidate/selected errors and group runtime. There is one deterministic initial simplex, labeled restart 0; no new restarts are introduced.

#### WEC sector eligibility and isolated experiment

Owner-approved revision (2026-11-10): scale official sector distances by model length / official length; accept ratios from 0.98 to 1.02 inclusive. Measured sectors must be positive and sum to the lap within 0.002 s. Before any fit, `prepare-wec-eligibility.mjs` uses the production class car, saved track grip and measured weather on the best dry lap for each class-track-year. Each sector share must differ by at most 3 percentage points. Any failed class excludes the entire track-year; an invalid lower-ranked lap excludes only that row. The persisted table is shared by b2, b1 and b4, with input hashes checked before fitting. F1 sector points are never changed.

`run-wec-timing.mjs prepare <PR149 reproduction snapshot> <original source snapshot>` creates isolated folders and the fixed table. Run `baseline` first (exact production reproduction and flags-off byte identity), then `sectors`, then `diagnostic`. Primary weight is 2; weights 1 and 4 are sensitivity only. Trap stays off and aero ratio is not implemented. The manifest is `scripts/sim/wec-timing-experiment.json`. These commands never install a candidate in production.

#### Verified WEC production recipe — PR #149

Verified 2026-11-10 with Node 22.23.4. This reconstructs the saved WEC calibration from PR #149 (c08a72f66a8984013d5ede3b9b923bdb476eb734); it does not update the production model. Use an isolated snapshot of that commit, including its calibration-data.js as the unchanged F1 seed, transfer-grip-data.js (experiment B), Timing71 table and BoP data.

**Critical input:** use worker/lapsim/tracks-data.js from the pinned archive for this historical reproduction, not the checked-in geometry. They differ only at Interlagos. PR #149's saved WEC fit was generated with archive geometry, while the repository still contains the other geometry. Never replace production geometry or regenerate its model silently.

Archive URL: https://raw.githubusercontent.com/kangjeongmin1229/f1-data-analyst-deploy/probe/lapsim-export/probe-out/lapsim-inputs.tgz.part-aa

| Input | SHA-256 |
|---|---|
| Archive | 268039a6acd2fd589336fede690e3321d723f6f50665718a55f6021cde1ac186 |
| Archive geometry | 4fc1b3ecb014434b70d54be520803da3af7bf9ff19b63508c9518f29dd3b67f1 |
| Raw archive wec.json | aa40cae3646ea33a3d1692c0f523196a4716bd707b84b38476bcf96da9d54626 |
| wec.json after existing wet exclusions | ce25a479ab6b256d2ac597fa34c5941f7f3166db3bd4112e92cd355502a11960 |
| B transfer table | b2d3bba7113685d1382415b4717bd26a6df2aa73f4664c0c88e64068d08e3705 |
| Timing71 derived input | 4852d273a360192fe0007c756c3a1e0f70d5aefeeb2cd46198c49878a7c12a76 |

Extract only into the isolated reproduction snapshot:

```sh
tar -xzf lapsim-inputs.tgz .cache/lapsim/wec.json worker/lapsim/tracks-data.js
node --input-type=module -e 'import {readFileSync,writeFileSync} from "node:fs"; const file=".cache/lapsim/wec.json"; const rows=JSON.parse(readFileSync(file,"utf8")); const wet=JSON.parse(readFileSync("scripts/sim/data/wet-sessions.json","utf8")).wec; for(const row of rows) if(wet[row.year+" "+row.track] && row.weather) row.weather.rain=true; writeFileSync(file,JSON.stringify(rows));'
LAPSIM_ONLY=wec LAPSIM_ITERS=70 LAPSIM_HOLDOUT_ITERS=25 node scripts/sim/calibrate.mjs
```

Run in a clean environment: no other LAPSIM_* overrides. The new timing flags, axle, banking and vertical-curvature features are off; LAPSIM_WEC_GRIP is unset, allowing the existing F1-versus-transfer selection. WEC weights are the unchanged defaults (lap 2, trap 0.5). BCD rounds/iterations do not control WEC. There are 36 raw class-session rows / 108 selected laps; existing wet exclusions remove 9 Austin 2025 laps, leaving 99. The 11 Timing71 candidate rows remain in scripts/sim/data/t71-wec-extra.json.

The generatedAt field records the execution date and is not a fitted number; compare it separately. Numerical/model output must match exactly, not merely within 0.05 pp. Full evidence and the checked-in-versus-fit geometry discrepancy are in [archived handoff section 15](archive/lapsim-physics-history-14-17-2026-11-10.md).

### 5.3 Stop conditions

The following conditions block the affected work:

- a change to production values, geometry, bounds, weights or the gate;
- a raced-session reproduction failure;
- an unverifiable fact that the work depends on;
- work outside the physics scope.

During the owner-authorized autonomous session, park a blocked block and continue to the next one without asking. A failed candidate check is recorded, not adopted. End the whole session if raced-session reproduction fails on production files, a production runtime file or `gate.mjs` hash changes, or an input hash does not match. Model candidates stay in isolated copies and draft PRs; they do not replace production. No merge or Vercel action.

### Pre-approved actions

Owner authorization dated 2026-11-10:

- Add rounds or iterations to meet the declared convergence rule, up to 10 F1 BCD rounds and 2,000 WEC iterations at R = 1e-4. Do not change the other settings.
- Restart an interrupted run from the same pinned inputs. For Block 0, restart once; if that retry fails, park it and use production as the baseline.
- Fix an audit, report, archiver or test to use the same rows as the fit or read its inputs from GitHub files.
- Choose between verified official sources and use sources already used by the repository: OpenF1, TracingInsights, Al Kamel, Timing71 derived tables and FIA documents. Unverified numeric facts stay empty.
- Add code behind a default-off flag with flags-off output byte-identical.
- If a necessary fact cannot be verified, a pass check fails twice or a time box expires, record the blocker, park the block and continue. The hard stops above still end the session.

Every experiment declares its variants, baseline, settings and pass check before running. Control and candidate run together at the same settings; WEC uses R. No setting is chosen after inspecting held-out results. Bounds, weights and the gate are unchanged unless the owner has explicitly authorized that specific experiment. Passing model changes may be prepared as draft PRs for owner review; production adoption is not authorized.

### 5.4 What these rules can and cannot do

The rules stop wrong changes from shipping and stop time being spent on runs that cannot give an answer. They do not make the error fall by themselves. Error falls only when missing physics or missing data is added (sections 4.3, 4.4 and 6). If three experiments in a row are rejected on the same idea, stop that idea, write why, and move to the next item in sections 4.3 and 4.4.

## 6. Build order: gears, car model, racing line

| Step | Work | Evidence and check | Feasibility |
|---|---|---|---|
| 1 | F1 gear ratios from RPM, speed and gear channels | Layer 2. Reproduce the real gear trace on a hidden team. | High |
| 2 | Torque curve shape and shift time from acceleration by gear | Layer 3. Check on speed traces not used in the fit. Confirm the sample rate allows shift timing. | Medium |
| 3 | Optimal gear at every point: highest wheel force with a shift-time cost | Compare with the real gear per corner. Report percent of track distance in the right gear. | High after 1–2 |
| 4 | Axle model accepted through the gate (section 9) | Corner minimum bias near zero, downforce off its bound, held-out error not worse | Medium |
| 5 | Gears for cars without RPM data (WEC, GT3) | Layer 4: homologation papers, speed-trace steps, pattern from similar cars. Label low confidence. | Low to medium |
| 6 | Minimum-lap-time line inside the track edges | Needs real track edges (about 25 tracks have them). Check: lap time must not become faster than reality. The earlier line test was 3.5–5 % too fast because grip was calibrated on a different path. Recalibrate grip on the optimised line. | Medium |
| 7 | Line validation | Public F1 positions are snapped to one path, so no real driven line exists. Validate only through speed traces, corner minimum speeds and braking points. Label the output "model optimal line, not compared with a real driven line". | Low for direct proof |

"Any race car" is possible only when that car has: mass, power or torque data, gear ratios or RPM data, and laps on several tracks. Lap times alone are not enough.

When the owner has an iRacing account: iRacing telemetry (60 Hz, with position, gear and RPM) becomes the test bench for steps 5–7. Routes: Garage 61 shared laps, VRS data packs, own recordings. Read the terms first. Until then, do not use sim data.

## 7. Reporting to the owner

- English, B1–B2 level, short sentences, tables for numbers. Korean if the owner writes "한국어로".
- Result first: accepted or rejected, the numbers, the reason.
- Always state: baseline, settings, n per group, what was not checked.
- Never say "done" or "passing" without the command output or the run link.
- Give corner names in the Korean fan form with the English name (see the track map rules in the handoff).

## 8. Known open points

| Point | State |
|---|---|
| Downforce at the upper bound (F1 2024 and 2025, Hypercar 2025, LMGT3 all seasons) | Open. The axle model did not remove it. |
| WEC sim top speed against real trap differs by 10–20 km/h on some tracks | Not a like-for-like comparison today (section 4.3, limit 2). Fix the comparison before drawing conclusions. |
| WEC grip and downforce not separable | Open (section 4.3, limits 1 and 3). |
| 2026 WEC event BoP | Not verified in this session; unknown, not an assumed absence. |
| Track edges and height for tracks outside the public database | Manual work per track. |
| GT3 series table (BoP body, torque sensors) | Not verified. First task of the GT3 refit. |

---

## 9. Status on 2026-11-10

| Work | Current state |
|---|---|
| Axle screen | Rejected at unconverged settings; this is not a final rejection of axle physics. Flags remain off. |
| Sector term | Rejected at historical 70/25 and in the one allowed weight-2 re-test at R: pooled RMS 1.166709% → 1.196784%, n=33. Flag stays off. |
| WEC yardstick | R = 1e-4, cap 2,000. Verified against 1e-6 across 6 groups: under 0.02 pp and no choice flips. |
| Geometry mismatch | PR #149 WEC and B used archive Interlagos geometry; the repository uses dry session 9865. Exact historical recipe remains in section 5.2. |
| Consistent candidate | B converged at round 7. Pooled WEC RMS at R increased from 1.166709% to 1.179080%; candidate rejected. Production remains the baseline. |
| Round-five secondary | Pooled WEC RMS 1.094332%, but B failed convergence. Diagnostic only; no substitution after seeing results. |
| Geometry guard | Draft PR #155 selects the latest zero-rain session, or retains existing geometry. One geometry per track for all series. |
| Rain-source tracks | All unchanged. Dry Las Vegas parked at its time box with only 2/8 held-out folds complete per arm; Montreal and Zandvoort not started. |
| Production F1 | Existing main-fit scores 23.9813 → 23.6060: 1.56497% decrease, fails the 1% rule. Report only; not adopted or silently refitted. |

No production model, geometry, bounds, weights or gate change has been adopted. Detailed history is in the handoff and its archive; current block status is in `docs/lapsim-night-session-2026-11-10.md`.
