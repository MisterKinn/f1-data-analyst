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
Held-out RMS error (%), track left out. ✓ = accepted by the gate vs A, ≈ = better but within noise, ✗ = worse.

| Variant | F1 2025 | F1 2026 | LMH 25 | LMDh 25 | LMGT3 25 | LMH 26 | LMDh 26 | LMGT3 26 | Pooled F1 | Pooled WEC |
|---|---|---|---|---|---|---|---|---|---|---|
| A baseline | 0.86 | 1.16 | 1.42 | 1.41 | 1.99 | 1.62 | 1.44 | 1.60 | 0.99 | 1.59 |
| C grip 0.9–1.1, no drag | 1.18 ✗ | 1.20 ✗ | 1.67 ✗ | 1.45 ✗ | 2.25 ✗ | 1.05 ✓ | 1.00 ✓ | 1.65 ✗ | 1.19 ✗ | 1.54 ≈ |
| D grip 0.95–1.05, no drag | 1.78 ✗ | 1.31 ✗ | 2.42 ✗ | 2.08 ✗ | 2.92 ✗ | 1.06 ✓ | 0.94 ✓ | 1.61 ✗ | 1.60 ✗ | 1.92 ✗ |
| E no drag + vertical curvature | 0.89 ✗ | 1.27 ✗ | 1.52 ✗ | 1.73 ✗ | 2.02 ✗ | 1.02 ✓ | 1.14 ✓ | 1.55 ≈ | 1.06 ✗ | 1.51 ≈ |
| **J no drag + banking** | 0.90 ✗ | 1.37 ✗ | 1.38 ≈ | 1.30 ≈ | 1.81 ≈ | 1.10 ✓ | 1.13 ✓ | 1.39 ✓ | 1.12 ✗ | **1.36 ✓** |
| B no drag | running at handoff time | | | | | | | | | |
| F, G, H, I axle model | running at handoff time (slow; 340 min limit) | | | | | | | | | |

Per-event WEC BoP (Hypercar 2025): rejected in every variant (e.g. A: LMH 1.42 → 1.94 %, LMDh 1.41 → 1.44 %).

Other measurements:
- Zandvoort with banking (J): fitted track grip 1.09 → 1.00 (the banking explains the "extra grip" the factor
  had absorbed); corner-minimum bias at Zandvoort −13.7 → −11.8 km/h (2025); lap unchanged within noise.
- Validation (validate.mjs, in-sample F1): no variant changes the corner bias by more than ~2 km/h; the bias
  is not explained by track factors (§6.1).

Raw results: branch `probe/lapsim-exp` (`probe-out/` after the collect job) or Actions run 42558077604
artifacts `exp-<X>`.

### 5.4 Decisions
1. **F1: keep A** (per-track drag on, grip 0.7–1.3). Every variant made F1 held-out worse. ("나빠지게 하면 안돼.")
2. **WEC: use track factors from an F1 fit without per-track drag** ("transfer factors"). Pattern: every
   no-drag variant improves WEC 2026 strongly; J improves all six WEC class-seasons and passes the gate pooled
   (1.59 → 1.36 %). Why it makes sense: per-track drag absorbs F1-specific straight-line effects; without it the
   grip factor carries the track's own character, which transfers to other cars.
   - Code: `worker/lapsim/transfer-grip-data.js` (generated by `scripts/sim/transfer-grip.mjs <cal.js>` from
     the J run), read by `calibrate.mjs` for the WEC fit only; `LAPSIM_WEC_GRIP=f1` switches it off.
   - Check before keeping: WEC-only refit on the production model, F1 grip vs transfer grip, gate on the WEC
     held-out rows (TRANSFER_CHECK).
   - When B finishes: compare B vs J on WEC. If B is as good, regenerate the transfer file from B (simpler:
     no banking dependency).
3. Banking: keep the code and the Zandvoort data (physically right, explains a track factor); do not switch it
   on for F1 production until it passes the F1 gate in a run together with the car-model work (§6.1).
4. Vertical curvature from the smoothed grade: rejected for F1; revisit with better z (§6.2).
5. Grip bounds: rejected; do not bound until physics explains the factors.
6. Per-event BoP: rejected; investigate how mass/power enter the kernel for Hypercars before retrying.
7. Axle model (F–I): results pending at handoff; decide with the gate. Expect it to matter most for the
   ClA-at-bound signal (§4.4).

