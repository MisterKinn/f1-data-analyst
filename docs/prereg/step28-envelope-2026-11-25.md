# Pre-registration — step 28: effective g-g-v envelope + DRS fit on speed traces (2026-11-25 01:40 KST)

Written after the baseline run and power check, **before any candidate fit or candidate result**. No variant code exists yet.
Authority: claude/plan-step28-envelope-fit-2026-11-24.md, claude/decision-central-28-start-2026-11-25.md, claude/decision-central-step24-v2-result-2026-11-24.md, claude/target-lapsim-2026-11-24.md.
Skills (Skill tool): meta-discipline-physics:experimental-method-and-error-analysis, meta-discipline-physics:model-building-and-approximation, meta-discipline-physics:classical-mechanics, anthropic-skills:ponytail.

## 0. Base and reproducibility
- Fork branch `step28-envelope` at **68e10fd** (from upstream/main 1d3b19e). Step-27 pipeline not merged: baseline cites commit + input hashes; every fit runs on GitHub Actions on the fork by `workflow_dispatch` (research mode; `prep_run=45123509702` pinned inputs where the lapsim build is needed), never by push to `lapsim/**`, never `score_locked`. Each number cites its run id.
- 2022 LOCKED (`f1-delta-cases-2022-LOCKED.csv` 92a9f542…, `offset-2022-LOCKED.json`) is not loaded; `F1_DELTA_LOCKED_APPROVED` never set. Fit/LOTO scripts assert year ∈ {2023, 2024, 2025}.
- Seeds: start points seed 28; bootstrap seed 28.

## 1. Data (fixed; baseline run done)
- Script `scripts/sim/learn/f1-envelope-baseline.py` sha256 `a747ebff…8e6c`; inputs: `zone-mapping-table.csv` sha256 `078fd588…6d17`, TracingInsights (FastF1 car data) pinned commits 2023 `737c84d3`, 2024 `d1543a71`, 2025 `dfb3ea3f` (full SHAs in the script). Output `scripts/sim/data/f1-envelope/envelope-baseline.json` sha256 `fce074ac…9a29`.
- Unit: qualifying fastest lap per event, 2023–2025, events with a simulator track: 70 → **56 kept, 24 tracks** (speed bin present on 23).
- Drop rules (all applied in the baseline): fastest lap not on SOFT/MEDIUM/HARD (3); any INTERMEDIATE/WET lap in the session (mixed conditions); telemetry hole > 1.0 s or non-monotonic time (7; holes of 1.08–1.22 s seen); frame corr < 0.93 (Jeddah 2024, 2025).
  - **Disclosure:** the mixed-session rule was added after the first baseline pass showed Montreal 2023 at −9.7 % lap error (drying session). It was fixed before any candidate exists and is applied identically to every variant.
- Distance = speed integrated over time, scaled to the sim track length. Alignment = step 24 v2 `lag_of` (±200 m) vs the shipped car; kept laps: corr median 0.975, lag −30…+35 m. σ_align ≈ 10 m (step 24 thirds spread; p90 20 m) — carried as a systematic, not fitted.
- Segments: apex = measured-speed minimum within ±150 m with ≥ 10 km/h prominence; segment = apex ±150 m. **Straight-end segments**: measured-speed maximum ±150 m before each braking point (see §3, flagged item).
- DRS cases: `f1-delta-cases-pooled-2026-11-24.csv` (5a153cf1…, 125 cases, 23 tracks) — seen at baseline; selection only.

## 2. Baseline (shipped calibration, production path of f1-delta-bench.mjs: 2025 car, its grip, production weather, event DRS zones open)
- Speed-trace RMS in 120–240 km/h segments: per-track median **18.5 km/h** (SD between tracks 6.0).
- |lap error|: per-track median **0.77 %** (SD 0.55).
- DRS Δ pass rate: **0.8 %** (1/125); bias −0.292 s (step 24 v2, `baseline-pooled-2026-11-24.csv` 4f3505fe…).

## 3. Model (fixed)
Base car = shipped 2025 F1 car (`carsFor(id)['2025']`) with **pIce fixed 540 kW** (measured, per plan); everything not listed here stays as shipped (ERS, μx/μy ratio, mesh, conditions). One car set per season (2023, 2024, 2025).
- Lateral envelope (existing kernel form, kernel.js:290–291): a_y,max(v) = μ_y,s (1 + u_t) · (m g + ½ρ ClA_s v²)/m.
- Braking and drive: existing kernel; combined by the existing friction ellipse, k = 2 (kernel.js:215, 285–294). Not changed.
- DRS: CdA_low = CdA_s (1 − c_DRS,s); ClA_low/ClA as shipped ratio; low-drag state starts **54 m after** each zone's activation point (measured constant, not fitted).
- Free parameters per season s: μ_y,s, ClA_s, CdA_s, c_DRS,s (12) + track effects u_t (24).
- Priors (MAP; −2 log prior added to the objective):
  - CdA_s ~ N(1.35, 0.12²) m² (published 1.11–1.59 as ±2σ); physical bound > 0.
  - ClA_s ~ N(8.0, 2.0²) (weak, centred on shipped); bound > 0; the old 8.0 cap is removed.
  - c_DRS,s ~ N(0.20, 0.015²) (17–23 % as ±2σ); bound (0, 1).
  - μ_y,s ~ N(shipped μ_y, 0.3²).
  - u_t ~ N(0, 0.03²) — partial pooling; replaces the shipped per-track `grip` factor (no free per-track factor). A held-out track gets u_t = 0.
