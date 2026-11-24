# Step 29b rule: a ± range on every LapSim Δ answer (written 2026-11-25 06:11 KST, before any interval was computed)

Type: display / connector change. No model change, no fit, no gate. The 2022 LOCKED cases are not read.
Seen before writing: the summary numbers in the pipeline reports (pooled DRS bias −0.292 s, median pred −0.438 s vs meas
−0.126 s; held-out RMS per group). No quantile, ratio or per-row value had been computed.

## R1 Model under test
The shipped calibration `worker/lapsim/calibration-data.js` at upstream main a42c1a7, sha256
`b5cc83df9aab550a2934691a9976a11f1d71d8350b2d331754ce21baff135861`. If that file changes, the intervals are stale and must be
rebuilt by `scripts/sim/delta-intervals.mjs` (a test enforces this).

## R2 DRS on/off (F1 cars with DRS, 2025 and earlier) — "checked"
- Source: `scripts/sim/data/f1-delta/baseline-pooled-2026-11-24.csv` (sha256 4f3505fe…, 125 pooled event × zone cases, 2023–25).
  lapsim-pipeline run **45487971969** (commit a42c1a7, shipped calibration) rebuilt this file and its report says it is identical.
- Per case: ratio ρ = meas_delta_s / pred_delta_s (measured over model). All 125 cases, no cut.
- Interval: central 90 %, empirical quantiles q05 and q95 of ρ, linear interpolation between order statistics (numpy default,
  Hyndman–Fan type 7). No normal assumption. Also kept: the median ρ and n.
- For a model Δ D (s): measured-Δ range = [min(D·q05, D·q95), max(D·q05, D·q95)]. Shown as the range and as + / − relative to D.
- Assumption (stated in the output): one ratio for every zone of a lap. The measured unit is the zone; the per-lap DRS check
  stopped on noise in step 24 (σ_meas 0.275 s).

## R3 Lap level (absolute lap) — "checked" for F1 2025/2026 and WEC LMH, LMDh, LMGT3 2025/2026
- Source: the held-out rows stored in the shipped calibration (`seasons[y].holdout.tracks`, `series.wec[c][y].holdout.tracks`),
  e = errorSec / realLap (fraction, sim − real). realLap from the same calibration's track row.
- Tie to a run: the RMS of e (in %) per group must equal lapsim-pipeline run **45402981435**'s report `diff.heldOut.*.base`
  (all 0.901, f1 0.823, wec 0.977, to 3 decimals; rounding tolerance 0.001). If not, stop and report.
- Groups: f1 (2025 + 2026 rows, n 35), wec (3 classes × 2 seasons, n 33). Per-row, not per-track (the row is the prediction unit).
- Interval: q05, q95 of e (type 7). True lap range for a model lap L: [L / (1 + q95), L / (1 + q05)].
- Small n: each tail rests on about 2 rows; say so in the output.
- Other cars (2019, 2027, 2028, GT3, FE, provisional series): "unchecked" (not in the held-out rows).

## R4 Status of each Δ type the tool returns
| Δ type (tool field) | status | reason |
|---|---|---|
| DRS on/off | checked | R2 |
| Straight Mode / Overtake (2026+) | unchecked | no measured Straight Mode Δ case (bench is 2023–25 DRS) |
| mass / fuel (sensitivity `mass`) | data limit | step 29a: fuel σ_meas 0.169 s > 0.1 s; WEC BoP mass σ_meas 0.82 s (step 21) |
| power / energy (sensitivity `engine_power`, 2026 energy) | data limit | step 24: 2026 energy has no clean pairing; WEC BoP power σ_meas 0.82 s |
| tyre (sensitivity `tyre_grip`, wear, compound, wet) | unchecked | wear stopped on noise (29a) but grip / compound / wet Δ have no Δ check by this rule |
| weather (air, track temp, humidity, pressure, wind) | unchecked | no measured Δ check |
| track change (FIA changes) | data limit | gate 5b: not judgeable at n, every type at strength 0 |
| aero (sensitivity `drag_cdA`, `downforce_clA`) | unchecked | no measured Δ check |
| car vs car (`compare.delta_s`) | unchecked | no paired check |
| track evolution (`evolution.change_from_start_s`) | unchecked | no Δ check |
"unchecked" and "data limit" carry no number; the field says the status and why.

## R5 Display
Connector and page show the range only when `LAPSIM_DELTA_PM=on` (off by default). Ratios to 2 decimals, seconds to 0.01 s.
Every number in the data file carries its run id and input sha256.
