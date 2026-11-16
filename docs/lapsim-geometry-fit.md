# Track geometry corrected to measured data (task A4)

Owner rules (2026-11-16): measured data (lap times, speed, throttle, brake traces) is never changed. The track is corrected so the
simulator agrees with it; unknown quantities are then estimated from it. Physics rules apply (docs/lapsim-physics-rules.md): declare
before running, flag off = byte-identical, fit on one set and report error on another, model change only in its own PR after the gate.

## 1. F1 corner geometry from measured corner speeds — declared 2026-11-16 16:20 KST, before any run

Data: `.cache/lapsim/traces.json` (pinned input archive of `scripts/sim/experiments.json`, sha256 268039a6…): OpenF1 qualifying laps
2023–2026 with speed, throttle and brake on the track's distance scale. Car and track factors: production `calibration-data.js`.

Question: at each corner, does the simulated minimum speed differ from the measured one in the same way in every season? A difference
shared by four seasons of different cars (2026 is a new concept) is the track (curvature too high or too low); a difference that changes
with the car is the car model and is not moved into the track.

Method (`scripts/sim/geometry-fit.mjs`):
- Corners: local minima of the measured speed (15 km/h prominence, as `validate.mjs`), matched to the simulated minimum within ±50 m.
- Per corner c, per lap: r = (v_real / v_sim)². A curvature scale κ' = κ · 1/r over the corner (the run of the same-sign curvature
  around the minimum, at most ±60 m) makes the simulated minimum speed match, to first order.
- Fit seasons 2023 + 2024: factor_c = median of 1/r over all their laps at that corner (every lap in the archive, not only the pole).
- Lap time stays matched in every evaluation: the track grip factor of the lap is refitted (bisection on simulateLap) after any change,
  so a geometry change cannot win by moving the lap time.