- No other bounds. A MAP value > 2σ from its prior mean is reported as **model error**, not as a physical value. Expected and pre-declared: at 540 kW the fit may push CdA above the prior (wave-3 found 1.66–1.74 at 540 kW); that is reported, not tuned away.

## 4. Objective (weights fixed)
Per training event e: J_e = RMS_corner,e / 5 km/h + RMS_straight,e / 5 km/h + |lap err_e| / 0.5 %. J = mean_e J_e + prior terms.
- **Flagged for central:** the plan names corner RMS + lap time only. I add the straight-end term because CdA and c_DRS are otherwise identified only through lap time (CdA ∝ top speed at fixed power). Central may strike it; then J_e drops that term and nothing else changes.
- DRS Δ cases are **not** in the objective (validation only).
- Optimiser: block coordinate descent — Nelder–Mead on the 12 season parameters (best of 3 starts, seed 28, ≤ 2,000 evaluations), inner 1-D golden search per u_t; deterministic. One GitHub Actions matrix job per fold.

## 5. Variants (multiplicity: at most 3; fixed order; a later one runs only if the earlier fails §7)
- **V1**: §3 as written.
- **V2**: V1 + lateral speed term decoupled from ClA: a_y,max = μ_y,s (1+u_t) g + k_y,s v², k_y,s ~ N(μ_y ρ ClA_s/2m, (0.5 × that)²); drag and normal load still from ClA_s. (+3 params.)
- **V3**: V2 + speed-dependent braking: a_x,max(v) = b0,s + b2,s v², weak priors N(shipped value at 100 and 300 km/h, 20 %²). (+6 params.) Kernel hooks behind a flag, default off, byte-identical off.
Ledger: "step 28 envelope, attempt k of 3" written before each run.

## 6. Validation (selection only; 2023–25)
- Leave-one-track-out over the 24 tracks: fold fits on 23 tracks (all their seasons), scores the held-out track's events with u_t = 0.
- **Primary (both must pass):**
  (a) held-out speed-trace RMS, 120–240 km/h segments: per-track gain = baseline − candidate (km/h);
  (b) DRS Δ pass rate on the held-out tracks' cases (target rule: |err| ≤ max(25 %, 0.05 s) and sign right), pooled over folds.
- **Guard (lap):** held-out per-track |lap error|; per decision-central-28-start item 3 the guard is **"no harm larger than its MDE"**: fails if the mean harm (candidate − baseline) > MDE = **0.36 pp**, CI reported. The δ = 5 % rule (0.039 pp here) is not judgeable at n = 24 and is stated as such. Owner reviews this wording at 06:00 before any final.
- Tests: unit = track; paired sign-flip, α = 0.05/3 two-sided per primary; bootstrap CI over tracks (10,000, seed 28). (b) also by exact binomial vs 0.008.
- Effects of interest: (a) ≥ 3 km/h; (b) ≥ +20 pp.

## 7. Power check (from the baseline rows; `scripts/sim/learn/f1-envelope-power.py` sha256 `9b42603c…7c32`, output `envelope-power.json` sha256 `94546a60…dc55b`)
z = z(1 − 0.05/6) + z(0.8) = 3.24.
| Metric | n | SD used | MDE | Effect of interest | Judgeable |
|---|---|---|---|---|---|
| (a) speed RMS gain, SD = within-track season-to-season change (1.92 km/h) | 23 tracks | 1.92 | **1.30 km/h** | 3 km/h | yes |
| (a) same, conservative SD = between-track level (6.04) | 23 | 6.04 | 4.08 km/h | 3 km/h | **no** |
| (b) DRS pass rate, cases independent | 125 | binomial at 0.008 | 5.4 pp | 20 pp | yes |
| (b) worst case, one effective case per track | 23 | binomial | 12.5 pp | 20 pp | yes |
| Lap guard | 24 | 0.55 | 0.36 pp | (δ 5 % = 0.039 pp) | guard as no-harm > MDE |
Reading: (a) is judgeable if the gain varies across tracks like the season-to-season change (the gain of one model change should not vary more than the level does between seasons); not under the most conservative SD. **Central decides which SD governs (a).** I recommend the within-track SD; if central picks the conservative one, (a) is "not judgeable at this n" and the run stops before any fit.

## 8. Pass rule and final
A variant passes if (a) and (b) are both significant at α = 0.05/3 and ≥ their effect of interest, the lap guard holds, and every parameter > 2σ off its prior is reported. Otherwise it fails (attempt counted).
Final test, once, not tonight: 2022 LOCKED DRS cases + 2022 lap error, only after central approves the chosen variant. No model change is merged; candidate PRs go to the owner as compare links.
