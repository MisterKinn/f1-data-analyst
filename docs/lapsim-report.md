# Lap simulator calibration

Generated 2026-11-07. Real qualifying laps from OpenF1 on tracks built from OpenF1 car positions.

F1 joint fit of 2025 and 2026: 1158 s, score 22.408.

## 2025

66 laps. Holdout: predicted 14 unseen pole laps, typical error 1.11% (RMS).

Car: grip μy 2.172, downforce ClA 5.57 m², drag CdA 1.308 m², low-drag CdA 0.925 m², ICE 481 kW.

| Track | Real | Sim | Error | Corner/straight speed error | Track grip (shared) |
|---|---|---|---|---|---|
| melbourne | 75.096 | 74.706 | -0.390 | 22.4 km/h | 1.117 |
| shanghai | 90.641 | 91.605 | +0.964 | 32.6 km/h | 0.9834 |
| suzuka | 86.983 | 86.307 | -0.676 | 14.9 km/h | 1.0096 |
| sakhir | 89.841 | 88.914 | -0.927 | 19.6 km/h | 0.856 |
| jeddah | 87.294 | 89.134 | +1.840 | 33.1 km/h | 1.1499 (at limit: check this track) |
| miami | 86.204 | 85.832 | -0.372 | 17.3 km/h | 0.8877 |
| imola | 74.670 | 73.595 | -1.075 | 24.8 km/h | 1.1487 |
| monte-carlo | 69.954 | 70.273 | +0.319 | 19.2 km/h | 0.8637 |
| catalunya | 71.546 | 70.969 | -0.577 | 18.3 km/h | 0.9646 |
| montreal | 70.899 | 70.391 | -0.508 | 14.6 km/h | 0.908 |
| spielberg | 63.971 | 62.848 | -1.123 | 19 km/h | 1.0149 |
| silverstone | 84.892 | 84.452 | -0.440 | 13.2 km/h | 0.8783 |
| spa-francorchamps | 100.562 | 100.103 | -0.459 | 16 km/h | 0.9939 |
| hungaroring | 75.372 | 74.797 | -0.575 | 13.5 km/h | 0.8829 |
| zandvoort | 68.662 | 67.604 | -1.058 | 21.1 km/h | 1.0473 |
| monza | 78.792 | 78.160 | -0.632 | 12.7 km/h | 0.937 |
| singapore | 89.158 | 89.248 | +0.090 | 17.2 km/h | 0.8644 |
| austin | 92.510 | 91.663 | -0.847 | 16.9 km/h | 0.9313 |
| mexico-city | 75.586 | 74.228 | -1.358 | 14.9 km/h | 0.8501 (at limit: check this track) |
| interlagos | 69.511 | 69.346 | -0.165 | 13.5 km/h | 0.8849 |
| lusail | 79.387 | 78.905 | -0.482 | 19.3 km/h | 1.0555 |
| yas-marina-circuit | 82.207 | 82.088 | -0.119 | 19.4 km/h | 0.9892 |

## 2026

50 laps. Holdout: predicted 13 unseen pole laps, typical error 1.29% (RMS).

Car: grip μy 2.134, downforce ClA 4.48 m², drag CdA 1.374 m², low-drag CdA 0.719 m², ICE 378 kW.

| Track | Real | Sim | Error | Corner/straight speed error | Track grip (shared) |
|---|---|---|---|---|---|
| melbourne | 78.518 | 78.488 | -0.030 | 24.8 km/h | 1.117 |
| shanghai | 92.064 | 93.064 | +1.000 | 29.3 km/h | 0.9834 |
| suzuka | 89.076 | 89.752 | +0.676 | 21.2 km/h | 1.0096 |
| miami | 87.798 | 88.523 | +0.725 | 23.1 km/h | 0.8877 |
| monte-carlo | 72.051 | 71.265 | -0.786 | 17.1 km/h | 0.8637 |
| catalunya | 74.679 | 73.655 | -1.024 | 21.1 km/h | 0.9646 |
| spielberg | 66.113 | 64.320 | -1.793 | 20.9 km/h | 1.0149 |
| silverstone | 88.111 | 87.826 | -0.285 | 20.1 km/h | 0.8783 |
| spa-francorchamps | 104.361 | 105.123 | +0.762 | 31.3 km/h | 0.9939 |
| hungaroring | 77.207 | 77.079 | -0.128 | 17.2 km/h | 0.8829 |
| monza | 81.786 | 80.928 | -0.858 | 21.5 km/h | 0.937 |
| singapore | 91.373 | 90.837 | -0.536 | 16.1 km/h | 0.8644 |
| austin | 94.035 | 93.547 | -0.488 | 20 km/h | 0.9313 |
| mexico-city | 76.514 | 75.149 | -1.365 | 15.3 km/h | 0.8501 (at limit: check this track) |
| madring | 91.824 | 91.216 | -0.608 | 18.4 km/h | 1.0188 |
| baku | 102.526 | 102.930 | +0.404 | 23.7 km/h | 0.9361 |
| kuala-lumpur | 95.130 | 95.130 | 0.000 | 14.6 km/h | 0.8672 |

