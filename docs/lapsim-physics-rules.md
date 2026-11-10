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
