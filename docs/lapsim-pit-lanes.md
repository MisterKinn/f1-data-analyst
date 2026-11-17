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

# Pit speed limits and pit loss (task A5, part 2)

- Limits (`worker/lapsim/pit-speed-data.js`, evidence layer 1): F1 80 km/h (Sporting Regulations B1.6.3 a); the Race Director may set
  another limit for an event), WEC 60 km/h (art. 12.1.4), IMSA 60 km/h (2025–26 driver briefings). Per-event values go in `tracks`
  only from the event's Race Director notes; none are recorded yet.
- Page: the map note now reads "Pit lane {m} m (OpenStreetMap), speed limit {v} km/h ({source}), measured pit loss {l} s (F1 race
  median)" for the selected series. The pit loss shown is always the measured one (race-data.js); nothing is simulated.
- Experiment (declared 2026-11-17 06:00, `scripts/sim/pit-loss-fit.mjs`): can the pit path predict the measured F1 pit loss?
  Rows: 21 F1 tracks with both a pit lane and a measured loss. Every number is leave one track out.

  | Variant | Left-out rms |
  |---|---|
  | Baseline: median of the other tracks' measured loss | 3.58 s |
  | A: whole OSM path at the limit + constant C | 6.68 s |
  | B: limit only on a middle zone of Z m (Z, C fitted on the other tracks), path bends elsewhere | 3.37 s |

  B vs baseline: paired gain 1.42 ± 2.41 s² (1 SE), within noise → **rejected** (rerun 2026-11-17 with the F1 pit lane at Spa). A fails because the OSM path includes entry and
  exit roads where the limit does not apply (Hungaroring 1067 m; Spa used the 1201 m Endurance lane before the rerun). The "60 km/h?" hint from these residuals is not
  reliable either, so no per-event limit was inferred from it.
- Next source: every F1 event publishes "Competition Notes – Circuit Map, Pit Lane Drawing and Emergency Exits Map" (FIA documents,
  e.g. 2026 Dutch GP doc 6). It gives the speed-limit lines and the missing pit lanes; it is also the source for A2 part 2.

## Two pit lanes: Spa and Silverstone (owner 2026-11-17)

- Spa-Francorchamps: F1 and WEC use the F1 pits (Bus Stop to La Source: entry 6707 m, exit 512 m, 719 m). Le Mans Cup and the
  support series use the Endurance pits (after La Source to Kemmel: entry 416 m, exit 1625 m, 1201 m); the Spa 24 Hours uses both.
  Until now the map showed the Endurance pits for every series.
- Silverstone: F1 uses the Wing pits (Club to Abbey: entry 5202 m, exit 672 m, 1127 m); most other series use the National pits
  (Woodcote to Copse: entry 2289 m, exit 3329 m, 1007 m).
- Data: `pit-lane-data.js` keeps the F1 lane as the track's lane and adds `alt` {name, mainName, use, note} with the series that
  take the other lane (`alt`) or both (`both`): Spa {gt3: both}, Silverstone {wec: alt, gt3: alt}. The page draws the lanes of the
  selected series and names them in the map note. Le Mans, Nürburgring, Daytona and Indianapolis share one pit lane.
- Input: probe/osm-pits-all (every non-FE track) plus probe/osm-pits-fe. Against the older probe this also adds Brands Hatch
  (560 m) and moves Kuala Lumpur's lane (991 → 1012 m); Hockenheim and Monza only gain path detail.