### 5.5 Step 4 — prediction ranges (coverage test) (`scripts/sim/intervals.mjs`)
- Rule: the range for a group (F1, WEC class) in a season is learned from the **other** season only and tested
  on this season's held-out laps. Two rules declared before testing: current (±k·RMS, centred on the model)
  and candidate (centre shifted by the other season's mean error, width ±k·SD·√(1+1/n)). Score = Gaussian
  negative log-likelihood per row, paired gate.
- Result on variant A (67 held-out rows): current rule covers **60 % at ±1σ and 99 % at ±2σ** (target 68 / 95 %);
  candidate 76 % / 99 % but worse mean NLL → **rejected; keep the current ranges** (they are close to honest).
  Per group, WEC LMGT3 2025 covers only 20 % at 1σ (small n = 5).
- Run on any calibration: `node scripts/sim/intervals.mjs <cal.js>`.

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

### 9.5 Recipe for one physics item (the loop I used every time)
1. **Write the goal and the pass check first** (one line each). Example: "Goal: corner minima within 5 km/h
   bias. Pass: F1 2025/2026 held-out not worse (gate), WEC held-out not worse per class, validate.mjs corner
   bias closer to 0, raced reproduction tests green."
2. **Look at the data that the change is meant to fix** (worst residuals, the sign pattern per track/class).
   Ask the data-check question first (§9.1). Write down what you expect the change to do *before* running it
   (e.g. "ClA should drop from 7.0 to ~4–5").
3. **Implement behind a flag**, default off. Keep the diff small (Ponytail). Prove byte-identical default output:
   a small script that runs 4 tracks × 2 cars with the old and the new kernel and prints lap times to 6 decimals
   (I copied the old `kernel.js` from `git stash` into a scratch folder and imported both).
4. **Quick local sanity**: one or two laps with the flag on; look at the speed trace at a known corner;
   magnitudes must be physical (banking taught this: 104 → 180 km/h at Zandvoort T3 = too much).
5. **Declare the variants** in `probe-exp.json` (include the baseline A and 1–2 sensitivities) and push.
6. While it runs: write the doc section and the test; prepare the comparison.
7. **Gate** with `exp-compare.mjs` per group. Accept only groups that pass. A mixed result (better WEC, worse F1)
   means: use it only where it passes, or find the physics reason before using it at all.
8. **Apply** accepted settings to production (`lapsim-data.yml` env or code default), run the full pipeline
   (or wait for the next scheduled run), check raced reproduction (tests) and held-out numbers again.
9. **Document** accepted and rejected with numbers (`docs/lapsim-*.md`), then PR, then report.

### 9.6 Reading gate results correctly
- `gate()` compares squared errors per row: d_i = e_cur,i² − e_new,i²; accept if mean(d) > 1·SE(d) and n ≥ 5.
- "gain within noise" is NOT a reason to keep a change. Keep the current model.
- Small groups (WEC: 5–6 tracks per class-season) pass or fail easily on one track. Prefer pooled decisions
  (all WEC, all F1) and use per-group results to see where it helps; do not cherry-pick a single season.
- Watch for the "it helps 2026 but hurts 2025" pattern (seen for drag-off variants in WEC): this usually means
  the change trades one track's error for another's. Look at the per-track rows before deciding.
- The same gate works for distributions: pass √(NLL − min) as "errors" and it compares mean NLL (used in
  `intervals.mjs`).

### 9.7 Commands cookbook
```
# branch from upstream
git fetch upstream main && git checkout -b feat/<x> upstream/main
# tests (26 local failures are environment; compare with clean main if unsure)
node --test tests/*.test.mjs 2>&1 | grep -E "^# (pass|fail)"
node --test tests/lapsim.test.mjs            # reproduction tests: F1 39, series 9, WEC
# experiment status / download
gh run list -R kangjeongmin1229/f1-data-analyst-deploy -b probe/lapsim-exp -L 3
gh run view <id> -R kangjeongmin1229/f1-data-analyst-deploy --json jobs -q '.jobs[]|"\(.name) \(.status) \(.conclusion)"'
gh run download <id> -R kangjeongmin1229/f1-data-analyst-deploy -n exp-<X> -D <dir>
gh api repos/kangjeongmin1229/f1-data-analyst-deploy/actions/jobs/<job id>/logs   # full job log
# compare and validate locally
node scripts/sim/exp-compare.mjs <dir>/A/cal-A.js <dir>/B/cal-B.js
LAPSIM_CAL_FILE=<dir>/B/cal-B.js node scripts/sim/validate.mjs B     # needs exported .cache + tracks-data.js
node scripts/sim/intervals.mjs <dir>/B/cal-B.js
# WEC-only refit (keeps F1): LAPSIM_ONLY=wec node scripts/sim/calibrate.mjs
```
Waiting for long jobs: the environment blocks plain `sleep N` chains; use an until-loop
(`until <check>; do sleep 60; done`) in the background with a long timeout. Container restarts kill watchers —
check and re-create them after a restart notice.

### 9.8 Communication with the owner (what works)
- He writes in Korean; answer in **English B1–B2**, short, tables, KST times. Korean only for quoting him or
  when he writes long Korean instructions and the answer is mainly for him to act on (he accepted Korean
  answers for click lists).
- He wants: a per-step report the moment a step ends; ETAs per step when asked "언제"; honesty about slips.
- He is strict on accuracy words: never say "0 %" for a prediction; say "reproduces 0.000 % on raced
  sessions" and "held-out X %".
- He prefers you act without asking for routine things (enter the repo, push, PR). He merges himself.
- Things the safety layer refuses (don't promise them): clicking Merge on upstream, changing network/security
  settings in his account (he added the artifact domain himself), deleting branches on GitHub (403).
- When he asks "내가 클릭해줘야 하는거 있나", give one list with links, grouped: required / optional.

### 9.9 Decision log — what was tried across the project (keep, do not repeat blindly)
| Topic | Tried | Result | Lesson |
|---|---|---|---|
| Race pace | tuned on its own test set (0.62 %) | re-test on unseen seasons: 2024 1.00 %, 2025 1.10 % | never tune on test rows |
| Racing line for lap time | per-car optimised line | laps 3.5–5 % fast | grip is calibrated on the timing path; refit needed |
| Brakes | compare simulated peak g with Brembo | 1.5× too high | compare the mean g of the hard part; add 0.73 s build-up |
| WEC tyre compound effect | Timing71 stints, within car | rejected (1.44 vs 1.41 %) | stint noise ~1.4 % ≫ compound step |
| WEC + Timing71 2023–24 bests | in the real pipeline | all 6 class-seasons rejected | a simplified local test accepted it; always gate in the real pipeline |
| Track temperature + other series | 189 sessions | rejected; unseen-series 4.96 °C | missing weather stored as 0/255 → filter |
| WEC track evolution | 60 Timing71 tables | rejected | keep off |
| Stint energy + 2024 rows | gate | rejected (noise); unseen-season 3.04 % shown | report honest unseen tests even when rejected |
| Austin 2025 WEC | data check | wet session → excluded; holdout 3.8 → 1.5 % | data first |
| Per-track grip bound 0.9–1.1 / 0.95–1.05 | S1 C, D | F1 worse | explain track factors with physics instead |
| Vertical curvature from grade | S2 E | F1 worse, WEC 2026 better | grade is over-smoothed; better z needed |
| Per-event WEC BoP 2025 | every variant | rejected (held-out worse) | BoP inputs alone do not explain lap differences between cars in our model; check mass/power use in the kernel |
| Prediction range with bias shift | S4 | rejected; current range covers 60 % / 99 % at 1σ / 2σ | current ranges are close to honest |

### 9.10 PR descriptions that the owner liked
- Title = what changed + the key number (e.g. "WEC 2025 calibration without the wet COTA session: holdout LMH
  3.80→1.54%…").
- Body: Goal, What changed (bullets), Numbers table (before/after, held-out), Gate verdicts incl. rejections,
  Tests (pass/fail counts and "same failures as main"), Data/licence notes, Follow-ups. End with the
  attribution line required by the environment.

### 9.11 Time estimates (measured today; use for ETAs)
| Job | Time |
|---|---|
| OpenF1 fetch 2023–2026 (Actions) | 2 h 12 min |
| Full export probe | 2 h 29 min |
| One calibration variant, production settings, point-mass | 1 h 33 min – 3 h+ |
| Axle-model variant | slower; may hit the 340 min job limit |
| Full `lapsim-data.yml` | ~3.5 h |
| Timing71 collection (8 shards) | ~1–2 h |
| Local validate/compare on downloaded results | seconds |

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
