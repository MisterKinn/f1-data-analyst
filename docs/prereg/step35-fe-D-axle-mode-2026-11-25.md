# Step 35 D — Formula E Gen3 Evo axle mode by rule (pre-registration, 2026-11-25 18:15 KST)

Central 18:10 item 1: one run, rules-correctness change judged "no worse". Written before any candidate number. Measured data unchanged
(sha256 check of scripts/sim/data/learn before and after); 2022 LOCKED closed. Base: upstream main 4e60d9fa.

## Rule facts
SR 2024-25 Art. 33.5: qualifying groups ≤ 300 kW. Art. 33.6: duels ≤ 350 kW, "4-Wheel Drive Mode" authorised, front powertrain
≤ 50 kW and ≤ 60 Nm; 4WD is not authorised in the groups. TR 2024-25 Art. 7.5: discharge ≤ 350 kW. Gen3 (S9–S10) is rear drive (unchanged).
Today: `gen3EvoCar` has `awdAboveKph: 0` (four-tyre traction, no front cap) in groups and duels.

## Change (flag `LAPSIM_FE_AXLE`, unset = today, byte-identical)
- Kernel hook `car.frontMaxW`: when the car drives four wheels, traction force ≤ min(μ·N, rear-axle limit + frontMaxW / v). Unset = today.
- V1 (`LAPSIM_FE_AXLE=v1`): Gen3 Evo groups rear drive; duels four-wheel with frontMaxW = 50 kW. The 60 Nm cap is not modelled (front gear ratio not published).
- V2 (`LAPSIM_FE_AXLE=v2`): Gen3 Evo rear drive in all qualifying laps.
- Everything else as build-fe.mjs (same rows, weather, quali realisation factor, ridge fit G + T, τ_T 0.05).

## Judgement (fixed now)
- Rows: the Gen3 Evo fit rows (21, 14 layouts); the fit uses all rows (Gen3 included) as today. Error = event-hidden %, as fe-fit.json.
- Baseline must reproduce the shipped fe-fit.json event errors exactly (else the run is void).
- Per variant: paired harm d_i = |e_cand,i| − |e_base,i|; layout-clustered bootstrap (2000, seed 35); kForVariants(2) → one-sided 97.5 % UB.
- **Pass: UB ≤ 0.10 pp.** If both pass, V1 is the one that ships (closest to the rule). Fail → not shipped; listed as a known rules mismatch with its number.
- Guards: energy-closure test and the full CI list pass with the flag off; other series byte-identical (flag off).
- Report (not judged): RMS event-hidden per variant, G per rule set, sector split (duel-matched).
- Power (from the draft): MDE 0.39–0.77 pp for superiority; no superiority claim.
