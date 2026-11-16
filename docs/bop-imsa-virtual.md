# BoP simulator: IMSA, real and virtual tabs (owner 2026-11-16)

- **Real BoP tab** (`/bop`): WEC Hypercar and LMGT3 2026 (estimated, FIA/ACO stopped publishing), ELMS LMGT3 2026 (official where
  published, else estimated), and now **IMSA GTP and GTD PRO/GTD 2024-2026**: the official table of every event (IMSA publishes them).
- **IMSA data**: 37 BoP bulletins (imsa.com technical bulletins 2024-2026), table rows read from the PDFs with pdf.js in the owner's
  built-in browser (imsa.com refuses GitHub Actions and the shell: HTTP 403), stored in `scripts/sim/data/imsa-bop-raw.json`, parsed by
  `scripts/sim/learn/parse-imsa-bop.mjs` into `scripts/sim/data/imsa-bop.json` and `worker/lapsim/bop-imsa-data.js`. 2024 GTD tables use
  restrictors and boost, so only the weight is kept. A row the reader could not tie to a car can be missing (2025 GTD McLaren).
- **Virtual BoP tab** (`/bop?mode=virtual`): every simulator circuit, for WEC Hypercar, WEC LMGT3, ELMS LMGT3, IMSA GTP, IMSA GTD.
  `scripts/sim/bop-virtual.mjs`: per car and value = class level at the track + car offset + car slope x track character (simulated
  mean and top speed of the class car, standardised); ridge on the slopes, strength chosen leave-one-track-out on events up to 2025
  (a "no circuit effect" candidate included), error reported leave-one-track-out on 2026 events. Result: the circuit effect is small;
  it helps IMSA GTP weight (8.5 vs 9.0 kg) and GTD stint energy (18.4 vs 19.3 MJ), and most values fall back to the car mean.
- **Updates**: the daily BoP refresh (`.github/workflows/bop-refresh.yml`) re-runs the estimators, then `parse-imsa-bop.mjs` and
  `bop-virtual.mjs`, so every new real BoP (published, or estimated after a race) moves both tabs. New IMSA bulletins (next: January
  2027) must be read through a browser (imsa.com blocks the Actions runners); `imsa-bop-raw.json` then gets the new rows.
