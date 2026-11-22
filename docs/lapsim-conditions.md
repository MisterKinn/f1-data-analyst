# Conditions and held-out error

Built by `scripts/sim/condition-report.mjs` on 2026-11-22 (AGENTS.md Gate G v3.1, item 7) from the production held-out rows
(68 rows). Slope = change of held-out lap error (% of the real lap) per unit of the condition, with its 90 % bootstrap interval;
R² = share of the error variance that condition explains alone. An interval that excludes 0 marks a condition the model may be missing;
it becomes a model term only through a pre-registered gate. Real laps and weather are never changed.

| Group | Condition | n | Slope (%/unit) | 90 % interval | R² |
|---|---|---|---|---|---|
| all | track temperature (°C) | 68 | -0.0335 | -0.0514 … -0.0150 | 0.10 |
| all | air temperature (°C) | 68 | -0.0736 | -0.1034 … -0.0458 | 0.19 |
| all | wind (m/s) | 68 | 0.1295 | -0.1138 … 0.3425 | 0.02 |
| all | humidity (%) | 68 | 0.0034 | -0.0083 … 0.0148 | 0.00 |
| all | air pressure (hPa) | 68 | 0.0026 | -0.0014 … 0.0103 | 0.01 |
| f1 | track temperature (°C) | 35 | -0.0104 | -0.0351 … 0.0157 | 0.01 |
| f1 | air temperature (°C) | 35 | -0.0236 | -0.0555 … 0.0107 | 0.02 |
| f1 | wind (m/s) | 35 | 0.1279 | -0.0700 … 0.3463 | 0.03 |
| f1 | humidity (%) | 35 | -0.0074 | -0.0220 … 0.0071 | 0.02 |
| f1 | air pressure (hPa) | 35 | -0.0009 | -0.0041 … 0.0048 | 0.00 |
| wec | track temperature (°C) | 33 | -0.0418 | -0.0710 … -0.0186 | 0.14 |
| wec | air temperature (°C) | 33 | -0.0990 | -0.1644 … -0.0614 | 0.31 |
| wec | wind (m/s) | 33 | 0.1528 | -0.3528 … 0.4763 | 0.02 |
| wec | humidity (%) | 33 | 0.0129 | -0.0065 … 0.0326 | 0.03 |
| wec | air pressure (hPa) | 33 | 0.0139 | -0.0008 … 0.0231 | 0.11 |

Rows without weather: none.
Not recorded in the data (cannot be checked yet): tyre age / set, tow (slipstream), fuel load, track evolution (rubber).
