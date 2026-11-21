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

## Shape-only correction, all tracks (owner 2026-11-16 22:46: "Las Vegas T5 is distorted too; check and fix every track")

- Cause (Las Vegas T5, and the same artefact on many corrected tracks): the sideways correction moved whole straights onto the
  reference (Las Vegas: 10 m, the atlas midline of the wide Strip) and dropped to zero where the reference was skipped as another
  road. The line therefore bent into an S over about 80 m just before the corner (2.5 mrad/m to the left before the right-hander T5).
- Fix (`scripts/sim/tracks/shape-corr.mjs`, used by map-shape-atlas.mjs and map-shape-osm.mjs): the slow part of the gap
  (normalised Gaussian over the kept points, σ 150 m) is removed first, so only bends shorter than a few hundred metres are corrected
  and a skipped stretch joins without a step. The reports now give the shape gap (slow drift removed) before → after.
- Scan used to find these (every track): within 120 m the centre line swings one way by more than 3° and back, each swing under 12°.
  Hits that are real road bends were read on plots against the reference; the correction may add a hit only where the reference has
  the same bend (Miami T8, Watkins Glen before T1, Sakhir T4–T5 were checked this way).
- More references: OpenStreetMap raceway ways for every track (A5 probe, `scripts/sim/data/tracks/osm-raceways-all.json`, from
  `osm-raceways-from-probe.mjs`). OSM often maps other circuits next to the main one (kart, moto, oval), so the start pose is
  searched over the whole area in Python (`raw-lines.mjs` → `osm-fit-start.py` → `osm-fit-start.json`, about 15 s a track; the
  same search in the JS script took over 9 minutes for one track). `map-shape-osm.mjs` refines from it and uses OSM only when the
  fit is good (median ≤ 4 m, at most 25 % of the lap more than 15 m away). Order: atlas script first (it rewrites the file), then
  the OSM script.
- Result (2026-11-17): 38 more tracks get the shape correction. Largest fixes: Sakhir Outer 3.95 → 1.26 m shape gap rms, FE Shanghai
  4.00 → 0.93, Jarama 3.46 → 0.65 (hairpin), Istanbul 3.16 → 0.86 (T9 complex), Nürburgring GP 3.15 → 1.04, Kuala Lumpur
  2.55 → 0.70, Lausitz 1.97 → 0.93. Tracks built from OSM (Aragon, Misano, Motegi, Yongin, Yeongam, Inje …) already matched within
  about 1 m and change by 1–3 m at most.
- Not corrected (no usable OSM line: another layout or only part of the lap is mapped): Madring, Sochi, Paul Ricard (both),
  Road America, Sebring (median 6.7 m), FE Mexico (both), FE Tokyo, FE São Paulo, FE Valencia. Las Vegas, Barcelona and the other
  atlas tracks keep the atlas reference.
- Wobble scan after both corrections: 370 hits (raw lines 416). The 82 that the correction adds were read on plots against the
  reference (Zolder, Kyalami, Oulton Park, Jarama, Nürburgring 24h, Sakhir Outer, FE Shanghai, Istanbul, Miami, Watkins Glen,
  Sakhir, Indianapolis, Le Mans, Singapore): each is a bend of the real road.
- Test: tests/track-map-detail.test.mjs (Las Vegas: no left turn in the 175 m before T5; fails on the old data at 2.5 mrad/m).
  Drawing only: lap distance, corners and the simulator geometry are unchanged.

## A4 part 2: the side steps in the simulator geometry (2026-11-17, flag off)

- The four side steps fixed on the drawn map in 2026-11-16 (`TRACK_STEPS`, now shared in `worker/lapsim/track-steps.js`) are
  still in the simulator's curvature: each one is a false S-bend. Autopolis 185 m: curvature +0.004 → −0.014 → 0 1/m within 30 m
  (a 70 m radius where the real road is straight); Valencia 3400 m: +0.014 → −0.009 1/m.
- Kernel option (`trackFromData(d, {steps})`): within ± the half-width the curvature becomes a straight blend between the two ends
  plus a constant that keeps the same heading change. Not passed by production yet, so every output is byte-identical.
