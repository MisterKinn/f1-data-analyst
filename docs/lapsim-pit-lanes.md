# Pit lanes on the track maps (task A5, part 1)

Owner 2026-11-16: "add the pit lane on every track". Drawing and pit-lane length only; lap times are unchanged.

- Source: OpenStreetMap ways around each circuit (highway=raceway; ways named or tagged pit / box), fetched in GitHub Actions
  (branch `probe/osm-pits`, runs 43863550462 and 43887737464, 102 of 103 seeds; © OpenStreetMap contributors, ODbL).
- Builder: `python3 scripts/sim/tracks/pit-lanes-osm.py <probe-out/pits>` → `worker/lapsim/pit-lane-data.js`. Our drawn
  midline is fitted (rigid, trimmed ICP) onto the raceway ways; the start pose comes from the whole-area search in
  `scripts/sim/data/tracks/osm-fit-start.json` (see lapsim-track-shapes.md). Pit ways are chained into one path, moved into
  our map frame, and kept when both ends meet the lap within 35 m and the length is 150–2500 m. Entry and exit are lap
  distances (m).
- Map: `renderMap` draws `.ls-pit` under the track band (grey, about the real width).
- Result 2026-11-17: 66 tracks have a pit lane (all spot-checked F1 maps look right: Bahrain, Monza, Silverstone, Spa, Suzuka,
  Interlagos, Zandvoort, Jeddah, Yas Marina, Barcelona, COTA, Mexico City, Spielberg, Hungaroring, Imola, Montréal).
- Missing, and why:
  - street circuits with no raceway ways in OSM to fit on, or only part of the lap: Baku, Las Vegas, Monaco, Singapore,
    Le Mans, Madring, Detroit, Bathurst, Road America, Sebring (fit median 6.4 m > 6), FE Mexico (both), FE London;
  - no pit way in OSM: Melbourne, Shanghai, Sochi, Paul Ricard (both), Misano, Autopolis, Buriram, Long Beach and the other
    FE street tracks;
  - pit ways that do not join the lap at both ends: Kyalami, Lausitz.
  These need another source (official circuit maps) and stay without a pit lane until then.
- Test: tests/lapsim-pit-lanes.test.mjs.
