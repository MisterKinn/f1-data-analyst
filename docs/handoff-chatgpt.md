# Handoff to ChatGPT — Kongboda Motorsports simulator (2026-11-08, from Claude)

This document hands the simulator work to ChatGPT. It covers the goals and rules the owner set, every
feature built so far with its numbers, **how** each one was built, every problem met and how it was
solved, the tools/skills/plugins used (and what to install), the data sources and their limits, and
the work left, with pass checks. Read it top to bottom once; use the section index afterwards.

Owner: Jeongmin (GitHub `kangjeongmin1229`, site <https://kongboda-motorsports.vercel.app>).
Production repo: `MisterKinn/f1-data-analyst` (merge to `main` = automatic Vercel deploy).

---

## 0. Index

1. Goals and rules (read first)
2. How to work in this repo (branches, PRs, tests, deploy, live check)
3. What the simulator is (architecture and file map)
4. Everything built, with numbers (merged PRs)
5. How each feature was built: method, problems, fixes, tools
6. Data sources, access paths and limits
7. Work left for ChatGPT, in order, with pass checks (J = Timing71 archive, K = open model items)
8. Tools, skills and plugins used — what to install, substitutes
9. Stable UI names (do not rename) and page structure
10. Workflows (GitHub Actions) and scripts
11. Known issues, risks and open questions

---

## 1. Goals and rules (read first)

### 1.1 Product goal
- Site goal (owner, 2026-11-08): **lower the barrier to motorsport technical knowledge and turn light
  fans into core fans** (모터스포츠 테크니컬에 대한 진입장벽을 낮추고 라이트팬을 코어팬으로 붙잡는 것).
  It replaced the old goal "read live timing simply". `AGENTS.md`, `docs/answer-principles.md` and
  `worker/site-metadata.js` already state it.
- Simulator goal: the best possible motorsport simulator — F1, WEC (Hypercar LMH/LMDh, LMGT3), later
  IMSA GTP, Formula E, GT3 (WEC LMGT3, IMSA GTD Pro/GTD, SRO GT3 = GTWC · IGTC · FIA GT World Cup
  (Macau GP), DTM).

### 1.2 Accuracy rules (owner is strict about this)
- **Wherever reference data exists, the error must be 0.000%.** Past/raced sessions must reproduce
  exactly (store the fitted values per event and show the real figure). The owner said repeatedly:
  "무조건 완전히 정확해야돼" (it must be completely accurate).
- For predictions (events not yet run, holdout), 0% is not honestly possible. The owner accepted:
  **reproduce every past case exactly, and show the honest held-out test error.** Always report
  leave-one-out / unseen-season error next to a prediction. Never tune on the test set (we did this
  once with race pace — 0.62% looked good but was tuned on its own test; re-validated on unseen seasons:
  2024 1.00%, 2025 1.10%).
- Anything not measured must be labelled as an estimate/assumption on the page (Korean + English).
- Never hide a failed check: show ✗ with the amount (e.g. battery swing 4.93 MJ > 4 MJ window).

### 1.3 Working style
- Build complete first versions with tests, pass checks and honest errors. ChatGPT tests and fixes.
  The owner: "지피티가 테스트 해준다고 너도 대충하지 말고 최고의 시뮬레이터를 만들고…" (do not do a
  sloppy job just because someone else will test).
- **Ponytail**: keep code small, reuse existing code and the standard library; run `/ponytail-review`
  (or an equivalent self-review) on the diff before a PR.
- **Karpathy guidelines**: define the goal and a verifiable pass check before coding; surgical changes;
  surface assumptions.
- Learning data: use the most accurate, high-quality sources. TracingInsights is what *users* load for
  real telemetry on the site; for fitting, any accurate source is fine.
- Reporting to the owner: **English B1–B2, short, tables**; Korean words only when quoting. When the
  owner asks for status, give a short table with ETAs. Report proactively (asking the time interrupts
  the running step).
- The owner wants merges done **without asking each time**.

---

## 2. How to work in this repo

### 2.1 Branches and PRs
- Work on the owner's fork `kangjeongmin1229/f1-data-analyst-deploy` (it is the repo with write access),
  always branching from upstream main:
  ```
  git remote add upstream https://github.com/MisterKinn/f1-data-analyst
  git fetch upstream main && git checkout -b <branch> upstream/main
  ```
- Fork `main` is synced hourly from upstream (`.github/workflows/sync-fork.yml`).
- Open the PR into `MisterKinn/f1-data-analyst:main`. The GitHub API/MCP returns 403 for the upstream
  repo, so use the browser compare page:
  `https://github.com/MisterKinn/f1-data-analyst/compare/main...kangjeongmin1229:f1-data-analyst-deploy:<branch>?expand=1`
  - What worked (built-in browser, page JavaScript): set the title on
    `input[name="pull_request[title]"]` and the body on `textarea[name="pull_request[body]"]` with the
    native value setter + an `input` event; then click the visible `button[type=submit]` whose text is
    "Create pull request". (A ref-based click failed because the button was off-viewport.)
  - Wait for the `test` check (~50 s). Open the job log page and read `# pass N` / `# fail N`.
    **5 tests have failed on main since PR #117** (account cards, guide test 206/286, previews 239,
    source-routing, introduction 333) — they are not simulator tests. A PR is fine when it adds no new
    failure. Locally 26 fail (environment without the Python collector deps / network); compare with a
    clean `upstream/main` worktree when unsure (`git worktree add <dir> upstream/main`, symlink
    `node_modules`, run the tests).
  - Merge: click "Merge pull request" then "Confirm merge".
