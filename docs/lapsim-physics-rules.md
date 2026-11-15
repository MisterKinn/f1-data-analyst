# Lap simulator physics: working rules

Scope: `worker/lapsim/`, `scripts/sim/`, `docs/lapsim-*.md`, `tests/lapsim-*.test.mjs`.
This file is the only source of rules for physics-model work. Read it before every physics task.
History and detailed results are in `docs/lapsim-handoff-physics.md`. If that file and this file disagree, this file wins.
Do not touch the website, accounts, collector, or deployment in a physics task.

Section 9 is dated status. Replace it when it is old. Sections 1–8 are standing rules.
Lap data, track identity, car-model identity and the source list are in `docs/lapsim-learn.md` (owner rules of 2026-11-14): read it before adding laps, tracks or cars.

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
| Hypercar BoP per event, 2024 and 2025 | `scripts/sim/data/wec-bop.json`, sources in `docs/lapsim-wec-bop.md`. 2026 is not published: mark as unknown. |
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

Time budget: a screen must finish in under 60 minutes. If it cannot, reduce the data (fewer folds, one series) and keep the iterations. Do not reduce iterations below convergence.

### 5.1 Numbers for the checks

| Check | Pass value |
|---|---|
| Convergence | Fit score falls by less than 1 % between the last two rounds, in the main fit and in every held-out fold |
| Baseline is valid | The baseline in the experiment is within 0.05 percentage points of the same baseline at production settings, per group. If not, the settings are too short: results are not usable. |
| Gate | `gate.mjs` says "accepted" on all rows, and no group is "worse" |
| F1 protection | F1 2025 and F1 2026 held-out error not higher than the baseline |
| Physical sense | No new value at a bound. Corner minimum bias and trap error not worse than the baseline. |
| Reproduction | `node --test tests/lapsim-*.test.mjs` passes (raced sessions stay at 0.000 %) |

The fit is deterministic (no random numbers in `calibrate.mjs`), so one run per variant is enough.

### 5.2 Commands

| Purpose | Command or place |
|---|---|
| Tests | `node --test tests/*.test.mjs` (Node 22), then `npm run build` and `npm run validate` |
| One calibration | `LAPSIM_...=... node scripts/sim/calibrate.mjs` (needs `.cache/lapsim/` inputs from the pinned archive in `scripts/sim/experiments.json`) |
| F1 only / WEC only | `LAPSIM_SKIP_WEC=1` / `LAPSIM_ONLY=wec` |
| Fit length | `LAPSIM_ROUNDS`, `LAPSIM_BCD_ITERS` |
| Model flags | `LAPSIM_TRACK_DRAG`, `LAPSIM_AXLE`, `LAPSIM_LOADEXP`, `LAPSIM_ROLLFRONT`, `LAPSIM_KV`, `LAPSIM_BANK`, `LAPSIM_GRIP_LO`, `LAPSIM_GRIP_HI`, `LAPSIM_WEC_GRIP` |
| Parallel experiment | Edit `scripts/sim/experiments.json` (common settings and one entry per variant), push to a `lapsim-exp/<name>` branch. Workflow `lapsim-experiment.yml` runs every variant and a compare job. Do not open a PR from that branch to `main`. |
| Compare | `node scripts/sim/exp-compare.mjs base.js cand1.js cand2.js` |
| Corner, trap and braking check | `node scripts/sim/validate.mjs <name>` writes `probe-out/validate-<name>.json` |
| Summary of one run | `node scripts/sim/exp-summary.mjs <name>` |

A new flag must be read in `calibrate.mjs` from the environment in the same way as the existing flags, and listed in this table.

### 5.3 Stop and ask the owner

Stop and ask before you continue when:

