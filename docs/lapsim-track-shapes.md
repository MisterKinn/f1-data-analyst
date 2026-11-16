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

## Better source lines? (owner 2026-11-16: "find the best source line for every track, fit to measured data")

- Sources: F1 car positions (26 F1 tracks; measured driven line, kept), OpenStreetMap at full node resolution (the current line of
  the other tracks), and track-atlas midlines checked against aerial imagery (16 of them overlap).
- Gates before a test: lap length within 0.5 % of the official figure, same race direction, a measured start/finish point.
  Watkins Glen, Lime Rock, Sebring and Paul Ricard failed (another layout or length); 11 tracks were rebuilt from the atlas line.
- Gate after: simulated laps against the real laps of each track (unseen check, no fit). Result, RMS error % old → atlas:
  Mugello 1.56 → 1.52, Fuji 1.23 → 1.70, VIR 2.04 → 3.17, Road Atlanta 2.95 → 4.37, Le Mans 2.77 → 4.76, Long Beach 1.18 → 6.42,
  Mosport 1.74 → 8.52, Laguna Seca 2.72 → 8.62, Road America 2.78 → 9.00, Indianapolis 3.43 → 13.36, Portimão 3.41 → 26.42.
  The atlas lines carry more small wiggles (Le Mans: 3,476° of total turning against 1,897°), so every lap reads slower.
  Mugello's gain is inside the noise (one real lap). Decision: keep every current line; nothing the simulator reads changed.
- The Ford chicanes: the current line already has them (radii 16–37 m, atlas 18–39 m); the live map showed them blunt only because it
  drew one point every 38 m. With a point every 5 m they show.