- Effect when passed (qualifying lap, 25 °C, no wind):

  | Track | F1 2025 | Hypercar (LMH) | GTP / LMDh | GT3 (IMSA GTD) | FE Gen3 Evo |
  |---|---|---|---|---|---|
  | Autopolis | −0.926 s | −2.066 s | −2.074 s | −2.195 s | −1.948 s |
  | Valencia (Ricardo Tormo) | −0.567 s | −1.321 s | −1.326 s | −1.384 s | −1.681 s |
  | Daytona | 0.000 s | −0.062 s | −0.067 s | −0.201 s | −0.409 s |
  | Laguna Seca | 0.000 s | −0.014 s | −0.016 s | −0.061 s | −0.153 s |

- Gate: Autopolis and Valencia have no real lap of a calibrated class (no rows either way). Daytona and Laguna Seca have IMSA rows
  that the fits use, so the change is judged inside the A6 full refit as a declared variant (production baseline vs `steps`,
  leave one track out). Turned on only after that and the owner's approval.
- Test: tests/track-map-detail.test.mjs ("A4 part 2").

## A2 part 2: Zolder numbers and corner names from OpenStreetMap (2026-11-17)

- Most circuits still on estimated corners have no single official turn numbering: the circuits use corner names, and sources
  disagree on the count (Donington: 9, 10, 11 or 12). Owner decision 2026-11-17: show the official corner names there, and numbers
  only where an official numbered map exists.
- `scripts/sim/tracks/corner-numbers-osm.py` (A5 OSM probe data, © OpenStreetMap contributors, ODbL): our raw midline is fitted onto
  the raceway ways (start pose osm-fit-start.json). A way with a turn ref (Zolder `ref=T1…T16`) gives the number; a named way that
  lies on our lap (every point within 15 m) and is shorter than 600 m gives a corner name, placed at our tightest bend inside it.
  Generic names (circuit, pit, straight, layout, approach sections) are dropped; two names on one bend keep the way centred on it.
- OSM turn refs are used only when they match the official count (`corner-counts.json`). Zolder's refs run T1–T16 (fit 0.9 m, in
  lap order) but the official count is 10, so Zolder shows names. Corner names on the map (instead of estimated numbers): Zolder, Donington, Snetterton, Misano, Jerez, Vallelunga, Estoril, Oschersleben, Nürburgring 24h (Nordschleife names),
  Aragón (2), Sonoma (1). Data: `worker/lapsim/corner-names-data.js`; the map note says the names come from OSM.
- Still estimated (no numbered map and no corner names in OSM): Yongin, Nürburgring Sprint, Brands Hatch (no probe file), Dubai,
  Motegi, Buriram, Okayama, Sydney (both), Inje, Magny-Cours, Mandalika, Phillip Island, Lausitz, Detroit, Jarama (both), and the
  FE street tracks (their numbered maps are in the FE event documents: next source).
- Charts: on name tracks the telemetry charts mark the same corner names (a name tick is left out when it would overlap the
  previous one; its dashed line stays).

## Formula E Mexico from OpenStreetMap (2026-11-17)

The official FIA Formula E circuit maps of Mexico City (2.608 km, 2026; 2.630 km, 2023-25) draw the track as a blue fill, not a
line. `lineOf` (scripts/sim/learn/fe-lines.mjs) then traced the outline of one piece of the fill, so the simulator lap was a thin
out-and-back loop. The same fault hit the Rome and Diriyah maps (not used: no Gen3 Evo race).

- Guard: `build-fe.mjs` now rejects a map line that encloses almost no area (4πA/L² < 0.08; real FE tracks are 0.12 or more,
  the outlines 0.01-0.04). Test: `tests/fe-tracks-shape.test.mjs`.
- Mexico lap lines: `scripts/sim/tracks/fe-osm-lines.py` chains the OSM raceway ways that the official map covers (map fill
  fitted to the ways by similarity ICP, median error 5-6 m) and starts the lap at the FINISH label. 2026: ways 8, 4, 7, 2, 6, 19,
  17, 10, 15, 13, 9 (no back-straight jog). 2023-25: the same with the jog (way 18). OSM length 2579 / 2612 m, scaled to the
  printed 2608 / 2630 m by `build-fe`. The 2026 map fill misses the left stadium arc, so 76 % of the chain is covered by it;
  the arc is on the FE website map (fiaformulae.com news 823702).
- The Attack Zone label is placed by the same fit (26 / 39 m from the line, was 285 m). Effect on the Formula E fit
  (fe-fit.json, layout-out error): Gen3 Evo 4.21 → 3.73 %, Gen3 4.77 → 3.96 %.

## Formula E race direction and finish line (2026-11-17)