- a test of raced-session reproduction fails;
- the baseline in your run does not match production (5.1);
- a change needs a file outside the physics scope;
- two rules in this file conflict for your case;
- data would have to be downloaded from a source not already used in the repo;
- you want to change a bound, a weight or the gate itself. These change what "better" means, so they need approval and their own experiment.

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
| F1 engine power (`pIce`) at the lower bound in every fitted season: 476 kW for 2023–2025 and 340 kW for 2026, both 0.85 × the rules estimate (`calibration-data.js`, generated 2026-11-09) | Open. Found 2026-11-14. A value at its bound means physics is missing (section 3.4). Low power and high downforce at their bounds together suggest the fit trades one for the other. Do not read these numbers as real engine power. See `docs/m17-lapsim-contract.md`, section 2.1. |
| WEC sim top speed against real trap differs by 10–20 km/h on some tracks | Not a like-for-like comparison today (section 4.3, limit 2). Fix the comparison before drawing conclusions. |
| WEC grip and downforce not separable | Open (section 4.3, limits 1 and 3). |
| 2026 WEC BoP | Not published. |
| Track edges and height for tracks outside the public database | Manual work per track. |
| GT3 series table (BoP body, torque sensors) | Not verified. First task of the GT3 refit. |

---

## 9. Status on 2026-11-10: axle screen (run 42732407545)

Replace this section when a newer experiment exists.

### 9.1 Result

Settings: 3 rounds, 100 iterations, weights of production, input pinned by checksum. Held-out RMS error in percent. Baseline in this run was B (no per-track drag).

| Variant | All (67) | F1 (34) | WEC (33) | F1 2025 | F1 2026 | LMH 25 | LMH 26 | LMDh 25 | LMDh 26 | GT3 25 | GT3 26 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B baseline | 1.270 | 1.245 | 1.295 | 1.195 | 1.312 | 1.338 | 1.033 | 1.238 | 1.003 | 1.733 | 1.370 |
| F axle | 1.469 | 1.411 | 1.526 | 1.344 | 1.501 | 1.640 | 1.192 | 1.777 | 1.149 | 1.956 | 1.416 |
| G axle + vertical curvature | 1.445 | 1.391 | 1.498 | 1.284 | 1.531 | 1.565 | 1.198 | 1.685 | 1.205 | 1.989 | 1.324 |
| H drag + axle + vertical curvature | 1.370 | 1.200 | 1.524 | 1.257 | **1.115** | 1.565 | 1.246 | 1.685 | 1.208 | 2.067 | 1.341 |
| I as G, load exponent 0.75 | 1.373 | 1.344 | 1.403 | 1.319 | 1.379 | 1.445 | 1.215 | 1.325 | 1.203 | 1.841 | 1.368 |

Gate: every variant rejected on all rows, on F1 and on WEC. One group accepted: H on F1 2026. Three LMGT3 2026 gains are within noise.

**Decision: no model change. The axle model stays off.** This run cannot be used to reject the axle model for good, for the reasons below.

### 9.2 Review as a data engineer

| Finding | Evidence | Fix |
|---|---|---|
| The fits were not converged | Score in the main fit: 37.4 → 29.1 → 27.1 (B) and 39.7 → 29.0 → 27.3 (G). Still falling at the last round. Held-out folds ran only 2 rounds. | Rule 5.5. Run until the score stops falling. |
| The screen settings move the baseline more than the variants differ | B on F1 2025: 0.90 % at full settings, 1.20 % here. Variants differ from B by 0.1–0.3. | Screen results rank nothing when the settings error is larger than the effect. |
| No production baseline in the run | Production F1 is A (per-track drag on). A was not run. H is the drag-on axle variant and was compared with B. | Rule 2.6. Rerun A next to H with the same settings. |
| "Screen" took 3 h 52 min | G: about 10–13 minutes per round, 19 rounds. The earlier run died at the 340 minute limit. | Rule 5 time budget. Screen on F1 only or fewer folds, with enough iterations. |
| The validation table was not reviewed | `validate.mjs` output is inside the artifacts only. The compare job reads lap error only. | Add corner minimum bias, trap error and bound hits to `exp-compare` output. |
| Small groups | WEC groups have n = 5 or 6. | State it. Pool by class across seasons for the gate, then check no group is worse. |
| Input archive is on a branch of a personal fork | Checksum protects content, but the branch can be deleted. | Store the archive as a release asset of the production repo. |
| The workflow lost functions | Race-pace, circuit-change and race-only steps were removed from `lapsim-experiment.yml`. | Restore them or move them to their own workflow. Do not delete working paths in an unrelated change. |

### 9.3 Review as a race car performance engineer

