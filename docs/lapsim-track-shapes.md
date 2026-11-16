# Track map shapes

## Map point spacing (owner 2026-11-16)

- Every drawn map now has one point per stored line point: about 5 m on all 84 tracks (before: 5–15 m, and 35 m at Le Mans, 65 m at
  the Nürburgring 24h, which hid the Mulsanne and Ford chicanes).
- New builds: `build-geometry.mjs` (F1 tracks) and `build-geometry-extra.mjs` (`MAP_EVERY_M = 5`) write every line point.
- The F1 tracks cannot be rebuilt here (OpenF1 cache), so `scripts/sim/densify-maps.mjs` filled their maps from the stored line
  (true heading every 5 m). Every old map point is kept exactly; only the points between them are new. Nothing the simulator reads changed.
- 5 m is the finest spacing with real detail: the source lines are 5–15 m between points. A finer map would only draw straight lines between them.
- Test: `tests/track-map-detail.test.mjs`.

## Shape audit (2026-11-16)

- Check against an independent midline: the 40 circuits of tobi/track-atlas (MIT; OSM midline checked against aerial imagery),
  rigid fit (ICP). Le Mans RMS 2.1 m, max 9 m; most tracks 1.3–6 m. Larger gaps read one by one: Portimão and Interlagos = errors in
  the reference (chords across the lap); Paul Ricard = another layout; Catalunya = the old final chicane in the reference;
  Road America 61 m = Turn 8, a real right angle the reference smooths (a rebuild from the reference made the lap 8.9 % too slow:
  rejected). Street circuits (Long Beach, Las Vegas, Monaco, Singapore) 15–19 m at single walls, within the street width.
- Every map: no spikes, no gaps over 40 m, no self-crossing except Suzuka and Yongin (both real crossovers).

## Accurate source lines (owner 2026-11-16: "use the accurate line, then bring the error down; do not go back to the old line")

- Sources: F1 car positions (26 F1 tracks; measured driven line, kept), OpenStreetMap at full node resolution, and track-atlas midlines
  checked against aerial imagery (tobi/track-atlas, MIT; geometry OSM, ODbL). Where an atlas line exists and passes the gates it is used.
- Gates: lap length within 0.5 % of the official figure, the official race direction, a measured start/finish point, a line without
  known errors. Failed: Watkins Glen, Lime Rock, Sebring (another layout length), Portimão (the atlas line has chords across the lap).
  Switched: Mugello, Fuji, Laguna Seca, Mosport, Road America, VIR, Indianapolis, Road Atlanta, Le Mans, Long Beach; Daytona rebuilt.
  Inputs: `scripts/sim/data/tracks/atlas-<id>.json`; the old candidate is named in `track-extra.json` (`atlasFrom`).
- Fixes in `scripts/sim/tracks/build-atlas-track.mjs`: (1) the loop is closed (one full turn, end on the start). Curvature from smoothed
  positions left Spielberg at -365° with a 36 m gap and Daytona with 8 m: a kink at the start line that made laps 3-15 % slow.
  (2) Smoothing 15 m position / 10 m curvature, chosen on the 24 F1 circuits that have both an atlas line and a measured F1 line
  (atlas lap against measured lap, 2025 car: RMS 3.8 %; 9 m / 6 m: 4.0 %); never tuned on the extra tracks. (3) Width from the atlas
  surface (aerial imagery) where measured. (4) Height from the old candidate (nearest point after a rigid fit) instead of flat.
- Check against real laps (unseen, no fit), RMS % old -> new: Le Mans 2.77 -> 0.96, Indianapolis 3.43 -> 1.56, Daytona 3.83 -> 1.96,
  Laguna Seca 2.72 -> 2.18, Road America 2.78 -> 2.21, Mosport 1.74 -> 1.68, Mugello 1.56 -> 1.61, Fuji 1.23 -> 1.95,
  VIR 2.04 -> 2.58, Long Beach 1.18 -> 3.26, Road Atlanta 2.95 -> 3.99. Mean 2.38 -> 2.18.
- The learning step was then refitted on the new lines (`fit-endurance.mjs`): per-track errors 0.1-1.0 % again; held-out errors
  unchanged (LMH 0.81 %, LMDh 0.73 %, GT3 0.96 %; LMDh before learning 1.74 -> 1.56 %). Racing lines per car, braking and energy
  follow these lines in the weekly lap-simulator data run.

## Kink fix (owner 2026-11-16: "Daytona T1 and Barcelona T1/T4 entry squashed; check every map")

- Scan: within 30 m a line that turns both ways by more than 0.25 rad while its net turn is small. Run over the band edges, the
  midline, the least-curvature lines and every car line of all 99 tracks; each hit over 0.25 rad was read by eye (most are real
  chicanes: Monza T1/T4, Montreal, Le Mans Ford, street corners).
- Cause 1, every F1 track (Barcelona included): the band was smooth, the coloured car line zig-zagged (SPSA offsets, ±1 m point noise;
  over 12 000 kinks on 26 tracks). Fix: car-line offsets smoothed (Gaussian σ 8 m) and the drawn line smoothed in position (σ 5 m).
- Cause 2, map-built tracks: map points are whole metres 5 m apart; the rounding turned the normals, so edges and line wobbled.
  Fix: Gaussian σ 5 m on the map points before the existing smoothing (shape change under 0.5 m).
- Cause 3, side steps in four source lines where the real track is straight (Daytona 200 m before T1, Autopolis 185 m, Valencia
  Ricardo Tormo 3400 m, Laguna Seca 2286 m before T7): drawn with a smooth curve (`MAP_STEPS` in worker/simulation.js).
- Drawing only. The simulator geometry (kappa) still has the four side steps: fixing them changes lap times, so it is a separate
  physics change with its own gate (queued).
