# F1 gear measurements — 2026-11-10

These measurements use Monza qualifying only. Each team-season keeps its own table. The hidden-team predictor uses speed alone; RPM is used only to measure effective ratios. No kernel or production model changed.

| Season | Teams | Laps | Raw samples | Median sample spacing, s | Equivalent median Hz | Observed samples/s | Hidden-team distance, km | Correct gear distance, % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2023 | 10 | 20 | 6123 | 0.240 | 4.167 | 3.760 | 114.032 | 81.640 |
| 2024 | 10 | 20 | 6116 | 0.240 | 4.167 | 3.819 | 114.342 | 83.255 |
| 2025 | 10 | 20 | 5961 | 0.240 | 4.167 | 3.748 | 114.066 | 83.439 |
| 2026 | 11 | 22 | 6833 | 0.240 | 4.167 | 3.751 | 123.208 | 79.857 |

The source calls these car-data samples, not raw ECU telemetry. The timestamp rate is measured above; gaps and frozen samples are counted in the experiment report. This accuracy is a whole-team channel test at one circuit. It is not a test on an unseen circuit.

Absolute gearbox ratios remain empty: loaded tyre radius and final drive were not verified. The reported RPM per km/h includes both, as well as tyre slip. Relative ratios divide by the highest gear with enough valid samples. A blank ratio means too few samples.

