# Lap simulator calibration

Generated 2026-11-07. Real qualifying laps from OpenF1 on tracks built from OpenF1 car positions.

## 2025

66 laps, fit score 20.459, 611 s.

Car: grip μy 1.977, downforce ClA 7.21 m², drag CdA 1.322 m², low-drag CdA 0.830 m², ICE 476 kW.

| Track | Real | Sim | Error | Corner/straight speed error | Track grip |
|---|---|---|---|---|---|
| melbourne | 75.096 | 74.877 | -0.219 | 22.6 km/h | 1.098 |
| shanghai | 90.641 | 91.807 | +1.166 | 34.4 km/h | 0.9828 |
| suzuka | 86.983 | 86.600 | -0.383 | 14 km/h | 0.9828 |
| sakhir | 89.841 | 88.690 | -1.151 | 18.8 km/h | 0.8747 |
| jeddah | 87.294 | 89.044 | +1.750 | 33.8 km/h | 1.1499 (at limit: check this track) |
| miami | 86.204 | 85.974 | -0.230 | 16.2 km/h | 0.8892 |
| imola | 74.670 | 74.075 | -0.595 | 25.3 km/h | 1.1283 |
| monte-carlo | 69.954 | 69.770 | -0.184 | 18.7 km/h | 0.9022 |
| catalunya | 71.546 | 70.448 | -1.098 | 16.1 km/h | 0.9708 |
| montreal | 70.899 | 70.229 | -0.670 | 14.3 km/h | 0.9207 |
| spielberg | 63.971 | 62.787 | -1.184 | 18.2 km/h | 1.0052 |
| silverstone | 84.892 | 84.808 | -0.084 | 12.2 km/h | 0.8601 |
| spa-francorchamps | 100.562 | 100.696 | +0.134 | 15.4 km/h | 0.9725 |
| hungaroring | 75.372 | 75.322 | -0.050 | 14.5 km/h | 0.8688 |
| zandvoort | 68.662 | 67.563 | -1.099 | 19.5 km/h | 1.0497 |
| monza | 78.792 | 78.590 | -0.202 | 11 km/h | 0.8972 |
| singapore | 89.158 | 88.861 | -0.297 | 16.7 km/h | 0.889 |
| austin | 92.510 | 91.940 | -0.570 | 16.7 km/h | 0.9301 |
| mexico-city | 75.586 | 74.853 | -0.733 | 14.3 km/h | 0.8501 (at limit: check this track) |
| interlagos | 69.511 | 69.540 | +0.029 | 12.8 km/h | 0.8891 |
| lusail | 79.387 | 78.943 | -0.444 | 19.3 km/h | 1.0268 |
| yas-marina-circuit | 82.207 | 82.251 | +0.044 | 19.4 km/h | 0.981 |

## 2026

50 laps, fit score 22.565, 527 s.

Car: grip μy 1.802, downforce ClA 6.19 m², drag CdA 1.148 m², low-drag CdA 0.509 m², ICE 340 kW.

| Track | Real | Sim | Error | Corner/straight speed error | Track grip |
|---|---|---|---|---|---|
| melbourne | 78.518 | 78.576 | +0.058 | 24.6 km/h | 1.1463 |
| shanghai | 92.064 | 92.642 | +0.578 | 31.5 km/h | 1.0614 |
| suzuka | 89.076 | 88.545 | -0.531 | 19.1 km/h | 1.0762 |
| miami | 87.798 | 88.006 | +0.208 | 22.3 km/h | 0.9584 |
| monte-carlo | 72.051 | 71.887 | -0.164 | 17.2 km/h | 0.9337 |
| catalunya | 74.679 | 73.864 | -0.815 | 20.6 km/h | 0.9997 |
| spielberg | 66.113 | 64.997 | -1.116 | 20.8 km/h | 1.0355 |
| silverstone | 88.111 | 87.227 | -0.884 | 18.4 km/h | 0.9208 |
| spa-francorchamps | 104.361 | 104.019 | -0.342 | 29.2 km/h | 1.0668 |
| hungaroring | 77.207 | 77.206 | -0.001 | 16.7 km/h | 0.9317 |
| monza | 81.786 | 80.367 | -1.419 | 20.5 km/h | 0.9832 |
| madring | 91.824 | 91.159 | -0.665 | 17.7 km/h | 1.0888 |
| baku | 102.526 | 102.269 | -0.257 | 24.1 km/h | 1.0416 |
| kuala-lumpur | 95.130 | 95.027 | -0.103 | 14.1 km/h | 0.9263 |
| singapore | 91.373 | 91.144 | -0.229 | 16.3 km/h | 0.9355 |
| austin | 94.035 | 93.743 | -0.292 | 19.2 km/h | 0.9868 |
| mexico-city | 76.514 | 76.831 | +0.317 | 13.9 km/h | 0.8781 |

