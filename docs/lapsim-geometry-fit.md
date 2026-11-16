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
