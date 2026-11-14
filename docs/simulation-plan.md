# Kongboda simulation tools — plan

All results are **provisional estimates**, not exact values. The site shows a confidence label and an
error range with every simulated time.

Base: the TUMFTM open-source tools.
- `laptime-simulation` — lap time. Ported to JavaScript as `worker/lapsim/kernel.js` (same
  quasi-steady-state method, validated against TUM's own results within 0.3–1.2%).
- `global_racetrajectory_optimization` + `racetrack-database` — racing line. Replaced for F1 by the
  real driving line built from OpenF1 qualifying positions (`scripts/sim/build-geometry.mjs`).
- `race-simulation` — race strategy (not started).

## 1. Scope

| Series | Status | Notes |
|---|---|---|
| F1 | **Built** (lap time) | 2025/2026 cars fitted to real pole laps; 2027/2028 projected. Page `/simulation`, tool `lapsim_simulate`. |
| WEC Hypercar | Next | New vehicle files + calibration (see §3). |
| WEC LMGT3 | Next | Shares WEC data and race logic with Hypercar. |
| Other GT3 (IMSA GTD, DTM, SP9/NLS) | Later | Same GT3 base model + per-series BoP and tyre files. |
| Formula E Gen4 | Coming soon | Shown as "coming soon" on the site. Spec-based, provisional. |

## 2. What the TUM tools support

- laptime-simulation: F1 (hybrid) and Formula E (electric) example files; combustion, hybrid and
  electric powertrains.
- global_racetrajectory_optimization: one generic car file (Roborace DevBot 2.0).
- race-simulation: F1 races 2014–2019, F1 race rules only.
- No Hypercar, GT3 or FE Gen4 files: these must be created.

## 3. Hypercar calibration (LMH / LMDh)

Known inputs (BoP / rules): minimum weight, maximum power and power curve, energy per stint, hybrid
deployment speed threshold (LMH).
Fitted to data: drag (CdA), downforce (ClA), tyre grip (μ).
Data: WEC timing via Kongboda (lap, sector times, speed traps); clean green-flag laps only.

Method:
1. Validate the tool first on F1 (done: engine vs TUM, then fit vs real 2025/2026 pole laps).
2. One vehicle file per Hypercar model.
3. Fix the BoP values; fit only CdA, ClA, μ.
4. Calibrate on some tracks, test on a different track (holdout).
5. Report the error range (e.g. ±0.5 s).

Code change needed: LMH hybrids drive the front axle only above a set speed. The kernel's hybrid model
needs a front-axle deployment threshold; LMDh (rear-axle hybrid) fits the current model.

## 4. GT3 (LMGT3, GTD, DTM, SP9)

- Combustion only: the easiest case.
- One GT3 base model + per-series BoP file (weight, power/restrictor, ride height) and tyre file.
- Calibration data: public timing (WEC, IMSA, DTM, NLS/N24). Order: LMGT3 → GTD / DTM → SP9.
- Weak point: Nordschleife (SP9) is not in racetrack-database and has large elevation changes.
  The kernel already uses track grade, but the 2D line still gives a bigger error there.

## 5. Formula E Gen4 (coming soon)

- Start from TUM's FE file; update power, weight, AWD and regen from the Gen4 technical rules.
- Tyre grip and drag borrowed from Gen3 Evo as a start. Labelled **spec-based only**.
- Re-calibrate after the first Gen4 races and publish prediction vs reality.

Data sources checked (2026-11-07):
- Timing: the official FIA Formula E results site (results.formulae.fia.com, Season 1–12) serves
  public JSON folder indexes; each qualifying group/duel has `23_Analysis` (lap, S1–S3, average
  speed, Attack Mode / 350 kW lap flags) and `26_Weather` files — the same Al Kamel format as WEC,
  but no speed-trap column was seen. Al Kamel's own FE hosts were not reachable.
- Telemetry or car positions: no public source (no OpenF1 equivalent).
- Tracks: most FE street circuits are not in open datasets. FE layouts also differ from F1 on shared
  venues (Mexico City, Miami, Jeddah), so the F1 lines cannot be reused as they are. TUMFTM
  global_racetrajectory_optimization has Berlin Tempelhof 2018.
- Gen4 (Season 13 from Jeddah, 18–19 Dec 2026): 450 kW race, 600 kW qualifying/Attack Mode,
  up to 700 kW regen, permanent AWD, Bridgestone tyres, two aero kits. Minimum mass and energy differ
  between sources (950 vs 1,028 kg; 55 vs 51.25 kWh): read the FIA Technical Regulations before fixing them.
- Next step: an FE line builder for street circuits (official track maps + widths), then the
  Analysis/Weather adapter. Until then FE stays "coming soon".

## 6. BoP simulation — prediction from FP data

1. Collect clean FP laps (fuel/tyre-corrected if possible).
2. Calibrate each car to its FP pace.
3. Compare each car with the class reference ("car X is 0.4 s too fast").
4. Convert the gap into a BoP change (kg / kW / energy) with the lap-sim sensitivity.
5. Show "BoP from FP pace" next to the official BoP.

BoP effect ("+10 kg = +x s") for all series; FP-based prediction for WEC first.
Limits: sandbagging (use several sessions and long-run pace), unknown fuel load and tyre age.

## 7. Race simulation (biggest job)

| Series | Rules to add |
|---|---|
| WEC (Hypercar + LMGT3) | Driver changes, energy/fuel stints, multi-class traffic, FCY/SC |
| GT3 series | Pit windows, driver changes, Code 60 (NLS/SP9), multi-class traffic |
| FE Gen4 | Attack Mode, energy limit, pit boost if used |

## 8. Build order

1. ~~Validate stock F1 lap time.~~ Done (engine vs TUM; fit vs real 2025/2026 laps with holdout error).
2. Lap time: Hypercar → LMGT3 → other GT3.
3. Racing line: vehicle files for each.
4. FP-based BoP prediction (WEC).
5. Race sim: WEC rules, then GT3 series.
6. FE Gen4 (coming soon), recalibrated after the first races.

## 9. Common calibration rules (every series)

Drawn from the plan above and from how Formula Student teams build and check their lap-time
simulations (Chalmers 2024, TU Delft 2018, KU coast-down study, OpenLAP, FSAE TTC practice):

1. Fix what the rules or BoP fix (mass, power, energy, hybrid limits). Fit only drag (CdA), downforce
   (ClA) and peak tyre grip (μ), inside physical bounds; F1 also fits engine power within ±15% of the
   rules estimate. Tyre load sensitivity keeps a fixed shape; only the peak μ is fitted.
2. One grip factor per track (asphalt and line), kept at an average of 1, bounded 0.85–1.15; a track at
   a bound is flagged in the report. Track factors come from the richest data (F1) and are shared by
   every series. No other local fudge factors; FIA circuit changes are labelled scenarios.
3. Drag is pinned mainly by straights and speed traps, downforce and grip by fast vs slow corners;
   ClA is the least certain fitted value.
4. Correlate more than lap time: corner minimum and straight-end speeds (robust to distance
   misalignment), lap time, speed trap; report each.
5. Holdout test: refit without some tracks and predict them. Its RMS lap-time error is the error
   range (1 sigma). Confidence: ≤1% medium, ≤3% low, above very low; projections are always low.
6. Report a sensitivity table (lap-time change for +10% mass, grip, ClA, CdA, power) with results.
7. Clean data only: frozen telemetry dropped, wet sessions skipped, pit and flagged laps excluded.
8. State the QSS limits: no transients, gear shifts, tyre temperature or car-to-car effects. 2026
   energy is recovered under braking and on throttle (spare engine power, and super-clipping when
   it makes the lap faster).

## 10. Risk control

- Validate before extending.
- Few free parameters (CdA, ClA, μ; F1 also fits engine power within ±15% of the rules estimate).
- Train/test track split: the F1 fit reports a holdout error (tracks left out of the fit).
- Clean laps only (frozen OpenF1 car data is dropped; wet sessions are skipped).
- Always show the error range and a confidence label.
- Lap time must be validated before race-sim code starts.