## Projections

- 2027: rules -0.61% lap time, development -0.98% (historical range -0.84 to -1.25%).
- 2028: rules -1.03% lap time, development -1.13% (historical range -0.2 to -2.13%).

## WEC Hypercar 2025

18 laps on 6 tracks, fit score 10.994. Holdout (one track left out at a time): 2.99% RMS over 6 laps.

Car: grip μy 1.583, downforce ClA 7.00 m², drag CdA 1.045 m² (mass 1120 kg and 500 kW fixed).

| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |
|---|---|---|---|---|---|---|
| lusail | 98.359 | 100.347 | +1.988 | 291.9 | 292 | 1.0555 |
| imola | 88.920 | 87.789 | -1.131 | 311.2 | 302.6 | 1.1487 |
| spa-francorchamps | 119.617 | 120.854 | +1.237 | 312.3 | 305.8 | 0.9939 |
| interlagos | 82.570 | 84.902 | +2.332 | 276.2 | 301.8 | 0.8849 |
| austin | 117.655 | 113.077 | -4.578 | – | 302.6 | 0.9313 |
| sakhir | 106.826 | 108.718 | +1.892 | 293.7 | 296.2 | 0.856 |

## WEC Hypercar 2026

15 laps on 5 tracks, fit score 3.379. Holdout (one track left out at a time): 2.00% RMS over 5 laps.

Car: grip μy 1.789, downforce ClA 4.29 m², drag CdA 1.045 m² (mass 1120 kg and 500 kW fixed).

| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |
|---|---|---|---|---|---|---|
| imola | 90.088 | 87.416 | -2.672 | 310.4 | 310.1 | 1.1487 |
| spa-francorchamps | 120.653 | 120.776 | +0.123 | 312.3 | 306.7 | 0.9939 |
| interlagos | 83.041 | 83.473 | +0.432 | – | 311.2 | 0.8849 |
| austin | 112.020 | 113.732 | +1.712 | 300 | 303.2 | 0.9313 |
| catalunya | 90.166 | 89.203 | -0.963 | 306.8 | 304.1 | 0.9646 |

## WEC LMGT3 2025

18 laps on 6 tracks, fit score 3.940. Holdout (one track left out at a time): 1.68% RMS over 6 laps.

Car: grip μy 1.633, downforce ClA 3.50 m², drag CdA 1.300 m² (mass 1400 kg and 380 kW fixed).

| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |
|---|---|---|---|---|---|---|
| lusail | 113.861 | 115.565 | +1.704 | 252.9 | 250 | 1.0555 |
| imola | 102.326 | 100.545 | -1.781 | 267.3 | 261.7 | 1.1487 |
| spa-francorchamps | 137.732 | 139.677 | +1.945 | 263.6 | 249 | 0.9939 |
| interlagos | 93.849 | 95.139 | +1.290 | 253.7 | 255 | 0.8849 |
| austin | 127.645 | 127.184 | -0.461 | 251.7 | 260.1 | 0.9313 |
| sakhir | 121.661 | 121.299 | -0.362 | 254.4 | 254.6 | 0.856 |

## WEC LMGT3 2026

15 laps on 5 tracks, fit score 3.066. Holdout (one track left out at a time): 1.36% RMS over 5 laps.

Car: grip μy 1.709, downforce ClA 3.50 m², drag CdA 1.300 m² (mass 1400 kg and 380 kW fixed).

| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |
|---|---|---|---|---|---|---|
| imola | 101.181 | 99.375 | -1.806 | 260 | 264 | 1.1487 |
| spa-francorchamps | 136.612 | 137.537 | +0.925 | 262.4 | 252 | 0.9939 |
| interlagos | 93.350 | 93.094 | -0.256 | 250.8 | 264 | 0.8849 |
| austin | 125.103 | 126.129 | +1.026 | 252.9 | 259 | 0.9313 |
| catalunya | 100.933 | 100.261 | -0.672 | 255.9 | 257.7 | 0.9646 |

