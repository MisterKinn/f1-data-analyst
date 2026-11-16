# Lap simulator: learning from every lap of every car (2026-11-14)

Read this before any work that adds lap data, a track or a car to the lap simulator. It sits next to `docs/lapsim-physics-rules.md`
(the physics rules still apply). Sections 1 and 2 are standing rules from the owner. Section 3 is the declaration written before
the first run. Sections 4 and 5 are results. Section 6 is the source list: add a source there when you use a new one.

## 1. Owner rules (2026-11-14)

1. **Use every source, every lap, every car.** Not the pole lap only and not the class-best only. The list in section 6 is the minimum.
2. **Learn per car type.** F1, LMH, LMDh, Formula E and GT3 are separate. F1, LMH and LMDh are *shown* per regulation (class-best lap).
   GT3 is *shown* per car model, and a base model and its Evo kit are two cars (base model + Evo tick box on the page).
3. **Know which track a lap was driven on.** Every lap goes through `resolveTrack()` (`scripts/sim/learn/track-registry.mjs`) before use.
   One id per *layout*, never per venue. A lap is never learned on the geometry of another layout. A venue or a layout the registry
   does not know is reported and added, never guessed. (Before this rule, F1 sessions at the Nürburgring and at Hockenheim were not
   recognised, and Le Mans and Fuji laps were not used for the WEC cars.)
4. **Adding a track later must be easy.** New track = one geometry entry + one registry rebuild. The laps of that layout are already
   in the tables and are picked up by the next learning run.
5. **Reduce the error, and report it per class and per track**, always on rows the fit did not see.
6. **Publish unless the error is really bad.** A track gets ⚠️ when it is not built yet (Rwanda), has no real lap to check, or its
   error with one event hidden is above 3 % in any class (`trackWarn()` in `worker/simulator-controls.js`).