Variants:
- A production geometry (baseline, same script and settings).
- G1 factor_c as above.
- G2 factor_c after removing a car part: per fit season, the median 1/r in three corner-speed bands (< 120, 120–220, > 220 km/h) is
  taken out first (that is the car's aero/mechanical balance, shared by all tracks), then the per-corner median is taken.
Bounds: factor_c outside 0.75–1.33 is not applied and is reported as a geometry question for that corner.

Metrics, held-out seasons 2025 and 2026 (not used in the fit), each separately: corner minimum speed RMS and bias (km/h), braking
point RMS (m), sector error RMS (%), with the lap time matched. Noise: the RMS change that A shows between 2025 and 2026 split halves.
Pass: a variant passes if the corner RMS falls in both held-out seasons by more than the noise, brake RMS and sector RMS are not worse,
and no season gets worse. A passing variant becomes a flag (`LAPSIM_GEOM_FIT`) in its own PR; production changes only after the gate
and the owner's approval. Tracks without F1 traces (endurance, Formula E) are part 2 (sector times, traps), declared separately.

### 1.1 Result (run 2026-11-16, top-5 dry qualifying laps per session, 358 laps; lap time matched on every lap)

Corner minimum speed RMS / bias (km/h) and braking point RMS (m). 2023–2024 = fit, 2025–2026 = held out.

| Variant | 2023 | 2024 | 2025 (held) | 2026 (held) |
|---|---|---|---|---|
| A production | 20.6 / −12.1 / 61 | 23.8 / −12.3 / 75 | 22.9 / −12.3 / 79 | 22.6 / −13.9 / 152 |
| G1 per corner | 21.1 / −11.3 / 62 | 24.5 / −11.3 / 65 | 23.6 / −11.6 / 72 | 23.0 / −13.5 / 153 |
| G2 per corner, car part removed | 19.3 / −11.4 / 62 | 22.2 / −11.5 / 66 | 22.2 / −11.9 / 74 | 22.1 / −14.1 / 151 |

Split-half noise of A: 2.1 (2025), 0.7 (2026) km/h. Gate: **G1 rejected** (worse). **G2 rejected**: held-out gains 0.8 and 0.5 km/h are
inside the noise. No geometry change.

Reading: the corner error is not mainly the track. In every season and every speed band the simulated corner minimum is about 12 km/h
too slow (car part (v_sim/v_real)² = 0.79–0.87, the same on every track), and the lap time is held only because the straights make it
up. That is the car model (cornering grip and aero balance, physics rules 4.3 no. 6 and 4.4 no. 2: the axle model), not curvature.
60 of 230 corners need a factor outside 0.75–1.33 even after that: listed in probe-out/geometry-fit.json for the per-corner check of
part 2. 2026 braking points are 150 m off on average (2025: 79 m): the 2026 car's braking/energy recovery model is the next suspect.
Next: part 2 (tracks without F1 traces: sector times and traps), and the car-model corner bias goes to task B1 / the axle model.

## 2. Endurance tracks from measured sector times — declared 2026-11-16 16:45 KST, before any run

Data: Al Kamel qualifying best laps (IMSA, WEC, ELMS, Asian LMS archive) whose three sector times add up to the best lap (±0.06 s,
so the sectors are of that lap), dry. Sector lines: track-atlas timing sectors (measured on aerial imagery for the IMSA tracks and Le
Mans; others are lap fractions). Car: the production class car (LMDh for prototypes and LMP2, LMGT3 for GT cars), standard weather.
Metric: sector share error = measured share of the lap − simulated share, in percentage points, per layout, sector and class.
Shares do not depend on the overall pace, so no grip or track factor enters.
Rule (fixed now): a track correction for a sector is the prototype mean error; it is judged on the GT3 rows (other cars, same track),
and the reverse (GT3 → prototypes). It counts as geometry only where both directions cut the other class's error by more than half and
the two classes agree in sign. Those sectors become a curvature correction, tested again by lap time in the full refit (A6) before
any production change. Everything else is the car model of that class and is not moved into the track.

### 2.1 Result (run 2026-11-16, `scripts/sim/sector-geometry.mjs`, 5,500 qualifying best laps with their own sectors, 22 layouts)

Sector share error (measured − simulated, points of the lap), mean per class, S1 / S2 / S3:

| Layout | Prototypes | GT3 | LMP2 | Sector lines |
|---|---|---|---|---|
| Le Mans | −0.2 / −2.5 / +2.7 | −0.3 / −2.2 / +2.4 | −0.2 / −2.4 / +2.6 | measured |
| Watkins Glen | +0.2 / −1.5 / +1.4 | +0.1 / −1.4 / +1.4 | +0.6 / −1.7 / +1.1 | measured |
| Mosport | +0.2 / +1.1 / −1.3 | −0.2 / +1.3 / −1.1 | −0.4 / +2.1 / −1.7 | fractions |
| Spa | −0.7 / +2.8 / −2.0 | −0.3 / +2.3 / −2.0 | −0.3 / +2.1 / −1.8 | fractions |
| Daytona | −17.8 / +20.8 / −3.0 | −18.0 / +20.7 / −2.7 | −18.1 / +20.7 / −2.7 | measured |
| Sebring | −23.1 / +26.6 / −3.5 | −25.8 / +32.7 / −6.9 | −22.8 / +26.5 / −3.7 | measured |
| Road Atlanta | −31.3 / +19.0 / +12.4 | −31.8 / +19.0 / +12.8 | −31.3 / +18.2 / +13.1 | measured |
| Road America | −18.7 / +15.7 / +3.1 | −18.3 / +14.8 / +3.5 | −18.7 / +15.7 / +3.0 | fractions |

(all 22 layouts in probe-out/sector-geometry.json)

Decision: **no conclusion, no change.** Errors of 15–30 points of the lap cannot come from curvature (a whole corner is worth 1–3);
they are the same in every class to 0.5 points, so the sector lines used (track-atlas) are not the lines of the timing files, or the
timing files' S1 starts elsewhere than our start line. The declared rule (prototype correction judged on GT3) cannot tell a misplaced
timing line from a track error, because both move all classes alike: the rule was wrong for this data and is withdrawn, not applied.
Where the lines agree (Le Mans, Watkins Glen, Mosport, Spa, Interlagos) every class is within 3 points, and classes agree to ~0.5:
consistent with small track or line errors only.
Needed first: the timing-sector line positions from the official Al Kamel "Timing 3 Sector Map" per circuit (physics rules 4.3 no. 1),
placed on our line. Then this check is rerun with a rule that separates line position (moves all classes by the same time share) from
curvature (moves slow and fast classes by different amounts).
