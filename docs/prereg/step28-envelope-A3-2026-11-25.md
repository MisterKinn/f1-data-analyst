# Step 28 pre-reg — amendment A3 (2026-11-25 06:30 KST)

Base: pre-reg 6e944cd15a8b6ccf1c49bbe48928cc2596e980b488150e15a4ef1708a9f4407f → A1 8d6bb17ebb521dbd48d80de326f637565ec8acce1a1e658fb407fdec41935909 → A2 1ffd0931974633e5fd598e81f9a0b15a94d541e5d982d48347b446b3db23c6e1.
Source: claude/decision-central-28-a3-2026-11-25.md. Written before any A3 run or result.

## A3.1 Objective (replaces §4 "J = mean_e J_e + prior terms")
J = Σ_e J_e + Σ prior z² (sum over the fold's training laps). Per-lap J_e unchanged (corner RMS / 5 km/h + straight-end RMS / 5 km/h + |lap err| / 0.5 %). Priors unchanged (CdA N(1.35, 0.12²), ClA N(8.0, 2.0²), c_DRS N(0.20, 0.015²), μ_y N(shipped, 0.3²), u_t N(0, 0.03²); V2's k_y as §5). The per-season split of A1.4 and the per-track golden search use the same sum (no division by the number of laps). Optimiser settings of A1.4 unchanged.

## A3.2 Lap guard (replaces the A2.2 stop clause for the guard)
Judged by its rule only: one-sided 95 % UB of mean paired harm ≤ 0.10 pp. Low power is not a stop condition. (a) must still be judgeable (A2 planning MDE 1.62 km/h < 3 km/h: yes).

## A3.3 Order (fewest free parameters first; fixed now)
- **Attempt 2 = V1 form + A3 objective** (code variant `V1-A3`).
- **Attempt 3 = V2 form + A3** (`V2-A3`), only if attempt 2 fails.
- V3 dropped.
All judged under A2 (fair LOTO baseline). Verdict by pre-reg + A1 + A2 + A3. V1 (attempt 1) stays FAIL.

## A3.4 Report
Every season parameter vs its prior (z per fold; > 2σ = model error, not a physical value), fold spread (median, min, max), run ids. 2022 LOCKED closed; no model code merged.
