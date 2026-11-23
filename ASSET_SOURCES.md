# Logo asset provenance

- Kongboda: original right-facing Formula car with a large square flag and Gmarket Sans TTF Bold outlines. Font source: https://corp.gmarket.com/fonts/GmarketSansTTF.zip ; SIL OFL 1.1 and original embedded notice preserved in FONT-LICENSE.txt. No font software embedded.
- F1 white SVG: https://media.formula1.com/image/upload/v1677237319/etc/designs/fom-website/images/f1_logo.svg — official F1 homepage asset, downloaded unchanged.
- WEC white PNG: https://www.fiawec.com/uploads/wec-logo-69d50a53ddfee895249122.png — official FIA WEC homepage header asset, downloaded unchanged.
- Retrieved 2026-10-29. F1/WEC assets identify the competitions; they are not licensed under OFL. Their trademarks remain with their respective owners. No endorsement or affiliation is claimed.

## Updated 2026 car reference

The original mint silhouette was redrawn with reference to the official McLaren 2026 MCL40 **Side Right** image: elongated side profile, low nose, engine cover/airbox, halo, rear wing and exposed wheels. This is a simplified logo drawing; no source photograph, team livery, sponsor mark or team emblem is embedded. The square flag now flies left from the pole anchored in the cockpit. Compact subtitle tracking with enlarged Gmarket Sans Bold outlines preserves the same visible left/right edges as 꽁보다.
- https://www.mclaren.com/racing/formula-1/2026/mcl40-launch/
- https://images.ctfassets.net/gy95mqeyjg28/6HTPhNQ5mieDZ8A5TSh7bQ/6b1c381e3e82a1c4058b90f4f645eaf0/MCL40_LN_Allwyn_side_right.jpg

## Selected brand icon — 2026-10-29

User-selected artwork: 민트 깃발과 압축된 레이싱카 로고.png. The original PNG bytes are preserved in worker/brand-art/part-*.js as Base64 (SHA-256 6ccce3395d0bcfb36314f7bcb7a747fb062c4b5c8214c6ca104c928169c1b6e2). The SVG viewport fits the transparent margins; the existing Korean wordmark and font license remain intact.

## I4 track covariate sources — 2026-11-23

Data sources (not images) for scripts/sim/i4-covariates.mjs → scripts/sim/data/i4-covariates.json (surface age = last full-lap resurfacing or opening of the current layout). Read by web search on 2026-11-23; FIA Race Director notes via worker/lapsim/track-changes-data.js; compounds, evolution and weather from repo data files named in each row.

