# Step 31 pre-reg — decoupled car limits + kerb corridor, fitted by corner phase (2026-11-25, final)

Registered after central's answers (claude/decision-central-31-power-2026-11-25.md) to the draft
(claude/prereg-step31-decoupled-DRAFT-2026-11-25.md, sha256 a62f0ea9…). Written before any candidate fit or candidate number;
the only candidate runs so far are two crash tests with 2–3 optimiser steps (not read for any choice below, not kept).
Base: upstream `MisterKinn/f1-data-analyst` main @ **eb0af5b**. Code: fork branch `step31-decoupled` @ **f3cba783** (this file is
added in the next commit, which changes nothing else). Research only: nothing ships, no model code is merged.
Skills (Skill tool): meta-discipline-physics:classical-mechanics, meta-discipline-physics:model-building-and-approximation,
meta-discipline-physics:experimental-method-and-error-analysis, anthropic-skills:geomaster, anthropic-skills:ponytail.

## 1. Idea and ledger note
One quantity: F1 corner-phase speed (entry / apex / exit) on the 2023–25 quali traces, LOTO over tracks.
**Ledger note:** reopened on new measured evidence that tells the causes apart (gate-ledger line 121 rule): 30c (g-g-v envelope;
braking ~30 % too strong; slow exits too strong; lateral low at 90–170 km/h) and 30d (kerbs + official widths ≈ 7.1 km/h of the 17.3 km/h
gap at 120–240). Structurally different from step 28: (i) braking and traction have their own limits instead of μX/μY ratios of the
lateral μ (step 28 V1/V2 kept the coupling; its V3 braking cap was never run); (ii) the objective is phase-wise, so compensating errors
are visible; (iii) corners run on a kerb/width corridor radius (step 28 used the old path). 2022 LOCKED: not opened.

## 2. Type, units, baseline
- Model change, physics correctness with component metrics (CLAUDE.md). Held-out unit: the track (24 tracks, 56 laps,
  `scripts/sim/data/f1-envelope/traces.json` sha256 17638e29…56fe). A track's seasons are averaged per track.
- Baseline: step 28 **A2** (shipped 2025 car, production path and weather, held-out grip = geometric mean of the other 23 tracks'
  shipped grip), scored by the same code in the same run. Its traces are committed (`scripts/sim/data/step31/a2-baseline-traces.json`
  sha256 7427e195…c30c85); the run regenerates them and must match byte-for-byte (this also proves the flag-off path, see §3.3).

## 3. Model (car field `decoupled` + `lateralCap`, corridor κ; all unset = today)
**3.1 Geometry.** For the 13 current-layout TUM tracks with 2023–25 laps (austin, hungaroring, interlagos, mexico-city, montreal, monza,
sakhir, shanghai, silverstone, spa-francorchamps, spielberg, suzuka, zandvoort):
- Corners: the union of the trace apexes mapped to the sim frame, one per 60 m → **88 corners**, all solved.
- Per corner, the step 30d solver (sequential LP on the lateral offset, ±200 m window, minimise peak |κ| in ±60 m; code copied) gives
  R_base on corridor TUM white lines − 1 m and R(f) on TUM − 1 m + official width Δ + f·iRacing kerb offsets (1.3 m default without
  iRacing data: interlagos, sakhir, shanghai), at f = 0, 0.25, 0.5, 0.75, 1. Table: `scripts/sim/data/step31/corridor.json`
  sha256 **75030e80…dfce** (built by `step31-corridor-export.mjs` + `step31_corridor.py`, TUMFTM/racetrack-database @ e59595d; measured
  speeds never used).
- The lap uses the kernel κ × s(f) with s = R_base/R(f), capped at 1, made non-increasing in f (a wider corridor never tightens a corner;
  solver noise), linear in f between grid points; × s within ±60 m of the apex, linear back to 1 at ±120 m; overlaps take the smaller.
  This is the 30d radius ratio applied to the kernel path, not a full-lap re-optimised line (none exists); lap distance is unchanged.
- f_kerb: one F1 parameter, prior N(0.5, 0.3²), bounded [0, 1]. The other 11 tracks keep the current path (8 without TUM edges;
  catalunya, melbourne, yas-marina-circuit have older TUM layouts).

**3.2 Car limits per season s (2023, 2024, 2025), on the shipped 2025 car with pIce fixed at 540 kW (as step 28):**
- Lateral: a_y,max(v) = μ_mech,s·g + k_aero,s·v² via `lateralCap {kind: 'quad'}` (× track grip, as every axis). Priors (30c measured
  envelope on the TUM line, 2-point 100/220 km/h bins; an upper bound for grip): μ_mech ~ N(3.07, 0.45²) g, k_aero ~ N(0.00474, 0.0013²) 1/m.
  μ_mech is the envelope's zero-speed intercept, not a tyre friction coefficient.
- Braking (tyre part; drag and rolling resistance unchanged): F = m·(b0,s + b2,s·v_air²)·grip·e(r). Priors (24-track measured braking
  p95 minus drag, LS 80–260 km/h): b0 ~ N(1.15, 0.30²) g, b2 ~ N(0.00583, 0.0015²) 1/m (total 5.0 g at 270 km/h; Brembo peaks 4.4–5.0 g).