The PDF path of a Formula E map is drawn from any point in either direction, and the lap started at its first point. 8 of the
15 Formula E tracks ran backwards (Tokyo, Sanya, Berlin, Jeddah, Miami 2025-26 and 2024-25, São Paulo, Jakarta).
`orientLine` (fe-lines.mjs): the printed turn numbers (nearest instance of each integer label) must run forward along the lap
(majority of consecutive pairs; every track had a clear majority, e.g. Tokyo 2:15); the lap starts at the "FINISH" label
("START/FINISH" on Tokyo and Jeddah). Labels more than 60 m from the line are marked `startVerified: 'label far from the line'`
(Tokyo 160 m, Berlin 97 m, Jeddah 96 m, Valencia 68 m). The Attack Zones (fe-zones.mjs), F1-style zones and pit lanes of these
tracks are rebuilt on the new line.

## Extra-track maps from source coordinates, drift warp, pit lanes (2026-11-17)

- `build-geometry-extra.mjs` draws an extra track's map from the candidate's own source coordinates (placed by lap fraction, same
  start and direction), not from the integrated curvature, which drifted (Road America up to 170 m). Only the map fields change.
- `scripts/sim/tracks/map-warp-osm.py <ids>` moves a map that still drifts onto the OSM raceway ways (rigid fit, then a smoothed
  point-by-point pull, raceway trusted within GATE m). Drawing only; stored as `warp` in `map-shape-data.js`. Used on Paul Ricard
  2021 (median 17.7 → 0.5 m), Paul Ricard F1 (GATE=25, 13.3 → 0.6 m; the two 140 m links east of Signes have no OSM way) and
  Yongin (14.9 → 0.6 m, p95 3.4 m).
- `scripts/sim/tracks/map-shape-audit.py <out.json> [ids]` (not in CI) fits our drawn line to the OSM raceways and lists the parts
  more than 12 m away. All 89 tracks with OSM ways: 63 have median ≤ 1.5 m and p95 ≤ 5 m. Known gaps in OSM, not our errors:
  Hockenheim (hairpin tip), Silverstone (one 330 m piece), Interlagos; Okayama is a uniform scale difference. Misano's 17 m was a
  wrong start pose of the audit (90 % criterion); with the median criterion it is 0.8 m. Street circuits (Las Vegas, Baku,
  Singapore, Monaco, Long Beach, Le Mans, Sochi, Madring, FE Tokyo) cannot be checked this way: OSM maps them as streets.
- Pit lanes were refitted in the new map frames (`pit-lanes-osm.py`, probe/osm-pits and probe/osm-pits-fe). When the stored
  start pose no longer fits a warped map, the script now searches the whole area. This also gave Road America (967 m) and
  Sebring (534 m) their pit lanes. Portimão needed its own start pose (osm-fit-start.json, 0.61 m).

## Start/finish lines from iRacing (2026-11-17)

`scripts/sim/data/tracks/sf-lines.json` holds start/finish line coordinates taken from the owner's iRacing telemetry (the position where
LapDistPct wraps from 1 to 0, median of 4–101 crossings, spread under 1.5 m). `build-geometry-extra.mjs` uses them before OSM and
the "pit straight" estimate, never over a start stated by the source (track-atlas). Check on 15 F1 tracks, whose start comes from F1
timing: the iRacing line is a median 32 m earlier (−80 to 0 m), so the method is good to a few tens of metres.

| Track | Line moved by (old start → new start) |
|---|---|
| watkins-glen | -195 m |
| bathurst | -240 m |
| sonoma | +185 m |
| oschersleben | +1230 m |
| motegi | -20 m |
| okayama | +1365 m |
| sebring | -245 m |
| phillip-island | -345 m |

- Old starts: Okayama and Oschersleben had none ("first mapped point"), the others the middle of the pit lane (±150 m).
- After the move every pit lane of these tracks spans the line, as a pit straight should (before: Okayama and Oschersleben did not).
- Moved with the line: corners (rebuilt), map shape corrections (per-point arrays rotated), corner names (Sonoma, Oschersleben),
  pit lanes, estimated F1 zones and FE attack zones (rebuilt; only these 8 tracks change), estimated PU documents (rebuilt for every
  track: they were last built before the track-atlas lines of 31013a2 and were stale on 21 tracks).
