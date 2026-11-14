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
7. Data with a different structure is converted to the one table shape of section 2. Outside programs (MATLAB, Python tools of the
   M17 power-unit project) may be used when they help; an unfinished or inaccurate tool must never make a working feature worse.
8. Use the engineering skills and the Karpathy guidelines for this work: goal and pass check first, smallest change, verify.

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

1106 model rows, 123 events, 29 layouts, 42 car models. Generated 2026-11-14.

| Class | Events | Before, class-best | **Event hidden, class-best** | Before, per model | **Event hidden, per model** | Car model hidden | Layout hidden (track-unseen) | In-sample |
|---|---|---|---|---|---|---|---|---|
| LMH | 34 | 2.14 | **0.82** | 2.23 | **0.92** | 1.45 | 3.09 | 0.52 |
| LMDh | 46 | 2.73 | **0.98** | 2.87 | **1.04** | 0.87 | 3.74 | 0.57 |
| GT3 | 85 | 2.77 | **1.08** | 2.85 | **1.22** | 1.02 | 3.23 | 0.69 |

By series (event hidden, class-best; before → after):

| Class and series | Events | Before | After |
|---|---|---|---|
| GT3 ALMS | 5 | 2.21 | 1.18 |
| GT3 ELMS | 13 | 2.25 | 0.98 |
| GT3 IMSA | 49 | 3.21 | 1.2 |
| GT3 WEC | 18 | 1.76 | 0.73 |
| LMDh IMSA | 23 | 3.53 | 1.14 |
| LMDh WEC | 23 | 1.54 | 0.79 |
| LMH IMSA | 11 | 3.13 | 0.88 |
| LMH WEC | 23 | 1.44 | 0.79 |

Sensitivity (event hidden, class-best): widths ×0.5: LMH 0.82, LMDh 0.98, GT3 1.08; widths ×2: LMH 0.82, LMDh 0.98, GT3 1.08.

Reading: with the event hidden the class-best error is about one percent in every class, less than half of before. A track that has
no lap of any endurance series stays at the old level (layout hidden: about 3 %): on such a track the page keeps the production
calibration and does not use this layer. LMP2 is not shown on the page.

## 5. Result per class and track (class-best, RMS %, event hidden)

