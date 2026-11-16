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
