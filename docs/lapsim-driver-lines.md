# Racing line per F1 driver

Generated 2026-11-15T04:06:52.785Z by `scripts/sim/driver-lines.mjs` and `driver-lines-data.mjs`.

Public F1 positions are snapped to one reference path, so no driven line is measured. Each driver's line is estimated from the speed trace of the best clean dry qualifying lap (TracingInsights): the least-curvature / shortest-path share is fitted per window (10 windows) so the simulated corner minimum speeds (season car, session weather, one common scale) match the driver's. The test lap is the driver's next clean lap within 2 % of the best, not used in the fit. Laps whose error before the fit is 25 % or more (aborted, traffic) are dropped.

Error = RMS of the corner minimum speeds, %.

| Season | Tracks | Drivers | Fit lap, car line → driver line | Unseen lap, car line → driver line | Unseen lap better |
|---|---|---|---|---|---|
| 2026 | 1 | 17 | 13.5 → 12.52 | 12.86 → 12.14 | 15 / 16 |
| 2025 | 0 | 0 | null → null | null → null | 0 / 0 |

Reading: most of the remaining error is the car model (grip, aero, energy), not the line; the line explains a small part, and the unseen-lap check says whether that part is real or noise for each driver.