| Finding | Evidence | Meaning |
|---|---|---|
| The axle model did not fix what it was built to fix | With axle on (G): downforce still at the bound for F1 2024 and 2025 (8.00), LMH and LMDh 2025 (7.00), LMGT3 both seasons (3.50). | Load transfer alone does not explain the missing corner speed. The cause is elsewhere or the axle parameters are wrong. |
| Fixed inputs are guesses | Track width 1.55 / 1.65 / 1.62 m, roll split 0.5, load exponent 0.85, and centre-of-gravity height and aero balance are not from data. | Layer 4 values were used as if they were layer 1. Take them from regulations and homologation papers per car. |
| The load exponent matters a lot | I (0.75) is better than G (0.85) on WEC: 1.403 against 1.498. | The tyre law is the sensitive part. It needs its own fit with a bound and a gate, not one hand-picked value. |
| The one accepted group is the 2026 F1 car | H on F1 2026: 1.312 → 1.115. Downforce there is 4.58, far from the bound. | The axle model may help the low-downforce, energy-limited car. Worth a clean test against A. |
| Trap numbers in the report cannot be trusted yet | B: LMH Interlagos real trap 276, sim 299. LMGT3 Spa real 263, sim 252. But the code compares the real trap with the simulated lap maximum, not the speed at the trap position. | Fix the comparison first (section 4.3, limit 2). Then judge drag and power. |
| The WEC downforce bound is a data problem as well as a physics problem | WEC is fitted on lap time and one trap. The bound allows a downforce-to-drag ratio above 6. | Sector times in the objective and a ratio constraint (section 4.3, limits 1 and 3) are cheaper than the axle model and should come first. |
| One class car hides real differences | LMGT3 is one car at 3.50 downforce for every model. | Section 4.1. Per car model fitting is required before GT3 conclusions. |

### 9.4 Was the handoff followed?

