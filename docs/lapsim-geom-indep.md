# Track geometry that does not come from the cars (step 3, 4-track test, 2026-11-23)

Pre-registration and amendments: claude.ai Project `claude/gate-independent-geometry-prereg-2026-11-23.md`. Ledger: 2026-11-23,
step 3. Code: `scripts/sim/geom-indep/` (fetch.py in `.github/workflows/lapsim-geom-indep.yml`, build.mjs, apply.mjs,
slow-corners.mjs). Data: `scripts/sim/data/geom-indep/` (tracks.json = one geometry per layout era, build-report.json,
slow-corners.json, results.json). Flag `LAPSIM_GEOM_INDEP=1` (apply.mjs, working copy only). **No production file changes.**

## Method (declared before any number)
OpenStreetMap `highway=raceway` centre line → local tangent plane → Gaussian σ 8 m → least-curvature line inside W/2 − 1.2 m
(`racing-line.js` defaults, TUMFTM mincurv objective) → `lineTrack` 5 m. Grade from the best open elevation model. The production
line only picks the OSM branch, the direction, the start line and the distance correspondence for measured data (traces, sectors,
corners, FIA zones). Runs B (flag off) and G1 (flag on): same pinned inputs, production env, BCD 3 × 100, same code.

## Sources and grid sizes

| Track | Centre line | vs official | Width | Elevation | Grid | Banking |
|---|---|---|---|---|---|---|
| Jeddah | OSM, 100 % matched | −0.41 % | 13 m (track-widths.js) | Copernicus GLO-30 (DSM) | 30 m | no (30 m only exists) |
| Shanghai | OSM, 100 % | −0.40 % | 13 m (FIA list) | Copernicus GLO-30 (DSM) | 30 m | no (30 m only exists) |
| Imola | OSM, 100 % | −0.22 % | 12.5 m (track-widths.js) | Copernicus GLO-30 (Emilia-Romagna WCS serves a picture, not heights) | 30 m | no |
| Suzuka | OSM, 100 % | −0.31 % | 10 m (FIA list) | GSI DEM5A airborne laser | 5 m | reported only |

## Before / after

| | Jeddah | Shanghai | Imola | Suzuka |
|---|---|---|---|---|
| Line length prod → new (official) | 6110 → 6051 (6176) | 5440 → 5303 (5451) | 4867 → 4846 (4909) | 5771 → 5722 (5807) |
| **F1 grip factor B → G1** | 1.184 → **1.011** | 1.058 → **0.975** | 1.143 → **1.072** | 1.024 → **0.996** |
| F1 drag factor B → G1 | 1.042 → 1.007 | 0.975 → 0.992 | 1.086 → 1.089 | 1.010 → 1.007 |
| Level C F1 2025 (%) | +6.55 → +0.60 | +4.65 → +0.38 | +4.35 → +1.66 | +1.98 → +0.47 |
| Level C F1 2026 (%) | – | +5.10 → −0.00 | – | +5.18 → +2.40 |
| Level C WEC LMH / LMDh / LMGT3 (%) | – | – | +4.08/+3.63/+3.29 → +0.66/+0.24/+1.08 | – |
| Level C, production cars, geometry only (%) | +6.59 → +0.21 | +4.55/+4.78 → −0.29/−0.48 | +4.43 → +1.24 | +2.10/+5.21 → −0.12/+1.75 |
| Corner ratio < 120 / 120–180 / 180–240 km/h (B → G1) | 1.07/0.78/0.86 → 0.95/0.93/0.89 | 0.83/0.62/0.45 → 0.72/0.67/0.66 | 0.99/0.91/0.74 → 0.91/0.83/0.83 | 1.11/0.94/0.92 → 0.96/0.79/0.93 |

Selected corner radii (production → independent line, m): Shanghai T5 92 → 287, T10 25 → 51, T14 11 → 8, T16 21 → 39; Imola T2
31 → 48; Suzuka T1 99 → 115, 130R (T15) 119 → 148 (named 130 m), T9 46 → 32. Slow corners (R < 60 m) with measured minimum speed
and implied lateral g: `slow-corners.json` (for step 2b; implied g > 6 means the radius or the ±1.2 % corner window is wrong).

## Pass check

| Check | Result | |
|---|---|---|
| P1 grip closer to 1 on ≥ 3 of 4 | 4 of 4 | **pass** |
| P2 level C, four tracks | RMS 4.48 → 1.10 %; gains 42.5 / 23.7 / 13.8 / 12.4 %²; sign-flip p 0.0625 < 0.16; other 22 tracks 2.22 → 2.16 % | **pass** |
| P3 corner bands (median over the four, \|1 − r\| worse by > 0.028) | < 120: 1.029 → 0.930 (+0.041); 120–180: 0.843 → 0.809 (+0.034); 180–240: 0.799 → 0.862 (−0.063) | **fail** |

Level C over all 57 rows: 2.70 → 2.03 % (F1 3.02 → 2.35, WEC 1.84 → 1.06). F1 2025 grip spread (SD of ln grip): 0.072 → 0.057.
Step 6 re-run (`i4-test.mjs` on the G1 factors): covariates still do not beat level C (A 2.348 → 2.525 %, p 0.93); τ 0.0575.

## Verdict (pre-registered rule)
P1 and P2 pass, P3 fails → **"geometry moves the corners the wrong way: no rollout."** The lap time and the grip factor say the old
geometry was the main cause of the factors on these four tracks, but the slow- and medium-corner minimum speeds move further below the
measured ones. Reading (not a test): with grip back near 1, the factor no longer lifts the slow corners, so the car model's own
slow-corner deficit shows (the −12 km/h corner bias of docs/lapsim-geometry-fit.md section 1.1; steps 2b and 9).

## Not decided here (reported)
- Exploratory, not pre-registered: the same pipeline (production cars, production grade, no DEM) on three tracks where level C is too
  **fast** — Sakhir −4.00 → +1.33 %, Hungaroring −4.35/−2.07 → −1.31/+0.09 %, Mexico City −4.81/−4.97 → −1.16/−2.70 %. So the gain is
  not just a faster line on tracks that were too slow.
- kv and banking, production car, not fitted: kv −0.32 % (Imola) to +0.32 % (Suzuka) of the lap; Suzuka banking from the 5 m model
  −2.17 % (edges at W/2 sit on the verge in a 5 m cell: not trusted).
- Level A hold-out not run (6 h on 2 cores); signature brake: Shanghai +29/+27 → +5/+3 m, Jeddah −3 → −17 m.
