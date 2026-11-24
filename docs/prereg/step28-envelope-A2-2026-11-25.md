# Step 28 pre-reg — amendment A2 (2026-11-25 05:22 KST)

Base: pre-reg 6e944cd15a8b6ccf1c49bbe48928cc2596e980b488150e15a4ef1708a9f4407f + A1 8d6bb17ebb521dbd48d80de326f637565ec8acce1a1e658fb407fdec41935909.
Source: claude/decision-central-28-v1-result-2026-11-25.md (A2 approved) and claude/decision-central-28-cutoff-2026-11-25.md. Written before any A2 baseline row, A2 power number, V1-under-A2 number or V2 run.

## A2.1 Baseline scored like the candidate (replaces the baseline definition of §2/§6 and A1.4)
For each held-out track t, the baseline is the shipped 2025 car on the production path with **t's grip replaced by the geometric mean of the shipped grip factors (`carsFor(id)['2025'].grip`, missing = 1) of the other 23 fold tracks**. Nothing else changes (shipped pIce, shipped DRS zones without delay, production weather, same scoring code). Implemented in `f1-envelope-fit.mjs` as the baseline of the fold; the `--baseline-check` against the in-sample python rows stays as a code check only.

## A2.2 Power first
Recompute from the A2 baseline rows, before any candidate number under A2: (a) planning MDE (within-track SD rule of A1.2), (b) DRS pass-rate MDE, paired lap-guard MDE. Guard rule unchanged: one-sided 95 % UB of mean paired harm ≤ 0.10 pp. If (a) or the guard is not judgeable, stop and report.

## A2.3 V1 under A2 — report only
Re-score V1's fold artifacts (run 45452323287, no refit) against the A2 baseline. Reported, not a verdict; V1 stays "attempt 1 of 3: FAIL".

## A2.4 V2 = attempt 2, judged under A2 only
Form exactly as pre-reg §5 (lateral k_y,s decoupled from ClA, prior N(μ_y ρ ClA_s/2m, (0.5 × that)²)). Ledger line before the run. Kernel hook behind a flag, default off, byte-identical off; not merged.

## A2.5 Limits
V3 not run before the owner's review. 2022 LOCKED never opened. No model code merged. Runs on the fork (lapsim-envelope-fit.yml) or the merged step-27 pipeline (ae9b798), run ids cited.
