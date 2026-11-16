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
