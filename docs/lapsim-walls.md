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
- The map draws the barrier lines (grey; armco lighter, tyres darker, catch fence dashed) and the street rule 0.6 m outside the edge.
- Not yet: Paul Ricard and Sochi (our line does not fit the OSM raceways within 3 m), Formula E London; circuits still being
  fetched are added in the next run. The lap time does not use the walls yet.