- Traction: F = min(power force, m·a_tr,s·grip·e(r)). Prior a_tr ~ N(1.34, 0.20²) g (measured exit-phase p95, 100–120 km/h). The cap is a
  force/mass; the kernel's inertia factor still applies to the resulting acceleration.
- Ellipse: same shape (k = 2), e(r) = √(1 − r²), r = a_y / a_y,max(v) from the new lateral cap.
- Unchanged: ClA, CdA (drag check: drag is 5–10 % of braking; no CdA prior), DRS zones and timing, weather, mass.
- Track terms: grip = 1 + u_t, u_t ~ N(0, 0.03²); the held-out track has u = 0.
- A MAP value > 2σ from its prior is reported as model error, not as a physical value.

**3.3 Flag-off.** `worker/lapsim/kernel.js` changes only behind `car.decoupled` (4 conditional branches). Off = byte-identical: the 56
A2 baseline laps rerun with the changed kernel equal the committed traces (local check done; repeated in the run's `check` job).

## 4. Objective and optimiser (training folds)
Per training lap: J_e = RMS_apex,e / 5 km/h + RMS_entry,e / 0.10 s + RMS_exit,e / 0.10 s + |lap err_e| / 0.5 % (apex = model v_min within
±40 m of each measured speed minimum, all corners; phases as 30c). **J = Σ_e J_e** + Σ prior z² (+ f_kerb z², + Σ (u_t/0.03)²).
3 rounds; each round: per season Nelder–Mead (300 iterations, relTol 1e-4) from {current values, prior means + 1σ}, best kept;
then f_kerb by golden search on [0, 1] (14 steps, all training laps); then each u_t by golden search on [−0.15, 0.15].
Code: `scripts/sim/learn/step31-fit.mjs` sha256 76da2c64…6107 (`STEP31_SMOKE_ITERS` is for crash tests only and is unset in the run).

## 5. Decision (held-out, 24 folds; per-track value = mean of its events' per-lap RMS)
- **Primary (central Q1):** apex speed RMS **120–240 km/h**, gain = baseline − candidate per track. Pass: one-sided sign-flip p < 0.025
  (α 0.05 / m, m = 2) **and** mean gain ≥ 3 km/h, n ≥ 5. Report mean, 90/95 % bootstrap CI.
- **Reported, not judged:** apex RMS 120–180 km/h with CI.
- **Secondary guards (central Q2):** entry and exit phase-time RMS: fail if the candidate is worse with one-sided sign-flip p < 0.05;
  no effect-size threshold. Means and CIs reported.
- **Guards:** lap: one-sided 95 % t upper bound of the mean paired |lap err| harm ≤ 0.10 pp; DRS: pooled pass rate (|err| ≤ max(25 %, 0.05 s),
  right sign) on the 125 kept cases ≥ the A2 baseline's (zones unchanged); braking: candidate p95 −a_x ≤ measured p95 + 0.3 g in every
  20 km/h bin 80–280 km/h with ≥ 200 samples in each trace set (pooled held-out laps, 30c estimator).
- Verdict = PASS only if the primary and every guard pass.
- **Reported:** every season parameter vs its prior (median, range, z over folds), values > 2σ; **f_kerb** per fold, median, LOTO
  jackknife SE, and each fold's 90 % profile interval on a 9-point grid (J − J_min ≤ 2.71; J is a weighted fit criterion, so this interval
  is approximate); per-track results; corridor tracks vs old-path tracks.
- Verdict code: `scripts/sim/learn/step31_verdict.py` sha256 c4e72607…cef9.

## 6. Power (A2 baseline rows; local, not reproduced; the run's `check` job recomputes it)
| Metric | n | Median | SD within | MDE (Z 2.80) | Useful | Judgeable |
|---|---|---|---|---|---|---|
| **Apex RMS 120–240** | 23 | 24.7 km/h | 4.1 | **2.4** | 3 | yes |
| Apex RMS 120–180 (report) | 21 | 22.4 | 9.6 | 5.9 | – | – |
| Entry / exit Δt RMS (guards) | 24 | 0.193 / 0.347 s | 0.040 / 0.048 | 0.023 / 0.027 s | – | – |
| Lap guard | 24 | 2.57 % | 0.85 | UB half-width 0.29 pp | 0.10 | needs a real lap gain |

## 7. Variants
- **V1** = §3 (attempt 1).
- **V2** = V1 with f_kerb fixed at 0 (widths only, no kerbs); runs only if V1 fails (attempt 2; α already split for m = 2). No third attempt.

## 8. Run and rules
- Workflow `.github/workflows/lapsim-step31-fit.yml` (sha256 03434c0d…b46a), dispatched on the fork in research mode; its run id is
  cited for every number. It follows step 28's `lapsim-envelope-fit.yml`: `lapsim-pipeline.yml` has no leave-one-track-out job, so the
  fit runs in this research workflow on pinned committed inputs (traces, corridor table, case CSVs), like steps 28 and 22.
- No verdict until all 24 folds exist; a fold that fails for infrastructure reasons is rerun on the same commit (not a new attempt).
- Ledger line before the run (result pending); result after. 2022 LOCKED never read (asserted). No model code merged.
- Limits: iRacing kerbs are GT/LMP behaviour; the 30c envelopes are p95 statistics, not limits; the b0 + b2·v² form misfits the p95
  envelope by up to 0.56 g at the ends (so the braking guard compares binned p95); the corridor changes κ near apexes only.
