# Minute wind inside a qualifying session (step 12a)

Built by `scripts/sim/wind-minute.mjs` on 2026-11-23. Pre-registration: Project `claude/gate-wind-minute-prereg-2026-11-23.md`. Diagnostic only: no kernel, fit or lap change.

Each F1 driver's best dry qualifying lap 2023–26 (TracingInsights, trackside sensor one sample per minute). Δ = lap-time change the
current kernel predicts for the wind of that lap's minute against the vector-mean wind of the session (same car, track, air). Real lap
times (100·ln) and Δ are both residualised on session, team×season, driver×season and a per-session linear time term. β = slope of the
residual on Δ (the kernel says 1). Interval: 90 % session-cluster bootstrap. p: one-sided randomization test, each lap gets a random
minute of its own session's running window (2000 draws). R²phys = 1 − Σ(e − Δ)²/Σe² with β fixed at 1 (no fit).

| Group | Sessions | Laps | β | 90 % interval | p (shuffle) | R²phys | R²(β̂) | SD Δ (%) | SD residual (%) | β, lap-window wind (sensitivity) |
|---|---|---|---|---|---|---|---|---|---|---|
| held | 40 | 824 | -0.03 | -0.26 … 0.18 | 0.636 | -10.50 % | 0.01 % | 0.1150 | 0.366 | 0.04 (-0.26 … 0.33) |
| explore | 33 | 652 | 0.05 | -0.19 … 0.21 | 0.402 | -10.21 % | 0.03 % | 0.1059 | 0.315 | -0.12 (-0.34 … 0.12) |
| all | 73 | 1476 | 0.00 | -0.16 … 0.14 | 0.508 | -10.39 % | 0.00 % | 0.1111 | 0.345 | -0.02 (-0.22 … 0.16) |

Per season (reported only): 2023 β 0.20 (-0.16 … 0.38), p 0.275, R²phys -7.2 %, SD Δ 0.119 %; 2024 β -0.15 (-0.41 … 0.07), p 0.855, R²phys -13.9 %, SD Δ 0.094 %; 2025 β -0.04 (-0.36 … 0.18), p 0.680, R²phys -26.1 %, SD Δ 0.121 %; 2026 β -0.02 (-0.46 … 0.35), p 0.534, R²phys -5.6 %, SD Δ 0.108 %.

**Decision for step 12b: NO-GO** (held-out 2025–26: β 90 % CI excludes 0, randomization p < 0.05, R²phys > 0; held-out = 2025–26, explore = 2023–24).

Not pre-registered (reported only): sessions with steady wind (session vector-mean ≥ 2 m/s): held β -0.20 (-0.56 … 0.10), 14 sessions, R²phys -16.1 %; explore β -0.93 (-1.40 … -0.51), 8 sessions, R²phys -14.2 %; all β -0.26 (-0.62 … -0.01), 22 sessions, R²phys -15.7 %.

Not pre-registered (reported only): sign check with every wind direction turned by 180°: held β -0.10 (-0.31 … 0.09), R²phys -11.6 %; explore β -0.05 (-0.22 … 0.22), R²phys -12.5 %; all β -0.08 (-0.21 … 0.06), R²phys -11.9 %.

## Per track

SD Δ: within-session spread of the predicted wind effect between drivers, in ms (90 % bootstrap over laps). β per track is
descriptive only (many tracks, wide intervals; no per-track decision).

| Track | Sessions | Laps | Mean wind (m/s) | SD Δ ms (90 %) | β (90 %) |
|---|---|---|---|---|---|
| austin | 4 | 81 | 2.1 | 41.2 (33.9 … 48.4) | -0.5 (-1.88 … 0.87) |
| baku | 3 | 61 | 1.2 | 145.8 (123.7 … 166.4) | 0.1 (-0.43 … 0.75) |
| catalunya | 3 | 62 | 1.8 | 101.1 (89.4 … 112.1) | 0.4 (-0.33 … 1.15) |
| hungaroring | 3 | 62 | 1.8 | 98.0 (74.8 … 120.2) | 0.5 (0.12 … 0.97) |
| imola | 2 | 38 | 2.6 | 96.1 (78.2 … 112.9) | 1.1 (0.31 … 1.95) |
| interlagos | 1 | 19 | 1.4 | 153.5 (110.6 … 196.3) | -0.6 (-1.21 … -0.24) |
| jeddah | 3 | 58 | 1.2 | 143.5 (113.3 … 170.4) | -0.1 (-0.49 … 0.23) |
| kuala-lumpur | 1 | 22 | 0.8 | 71.9 (54.1 … 87.3) | 2.2 (-0.02 … 5.05) |
| las-vegas | 3 | 61 | 1.1 | 57.3 (47.2 … 67.4) | -1.2 (-2.64 … 0.10) |
| lusail | 3 | 60 | 2.0 | 91.2 (66.7 … 113.6) | -0.7 (-1.35 … -0.12) |
| madring | 1 | 20 | 1.1 | 139.6 (113.2 … 163.6) | 0.1 (-0.59 … 1.19) |
| melbourne | 2 | 38 | 1.6 | 90.6 (37.0 … 144.0) | 0.5 (-1.16 … 0.85) |
| mexico-city | 4 | 81 | 1.8 | 183.9 (158.9 … 210.0) | 0.2 (-0.16 … 0.54) |
| miami | 4 | 82 | 3.1 | 76.0 (63.9 … 87.2) | -1.7 (-3.32 … -0.54) |
| monte-carlo | 4 | 82 | 0.8 | 9.8 (7.3 … 12.4) | 1.5 (-1.01 … 4.24) |
| montreal | 1 | 20 | 2.0 | 19.1 (16.0 … 22.0) | -2.5 (-5.94 … 2.45) |
| monza | 4 | 82 | 1.2 | 70.6 (57.7 … 82.3) | -0.1 (-0.76 … 0.58) |
| sakhir | 3 | 60 | 1.9 | 99.6 (83.2 … 116.4) | -0.6 (-1.11 … -0.04) |
| shanghai | 3 | 62 | 2.2 | 115.9 (99.0 … 131.8) | 0.2 (-0.56 … 0.80) |
| silverstone | 2 | 42 | 3.1 | 151.7 (115.3 … 182.2) | 0.3 (0.01 … 0.53) |
| singapore | 4 | 81 | 1.6 | 44.1 (39.6 … 48.7) | -1.9 (-2.88 … -0.95) |
| spa-francorchamps | 2 | 42 | 1.9 | 74.9 (62.6 … 85.7) | -0.8 (-2.10 … 0.34) |
| spielberg | 4 | 82 | 1.0 | 89.9 (70.7 … 108.4) | 0.0 (-0.44 … 0.45) |
| suzuka | 4 | 81 | 2.5 | 129.3 (104.6 … 154.4) | -0.4 (-0.84 … 0.14) |
| yas-marina-circuit | 3 | 59 | 1.3 | 125.4 (94.4 … 153.7) | 0.1 (-0.32 … 0.58) |
| zandvoort | 2 | 38 | 3.9 | 97.2 (84.1 … 108.9) | -0.1 (-0.79 … 0.73) |