- melbourne: 2022 (full) — https://downergroup.com/The%20Australian%20Grand%20Prix%20Track%20gets%20a%20Downer%20Revamp
- shanghai: 2024 (full) — https://dynapac.com/en/news/dynapac-fleet-successful-completed-china-shanghai-f1-project-in-september-2
- suzuka: {"2025":null,"2026":2026} (full (T1–T8 2025, T7–T17 2026)) — https://www.redbullracing.com/int-en/races/japanese-grand-prix-2026/japan-bulls-guide-2026
- sakhir: 2004 (opening) — https://en.wikipedia.org/wiki/Bahrain_International_Circuit
- jeddah: 2021 (opening) — https://en.wikipedia.org/wiki/Jeddah_Corniche_Circuit
- miami: 2023 (full) — https://tilke.de/portfolio/miami-international-autodrome-2/
- imola: unknown (unknown)
- monte-carlo: unknown (unknown (partial every year, e.g. T19–T1 2026 in FIA notes))
- catalunya: 2018 (full) — https://www.sorigue.com/en/asphalts/surfacing-circuit-barcelona-catalunya
- montreal: 2024 (full (FIA RD notes 2024)) — https://www.planetf1.com/news/fia-reveal-13-track-changes-canadian-grand-prix
- spielberg: 2016 (full) — https://www.motorsport.com/f1/news/analysis-hungaroring-track-changes-put-lap-records-in-sight-799805/799805/
- silverstone: 2019 (full) — https://www.motorsportweek.com/?p=23573
- spa-francorchamps: unknown (unknown (about half resurfaced 2022)) — https://racingnews365.com/circuit-designer-had-20-iterations-of-eau-rouge-in-spa-f1-track-revamp
- hungaroring: 2016 (full) — https://hungaroring.hu/site/en/about-us/history-of-the-track
- zandvoort: 2020 (full) — https://www.racefans.net/?p=422789
- monza: 2024 (full) — https://en.ilsole24ore.com/art/f1-monza-new-look-gp-ditalia-sticchi-damiani-state-of-the-art-track-AFxju8ZD
- madring: 2026 (opening) — FIA 2026 calendar (new circuit)
- baku: 2016 (opening (no repave in 8 years, 2023)) — https://www.conexpoconagg.com/news/las-vegas-strip-turns-racetrack-again-for-formula
- kuala-lumpur: 2016 (full) — https://www.formula1.com/en/latest/features/2016/9/f1-malaysia-gp-preview-sepang-revamp.html
- singapore: 2008 (opening) — https://en.wikipedia.org/wiki/Marina_Bay_Street_Circuit
- austin: 2012 (opening (partial patches only)) — https://www.planetf1.com/features/new-mclaren-rear-wing-spotted-as-fia-ramp-up-flexing-investigations
- mexico-city: 2015 (full (rebuild)) — https://tilke.de/?p=10517
- interlagos: 2024 (full) — https://fia.com/sites/default/files/2024_f1_gp_sao_paulo_media_kit_english.pdf
- las-vegas: 2023 (opening (no repave since, 2025)) — https://www.fox5vegas.com/2025/11/13/f1-track-preparation-nears-completion-ahead-las-vegas-grand-prix/
- lusail: 2023 (full) — https://pirelli.com/global/en-ww/race/racingspot/formula-1/f1gp-five-fast-facts-about-the-qatar-gp-98804
- yas-marina-circuit: 2009 (opening (three sections relaid 2021)) — https://www.arabnews.pk/node/1963761/sport
- 2025 event dates: FIA 2025 F1 calendar (Friday of each event); 2026: worker/race-calendar-data.js

## Car-independent track geometry, step 3 (scripts/sim/geom-indep/, scripts/sim/data/geom-indep/tracks.json)

Fetched by `.github/workflows/lapsim-geom-indep.yml` (runs 45095673109 and 45102817213; the second rebuilds tracks.json byte for byte); raw crops on branch `probe/geom-indep-raw` only, derived
geometry committed. Pre-registration: claude.ai Project `claude/gate-independent-geometry-prereg-2026-11-23.md`.
- Centre lines: OpenStreetMap `highway=raceway` ways (Overpass, 2026-11-23) — © OpenStreetMap contributors, ODbL 1.0.
- Registration loop (correspondence only, no curvature): bacinger/f1-circuits `f1-circuits.geojson` — MIT.
- Suzuka elevation: GSI DEM5A (airborne laser, 5 m), https://cyberjapandata.gsi.go.jp/xyz/dem5a_png/ — GSI Content Terms of Use
  (compatible with CC BY 4.0), credit 国土地理院 / Geospatial Information Authority of Japan.
- Jeddah, Shanghai, Imola elevation: Copernicus DEM GLO-30 (30 m DSM), https://copernicus-dem-30m.s3.amazonaws.com/ — © DLR e.V.
  2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA. Imola: the Regione
  Emilia-Romagna "DTM 5x5" WCS (CC BY 4.0) was tried first but serves a 4-band picture, not heights, so the 30 m model is used.
- Widths: worker/lapsim/track-widths.js (Jeddah, Imola); FIA list of licensed circuits 2025-12-01 (Shanghai, Suzuka).