| Season | Team | Gear | Valid ratio samples | RPM per km/h | Relative ratio | Reference gear |
|---|---|---:|---:|---:|---:|---:|
| 2023 | Alfa Romeo | 1 | 0 |  |  | 8 |
| 2023 | Alfa Romeo | 2 | 0 |  |  | 8 |
| 2023 | Alfa Romeo | 3 | 1 |  |  | 8 |
| 2023 | Alfa Romeo | 4 | 7 | 65.9452 | 1.8533 | 8 |
| 2023 | Alfa Romeo | 5 | 32 | 54.1052 | 1.5206 | 8 |
| 2023 | Alfa Romeo | 6 | 57 | 46.2209 | 1.2990 | 8 |
| 2023 | Alfa Romeo | 7 | 48 | 40.2986 | 1.1326 | 8 |
| 2023 | Alfa Romeo | 8 | 227 | 35.5818 | 1.0000 | 8 |
| 2023 | AlphaTauri | 1 | 0 |  |  | 8 |
| 2023 | AlphaTauri | 2 | 0 |  |  | 8 |
| 2023 | AlphaTauri | 3 | 2 |  |  | 8 |
| 2023 | AlphaTauri | 4 | 2 |  |  | 8 |
| 2023 | AlphaTauri | 5 | 38 | 51.9199 | 1.4686 | 8 |
| 2023 | AlphaTauri | 6 | 49 | 44.9671 | 1.2719 | 8 |
| 2023 | AlphaTauri | 7 | 59 | 39.7430 | 1.1241 | 8 |
| 2023 | AlphaTauri | 8 | 205 | 35.3540 | 1.0000 | 8 |
| 2023 | Alpine | 1 | 0 |  |  | 8 |
| 2023 | Alpine | 2 | 0 |  |  | 8 |
| 2023 | Alpine | 3 | 4 |  |  | 8 |
| 2023 | Alpine | 4 | 7 | 60.5440 | 1.7466 | 8 |
| 2023 | Alpine | 5 | 36 | 51.7376 | 1.4925 | 8 |
| 2023 | Alpine | 6 | 56 | 43.7533 | 1.2622 | 8 |
| 2023 | Alpine | 7 | 61 | 38.3412 | 1.1061 | 8 |
| 2023 | Alpine | 8 | 193 | 34.6645 | 1.0000 | 8 |
| 2023 | Aston Martin | 1 | 0 |  |  | 8 |
| 2023 | Aston Martin | 2 | 0 |  |  | 8 |
| 2023 | Aston Martin | 3 | 2 |  |  | 8 |
| 2023 | Aston Martin | 4 | 4 |  |  | 8 |
| 2023 | Aston Martin | 5 | 27 | 55.1643 | 1.4983 | 8 |
| 2023 | Aston Martin | 6 | 33 | 47.6184 | 1.2934 | 8 |
| 2023 | Aston Martin | 7 | 45 | 41.6165 | 1.1304 | 8 |
| 2023 | Aston Martin | 8 | 247 | 36.8173 | 1.0000 | 8 |
| 2023 | Ferrari | 1 | 0 |  |  | 8 |
| 2023 | Ferrari | 2 | 0 |  |  | 8 |
| 2023 | Ferrari | 3 | 0 |  |  | 8 |
| 2023 | Ferrari | 4 | 2 |  |  | 8 |
| 2023 | Ferrari | 5 | 25 | 53.9246 | 1.5156 | 8 |
| 2023 | Ferrari | 6 | 67 | 46.4100 | 1.3044 | 8 |
| 2023 | Ferrari | 7 | 60 | 40.2962 | 1.1326 | 8 |
| 2023 | Ferrari | 8 | 228 | 35.5796 | 1.0000 | 8 |
| 2023 | Haas F1 Team | 1 | 0 |  |  | 8 |
| 2023 | Haas F1 Team | 2 | 0 |  |  | 8 |
| 2023 | Haas F1 Team | 3 | 1 |  |  | 8 |
| 2023 | Haas F1 Team | 4 | 4 |  |  | 8 |
| 2023 | Haas F1 Team | 5 | 33 | 54.0841 | 1.5189 | 8 |
| 2023 | Haas F1 Team | 6 | 60 | 46.2178 | 1.2980 | 8 |
| 2023 | Haas F1 Team | 7 | 59 | 40.2563 | 1.1306 | 8 |
| 2023 | Haas F1 Team | 8 | 207 | 35.6063 | 1.0000 | 8 |
| 2023 | McLaren | 1 | 0 |  |  | 8 |
| 2023 | McLaren | 2 | 0 |  |  | 8 |
| 2023 | McLaren | 3 | 0 |  |  | 8 |
| 2023 | McLaren | 4 | 3 |  |  | 8 |
| 2023 | McLaren | 5 | 18 | 53.3410 | 1.5123 | 8 |
| 2023 | McLaren | 6 | 52 | 45.9763 | 1.3035 | 8 |
| 2023 | McLaren | 7 | 54 | 40.1086 | 1.1371 | 8 |
| 2023 | McLaren | 8 | 225 | 35.2724 | 1.0000 | 8 |
| 2023 | Mercedes | 1 | 0 |  |  | 8 |
| 2023 | Mercedes | 2 | 0 |  |  | 8 |
| 2023 | Mercedes | 3 | 2 |  |  | 8 |
| 2023 | Mercedes | 4 | 7 | 64.5525 | 1.7541 | 8 |
| 2023 | Mercedes | 5 | 18 | 55.7314 | 1.5144 | 8 |
| 2023 | Mercedes | 6 | 42 | 47.8159 | 1.2993 | 8 |
| 2023 | Mercedes | 7 | 52 | 41.7918 | 1.1356 | 8 |
| 2023 | Mercedes | 8 | 261 | 36.8013 | 1.0000 | 8 |
| 2023 | Red Bull Racing | 1 | 0 |  |  | 8 |
| 2023 | Red Bull Racing | 2 | 0 |  |  | 8 |
| 2023 | Red Bull Racing | 3 | 1 |  |  | 8 |
| 2023 | Red Bull Racing | 4 | 11 | 61.6559 | 1.7438 | 8 |
| 2023 | Red Bull Racing | 5 | 34 | 52.5383 | 1.4860 | 8 |
| 2023 | Red Bull Racing | 6 | 63 | 45.1339 | 1.2765 | 8 |
| 2023 | Red Bull Racing | 7 | 54 | 39.7679 | 1.1248 | 8 |
| 2023 | Red Bull Racing | 8 | 223 | 35.3565 | 1.0000 | 8 |
| 2023 | Williams | 1 | 0 |  |  | 8 |
| 2023 | Williams | 2 | 0 |  |  | 8 |
| 2023 | Williams | 3 | 2 |  |  | 8 |
| 2023 | Williams | 4 | 2 |  |  | 8 |
| 2023 | Williams | 5 | 10 | 55.6487 | 1.5110 | 8 |
| 2023 | Williams | 6 | 56 | 48.0527 | 1.3047 | 8 |
| 2023 | Williams | 7 | 43 | 41.8517 | 1.1364 | 8 |
| 2023 | Williams | 8 | 256 | 36.8291 | 1.0000 | 8 |
| 2024 | Alpine | 1 | 0 |  |  | 8 |
| 2024 | Alpine | 2 | 0 |  |  | 8 |
| 2024 | Alpine | 3 | 4 |  |  | 8 |
| 2024 | Alpine | 4 | 1 |  |  | 8 |
| 2024 | Alpine | 5 | 16 | 53.4760 | 1.4937 | 8 |
| 2024 | Alpine | 6 | 70 | 45.2919 | 1.2651 | 8 |
| 2024 | Alpine | 7 | 49 | 39.6595 | 1.1077 | 8 |
| 2024 | Alpine | 8 | 222 | 35.8019 | 1.0000 | 8 |
| 2024 | Aston Martin | 1 | 0 |  |  | 8 |
| 2024 | Aston Martin | 2 | 0 |  |  | 8 |
| 2024 | Aston Martin | 3 | 2 |  |  | 8 |
| 2024 | Aston Martin | 4 | 4 |  |  | 8 |
| 2024 | Aston Martin | 5 | 16 | 55.7720 | 1.5589 | 8 |
| 2024 | Aston Martin | 6 | 39 | 47.8354 | 1.3371 | 8 |
| 2024 | Aston Martin | 7 | 63 | 41.2997 | 1.1544 | 8 |
| 2024 | Aston Martin | 8 | 231 | 35.7764 | 1.0000 | 8 |
| 2024 | Ferrari | 1 | 0 |  |  | 8 |
| 2024 | Ferrari | 2 | 0 |  |  | 8 |
| 2024 | Ferrari | 3 | 3 |  |  | 8 |
| 2024 | Ferrari | 4 | 11 | 65.5165 | 1.8409 | 8 |
| 2024 | Ferrari | 5 | 23 | 54.2965 | 1.5256 | 8 |
| 2024 | Ferrari | 6 | 63 | 46.2008 | 1.2982 | 8 |
| 2024 | Ferrari | 7 | 52 | 40.2561 | 1.1311 | 8 |
| 2024 | Ferrari | 8 | 250 | 35.5896 | 1.0000 | 8 |
| 2024 | Haas F1 Team | 1 | 0 |  |  | 8 |
| 2024 | Haas F1 Team | 2 | 0 |  |  | 8 |
| 2024 | Haas F1 Team | 3 | 2 |  |  | 8 |
| 2024 | Haas F1 Team | 4 | 6 | 65.0996 | 1.8279 | 8 |
| 2024 | Haas F1 Team | 5 | 41 | 54.3158 | 1.5251 | 8 |
| 2024 | Haas F1 Team | 6 | 63 | 46.1713 | 1.2964 | 8 |
| 2024 | Haas F1 Team | 7 | 54 | 40.3275 | 1.1324 | 8 |
| 2024 | Haas F1 Team | 8 | 223 | 35.6137 | 1.0000 | 8 |
| 2024 | Kick Sauber | 1 | 0 |  |  | 8 |
| 2024 | Kick Sauber | 2 | 0 |  |  | 8 |
| 2024 | Kick Sauber | 3 | 0 |  |  | 8 |
| 2024 | Kick Sauber | 4 | 6 | 64.9241 | 1.8242 | 8 |
| 2024 | Kick Sauber | 5 | 31 | 54.2967 | 1.5256 | 8 |
| 2024 | Kick Sauber | 6 | 63 | 46.0346 | 1.2935 | 8 |
| 2024 | Kick Sauber | 7 | 46 | 40.3363 | 1.1334 | 8 |
| 2024 | Kick Sauber | 8 | 223 | 35.5895 | 1.0000 | 8 |
| 2024 | McLaren | 1 | 0 |  |  | 8 |
| 2024 | McLaren | 2 | 1 |  |  | 8 |
| 2024 | McLaren | 3 | 2 |  |  | 8 |
| 2024 | McLaren | 4 | 2 |  |  | 8 |
| 2024 | McLaren | 5 | 18 | 53.4972 | 1.5164 | 8 |
| 2024 | McLaren | 6 | 56 | 46.0726 | 1.3059 | 8 |
| 2024 | McLaren | 7 | 59 | 40.1636 | 1.1384 | 8 |
| 2024 | McLaren | 8 | 245 | 35.2794 | 1.0000 | 8 |
| 2024 | Mercedes | 1 | 0 |  |  | 8 |
| 2024 | Mercedes | 2 | 1 |  |  | 8 |
| 2024 | Mercedes | 3 | 2 |  |  | 8 |
| 2024 | Mercedes | 4 | 7 | 64.5946 | 1.8093 | 8 |
| 2024 | Mercedes | 5 | 20 | 55.2478 | 1.5475 | 8 |
| 2024 | Mercedes | 6 | 57 | 47.5142 | 1.3309 | 8 |
| 2024 | Mercedes | 7 | 61 | 41.2406 | 1.1552 | 8 |
| 2024 | Mercedes | 8 | 250 | 35.7006 | 1.0000 | 8 |
| 2024 | RB | 1 | 0 |  |  | 8 |
| 2024 | RB | 2 | 0 |  |  | 8 |
| 2024 | RB | 3 | 4 |  |  | 8 |
| 2024 | RB | 4 | 8 | 61.9257 | 1.7493 | 8 |
| 2024 | RB | 5 | 45 | 52.1893 | 1.4743 | 8 |
| 2024 | RB | 6 | 38 | 45.1572 | 1.2756 | 8 |
| 2024 | RB | 7 | 52 | 39.7465 | 1.1228 | 8 |
| 2024 | RB | 8 | 222 | 35.3997 | 1.0000 | 8 |
| 2024 | Red Bull Racing | 1 | 0 |  |  | 8 |
| 2024 | Red Bull Racing | 2 | 1 |  |  | 8 |
| 2024 | Red Bull Racing | 3 | 2 |  |  | 8 |
| 2024 | Red Bull Racing | 4 | 8 | 61.0183 | 1.7238 | 8 |
| 2024 | Red Bull Racing | 5 | 38 | 52.3078 | 1.4778 | 8 |
| 2024 | Red Bull Racing | 6 | 54 | 44.9721 | 1.2705 | 8 |
| 2024 | Red Bull Racing | 7 | 52 | 39.7212 | 1.1222 | 8 |
| 2024 | Red Bull Racing | 8 | 216 | 35.3966 | 1.0000 | 8 |
| 2024 | Williams | 1 | 0 |  |  | 8 |
| 2024 | Williams | 2 | 1 |  |  | 8 |
| 2024 | Williams | 3 | 2 |  |  | 8 |
| 2024 | Williams | 4 | 1 |  |  | 8 |
| 2024 | Williams | 5 | 8 | 55.3128 | 1.5472 | 8 |
| 2024 | Williams | 6 | 57 | 47.6212 | 1.3321 | 8 |
| 2024 | Williams | 7 | 54 | 41.2902 | 1.1550 | 8 |
| 2024 | Williams | 8 | 233 | 35.7500 | 1.0000 | 8 |
| 2025 | Alpine | 1 | 0 |  |  | 8 |
| 2025 | Alpine | 2 | 0 |  |  | 8 |
| 2025 | Alpine | 3 | 4 |  |  | 8 |
| 2025 | Alpine | 4 | 3 |  |  | 8 |
| 2025 | Alpine | 5 | 24 | 53.3146 | 1.4911 | 8 |
| 2025 | Alpine | 6 | 71 | 45.1203 | 1.2619 | 8 |
| 2025 | Alpine | 7 | 55 | 39.5158 | 1.1052 | 8 |
| 2025 | Alpine | 8 | 224 | 35.7549 | 1.0000 | 8 |
| 2025 | Aston Martin | 1 | 0 |  |  | 8 |
| 2025 | Aston Martin | 2 | 0 |  |  | 8 |
| 2025 | Aston Martin | 3 | 1 |  |  | 8 |
| 2025 | Aston Martin | 4 | 1 |  |  | 8 |
| 2025 | Aston Martin | 5 | 25 | 55.0817 | 1.5419 | 8 |
| 2025 | Aston Martin | 6 | 44 | 47.4769 | 1.3290 | 8 |
| 2025 | Aston Martin | 7 | 63 | 41.1756 | 1.1526 | 8 |
| 2025 | Aston Martin | 8 | 235 | 35.7242 | 1.0000 | 8 |
| 2025 | Ferrari | 1 | 0 |  |  | 8 |
| 2025 | Ferrari | 2 | 1 |  |  | 8 |
| 2025 | Ferrari | 3 | 0 |  |  | 8 |
| 2025 | Ferrari | 4 | 9 | 65.2099 | 1.8333 | 8 |
| 2025 | Ferrari | 5 | 15 | 54.4409 | 1.5305 | 8 |
| 2025 | Ferrari | 6 | 47 | 46.3376 | 1.3027 | 8 |
| 2025 | Ferrari | 7 | 58 | 40.3296 | 1.1338 | 8 |
| 2025 | Ferrari | 8 | 233 | 35.5706 | 1.0000 | 8 |
| 2025 | Haas F1 Team | 1 | 0 |  |  | 8 |
| 2025 | Haas F1 Team | 2 | 0 |  |  | 8 |
| 2025 | Haas F1 Team | 3 | 3 |  |  | 8 |
| 2025 | Haas F1 Team | 4 | 6 | 65.3951 | 1.8369 | 8 |
| 2025 | Haas F1 Team | 5 | 21 | 54.2254 | 1.5232 | 8 |
| 2025 | Haas F1 Team | 6 | 62 | 46.2257 | 1.2985 | 8 |
| 2025 | Haas F1 Team | 7 | 60 | 40.3018 | 1.1321 | 8 |
| 2025 | Haas F1 Team | 8 | 225 | 35.6000 | 1.0000 | 8 |
| 2025 | Kick Sauber | 1 | 0 |  |  | 8 |
| 2025 | Kick Sauber | 2 | 0 |  |  | 8 |
| 2025 | Kick Sauber | 3 | 1 |  |  | 8 |
| 2025 | Kick Sauber | 4 | 7 | 65.2795 | 1.8353 | 8 |
| 2025 | Kick Sauber | 5 | 32 | 54.4618 | 1.5312 | 8 |
| 2025 | Kick Sauber | 6 | 44 | 46.4040 | 1.3047 | 8 |
| 2025 | Kick Sauber | 7 | 49 | 40.3503 | 1.1345 | 8 |
| 2025 | Kick Sauber | 8 | 235 | 35.5679 | 1.0000 | 8 |
| 2025 | McLaren | 1 | 0 |  |  | 8 |
| 2025 | McLaren | 2 | 0 |  |  | 8 |
| 2025 | McLaren | 3 | 1 |  |  | 8 |
| 2025 | McLaren | 4 | 1 |  |  | 8 |
| 2025 | McLaren | 5 | 16 | 53.8216 | 1.5258 | 8 |
| 2025 | McLaren | 6 | 52 | 46.0831 | 1.3065 | 8 |
| 2025 | McLaren | 7 | 65 | 40.2000 | 1.1397 | 8 |
| 2025 | McLaren | 8 | 228 | 35.2734 | 1.0000 | 8 |
| 2025 | Mercedes | 1 | 0 |  |  | 8 |
| 2025 | Mercedes | 2 | 1 |  |  | 8 |
| 2025 | Mercedes | 3 | 2 |  |  | 8 |
| 2025 | Mercedes | 4 | 2 |  |  | 8 |
| 2025 | Mercedes | 5 | 14 | 55.1184 | 1.5440 | 8 |
| 2025 | Mercedes | 6 | 57 | 47.7202 | 1.3368 | 8 |
| 2025 | Mercedes | 7 | 53 | 41.2667 | 1.1560 | 8 |
| 2025 | Mercedes | 8 | 236 | 35.6974 | 1.0000 | 8 |
| 2025 | Racing Bulls | 1 | 0 |  |  | 8 |
| 2025 | Racing Bulls | 2 | 0 |  |  | 8 |
| 2025 | Racing Bulls | 3 | 4 |  |  | 8 |
| 2025 | Racing Bulls | 4 | 6 | 62.1478 | 1.7562 | 8 |
| 2025 | Racing Bulls | 5 | 41 | 52.5560 | 1.4852 | 8 |
| 2025 | Racing Bulls | 6 | 58 | 45.0198 | 1.2722 | 8 |
| 2025 | Racing Bulls | 7 | 51 | 39.7241 | 1.1225 | 8 |
| 2025 | Racing Bulls | 8 | 219 | 35.3876 | 1.0000 | 8 |
| 2025 | Red Bull Racing | 1 | 0 |  |  | 8 |
| 2025 | Red Bull Racing | 2 | 0 |  |  | 8 |
| 2025 | Red Bull Racing | 3 | 4 |  |  | 8 |
| 2025 | Red Bull Racing | 4 | 5 | 61.3299 | 1.7332 | 8 |
| 2025 | Red Bull Racing | 5 | 24 | 52.7546 | 1.4909 | 8 |
| 2025 | Red Bull Racing | 6 | 67 | 45.2500 | 1.2788 | 8 |
| 2025 | Red Bull Racing | 7 | 46 | 39.7929 | 1.1246 | 8 |
| 2025 | Red Bull Racing | 8 | 217 | 35.3846 | 1.0000 | 8 |
| 2025 | Williams | 1 | 0 |  |  | 8 |
| 2025 | Williams | 2 | 0 |  |  | 8 |
| 2025 | Williams | 3 | 2 |  |  | 8 |
| 2025 | Williams | 4 | 3 |  |  | 8 |
| 2025 | Williams | 5 | 10 | 55.3657 | 1.5480 | 8 |
| 2025 | Williams | 6 | 71 | 47.9342 | 1.3402 | 8 |
| 2025 | Williams | 7 | 54 | 41.4200 | 1.1581 | 8 |
| 2025 | Williams | 8 | 244 | 35.7660 | 1.0000 | 8 |
| 2026 | Alpine | 1 | 0 |  |  | 8 |
| 2026 | Alpine | 2 | 0 |  |  | 8 |
| 2026 | Alpine | 3 | 2 |  |  | 8 |
| 2026 | Alpine | 4 | 10 | 59.3856 | 1.7256 | 8 |
| 2026 | Alpine | 5 | 54 | 50.4636 | 1.4663 | 8 |
| 2026 | Alpine | 6 | 40 | 44.6576 | 1.2976 | 8 |
| 2026 | Alpine | 7 | 66 | 38.7310 | 1.1254 | 8 |
| 2026 | Alpine | 8 | 187 | 34.4146 | 1.0000 | 8 |
| 2026 | Aston Martin | 1 | 0 |  |  | 8 |
| 2026 | Aston Martin | 2 | 1 |  |  | 8 |
| 2026 | Aston Martin | 3 | 4 |  |  | 8 |
| 2026 | Aston Martin | 4 | 20 | 57.7101 | 1.6637 | 8 |
| 2026 | Aston Martin | 5 | 57 | 48.9196 | 1.4103 | 8 |
| 2026 | Aston Martin | 6 | 46 | 43.2131 | 1.2458 | 8 |
| 2026 | Aston Martin | 7 | 168 | 38.3790 | 1.1064 | 8 |
| 2026 | Aston Martin | 8 | 87 | 34.6879 | 1.0000 | 8 |
| 2026 | Audi | 1 | 0 |  |  | 8 |
| 2026 | Audi | 2 | 0 |  |  | 8 |
| 2026 | Audi | 3 | 2 |  |  | 8 |
| 2026 | Audi | 4 | 8 | 62.4880 | 1.7792 | 8 |
| 2026 | Audi | 5 | 50 | 52.4616 | 1.4937 | 8 |
| 2026 | Audi | 6 | 54 | 44.8912 | 1.2782 | 8 |
| 2026 | Audi | 7 | 79 | 39.5186 | 1.1252 | 8 |
| 2026 | Audi | 8 | 189 | 35.1216 | 1.0000 | 8 |
| 2026 | Cadillac | 1 | 0 |  |  | 8 |
| 2026 | Cadillac | 2 | 0 |  |  | 8 |
| 2026 | Cadillac | 3 | 2 |  |  | 8 |
| 2026 | Cadillac | 4 | 8 | 62.5689 | 1.7938 | 8 |
| 2026 | Cadillac | 5 | 50 | 52.3614 | 1.5011 | 8 |
| 2026 | Cadillac | 6 | 49 | 45.1480 | 1.2943 | 8 |
| 2026 | Cadillac | 7 | 93 | 39.3720 | 1.1287 | 8 |
| 2026 | Cadillac | 8 | 182 | 34.8813 | 1.0000 | 8 |
| 2026 | Ferrari | 1 | 0 |  |  | 8 |
| 2026 | Ferrari | 2 | 0 |  |  | 8 |
| 2026 | Ferrari | 3 | 5 | 77.1948 | 2.2114 | 8 |
| 2026 | Ferrari | 4 | 7 | 63.0895 | 1.8073 | 8 |
| 2026 | Ferrari | 5 | 64 | 52.1240 | 1.4932 | 8 |
| 2026 | Ferrari | 6 | 44 | 45.1369 | 1.2930 | 8 |
| 2026 | Ferrari | 7 | 110 | 39.3818 | 1.1282 | 8 |
| 2026 | Ferrari | 8 | 160 | 34.9083 | 1.0000 | 8 |
| 2026 | Haas F1 Team | 1 | 0 |  |  | 8 |
| 2026 | Haas F1 Team | 2 | 0 |  |  | 8 |
| 2026 | Haas F1 Team | 3 | 1 |  |  | 8 |
| 2026 | Haas F1 Team | 4 | 2 |  |  | 8 |
| 2026 | Haas F1 Team | 5 | 48 | 52.6610 | 1.5042 | 8 |
| 2026 | Haas F1 Team | 6 | 43 | 45.1880 | 1.2907 | 8 |
| 2026 | Haas F1 Team | 7 | 93 | 39.5126 | 1.1286 | 8 |
| 2026 | Haas F1 Team | 8 | 191 | 35.0095 | 1.0000 | 8 |
| 2026 | McLaren | 1 | 0 |  |  | 8 |
| 2026 | McLaren | 2 | 0 |  |  | 8 |
| 2026 | McLaren | 3 | 1 |  |  | 8 |
| 2026 | McLaren | 4 | 4 |  |  | 8 |
| 2026 | McLaren | 5 | 17 | 56.1276 | 1.5427 | 8 |
| 2026 | McLaren | 6 | 46 | 48.4554 | 1.3319 | 8 |
| 2026 | McLaren | 7 | 48 | 41.9905 | 1.1542 | 8 |
| 2026 | McLaren | 8 | 221 | 36.3817 | 1.0000 | 8 |
| 2026 | Mercedes | 1 | 0 |  |  | 8 |
| 2026 | Mercedes | 2 | 1 |  |  | 8 |
| 2026 | Mercedes | 3 | 0 |  |  | 8 |
| 2026 | Mercedes | 4 | 7 | 60.7253 | 1.7662 | 8 |
| 2026 | Mercedes | 5 | 53 | 50.5234 | 1.4695 | 8 |
| 2026 | Mercedes | 6 | 37 | 44.6944 | 1.3000 | 8 |
| 2026 | Mercedes | 7 | 92 | 38.6780 | 1.1250 | 8 |
| 2026 | Mercedes | 8 | 184 | 34.3816 | 1.0000 | 8 |
| 2026 | Racing Bulls | 1 | 0 |  |  | 8 |
| 2026 | Racing Bulls | 2 | 0 |  |  | 8 |
| 2026 | Racing Bulls | 3 | 5 | 76.4379 | 2.1385 | 8 |
| 2026 | Racing Bulls | 4 | 3 |  |  | 8 |
| 2026 | Racing Bulls | 5 | 37 | 53.4907 | 1.4965 | 8 |
| 2026 | Racing Bulls | 6 | 42 | 45.7700 | 1.2805 | 8 |
| 2026 | Racing Bulls | 7 | 61 | 40.0939 | 1.1217 | 8 |
| 2026 | Racing Bulls | 8 | 228 | 35.7443 | 1.0000 | 8 |
| 2026 | Red Bull Racing | 1 | 0 |  |  | 8 |
| 2026 | Red Bull Racing | 2 | 0 |  |  | 8 |
| 2026 | Red Bull Racing | 3 | 3 |  |  | 8 |
| 2026 | Red Bull Racing | 4 | 5 | 63.9672 | 1.7902 | 8 |
| 2026 | Red Bull Racing | 5 | 48 | 53.6305 | 1.5009 | 8 |
| 2026 | Red Bull Racing | 6 | 56 | 45.7731 | 1.2810 | 8 |
| 2026 | Red Bull Racing | 7 | 101 | 39.9860 | 1.1190 | 8 |
| 2026 | Red Bull Racing | 8 | 178 | 35.7323 | 1.0000 | 8 |
| 2026 | Williams | 1 | 0 |  |  | 8 |
| 2026 | Williams | 2 | 0 |  |  | 8 |
| 2026 | Williams | 3 | 1 |  |  | 8 |
| 2026 | Williams | 4 | 8 | 59.7540 | 1.7349 | 8 |
| 2026 | Williams | 5 | 62 | 50.5516 | 1.4677 | 8 |
| 2026 | Williams | 6 | 36 | 44.6907 | 1.2975 | 8 |
| 2026 | Williams | 7 | 112 | 38.6925 | 1.1234 | 8 |
| 2026 | Williams | 8 | 153 | 34.4431 | 1.0000 | 8 |

Derived values, source URLs, source hashes and every hidden-team fold are in `scripts/sim/data/f1-gear-measurements.json`. Selected normalized session snapshots are preserved on the experiment branch with their input hashes. The raw HTTP response cache is not committed.
