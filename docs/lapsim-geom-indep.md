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

## Attempt 2 (2026-11-23 13:00–13:45 KST): real widths, kerb margin, tight-corner curvature — rejected
Pre-registration: Project `claude/gate-independent-geometry-attempt2-prereg-2026-11-23.md` (after the owner's review
`claude/review-step3-corner-speeds-2026-11-23.md`). G2 = G1 plus:
- OSM densified by a centripetal Catmull-Rom spline, centre σ 8 → 3 m;
- TUM racetrack-database widths per station (Shanghai, Suzuka);
- a 0.2 m car margin on the inside of corners (kerbs), 1.2 m elsewhere;
- the line solved at 2.5 m, with curvature as the exact tangent change per 5 m cell (amendment B1: the circle estimator broke lap
  closure).

`build.mjs --variant g2` rebuilds it; its output is kept in `tracks-g2.json`. The flag still applies G1 (`tracks.json`).
Baseline B2 = B on the current main: its calibration is byte-identical to attempt 1's B, so G1 stays comparable.

**Clean-window corner check** (`corner-check.mjs`):
- Corners are the measured local minima.
- Each lap is aligned to the model line's curvature, not its speed.
- The Suzuka 2026 file fails alignment (δ on the ±150 m bound) and is dropped (amendment B3).

| Median of the four, model / measured | < 120 km/h | 120–180 | 180–240 |
|---|---|---|---|
| B (production geometry) | 1.029 | 0.843 | 0.799 |
| G1 (attempt 1) | 0.930 | 0.809 | 0.862 |
| G2 (attempt 2) | 0.915 | 0.820 | 0.980 |

The clean windows give almost the same B ratios as residual-signature. Attempt 1's P3 failure was therefore not an input
artefact: with grip near 1, slow corners are 7–8 % slow.

| | Jeddah | Shanghai | Imola | Suzuka |
|---|---|---|---|---|
| Grip B → G2 | 1.184 → 1.019 | 1.058 → 1.034 | 1.143 → **1.300** (bound) | 1.024 → 1.030 |
| Level C F1 2025 (%) | +6.55 → +1.84 | +4.65 → +3.35 | +4.35 → **+13.62** | +1.98 → +2.18 |

**Result.**
- P1 ✗ (2 of 4).
- P2 ✗: the four tracks went 4.48 → 8.65 % RMS (p 0.56). Overall level C 2.70 → 4.09 %.
- P3 ✗.
- Cause: the spline passes exactly through noisy OSM nodes, and with σ 3 m that noise stays in the line. Imola's total turning
  rose 1047° → 1188° (G1) with no corner added.

This attempt changed four things at once, so the widths and kerbs were not tested on their own. One attempt is left under the stop
rule.

## Attempt 3 (run 2026-11-24, rejected: the idea stops): every track with an OSM loop
Pre-registration: Project `claude/gate-independent-geometry-attempt3-prereg-2026-11-23.md`. This is the last attempt (m = 3), and
it runs on the wave-3 base after step 20.

**Method.** Attempt 1's method is unchanged: `build.mjs` default, σ 8 m, linear OSM, least-curvature line, `lineTrack` 5 m and
A1–A4. On top of it come four parts only, in `build-a3.mjs`:
- (a) width per station: OSM area polygon, else OSM width tag, else track-widths.js, else the FIA list, else 12 m;
- (b) kerb allowance from kerb-use-data.js (iRacing) or 4a `kerb`/`loop` corners (1.0 m, ±40 m);
- (c) 4a `line` corners through the `usableWidth` hook (F1); WEC has no limits, and its curvature is stored where it differs;
- (d) one geometry per layout era (5a registry, OSM attic data).

**Build.** `.github/workflows/lapsim-geom-a3.yml` builds every track in GitHub Actions. The output is
`scripts/sim/data/geom-indep/tracks-a3.json` and `build-report-a3.json`.

**Flag.** `LAPSIM_GEOM_INDEP=a3` applies the era that holds 2026 to every track that has a G3 row and is not "source incomplete".
Formula E rows stay. The per-track source table is in the status doc `claude/status-2026-11-24-step3-attempt3.md`.

**Raw inputs.** Each group saves its raw OSM and elevation files as artifact `geom-raw-a3-k` (30 days); `inputs-sha256.txt` lists them.
`raw_run=<run id>` reuses them. The merge stops if any track's fetch is incomplete (no silent drops). Baku is not fetched for
elevation (no GLO-30 tiles for Azerbaijan); it is "source incomplete" for its OSM anyway, so it keeps production geometry.

**Result (m = 3, rejected).** B = flag off (run 45296179722, own build); G3 = flag a3 (run 45321410249, same build artifact). The
13 fit, kernel and geometry-consumer files are identical by hash; the geometry comes from run 45320691822. Gate jobs set the flag
through `.github/lapsim-geom-indep` (read in `lapsim-setup`); no such file = no change.

| Check | B → G3 | Verdict |
|---|---|---|
| Noise (WEC held-out rule) | spread 0.005 < δ/3 0.016 pp | judgeable |
| P1 grip closer to 1 | 9 of 20 F1 tracks, sign p 0.75; SD ln grip 0.073 → 0.056 | **✗** |
| P2 level C, G3 tracks | 20 tracks, 49 rows; RMS 2.575 → 1.952 %; sign-flip p 0.089 | ✓ |
| Guards | other tracks 2.874 → 2.976 (+3.5 %); F1 2.918 → 2.247; WEC 1.805 → 1.891 (+4.8 %) | ✓ |
| Corner bands (median r) | <120 0.971 → 0.892; 120–180 0.862 → 0.784 (+0.079 > 0.068); 180–240 0.906 → 0.891; ≥240 0.978 → 0.969 | **✗** (120–180) |

Reported: F1 median |error| level C 2.62 → 1.37 %, forward-chaining 1.32 → 0.91 %; WEC forward-chaining RMS 0.84 → 2.30 %; grip
bound hits B Jeddah, Imola → G3 Yas Marina; WEC fold bound hits 30 → 25. Not run: KERB_M ±0.5 m sensitivity, level A.
Numbers: `scripts/sim/data/geom-indep/results-a3.json`. Third rejection: the idea stops; the flag data stays as a record.