9. **A car + track combination that really ran shows its fastest real lap, exactly (0.000 %), as F1 does.** In every category:
   F1 (that season's car: its pole), LMH, LMDh, LMGT3 (class-best of any season), each GT3 car model and Evo kit (its own fastest
   lap, e.g. Road Atlanta + Huracan GT3), Formula E (Gen3, Gen3 Evo, and Gen4 once it has raced), every series (WEC, IMSA, ELMS,
   Asian LMS, GT World Challenge, …). Fastest = over every season and every dry session in the data (qualifying, practice, test, race);
   the page names the session it comes from. The conditions shown are the conditions of that session, so the lap is exact.
   The **fastest real race lap** of that car on that track is shown too (F1: that season's race, from f1db; endurance: Al Kamel).
   Code: `carsFor()` and `realConditions()` and `raceRecords()` in `worker/lapsim/scenario.js`, records from
   `scripts/sim/learn/fit-endurance.mjs` (`real`, `classReal`, `raceReal`) and `scripts/sim/learn/f1-race-records.mjs`.
   Test: `tests/lapsim-learn.test.mjs` checks every combination on the page and in the tool. A new source or a new car must keep it green.
7. Data with a different structure is converted to the one table shape of section 2. Outside programs (MATLAB, Python tools of the
   M17 power-unit project) may be used when they help; an unfinished or inaccurate tool must never make a working feature worse.
8. Use the engineering skills and the Karpathy guidelines for this work: goal and pass check first, smallest change, verify.
10. **GT3 per BoP body (owner 2026-11-15).** SRO GT3 (no torque sensor; GT World Challenge in every region, IGTC, British GT,
   Nürburgring, Macau) is the basic GT3 and comes first in the list with the plain key `gt3-<model>`. The other bodies are
   `gt3-imsa-<model>` (IMSA GTD), `gt3-aco-<model>` (WEC LMGT3, ELMS, Asian LMS) and `gt3-dtm-<model>` (DTM, records only).
   SRO measured records (Brands Hatch, Silverstone, Spa, Monza, Nürburgring GP and 24h, Suzuka, Fuji, Shanghai, Jeddah, …) are
   reproduced exactly from the official SRO results sites.
11. **Hypercar/GTP class cars show the fastest WEC or IMSA lap (owner 2026-11-15; replaces "WEC records first").** `wec-lmh`,
   `wec-lmdh` and `wec-lmgt3` show the fastest lap of WEC and IMSA together on the track. The learning step builds them
   (`fit-endurance.mjs`: `classReal` and `raceReal` take the faster of the `|s:wec` and `|s:imsa` records) and `carsFor()` and
   `raceRecords()` read them from `learned-data.js`. Sebring LMDh: IMSA 2023 1:45.836 instead of
   WEC 2023 1:46.082. A lap of another series fills only an empty slot. The simulator has no IMSA tab; the WEC tab is "Hypercar/GTP".
12. **A car with an Evo or Evo 2 kit opens on its newest kit** (Evo box ticked; `evo=0` in the URL for the base car).
13. **GT3 page controls and tyres (owner 2026-11-15).** GT3: choose the car model first, then the series spec (SRO GT3, IMSA GTD,
   WEC LMGT3, DTM), then the kit. The WEC series lists only LMH and LMDh; LMGT3 is a GT3 model with the WEC LMGT3 spec.
   Tyre supplier follows the spec: SRO GT World Challenge and DTM Pirelli, IMSA GTD Michelin, WEC / ELMS / Asian LMS LMGT3 Goodyear;
   Formula E Gen2 Michelin, Gen3 and Gen3 Evo Hankook, Gen4 Bridgestone.
14. **Every measured lap.** Every GT3 model that raced is listed, older generations too (SLS, R8 LMS ultra, 991, V12 Vantage, M6,
   458, 650S, 12C, GT-R, Continental, Z4, first Huracán GT3 ...); the SRO official tables are read from 2013 on.

## 2. Data shape and pipeline

| Step | Code | Output |
|---|---|---|
| Track identity | `scripts/sim/learn/track-registry.mjs` | `scripts/sim/data/track-registry.json`: 104 venues, 182 layouts, 52 with simulator geometry; `near` = same venue within 2 % of the length |
| Car-model identity | `scripts/sim/learn/models.mjs` | `modelOf(vehicle text, season, class)` → base model, Evo kit, generation. No text = no model |
| Endurance cars (shell) | `scripts/sim/learn/build-endurance.mjs <clone of tobi/imsa_data>` | `scripts/sim/data/learn/endurance-cars.csv.gz`: one row per car and session (46,616 rows, 2021–2026) |
| Formula E cars (Actions) | `scripts/sim/learn/fetch-fe.mjs`, workflow `lapsim-learn.yml` (push to `lapsim-learn/**`) | `scripts/sim/data/learn/fe-cars.csv`, `fe-files.json` |
| Learning | `scripts/sim/learn/fit-endurance.mjs` | `scripts/sim/data/learn/endurance-fit.json` (every number of sections 4–5) and `worker/lapsim/learned-data.js` (what the page and the tool read) |
| Tests | `tests/lapsim-learn.test.mjs` | identity cases, closed map outlines, builder, fit, wiring, raced sessions still reproduce |

One row per car and session: series, season, event, session, type (Q/P/R), class, entry, vehicle, manufacturer, team, tyres, best clean
lap with its sectors, ideal lap, top speed, lap length measured from the timing (KPH × lap time), lap counts, median clean lap, air and
track temperature, humidity, pressure, rain share. Clean lap = timed, not in or out of the pit lane, green flag at the line, sectors add up.
Raw laps stay out of git (physics rule 2.9); the car table is a derived table.

Data problems found and handled (data first, physics second):

| Problem | Handling |
|---|---|
| Weather units are mixed in the archive (°C, °F, and °F converted twice: Le Mans 2026 stored 152.8) | Unit by plausibility (`wx()`), tested |
| Wet or disrupted qualifying with no rain mark (WEC Austin 2025, IMSA Road Atlanta 2023, Road America 2021 LMP2, ELMS Spa and Silverstone 2025, Asian LMS Sepang 2025-26) | The whole class is more than 4 % slower than predicted from every other event: listed in `slowSessions`, not fitted, not scored |
| IMSA 2021 track temperatures are not usable | Dropped (air temperature kept) |
| The same layout stated a few metres differently by different feeds (Spielberg 4.318 / 4.326 km) | One layout within 0.35 % unless f1db lists two layouts (Barcelona 4.655 / 4.657 / 4.675 km) |
| Map outline of tracks built from F1 positions was drawn open (Paul Ricard 153 m, Nürburgring GP 106 m, Sakhir Outer 31 m) | Outline closed in `build-geometry-extra.mjs`; the lap itself was not affected |
| OpenStreetMap candidates of Paul Ricard are broken (3,800° of turning, 30 % too slow) | Not used. The ELMS layouts learn on the F1 line as a neighbour (`near`), each with its own track term |
| The 2025 and 2026 class cars differ by several percent on one track | Learning always uses the latest class car (the one the page shows); season level goes to `S` |

## 3. Declaration (written before the first run)

Rows: best dry qualifying lap of every car model at every event, classes Hypercar/GTP (LMH and LMDh by manufacturer, 2023 on),
GT3 (GTD, GTD Pro, LMGT3, Asian LMS GT), and LMP2 (Oreca 07, kept only as a probe of the track terms). Model, on a log scale:

`log(real) = log(simulated lap of the latest class car, event weather, no track factor) + S + T + TG + M + MB + MY + B·z`

| Term | Meaning | Ridge width |
|---|---|---|
| S | class level per series and season | 10 % |
| T | layout | 5 % |
| TG | layout × (prototype or GT) | 1.5 % |
| M | car model | 1.5 % |
| MB | car model × BoP body (IMSA, or ACO: WEC, ELMS, Asian LMS) | 1 % |
| MY | car model × body × season | 0.7 % |
| B·z | car model × how fast the layout is (shape) | 1 % |

Noise scale 0.5 %, Huber weight beyond 2 scales. The widths were fixed before the run and not tuned; half and double widths are
reported as sensitivity only. Tests, all on rows the fit did not see: **event hidden** (the track term comes from other events),
**layout hidden** (track-unseen), **car model hidden**. "Before" = what the page showed for a car with no real lap at that track
(class car of the row's season with the production track factor; part of it is in-sample for WEC 2025–2026, which favours "before").
Pass check: held-out error lower than before in every class, raced sessions still reproduce at 0.000 %, F1 unchanged.
This layer does not change the physics model or `calibration-data.js`. BoP is not fitted: it is inside MB and MY.

## 4. Result per class (RMS error, %)

### Refit 2026-11-15 evening (model terms of section 12, fixed track geometry #204/#206/#209)

Event hidden, class-best, RMS %. Before = main after #206 (same fixed geometry, old model).

| Class | Events | Before | **After** | Layout hidden | In-sample |
|---|---|---|---|---|---|
| LMH | 41 | 0.95 | **0.82** | 2.43 | 0.56 |
| LMDh | 59 | 1.01 | **0.73** | 2.35 | 0.46 |
| GT3 | 278 | 1.14 | **0.96** | 2.57 | 0.61 |

Still worse than before by more than 0.1 point: gt3 at lime-rock 0.62 → 0.89, lmdh at mosport 0.29 → 0.95, lmh at indianapolis 0.26 → 0.46, gt3 at paul-ricard-2021 1.12 → 1.74, gt3 at hungaroring 0.56 → 0.77, gt3 at motegi 1.24 → 1.4, gt3 at phillip-island 1.83 → 1.99; Jeddah GT3 (one event) 1.14. To be fixed after the track-shape check (section 12).

### Refit 2026-11-15 (Long Beach and Detroit learned; class records in the learning step)

2611 model rows, 323 events, 56 layouts. Event hidden, class-best, RMS %.

| Class | Events before → after | Before (main, 2026-11-15) | **After** | Layout hidden | In-sample |
|---|---|---|---|---|---|
| LMH | 37 → 41 | 0.87 | **0.94** | 3.12 | 0.61 |
| LMDh | 52 → 59 | 1.02 | **1** | 3.3 | 0.64 |
| GT3 | 272 → 282 | 1.14 | **1.15** | 3.65 | 0.71 |

LMH rose from 0.87 to 0.94, most likely because the new IMSA street events (Aston Martin Valkyrie only at Long Beach and Detroit) move the shared IMSA LMH terms, so Daytona LMH (0.55 → 1.11), Laguna Seca LMH (1.53 → 1.95) and Road America LMH (0.75 → 0.93) got worse. Other tracks that rose by more than 0.1: Laguna Seca GT3 2.11 → 2.37, Mugello GT3 1.74 → 1.88, Jeddah GT3 3.97 → 4.13 (one event, still ⚠️), Mosport LMDh 0.13 → 0.32. The lap-level fix still reproduces every real lap exactly.

Older result (2026-11-14) below.

1311 model rows, 152 events, 33 layouts, 44 car models. Generated 2026-11-14.

| Class | Events | Before, class-best | **Event hidden, class-best** | Before, per model | **Event hidden, per model** | Car model hidden | Layout hidden (track-unseen) | In-sample |
|---|---|---|---|---|---|---|---|---|
| LMH | 34 | 2.14 | **0.82** | 2.23 | **0.92** | 1.57 | 3.03 | 0.52 |
| LMDh | 47 | 2.7 | **0.98** | 2.86 | **1.05** | 0.88 | 3.67 | 0.57 |
| GT3 | 113 | 2.89 | **1.19** | 3.04 | **1.35** | 0.95 | 3.27 | 0.63 |

By series (event hidden, class-best; before → after):

| Class and series | Events | Before | After |
|---|---|---|---|
| GT3 Asian LMS | 6 | 2.03 | 2.06 |
| GT3 ELMS | 11 | 2.43 | 1.14 |
| GT3 GTWC (Timing71) | 4 | 1.61 | 1.6 |
| GT3 IGTC | 5 | 1.26 | 1.02 |
| GT3 IMSA | 49 | 3.21 | 1.2 |
| GT3 Nürburgring 24h | 6 | 1.93 | 1.6 |
| GT3 WEC | 21 | 1.67 | 0.67 |
| GT3 Spa 24h | 2 | 2.39 | 1.47 |
| GT3 GTWC Europe Endurance 2024 | 2 | 3.87 | 0.23 |
| GT3 GTWC Europe Endurance 2025–26 | 6 | 5.74 | 0.81 |
| GT3 Suzuka 1000 km (IGTC) | 1 | 3.13 | 1.52 |
| LMDh IMSA | 23 | 3.53 | 1.14 |
| LMDh WEC | 24 | 1.52 | 0.79 |
| LMH IMSA | 11 | 3.13 | 0.88 |
| LMH WEC | 23 | 1.44 | 0.79 |

Sensitivity (event hidden, class-best): {half: {gt3: {models: 925, eventOut: 1.34, events: 113, eventOutClass: 1.19}, lmp2: {models: 92, eventOut: 1.62, events: 92, eventOutClass: 1.62}, lmdh: {models: 190, eventOut: 1.03, events: 47, eventOutClass: 0.97}, lmh: {models: 104, eventOut: 0.85, events: 34, eventOutClass: 0.82}}, double: {gt3: {models: 925, eventOut: 1.36, events: 113, eventOutClass: 1.19}, lmp2: {models: 92, eventOut: 1.61, events: 92, eventOutClass: 1.61}, lmdh: {models: 190, eventOut: 1.05, events: 47, eventOutClass: 0.98}, lmh: {models: 104, eventOut: 0.96, events: 34, eventOutClass: 0.82}}}

Reading: with the event hidden the class-best error is about one percent in every class, less than half of before. GT3 rose from
1.08 (2026-11-14, 85 events) to 1.19 because the Timing71 SRO, IGTC and Nürburgring 24h events were added: the Nordschleife (8 to
9 minute laps, traffic) is the hardest. Of the earlier series, IMSA (1.20) and WEC (0.73 → 0.67) held, while ELMS (0.98 → 1.14)
and Asian LMS (1.18 → 2.06) got worse: they now share the ACO body term with more rows. Open item (section 7). A track that has
no lap of any endurance series stays at the old level (layout hidden: about 3 %): on such a track the page keeps the production
calibration and does not use this layer. LMP2 is not shown on the page.

## 5. Result per class and track (class-best, RMS %, event hidden)

### Refit 2026-11-15 (every layout, event hidden, class-best, RMS %)

| Track (layout) | Class | Events | Before | After |
|---|---|---|---|---|
| austin | GT3 | 3 | 1.15 | 1.18 |
| austin | LMDh | 1 | 1.27 | 1.24 |
| austin | LMH | 1 | 1.15 | 1.14 |
| bathurst | GT3 | 10 | 1.65 | 1.63 |
| brands-hatch | GT3 | 19 | 0.98 | 0.96 |
| buriram | GT3 | 6 | 1.59 | 1.56 |
| catalunya | GT3 | 5 | 0.58 | 0.59 |
| catalunya-4655 | GT3 | 5 | 1.3 | 1.3 |
| catalunya-4675 | GT3 | 2 | 0.42 | 0.43 |
| daytona | GT3 | 6 | 0.85 | 0.64 |
| daytona | LMDh | 4 | 1.21 | 1.22 |
| daytona | LMH | 1 | 0.55 | 1.11 |
| detroit | GT3 | 3 | not learned | 1.93 |
| detroit | LMDh | 3 | not learned | 1.06 |
| detroit | LMH | 2 | not learned | 1.57 |
| donington | GT3 | 13 | 1.42 | 1.43 |
| dubai | GT3 | 5 | 0.68 | 0.67 |
| fe-valencia | GT3 | 4 | 0.69 | 0.69 |
| fuji | GT3 | 5 | 1 | 0.99 |
| fuji | LMDh | 3 | 0.32 | 0.32 |
| fuji | LMH | 3 | 0.46 | 0.46 |
| hungaroring | GT3 | 4 | 0.56 | 0.55 |
| imola | GT3 | 6 | 0.83 | 0.86 |
| imola | LMDh | 3 | 0.62 | 0.6 |
| imola | LMH | 3 | 1.21 | 1.2 |
| indianapolis | GT3 | 5 | 1.03 | 0.9 |
| indianapolis | LMDh | 4 | 0.53 | 0.37 |
| indianapolis | LMH | 2 | 0.56 | 0.26 |
| interlagos | GT3 | 3 | 0.44 | 0.41 |
| interlagos | LMDh | 3 | 0.3 | 0.29 |
| interlagos | LMH | 2 | 0.66 | 0.65 |
| jeddah | GT3 | 1 | 3.97 | 4.13 |
| kuala-lumpur | GT3 | 2 | 0.59 | 0.59 |
| laguna-seca | GT3 | 6 | 2.11 | 2.37 |
| laguna-seca | LMDh | 4 | 2.19 | 2.22 |
| laguna-seca | LMH | 2 | 1.53 | 1.95 |
| le-mans | GT3 | 3 | 0.59 | 0.55 |
| le-mans | LMDh | 4 | 0.31 | 0.3 |
| le-mans | LMH | 4 | 0.33 | 0.33 |
| lime-rock | GT3 | 3 | 0.71 | 0.62 |
| long-beach | GT3 | 6 | not learned | 0.84 |
| long-beach | LMDh | 4 | not learned | 1.06 |
| long-beach | LMH | 2 | not learned | 0.75 |
| lusail | GT3 | 2 | 0.76 | 0.72 |
| lusail | LMDh | 2 | 0.86 | 0.87 |
| lusail | LMH | 2 | 0.98 | 0.99 |
| magny-cours | GT3 | 1 | 1.35 | 1.31 |
| mandalika | GT3 | 2 | 0.22 | 0.27 |
| mid-ohio | GT3 | 2 | 1.52 | 1.6 |
| misano | GT3 | 11 | 0.86 | 0.81 |
| monza | GT3 | 11 | 1.08 | 1.03 |
| monza | LMDh | 1 | 1 | 0.98 |
| monza | LMH | 1 | 0.83 | 0.81 |
| mosport | GT3 | 5 | 0.69 | 0.68 |
| mosport | LMDh | 1 | 0.13 | 0.32 |
| motegi | GT3 | 1 | 1.4 | 1.27 |
| mugello | GT3 | 1 | 1.74 | 1.88 |
| nurburgring-24h | GT3 | 6 | 1.31 | 1.34 |
| nurburgring-gp | GT3 | 2 | 0.58 | 0.56 |
| oulton-park | GT3 | 12 | 0.64 | 0.65 |
| paul-ricard-2021 | GT3 | 1 | 0.67 | 0.49 |
| paul-ricard-5821 | GT3 | 2 | 0.66 | 0.73 |
| phillip-island | GT3 | 3 | 1.81 | 1.82 |
| portimao | GT3 | 2 | 0.66 | 0.64 |
| portimao | LMDh | 1 | 2.11 | 2.05 |
| portimao | LMH | 1 | 0.64 | 0.63 |
| road-america | GT3 | 6 | 1.17 | 1.13 |
| road-america | LMDh | 4 | 0.61 | 0.48 |
| road-america | LMH | 2 | 0.75 | 0.93 |
| road-atlanta | GT3 | 6 | 0.99 | 1.03 |
| road-atlanta | LMDh | 3 | 0.15 | 0.06 |
| road-atlanta | LMH | 2 | 0.4 | 0.5 |
| sakhir | GT3 | 2 | 0.54 | 0.55 |
| sakhir | LMDh | 2 | 0.83 | 0.82 |
| sakhir | LMH | 2 | 0.89 | 0.9 |
| sebring | GT3 | 6 | 0.75 | 0.68 |
| sebring | LMDh | 5 | 1.2 | 1.1 |
| sebring | LMH | 3 | 1.15 | 1.01 |
| shanghai | GT3 | 4 | 2.83 | 2.91 |
| silverstone | GT3 | 12 | 1.06 | 1.07 |
| snetterton | GT3 | 10 | 0.56 | 0.56 |
| sonoma | GT3 | 5 | 1.27 | 1.3 |
| spa-francorchamps | GT3 | 7 | 1.48 | 1.42 |
| spa-francorchamps | LMDh | 4 | 0.93 | 0.92 |
| spa-francorchamps | LMH | 4 | 0.83 | 0.82 |
| suzuka | GT3 | 7 | 0.72 | 0.68 |
| vir | GT3 | 7 | 1.12 | 1.07 |
| watkins-glen | GT3 | 7 | 0.91 | 0.92 |
| watkins-glen | LMDh | 3 | 1.01 | 1.01 |
| watkins-glen | LMH | 2 | 0.94 | 0.71 |
| yas-marina-circuit | GT3 | 5 | 0.75 | 0.75 |
| zandvoort | GT3 | 4 | 1.21 | 1.17 |
| zolder | GT3 | 5 | 0.54 | 0.55 |

Long Beach and Detroit before: not learned (unseen check in section 11: 1.18 % and 3.67 %). Sebring GT3 0.75 → 0.68, LMDh 1.2 → 1.1, LMH 1.15 → 1.01. Aragón has ELMS LMP2 rows only (0.35 → 0.48; LMP2 is not shown). The only layout still listed as "no simulator geometry" is belle-isle-3782 (10 rows).

Older result (2026-11-14) below.

| Track (layout) | Class | Events | Models rows | Before | After |
|---|---|---|---|---|---|
| austin | GT3 | 3 | 18 | 0.52 | 1.33 |
| austin | LMDh | 1 | 5 | 0.23 | 0.82 |
| austin | LMH | 1 | 3 | 0.22 | 0.69 |
| bathurst | GT3 | 3 | 16 | 0.75 | 1.09 |
| catalunya | GT3 | 5 | 27 | 1.21 | 0.6 |
| daytona | GT3 | 6 | 58 | 6.15 | 0.94 |
| daytona | LMDh | 4 | 17 | 7.13 | 0.98 |
| daytona | LMH | 1 | 1 | 9.49 | 0.6 |
| fuji | GT3 | 2 | 18 | 1.44 | 0.08 |
| fuji | LMDh | 3 | 11 | 0.28 | 0.38 |
| fuji | LMH | 3 | 11 | 0.63 | 0.5 |
| imola | GT3 | 6 | 43 | 1.36 | 0.9 |
| imola | LMDh | 3 | 13 | 1.69 | 0.62 |
| imola | LMH | 3 | 12 | 1.5 | 1.21 |
| indianapolis | GT3 | 5 | 45 | 1.43 | 1.16 |
| indianapolis | LMDh | 4 | 18 | 0.61 | 0.89 |
| indianapolis | LMH | 2 | 2 | 1.08 | 0.66 |
| interlagos | GT3 | 3 | 21 | 1.53 | 0.49 |
| interlagos | LMDh | 3 | 10 | 1.07 | 0.3 |
| interlagos | LMH | 2 | 8 | 0.62 | 0.66 |
| kuala-lumpur | GT3 | 2 | 14 | 0.69 | 2.05 |
| laguna-seca | GT3 | 6 | 56 | 3.34 | 1.99 |
| laguna-seca | LMDh | 4 | 16 | 2.71 | 1.93 |
| laguna-seca | LMH | 2 | 2 | 1.85 | 1.27 |
| le-mans | GT3 | 3 | 27 | 3.51 | 0.62 |
| le-mans | LMDh | 4 | 15 | 2.57 | 0.26 |
| le-mans | LMH | 4 | 17 | 2.36 | 0.3 |
| lime-rock | GT3 | 3 | 24 | 2.24 | 0.52 |
| lusail | GT3 | 2 | 18 | 0.73 | 0.77 |
| lusail | LMDh | 2 | 9 | 0.56 | 0.87 |
| lusail | LMH | 2 | 8 | 0.88 | 0.99 |
| mid-ohio | GT3 | 2 | 16 | 0.38 | 1.64 |
| monza | GT3 | 2 | 19 | 1.68 | 0.12 |
| monza | LMDh | 1 | 2 | 2.89 | 1.17 |
| monza | LMH | 1 | 5 | 2.76 | 0.98 |
| mosport | GT3 | 5 | 46 | 0.78 | 0.73 |
| mosport | LMDh | 1 | 4 | 3.16 | 0.02 |
| mugello | GT3 | 1 | 4 | 2.31 | 2.46 |
| nurburgring-24h | GT3 | 6 | 37 | 1.93 | 1.6 |
| nurburgring-gp | GT3 | 2 | 19 | 4.98 | 0.36 |
| paul-ricard-5771 | GT3 | 1 | 4 | 6.69 | 0.58 |
| paul-ricard-5821 | GT3 | 2 | 21 | 9.12 | 0.75 |
| portimao | GT3 | 2 | 10 | 1.31 | 0.68 |
| portimao | LMDh | 1 | 2 | 0.49 | 2.09 |
| portimao | LMH | 1 | 5 | 1.72 | 0.56 |
| road-america | GT3 | 6 | 56 | 3.69 | 1.11 |
| road-america | LMDh | 4 | 16 | 2.74 | 0.86 |
| road-america | LMH | 2 | 2 | 1.52 | 0.58 |
| road-atlanta | GT3 | 6 | 57 | 2.45 | 0.99 |
| road-atlanta | LMDh | 3 | 14 | 0.67 | 0.31 |
| road-atlanta | LMH | 2 | 2 | 0.57 | 0.41 |
| sakhir | GT3 | 2 | 18 | 1.1 | 0.63 |
| sakhir | LMDh | 2 | 9 | 0.25 | 0.83 |
| sakhir | LMH | 2 | 7 | 0.5 | 0.9 |
| spa-francorchamps | GT3 | 7 | 60 | 1.52 | 1.34 |
| spa-francorchamps | LMDh | 4 | 15 | 1.34 | 0.96 |
| spa-francorchamps | LMH | 4 | 17 | 0.97 | 0.83 |
| suzuka | GT3 | 2 | 15 | 2.92 | 1.32 |
| vir | GT3 | 7 | 64 | 1.16 | 1.24 |
| watkins-glen | GT3 | 7 | 67 | 3.03 | 0.98 |
| watkins-glen | LMDh | 3 | 14 | 1.96 | 1.25 |
| watkins-glen | LMH | 2 | 2 | 1.26 | 1.21 |
| yas-marina-circuit | GT3 | 4 | 27 | 2.44 | 2.07 |

A layout with one event has the layout term hidden too in this test, so its number is a track-unseen number.

Sessions listed as wet or disrupted (not fitted, not scored): imsa|2021|road-america|lmp2 (+20.3 %); imsa|2023|road-atlanta|lmdh (+8 %); imsa|2023|road-atlanta|gt3 (+5.6 %); wec|2025|circuit-of-the-americas|gt3 (+4.9 %); wec|2025|circuit-of-the-americas|lmh (+8.6 %); wec|2025|circuit-of-the-americas|lmdh (+9.5 %); elms|2025|imola|lmp2 (+7.7 %); elms|2025|spa-francorchamps|gt3 (+11.7 %); elms|2025|spa-francorchamps|lmp2 (+10.2 %); elms|2025|silverstone|gt3 (+11.2 %); alms|2024|yas-marina|gt3 (+7.1 %); alms|2025|yas-marina|gt3 (+5.4 %); alms|2026|sepang|gt3 (+12.5 %).

Rows that could not be used, by reason: no simulator geometry: sebring-6019: 301; no simulator geometry: long-beach-3167: 161; no simulator geometry: belle-isle-3782: 10; no simulator geometry: detroit-2647: 64; wet qualifying: 47; no simulator geometry: aragon-5344: 17; no simulator geometry: dubai-5390: 192; slow session (wet or disrupted), listed: 67. The layouts without geometry (Sebring, Long Beach, Detroit, Belle Isle, Dubai, Aragón) are the next tracks to build: their laps are already in the table.

## 6. Sources (add every new source here)

| Source | Link | What it gives | State on 2026-11-14 |
|---|---|---|---|
| Al Kamel Systems result sites | https://alkamelsystems.com/live-results/ | Index of every Al Kamel result site | Read |
| FIA WEC results | http://fiawec.alkamelsystems.com/ | Laps, sectors, traps, weather, classification | Learned (2021–2026, through the archive below; 2025–2026 also through `fetch-wec.mjs`) |
| IMSA results | https://imsa.results.alkamelcloud.com/ | Same, IMSA WeatherTech | Learned (2021–2026) |
| ELMS results | http://elms.alkamelsystems.com/ | Same, European Le Mans Series | Learned (2021–2026) |
| Asian Le Mans Series results | http://alms.alkamelsystems.com/ | Same | Learned (2022–2026) |
| Formula E results | https://results.fiaformulae.com/ | Laps, sectors, Attack Mode, weather | Fetch written (`fetch-fe.mjs`), runs in Actions |
| Michelin Le Mans Cup results | https://lemanscup.alkamelsystems.com/ | LMP3 and GT3 | Not yet |
| SRO / USAC live timing | https://livetiming.alkamelsystems.com/usac_sro | GT World Challenge America live timing | Live only, no archive found; SRO result PDFs still needed |
| MotorsportDB (IMSA skill) | https://github.com/tobi/imsa_data · https://mcpmarket.com/tools/skills/imsa-data-analyst · https://huggingface.co/datasets/tobil/imsa | Al Kamel CSV archive of IMSA, WEC, ELMS, Asian LMS, 2021–2026, MIT | Learned: input of `build-endurance.mjs` (commit 1d7cee7) |
| f1db | https://github.com/f1db/f1db | Every F1 circuit, layout and season, results, qualifying times | Used for the track registry (78 circuits, every layout) |
| F1 Archive | https://f1archive.org/ (API: /docs) | F1 timing, telemetry, race control 2018–2026 | Not reachable from the shell; probe in Actions (`probe-sources.mjs`) |
| OpenWEC | https://www.openwec.com/explore | WEC, ELMS, Asian LMS, Le Mans Cup, IMSA since 2012, REST API | Not reachable from the shell; probe in Actions. Needed for 2012–2020 |
| wec-data | https://github.com/Hanspeter007/wec-data | Schemas and 2026 examples of classifications, entry lists, line-ups | Read: schema only, no lap data |
| 51GT3 | https://51gt3.com/en/track | GT3 tracks and lap records | Not reachable from the shell; probe in Actions |
| SRO official results | https://www.gt-world-challenge-europe.com/results · https://www.gt-world-challenge-america.com/results · https://www.gt-world-challenge-asia.com/results · https://www.britishgt.com/results · https://www.intercontinentalgtchallenge.com/results | Every session table (position, car, best lap) of every meeting | Learned 2013–2026 (`fetch-sro.mjs` in Actions → `build-sro.mjs` → `sro-gt3-cars.csv.gz`, 54,134 rows): records only. IGTC gives PDFs (not read yet); GTWC Australia pages have no session tables |
| FIA Driver Categorisation public list | https://driverscategorisation.fia.com · yearly PDF lists (fia.com; press copies on sportscar365.com, endurance-info.com, as-web.jp; archived copies on web.archive.org) | Category per driver and season (medal images or words) | Read 2026-11-16: 2015, 2019, 2021–2026 lists (`fetch-sro-lineups.mjs`, section 13) |
| SRO entry-list PDFs | `/noticeboard?meeting_id=<id>` of every SRO site | Category printed per driver at the meeting | Read 2026-11-16 (`fetch-sro-entry-pdfs.mjs` → `sro-entry-ratings.json`, section 13) |
| SRO entry lists | https://www.gt-world-challenge-europe.com/entry-lists (and America, Asia, British GT, IGTC) | Drivers per car and meeting, car cup | Read 2026-11-16 (`fetch-sro-lineups.mjs` → `sro-lineups.json.gz`, section 13) |
| SRO PDF results | https://www.intercontinentalgtchallenge.com/results · https://www.gt-world-challenge-australia.com/results | Classification PDFs (IGTC 2019-2026: Spa 24h, Nürburgring 24h, Suzuka, Kyalami, Indianapolis 8h, Gulf 12h; GTWC Australia 2023-2026) | `fetch-sro-pdf.mjs` in Actions (pdftotext) → `sro-pdf-cars.csv.gz`, 6,394 rows (car, entry number, best lap; no names). Records everywhere; fitted only on thin layouts (Phillip Island learned: 3 events, 1.9 %) |
| Timing71 core | https://github.com/timing71/livetiming-core | How Timing71 services record sessions (format of the replay archive) | Read |
| Timing71 replay archive | https://archive.timing71.org/ | 15,808 replays, all series | Rows built on 2026-11-11 (Actions run 42927630531, artifacts until 2026-12-11); 46 % had no track id: re-map them with `resolveTrack()` |
| TracingInsights | https://github.com/TracingInsights | F1 laps and telemetry 2018–2026 | Used by the F1 pipeline and the F1-history tracks |
| OpenF1 | https://openf1.org/ | F1 positions and speed traces | Used by the production F1 calibration |
| TUM racetrack database | https://github.com/TUMFTM/racetrack-database | Centre lines and widths | Used for widths and Brands Hatch |
| OpenStreetMap | https://www.openstreetmap.org/ | Circuit centre lines | Used for the extra circuits (check every candidate: section 2) |

## 7. Not done yet

- Formula E: cars table is being fetched; no Formula E track geometry except Monaco; Gen3 Evo fit and the Gen4 model on the page are not done.
- Timing71 rows: GTWC, IGTC, Nürburgring 24h and DTM are in (DTM as records only: its layouts disagree across seasons). NLS, Macau, Misano, Sonoma and Barber are not resolved yet.
- GT3 ELMS and Asian LMS (2026-11-15): back to 1.05 % and 0.70 % event-hidden once SRO laps were limited to certain layouts.
- SRO official laps (no weather) are fitted only on thin layouts (fewer than 3 timed GT3 seasons), only for seasons no timed source
  covers, only when the layout is certain (not chosen by lap time among several built layouts; inside the layout's known seasons).
  Misano: 1 → 10 events, error 3.8 % → 0.9 %. GT3 overall 1.16 % (262 events, with the IGTC and GTWC Australia PDFs).
- DTM stays records only: with named layouts (short NGK = sprint) its Timing71 rows still carry no weather or rain flag, and single wet
  sessions gave 7-11 % errors (GT3 1.12 → 1.40 %).
- IGTC Bathurst and GTWC Australia PDFs are Natsoft prints (1:25.5383*, Porsche "992 GT3R"): read since 2026-11-15. Gaps read as laps
  are dropped (a best lap more than 8 % below its session median, or 5 % below the median event best of its layout and class).
- Not read: NLS (no geometry for its layout), Macau (street circuit not built).
- SRO official tables carry no weather, so they are records only (shown with the event weather unknown).
- F1 per-team cars: unchanged in this step (F1 is shown per regulation and its production calibration was not touched).
- Practice and race laps are in the car table (type P and R) but only qualifying is fitted: a fuel and tyre-age term must be declared first.
- Sector times and speed traps are in the table and are not fitted yet (physics rule 3.4).

## 8. Formula E (2026-11-15)

Script: `scripts/sim/learn/build-fe.mjs` (runs offline in seconds). Inputs: `fe-maps.json` (69 official FIA Formula E circuit
maps of seasons 9-12, vector lines read by `fe-lines.mjs`) and `fe-cars.csv.gz` (Al Kamel, seasons 5-12, every session, one row per car).

- **Tracks.** One simulator track per layout (venue + printed track length, 0.4 % tolerance). The lap line is the coloured line of
  the map, stitched from its strokes, scaled to the printed length, then the least-curvature line inside 11 m (`buildTrack`).
  Monaco uses the existing `monte-carlo` track (same 3.337 km lap). Hyderabad and Shanghai 2026 maps have no vector line.
  23 Formula E tracks: `worker/lapsim/fe-tracks-data.js`; each is one layout in `track-registry.json` (source `fia-fe-map`).
- **Cars per rule set** (`worker/lapsim/fe-cars.js`): Gen2 (2019-22, 250 kW, rear drive), Gen3 (2023-24, 350 kW, rear drive),
  Gen3 Evo (2025-26, 350 kW, all-wheel drive) and Gen4 (2026-27 prior from `fe-gen4.js`, docs/lapsim-fe-gen4-prep.md).
- **Model.** log(real) = log(sim) + G(rule set) + T(layout), T ridge σ 0.05, fitted on the best dry qualifying lap per layout,
  season and rule set. Gen4 has no laps yet: prior car × exp(T).
- **Reproduction.** Every layout and rule set that raced shows its fastest real lap (any session; Formula E practice runs at full
  power, so it is often the fastest) on the page and in the tool, and the fastest race lap. Test: `tests/lapsim-learn.test.mjs`.
- **⚠️** on a Formula E track when the event-hidden error is above 3 % or the track factor is above 8 % (doubtful map line:
  Rome, Mexico 2023-25, Jarama), or when no qualifying lap exists to check it.

Error, % RMS of lap time (event hidden = that layout and season left out of the fit):

| Rule set | Rows (layout × season) | Bare car | **Event hidden** | Layout hidden | In-sample |
|---|---|---|---|---|---|
| Gen3 Evo | 21 | 6.4 | **2.35** | 4.61 | 0.95 |
| Gen3 | 22 | 5.87 | **2.88** | 5.64 | 1.51 |
| Gen2 | 15 | 9.11 | **1.86** | 6.66 | 1.35 |

Per track:

| Track | Rows | Bare car | Event hidden |
|---|---|---|---|
| fe-london | 4 | 6.48 | 0.34 |
| fe-tokyo | 3 | 5.28 | 3.85 |
| fe-shanghai | 3 | 2.44 | 2.8 |
| fe-sanya | 1 | 7.79 | 3.99 |
| monte-carlo | 4 | 1.56 | 0.37 |
| fe-berlin | 2 | 1.65 | 0.9 |
| jarama | 1 | 10.43 | 6.65 |
| fe-jeddah | 2 | 0.15 | 0.19 |
| fe-miami | 1 | 1.66 | 2.19 |
| fe-mexico | 3 | 5.3 | 0.82 |
| fe-sao-paulo | 4 | 7.49 | 0.61 |
| fe-jakarta | 3 | 5.5 | 2.99 |
| fe-miami-2025 | 1 | 4.83 | 1 |
| fe-mexico-2023 | 3 | 12.45 | 1.87 |
| fe-portland | 2 | 0.17 | 0.3 |
| fe-berlin-2024 | 5 | 3.49 | 3.11 |
| fe-misano | 1 | 4.84 | 6.38 |
| fe-diriyah | 5 | 6.1 | 2.99 |
| fe-london-2023 | 1 | 4.4 | 3.14 |
| fe-rome | 3 | 18.25 | 1.26 |
| fe-berlin-2023 | 4 | 5.98 | 0.46 |
| fe-cape-town | 1 | 5.64 | 4.41 |
| fe-valencia | 1 | 7.4 | 1.9 |

**Gen3 Evo on only (owner 2026-11-15).** The page and the tool show Formula E Gen3 Evo and the Gen4 prior. Gen3 (2023-24) laps stay in
the fit as a hidden helper (`FE_FIT_ONLY` in `fe-cars.js`): they help learn the factor of layouts Gen3 Evo shares (without them the
Gen3 Evo event-hidden error is 2.52 %, with them 1.82 %). Gen2 is not modelled, and layouts last raced before 2025 (Portland, Misano,
Cape Town, Hyderabad, Rome, London 2023, Berlin 2023/2024, Diriyah) are no longer built. 15 Formula E tracks, 16 raced combinations.

**Group and duel power (2026-11-15).** A qualifying lap is simulated at the power of its session (`feCarFor()` in
`worker/lapsim/fe-cars.js`): Gen3 and Gen3 Evo groups 300 kW, duels and free practice 350 kW; Season 8 (2021-22, Gen2) groups 220 kW,
duels 250 kW; Seasons 5-7 250 kW (fiaformulae.com, groups and duels format). Before, the group laps were fitted against the 350 kW car,
so G held the power deficit. Bare-car error dropped (Gen3 Evo 6.40 → 5.09 %, Gen3 5.87 → 5.34 %); event-hidden error is unchanged for
Gen3 Evo (2.35 → 2.34) and Gen3 (2.88 → 2.87) and rose for Gen2 (1.86 → 2.13, Season 8 group laps now at 220 kW). G per rule set is now
power-free: exp(G + T) on the full-power page car predicts a full-power lap. Every record carries the `kW` of its session.
The duels are published only as PDF classifications (no Analysis CSV): `fetch-fe-duels.mjs` reads them into `fe-duels.csv`.

**Season 5-8 maps (2026-11-15).** `fetch-fe-maps-gen2.mjs` read 53 more official maps (122 in all). None gives a vector lap line: the
older PDFs are raster images or draw the track as thin black outlines. So the Gen2 street venues (Hong Kong, Paris, Santiago, Seoul,
New York, Puebla, Marrakesh, Bern, older London/Monaco/Rome/Valencia) still have records only, not a track. The new maps widen the
seasons of layouts that already had a line (Berlin 2.355 km 2020-23, Rome 2021-23, Valencia 2021-26, Diriyah 2019-24, Mexico 2020-26);
the track id comes from the first map that gives the line, so ids do not change. Next step for those venues: centre line from the
two black outline strokes of the Season 8 maps.

## 9. Tracks, third pass (2026-11-15)

Request files `scripts/sim/data/track-requests-2026-11-15c.json` and `-d.json`, runners `fetch-osm-tracks-c.mjs` / `-d.mjs` (Actions),
candidates `scripts/sim/data/tracks/extra-tracks-2026-11-15c.json` / `-d.json`. The OpenStreetMap ways were read offline first through
`probe-tracks3.mjs` (raw ways printed into the job log only; `probe-tracks3.json` keeps counts). Rule unchanged: a lap is accepted only
within 0.5 % of the official length unless a wider tolerance is written in the request with its reason.

| Track | Official | Map lap | Result |
|---|---|---|---|
| Sebring | 6,019 m (FIA) | 5,887 m (−2.2 %) | No piece is missing: every raceway way is on the lap and no way end is open. The map is short everywhere by the same share (Johnson Club Circuit loop 2,688 vs 2,736 m, −1.8 %; School Circuit loop 3,140 vs 3,219 m, −2.5 %), so the shape is kept and the lap is scaled to 6.019 km (`scaleToOfficial`). Provisional mark removed. Unseen check: 12 real laps, RMS 1.86 % (pass, no track factor fitted) |
| Aragón | 5,346 m (FIA) | 5,333 m (−0.24 %) | Built (the first run had no map data). Registry layout `aragon-5344` is now `aragon` with the simulator track |
| Lausitz DTM | 3,478 m (FIA) | 3,473 m (−0.14 %) | Built. The DEKRA test oval and slalom areas are skipped (`skipName`) and tagged pit lanes are no longer lap ways. Twenty loops fit the length; only one drives the one-way raceway pieces in their mapped direction (1 % against, the next 5 %), and that one is accepted (`oneway`) |
| Autopolis | 4,674 m (FIA) | 4,640 m (−0.73 %) | Built with a stated 0.8 % tolerance (one closed map way plus the start/finish piece; same practice as Phillip Island 0.7 %) |
| Snetterton 300 | 4,779 m | 4,789 m (+0.21 %) | Built. The FIA list has only the 1997–2010 lap (3.141 km), so the length is the circuit's stated 300 layout |
| The Bend | 4,950 m (FIA) | open way 4,754 m | Not built: the circuit way is open and its ends do not meet in a straight line (nearest pass 127 m); the join would be invented |
| Barber | 3,830 m (FIA) | 3,720 m (−2.9 %) | Not built: one closed way, short, and no second layout to show that the shortfall is spread (as at Sebring) |
| Sugo | 3,704 m (FIA) | 3,617 m (−2.35 %) | Not built, same reason |
| Long Beach, Detroit (2023+), Norisring | 3,167 / 2,647 / 2,162 m | – | Not built. A named-road method (roads and raceway pieces joined in lap order at map junctions, same acceptance) was tried offline, but these laps use both carriageways of one road with hairpins through median openings (Detroit Jefferson Avenue, Norisring Beuthener Straße) or unnamed car-park roads (Long Beach fountain and aquarium section), which road names cannot describe. Best named-road loops: Long Beach 2,528 m, Detroit 2,324 m. Next step: the official circuit-map PDFs (as for Formula E) |

Aragón, Lausitz, Autopolis and Snetterton have no real lap of a calibrated class yet, so they carry ⚠️ (`trackWarn()`).
Laps already in the tables that now have geometry: Sebring (IMSA and WEC, 301 rows) and Aragón (ELMS 2023, 17 rows); the learning
step (`fit-endurance.mjs`) must be rerun to use them.

## 10. Istanbul Park and Sochi; more real laps from the historic F1 database (2026-11-15)

- **Tracks** from F1 car positions (`build-geometry-f1-history.mjs`, TracingInsights): Istanbul Park 2021 qualifying (2020 was wet),
  Sochi 2020 qualifying (2021 Q3 was wet). Fastest race laps from f1db (`f1-race-records.mjs`).
- **More real laps** (`scripts/sim/learn/f1db-poles.mjs` -> `scripts/sim/data/tracks/f1db-poles.json`): the fastest single qualifying
  lap of every race 2006-2019 from f1db (Q3 of 2006-2009 ran on race fuel; 2005 used aggregate times, so it is left out). A session
  slower than the race's fastest lap is flagged wet and not used. Seasons TracingInsights does not cover get a pace ratio against the
  2023 car from the f1db laps on production circuits of the same layout (held-out RMS 0.8-2.7 % per season, table in
  docs/lapsim-tracks-extra.md). Rows added on the tracks built from F1 car positions only.
- **Track factor**: on those tracks the factor learned from the real laps is used when its held-out error is lower than the
  no-factor error. Istanbul 2.54 % (one lap, no factor) -> **0.95 %** held-out (7 seasons); Sochi -> **0.73 %** (7 seasons);
  Nürburgring GP 2.58 -> 1.04 %.
- **Other series checked** (Wikipedia circuit pages): Istanbul hosted GP2, GP3, WTCC, the Le Mans Series 1000 km (2005-06, LMP1),
  FIA GT (2005); Sochi GP2/F2, GP3/F3, WTCR, TCR and Russian series. None is a calibrated simulator class (F1, LMH, LMDh, GT3), so
  they are not used.

## 11. Long Beach and Detroit (2026-11-15)

Built from the OpenStreetMap circuit relations of the venues (`track-requests-2026-11-15e.json`, `fetch-osm-tracks-e.mjs`):
Long Beach relation 18052024 "Long Beach Grand Prix Course" (one closed loop, 3,258 m, +2.9 %) and Detroit relation 17665938
"Detroit Grand Prix" (downtown course since 2023; 2,685 m, +1.3 %, with the pit lane left out and the two ends at the Jefferson
Avenue hairpin, 6 m apart, joined). Both follow road centre lines, so the shape is kept and scaled to the official length
(`scaleToOfficial`). `assemble.mjs` fix: two open way ends near each other now join instead of swapping places.
Check (unseen, no fitted value): Long Beach 10 real laps RMS 1.18 %; Detroit 8 real laps 3.67 %, so its track factor is learned
(held-out 2.24 %). Registry layouts `long-beach-3167` and `detroit-2647` are now `long-beach` and `detroit` with geometry; their IMSA
laps (161 and 64 rows) are learned by the refit of 2026-11-15 (sections 4 and 5). Class cars show the fastest WEC or IMSA lap there,
built in the learning step (`classReal`, rule 11); the stopgap `class-records.mjs` / `class-records-data.js` is removed.

## 12. Model terms added 2026-11-15 (`fit-endurance.mjs`)

Each term was kept only if the event-hidden class error went down with it on the fixed geometry (one term removed at a time):

| Term | What it does | GT3 / LMDh / LMH without it |
|---|---|---|
| Surface eras (`SURFACE`) | A full resurfacing starts a new track term from its first season on the new asphalt: Laguna Seca 2024 (repaved June 2023), Road America 2023 (winter 2022-23), Shanghai 2024 (re-laid before F1's 2024 return). Only dates the circuits announced. | 1.05 / 1.00 / 0.98 |
| `AGE` | Years on the new asphalt (cap 3): new asphalt is fastest, then slows | 0.97 / 0.79 / 0.88 |
| F1 grip prior (`F`, `F2`) | log of the F1 calibration grip of the same map (and its square): how far the map geometry is off, measured independently by F1 poles (Jeddah needs 1.21) | 1.01 / 0.77 / 0.87 |
| Hot track (`HOT`) | Grip above 45 °C track temperature: the simulator loses too much | 0.98 / 0.82 / 0.92 |
| Daytona density (`TR`) | Banking is not in the geometry, so the lap depends more on air density (power) than the simulator gives; Daytona only | 0.97 / 0.82 / 0.88 |
| Series and season levels (`SS`, `SY`) | The series × season level is shrunk towards a series level plus a class-wide season level, so thin series-seasons lean on what is shared | 1.00 / 0.78 / 0.87 |
| Speed-slope clamp | The model × track-speed slope uses z inside ±0.8, so street circuits and Daytona do not set it | 0.98 / 0.76 / 0.84 |

With all terms: 0.97 / 0.77 / 0.87 in that test (the refit above, with the wet rules below, gives 0.96 / 0.73 / 0.82).

Data rules changed the same day:
- Wet or disrupted sessions (rule 3.3.1) are searched again until no new one is found (at most 3 passes), and another class of an event with a wet class is dropped from 2 % slow (WEC 2025 COTA GT3 was 3.9 % slow, its Hypercar classes 7.6-8.7 %).
- A layout found from the lap time alone must fit the simulated lap within 8 % (was 12 %, needed only while the Paul Ricard map was broken), and such SRO laps are not records unless `sroSure` (Sydney Brabham, GTWC 2019 no-chicane laps, Baku 2013 were shown as real laps).
- Not kept: a learned track-temperature slope, an air-density slope on every track (GT3 1.07), a level per GTWC region (GT3 1.11), a class × track term for LMH vs LMDh, Monza and Sonoma surface eras (no gain).

## 13. Driver ratings (data) (2026-11-16, task P1)

Data only: no fit term and no flag uses it yet (the main session adds that variant after the track refit).

- **What.** For every GT3 and LMP2 row that `fit-endurance.mjs` learns from: the FIA driver categorisation (P Platinum, G Gold,
  S Silver, B Bronze) of each driver of that car at that event, the line-up rating (sorted P>G>S>B, e.g. `PSB`) and, when the lap
  file shows it, the driver who set the learned lap. Evidence layer 1 ("Known"): only values printed in official documents.
- **Files.** `scripts/sim/learn/build-driver-ratings.mjs <imsa_data folder> [extra.json]` writes
  `scripts/sim/data/learn/driver-ratings.json.gz` (`drivers` {id: {name, seasons: {season: {rating, source, date, changes?}}}},
  `lineups` {"series|season|event": {car: {drivers, lineup}}}, `learned`, `changes`, `files`). Loader and coverage report:
  `node scripts/sim/learn/driver-ratings.mjs`. Test: `tests/lapsim-driver-ratings.test.mjs`.
- **Sources.** Al Kamel results CSVs of WEC, ELMS, Asian LMS and IMSA (archive tobi/imsa_data): `DRIVERn_LICENSE` is the category the
  organiser printed for that session (IMSA prints its own driver rating with the same four names). Line-up = drivers of the car in
  the race classification (else qualifying, else practice; last day only, so test-day drivers are left out). A driver with no
  value printed at the event takes his value from another official file of the same season (`how: season`, 56 of 10,480 seats);
  otherwise `unknown` (5 seats), never guessed. WEC 2026 São Paulo, COTA and Barcelona (live-feed rows): race classification and
  hyperpole Analysis CSVs read through the Kongboda connector (`driver-lineups-wec-2026.json`). Best-lap driver: the lap in the
  session lap file whose time equals the learned lap.
- **Identity.** Same full name only (accents, case and word order ignored). `drivers.mjs` short-name joining is not used here: it
  joins "Mikkel" and "Michael" Jensen, and a rating must never move to another person.
- **Ratings that change inside a season** are kept with their date (`changes`, 103 cases, e.g. IMSA 2021 Daniel Serra G → P at
  Daytona); the line-up always uses the value printed at that event.

- **SRO cars (P1b/P1c, 2026-11-16).** Sources in this order (the first that has the car wins):
  1. **Official SRO entry-list PDFs** (`fetch-sro-entry-pdfs.mjs` → `sro-entry-ratings.json`): the noticeboard
     (`/noticeboard?meeting_id=<id>`) and event page of every meeting of GTWC Europe, America, Asia, Australia, British GT and IGTC,
     and the entry lists linked from each site's news articles (event previews, `/news/<id>/x`, P1d). A list dated only `dd.mm.yy`
     takes its year from that date.
     Most lists print the category beside each driver (SRO `CAT` P/G/S/B, British GT `GRADE`, IGTC `Platinum/Gold/…`; a `-` stays
     unknown) → `how: event`. British GT 2020–2022 lists print only the car class: they give the drivers per car (`names`).
     Parser: `sro-entry-parse.mjs` (test in `tests/lapsim-driver-ratings.test.mjs`). The PDF of a learned event is the one of the same
     site and year that names the venue and holds the most learned car numbers (final / official before provisional). Raw PDF texts
     are a workflow artifact only (7 days), never committed. Check against other official values for the same driver and season:
     99 % agree with the FIA lists (4,709 of 4,761) and 95 % with Al Kamel (598 of 629; the rest are drivers rated differently by two
     organisers in one year, e.g. Marcus Clutton British GT 2023 G, ELMS S).
  2. **SRO entry-list web pages** (`/entry-list/<year>/<meeting>`, and `/entry-list?filter_meeting_id=<id>` for meetings missing from
     the season index, e.g. GTWC Europe Nürburgring 2015–2026; `fetch-sro-lineups.mjs` → `sro-lineups.json.gz`): the drivers per car
     (the page shows only the car's cup).
  3. For drivers named by 2 (or by a names-only PDF), the category comes from the **FIA Driver Categorisation public list** of that
     season (`how: fia-list`), else from the driver's value printed by an ACO-series Al Kamel file of that season (`how: season`; IMSA's
     own rating is not used for SRO cars), else `unknown`.
- **FIA public lists** (`fia-categorisation.json`, only drivers named in a line-up are kept), one or more per season:
  2015 (27.03.2015), 2016, 2017 (FIA downloads `fia.com/file/36290`, `/50676`), 2018 (provisional 20.11.2017 and final 14.12.2017),
  2019 (provisional 16.11.2018, `fia.com/file/74960`, which prints "Categorisation 2018" and "Categorisation 2019": only the 2019
  column is read; and the 2019 temporary list of driverscategorisation.fia.com, archived copy), 2021–2026. A removed file is read
  from its Internet Archive copy (original URL kept as the source). Inside a season the latest print wins; undated lists take the
  date of the archived copy, else 1 January. 2021–2026 print the category as a medal image (S, B, G, P): each row is read at the
  "Category" column of a 72 dpi render and the colour matched to the four medals (0 rows unclear); 2015–2019 print it as a word
  (2018 prints the column headers on page 1 only; later pages reuse them). The "Next Category" column is not read. **2020 not
  found:** that year the list was only in the driverscategorisation.fia.com web app; the Internet Archive kept its pages and scripts
  (99 URLs, 2019–2021) but no driver data (the `/api/public/...` answers archived are settings, not drivers).

- **More sources (P1e, 2026-11-17).**
  - **Older SRO entry-list PDFs** (2013–2020) under `/images/results/<id>/`, found through the Internet Archive index of the site and
    of the Blancpain-era domains; read from the site, else from the archived copy (`fetch-sro-entry-pdfs.mjs`, incremental: a new
    parser re-reads every PDF).
  - **SRO results pages** (`fetch-sro-results.mjs` → `sro-results-lineups.json.gz`): every session page prints the drivers per car
    (official classification). Used only for cars the entry list of that meeting lacks (race drivers, else qualifying, else practice).
  - **Nürburgring 24h and ADAC Qualifiers** (`fetch-n24-lineups.mjs` → `n24-lineups.json`): the official ADAC Nordrhein entry
    lists (press list "Starterliste" and DMSB list "Teilnehmerliste"; drivers per car, no category) for 2023–2026; the rating comes
    from the FIA list of the season. Only an N24 list (or an IGTC 24h list) can name an N24 car.
  - **Name variants** (`name-match.mjs`): an entry list and the FIA list may write one driver differently. A variant counts only
    when exactly one driver of that season's FIA list fits one of three fixed rules: two tokens written together ("Pierguidi" /
    "Pier Guidi"), all tokens of the shorter name in the longer ("Albert Costa" / "Albert Costa Balboa"), or a short first name of a
    fixed table ("Dani" / "Daniel"). No similarity score and no spelling fix ("Denis" / "Dennis", "Mikkel" / "Michael" stay apart).
    Such seats carry `variant: "<rule>: <FIA name>"`; a learned row whose line-up needed one has `lineupExact: null` and
    `variantSeats` (62 rows), so the fit can use the exact-name rows only.
  - **Parser fix:** the 2026 GTWC Europe "draft" entry lists print one CATEGORY column after the drivers: that is the car's cup, not
    a driver's rating (it had been read as the last driver's rating, e.g. Kyle Marcelli "B"). Those lists now give names only.
    Printed categories agree with the FIA list of the same year in 98.8 % of 16,353 seats (2017–2026); most of the rest are the
    same drivers in several lists (rating changed during the season; the value printed at the event is used).

Coverage (learned rows with a known line-up rating; best-lap driver known):

| Group | Series | Seasons | Rows | Line-up known | Best-lap driver |
|---|---|---|---|---|---|
| GT3 | WEC | 2024–2026 | 176 | 176 | 176 |
| GT3 | ELMS | 2024–2026 | 78 | 78 | 78 |
| GT3 | Asian LMS | 2022–2026 | 90 | 90 | 90 |
| GT3 | IMSA | 2021–2026 | 604 | 603 | 604 |
| GT3 | GTWC (SRO tables, all regions) | 2013–2026 | 728 | 599 (551 exact names) | 0 |
| GT3 | GTWC Europe (Timing71: Endurance, Sprint, Spa 24h) | 2024–2026 | 133 | 123 (116) | 0 |
| GT3 | British GT | 2015–2026 | 273 | 179 (176) | 0 |
| GT3 | IGTC (PDFs, Suzuka 1000 km) | 2019–2026 | 79 | 53 (50) | 0 |
| GT3 | Nürburgring 24h | 2023–2026 | 36 | 33 (32) | 0 |
| LMP2 | WEC | 2021–2026 | 23 | 23 | 23 |
| LMP2 | ELMS | 2021–2026 | 32 | 32 | 32 |
| LMP2 | Asian LMS | 2022–2026 | 13 | 13 | 13 |
| LMP2 | IMSA | 2021–2026 | 41 | 41 | 41 |

2,043 of 2,306 rows; 1,981 with exact names only (P1d: 1,881, P1c: 1,664). All Al Kamel rows: 1,056 of 1,057 (IMSA 2021 Watkins Glen #39: Tyler McQuarrie has no printed rating). Per
season: `node scripts/sim/learn/driver-ratings.mjs`. SRO timing has no driver per lap, so no best-lap driver there.

Gaps and what was checked (2026-11-16):

- **Check of the new lists (P1d):** printed SRO entry-list categories agree with the FIA list of the same year: 2017 98 % (940 of
  958), 2018 97 % (723 of 742), 2019 97 % (182 of 188); the 2019 provisional list agrees 99.6 % with the 2019 temporary list.
- **Still unknown (263 rows, P1e):** seats of seasons with no FIA list and no category in the entry list (2013: 26, 2014: 68,
  2020: 66 seats; the 2020 list existed only in the FIA web app, the Internet Archive kept no driver data); drivers on no FIA list
  we have under any accepted spelling (103 seats; mostly amateurs and one-off entries); drivers missing from the list of that year
  but on other years' lists (74 seats: not categorised that year, or a list we lack, e.g. a mid-season update); cars with no
  published line-up (31 rows: GTWC Australia 2023–2024 publishes results only as Natsoft PDFs, GTWC Asia Japan Cup joint rounds,
  IGTC Bathurst rows without a car number). None of these is filled by inference.
- The cup of an SRO car (PRO/GOLD/SILVER/BRONZE) is never used as a rating (a Bronze Cup car can be B+S+P).
- **Data found for the main session:** WEC 2026 Imola and Spa LMP2 #46 (learned as Oreca 07) is an Oreca 05 of a historic support
  race filed in the same Al Kamel folder (one-driver files, "Bronze FIA"). Not changed here.