- Test: `tests/track-map-detail.test.mjs` (fails on the old code: 12 333 car-line kinks, Daytona 0.51 rad).
- Cause 4, F1 outlines (owner, later on 2026-11-16: "Barcelona T1 goes straight, then right"): the TUM / car-position outline bent
  into some corners too early (Barcelona: −21° of turn 30 m before T1 where the real straight is still straight). The drawn midline is
  now moved sideways onto the checked track-atlas midline (`scripts/sim/tracks/map-shape-atlas.mjs` → `worker/lapsim/map-shape-data.js`,
  rigid fit, gaps over 12 m = another layout and skipped, smoothed over 20 m). Sideways gap RMS, 24 tracks: 0.7–4.8 m → 0.2–1.1 m.
  Measured data (laps, telemetry) is never changed; the simulator geometry is corrected to it in a separate physics task (task 13).
- Kerbs: one inside kerb at each official corner (where the line is closest to the inside) and one outside kerb at its exit (where the
  line runs widest within 80 m), instead of one pair per braking zone (Barcelona T1–T3 was one zone, so T1 had no outside kerb).
  Still estimated: kerb positions are not published for most circuits.

## Endurance tracks onto the atlas midline (task A1, 2026-11-16)

Same method as the F1 tracks, for the 16 endurance circuits that have a track-atlas line; the corrected midline is smoothed again
(σ 5 m). Sideways gap RMS before → after: Daytona 1.96 → 0.31, Fuji 1.01 → 0.21, Indianapolis 3.03 → 0.29, Laguna Seca 1.04 → 0.34,
Lime Rock 2.97 → 0.32, Long Beach 5.24 → 0.80, Mosport 1.47 → 0.18, Mugello 2.52 → 0.15, Portimão 1.69 → 0.30, Road Atlanta
0.60 → 0.20, VIR 0.45 → 0.18, Watkins Glen 1.49 → 0.42, Le Mans 1.86 → 0.26 m.
Not corrected (read one by one):
- Paul Ricard: the atlas line is another layout (71 % over 12 m).
- Sebring: same shape (similarity fit 1.1 m median), but the atlas line is 2.9 % shorter than the official 6.019 km lap: our line kept.
- Road America: a real shape difference of up to ~100 m in the Carousel / Kink section (51 % over 12 m). Which line is right is decided
  by measured lap and sector data in task A4, not by the drawing.
- Lime Rock, Long Beach, Portimão: 18–20 % of the lap skipped (over 12 m): checked again in A4.

## A2. Official corner numbers from circuit maps

Tracks with no official numbers in the lap data showed estimated corners. For each one, the circuit's map on Wikimedia Commons
(SVG with numbered turn labels) is fitted onto our midline: scale from the length ratio, rotation and mirror searched, then rigid ICP.
Each label then goes to the nearest stretch of our line. A label can sit nearer another part of the circuit, so the few nearest
stretches per label are kept and one set is chosen that runs once round the lap in number order (dynamic programming). Each result
snaps to our own bend peak (scripts/sim/tracks/corner-candidates.mjs) within 70 m, each peak used once.

Kept (map turn count = official count, fit RMS ≤ 11 m): Sepang (kuala-lumpur), Sakhir Outer, Ricardo Tormo, Sachsenring,
Oulton Park, Zhuhai, Autopolis, Madring. Left on estimated corners: Jerez and Sydney (the map is another layout), Phillip
Island (T10 and T11 landed 10 m apart: the map labels sit too close to tell MG and Lukey Heights apart),
Donington and Estoril (count differs by one), Aragón and Mandalika (dots only, count differs), and maps without numbers (Dubai,
Sonoma, Oschersleben, Lausitz, Brands Hatch, Snetterton, Magny-Cours). Data: worker/lapsim/corner-numbers-data.js; script:
scripts/sim/tracks/corner-numbers-place.py.

## A3. Shapes not from OpenStreetMap or the atlas, checked against OpenStreetMap

Tracks drawn from F1 car positions or TUM data were fitted (rigid, trimmed ICP) onto every OpenStreetMap raceway way near the circuit
(fetched in GitHub Actions, branch probe/osm-shape; Overpass is blocked from the workspace), then checked on Esri satellite images.

| Track | Our line vs OSM (median / max) | Decision |
|---|---|---|
| Brands Hatch | 1.0 / 4 m | fine |
| Istanbul | 4.0 / 16 m | fine: the 16 m is the line inside one corner |
| Sakhir Outer | 3.0 / 24 m | fixed: after T1 the line ran 20 m off the asphalt (OSM matches the satellite image there) → 0.7 / 7 m |
| Nürburgring GP | 2.9 / 21 m | not changed: three roads meet in the final section and neither line clearly matches the image |
| Paul Ricard, Sochi | — | OSM has only fragments there: no reference |

The fix uses the same sideways correction as the atlas tracks (worker/lapsim/map-shape-data.js, atlas "osm"), from
scripts/sim/tracks/map-shape-osm.mjs and scripts/sim/data/tracks/osm-raceways-a3.json (© OpenStreetMap contributors, ODbL).
Drawing only: lap distance, corners and the simulator geometry are unchanged.

## Daytona before T1, again (owner 2026-11-16 20:40)

The step where the road course leaves the banking (about 300 m after the line) came back as an S-bend: the repair ran before the atlas
correction, and the atlas line has the same small step there, so the correction put it back. Now the repair also runs after the
correction, and a repair entry can set its own half-width (`MAP_STEPS.daytona = [[300, 80]]`: 220–380 m, one smooth left bend).
Test: tests/track-map-detail.test.mjs (no right turn between 200 and 400 m). Drawing only.
