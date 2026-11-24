# Step 29a — stint-pace Δ benchmark: case rules (fixed before any lap time is read)

Written 2026-11-25 00:20 KST, before any lap time was read. Only column names of one TracingInsights file were looked at
(2024 Bahrain race, `session_laptimes.json` keys). Report-only: no model change, no pre-registration for a model change.

## 1. Source and scope
- F1 Grand Prix **races** 2023, 2024, 2025 (not sprints, not 2022, not any event after 2026-11-23).
- Source: TracingInsights/{year} on GitHub (`<Event>/Race/session_laptimes.json`), the FastF1 export the repo already reads
  (scripts/sim/ti-races.mjs, f1-delta-fetch.py). The FastF1 archive itself answers 401 from this workspace, so FastF1 is used
  through this mirror. The repo commit of each TracingInsights repo is recorded in the output.
- Columns used: `drv, lap, time, compound, stint, life (TyreLife), fresh, status (TrackStatus), pin, pout, del, iacc, sesT`,
  and the weather rain flag `wR`.

## 2. Event rules
- Dry only: the event is dropped if any weather row has rain (`wR` true) or any driver ran INTERMEDIATE or WET.
- Race length N = the winner's last lap.

## 3. Lap rules (a lap must pass all)
1. Compound in {SOFT, MEDIUM, HARD}; `time` finite; `del` not true; `iacc` true.
2. Not lap 1 or 2; not the last 2 laps (laps N−1, N).
3. No in or out lap: `pin` and `pout` both empty.
4. Green: `status` contains only "1", and the previous lap of that driver is also only "1" (no restart lap).
5. Not the stint's first flying lap: the lap right after the out lap is dropped (warm-up).
6. Traffic: on-track gap to the car ahead ≥ 2.0 s at both line crossings (start and end of the lap). The car ahead is any car
   (any lap count) whose previous line crossing (`sesT`) is the latest one before this car's crossing.
7. Within 107 % of that driver's median clean lap in the race.
8. After the event fit (§5), laps with |residual| > 3 × 1.4826 × MAD of the event's residuals are removed once and the fit is
   repeated (one pass only).

## 4. Stint rules
- Stint = (driver, `stint`), one compound. Kept if ≥ 8 clean laps and a tyre-age span (max − min `life`) ≥ 8 laps.
- Tyre age = `life`. Used-tyre stints (`fresh` false) are kept; `fresh` is recorded.

## 5. Measured quantities and separation method
One fixed-effects OLS fit per event over all kept laps (no shrinkage):

  t = α[driver, stint] + Σ_c w_c · age · 1[compound = c] + φ · (lap − 1)

- α per driver-stint absorbs driver pace, compound offset and new/used tyre.
- **Q1 tyre wear w_c (s/lap of tyre age), fuel-corrected**: the fuel and track-evolution trend is carried by φ, so w_c is the age
  slope with that trend removed. Separation works only through tyre-age resets at pit stops: within a stint age and lap rise
  together; only drivers with ≥ 2 kept stints tell φ apart from w.
- **Q2 fuel effect**: φ (s/lap of race). Converted to s/kg as −φ / b with b = 100 kg / N (declared burn, not measured).
  φ also contains track evolution (rubber); the two cannot be separated with lap times alone, so Q2 is "fuel + track
  evolution". This is the same quantity as `slope` in worker/lapsim/race-pace.js.
- Separable only if the event has ≥ 6 drivers with ≥ 2 kept stints. Q1 for (event, compound) needs ≥ 4 kept stints on that
  compound.
- Systematic cross-check (report only): w_c with a fixed fuel prior instead of φ: per-stint age slope + f0 · b,
  f0 = 0.030 s/kg (range 0.025–0.040), b as above.

## 6. Cases and the Δ in seconds
- Q1 case = (season, event, compound). Δ_wear = w_c × 20 laps (time lost to 20 laps of tyre age), s.
- Q2 case = (season, event). Δ_fuel = −φ × 20 laps (time gained over 20 laps of burn + rubber), s. Also reported in s/kg.
- 20 laps = a typical stint, fixed here so the 0.1 s limit applies in seconds.

## 7. Noise first (step 4)
- Per case: σ_boot = SD of the case value over a cluster bootstrap by driver within the event (B = 2000, seed 29), and
  σ_split = |h1 − h2| / 2 from two halves (drivers sorted by car number, alternate). σ_meas = max(σ_boot, σ_split).
- MDE per case = 2.8 × σ_meas (two-sided 5 %, 80 % power); MDE of the pooled mean = 2.8 × RMS(σ_meas) / √n.
- **Stop rule:** a quantity stops if the median per-case σ_meas > 0.1 s. If it passes, cases with their own σ_meas > 0.1 s are
  left out of step 6 and listed; with fewer than 10 cases left: "not enough data".
- σ_meas / |median Δ| is reported beside it (the quantity's own scale).

## 8. Step 6 (only for quantities that pass §7)
- Prediction = current upstream/main `worker/lapsim/race-pace.js` track parameters for that track: wear[c] × 20, −slope × 20.
- Pass per case: |pred − meas| ≤ max(0.25 × |meas|, 0.05 s) and the sign is right. Report pass rate vs 80 %, bias
  mean(pred − meas) with 95 % bootstrap over events (10,000, seed 29), median absolute error, and each case.
- Main's race-pace factors are fitted on OpenF1 race laps that include these races: the comparison is **in-sample** and is
  labelled so. No model change follows from it here.

## 9. Freeze
The case CSV (one row per case: value, σ_boot, σ_split, n laps, n stints, n drivers) is written by one script, hashed (sha256),
and committed on a branch from upstream/main (data + research scripts only).