- Lap times: only the simulated laps move (start of the flying lap), by 0.05 s or less; measured laps are unchanged.
- Still unverified: Brands Hatch (TUM line, no coordinates), Rwanda, Sachsenring, Buriram, Zhuhai, Inje, Autopolis; pit-straight
  estimates: Yongin, Mid-Ohio, Lime Rock, Dubai, Ricardo Tormo, Estoril, Jerez, Magny-Cours, Mandalika. Next sources: the OSM
  finish probe (12 tracks retrying) and official circuit maps.
- OSM check (2026-11-18, OSM API map call around each seed, since the Overpass servers were timing out): no finish-line or
  start-line feature is mapped at Buriram, Zhuhai, Inje, Autopolis, Yongin, Lime Rock, Ricardo Tormo, Estoril, Jerez, Magny-Cours
  or Mandalika. Only unnamed towers, which do not place the line. Official circuit maps remain the source.

## Kerb use and track width from iRacing, 8 tracks (2026-11-18)

`scripts/sim/learn/iracing/kerb_use.py` run on all 34 iRacing tracks that have a matching layout (`irmap.py`), from the owner's
407 sessions (on-track GPS samples only; raw files stay on the owner's PC). Kept where our drawn line fits the iRacing laps well
enough for a 1 m answer: median fit ≤ 2.2 m, 95th-percentile drift correction ≤ 8 m, ≥ 30k closed-wheel samples.

| Track | Fit median (m) | Samples |
|---|---|---|
| fuji | 0.61 | 297,797 |
| monza | 1.18 | 234,342 |
| motegi | 1.64 | 496,748 |
| spielberg | 1.65 | 436,941 |
| silverstone | 1.68 | 596,727 |
| miami | 1.88 | 37,959 |
| spa-francorchamps | 2.11 | 275,033 |
| oschersleben | 2.14 | 52,145 |

- Monza is recomputed on today's midline (same samples). Its old values were learned on the 11-17 midline.
- Left out (fit 2.6–51 m, or too few samples): Sebring, Zandvoort, Mexico City, Indianapolis, Austin, Suzuka and others, where
  our line and the iRacing layout differ or the rigid fit finds a wrong pose. Sonoma (iRacing "nascarlong") drifts 18.6 m.
- Effect: drawn edges and the series lines (WEC, IMSA, GT3 may use the kerbs; F1 stays inside the white lines). The kernel lap
  times do not change (checked: F1 2025 and Hypercar on all 8 tracks, 0.000 s).

## Track rebuild path (task 4, 2026-11-18)

Rebuilt locally from the raw session cache of run 44180547107 (tune variant `LAPSIM_POS_K=0`, as that run chose), then the extra tracks,
dense maps, F1 zones and stored racing lines, as the data workflow's `tracks: rebuild` does. What failed and what changed:
- Zones (Imola 2026 zone 4 in a bend): pass once `f1-zones.mjs` reruns on the new shapes (already in the workflow).
- Stored racing lines (Hungaroring point 77 1.72 m outside its edges): the edges were stored on the timing path's normal while the
  line moved along the midline's normal; on tight corners the two cross-sections differ. `racing-lines.mjs` now stores the edges on
  the midline's normal (same width) and to 0.5 m like the line. Takes effect on the next rebuild; the page already rebuilds its
  midline from the edges, so nothing else moves.
- Car lines (lapsim-car-lines.yml, about 3 h) and walls (walls-osm.py, owner's PC) are tied to the line's points. After a rebuild the
  page drops car lines of another point count (as for FIA midlines) and the walls follow by fraction of the lap. With
  `LAPSIM_TRACKS_REBUILT=1` the tests skip the car-line geometry and allow 2 % in the walls point count; rerun lapsim-car-lines.yml on
  the branch before the PR. The workflow sets the flag in a follow-up after the A6 branch lands.
- Stint model: the test said "only 2025 BoP is published"; the FIA 2024 BoP is in `wec-bop-data.js` now, so the test checks each BoP
  row against the published stint energy instead.
- Battery window (Spielberg −1.3 kJ): `flow.dep` is timed on the final speeds, the forward pass checked the battery on its own; the
  test allows 0.1 % of the 4 MJ window (about 4 ms of full deploy).
- C5.12 (Monza, a 175 kW cut to 0 at 221 km/h): a kernel error, not a shape problem. C5.12.4 allows at most 150 kW at the start of a
  cut, held for 1 s; C5.12.7 lifts only the ramp below 100 kW. `rampCaps` skipped the 1 s hold whenever the step landed below 100 kW.
  The fix moves 2026 laps by −0.07 to +0.38 s on 26 tracks, so it waits for a paired-gate experiment after the A6 calibration (open).
## Kerb use on 20 tracks: similarity fit (task 5, 2026-11-18)

The rigid fit of #303 started every rotation from the centroid of the iRacing laps and allowed no scale. Our map metres are
stretched to the official length, so a 1 % scale error alone puts the far end of a 5 km lap 25 m off, and laps that cover more or
less than our line move the centroid. `kerb_use.py` now starts from every 5° and a 5 × 5 grid of centres over a quarter of the laps'
extent, then refines a trimmed similarity fit (rotation, shift and one scale, limited to ±3 %). Same gate as before (fit median
≤ 2.2 m, drift p95 ≤ 8 m, ≥ 30k closed-wheel samples). The 8 tracks of #303 are recomputed with the same method (Monza 1.18 → 1.24 m,
the others better). Lap times do not change (checked: F1 2026 on all 26 tracks, identical).

| Track | Fit median (m) | Scale | Drift p95 (m) | Samples | |
|---|---|---|---|---|---|
| indianapolis | 3.53 → 0.68 | 0.9993 | 6.48 | 704947 | kept |
| road-atlanta | 11.66 → 0.73 | 0.9967 | 6.43 | 800404 | kept |
| austin | 3.59 → 0.92 | 1.0094 | 5.39 | 477608 | kept |
| mexico-city | 2.78 → 0.99 | 1.0064 | 6.32 | 455813 | kept |
| suzuka | 4.23 → 1.11 | 0.9996 | 4.43 | 296022 | kept |
| le-mans | 50.93 → 1.19 | 0.9999 | 4.0 | 431278 | kept |
| zolder | 33.37 → 1.22 | 0.9992 | 3.43 | 256941 | kept |
| long-beach | 4.94 → 1.26 | 1.0016 | 5.04 | 464221 | kept |
| hungaroring | 5.29 → 1.4 | 1.0073 | 3.09 | 61963 | kept |
| zandvoort | 2.67 → 1.64 | 0.9935 | 5.57 | 332549 | kept |
| daytona | 5.2 → 1.86 | 0.9989 | 3.72 | 28682 |  |
| sebring | 2.58 → 1.96 | 1.0063 | 6.86 | 65242 | kept |
| interlagos | 17.12 → 1.99 | 0.9997 | None | – |  |
| portimao | 4.77 → 2.03 | 1.014 | 6.21 | 42057 | kept |
| montreal | 8.32 → 2.09 | 0.9774 | 32.66 | 463263 |  |
| vir | 7.38 → 2.09 | 0.9986 | None | – |  |
| road-america | 22.51 → 2.24 | 1.0047 | 0.44 | 16346 |  |
| misano | 14.79 → 2.26 | 0.9932 | 6.17 | 349750 |  |
| okayama | 3.58 → 2.38 | 1.007 | 3.45 | 75849 |  |
| phillip-island | 11.8 → 2.43 | 0.9958 | 3.9 | 22624 |  |
| sonoma | 3.45 → 2.5 | 1.0038 | 18.73 | 134424 |  |
| watkins-glen | 3.48 → 2.86 | 1.0077 | None | – |  |
| imola | 10.55 → 3.15 | 1.004 | None | – |  |
| mugello | 15.57 → 3.72 | 0.9831 | 12.58 | 69975 |  |

- Left out: Montreal (fits 2.1 m but at scale 0.977 and drifts 33 m: the layout differs), Mugello and Sonoma ("nascarlong", 18.7 m
  drift), Misano, Okayama, Phillip Island, Road America (2.2–2.4 m), Daytona (28.7k samples), Interlagos, VIR, Watkins Glen and
  Imola (formula cars only), Bathurst and Brands Hatch (no OSM seed).

## Finish lines from official briefings (task 8, 2026-11-18)

Three of the 11 pit-straight estimates now have a sourced line (`sf-lines.json`), placed on Esri World Imagery:
- Jerez: the timing (finish) line "in front of the race tower" (GT4 Winter Series Jerez 2024 briefing; start and finish are not
  the same), a full-width painted line at the round tower (z20). Start moved +140 m.
- Magny-Cours: the finish line just after T17, start line 186 m after it (SRO GT4 France briefing map), a chequered strip at the
  west end of the pit garages (z19). Start moved −345 m.
- Ricardo Tormo: "START/FINISH LINE – LIGHTS" (Valencia 2026 drivers' briefing), the start-light gantry (z19). Start moved −255 m.
Moved with the line (same rule as earlier finish-line changes): corner names and numbers, pit-lane entry/exit, map-shape
corrections and wall gaps (rotated), the Valencia step repair (3400 → 3655 m), F1/FE zone estimates and the PU estimate
(rebuilt). Still estimated: Estoril (grid boxes on both sides of every painted line), Mandalika (TSL map: pit entry 176.3 m before
the line, pit exit 356.4 m after; only z18 imagery), Lime Rock, Yongin, and Buriram, Zhuhai, Inje, Autopolis (no geographic frame yet).

## Kerb use on 25 tracks: two more whole-lap fits and fitting only the parts that match (2026-11-21, session C)

Input: the owner's packed extract (`results/kerb_extract/packed`, `PACKED=` in `kerb_use.py`, same filtered rows as before; raw files
stay on the PC). Bathurst and Brands Hatch had no OSM seed; the local origin is now the laps' mean (the fit starts from many poses,
so the origin only has to be near the track). New option `SEGMENTS=1`: after the whole-lap fit, each ~400 m piece of our line gets a
small rigid fit (from ±150 m around it) and is used only if it then lies within 2.2 m (median) of the laps and moved ≤ 8 m and ≤ 3°.
Elsewhere on that lap there is no kerb data. Same gates on what is kept (fit median ≤ 2.2 m, drift p95 ≤ 8 m, ≥ 30k samples).
Check on two tracks already kept: pieces vs the stored whole-lap values differ by p95 0.5 m (Fuji) and 0.9 m (Zolder; whole-lap rerun
vs stored 0.8 m). Lap times cannot move: only the map (`lineData`) reads `kerb-use-data.js`.

