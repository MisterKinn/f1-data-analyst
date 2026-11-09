# Handoff — lap-simulator physics to "0.000 %" (2026-11-09, from Claude)

This document hands over all physics-model work of the Kongboda Motorsports lap simulator: the goal, the
owner's rules, how the model and the calibration work, everything measured so far, today's engineering
experiments and their results, the work left (including Formula E and every GT3 series), and the working
habits and tacit knowledge that made the work go well. Read it once top to bottom; then use the index.

Owner: Jeongmin (GitHub `kangjeongmin1229`, site <https://kongboda-motorsports.vercel.app>).
Production repo: `MisterKinn/f1-data-analyst` (merge to `main` = automatic Vercel deploy).
Earlier handoffs (still valid for features outside physics): Project docs `claude/handoff-chatgpt.md`
(all simulator features to 2026-11-08), `claude/work-plan.md` (Timing71 work), `claude/physics-review.md`
(the review that produced steps S1–S6 below). Repo docs: `docs/lapsim-*.md`.

---

## 0. Index

1. Goal and the owner's rules (read first)
2. How to work: repo, branches, PRs, CI, probes, reporting
3. The physics model today (kernel, cars, tracks, calibration, reproduction layer)
4. Where the error is today (numbers, noise floor, error budget)
5. Today's engineering steps S1–S6: code, experiments, results, decisions
6. Work left to reach the goal, in order, with pass checks (incl. Formula E and all GT3)
7. Data sources and access paths
8. Experiments infrastructure (how to run a variant in 2 hours without refetching)
9. Tacit knowledge: habits, traps, gotchas
10. Tools, skills, plugins
11. File and workflow map
12. Cleanup and open questions

---

## 1. Goal and the owner's rules

### 1.1 Goal
- Build the best motorsport lap simulator: F1, WEC (Hypercar LMH/LMDh, LMGT3), IMSA (GTP, GTD Pro, GTD),
  Formula E, and GT3 everywhere (SRO GTWC, IGTC, FIA GT World Cup Macau, DTM, Nürburgring SP9, ELMS/ALMS LMGT3).
- Predict car–track pairs that never ran (examples from the owner: **F1 2026 at Jeddah**, **LMH/LMDh at
  Montréal**) with an error as close to zero as physics allows.
- The owner's words: "오차 0.000%의 정확한 물리모델", "모든 오차를 0.00000%로 줄이는걸 목표로 끝까지".

### 1.2 What "0.000 %" means here (agreed with the owner; keep this distinction)
| Case | Rule | Status |
|---|---|---|
| A session that really ran (raced/qualified, dry) | must reproduce **exactly 0.000 %** | done for F1 39/39, WEC 18/18, other series 9/9 where geometry exists (`docs/lapsim-reproduce.md`) |
| A pair that never ran (prediction) | drive the error down with better physics; **always show the honest held-out error** | F1 ~0.9–1.2 %, WEC ~1–2 % (§4) |

- Reproduction = correction "real − simulated in the same weather", **recomputed from the current model every
  run** (only real data is stored, never the residual). So any model change keeps 0.000 % on raced sessions
  automatically; the size of the correction is the model's own error and is the thing to shrink.
- A prediction below the noise floor (pole vs P2 in the same session 0.16 % median) is not believable; if a
  held-out number goes below that, suspect leakage (tuning on test rows).

### 1.3 Hard rules (the owner is strict)
1. **Never make the model worse** ("나빠지게 하면 안돼"). Every change goes through the **held-out gate**
   (`scripts/sim/gate.mjs`): keep a change only if the held-out error on the SAME rows is lower by more than
   one standard error of the paired squared-error gain, with ≥ 5 rows. Apply it **per group** (series, class,
   season) — a change can be used only where it helps (e.g. WEC only, F1 unchanged).
2. **Never tune on test rows.** Held-out = leave-one-track/event-out or an unseen season. Declare variants
   before you test them; if you add variants after seeing results, say so and treat them as a new round.
3. Anything not measured is labelled **estimate/assumption** on the page (Korean + English).
4. Never hide a failed check: show ✗ with the amount. Rejected candidates are written in the docs with numbers.
5. Raw third-party data (Timing71, Al Kamel files, TracingInsights telemetry) is **never committed**; it lives in
   `.cache/` or the Actions cache. Commit only small derived tables, counts and fit results.
6. Report to the owner after **each step** ("작업 단계별로 끝날때마다 보고해"), in **English B1–B2, short,
   tables**, with ETAs in KST. If asked "when", give a per-step table. Do not wait to be asked.
7. The owner merges PRs (Claude's merge click is blocked by a safety check). Prepare PRs fully, then ask.

---

## 2. How to work

### 2.1 Repo and branches
- Work on the fork `kangjeongmin1229/f1-data-analyst-deploy`, always from upstream main:
  ```
  git remote add upstream https://github.com/MisterKinn/f1-data-analyst
  git fetch upstream main && git checkout -b <branch> upstream/main
  ```
- Open PRs into `MisterKinn/f1-data-analyst:main` with the browser compare page (GitHub API returns 403 on
  upstream): `https://github.com/MisterKinn/f1-data-analyst/compare/main...kangjeongmin1229:f1-data-analyst-deploy:<branch>?expand=1`.
  In the built-in browser, set title/body with the native value setter + `input` event, then click the
  visible submit button (or `form.requestSubmit()`); a ref click can miss when the button is off-screen.
- Before every PR: `npm ci && node --test tests/*.test.mjs && npm run build && npm run validate`.
  - Locally **26 tests fail on a clean main** (environment: Python collector deps, network). Compare with a
    clean worktree: `git worktree add <dir> upstream/main`, symlink `node_modules`, run the same tests.
  - In CI **5 tests fail on main since PR #117** (account cards, guide, previews, source-routing,
    introduction). A PR is fine when it adds no new failure.
- After merge: check the live page/JSON (Firecrawl is the owner's rule; the built-in browser works too).
- The environment's stop hook demands: every local branch pushed with an upstream, no untracked files.
  For branches you must not push under a triggering name, push to a non-triggering name and set the upstream
  by hand (`git config branch.<b>.remote origin`, `branch.<b>.merge refs/heads/<name>`, and add a fetch refspec).

### 2.2 GitHub Actions on the fork — what triggers
- `probe/**` pushes trigger workflows whose file is on that branch (the trick used for everything that needs
  network the shell does not have: Al Kamel, Timing71/Backblaze, OpenF1 bulk, Open-Meteo).
- A **new** workflow file sometimes does not register on the first push of a branch whose commit already
  exists on another ref. Fix: push a commit that touches the workflow file (adding `workflow_dispatch:` did it).
- `lapsim/**` pushes DO trigger `lapsim-data.yml` (full data refresh, ~3.5 h). Do not use `lapsim/**` as a
  parking name (it happened once today; cancelled).
- Artifacts: download needs `productionresultssa6.blob.core.windows.net` in the allowed domains (the owner
  added it 2026-11-09). Without it, have the workflow commit results back to the probe branch.

### 2.3 The shell's network
- Reachable: github.com (git), raw.githubusercontent.com, api.github.com (public), npm/pip registries,
  the artifact blob host above.
- Not reachable: Al Kamel, archive.timing71.org/Backblaze, OpenF1, Open-Meteo, Wikipedia. Use probes or the
  Kongboda MCP (`wec_*`, `fia_*`) for single files.

### 2.4 Reporting pattern that worked
- Start of a step: one line saying what runs and the ETA.
- End of a step: table (what, result, gate verdict), problems + fixes, next step + ETA.
- When an ETA slips, say so at once with the new time and the reason.

---

## 3. The physics model today

### 3.1 Kernel (`worker/lapsim/kernel.js`)
- Quasi-steady-state (QSS) point mass on a uniform grid (ds ≈ 2–5 m), TUM laptime-simulation method:
  apex speeds from lateral capacity, backward braking pass, forward traction pass, friction ellipse.
- Tyre: `capacity(mu0, dmu, fz0, N)` = 4 × (mu0 + dmu·(N/4 − fz0))·N/4 → **equal load on all four tyres,
  linear load sensitivity**. Separate muX (brake) / muXTrac (traction).
- Aero: one ClA, CdA (+ low-drag mode for 2026 active aero, `aeroLow`), wind (`vAir`), air density from weather.
- Powertrain: ICE + ERS with rule-specific limits (2026 350 kW MGU-K, energy per lap, super-clipping,
  causal battery since #136), Hypercar total-power cap, AWD-above-speed for LMH.
- Track: curvature `kappa`, `grade` (from z), per-point `vScale` and per-track `mu` (grip factor).
- **New today (off by default, results byte-identical when off):**
  - `car.axle` — axle model: per-axle loads from static weight + aero balance (`rearAero`) + vertical-curvature
    share; lateral load transfer m·ay·h/tw split by `rollFront`; tyre law Fy = mu0·fz0·(Fz/fz0)^q (`loadExp`, q<1
    degressive); lateral limit = weaker axle (front needs m·ay·(1−rearStatic), rear m·ay·rearStatic).
    Longitudinal uses the same tyre law on 4 tyres (no longitudinal transfer yet).
  - `track.kv` — vertical curvature (1/m): normal load + m·v²·kv (crest unloads, compression loads).
  - `track.bank` — banking (rad): gravity component helps, centripetal adds load.

### 3.2 Cars
- F1: `worker/lapsim/cars.js` (TUM 2019 base, PRIOR per season, rule changes 2026–2028).
- WEC: `worker/lapsim/series.js` (`SERIES.wec.classes.lmh|lmdh|lmgt3`, prior mass/power, fitted muY/ClA/CdA).
- Provisional series cars (tool only): `SERIES_CARS` in `worker/lapsim/scenario.js` — IMSA GTP = WEC LMDh;
  IMSA GTD/GTD Pro, ELMS/ALMS LMGT3, GTWC, DTM, IGTC, NÜR, Macau GT3 = WEC LMGT3 car.
- Formula E and other GT3 are `status: 'coming-soon'` in `series.js`.

### 3.3 Tracks
- `worker/lapsim/tracks-data.js` (26 tracks) built by `scripts/sim/build-geometry.mjs` from OpenF1 car
  positions (snapped to one reference path per track), smoothed; `tune-geometry.mjs` adjusts.
- `corners` with official numbers and `s` for most tracks (none for Jeddah, Sakhir and a few others).
- Widths and an optimal line from TUMFTM `racetrack-database` (LGPL-3.0) for the racing-line panel.

### 3.4 Calibration (`scripts/sim/calibrate.mjs`, lib `calibrate-lib.mjs`, BCD `joint-bcd.mjs`)
- Production settings (`lapsim-data.yml`):
  `LAPSIM_FITTER=bcd LAPSIM_ROUNDS=5 LAPSIM_BCD_ITERS=200 LAPSIM_WTIME=20 LAPSIM_WSECTOR=2 LAPSIM_TRACK_DRAG=on LAPSIM_TEAMS=on LAPSIM_WPRIOR=8`.
- F1: joint block-coordinate fit over 2023–2026, top-3 qualifying laps per session (OpenF1 speed traces),
  car parameters per season inside physical BOUNDS, **one grip factor per track shared across seasons**
  (bounds [0.7, 1.3]) and, with `TRACK_DRAG=on`, one drag factor per track ([0.85, 1.15]); team multipliers;
  objective = speed-trace extremes + lap time (weight 20) + sectors (2) + prior (8).
- F1 held-out: per season, track left out, factor from the other season (this is the 2025↔2026 test).
- WEC: per class and season, fit muY, ClA, CdA on the top-3 Al Kamel laps, **using the F1 track grip factors**
  (`f1Grip`); held-out = leave one track out → this is the "predict WEC from F1" test. Timing71 extra rows
  are a gated candidate inside the fit.
- Env knobs added today: `LAPSIM_GRIP_LO/HI`, `LAPSIM_KV`, `LAPSIM_BANK`, `LAPSIM_AXLE`, `LAPSIM_LOADEXP`,
  `LAPSIM_ROLLFRONT`; per-event WEC BoP is a gated candidate inside every run (Hypercar 2025 only — 2026 BoP is
  not published).

### 3.5 Reproduction and uncertainty (page and MCP tool)
- `worker/lapsim/scenario.js` `fix()` picks the real sectors (F1 poles from `f1-poles-data.js`, WEC from
  `wec-poles-data.js`, other series from `series-poles-data.js`, Timing71 complete replays only) and
  `worker/lapsim/tool.js` `corrOf` spreads the correction per sector (or per lap share for lap-only data).
- `uncertainty()` reports in-sample error for fitted tracks and the held-out RMS for unseen ones.

---

## 4. Where the error is today

### 4.1 Noise floor (measured)
| Quantity | Value |
|---|---|
| Pole vs P2 in the same session (median, F1 82 + Hypercar 36 sessions) | 0.16 % |
| P1–P3 spread | 0.32–0.42 % |
| Same track, consecutive F1 years, stable rules (n = 30) | 0.77 % |

### 4.2 Held-out errors of the current model (variant A, run 2026-11-09 with today's inputs)
| Test | Error (RMS) |
|---|---|
| F1 2025, track left out | 0.86 % |
| F1 2026, track left out | 1.16 % |
| WEC from F1, track left out: LMH / LMDh / LMGT3 2025 | 1.42 / 1.41 / 1.99 % |
| WEC from F1, track left out: LMH / LMDh / LMGT3 2026 | 1.62 / 1.44 / 1.60 % |

### 4.3 Validation details (variant A, in-sample F1 pole laps; `scripts/sim/validate.mjs`)
| Season | Lap | Sectors | Corner min speed RMS / bias | Trap RMS / bias | Braking point RMS / bias |
|---|---|---|---|---|---|
| 2025 | 0.42 % | 2.6 % | 22.8 / −12.4 km/h | 10.2 / −7.7 km/h | 64 / +37 m |
| 2026 | 0.75 % | 3.5 % | 24.9 / −16.4 km/h | 15.9 / −5.9 km/h | 69 / +38 m |

Read this table carefully: the lap is right to 0.4–0.8 % but **sectors are off by 2.6–3.5 % and corners are
~12–16 km/h slow on average**. The lap is right because errors cancel (slow corners, compensating elsewhere).
Part of the corner bias is a measurement artefact (4 Hz OpenF1 samples miss the true minimum, so the real
minimum looks higher), but not all. This is the strongest signal of missing physics (§6.1).

### 4.4 Signals of missing physics (keep checking these)
- WEC Hypercar ClA sits on its upper bound (7.0) and muY sits low (~1.55) in almost every fit; LMGT3 ClA on
  its bound 3.5. The fitter is trading low-speed grip for high-speed grip → load sensitivity / load transfer /
  aero balance are wrong or missing.
- Per-track grip factors 0.88–1.22 and drag factors 0.96–1.15 absorb geometry and model errors; they are
  fitted on F1 and may not transfer to other cars.
- The same sign of error at the same track for every WEC class → track side, not car side.

---

## 5. Today's engineering steps (2026-11-09)

The plan (owner-approved table) and the outcome of each step. All code is on branch `feat/physics-steps`
(rebased on main after #146/#147); experiments ran on `probe/lapsim-exp`.

### 5.1 Step 1 pre-check — Austin 2025 WEC (done, merged in #147)
- Hypercar Austin 2025 was −6.3 s in-sample for both Hypercar classes. Cause: the qualifying was wet but not
  marked wet in the timing. Fixed with `scripts/sim/data/wet-sessions.json` (sources listed) read by
  `fetch-wec.mjs`. WEC 2025 holdout: LMH 3.80 → 1.54 %, LMDh 3.87 → 1.61 %. Lesson: **check the data before
  blaming the physics**; a speed-trap warning now prints when a trap is < 0.9 × the class median at that track.

### 5.2 Experiments (10 variants declared before testing; same inputs; production fit settings)
| Variant | Change vs A | Purpose |
|---|---|---|
| A | none (drag on, grip 0.7–1.3) | baseline |
| B | per-track drag off | S1 |
| C | drag off, grip 0.9–1.1 | S1 |
| D | drag off, grip 0.95–1.05 | S1 |
| E | B + vertical curvature | S2 |
| F | B + axle model (q 0.85) | S3 |
| G | B + axle + vertical curvature | S2+S3 |
| H | A + axle + vertical curvature | S2+S3 with drag |
| I | G with q 0.75 | S3 sensitivity |
| J | B + banking (Zandvoort T3 19°, T14 18°) | S2 |

Every variant also tests per-event WEC BoP (Hypercar 2025) with the gate.

### 5.3 Results — paired gate vs A on held-out rows (`node scripts/sim/exp-compare.mjs cal-A.js cal-X.js`)
RESULTS_TABLE

### 5.4 Decisions
DECISIONS

### 5.5 Step 4 — prediction ranges (coverage test) (`scripts/sim/intervals.mjs`)
- Rule: the range for a group (F1, WEC class) in a season is learned from the **other** season only and tested
  on this season's held-out laps. Two rules declared before testing: current (±k·RMS, centred on the model)
  and candidate (centre shifted by the other season's mean error, width ±k·SD·√(1+1/n)). Score = Gaussian
  negative log-likelihood per row, paired gate.
INTERVALS

### 5.6 Step 5 — validation table (`scripts/sim/validate.mjs`)
- Per F1 pole lap: lap, sectors, corner minimum speeds (real minima with ≥ 15 km/h prominence vs the simulated
  minimum within ±50 m), trap (lap max), braking point (last point within 3 km/h of the preceding max), plus
  the held-out tests (2025↔2026, F1→WEC). Run: `LAPSIM_CAL_FILE=<cal.js> node scripts/sim/validate.mjs <name>`
  (needs `.cache/lapsim/traces.json` and the matching `tracks-data.js`).
- Acceptance tests for every future physics change: F1 2025↔2026 held-out and F1→WEC held-out must not get
  worse; corner bias and sector error should move toward zero.

### 5.7 Step 6 — tyre thermal model (plan only; not built)
- Two lumped nodes per axle: surface T_s and carcass T_c.
  - C_s·dT_s/dt = q_slip − h_air(v)·A·(T_s − T_air) − h_road·A_c·(T_s − T_track) − G_sc·(T_s − T_c)
  - C_c·dT_c/dt = q_hyst + G_sc·(T_s − T_c) − h_rim·(T_c − T_rim)
  - q_slip ≈ |F_y·v_slip| + |F_x·κ·v| from the kernel's force use; q_hyst ∝ load amplitude × speed.
  - grip μ(T_s) = μ_peak·exp(−((T_s − T_opt)/w)²) replacing today's fixed `gripFromTrackTemp` curve.
- No public tyre temperature data → do not fit absolute temperatures. Fit only through lap-time effects and
  test only on out-lap / first flying lap deltas (TracingInsights laps with `pout`, Timing71 laps after pit).
- Pass: held-out first-lap delta error lower than "no thermal model" through the gate.

---

## 6. Work left, in order, with pass checks

Rule for every item: goal + pass check first (Karpathy), smallest diff, gate per group, F1/WEC raced
reproduction stays 0.000 % (tests `tests/lapsim.test.mjs`), docs updated with numbers incl. rejections.

### 6.1 Car model (highest value)
1. **Fix the corner-speed bias before anything else.** Corner minima are ~12–16 km/h slow while laps are right.
   Steps: (a) quantify the 4 Hz sampling artefact (compare OpenF1 minima with TracingInsights `_tel.json` at
   higher rate for the same laps); (b) look at bias vs corner speed (low/medium/high) — a speed-dependent bias
   means aero/load-sensitivity form is wrong; (c) then add physics.
2. **Axle model** (code exists, `car.axle`): finish longitudinal load transfer (m·ax·h/wb) for braking and
   traction; give per-class physical priors (track width, CoG height, weight distribution from rules:
   F1 2026 min. weight distribution, Hypercar/LMGT3 homologation); fit q (load exponent) as one global
   parameter with a prior, not per season. Pass: ClA no longer at its bound; F1 and WEC held-out not worse.
3. **Aero balance vs speed** (rearAero changes with ride height/DRS/active aero); 2026 active aero modes.
4. **Gearbox and power curve** (shift time, torque curve) — matters for traps and exits.
5. **Brake build-up** is in the post-process (#137, 0.73 s); move it into the kernel if braking-point bias stays.

### 6.2 Track description
1. Curvature: compare the OpenF1 path curvature with the TUM centre line and a min-curvature line inside TUM
   widths; candidate = calibrate on the min-curvature line (the per-car line check showed laps 3.5–5 % fast on
   smoother lines because grip was calibrated on the noisy path — so grip must be refit on the new line).
2. Vertical curvature: today from the smoothed grade; better z from TracingInsights telemetry (z in dm).
3. Banking: only Zandvoort placed (sourced). Jeddah T13 (~12°) needs corner positions (not in tracks-data);
   do not guess. Add others only with a published angle.
4. Per-track grip factor: aim for a physical range by explaining it (surface age, temperature) instead of
   bounding it — bounding alone made F1 worse (C, D).

### 6.3 Calibration and uncertainty
- Hierarchical fit (track factor shared across series with a prior near 1; car per class/season).
- Put the accepted prediction-range rule into `scenario.js uncertainty()` and show coverage on the page.
- Keep `LAPSIM_WPRIOR` and bounds physical; record every fitted parameter that hits a bound in the report.

### 6.4 Track geometry for the other series (unlocks IMSA, GT3, FE)
- Missing tracks are listed in `docs/lapsim-reproduce.md` (IMSA 13, ELMS 2, ALMS 2, GTWC 8, DTM 6, IGTC 3,
  NÜR 1, Macau 1, FE 22). Real sessions for them are already stored (`scripts/sim/data/series-poles.json`) and
  reproduce as soon as geometry exists.
- Sources: TUMFTM racetrack-database (has Hockenheim, Norisring, Nürburgring GP, Oschersleben, Brands Hatch,
  IMS road course, Sepang, …); otherwise official track maps + widths; car positions where a public telemetry
  source exists (none for IMSA/GT3/FE that we know of).
- Build pipeline: reuse `build-geometry.mjs` output format (`tracks-data.js`: kappa, grade, heading, x/y,
  corners with s). Add a geometry-quality check: simulated vs real lap with a reference car must be within
  the class's held-out error before the track is used for fitting.

### 6.5 IMSA
- Cars: GTP = LMDh rules (same as WEC LMDh; IMSA BoP differs: Maximum Stint Energy + power % at ≤230/≥240 km/h).
  GTD Pro/GTD = GT3 with IMSA BoP.
- Data: Timing71 IMSA sessions (per-lap times, sectors S1–S3, VFT energy %), IMSA results PDFs, IMSA technical
  bulletins (BoP; 2026 Road America example in `claude/handoff-chatgpt.md` §7 G). VFT energy per lap table:
  `scripts/sim/data/t71-imsa-vft.json`.
- Pass: GTP held-out (track left out) ≤ WEC LMDh held-out; stint energy from VFT vs model with LOO.

### 6.6 Formula E (Gen3/Gen3 Evo fit, Gen4 projection)
- Generations: Gen2 (to 2021-22), Gen3 (2022-23 to 2023-24), Gen3 Evo (2024-25 to 2025-26), **Gen4 from
  Season 13 (Jeddah, Dec 2026)**: 450 kW race, 600 kW qualifying/Attack Mode, up to 700 kW regen, permanent
  AWD, Bridgestone tyres; check mass and energy in the FIA Technical Regulations (sources disagree).
- Physics to add to the kernel: no ICE; battery energy budget per race (energy-limited lap, lift-and-coast);
  regen on both axles (Gen3 front regen, Gen4 AWD); Attack Mode power window; all-weather treaded tyres (low μ,
  low load sensitivity); street circuits (bumps, kerbs → lower effective μ; walls → no run-off).
- Data: FIA Formula E results (Al Kamel format: `23_Analysis` with Attack Mode laps "A", `26_Weather`), Timing71
  FE sessions (~615 replays), official track maps.
- Geometry: FE layouts differ even at shared venues (Jeddah, Miami, Madrid) → never reuse F1 geometry.
- Steps: (1) geometry for 3–4 FE tracks with the most sessions; (2) FE car class with Gen3 Evo priors; (3) fit on
  qualifying (Duels) bests, leave one track out; (4) race energy model vs FIA energy limit; (5) Gen4 =
  Gen3 Evo fitted car + rule deltas, labelled estimate.
- Pass: Gen3 Evo held-out qualifying error stated; raced FE sessions reproduce 0.000 %; Gen4 numbers labelled.

### 6.7 GT3 everywhere
- Design (owner-approved): integrated in the simulator page, cascade series → rules/class → car; per-car
  **profile** (straight vs corner speed, sector split, long-run drop-off, a one-line "why", best lap).
- One physical GT3 base car (mass ~1,300 kg class, ABS + TC, Pirelli/Michelin/Goodyear/Hankook by series) with
  per-series BoP (mass, power/restrictor, ride height) applied as inputs, not fitted.
- Data per series: WEC LMGT3 (Al Kamel, done), IMSA GTD (Timing71/IMSA results), GTWC (SRO results + Timing71),
  IGTC (Timing71), DTM (Timing71; DTM BoP), Nürburgring SP9 (Timing71; 9 sectors; no chequered state),
  Macau FIA GT World Cup (Timing71), ELMS/ALMS (Timing71).
- Known issue: `t71-gt3.mjs` found only 4 usable sessions on our tracks → geometry first (§6.4). DTM Spielberg
  2024 vs 2026 laps differ by 8 s (95.8 vs 87.6 s) → check conditions/session before fitting.
- Pass: per-series pace factor (or BoP-driven car) with leave-one-track-out error; raced sessions reproduce.

### 6.8 Data and conditions
- Weather: Météo-France via Open-Meteo is used for forecasts; historical radar/rain for wet detection is open.
- Track temperature: fitted (±3.97 °C held out); unseen-series test 4.96 °C.
- Track evolution: F1 fitted; WEC rejected by the gate (keep off).

---

## 7. Data sources and access (short; full table in `claude/handoff-chatgpt.md` §6)
| Source | What | Access |
|---|---|---|
| OpenF1 | F1 qualifying speed traces and positions (calibration input) | Actions only (`fetch-openf1.mjs`, ~2.2 h for 2023–26) |
| TracingInsights GitHub | F1 laps, telemetry (x,y,z), pole sectors (`f1-poles.mjs`) | git blob-less sparse clone; raw.githubusercontent |
| Al Kamel | WEC laps, sectors, traps, weather | Actions (`fetch-wec.mjs`), Kongboda MCP for single files |
| Timing71 archive | all series, laps/sectors/tyre letters/VFT/flags/weather | Actions only; calibration use only; complete replays only (`endFlag === 'chequered'`) |
| FIA / IMSA / SRO documents | rules, BoP, energy limits | Kongboda MCP `fia_*`, WebFetch |
| TUMFTM racetrack-database | track widths, centre lines | git clone (LGPL-3.0) |
| Brembo, Pirelli, Michelin, Goodyear | braking, compounds, allocations | WebSearch/WebFetch |

---

## 8. Experiments infrastructure (use this; it saves hours)
1. **Export inputs once** (`probe/lapsim-export`, workflow `probe-lapsim-export.yml`): fetches OpenF1
   2023–2026, tunes geometry, fetches WEC, and commits `probe-out/lapsim-inputs.tgz.part-*` (traces.json,
   wec.json, races.json, tracks-data.js; ~2.5 h). Re-export only when inputs change (new event).
2. **Run variants** (`probe/lapsim-exp`, workflow `probe-lapsim-exp.yml`): edit `probe-exp.json`
   (`[{"name":"X","env":{...}}]`), push. Each variant runs `calibrate.mjs` with production settings plus its env,
   then `exp-summary.mjs`, `validate.mjs`, `intervals.mjs`; artifacts `exp-<name>` (cal-X.js, exp-X.json,
   validate-X.json, intervals-X.json, log-X.txt); a collect job commits all to the branch. ~1.5–3.5 h per
   variant, all in parallel; the job limit is 340 min (axle variants are the slowest).
   The workflow applies `wet-sessions.json` to the exported wec.json (export predates that file).
3. **Compare**: `node scripts/sim/exp-compare.mjs cal-A.js cal-B.js …` (paired gate per group: all, f1, wec,
   f1/<year>, wec-<class>/<year>).
4. **Local work**: the shell has 2 CPUs / 7 GB; a full BCD fit is too slow locally. Validation and comparison
   run locally in seconds: extract the export tgz into a worktree (`.cache/lapsim/*`, `worker/lapsim/tracks-data.js`)
   and use `LAPSIM_CAL_FILE`.
5. Never merge probe workflows. Probe branches are for the owner to delete afterwards.

---

## 9. Tacit knowledge — habits, traps, gotchas

### 9.1 Working habits that worked
- **Data check first**: the biggest single gain today (Austin 2025 wet) came from data, not physics. Before a
  physics change, look at the worst residuals and ask "is this session what we think it is?" (wet, red flag,
  partial replay, wrong segment, layout change).
- **Declare variants before running**, run them all in parallel, then gate. Never add a variant that only
  exists because you saw the test rows.
- **Default off, byte-identical**: new physics goes behind a flag; prove that the default output is identical
  (compare lap times old vs new kernel to 6 decimals) before running experiments.
- **Per-group gate**: report per series/class/season, not only the total — the total can hide a loss in F1.
- **Read the signals**: parameters on their bounds, same-sign errors at a track across classes, sector errors
  much larger than lap errors → missing physics.
- **Measure the noise floor first** to know what "good" is (0.16 % pole–P2).
- Long jobs: start them in the background, poll with until-loops (single sleeps are blocked), set a long
  timeout; a container restart kills watchers — re-create them; report slips at once.

### 9.2 Data traps
- F1 pole = fastest valid lap of the **last** qualifying segment (Hungary 2025: the fastest lap was a Q2 lap).
- Suzuka 2026: the stored pole was P2's lap → fixed (#146). Always check driver number vs classification.
- OpenF1 4 Hz speed samples miss true minima/maxima (bias in corner/trap checks).
- Public F1 positions are snapped to one reference path (no driven line exists in the data).
- Timing71: many qualifying replays are incomplete → only `endFlag === 'chequered'`; tyre **letters** are right,
  the colour label is not; some feeds store missing weather as 0 or 255 → plausibility filter; local yellows are
  racing laps (only FCY/SC/VSC/Code 60/red neutralise); duplicate replays share a minute → dedupe by archive
  filename; "hyper" matches "hyperpole" → test `/hypercar/`; Nürburgring feeds: 9 sectors, no chequered state,
  "track data" = slow zones.
- Al Kamel: no tyre column; wet sessions are not always marked wet (→ `wet-sessions.json`).
- WEC 2026 BoP is not published (stopped from Imola 2026) → per-event BoP only for 2025.
- Formula E shares venue names with F1 but not layouts.

### 9.3 Model traps
- Grip is calibrated on the timing path; a smoother line makes laps 3.5–5 % fast unless grip is refit.
- Bounding the per-track grip (0.9–1.1, 0.95–1.05) made F1 held-out worse (0.86 → 1.18/1.78 %) — the wide
  range absorbs real track differences until the physics explains them.
- Banking math with high μ is very sensitive: ay = g(μcosθ + sinθ)/(cosθ − μ sinθ); a 19° full-width bank
  at μ = 1.8 more than triples the lateral limit, which is not what cars see (the line uses only part of the
  banked width, the angle varies). Treat published maximum angles as upper bounds.
- Equal-load tyre model + linear load sensitivity makes the fitter push ClA to its bound.
- `withGrip()` spreads the track object → new track arrays (kv, bank) pass through automatically.

### 9.4 Repo/process traps
- `worker/simulation.js` is the merge-conflict hot spot (template lists, `computeView` return, client update).
- A duplicate key in text tables silently overrides (e.g. `soon` vs `soonShort`).
- Page client script is external (`/assets/lapsim.js`) → file:// previews do not run it; test through a local
  http server around `worker.fetch` + Playwright.
- Proxy cars (`kind: 'proxy'`) are filtered out of the page (`carsFor`); they exist only in the MCP tool.

---

## 10. Tools, skills, plugins
| Tool | Use |
|---|---|
| karpathy-guidelines skill | goal + pass check first, minimal diff, surface assumptions |
| mission-architect skill | error budget, verification matrix (TAID), trade studies, sensitivity |
| thermal skill | lumped multi-node energy balance (tyre model plan §5.7) |
| Ponytail plugin | small diffs; `/ponytail-review` before a PR |
| Graphify | `graphify query/explain/path` before reading many files |
| gh CLI | fork pushes, run status, artifact download (needs the blob domain) |
| Built-in browser | PR creation on upstream (compare page) |
| Kongboda MCP | FIA documents, Al Kamel single files, rules lookup, `lapsim_simulate` |
| Playwright | page checks |

---

## 11. File and workflow map (physics)
| Path | Role |
|---|---|
| `worker/lapsim/kernel.js` | lap kernel (QSS) + axle/kv/bank options |
| `worker/lapsim/cars.js`, `series.js` | car priors and classes |
| `worker/lapsim/calibration-data.js` | fitted output (generated) |
| `worker/lapsim/scenario.js`, `tool.js` | reproduction layer, uncertainty, MCP tool |
| `worker/lapsim/f1-poles-data.js`, `wec-poles-data.js`, `series-poles-data.js` | real reference laps (generated) |
| `scripts/sim/calibrate.mjs`, `calibrate-lib.mjs`, `joint-bcd.mjs` | calibration |
| `scripts/sim/gate.mjs` | held-out gate |
| `scripts/sim/exp-summary.mjs`, `exp-compare.mjs`, `validate.mjs`, `intervals.mjs` | experiment tools (new) |
| `scripts/sim/data/banking.json`, `wet-sessions.json` | sourced inputs (new) |
| `.github/workflows/lapsim-data.yml` | full data + calibration (production) |
| `.github/workflows/lapsim-t71.yml` | Timing71 collection and fits |
| `probe/lapsim-export`, `probe/lapsim-exp` branches | experiment infrastructure (§8) |
| `docs/lapsim-reproduce.md`, `lapsim-t71.md`, `lapsim-report.md` | coverage, Timing71, calibration report |

---

## 12. Cleanup and open questions
- Branches for the owner to delete when done: `probe/t71`, `probe/t71-read`, `probe/t71-collect`,
  `probe/t71-debug`, `probe/t71-calib`, `probe/t71-temp`, `probe/t71-evo`, `probe/step1-wec`, `lapsim/t71-pool`,
  `feat/t71`, `lapsim/exp-staging`; keep `probe/lapsim-export` and `probe/lapsim-exp` while experimenting.
- Open: how much of the corner-speed bias is sampling (§6.1-1); whether one GT3 base car + BoP is enough across
  tyre suppliers; FE Gen4 mass/energy values.
