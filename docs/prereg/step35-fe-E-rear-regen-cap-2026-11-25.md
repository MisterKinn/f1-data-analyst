# Step 35 E — Formula E rear axle braked by regen only (pre-registration, 2026-11-25 18:50 KST)

Central 18:40 item 2: rules-correctness, judged "no worse". Written before any candidate number. Base: step35-fe-D 69504659
(upstream main 4e60d9fa + D). Measured data unchanged (sha256 check); 2022 LOCKED closed.

## Rule facts
TR 2024-25 Art. 7.5: power flow to the RESS ≤ 600 kW, rear powertrain ≤ 350 kW, front ≤ 250 kW. Gen3 / Gen3 Evo have no rear
friction brakes (FE "Gen3 facts": first formula car without rear hydraulic brakes), so rear braking = rear regen ≤ 350 kW at the battery.
Today the kernel brakes on all four tyres with no power cap.

## Change (flag `LAPSIM_FE_BRAKE=on`, unset = today, byte-identical)
- Kernel hook `car.brakeAxle = {rearMaxW, eta}` (as on step35-fe): rear braking force ≤ rearMaxW / (eta·v); tyre force split by axle
  load with braking transfer h/wb; front = friction + regen, no power cap. eta = 0.95 (wheel → battery, fe-gen4.js prior, "assumption").
- Gen3 and Gen3 Evo qualifying cars get {rearMaxW 350 kW, eta 0.95}. One variant only.
- Base for the gate = D V1 (accepted, LAPSIM_FE_AXLE=v1). Candidate = D V1 + E.

## Judgement (fixed now)
Same as D: the 21 Gen3 Evo fit rows, event-hidden %, refit G + T by build-fe.mjs; paired |e| harm, layout-clustered bootstrap
(2000, seed 35), kForVariants(1) → one-sided 95 % UB. **Pass: UB ≤ 0.10 pp.** Fail → not shipped, listed as a known rules mismatch with its number.
Guards: CI list with flags off; other series byte-identical. Report: RMS, Gen3 rows, lap change per layout.
Prior evidence (disclosed): step 35 V1 (same hook) moved laps +0.008 % (run 45515240754); no outcome on the D base is known.