| Track (layout) | Class | Events | Models rows | Before | After |
|---|---|---|---|---|---|
| austin | GT3 | 1 | 9 | 0.39 | 0.36 |
| austin | LMDh | 1 | 5 | 0.23 | 0.19 |
| austin | LMH | 1 | 3 | 0.22 | 0.05 |
| catalunya | GT3 | 3 | 16 | 0.82 | 0.63 |
| daytona | GT3 | 6 | 58 | 6.15 | 0.94 |
| daytona | LMDh | 4 | 17 | 7.13 | 0.98 |
| daytona | LMH | 1 | 1 | 9.49 | 0.6 |
| fuji | GT3 | 2 | 18 | 1.44 | 0.07 |
| fuji | LMDh | 3 | 11 | 0.28 | 0.37 |
| fuji | LMH | 3 | 11 | 0.63 | 0.5 |
| imola | GT3 | 6 | 43 | 1.36 | 0.81 |
| imola | LMDh | 3 | 13 | 1.69 | 0.62 |
| imola | LMH | 3 | 12 | 1.5 | 1.22 |
| indianapolis | GT3 | 3 | 29 | 1.15 | 1.3 |
| indianapolis | LMDh | 4 | 18 | 0.61 | 0.89 |
| indianapolis | LMH | 2 | 2 | 1.08 | 0.66 |
| interlagos | GT3 | 2 | 18 | 1.56 | 0.53 |
| interlagos | LMDh | 2 | 9 | 1.11 | 0.38 |
| interlagos | LMH | 2 | 8 | 0.62 | 0.67 |
| kuala-lumpur | GT3 | 2 | 14 | 0.69 | 0.29 |
| laguna-seca | GT3 | 6 | 56 | 3.34 | 2.02 |
| laguna-seca | LMDh | 4 | 16 | 2.71 | 1.93 |
| laguna-seca | LMH | 2 | 2 | 1.85 | 1.27 |
| le-mans | GT3 | 3 | 27 | 3.51 | 0.64 |
| le-mans | LMDh | 4 | 15 | 2.57 | 0.26 |
| le-mans | LMH | 4 | 17 | 2.36 | 0.3 |
| lime-rock | GT3 | 3 | 24 | 2.24 | 0.52 |
| lusail | GT3 | 2 | 18 | 0.73 | 0.75 |
| lusail | LMDh | 2 | 9 | 0.56 | 0.87 |
| lusail | LMH | 2 | 8 | 0.88 | 0.99 |
| mid-ohio | GT3 | 2 | 16 | 0.38 | 1.64 |
| monza | LMDh | 1 | 2 | 2.89 | 1.24 |
| monza | LMH | 1 | 5 | 2.76 | 1.06 |
| mosport | GT3 | 5 | 46 | 0.78 | 0.73 |
| mosport | LMDh | 1 | 4 | 3.16 | 0.02 |
| mugello | GT3 | 1 | 4 | 2.31 | 2.23 |
| paul-ricard-5771 | GT3 | 1 | 4 | 6.69 | 1.06 |
| paul-ricard-5821 | GT3 | 2 | 12 | 0.6 | 0.31 |
| portimao | GT3 | 2 | 10 | 1.31 | 0.63 |
| portimao | LMDh | 1 | 2 | 0.49 | 2.07 |
| portimao | LMH | 1 | 5 | 1.72 | 0.54 |
| road-america | GT3 | 6 | 56 | 3.69 | 1.11 |
| road-america | LMDh | 4 | 16 | 2.74 | 0.86 |
| road-america | LMH | 2 | 2 | 1.52 | 0.58 |
| road-atlanta | GT3 | 5 | 50 | 2.67 | 0.66 |
| road-atlanta | LMDh | 3 | 14 | 0.67 | 0.31 |
| road-atlanta | LMH | 2 | 2 | 0.57 | 0.41 |
| sakhir | GT3 | 2 | 18 | 1.1 | 0.63 |
| sakhir | LMDh | 2 | 9 | 0.25 | 0.83 |
| sakhir | LMH | 2 | 7 | 0.5 | 0.9 |
| spa-francorchamps | GT3 | 4 | 31 | 1.01 | 1.22 |
| spa-francorchamps | LMDh | 4 | 15 | 1.34 | 0.95 |
| spa-francorchamps | LMH | 4 | 17 | 0.97 | 0.84 |
| vir | GT3 | 6 | 56 | 1.04 | 1.33 |
| watkins-glen | GT3 | 7 | 67 | 3.03 | 0.98 |
| watkins-glen | LMDh | 3 | 14 | 1.96 | 1.25 |
| watkins-glen | LMH | 2 | 2 | 1.26 | 1.21 |
| yas-marina-circuit | GT3 | 3 | 21 | 2.8 | 1.5 |

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
| Timing71 core | https://github.com/timing71/livetiming-core | How Timing71 services record sessions (format of the replay archive) | Read |
| Timing71 replay archive | https://archive.timing71.org/ | 15,808 replays, all series | Rows built on 2026-11-11 (Actions run 42927630531, artifacts until 2026-12-11); 46 % had no track id: re-map them with `resolveTrack()` |
| TracingInsights | https://github.com/TracingInsights | F1 laps and telemetry 2018–2026 | Used by the F1 pipeline and the F1-history tracks |
| OpenF1 | https://openf1.org/ | F1 positions and speed traces | Used by the production F1 calibration |
| TUM racetrack database | https://github.com/TUMFTM/racetrack-database | Centre lines and widths | Used for widths and Brands Hatch |
| OpenStreetMap | https://www.openstreetmap.org/ | Circuit centre lines | Used for the extra circuits (check every candidate: section 2) |

## 7. Not done yet

- Formula E: cars table is being fetched; no Formula E track geometry except Monaco; Gen3 Evo fit and the Gen4 model on the page are not done.
- Timing71 rows (GTWC, DTM, IGTC, NLS, Macau, Super GT): not re-mapped with the registry and not in this fit. GT3 models seen only there are missing.
- F1 per-team cars: unchanged in this step (F1 is shown per regulation and its production calibration was not touched).
- Practice and race laps are in the car table (type P and R) but only qualifying is fitted: a fuel and tyre-age term must be declared first.
- Sector times and speed traps are in the table and are not fitted yet (physics rule 3.4).