Dropped: 2023 Australian Grand Prix: rain; 2023 Belgian Grand Prix: rain; 2023 British Grand Prix: rain; 2023 Canadian Grand Prix: rain; 2023 Dutch Grand Prix: rain; 2023 Spanish Grand Prix: rain; 2023 São Paulo Grand Prix: rain; 2024 Australian Grand Prix: rain; 2024 Belgian Grand Prix: rain; 2024 British Grand Prix: rain; 2024 Canadian Grand Prix: rain; 2024 Hungarian Grand Prix: rain; 2024 São Paulo Grand Prix: rain; 2025 Azerbaijan Grand Prix: rain; 2025 Las Vegas Grand Prix: rain; 2026 Canadian Grand Prix: rain; 2026 Dutch Grand Prix: rain; 2026 São Paulo Grand Prix: rain.
## Reading (written by hand from the 2026-11-23 run)

- **Answer: no effect visible.** On held-out 2025–26 (40 sessions, 824 laps) β = −0.03, 90 % interval −0.26 … 0.18, shuffle p 0.64.
  The kernel predicts a wind effect that differs between drivers of one session by SD 0.115 % of the lap (about 100 ms; up to 150–190 ms
  at Mexico City, Baku, Interlagos, Silverstone). The real residual shows at most 18 % of that (upper bound 0.176 × 0.115 % ≈ 0.02 %,
  about 17 ms), against a residual SD of 0.37 % (about 310 ms).
- **Minute wind would make laps worse.** With β fixed at 1, R²phys = −10.5 % held-out (−10.2 % on 2023–24): the predicted per-lap
  differences add error. So step 12b (minute wind in the lap) is **no-go**.
- **Not a convention error.** Turning every direction by 180° also gives β ≈ 0 (−0.10, −0.31 … 0.09). The session mean directions match
  the known prevailing winds (Zandvoort and Silverstone from SW, Lusail and Sakhir from N–NW, Miami from SE sea breeze). The 2025 page
  and calibration paths agree within ±20 % (amendment 1).
- **Two causes, not separable with this data:** (a) one mast's one-minute sample is not the wind the car meets around the lap
  (turbulence, shelter, height); this pulls β toward 0; (b) the kernel's wind response is too large. (b) is plausible on its own:
  the fitted cars sit at ClA = 8 (bound) and give 7.4 g on a 100 m skidpad (physics review check E), so the corner downforce change from
  ±2 m/s air speed is over-weighted; a 2 m/s wind moves a lap by 0.2–0.7 s in the kernel (Suzuka 2025 page path: −379 / +740 ms).
- Steady-wind sessions (≥ 2 m/s, not pre-registered) give β −0.26 (−0.62 … −0.01), 22 sessions: no sign of a hidden positive effect.

## Measurement and error ledger

| Quantity | Value ± stat (90 %) | Systematics (named, not corrected) | Fit | Theory–data |
|---|---|---|---|---|
| β held-out 2025–26 | −0.03 (−0.26 … 0.18) | sensor mast vs car wind (biases toward 0); 2026 energy-model jitter in Δ (±20 ms per 0.01 m/s; biases toward 0); linear-in-time evolution | design: session, team×season, driver×season, session×time | kernel β = 1 is ≈ 8σ away (one-sided SE ≈ 0.13) ✗ |
| β 2023–24 (explore) | 0.05 (−0.19 … 0.21) | as above; calibration path | as above | ✗ |
| R²phys held-out | −10.5 % | — | no fit (β = 1) | adding minute wind hurts |
| Kernel wind spread between drivers | 0.115 % (≈ 100 ms) | kernel aero sensitivity (ClA at bound) | — | — |

## What this means for other steps

- **Step 12b:** no-go. Keep one wind per session.
- **Step 2b / 9 (aero and tyre):** the kernel's wind sensitivity should be re-checked after ClA and μ are separated; a car with real
  downforce levels may move much less with wind. This diagnostic can be rerun unchanged (`node scripts/sim/wind-minute.mjs`).
- The session wind itself still enters every lap (−0.2 … +0.7 s for 2 m/s). Whether it helps the held-out lap is a separate question
  (condition report: wind interval includes 0); worth a gate after step 2b.