| Followed | Not followed |
|---|---|
| Variants declared, inputs pinned by checksum | Production baseline A missing from the run |
| Gate used, no production model change | PR #150 said "do not merge until the axle screen has completed" and was merged 21 minutes later, about 3.5 hours before the run ended |
| Result artifacts kept, handoff doc updated | Website fixes, preview export and the experiment workflow in one PR, merged to the auto-deploy branch |
| B replaced J for WEC transfer factors with a gated check (#149) | The PR restored the crew and live-access blocks on the account page. The owner had decided to remove the crew list from settings: confirm which is intended. |
| Full-settings confirmation required before any model change | Convergence not checked before a 4-hour run |

### 9.5 Next tasks, in order

0. Extend `exp-compare.mjs` so its output also shows corner minimum bias, trap error and values at a bound per variant (from `validate.mjs` and the calibration file). Without this, section 5.1 cannot be checked by a machine.
1. Rerun A, B, H and I on F1 only (`LAPSIM_SKIP_WEC=1`), with enough rounds to converge, under 60 minutes. Report lap error, corner minimum bias, trap error and bound hits.
2. WEC only, fast (minutes, `LAPSIM_ONLY=wec`): trap at the trap position, sector times in the objective, the downforce-to-drag constraint. One flag each, gated against production.
3. Replace the guessed axle inputs with per-car values from regulations. Fit the load exponent inside a bound.
4. Start section 6 step 1 (F1 gear ratios). It does not depend on the axle result.
5. Build the GT3 series table (section 4.2), keep every car in `fetch-wec.mjs`, then the per-car refit (section 4.1).

---

## 10. Circuits without F1 position data: how the track error was reduced (2026-11-14)

Standing method for adding a circuit that is not in `lapsimTracks`. Code: `scripts/sim/build-geometry-extra.mjs`, `scripts/sim/build-geometry-f1-history.mjs`. Declaration and reference laps: `scripts/sim/data/track-extra.json`. Results: `docs/lapsim-tracks-extra.md`. These tracks live in `lapsimExtraTracks`; the fit scripts read `lapsimTracks` only.

### 10.1 Geometry, highest evidence first

| Order | Source | Use when | Result measured |
|---|---|---|---|
| 1 | F1 car positions of a 2018–2021 qualifying session (TracingInsights), through the production builder with the production smoothing | The circuit hosted F1 and the geometry flag of 10.2 is inside its limit | Four production circuits rebuilt this way: 0.3–0.9 % from the production track with the F1 car, within 0.3 % with the LMGT3 car |
| 2 | Map centre line (OpenStreetMap, accepted within 0.5 % of the official length) with the least-curvature line inside the FIA width | No usable F1 positions | Centre line alone is 11–14 % too slow. With the least-curvature line the unseen error is 0.3–3.9 % |
| 3 | Hand-traced diagram | Nothing else exists | Always ⚠️ |

Never use a map centre line as the driven line. Keep only measured position samples (whole decimetres); the samples interpolated onto the car-data clock add false curvature.

### 10.2 Geometry flag without a car

The lateral acceleration that the pole lap's real speed implies on the built curvature (mean over about 25 m). Production circuits give 5.0–6.6 g. Limit 7.0 g. Above the limit the curvature is too high in a fast corner: keep the map line, or mark ⚠️ when there is none. Sparse positions cause this (2019 data come every 300 ms).

### 10.3 Reference laps

1. Use every series in the lap tables, not only the series of the fitted cars. Decide by car model (a GT3 model, not GT4, GT2 or Cup): the series label of a row can be wrong.
2. Split rows of a venue by layout before use: a lap-time band per layout, and drop a row whose official length ÷ lap time is outside 120–215 km/h.
3. A weather record of zeros is a missing record: use standard weather.
4. Seasons 2023–2026 first. Use 2018–2022 only for a track with no newer row, and label it "older".
5. An F1 lap older than the fitted seasons is compared with the 2023 car times the pace ratio of that season, learned on production circuits with an unchanged layout (2020: 0.9686, held-out 1.4 %; 2021: 0.9864, held-out 1.05 %). Without the ratio the row measures the car, not the track.
6. A class-best table hides car types. Take the best clean lap per car type (LMH, LMDh, LMGT3, GTD Pro, GTD) from Al Kamel's published qualifying timing (`scripts/sim/fetch-track-laps.mjs`, run in Actions): an LMH that was not on pole still has a real lap (Aston Martin in IMSA GTP, Ferrari at Le Mans). These rows replace the Timing71 rows of the same track, series and season, and give each car its real lap on the page and in the tool.
7. IMSA weather files are in °F and inHg. Convert before use.

### 10.4 Decision, in this order (limit 3.0 % RMS, never moved after a result)

| Step | Track factor | Error reported | Level (section 3.2) |
|---|---|---|---|
| 1. Unseen | Mean factor of the class's fitted tracks | RMS over all rows | C, track-unseen |
| 2. Sibling | Factor of a layout that shares most of the lap (production Sakhir for Sakhir Outer, sprint for Nürburgring GP) | RMS over all rows | C for this layout |
| 3. Learned | One grip factor fitted on the track's own rows | Leave one row out, fit on the others, error on the row left out | A or B, not C |

A learned factor must be inside 0.88–1.21, the range of the production track factors. Outside it the geometry is wrong and the track stays ⚠️ (Daytona: 0.76). A learned factor never passes on the rows it was fitted on. No pass: ⚠️ and `fit: false`.

### 10.5 Known limits

- Lap time only. Sectors, corner minimum speeds and traps are not checked (section 3.4).
- A learned factor absorbs line and car error as well as surface grip. Seven map-line tracks need 1.05–1.12: the map line is too slow there.
- Most rows use a borrowed car (IMSA GTP = LMDh, other GT3 series = LMGT3). Only Fuji and Le Mans have own-class rows.
- The 7.0 g limit was chosen after the values of the new tracks were seen.

## Powertrain: torque curve and gears (2026-11-15)

Bug report 2026-11-15: the kernel took no engine torque curve or gear ratios, and the tool showed an LMDh going faster with more
drag. Fixed for every car:

- `kernel.js powertrain(car)`: engine power at road speed from `car.engine` (`rpm` with `Nm`, `kW` or `frac` of `pIce`) and
  `car.gears` (+ `finalDrive`, `tyreRadius`). The best gear is used, shifts are seamless, power above the top gear's rev limit is
  zero, and power never exceeds `pIce` (the regulation or BoP cap). A car without a curve keeps flat `pIce`.
- `worker/lapsim/powertrains.js`: presets per rule set (engineering estimates, ratios checked with Wolfram): F1 fuel-flow curve,
  15 000 rpm, 8 gears; Hypercar 8 600 rpm, 7 gears; GT3 8 000 rpm, 6 gears; Formula E one reduction gear, constant torque to a
  quarter of 20 000 rpm. Effect on fitted laps: below 0.25 % (largest GT3 at Le Mans, 0.17 %), so the calibrations stand.
- Tool inputs: `torque_curve` or `power_curve_kw`, `gear_ratios`, `final_drive`, `tyre_radius_m`, `rpm_limit`, `engine_power_kw`,
  `drag_cda`, `downforce_cla`. The real-lap correction of the unchanged car is kept, so a change shows as a difference from the real lap.
- Drag bug: the sensitivity table compared the changed bare simulation with the corrected (real) lap; it now compares bare with
  bare. Test: `tests/lapsim.test.mjs` (sign of every sensitivity, more drag is slower).
- 2026 F1 energy plan (fixed 2026-11-15): the super-clip plan was rejected when its deploy beat the budget by about 1 kJ (the
  forward pass caps deploy by its own state of charge; the lap account differs from it by that much), so more grip fell back to a
  slower plan at Daytona. The check now allows 1.5 kJ (the battery test still holds: never below −1 kJ), several deploy cut-offs are tried, and the earlier plan stays a
  candidate: no F1 track got slower (largest change −0.44 %, RMS 0.10 % against the 0.9 % holdout error). Test in tests/lapsim.test.mjs.

## Telemetry display: owner rules (2026-11-15, standing)

Follow these in every later change to the /simulation telemetry, the racing line or the map. The model details and numbers are in the
two sections after this one.

1. **Channels.** Show speed, throttle (%), brake pressure (bar, not on/off), gear, engine rpm and steering wheel angle; add a time-delta
   lane when a second car is compared, and a battery energy (SoC) lane for hybrid cars (F1 2026 rules, LMH, LMDh; the same deploy
   and recovery model as the battery panel. F1 before 2026 and Formula E have no battery model yet, so no lane).
   Motor power lane (kW, deploy +, recovery −) with the regulation cap of the car dashed. F1 2026 follows each circuit's FIA "Power
   Unit Information" document completely, as data (`scripts/sim/learn/fetch-pu-docs.mjs` → `worker/lapsim/pu-docs-data.js`): recharge
   per lap by session, power-limited distance, power reduction rate, the exception sectors (Alt 1 curve, >150 kW cut, reset, higher
   speed threshold) and the overtake lines. Mind the rule change: rounds 1–3 (Melbourne, Shanghai, Suzuka) ran the original rules;
   from Miami (round 4) MGU-K is 350 kW in key acceleration zones and the Alt 1 curve (about 250 kW) applies elsewhere in Sprint and
   Race, and the qualifying recharge baseline fell from 8 to 7 MJ. Other cars follow their own regulations (F1 before 2026: 120 kW;
   Hypercar: the BoP motor power above its deploy speed). Changing how the kernel deploys is the energy session's work: the lane shows
   the kernel's flow, and the document's limits are drawn and listed next to it. Brake pressure comes from the deceleration, brake balance, pad mu, disc and caliper size per
   car class; gear and rpm from the engine curve and gear ratios (the best gear, shift points); steering from the path curvature,
   wheelbase, steering ratio per class and an understeer gradient.
2. **Look like a human drove it.** A trace must not be "too honest". The brake is stabbed, overshoots a little, is modulated, eased
   for a moment where a wheel would lock, and trailed off into the corner; the throttle is squeezed on, snapped off, shakes at the
   traction limit and is sometimes lifted; the steering has small quick corrections around the mean angle. Corrections grow near the
   grip limit and at low speed. There is no real trace to compare with: that is accepted, keep going, but say on the page that the
   shapes are a model.
3. **Where grip is easy to lose.** Use the track and the weather: weight lost over crests, braking downhill, downforce lost to a
   tailwind, surface notes from the FIA documents (fresh asphalt, bumps, kerbs), track temperature against the tyre window, rain.
   The human corrections grow there, and the page shows those zones.
4. **Stable page.** All randomness is seeded by track and car, so a reload shows the same trace.
5. **Physics stays honest.** The human shapes never change the lap time or the kernel; each brake zone keeps the impulse of the physics.
6. **Layout.** Like a team data sheet (reference: the McLaren telemetry sheet Lewis Hamilton posted): stacked lanes on one distance axis
   aligned left and right across every chart, official corner numbers (T1, T2, ...) on every lane, the compared car overlaid, and one
   cursor across all lanes that reads every channel at that point.
7. **Racing line.** Every car on every track has a line, and it depends on the car (grip, power, aero). The least-curvature method is
   the base and stays tested.
8. **Map.** The track map stays sharp at any zoom (vector, viewBox zoom; never a scaled bitmap).
9. **Estimates.** Every estimated value is checked with the Wolfram tools and written in this file with its basis.

## Telemetry channels and the racing line for every car (2026-11-15)

Owner request 2026-11-15. Code: `worker/lapsim/channels.js` (`lapChannels`), `worker/lapsim/racing-line.js` (`minCurvatureLine` with
`order: 2`, `blendLine`), `worker/simulation.js` (stacked charts, `lineData`, map zoom). Test: `tests/lapsim-telemetry.test.mjs`.
These are display channels of the simulated lap. They do not change the lap time, the kernel or any calibration. Evidence layer 4
(estimates) unless stated; no channel is compared with measured telemetry yet, so no held-out error exists for them.

### Brake line pressure (bar, front circuit)

Friction brake force = m · deceleration − aero drag − rolling resistance − regen (on its axle: F1 and LMDh rear, LMH front, Formula E
rear). Front force = brake balance × total; front pressure = front force × tyre radius / (2 wheels × 2 pads × pad mu × effective disc
radius × piston area on one side). Formula E (Gen3 on) has no rear friction brakes: the rear share left after regen goes to the front.

| Class | Balance (front) | Pad mu | Disc r eff. front / rear (m) | Pistons one side, front / rear (mm) | Area front / rear (mm²) | N per bar (front axle) |
|---|---|---|---|---|---|---|
| F1 (carbon) | 0.57 | 0.50 | 0.137 / 0.115 | 34+36+38 / 28+30 | 3060 / 1323 | 232.9 |
| Hypercar LMH, LMDh (carbon) | 0.56 | 0.50 | 0.160 / 0.150 | 36+38+40 / 32+34 | 3409 / 1712 | 307.3 |
| GT3 (steel) | 0.58 | 0.45 | 0.160 / 0.150 | 32+36+38 / 30+32 | 2956 / 1511 | 250.4 |
| Formula E | 0.60 | 0.45 | 0.115 / – | 34+36 / none | 1926 / 0 | 113.9 |

Basis: disc sizes from the series limits and maker data sheets (F1 front 328 mm, Hypercar and GT3 front 380 mm, FE 278 mm), effective
radius = disc radius − half the pad height; piston diameters typical of six- and four-piston race calipers; balance and mu typical set-up
values. Checked with Wolfram Language (piston areas, N per bar). Cross-check: Brembo's published F1 pedal load (150 kg) through the
pedal model already in `brakes.js` (ratio 3.5, 17.8 mm master cylinder, 57 % front) gives 118 bar; the geometry model gives a Monza
F1 2026 peak of 116 bar (2025: 127 bar). At 330 km/h and 4.5 g the front needs 68 bar, because drag does much of the braking there.

### Gear and engine rpm

The gear with the most engine power at that speed, from the engine curve and the gear ratios of `powertrains.js` (the same rule as
kernel `powertrain()`); a gear within 1 % of the best is kept, so the trace does not hunt on the flat top of the curve. Shift points are
the changes of that gear. No shift time (the kernel shifts seamlessly). Check: F1 8th gear at 12 000 rpm = 345 km/h (Wolfram), as in
`powertrains.js`. Formula E has one gear.

### Steering wheel angle

Road-wheel angle = wheelbase × path curvature + understeer gradient × lateral acceleration; wheel angle = steering ratio × road-wheel
angle (+ = left). Ratio and understeer gradient: F1 11:1, 0.6 deg/g; Hypercar 12:1, 0.8 deg/g; GT3 14:1, 1.0 deg/g; Formula E 12:1,
0.8 deg/g. Check: F1 hairpin of 12 m radius with 3.4 m wheelbase = 179° at the wheel (Wolfram); the Monaco hairpin in the model
exceeds 150°, as the test checks.

Driver corrections: three sine waves at 1.3, 2.4 and 3.7 Hz (weights 0.55, 0.30, 0.15) in lap time, phases from a seeded hash of track
and car, so the page is stable. Amplitude (deg at the wheel) = 1.2 × u³ × (1 + 25 / max(v, 10 m/s)), u = grip use (combined
acceleration over the point-mass capacity, scaled so the 98th percentile of the lap is 1). Corrections grow near the limit and at low
speed, and are near zero on fast straights off the brakes (test). This is a model of the look of real steering traces, not a measurement.

### Racing line for every car and track

Base: the least-curvature line (`minCurvatureLine`, unchanged method). New: the shortest path inside the same corridor
(`order: 2`). Each car gets its own blend (1 − e) × shortest + e × least-curvature (Braghin et al. 2008): one e for the lap by
golden-section search, then up to 10 windows each try e ± 0.3, all judged by the lap kernel with that car (grip, downforce, drag, power,
mass). The search runs on a 5 m spacing: at 10–20 m the three-point curvature hides hairpins and every blend looks too fast.
Precomputed SPSA lines of an exact car (26 tracks with TUM edges: 2026 F1, LMH, LMDh, LMGT3) are kept. Tracks without TUM edges (73)
use the map line as midline and an assumed 12 m width (1 m kept free each side); the page says so. Example: Monaco, F1 2026 mean e
0.61, LMH 0.53, Formula E Gen3 Evo 0.32; Suzuka about 0.95–1 for every car. Limits: the line is not compared with a real driven
line (section 6 step 7); assumed widths; the server draws the least-curvature line and the browser replaces it with the car's line.

### Human pedals, throttle and grip-loss zones (2026-11-15, second step)

Owner: the brake trace was "too honest"; a driver stabs, holds and releases the pedal, and a throttle channel was missing. Reference
for the layout: a team data sheet (one distance axis, both drivers overlaid, a time-delta lane, values at a cursor). No real trace is
compared (there is no answer to compare with); the shapes below are a model of a human driver, labelled so on the page.

Throttle the lap needs (0–1): 0 while the brake is needed, 1 where the kernel is power-limited or above the deploy cut-off / clipping
speed (the battery, not the foot, limits the car there), else (m·a + drag + rolling) · v / (engine power in its gear × drivetrain
efficiency + hybrid power).

Human traces, on a grid half a lap point apart (2.5 m: 37 Hz at 330 km/h, 9 Hz at 80 km/h; ripple frequencies are capped at
0.4 × the local sample rate so slow corners do not alias), seeded per track and car:

| Part | Model | Value (Wolfram check) |
|---|---|---|
| Brake stab | 1 − e^(−t/τ), τ 0.035 s | 90 % in 0.081 s |
| Overshoot | 4–10 % of the zone peak × (t/τ)·e^(1−t/τ), τ 0.09 s | peak 1 at t = τ, area e·τ |
| Hold | 4–7 Hz ripple 1.5–3 % + 1–2 Hz wander 1.2 %, × (1 + 2 × grip risk) | |
| Lock-up relief | 10–18 % dip for ±0.04 s, chance 0.25 + 0.6 × risk, at the riskiest point of the zone | |
| Impulse | each zone rescaled to the physics brake impulse | test: within −2 / +15 % with the tail |
| Trail-off | tail from max(6 % of peak, end pressure), τ 0.10–0.18 s, at most 0.5 s | 12 % left after 0.3 s (τ 0.14) |
| Throttle | squeezed on τ 0.10 s, snapped off τ 0.025 s; 2.5–4 Hz ripple while part-open; lift of 15 % for 0.12 s on 20 % + 60 % × risk of pick-ups; 0 while braking | t90 0.23 s / 0.058 s |

Grip risk per point (0–1): 0.6 × weight lost over a crest (v² × vertical curvature from the smoothed grade / g) + 0.3 × 5 × downhill
slope while braking + 3 × downforce lost to a tailwind (aero share of the load × (1 − ((v − tailwind)/v)²)) + 2 × (1 − surface grip,
FIA changes switched on) + 0.25 on fresh asphalt or patched bumps named in the latest FIA notes (0.15 on the whole lap for a
resurfacing with no place) + 3 × (1 − temperature grip factor) + 0.5 in rain. The weights are engineering choices, not fitted.
It scales the steering corrections (× (1 + 1.5 × risk)), the brake ripple and relief, and the throttle ripple and lifts; it is shaded on
the speed lane where it is 0.2 or more. Check: at Spa the highest risk is the Raidillon crest (T4), at Monaco the Massenet crest (T2).
Grade exists for 75 of 99 tracks and heading (wind) for 26; without them those terms are 0.
