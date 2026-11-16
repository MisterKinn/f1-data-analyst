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

### 2.2 Rerun with the official IMSA sector lines (2026-11-16 21:30 KST)

The atlas lines of 2.1 are replaced by IMSA's own timing maps (Al Kamel notice board, `03_Timing 3 Sector Map.pdf` of every season
2022–2026: section lengths in inches, finish line → i1 → i2 → finish line), stored in `scripts/sim/data/tracks/imsa-sector-lines.json`.
IMSA rows only (2,487 qualifying best laps, 13 tracks). Error = measured − simulated share of the lap, percentage points, mean per class.

| Track | Prototypes (S1, S2, S3) | GT3 | LMP2 |
|---|---|---|---|
| Road America | −0.1, +0.3, −0.2 | 0.0, +0.2, −0.2 | 0.0, +0.1, −0.2 |
| VIR | — | −0.1, −0.1, +0.2 | — |
| Laguna Seca | +0.3, −0.1, −0.2 | +0.2, −0.5, +0.3 | +0.9, −1.7, +0.8 |
| Road Atlanta | −0.5, +0.8, −0.3 | −0.6, +0.6, 0.0 | −0.5, 0.0, +0.4 |
| Lime Rock | — | −0.2, +0.7, −0.5 | — |
| Daytona | +1.2, +0.7, −1.9 | +0.9, +0.7, −1.6 | +0.9, +0.7, −1.6 |
| Long Beach | +0.7, −1.1, +0.4 | +0.4, −0.9, +0.5 | — |
| Indianapolis | 0.0, −1.1, +1.0 | 0.0, −1.0, +1.0 | −0.1, −1.1, +1.2 |
| Detroit | −1.1, +0.3, +0.8 | −1.0, +0.3, +0.6 | — |
| Mosport | +0.2, +1.1, −1.3 | −0.2, +1.3, −1.1 | −0.4, +2.1, −1.7 |
| Watkins Glen | +0.2, −1.6, +1.4 | +0.1, −1.5, +1.4 | +0.6, −1.8, +1.2 |
| Sebring | −1.8, +0.3, +1.5 | −1.6, +0.5, +1.0 | −1.7, +0.2, +1.5 |
| Mid-Ohio | +0.4, −2.5, +2.1 | +0.1, −2.4, +2.3 | +0.5, −2.9, +2.4 |

- With the official lines the 15–30 point gaps of 2.1 are gone: they were the atlas lines. Road America, VIR, Laguna Seca and Road
  Atlanta now agree within one point.
- Daytona: the 2022, 2024 and 2025 PDFs put i2 435 m earlier than the 2023 and 2026 PDFs. With the PDF line those seasons are 6–7
  points off in every class; with the 2023/2026 line under 1. The timing files are measured, so the data file uses the 2023/2026 line in
  every season and keeps the PDF value as `docSectorsM`.
- Laguna Seca: the errors change sign from 2024 on with the same published line (2021–23: +0.9, −1.9, +1.0; 2024–26: −0.3, +1.0,
  −0.6), so a line moved in 2024 that the PDF does not show.
- Watkins Glen, Mid-Ohio, Sebring, Indianapolis, Mosport, Detroit, Long Beach: 1–2.5 points, the same in every class and season.
  That is either the track (corner positions or radii in that sector) or the corner-speed bias that every class shares (F1: −12 km/h,
  section 1.1). The class test of 2.1 cannot tell these apart. Next: the speed traps of IMSA's 2026 "All Sections" maps sit at a
  known distance, so the measured trap speed against the simulated speed at that point checks the corner before each trap directly.
- No model or geometry change from this run.

### 2.3 Speed traps and start line (2026-11-16 21:50 KST)

IMSA's 2026 "All Sections" maps give each speed trap's start and length, now in `imsa-sector-lines.json` (`trap`). Measured 2026
trap speed (IMSA rows) − simulated speed at the trap centre, km/h (LMP2 is simulated with the LMDh car here, so its column is not a check):

| Track | Prototypes | GT3 | Where the trap falls on our lap |
|---|---|---|---|
| Road America | −0.2 | 0.0 | end of the straight: fine |
| Road Atlanta | −4.7 | −3.0 | fine |
| VIR | — | +3.8 | fine |
| Detroit | +3.7 | +6.4 | fine |
| Sebring | +57 | +45 | in our braking zone for T17 |
| Watkins Glen | +108 | +84 | in our braking zone for the Bus Stop |
| Mosport | — | +49 | in a dip between two of our speed peaks |

At Sebring, Watkins Glen and Mosport the measured trap speed is near the top speed, but on our lap the same lap fraction is already
under braking: the braking point sits about 50–90 m away from where the timing puts it. One start-line shift per track does not explain
it (the best shift that fits the sector shares runs into ±250 m, which is not believable). Our lap lengths are also 1–2 % shorter than
IMSA's measured lengths (Watkins Glen −89 m, Long Beach −75 m, Mid-Ohio −68 m, Daytona −63 m); line positions are mapped by lap
fraction, so that alone moves the Bus Stop braking point by about 25 m.

Decision: no geometry change yet. The shared corner-speed bias (section 1.1) moves braking points too, so the car model goes first
(B1); this check is rerun after it, and what is left at these three corners is then the track.
