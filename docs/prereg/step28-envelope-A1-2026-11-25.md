# Step 28 pre-reg — amendment A1 (2026-11-25 02:30 KST)

Base: `docs/prereg/step28-envelope-2026-11-25.md` sha256 6e944cd15a8b6ccf1c49bbe48928cc2596e980b488150e15a4ef1708a9f4407f.
Source: claude/decision-central-28-prereg-2026-11-25.md (APPROVED with A1). Written before any fitter code ran and before any fold result.

## A1.1 Lap guard (replaces §6 "Guard" and the lap row of §7)
Per track, paired harm h_t = |lap err|_candidate − |lap err|_baseline (pp), held-out.
**The guard fails if the one-sided 95 % upper bound of mean(h_t) > 0.10 pp** (t-interval over tracks; bootstrap 10,000, seed 28 reported beside it). If the bound cannot be brought under 0.10 pp because the data are too noisy, the guard fails (it protects the product). Realised paired SD and paired MDE are reported.

## A1.2 (a) judgeability
Planning MDE 1.30 km/h (within-track SD) accepted. The test uses the realised per-track gains: if the realised 95 % CI half-width of the mean gain is wider than 3 km/h, (a) is "not judgeable" (not a pass).

## A1.3 Confirmed by central
Straight-end term kept; pIce 540 kW with CdA prior N(1.35, 0.12) kept, CdA > 2σ reported as model error; mixed-session disclosure goes into the ledger line.

## A1.4 Implementation details fixed now (no change of model or metric)
- The objective is separable by season once u is fixed (events split by season; priors per season), so the 12-parameter Nelder–Mead is run as one 4-parameter Nelder–Mead per season (same J). Steps: μ_y 0.05, ClA 0.5, CdA 0.05, c_DRS 0.01; ≤ 300 iterations (≤ 1,805 evaluations) per start; relTol 1e-4; starts: prior means, then prior means ± 0.5σ (seed 28).
- Block coordinate descent: 3 rounds (season NM, then golden search per u_t on [−0.15, 0.15], 14 steps).
- μ_y scales μ_x, μ_y and μ_x,trac together (shipped ratio kept). ClA_low = ClA × shipped ClA_low/ClA.
- Baseline and candidate are scored by the same node code (`f1-envelope-fit.mjs`); the baseline there is the shipped car on the production path (c.grip, shipped DRS zones, shipped pIce). It is checked against the python baseline rows (per-event RMS within 0.5 km/h) before any candidate number is read.