### 2025 holdout

Predicted 14 unseen pole laps: typical error 3.11% (RMS).

### 2026 holdout

Predicted 13 unseen pole laps: typical error 2.86% (RMS).

## Projections

- 2027: rules -0.61% lap time, development -0.98% (historical range -0.84 to -1.25%).
- 2028: rules -1.01% lap time, development -1.13% (historical range -0.2 to -2.13%).

## WEC Hypercar 2025

18 laps on 6 tracks, fit score 19.322. Holdout (one track left out at a time): 4.42% RMS over 6 laps.

Car: grip μy 1.547, downforce ClA 7.00 m², drag CdA 1.054 m² (mass 1120 kg and 500 kW fixed).

| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |
|---|---|---|---|---|---|---|
| lusail | 98.359 | 102.778 | +4.419 | 291.9 | 291 | 1.0268 |
| imola | 88.920 | 89.099 | +0.179 | 311.2 | 301.7 | 1.1283 |
| spa-francorchamps | 119.617 | 118.677 | -0.940 | 312.3 | 305.5 | 1.0668 |
| interlagos | 82.570 | 85.634 | +3.064 | 276.2 | 301 | 0.8891 |
| austin | 117.655 | 111.286 | -6.369 | – | 302.4 | 0.9868 |
| sakhir | 106.826 | 108.841 | +2.015 | 293.7 | 295.7 | 0.8747 |

## WEC Hypercar 2026

15 laps on 5 tracks, fit score 1.960. Holdout (one track left out at a time): 1.41% RMS over 5 laps.

Car: grip μy 1.759, downforce ClA 3.83 m², drag CdA 1.055 m² (mass 1120 kg and 500 kW fixed).

| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |
|---|---|---|---|---|---|---|
| imola | 90.088 | 89.032 | -1.056 | 310.4 | 309.4 | 1.1283 |
| spa-francorchamps | 120.653 | 119.605 | -1.048 | 312.3 | 306.4 | 1.0668 |
| interlagos | 83.041 | 84.652 | +1.611 | – | 310.8 | 0.8891 |
| austin | 112.020 | 112.723 | +0.703 | 300 | 303.1 | 0.9868 |
| catalunya | 90.166 | 89.464 | -0.702 | 306.8 | 303.6 | 0.9997 |

## WEC LMGT3 2025

18 laps on 6 tracks, fit score 6.060. Holdout (one track left out at a time): 2.27% RMS over 6 laps.

Car: grip μy 1.607, downforce ClA 3.50 m², drag CdA 1.300 m² (mass 1400 kg and 380 kW fixed).

| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |
|---|---|---|---|---|---|---|
| lusail | 113.861 | 117.412 | +3.551 | 252.9 | 249.7 | 1.0268 |
| imola | 102.326 | 101.471 | -0.855 | 267.3 | 261.7 | 1.1283 |
| spa-francorchamps | 137.732 | 137.144 | -0.588 | 263.6 | 253.3 | 1.0668 |
| interlagos | 93.849 | 95.552 | +1.703 | 253.7 | 254.7 | 0.8891 |
| austin | 127.645 | 125.181 | -2.464 | 251.7 | 260.4 | 0.9868 |
| sakhir | 121.661 | 121.068 | -0.593 | 254.4 | 254.7 | 0.8747 |

## WEC LMGT3 2026

15 laps on 5 tracks, fit score 1.576. Holdout (one track left out at a time): 0.55% RMS over 5 laps.

Car: grip μy 1.639, downforce ClA 3.50 m², drag CdA 1.300 m² (mass 1400 kg and 380 kW fixed).

| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |
|---|---|---|---|---|---|---|
| imola | 101.181 | 100.999 | -0.182 | 260 | 263.6 | 1.1283 |
| spa-francorchamps | 136.612 | 136.287 | -0.325 | 262.4 | 254.1 | 1.0668 |
| interlagos | 93.350 | 94.375 | +1.025 | 250.8 | 263.8 | 0.8891 |
| austin | 125.103 | 125.427 | +0.324 | 252.9 | 259 | 0.9868 |
| catalunya | 100.933 | 100.549 | -0.384 | 255.9 | 257.6 | 0.9997 |

