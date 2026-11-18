# Walls and barriers (owner 2026-11-18)

"Model the walls of every circuit, above all street circuits (Monaco, Singapore, Las Vegas, Long Beach) and close-wall tracks
(Bathurst), and Daytona, Indianapolis, Watkins Glen."

- Source: OpenStreetMap barrier ways around each circuit (`barrier=wall, retaining_wall, jersey_barrier, concrete_barrier, block`
  → wall; `guard_rail, crash_barrier, cable_barrier` → armco; `tyres`; `fence` only within 4 m of the edge, a catch fence).
  © OpenStreetMap contributors, ODbL. Fetched on the owner's PC (Overpass, OSM API map call); raw files are not in git.
- Builder: `python3 scripts/sim/tracks/walls-osm.py <walls dir> <poses.json> [ids]` → `worker/lapsim/walls-data.js`.
  Poses: the pit-lane fit (`POSE_OUT` of `pit-lanes-osm.py`); else ICP of our drawn line onto the OSM raceways (mirrored lines
  allowed); else onto the named circuit roads (`roads/<id>.json`: Melbourne — Lakeside Drive, Aughtie Drive); else the geo line of
  an extra track (Macau, Detroit, Long Beach).
- Per point of the drawn line (every 2nd): gap from the track edge to the nearest barrier, left and right (m, null = none within 40 m),
  and its kind. Barriers on the road itself (bridges, crossing rails) are left out.
- Street circuits (Monaco, Singapore, Las Vegas, Baku, Jeddah, Long Beach, Detroit, Macau, Miami, Madring): where OSM maps no
  barrier within 15 m, the wall is set at the road edge (0.5 m, kind `street`). This is a rule (model), not a measurement; escape
  roads there are not known. Melbourne is a park circuit with gravel traps: OSM barriers only.
- Not drawn on the map (owner 2026-11-18, later: "use the walls only for the lap telemetry model, do not draw them"). The page
  sends per lap point 0–10 = 10 · max(0, 1 − gap / 3 m); `lapChannels` adds 0.025 × that to the risk (up to 0.25), so the
  driver's steering corrections, brake ripple and throttle lifts grow beside a wall. Model; the lap time is unchanged (below).
- 66 circuits (all 88 fetched 2026-11-18). No barrier mapped in OSM near the track: Autopolis, Catalunya, Dubai, Fuji, Istanbul,
  Kyalami, Mandalika, Motegi, Mugello, Shanghai, Zhuhai, Zolder, FE Shanghai. No fit of our line: Paul Ricard, Sochi, FE London, FE Tokyo.

## Lap time (owner 2026-11-18: "the walls and the elevation must change the predicted lap time")

- Elevation is in the lap time already: the kernel takes the grade at every point (gravity along the slope; Macau −0.05 s,
  Spa −0.28 s, Bathurst +0.26 s against a flat track, F1 2026 car). Crest and dip load (vertical curvature, `LAPSIM_KV`) was
  tested on 2026-11-09 (§5.3 of lapsim-handoff-physics.md): F1 held-out 0.90 → 0.89 % (2025), WEC pooled 1.35 → 1.51 % — not adopted.
- Wall margin, tested on real pole laps (`node scripts/sim/wall-margin-fit.mjs <pole traces>`, OpenF1 car data of the 72 calibration
  poles 2023–2026; 41 laps on tracks with wall data, 382 corner minima). Model: grip used = 1 − c · closeness, closeness =
  max(0, 1 − gap / G) averaged over ±R m; ln(v_real / v_sim) per corner with one offset per lap and the sim speed as a control.
  Result: c = −0.10 ± 0.07 (G 5 m, R 25 m); no G or R gives a positive c beyond its standard error. Pole laps use the road up to
  the wall; the geometry of the real driving line already carries the walls. A wall term would make the lap time worse, so the
  F1 lap time has none. Residual per corner 13.5 % (the corner-speed bias B1 dominates); refit when B1 is fixed and for
  non-pole drivers (B2 driver ratings).
