# Step 31 pre-reg — amendment A1: corrected kernel as the base (2026-11-25)

Base pre-reg: `docs/prereg/step31-decoupled-2026-11-25.md` sha256 5f564ba8bc1e57687ef100c6269d3e4dbe64aa5f86f13d0124e6af30f1eaed32.
Source: claude/decision-central-refit-result-2026-11-25.md (central 08:05) and the owner's instruction of 07:52 KST.
Written before any candidate number. State of candidate runs: run 45504466019 stopped in the `check` job (pip path) and run 45504950228
was cancelled by me during its `check` job, both before any fold started; no fold file exists. Neither is an attempt.
Skills (Skill tool): meta-discipline-physics:classical-mechanics, meta-discipline-physics:model-building-and-approximation,
meta-discipline-physics:experimental-method-and-error-analysis, anthropic-skills:geomaster, anthropic-skills:ponytail.

## A1.1 Base
Step 31 runs on the corrected kernel: fork branch `step31-k2` = upstream main eb0af5b + the two commits of
`fix/kernel-deploy-accounting-2026-11-25` (79452d2 kernel deploy accounting, ca80634 pipeline report; cherry-picked, kernel and tests
equal to that branch) + the step 31 commits. When the Suzuka puRamp mesh fix (step 27 session) lands on that branch, it is
cherry-picked onto `step31-k2` **before** the V1 run; V1 does not start without it. The old branch `step31-decoupled` is not used again.

## A1.2 Baseline and power on the corrected kernel (recomputed; local, not reproduced — the run's `check` job repeats it)
- A2 baseline traces on the corrected kernel: sha256 **7427e195…c30c85, byte-identical** to the committed rows on the old kernel
  (56 laps). Reason: the fix changes deploy booking on the causal 2026 path only; every step 31 lap uses the 2025 car (ERS rule f1-2014).
- Candidate path check: 56 laps with the candidate car at prior means (lateral quad, decoupled braking and traction, pIce 540 kW) give
  identical speed traces on both kernels (max |Δv| 0). So the fix moves neither side of this comparison.
- Power therefore unchanged: primary apex RMS 120–240 km/h, n 23, SD within 4.1 → **MDE 2.4 km/h < 3 km/h: judgeable.**
  (120–180: 5.9 km/h, reported only; entry/exit guards 0.023 / 0.027 s; lap guard UB half-width 0.29 pp.)
- The mesh fix touches the 2026 power-ramp hold (env.puRamp acts only with ERS rule f1-2026), so it cannot change these rows either;
  the run's `check` job proves it: it regenerates the A2 traces on the final base and requires byte-identity with 7427e195…

## A1.3 Unchanged
Model, priors, objective, decision rules, guards, variants (V1; V2 = f_kerb 0 only if V1 fails) exactly as the base pre-reg and
claude/decision-central-31-power-2026-11-25.md. Workflow push trigger branch renamed to `step31-k2` (mechanical). 2022 LOCKED not opened.
If V1 passes, the kernel fix ships with step 31 in one PR and one production refit (owner decides); nothing merges from this research run.