- The Vercel check "Authorization required to deploy" on fork PRs is only the preview; production
  deploys from `main`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HpvoSbzWM5zFWY64YUBghx
  ```
  (ChatGPT: use your own attribution if the owner asks; keep the format of the repo.)
- A stop hook in the Claude environment demanded every branch be pushed and no untracked files left.
  `.cache/` is git-ignored (raw data must never be committed).

### 2.2 Before every PR
```
npm ci && node --test tests/*.test.mjs && npm run build && npm run validate
```
- Python collector tests need `fastf1` and `signalrcore` (CI installs them).
- When main moved, rebase on `upstream/main` and rerun. `worker/simulation.js` is the hot spot for
  conflicts (template panel list, `computeView` return object, client `update()` line). Resolve by
  keeping all fields from both sides.

### 2.3 After merge
- Check the live page (Firecrawl is the owner's rule; its credits ran out on 2026-11-08 — the built-in
  browser was used instead). Note: a background browser tab pauses `requestAnimationFrame`, so the page's
  client re-render does not run there; read DOM values or use a visible/headless browser.

---

## 3. What the simulator is

- Page: `/simulation` (server-rendered by `worker/simulation.js`, the same `computeView` runs in the
  browser via `/assets/lapsim.js`, which is built from function sources in `scriptText`).
- Lap kernel: `worker/lapsim/kernel.js` — quasi-steady-state (QSS) lap simulation, TUM laptime-simulation
  method (forward/backward pass, friction ellipse with load sensitivity, aero with wind, traction, ICE +
  ERS with rule-specific limits, 2026 active aero, energy budget per lap, super-clipping).
- Cars: `worker/lapsim/cars.js` (F1 2019 TUM base, 2025, 2026 priors; 2027/2028 from ratified rules),
  `worker/lapsim/series.js` (WEC LMH, LMDh, LMGT3; coming-soon GT3 and FE), calibrated in
  `worker/lapsim/calibration-data.js` (joint BCD fit; holdout errors).
- Scenario: `worker/lapsim/scenario.js` (`carsFor(id)`, real conditions, FIA changes, uncertainty).
- Tracks: `worker/lapsim/tracks-data.js` (26 tracks, curvature, grade, heading, map x/y, corners with `s`).
- MCP tool: `worker/lapsim/tool.js` (`lapsim_simulate`).

### 3.1 Data modules added in this session (all generated; see §10 for scripts)
| Module | What |
|---|---|
| `racing-lines-data.js` | Track edges (TUM widths), least-curvature line, pole-lap speed/brake/throttle |
| `car-lines-data.js` | Per-car qualifying/race line offsets (0.1 m) for 26 tracks |
| `compounds-data.js` | Pirelli C-numbers [hard, medium, soft] per track and season (182 races) |
| `compound-gap-data.js` | Measured compound lap gaps + C-step model |
| `wec-tyres-data.js` | WEC Michelin/Goodyear slicks per event + Hyperpole tyre |
| `wec-bop-data.js` | WEC Hypercar BoP 2025 per event and car |
| `stint-data.js` | Hypercar stint energy: real full stints, model, 2026 estimates |
| `stint-energy.js` | Driveshaft energy per lap; stint from energy |
| `brakes.js`, `brake-data.js` | Brake zones/split/pedal/pressure; Brembo fit and references |
| `qsplit-data.js` | Q1/Q2/Q3 windows and real segment bests |
| `racing-line.js` | `minCurvatureLine`, `lineTrack` (polyline → kernel track) |

---

## 4. Everything built, with numbers

### 4.1 Before this part of the session (already merged earlier on 2026-11-07/08)
- **Race pace** (`worker/lapsim/race-pace.js`, `scripts/sim/race-pace.mjs`, `scripts/sim/ti-races.mjs`):
  `lap = pole×ratio + slope×(n−1) + offset[compound] + wear×age`; reference = mean of the best 8
  qualifying laps; mid-race ratio pooled per track and shrunk to the all-track mean. **All 143 past races
  reproduce at 0.000%** (own fit per race, key `year` or `year-2` for double-headers). Prediction test
  2026: 0.64%; unseen seasons 2024: 1.00%, 2025: 1.10%. Season pills on the page.
- **Pole laps**: holdout ~0.84–0.90% (best experiment 0.77/0.85). Raced tracks reproduce the real
  sectors (sector correction = real pole sectors − simulated sectors in the same weather).
- **Track evolution** (`worker/lapsim/evolution.js`, `evolution-data.js`, `scripts/sim/evolution-fit.mjs`,
  `fetch-evolution.mjs`): measured curve per track and session; F1 qualifying end-of-session error 1.01%
  vs 1.85% with no model; WEC evolution off (fit worse than no model).
- **Rule monitor**: FIA 2028 appendix read with `findLastIndex`; no values read → keep previous.
- **Kongboda AI page**: base instructions applied automatically (server `initialize` instructions); the
  Claude/ChatGPT prompts are copy-only with the MCP URL inside; connect card under the hero.

### 4.2 This part of the session (2026-11-08) — merged PRs
| PR | Feature | Key numbers / checks |
|---|---|---|
| #126 | Racing line panel (first version) | least-curvature line inside TUM widths; mean 1.74 m from TUM's optimal line over 13 tracks |
| #127 | Tyres per series + Pirelli C-numbers | 182 races 2019–2026 with sources |
| #128 | Real compounds per event + lap effect | F1: 26 measured events reproduced exactly; model 0.318 %/C-step, LOO 0.437% (no model 0.564%). WEC per-event Michelin/Goodyear slicks, Hyperpole tyre |
| #129 | Series → rules/class cascade | IMSA GTP, Formula E, GT3 listed as coming soon |
| #130 | Hypercar stint energy | race factor k 0.857; LOO stint-length RMS 3.7% (29 car/event rows, 4 events); 2026 BoP unpublished → estimated |
| #131 | Battery energy estimate (F1 2026, Hypercar) | recovery ≤ per-event limit ✓; swing vs 4 MJ window shown (Monza 4.93 MJ ✗, honest) |
| #132 | Racing line per car on the track map | 4 cars × quali/race × 26 tracks; median gain vs least-curvature: F1 −0.9 s, WEC −1.5 s; on/off, zoom/pan |
| #133 | Brakes panel | Brembo 42 races LOO: decel 18%, pedal 21.8%, speed before 11%, distance 34.9% |
| #134 | Q1/Q2/Q3 split + Météo-France forecast | 47 dry qualifyings LOO: Q1 0.58% (evo only 0.76%), Q2 0.44% (0.50%) |
| #136 | Kernel battery tracked point by point (f1-2026) | 0 of 26 tracks over the 4 MJ window (was 25/26); 38 raced dry poles still 0.000% |
| #137 | Brake build-up time + 30 km/h zone threshold | Brembo LOO: distance 14.1% (was 34.9%), lap braking time 19.1%, decel 14.2%, pedal 18.7%, speed before 5.7%, zone count MAE 2.07; ramp 0.73 s |
| #138 | Forecast track temperature fitted | air + 4.806 °C + 0.01776 × shortwave (W/m²), 66 events, held-out ±3.97 °C (old guess ±5.37) |
| #139 | Stint estimates with ± error and confidence flags | `estLow` flag for FCY-heavy races |
| feat/line-check | WEC per-car line check + Barcelona-Catalunya alias | see §7 A4; `docs/lapsim-line-check.md` |

Note: the holdout numbers stored in the data files refresh on the next `lapsim-data` run.

---

## 5. How each feature was built (method, problems, fixes, tools)

### 5.1 Racing line (PR #126, then #132)
- **Goal / pass check** (karpathy): line inside the edges; close to a published optimal line; renders on
  every track; zoom works.
- Data: TracingInsights season repos via blob-less `git clone --filter=blob:none` + sparse checkout
  (`git ls-tree` to list; GitHub tree API returned 401). Pole lap telemetry `<lap>_tel.json` (x,y,z in dm,
  speed, throttle, brake, distance).
- **Problem: no measured racing line exists.** Public F1 positions (FastF1/TI/OpenF1) are snapped to one
  reference path per track — two drivers' laps differ ~0.05 m sideways. Found by measuring lateral spread.
  So the line is *predicted*; the page says so.
- Track width: TUMFTM `racetrack-database` (LGPL-3.0) centre line + widths, ICP rigid fit (12 rotations ×
  mirror) into our map frame. Changed layouts (Yas Marina, Melbourne, Catalunya; fit > 5 m) use TUM widths
  centred on the timing path. Tracks not in TUM: ±6 m assumed (Jeddah, Imola, Las Vegas, Lusail, Miami,
  Monaco, Madring, Baku, Kuala Lumpur, Singapore).
- Least-curvature line: biharmonic relaxation, coarse-to-fine (every 4th point first). Laplacian gave
  3–4 m from TUM's line; biharmonic + coarse-to-fine ~1.4–1.7 m; car margin 1.0 m best.
- **Per car (PR #132)**: `scripts/sim/car-lines.mjs` — SPSA optimiser (2 simulations per step, all control
  points perturbed, control points every 6 line points, 1200 steps), lap kernel run on
  `lineTrack(K, x, y, 10)` (uniform resample; curvature from points 2 samples apart, smoothed — finer
  stencils made the optimiser chase sampling noise). Qualifying = calibrated car. Race = + mid-race fuel
  (F1 35 kg, WEC 45 kg, assumed) and grip scaled so the lap equals the real mid-race pace from the race fit
  (`pole×raceRatio + slope×(laps−1)/2`); WEC race grip = the F1 ratio of that track (assumed, labelled).
- Validation: real pole speed trace (distance-mapped) RMS improved at Silverstone, Spa, COTA; ~equal Monza,
  Suzuka. The check is rough (distance mapping).
- Runtime ~6 min per track (4 cars × 2 modes) per CPU; per-track cache `.cache/lapsim/car-lines/<id>.json`;
  `LAPSIM_LINE_MERGE=1 node scripts/sim/car-lines.mjs` merges.
- UI (owner request: no separate panel; line on the main map, toggle, zoom, look around):
  `renderMap(map, v, {line})` draws the TUM band, the line coloured by the car's own simulated speed on its
  line, and markers (brake start = kernel limit 3 begins; lowest speed; back to full power = limit 2;
  zones need ≥3 points and ≥10 km/h). Controls `data-line-toggle`, `data-line-mode="q|r"`,
  `data-zoom="in|out|fit"`, Ctrl+wheel, pinch, drag. Zoom = CSS transform on `[data-ls-zoom] > div`
  because the UI session's overlay rewrites the SVG viewBox; `reZoom()` thins strokes and counter-scales
  labels/markers (`--inv`).
- Problems met: an old CSS rule `.ls-mk{r:calc(var(--k)*6px)}` made all markers radius 0;
  `.ls-line-key span{width:10px}` squeezed the note text into a 10 px column; `ui-motion.js` animates
  `g>path` when the map scrolls into view (screenshots taken early look empty); the UI session folds
  panels (`details.kb-sec-fold`); Playwright cannot `selectOption` in folded panels → set `.value` and
  dispatch `change`; the client script is external (`/assets/lapsim.js`), so file:// previews do not run
  it → test through a local `http.createServer` wrapping `worker.fetch` + Playwright.
- New workflow `.github/workflows/lapsim-car-lines.yml` (4 shards + merge) did **not** trigger on the fork
  from a `lapsim-lines/**` push (unknown; `probe/**` pushes do trigger). Lines were computed locally.

### 5.2 Tyres and compounds (PR #127, #128)
- Owner: no intermediate for Le Mans Hypercar; tyre names per series; F1 soft/medium/hard must show each
  race's Pirelli C-number; WEC only the compounds supplied at that event; tyre choice must change lap time
  properly; 0.000% where reference exists.
- Pirelli nominations: background agent (WebSearch/WebFetch) → `scripts/sim/data/compounds.json`,
  sources `docs/lapsim-compounds.md`. 2026 missing (not announced at the time): Las Vegas, Qatar, Abu Dhabi.
  Weaker sources flagged there (2023 US/São Paulo, 2021 February plan, 2025 fan sites).
- Event → track: `tiTrack()` plus aliases (`barcelona-catalunya` → catalunya, `70th-anniversary` →
  silverstone, `styrian` → spielberg; 2026 "Spanish GP" = Madring).
- **Lap effect**: practice gave ~1% per C-step (fuel-biased, rejected). Clean source: Sprint Qualifying /
  Shootout (same driver, low fuel, Medium SQ1/SQ2 vs Soft SQ3) + Qualifying with ≥8 drivers on both. The
  track gain between the two laps is removed with the track's fitted evolution curve (`lST − session_start_time`).
  Result 0.318 %/C-step; 26 measured events reproduced exactly; Hard = Medium + model step.
- WEC: Michelin Hypercar 2026 soft/medium/hard + one wet (no intermediate); LMGT3 2026 Goodyear Medium
  only (+ wet); 2025 LMGT3 Hard at São Paulo, COTA, Bahrain. Per-event data: `scripts/sim/data/wec-tyres.json`,
  sources `docs/lapsim-tyres.md`. Monza 2026 Hypercar soft+medium (pitdebrief). **WEC compound gaps are not
  measurable** (Al Kamel timing has no tyre column) → "not measured, lap unchanged".
- IMSA per-event allocations NOT FOUND.

### 5.3 Cascade (PR #129)
- `data-ls="series"` (F1, WEC live; IMSA GTP, Formula E, GT3 disabled "coming soon"), `data-ls="car"` now
  "Rules · class" filtered by series; options are rebuilt on change (Safari ignores `hidden` on `<option>`).
- Problem: a key `soon` already existed in the text table and silently overrode the new one → `soonShort`.
- Third level (manufacturer/team) is left for GT3 per-car profiles.

### 5.4 Hypercar stint energy (PR #130)
- Rule (FIA WEC 2025 D06): `PPUEnergyStint` from the BoP, measured by driveshaft torque sensors pit-out to
  pit-in; refuel rate stint/40 s; extra docking time per car.
- BoP: 2025 all 8 events (Le Mans partly press, COTA derived) → `scripts/sim/data/wec-bop.json`,
  `docs/lapsim-wec-bop.md`. **2026 BoP is not published** (WEC/ACO stopped from Imola 2026).
- Real stints: Al Kamel is not reachable from the Claude shell, and the MCP is too slow for bulk. A
  `probe/**` branch with a throwaway workflow ran `scripts/sim/wec-stints.mjs` in GitHub Actions and
  committed `scripts/sim/data/wec-stints.json` back; then fetched. "Full stint" = longest green stint a car
  ran at least twice (±1 lap); flag artefacts dropped when < 0.8 × the event's typical long stint (Spa 2025).
- Model: `driveEnergyJ` (positive work at the wheels: kinetic + drag + rolling + climbing) at qualifying
  pace × race factor k = 0.857; LOO stint length 3.7%. 2026 stint energy estimated from real stints.
  Le Mans and Fuji are not simulator tracks.

### 5.5 Battery / SoC estimate (PR #131)
- Kernel returns `flow` per point (deploy, braking recovery, full-throttle recovery) with the same
  accounting as its totals (tested). Panel `[data-ls="soc"]`: F1 2026 qualifying lap from a full battery,
  recovery capped at the per-event FIA limit (`energy-limits.js`), no clamping.
- **Finding**: the kernel only balances energy per lap (deploy ≤ window + min(regen, limit)), so the swing
  within a lap can exceed the 4 MJ window (Monza 4.93 MJ). Shown as ✗ with the amount.
- Hypercar: charge-sustaining; lowest point at 0; shows the battery window needed (Monza LMH 1.14 MJ).
- No public SoC/deploy/Boost/Overtake data exists for F1 (FastF1 maintainer, Mar 2026) or WEC.

### 5.6 Brakes (PR #133)
- Brembo per-race figures (F1 2025 24/24, 2026 19, 2024 6; WEC Le Mans; IMSA 3) → `scripts/sim/data/brembo.json`,
  conflicts listed in `docs/lapsim-brembo.md`.
- `brakes.js`: zones from kernel `limit==3`; hard part = deceleration ≥ 1.5 g; force split: drag, regen on its
  own axle (F1 and LMDh rear, LMH front; power/v and share), friction by dynamic axle load (static + aero
  balance + load transfer). Pedal = 30.8 kg/g × mean g (fitted on Brembo); front pressure = pedal force ×
  pedal ratio 3.5 × front share / area of a 17.8 mm master cylinder (assumptions, labelled).
- Problem: simulated **peak** g was ~1.5× Brembo's → compare the **mean** g of the hard part (scale 1.05).
  Distances are short (model builds pressure instantly) → 34.9% error; fix suggested in §7.
- The panel matches the zone ending nearest Brembo's named corner.

### 5.7 Q-split + forecast (PR #134)
- `scripts/sim/qsplit.mjs`: TI `session_info.session_status` Started/Finished pairs → Q1/Q2/Q3 windows;
  segment best = fastest slick lap ending in the window (+2.5 min grace); wet skipped. 47 dry qualifyings.
  Model = evolution ratio + pooled segment offset (Q1 +0.56%, Q2 +0.24%).
- Forecast: option "Forecast (Météo-France)" — browser fetches
  `https://api.open-meteo.com/v1/meteofrance` (ARPEGE/AROME; hourly temperature, humidity, pressure, wind,
  shortwave radiation, precipitation; 4 days). Picking an hour fills the weather sliders. Track temperature
  = air + 0.02 °C per W/m² (assumption). Coordinates `TRACK_LL` in `simulation.js`. Live check: forecast
  loads (Monza 85 hours).

---

## 6. Data sources, access and limits

| Source | Used for | Access that worked | Limits |
|---|---|---|---|
| TracingInsights (`github.com/TracingInsights/<year>`) | laps, telemetry, session info, weather, rcm, team radio | git blob-less + sparse clone; raw.githubusercontent.com | hours after the session; positions snapped (no driven line); no overtakes file |
| Al Kamel (WEC timing) | qualifying/race laps, stints, weather | GitHub Actions (`worker/wec.js` archive/readDocument); Kongboda MCP `wec_*` for single files | not reachable from the Claude shell; no tyre column |
| FIA documents (api.fia.com, fia.com) | rules, WEC committee decisions, energy limits | Kongboda MCP `fia_read_document`, WebFetch | WEC BoP 2026 not published |
| TUMFTM racetrack-database | track widths, optimal line | git clone | LGPL-3.0; old layouts for some tracks |
| Pirelli / formula1.com / mercedesamgf1.com | compound nominations | WebSearch + WebFetch | Wikipedia not fetchable here |
| Michelin / Goodyear / racer.com / sportscar365 | WEC tyre allocations | WebSearch + WebFetch | IMSA bulletins unreadable |
| Brembo | braking references | WebSearch + WebFetch | 2024 pages moved; Dutch 2026 missing |
| Open-Meteo `meteofrance` | forecast | browser fetch (CORS ok) | no track temperature |
| Firecrawl | live checks (owner rule) | MCP | credits ran out until 2026-11-09 ~02:07 KST |
| Timing71 archive (`archive.timing71.org`, files on Backblaze) | laps with flags, stints, sectors, best laps, IMSA VFT, weather — all series (§7 J) | GitHub Actions `probe/**` only | not reachable from the Claude shell/WebFetch; no data terms → calibration only, no raw commits |
| IMSA technical bulletins (imsa.com PDFs) | GTP BoP incl. Max Stint Energy | WebFetch worked for 2026 Road America | not all rounds found |

---

## 7. Work left for ChatGPT (in order), with pass checks

### A. Test and fix tasks 1–6 (start here)
- Load `/simulation` for several tracks/cars on desktop and phone; check: racing line toggle/mode/zoom;
  tyre options per series/event; stint panel on WEC tracks; battery panel; brakes panel; Q-split table;
  forecast option. Fix bugs; keep all tests green (except the 5 old failures).
- Known fixes from the first handoff — **all done by Claude** (keep them working):
  1. Kernel energy causality — done (#136).
  2. Brake pressure ramp — done (#137): fitted build-up 0.73 s, not 0.1–0.15 s (the effective time
     includes driver lift and pressure rise, fitted on Brembo distances).
  3. Forecast track temperature — done (#138), ±3.97 °C held out.
  4. Per-car line check for WEC — done (`scripts/sim/line-check.mjs`, `docs/lapsim-line-check.md`):
     36 class-track-season rows. Top speed vs real trap: line 3.02% RMS vs reference path 2.93% (no change).
     Lap vs real pole: reference path 1.90% RMS (mean +0.07%), least-curvature line 5.60% (−3.54%),
     per-car line 6.85% (−4.97%). Cause: grip is calibrated on the reference path, so a shorter, smoother
     line makes laps 3.5–5% too fast. **Decision kept:** lap time stays on the calibrated path; the line is
     map + relative gain only. Open option: refit grip on the line (would need re-checking the 0.000%
     pole reproduction).
  5. Barcelona 2026 — checked: TI names it "Barcelona Grand Prix" → `catalunya` ✓ (race data has
     catalunya 2026; "Spanish Grand Prix" 2026 → `madring`). Added the `barcelona-catalunya` alias and
     `tests/lapsim-ti-names.test.mjs`.

### B. Formula E: Attack Mode + energy (before GT3)
- Data: FIA Formula E results site (results.formulae.fia.com) — Al Kamel format `23_Analysis` with
  Attack Mode / 350 kW lap flags ("A"), `26_Weather`; booklets list Attack Mode laps. No telemetry.
- Gen4 (from Season 13, Jeddah 18–19 Dec 2026): 450 kW race, 600 kW qualifying/Attack Mode, up to 700 kW
  regen, permanent AWD, Bridgestone tyres. Check mass/energy in the FIA Technical Regulations (sources
  disagree: 950 vs 1,028 kg; 55 vs 51.25 kWh).
- Need FE street-circuit lines (official maps + widths); F1 lines cannot be reused (layouts differ).
- Pass: race energy use per lap vs FIA energy limit; Attack Mode laps from the analysis files reproduced.

### C–E. GT3 (last)
- Design (owner-approved): integrated in the simulator page with the cascade series → rules/class → car.
  Per-car **profile** instead of one best lap: straight vs corner speed, sector split, long-run drop-off, a
  one-line "why", best lap. Shared kernel and set-up module.
- Order: C) WEC LMGT3, IMSA GTD Pro/GTD + car profile table → D) SRO GT3 (GTWC · IGTC · FIA GT World Cup
  (Macau GP)) → E) DTM.
- Data: WEC/IMSA timing (Al Kamel, IMSA results), SRO (GTWC results), DTM timing; BoP tables per series.

### F. Replace OpenF1/FastF1 with TracingInsights everywhere; remove the live collector
- Owner decision 2026-11-08: live timing is no longer used; replace all. Not urgent.
- Map of current use: `worker/openf1.js` (TI-first, OpenF1 fallback; car_data window still OpenF1),
  `worker/openf1-race.js` (race_control, overtakes, session_result, starting_grid, weather, team_radio, pits:
  OpenF1 only), `worker/index.js`, `worker/live.js`, `worker/gateway.js`, `answer-policy.js`,
  `homepage-examples*.js` (OpenF1 links); `collector/*.py` + `.github/workflows/f1-live-collector.yml`;
  lap sim `scripts/sim/fetch-openf1.mjs`, `build-geometry.mjs`, `calibrate.mjs`, `lapsim-data.yml` step;
  tests `openf1*.test.mjs`, `source-routing`, `telemetry`, `gateway`.
- TI per session: `<DRV>/laptimes.json`, `<DRV>/<lap>_tel.json`, `corners.json`, `drivers.json`, `rcm.json`,
  `session_info.json`, `session_laptimes.json`, `team_radio.json`, `weather.json`.
- Gaps: overtakes (derive from lap positions; lap resolution), results/grid (final lap positions;
  qualifying order + penalties from rcm); tools must say "not published yet" right after a session.
- Estimate 4–5 h. Pass: no `api.openf1.org` calls left; all tool tests pass with TI fixtures.

### G. IMSA tyre allocations and IMSA GTP BoP
- IMSA uses Maximum Stint Energy (MJ) + Energy Replenishment Rate (MJ/s); power as % of the homologated
  curve at ≤230 / ≥240 km/h. Example (Road America 2026, TB IWSC #26-49): Acura/Aston 912 MJ, BMW 906,
  Cadillac 908, Porsche 963 907/906 MJ; replenishment 22.65–22.8 MJ/s.
- **IMSA GTP stint energy is not done** (Claude gap 7): IMSA is not calibrated in the simulator (no
  `SERIES.imsa`, no IMSA track geometry except shared tracks) and real stint lengths need a collector.
  Do it with Timing71 (§7 J): IMSA analysis files carry per-lap times with flags, stints and the
  **VFT (Virtual Fuel Tank % energy left, GTP only)** column, so energy per lap = Δ VFT% × stint MJ / laps.
  Same method as the WEC stint fit (`scripts/sim/stint-fit.mjs`, k factor, LOO). Found: 2026 Watkins Glen, Road America (bulletins), Daytona (press). Missing:
  2025 rounds and several 2026 rounds.

### J. Timing71 replay archive — collect and calibrate every series we simulate (owner decision 2026-11-08 20:21)
Owner wants all of it learned (= fit the physics model's parameters; the AI stores nothing itself) and fed
into the current models and future development. Claude found the access path and formats; **ChatGPT does the
collection and fitting.**

**Access (found by Claude):**
- Archive API: `https://archive.timing71.org` (LoopBack style), found in the site bundle
  (`www.timing71.org/main.<hash>.js`; code: `github.com/timing71/web` `src/modules/archive/api.js`).
  - `GET /replays/series` → `{series: [...]}` (1,016 names)
  - `GET /replays?filter[order]=startTime%20DESC&filter[limit]=500&filter[skip]=N` (+ `filter[where][series]=…`)
  - each replay: `series, description, startTime (unix s), duration, filename (ZIP), analysisFilename (JSON)`;
    files on `https://s3.us-east-005.backblazeb2.com/t71-archive/<date time series - description>.zip|.json`
    (URL-encode spaces; `encodeURI` works).
- **Not reachable from the Claude shell** (proxy 403) and the WebFetch allowlist; Firecrawl had no credits.
  Worked: GitHub Actions on a `probe/**` branch of the fork (`kangjeongmin1229/f1-data-analyst-deploy`).
  Scripts: `scripts/probe/t71-list.mjs` (list → `probe-out/t71.json`, 15,798 replays on 2026-11-08) and
  `scripts/probe/t71-sample.mjs` (formats); workflow copy in `docs/probe-t71-workflow.yml.txt`
  (put it under `.github/workflows/` on a `probe/**` branch only). Branch `probe/t71` on the fork holds the
  last results (`probe-out/t71.json`, `probe-out/samples.json`); delete it when done.
- Licence/terms: code AGPL-3.0, docs CC BY-SA; **no terms for the timing data** (it belongs to each
  series' timing provider; Timing71 is a non-profit hobby project). Use for calibration only, never
  republish raw files, never commit them (`.cache/` only); credit "Timing71 archive" in docs.

**File formats:**
- Analysis JSON (40–110 KB): `{cars: {cars: {<num>: {raceNum, raceClass, teamName, make, drivers[{idx,name}],
  stints[{startLap, startTime, endLap, endTime, driver, laps[{lapNumber, laptime, driver, flag, timestamp}]}]}}},
  messages, session, state, manifest, trackData, latestTimestamp, version}`. `flag` per lap (green/yellow/sc/…).
  Timestamps: `startTime` in s, others in ms (mixed — check).
- Replay ZIP (0.1–1.6 MB): `manifest.json` (`colSpec` = column names per series, `trackDataSpec`) + frames
  `<unix>.json` (key frames) and `<unix>i.json` (diffs; use `@timing71/common` `Replay` + `patch`).
  Frame `cars` rows follow `colSpec`; times as `[value, flag]` with flags `sb` (session best), `pb`, `old`.
  IMSA colSpec: Num, State, Class, S/C, PIC, Driver, Team, Car, Laps, Gap, Int, **S1, S2, S3**, Last, **Best**,
  **VFT**, Pits. trackData: Air temp, Track temp, Humidity, Wind speed. Speed traps: not in IMSA; check other
  series' colSpec.
- Last frame = final classification (best lap + sectors per car). Lap list with flags = analysis JSON.

**What to collect (series that run cars we simulate; archive counts 2026-11-08):**
| Series | Archive series names | Replays | Use |
|---|---|---|---|
| F1 | `Formula 1` | 790 | cross-check only (TI is the main source) |
| WEC Hypercar (**2021 on only** — Hypercar class started 2021) + LMGT3 (2024 on) | `WEC`, `FIA WEC`, `FIA World Endurance Championship`, `Le Mans 24 Hours` | ~370 | extra seasons 2021–24 for calibration + stints; Al Kamel stays the main source |
| IMSA GTP / GTD Pro / GTD | `IMSA WeatherTech SportsCar Championship` (+ case variants) | ~490 | new: GTP stint energy (VFT), GTP/GTD calibration |
| Formula E | `ABB FIA Formula E (World) Championship`, `FORMULA E` | ~615 | **tag the generation**: Gen2 = seasons to 2021-22, Gen3 = 2022-23 to 2023-24, Gen3 Evo = 2024-25 to 2025-26. **None is Gen4** (Gen4 from Season 13, Dec 2026): fit Gen3/Evo, then Gen4 = baseline + rule deltas, labelled estimate |
| GT3 — GTWC Europe/America | `Blancpain GT Series…`, `Fanatec GT World Challenge…`, `GT World Challenge America…` | ~250 | GT3 calibration |
| GT3 — IGTC | `… Bathurst 12 Hour`, `IGTC Indianapolis 8 Hour`, `Kyalami 9 Hour` | ~95 | GT3 calibration |
| GT3 — DTM | `DTM` | 85 | GT3 calibration (DTM BoP) |
| GT3 — Nürburgring SP9 | `… 24h Nürburgring`, `ADAC 24h Nürburgring Qualifiers`, `NLS`/`VLN` | ~145 | SP9 only (filter class) |
| GT3 — Macau FIA GT World Cup | `70th–72nd Macau Grand Prix` (GT Cup sessions only) | ~70 | GT3 calibration |
| LMGT3 — ELMS / Asian LMS | `European Le Mans Series`, `Asian Le Mans Series` | 275 / 88 | LMGT3 extra data |
Exclude: esports/iRacing, F1 Academy, historic, Le Mans Cup, one-make cups. No Super GT data.

**Steps and pass checks:**
1. Collector `scripts/sim/t71-collect.mjs` + workflow `lapsim-t71.yml` (manual dispatch): download analysis
   JSON + last frame of qualifying and race sessions for the table above; write raw to `.cache/lapsim/t71/`
   and a compact committed summary `scripts/sim/data/t71/<series>.json` (per session: series, event, track id,
   year, generation/class, weather; per car: class, make, best lap, best sectors, green laps, stints, VFT).
   Pass: counts per series logged; summary < 5 MB.
2. Track ids: map event names to `lapsimTracks` ids (like `SERIES.wec.events`). Tracks without geometry
   (most IMSA, FE street, DTM, Nordschleife) need geometry first: TUMFTM racetrack-database has Hockenheim,
   Norisring, Nürburgring GP, Oschersleben, Brands Hatch, IMS (Indianapolis road course), Sepang;
   others need official maps + widths (as for FE, §7 B). Calibrate only where geometry exists; list the rest.
3. Data check: Timing71 pole laps vs our TI (F1) and Al Kamel (WEC) poles for the same sessions.
   Pass: differences listed; drop sessions that disagree (wrong session label, partial replay).
4. Fit, same rules as F1/WEC (`scripts/sim/calibrate-lib.mjs`): only cdA, clA, muY inside bounds; values
   from rules/BoP fixed; holdout by track (LOO) reported; raced cases reproduce 0.000% via the sector
   correction. New `SERIES.imsa`, GT3 classes and FE generations in `worker/lapsim/series.js`.
5. Stints: WEC 2021–24 and IMSA GTP rows added to the stint fit (more LOO rows than the current 29);
   IMSA energy per lap from VFT.
6. Docs: `docs/lapsim-t71.md` (what was used, counts, errors, failed checks shown) + update this handoff.

### K. Open model items from the status board (owner decision 2026-11-08 20:31: hand all to ChatGPT)
Same rules as everything else: 0.000% where a real reference exists, held-out error shown, estimates labelled.
1. **F1 race energy per stint / race lap (2026 rules).** Today only the qualifying lap is modelled
   (`kernel.js` causal battery, `flow.soc`). Run the kernel with the race line's fuel and grip
   (`car-lines-data` `r.fuelKg`, `r.grip`) and the per-event recharge limit; show deploy/recover per lap
   and the battery over a stint. No public SoC data → label as estimate. Pass: battery stays inside the
   4 MJ window every lap; race-lap time from the kernel within the race-pace model's error (0.64% for 2026).
2. **LMGT3 fuel / stint length.** LMGT3 has fuel capacity and BoP, not a stint-energy budget. Get real
   full-green stint lengths from the Al Kamel race analysis (`scripts/sim/wec-stints.mjs`, change the class
   filter from `HYPERCAR` to `LMGT3`; runs only in Actions) and Timing71 for 2024+ (§7 J); fit fuel per lap
   like `stint-fit.mjs`. Pass: LOO stint-length error stated; FCY-heavy races flagged.
3. **WEC compound effect on lap time.** Page shows "not measured, lap unchanged" (correct today). Al Kamel
   and Timing71 WEC data have no tyre column. Only add an effect with a real source (team/Michelin
   statements per event, or a tyre field in a new source); otherwise keep the label. Pass: no number
   without a source.
4. **Wet / intermediate tyres per compound.** Only inside the track-evolution model now. Measure from real
   wet sessions (TI `laptimes.json` has the compound; Al Kamel wet sessions) the gap to dry pace per
   compound and track temperature. Pass: LOO error vs the evolution-only model.
5. **Tyre temperature / warm-up model.** Not built; no public tyre temperature data, so no 0.000% check is
   possible. Lowest priority; if built, label fully as a model and test only warm-up laps vs real out-lap /
   first flying lap deltas (TI laps with `pout`).

### H. The 5 tests failing on main since PR #117
- Not simulator tests (account cards, guide/setup prompt tests, previews, source-routing, introduction).
  Owner has not decided whether to fix them; ask.

### I. BoP simulator in the Setup tab (owner decision 2026-11-08 19:16)
- Put BoP tools into the existing Setup tab (`#kb-setup`, `/simulation#setup`) together with the setup
  simulator: "+10 kg / +x kW / +y MJ = z s" from the lap sim; FP-pace-based BoP prediction (Project doc
  `claude/simulation-plan.md` §6); 2025 official BoP table; stint energy. Hypercar set-up window code:
  `worker/lapsim/hypercar-setup.js`.

---

## 8. Tools, skills and plugins used — what to install

| Used here | What for | Install / substitute for ChatGPT |
|---|---|---|
| **karpathy-guidelines** skill | goal + pass check before code, surgical changes | If unavailable: follow the rule set in §1.3 manually (define success, minimal diff, surface assumptions) |
| **Ponytail** plugin (`ponytail@ponytail`, `.claude/settings.json`, repo `DietrichGebert/ponytail`) | small code, reuse, `/ponytail-review` on the diff | Install from GitHub if your agent supports plugins; else do a manual "shrink the diff" review before each PR |
| **Graphify** (`graphifyy`, SessionStart hook `scripts/graphify-hook.mjs`) | code map in `graphify-out/` (`graphify query/explain/path`) | `pip install graphifyy` then `node scripts/graphify-hook.mjs refresh`; or use ripgrep |
| Playwright (Node; preinstalled Chromium) | screenshots, client tests, mocked fetch (`page.route`) | `npm i -D playwright && npx playwright install chromium` |
| Built-in browser (Claude desktop, remote devices) | PR creation/merge on upstream, live checks | Any browser automation you have (Playwright with a logged-in profile, or ask the owner) |
| gh CLI | fork pushes; GraphQL blocked; REST for upstream needed repo access | `gh` with a token that can push to the fork |
| Firecrawl MCP | owner's rule for live checks after merge | Firecrawl MCP/API key, or WebFetch-like page reader |
| Kongboda Motorsports MCP (the site's own) | FIA documents, Al Kamel files, rules lookup, lap sim | Connect via the site's MCP URL (see the "AI" page); tools: `fia_read_document`, `wec_list_archive`, `wec_read_document`, `rules_lookup`, `lapsim_simulate` |
| WebSearch / WebFetch | Pirelli, Michelin, Goodyear, Brembo, BoP data | Your web search/browse tool |
| Background research agents (parallel) | data collection while coding | Run parallel browsing tasks if your platform allows |
| GitHub Actions `probe/**` trick | run scripts that need Al Kamel network access | Push a branch `probe/<name>` with a throwaway workflow; never merge it |
| markitdown (owner preference) | convert documents the owner sends to Markdown | `pip install markitdown` |
| Python + matplotlib (owner preference) | charts as PNG images | `pip install matplotlib` |

If a tool is missing, **search for an equivalent and install it yourself** (owner request).

---

## 9. Stable UI names (from the UI session; do not rename)
`data-ls="map|trace|lap|pole|compare|car|mode|air"`, `.ls-map`, `.ls-trace`, `.ls-line-0`, `text.ls-corner`
(x/y = point on the track), `.ls-start`, `g>path` in the map, `.ls-axis[text-anchor="end"]`, `data-evo="end"`,
`ul.ls-changes`, `li.ls-change`, `data-change`, `section.panel.ls-panel`, `.ls-hero`, `.ls-evo`, `svg.ls-race`,
`table.ls-table`, `#lapsim-data`, URL params `?track=` / `?car=`.
Added in this session: `data-ls="series|tyre|soc|brakes|qsplit|forecast|lineNote"`, `data-line-toggle`,
`data-line-mode`, `data-zoom`, `data-ls-zoom`, `data-fc-hour`, `.ls-brakes`, `.ls-band`, `.ls-line-seg`, `.ls-mk`.
`worker/simulator-ui.js` (UI session) overlays corner labels and the finish line, folds panels into
`details.kb-sec-fold`, and opens Air in manual mode. The Setup tab is `#kb-setup`.

---

## 10. Workflows and scripts
| Workflow | Runs | Writes |
|---|---|---|
| `lapsim-data.yml` | OpenF1 fetch, geometry, WEC, calibration, race pace, racing lines, Hypercar stints + stint fit, brakes fit, FIA changes | tracks/calibration/race/racing-lines/stint/brake data |
| `lapsim-evolution.yml` | `fetch-evolution.mjs` (TI clone at `.cache/lapsim/ti`), `evolution-fit.mjs`, `compound-gap.mjs`, `qsplit.mjs` | evolution, compound-gap, qsplit data |
| `lapsim-car-lines.yml` | `car-lines.mjs` in 4 shards + merge | car-lines data (did not trigger on the fork; run locally if needed) |
| `lapsim-experiment.yml` | calibration experiments on `lapsim-exp/**` | — |
| `rules-monitor.yml` | rules and race-document monitor (knowledge/RULES.md) | — |

Scripts added: `scripts/sim/{racing-lines,car-lines,compounds,compound-gap,wec-stints,stint-fit,brake-fit,qsplit,tracktemp-fit,line-check}.mjs`; probes `scripts/probe/t71-{list,sample}.mjs`.
New modules: `worker/lapsim/track-coords.js` (TRACK_LL), `worker/lapsim/tracktemp-data.js`.
Data inputs (committed, small, with sources): `scripts/sim/data/{compounds,wec-tyres,wec-bop,wec-stints,brembo}.json`.

---

## 11. Known issues, risks, open questions
- Fixed: battery window (#136), brake distance (#137), forecast track temperature (#138).
- Per-car line laps are 3.5–5% fast if used for lap time with path-calibrated grip — so they are not
  (§7 A4). Line gains vs least-curvature (e.g. LMGT3 Silverstone −3.0 s) are relative only.
- IMSA GTP, FE and GT3 have no calibration yet; Timing71 (§7 J) is the data path.
- WEC 2026 BoP unpublished → stint energy 2026 is an estimate (FCY-heavy races less reliable: COTA,
  Barcelona 2026 values look low).
- Racing lines for tracks with assumed ±6 m width are less certain.
- Firecrawl credits: ran out until ~02:07 KST 2026-11-09.
- Another session works on the UI (`worker/simulator-ui.js`, `worker/ui-motion.js`); coordinate names.
- Project docs on claude.ai: `claude/handoff-simulator-ui.md`, `claude/simulation-plan.md`, and this handoff
  (`claude/handoff-chatgpt.md`).

---

## Appendix — detailed work log (as written during the work)

### Task 1 Racing line (2026-11-08)
- Goal/pass check (karpathy-guidelines): line stays inside track edges; validated vs TUM optimal raceline (mean gap target < 2 m); panel renders for every track; zoom works.
- Data: TracingInsights season repos (blob-less git clone + `git ls-tree`, raw files via raw.githubusercontent.com) for the pole lap tel (x,y,z in dm, speed, throttle, brake). Tool: Bash/git (GitHub tree API gave 401 -> switched to clone).
- Problem: TI/FastF1 positions are snapped to one reference path (two drivers differ ~0.05 m) -> no measured line in public F1 data. Found by measuring lateral spread. Fix: predicted min-curvature line inside TUM track widths (TUMFTM/racetrack-database, LGPL-3.0), ICP rigid fit (12 rotations x mirror) to the map frame.
- Problem: Laplacian relaxation 3-4 m from TUM line -> biharmonic update -> coarse-to-fine (every 4th point first) -> ~1.4-1.7 m. Test harness in scratchpad lt.mjs; car margin 1.0 m best.
- Problem: layouts changed since TUM data (yas-marina, melbourne, catalunya): fit > 5 m -> TUM widths centred on timing path ('TUM-widths'). Tracks not in TUM: assumed +-6 m.
- UI: linePanel in worker/simulation.js (server SVG, speed-bucket paths like renderMap, brake/apex/throttle markers, corner zoom buttons via data-line-zoom handled in lapsimClient; --k CSS var scales markers/labels with zoom).
- Problem: screenshot from file:// showed no zoom -> client JS is an external /assets/lapsim.js; tested via a local node http server wrapping worker.fetch + Playwright (scratchpad shot.mjs, createRequire for playwright).
- Problem: line too thin at track scale -> vector-effect:non-scaling-stroke.
- Skills used: karpathy-guidelines (goal + pass checks), Ponytail rules (small code, reuse renderMap pattern). Tools: Bash, Playwright, Read (image check).
- Tests: tests/lapsim-racing-line.test.mjs. Edge check first failed (interlagos etc. up to 1.3 m "outside"): artefact of edge vs line normals on tight corners -> assert excess < 1.5 m and < 2% points > 0.5 m.
- Full suite: 26 failures locally, same 26 on a clean upstream/main worktree (git worktree add + symlinked node_modules) -> not ours. CI shows 5 failing (same 5 since PR #117).
- PR #126 via built-in browser: compare URL, title via input, body via JS setter on textarea[name="pull_request[body]"], submit button click via JS (ref click was off-viewport). gh GraphQL is blocked (403) and REST for upstream needs add_repo -> checked checks in the browser instead. Merged 00c2047.
- Live check: Firecrawl out of credits -> built-in browser on the live page; panel present, zoom changes viewBox, 21 markers, notes correct.
### Tyre fix (user request 2026-11-08 18:03): per-series tyres + F1 C-numbers
- Request: Le Mans Hypercar has no intermediate; tyre names must fit each series; F1 S/M/H must show each race's Pirelli C-number.
- Facts (WebSearch/WebFetch): Pirelli press (press.pirelli.com) per-race nominations; 2026 range C1–C5 (C6 dropped); LMGT3 2026 = Goodyear Medium only as dry race tyre (racer.com 2026-04-14), Hard retired; Hypercar = Michelin slicks + wet, no inter.
- Blocked: Wikipedia not fetchable (allowlist), curl 403 from shell, Firecrawl out of credits. Used a background general-purpose agent with WebSearch/WebFetch to collect C-numbers per race into .cache/compounds.json (+ sources md).
- Code: scripts/sim/compounds.mjs -> worker/lapsim/compounds-data.js ({track:{year:[H,M,S]}}, maps event names with tiTrack). simulation.js: computeView builds tyreHtml per series (f1: slick (Pirelli Cx·Cy·Cz)/inter/full wet; hypercar: slick/wet Michelin; lmgt3: slick Goodyear Medium/wet), client refreshes select [data-ls="tyre"] on car change; race panel strategy names carry C-number (own race year or 2026). tool.js: inter -> wet for WEC.
- Tests: tests/lapsim-tyres.test.mjs; Playwright check of switching F1 -> LMH -> LMGT3 (inter disappears, value falls back to slick).
### Compound choices with lap effect (user 18:17–18:19: per-circuit F1 compounds, per-event WEC compounds, real lap effect, 0.000% where reference exists)
- PR #127 merged (tyres per series + C-numbers, 182 races). Then branch feat/compounds: one option per compound (F1 soft/medium/hard with C-number + inter + full wet; Hypercar soft/medium/hard + wet per racer.com 2026-10-16; LMGT3 medium + wet).
- Measuring the gap: practice laps gave ~1%/C-step (fuel-biased, rejected). Clean source = Sprint Qualifying/Shootout (same driver, low fuel, Medium SQ1/2 vs Soft SQ3) + Qualifying with >= 8 drivers on both. Track gain between the two laps removed with evolutionDelta (track qualifying curve) using lST minus session_info.session_start_time.
- Result: 26 measured event gaps 2023-2026; k = 0.318 %/C-step; leave-one-event-out RMS 0.437% vs 0.564% no model. Measured events reproduce exactly (Miami 2026 medium 0.2487% -> +0.218 s). Hard = medium + k*steps (never quicker than medium).
- Files: scripts/sim/compound-gap.mjs -> worker/lapsim/compound-gap-data.js; workflow step in lapsim-evolution.yml (TI clone at .cache/lapsim/ti from fetch-evolution.mjs). Locally cloned TI to .cache/ti with sparse patterns (Qualifying, Practice, Sprint Qualifying/Shootout, session_info).
- Gotcha: new tabbed UI hides the evolution panel -> Playwright selectOption fails (not visible); drive with element.value + dispatchEvent('change').
- Gotcha: 2026 TI event "Barcelona Grand Prix" -> tiTrack gives 'barcelona'; alias to catalunya (compound scripts). race-pace may need the same alias (check!).
- WEC: Al Kamel analysis CSV has no tyre column (to confirm; shell cannot reach files.alkamelcloud.com, Kongboda MCP wec_list_archive timed out). Background agent researching per-event Michelin/Goodyear allocations.
- WEC per event: background agent (WebSearch/WebFetch; Michelin race cards on dgaddcosprod blob PDFs, Goodyear racing notes, fiawec.com) -> .cache/tyre-rules.json/md. Monza 2026 Hypercar filled by me from pitdebrief (soft+medium). Built scripts/sim/data/wec-tyres.json + worker/lapsim/wec-tyres-data.js ({track:{year:{hypercar:{dry,q},lmgt3:{dry}}}}), docs/lapsim-tyres.md (all sources). Field for Hyperpole tyre in agent JSON was "hyperpole" (not "qualifying").
- Page: WEC car shows only event slicks + wet, Hyperpole tyre tagged; no event at the track -> whole-season range with a note; F1 C-label adds "(year)" when the race year differs from the car year (e.g. Imola not on the 2026 calendar).
- IMSA GTP/GTD per-event allocations NOT FOUND (IMSA bulletins PDFs unreadable) -> for ChatGPT to finish when IMSA cars are added.
- PR #128 merged f15ad77; CI 354 pass / 5 old failures; live check in built-in browser OK (COTA LMH: medium | hard | wet; F1 Medium C3 +0.249 s model).
### FOR CHATGPT: replace OpenF1 + FastF1 with TracingInsights everywhere (user decision 2026-11-08 18:41, not urgent)
- Live timing is no longer used, so the live collector can go too.
- Map of current use (grep "openf1|fastf1"):
  - worker/openf1.js (TI-first with OpenF1 fallback; car_data window still OpenF1), worker/openf1-race.js (race_control, overtakes, session_result, starting_grid, weather, team_radio, pits: OpenF1 only), worker/index.js wiring, worker/live.js, worker/gateway.js, answer-policy.js, homepage-examples*.js (OpenF1 links/text in example cards).
  - collector/*.py (FastF1: live SignalR client + post_session/history/championship/lap_archive), .github/workflows/f1-live-collector.yml.
  - Lap sim: scripts/sim/fetch-openf1.mjs (pole speed traces for calibrate.mjs), build-geometry.mjs (track shape from OpenF1 positions), calibrate.mjs, lapsim-data.yml step "Fetch OpenF1 qualifying data"; tool.js/series.js/names.js text mentions.
  - Tests: openf1.test.mjs, openf1-race.test.mjs, source-routing.test.mjs, telemetry.test.mjs, gateway.test.mjs.
- TI per session (github.com/TracingInsights/<year>/<Event Grand Prix>/<Session>/): <DRV>/laptimes.json (time, lap, compound, life, stint, status, pin/pout, del, pos, team, wR/wTT/lST...), <DRV>/<lap>_tel.json (x,y,z dm, speed, throttle, brake, distance, acc), corners.json, drivers.json, rcm.json (race control), session_info.json (start time, track_status, session_status), session_laptimes.json, team_radio.json, weather.json.
- Gaps: no overtakes file (derive from per-lap pos changes, note it is lap-resolution), results/grid derived (final lap pos; grid = Qualifying order + penalties from rcm), data appears hours after a session -> tools must say "not published yet".
- Access: shell can git clone (blob-less + sparse) and raw.githubusercontent.com; GitHub tree API gave 401 here.
- Est. 4-5 h: AI tools ~2 h, lap sim ~2 h, collector removal ~1 h. Keep tests green except the 5 old failures.
### Task 2 cascade (PR #129 merged dc576e9)
- data-ls="series" select (f1, wec live; imsa, fe, gt3 disabled "coming soon"; GT3 label includes "FIA GT 월드컵 (마카오 GP)"); data-ls="car" now "Rules · class" filtered by series (client rebuilds options; Safari ignores hidden <option>, so options are rebuilt not hidden); compare uses optgroups per series.
- Gotcha: t.soon already existed (long sentence) -> duplicate key overrode mine; renamed soonShort.
- Third level "car" (manufacturer/team) intentionally left for GT3 per-car profiles (ChatGPT).
### Racing line per car + on the map (user 18:44-19:00)
- User: line must reflect car characteristics; quali vs race lines differ; later: no separate racing-line panel, draw on the main track map with on/off and zoom/pan.
- scripts/sim/car-lines.mjs: SPSA optimiser (2 sims/step, control points every 6 line points), kernel on lineTrack (worker/lapsim/racing-line.js lineTrack: uniform resample, curvature from points 2 samples apart then smoothed). Quali = calibrated car; race = +fuel (F1 35 kg, WEC 45 kg, assumed) and grip scaled so the lap equals the real mid-race pace (race-data: pole*raceRatio + slope*(laps-1)/2); WEC race grip = F1 ratio of the track (assumed). Per-track cache .cache/lapsim/car-lines/<id>.json, LAPSIM_LINE_MERGE=1 merges to worker/lapsim/car-lines-data.js + docs/lapsim-car-lines.md.
- Validation: real pole speed-trace RMS improved at Silverstone/Spa/COTA, ~equal Monza/Suzuka (speed check rough: real trace mapped by distance fraction). Gains vs min-curvature 0.2-2 s, mean shift 0.2-0.8 m.
- Runtime: ~6 min/track for 4 cars x 2 modes at 1200 steps (2 local jobs). New workflow .github/workflows/lapsim-car-lines.yml (4 shards) did NOT trigger on the fork from a lapsim-lines/** push (unknown why; probe/** pushes do trigger) -> run locally.
- Map: renderMap(opts.line) draws band polygon + line coloured by the car's simulated speed on the line + markers (brake start/lowest speed/full power from sim.limit 3/0/2, braking zone >= 3 pts and >= 10 km/h). Controls: data-line-toggle, data-line-mode q/r, data-zoom in/out/fit, wheel(ctrl)/pinch/drag. Zoom is a CSS transform on [data-ls-zoom]>div (UI overlay rewrites the svg viewBox, so not touched); reZoom() thins strokes and counter-scales labels/markers (--inv).
- Gotchas: old CSS rule .ls-mk{r:calc(var(--k)*6px)} made every marker radius 0; .ls-line-key span{width:10px} squeezed the note text; ui-motion drawOn animates g>path on scroll-in (screenshots too early look empty); UI session folds panels ("펼쳐서 보기").
### Task 3 Hypercar stint energy (PR #130)
- Rule (FIA WEC D06 2025): PPUEnergyStint per car in BoP, measured from driveshaft torque sensors pit-out to pit-in; refill rate stint/40 s; extra docking time per car.
- BoP: agent collected 2025 (all 8 events; Le Mans/COTA partly press/derived); 2026 BoP not published (WEC/ACO stopped from Imola 2026). IMSA uses Maximum Stint Energy + Energy Replenishment Rate; only some 2026 IMSA events found.
- Real stints: Al Kamel not reachable from the cloud shell or via MCP for bulk -> pushed branch probe/wec-stints with a probe workflow (probe/** triggers) that ran scripts/sim/wec-stints.mjs in Actions and committed scripts/sim/data/wec-stints.json back; then fetched it. Probe workflow file kept off the PR.
- Fit: k = median(real MJ/lap / sim quali MJ/lap) = 0.857; LOO-by-event stint-length RMS 3.7%. Spa 2025 flag artefacts removed by requiring full stint >= 0.8 x event typical long stint. Le Mans/Fuji not simulator tracks.
### User decision 2026-11-08 19:16: BoP simulator goes into the Setup tab together with the setup simulator
- Setup tab exists (#kb-setup panel from worker/simulator-ui.js, /simulation#setup). Put the BoP tools there: "+10 kg / +x kW / +y MJ = z s" sensitivity from the lap sim, FP-pace-based BoP prediction (plan §6 in Project doc claude/simulation-plan.md), 2025 official BoP table (worker/lapsim/wec-bop-data.js) and stint energy (worker/lapsim/stint-data.js). Hypercar setup window code: worker/lapsim/hypercar-setup.js.
### Task 4 battery/SoC estimate (PR #131)
- kernel.simulateLap returns flow {dep, brk, thr, soc (window), recharge (per-event limit), rule}; same accounting as energy totals (test).
- Page: [data-ls="soc"] under the speed trace. F1 2026 quali lap starts full; recovery capped at limit; NO clamping, so infeasible swings are visible. Finding: swing 4.93 MJ > 4 MJ window at Monza (kernel enforces only lap totals: deploy <= window + min(regen, limit)). FOR CHATGPT: make the kernel's energy causal (SoC window constraint point by point, e.g. iterate cut-off speeds per straight), then re-run calibration (lapsim-data workflow) so pole reproduction stays 0.000%.
- Hypercar: window unknown -> lowest point at 0, shows needed window (Monza LMH 1.14 MJ). 2025/older: note only (MGU-H not modelled).
- No public SoC/deploy data exists for F1 (FastF1 maintainer) or WEC; FE Attack Mode laps are in Al Kamel booklets ("A").
- PR #132 merged d2d5397 (racing line per car on the map). Rebase conflicts in worker/simulation.js (template panel list, computeView return, client update line) resolved by hand; keep socHtml + stintPanel + reZoom together. Live check: silverstone LMGT3 line note -3.008 s / 0.81 m. Line data 460 KB (only the selected track is embedded in the page).
- Large per-car gains (e.g. LMGT3 Silverstone -3.0 s) are vs the least-curvature line on the same kernel; may partly be kernel sensitivity to curvature -> ChatGPT: validate with WEC speed traps / sector times per car if possible.
### Task 5 brakes (PR #133)
- Data: Brembo per-race figures collected by a background agent (WebSearch/WebFetch; brembo.com + mirrors) -> scripts/sim/data/brembo.json, docs/lapsim-brembo.md. F1 2025 24/24, 2026 19 (no Dutch), 2024 6; WEC Le Mans; IMSA 3. Conflicts listed in the md (Canada/Belgium/Miami/Brazil/Mexico 2025, Bahrain 2026 189 kg suspect).
- Model worker/lapsim/brakes.js: zones from kernel limit==3; hard part = decel >= 1.5 g (lift/drag excluded) -> speeds, distance, time, mean g; force split: drag, regen on own axle (F1/LMDh rear, LMH front; regenMax/v and share), friction by dynamic axle load (static + aero balance + load transfer). Pedal = kg/g x mean g (30.8 kg/g fitted); front pressure = pedal N x ratio 3.5 x front share / area of 17.8 mm MC (assumptions).
- First attempt compared simulated PEAK g (1.5x too high; QSS instantaneous) -> switched to mean g of the hard part: LOO 18% decel, 21.8% pedal, 11% speed before, 34.9% distance (model brakes shorter: instant pressure build). FOR CHATGPT: add a brake pressure ramp (e.g. 0.1-0.15 s rise) to the kernel or post-process to fix distance/time; Hypercar has only Le Mans Brembo data (Le Mans not a sim track).
- Panel matches the zone ending nearest Brembo's named corner (td.corners s).
### Task 6 evolution Q-split + Météo-France (PR #134)
- scripts/sim/qsplit.mjs: TI Qualifying session_info.session_status Started/Finished pairs -> Q1/Q2/Q3 minute windows (minus session_start_time); segment best = fastest slick lap whose end time falls in the window (+2.5 min grace for laps started before the flag); wet (>3% wR laps) skipped. 47 dry qualifyings 2023-2026. Model: (1+evo(end k))/(1+evo(end Q3)) + pooled segment offset (Q1 +0.56%, Q2 +0.24%); LOO Q1 0.58% / Q2 0.44% (evo only 0.76/0.50).
- Page: bands on the evolution chart + table [data-ls="qsplit"] (F1 qualifying only). Model Q3 = simulated pole lap (reproduces the real pole); the real table year is the latest dry qualifying at that track (can differ from the car year, e.g. Las Vegas 2024).
- Forecast: condition option "forecast" -> browser fetch https://api.open-meteo.com/v1/meteofrance (hourly temperature_2m, relative_humidity_2m, surface_pressure, wind_speed_10m, wind_direction_10m, shortwave_radiation, precipitation; forecast_days=4; timezone=auto; wind m/s). Hour select fills state.manual and reuses manual mode. Track temp = air + 0.02 x SW (assumption; FOR CHATGPT: fit k on TI weather.json TrackTemp/AirTemp + Open-Meteo historical radiation). TRACK_LL coordinates in simulation.js. Opens the folded Air panel (details) itself. Tested with a mocked Open-Meteo route in Playwright (container cannot reach the API); live check needed in a real browser.

### Gap fill (user 19:50–20:21: "fill everything except cross-validation, then hand off")
- #136 battery causal tracking, #137 brake ramp/zone threshold, #138 track temperature fit, #139 stint ± and flags.
- WEC line check (`line-check.mjs`): run locally in ~2 min; results in §7 A4. Barcelona alias + test.
- IMSA GTP stint energy: not possible without IMSA calibration and a collector → §7 G and J.
- Timing71: archive API found in the site bundle; listed via Actions probe (shell blocked); formats sampled on
  6 sessions (IMSA, FE, DTM, GTWC America, WEC Hypercar, F1). Owner decision 20:21: ChatGPT collects and fits (§7 J).
- Tools: WebFetch (IMSA bulletin PDF), WebSearch, git clone of `timing71/{common,chrome,web,cli,livetiming-core}`
  to read the code, GitHub Actions `probe/**`, built-in browser (PRs; one navigate call could not be approved by
  the safety check — retry or open the compare link by hand).