| Track | Whole-lap fit (m) | Pieces fit (m) | Lap kept | Drift p95 (m) | Samples | |
|---|---|---|---|---|---|---|
| brands-hatch | 0.87 | – | 100 % | 3.06 | 229,769 | kept (whole lap) |
| bathurst | 1.37 | – | 100 % | 6.67 | 78,575 | kept (whole lap) |
| misano | 2.26 | 0.85 | 71 % | 2.19 | 216,667 | kept (pieces) |
| okayama | 2.38 | 0.53 | 56 % | 2.08 | 41,164 | kept (pieces) |
| mugello | 3.72 | 1.73 | 61 % | 4.76 | 37,354 | kept (pieces) |
| montreal | 2.09 | 0.42 | 81 % | 8.07 | 363,072 | ✗ drift |
| sonoma | 2.50 | 1.24 | 56 % | 10.95 | 98,489 | ✗ drift ("nascarlong") |
| daytona | 1.86 | 1.35 | 93 % | 1.56 | 25,523 | ✗ samples |
| phillip-island | 2.43 | 1.45 | 82 % | 2.65 | 19,637 | ✗ samples |
| road-america | 2.24 | 1.20 | 63 % | 0.88 | 12,851 | ✗ samples |

Interlagos, Imola, VIR and Watkins Glen have only formula-car laps in the pack (no closed-wheel group). Old vs new edges with the laps
were checked on plots (Misano, Mugello, Bathurst; sent to the owner, not committed).

## Montreal kept by dropping drifting pieces (2026-11-22, iRacing analysis session)

New piece rule `PIECE_DRIFT=1` (with `SEGMENTS=1`): a ~400 m piece is also dropped where the closed-wheel laps sit more than 8 m off our
line (p95 of the smoothed lap offset over the piece). The start pieces at Montreal matched the wrong part of the laps (fit 0.4 m, laps
11 m to one side). The track then needs at least half the lap kept. Misano rerun: unchanged (71 % kept, drift 2.19 m).

| Track | Pieces fit (m) | Lap kept | Drift p95 (m) | Samples kept | |
|---|---|---|---|---|---|
| montreal | 0.42 | 63 % (was 81 %) | 3.39 (was 8.07) | 226,694 | kept (pieces) |
| sonoma | 1.24 | 44 % | 1.65 | 79,350 | ✗ under half the lap ("nascarlong" layout) |

Note: rerunning a track that is already in `kerb-use-data.js` reads `lineData` edges that already include its `wl/wr`, so its
width values come out smaller (Misano wl differs at 120 points); remove the track's entry before a refit.
