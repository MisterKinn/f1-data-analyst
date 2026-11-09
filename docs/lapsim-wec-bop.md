# WEC Hypercar BoP 2024-2026 (+ IMSA GTP sample)

Built 2026-11-08. Columns: min dry weight (kg), max power below 250 kph (kW), power gain above 250 kph (%), max stint energy (MJ), front-axle deployment speed dry/wet (kph), additional docking time (s). '-' = not applicable, '?' = not found.

## 2026

**Not published.** FIA/ACO stopped publishing Hypercar BoP in 2026 (announced at Imola, April 2026); no per-car figures found for any 2026 round.
Source: https://au.motorsport.com/wec/news/wec-will-stop-publishing-bop-data-2026/10813086/

All 2026 events (Imola, Spa, Le Mans, Sao Paulo, COTA, Fuji, Barcelona, Monza) are null.

## 2024

Eight FIA WEC Hypercar BoP decisions (power threshold 210 kph in 2024). Values: kg | kW | power gain above 210 kph | stint energy MJ | additional docking s. Front-axle deployment 190 kph dry/wet for Ferrari, Toyota, Isotta (Peugeot 150 at Qatar, 190 later).

| Event | Decision | Source |
|---|---|---|
| Qatar | WEC_2024_D21 (16/02/2024) | https://www.fia.com/sites/default/files/wec_2024_d21_hypercar_bop_16022024.pdf |
| Imola | WEC_2024_D33 (12/04/2024) | https://www.fia.com/sites/default/files/wec_2024_d33_hypercar_bop_12042024.pdf |
| Spa | WEC_2024_D37 (07/05/2024) | https://www.fia.com/sites/default/files/wec_2024_d37_hypercar_bop_07052024.pdf |
| Le Mans | WEC_2024_D39 (31/05/2024) | https://sportscar365.com/wp-content/uploads/2024/06/wec_2024_d39_hypercar_bop_31052024.pdf |
| Sao Paulo | WEC_2024_D45 (05/07/2024) | https://www.fia.com/sites/default/files/wec_2024_d45_hypercar_bop_05072024.pdf |
| COTA | WEC_2024_D48 (23/08/2024) | https://www.fia.com/sites/default/files/wec_2024_d48_hypercar_bop_23082024.pdf |
| Fuji | WEC_2024_D53 (10/09/2024) | https://fia.com/sites/default/files/wec_2024_d53_hypercar_bop_10092024.pdf |
| Bahrain | WEC_2024_D56 (25/10/2024) | https://www.fia.com/sites/default/files/wec_2024_d56_hypercar_bop_25102024.pdf |

Per-car values are in `scripts/sim/data/wec-bop.json` (key "2024"). The PDF text has no clean column labels; values were mapped by their position, which is the same in all eight files (kg, kW, gain, front-axle dry, wet, MJ, docking). Isotta Fraschini entered Qatar to Sao Paulo only.

## 2025

### Qatar

Decision: WEC_2025_D09_Hypercar_BOP_Amended (20/02/2025)  
Source: https://www.fia.com/sites/default/files/wec_2025_d09_hypercar_bop_amended_20022025.pdf  
Also: https://sportscar365.com/wp-content/uploads/2025/02/WEC_2025_D09_Hypercar_BOP_19022025-1.pdf (original 19/02, superseded)  
Note: Amended values; they match the Imola adj/current columns exactly. Original 19/02 differed (see md).

| Car | kg | kW | gain >250 | MJ | Ft depl dry/wet | Dock s | Note |
|---|---|---|---|---|---|---|---|
| Alpine A424 | 1044 | 508 | -2.6% | 904 | - | 1.0 |  |
| Aston Martin Valkyrie | 1042 | 504 | +0.4% | 899 | - | 0.0 |  |
| BMW M Hybrid V8 | 1037 | 505 | +0.8% | 902 | - | 1.0 |  |
| Cadillac V-Series.R | 1030 | 503 | +3.4% | 899 | - | 1.0 |  |
| Ferrari 499P | 1037 | 501 | +0.0% | 897 | 190/190 | 1.2 |  |
| Peugeot 9X8 | 1031 | 520 | -5.2% | 909 | 190/190 | 1.2 |  |
| Porsche 963 | 1064 | 508 | +1.0% | 909 | - | 1.0 |  |
| Toyota GR010 Hybrid | 1064 | 503 | +3.4% | 909 | 190/190 | 1.2 |  |

### Imola

Decision: WEC_2025_D18_Hypercar_BOP_Amended (16/04/2025)  
Source: https://fia.com/sites/default/files/wec_2025_d18_hypercar_bop_amended_16042025.pdf  
Also: https://fia.com/sites/default/files/wec_2025_d18_hypercar_bop_11042025.pdf  

| Car | kg | kW | gain >250 | MJ | Ft depl dry/wet | Dock s | Note |
|---|---|---|---|---|---|---|---|
| Alpine A424 | 1042 | 519 | -5.4% | 907 | - | 1.0 |  |
| Aston Martin Valkyrie | 1051 | 505 | +0.0% | 900 | - | 0.0 |  |
| BMW M Hybrid V8 | 1042 | 513 | -1.6% | 907 | - | 1.0 |  |
| Cadillac V-Series.R | 1041 | 510 | +2.0% | 907 | - | 1.0 |  |
| Ferrari 499P | 1045 | 508 | -1.8% | 900 | 190/190 | 1.2 |  |
| Peugeot 9X8 | 1030 | 520 | -5.4% | 903 | 190/190 | 1.2 |  |
| Porsche 963 | 1053 | 503 | +1.2% | 904 | - | 1.0 |  |
| Toyota GR010 Hybrid | 1065 | 500 | +3.6% | 907 | 190/190 | 1.2 |  |

### Spa

Decision: WEC_2025_D24_Hypercar_BOP (05/05/2025)  
Source: https://www.fia.com/sites/default/files/wec_2025_d24_hypercar_bop_05052025.pdf  

| Car | kg | kW | gain >250 | MJ | Ft depl dry/wet | Dock s | Note |
|---|---|---|---|---|---|---|---|
| Alpine A424 | 1043 | 520 | -4.4% | 902 | - | 1.0 |  |
| Aston Martin Valkyrie | 1035 | 520 | -2.7% | 908 | - | 0.0 |  |
| BMW M Hybrid V8 | 1049 | 503 | +1.2% | 907 | - | 1.0 |  |
| Cadillac V-Series.R | 1042 | 501 | +3.8% | 906 | - | 1.0 |  |
| Ferrari 499P | 1057 | 489 | +3.7% | 897 | 190/190 | 1.2 |  |
| Peugeot 9X8 | 1030 | 520 | -3.7% | 902 | 190/190 | 1.2 |  |
| Porsche 963 | 1055 | 494 | +3.4% | 905 | - | 1.0 |  |
| Toyota GR010 Hybrid | 1069 | 480 | +8.3% | 905 | 190/190 | 1.2 |  |

### Le Mans

Decision: WEC_2025_D29_Hypercar_BOP (03/06/2025) - values from press, PDF unreadable  
Source: https://es.motorsport.com/wec/news/bop-le-mans-equilibrio-rendimiento/10729991/  
Also: https://sportscar365.com/?p=134405  
Also: https://www.autosport.com/wec/news/ferrari-given-bop-gains-ahead-of-le-mans-24-hours/10729998/  
Also: https://www.onlyendurance.com/le-mans-bop-analysis-pulling-apart-the-power-and-weight-figures  
Also: https://fiawec.alkamelsystems.com/Results_NoticeBoard/13_2025/committee/02_Decisions/WEC_2025_D29_Hypercar_BOP_03062025.pdf (official PDF; did not load)  
Note: Front-axle deployment speed and docking time not stated in any source found.

| Car | kg | kW | gain >250 | MJ | Ft depl dry/wet | Dock s | Note |
|---|---|---|---|---|---|---|---|
| Alpine A424 | 1039 | 517 | -1.7% | 897 | ? | ? |  |
| Aston Martin Valkyrie | 1030 | 520 | -0.8% | 910 | ? | ? | MJ conflict: 910 (motorsport.com ES) vs 908 (OnlyEndurance) |
| BMW M Hybrid V8 | 1039 | 510 | +2.2% | 919 | ? | ? | gain conflict: +2.2% (motorsport.com ES) vs +2.0% (Sportscar365) |
| Cadillac V-Series.R | 1037 | 517 | -0.8% | 905 | ? | ? | kW conflict: 517 (Sportscar365, motorsport.com) vs 520 (OnlyEndurance); kg/kW 2.006 supports 517 |
| Ferrari 499P | 1042 | 515 | -2.9% | 896 | ? | ? | OnlyEndurance text says -3.3% but its 500.065 kW = 515 x 0.971 (-2.9%) |
| Peugeot 9X8 | 1039 | 507 | -1.2% | 889 | ? | ? |  |
| Porsche 963 | 1041 | 511 | +1.4% | 917 | ? | ? |  |
| Toyota GR010 Hybrid | 1053 | 520 | -1.3% | 914 | ? | ? |  |

### Sao Paulo

Decision: WEC_2025_D36_Hypercar_BOP (07/07/2025)  
Source: https://www.fia.com/sites/default/files/wec_2025_d36_hypercar_bop_07072025.pdf  
Note: adj column is relative to Spa (Le Mans has its own BoP).

| Car | kg | kW | gain >250 | MJ | Ft depl dry/wet | Dock s | Note |
|---|---|---|---|---|---|---|---|
| Alpine A424 | 1051 | 512 | -5.5% | 892 | - | 1.0 |  |
| Aston Martin Valkyrie | 1030 | 520 | +0.0% | 919 | - | 0.0 |  |
| BMW M Hybrid V8 | 1058 | 505 | -0.4% | 904 | - | 1.0 |  |
| Cadillac V-Series.R | 1040 | 516 | -1.7% | 904 | - | 1.0 |  |
| Ferrari 499P | 1069 | 480 | +5.6% | 893 | 190/190 | 1.2 |  |
| Peugeot 9X8 | 1030 | 520 | -6.0% | 897 | 190/190 | 1.2 |  |
| Porsche 963 | 1053 | 501 | +0.4% | 905 | - | 1.0 |  |
| Toyota GR010 Hybrid | 1069 | 485 | +7.2% | 903 | 190/190 | 1.2 |  |

### COTA (derived)

Decision: WEC_2025_D40_Hypercar_BOP (02/09/2025)  
Source: https://fiawec.alkamelsystems.com/Results_NoticeBoard/13_2025/committee/02_Decisions/WEC_2025_D41_Hypercar_BOP_19092025.pdf (Fuji 'current' minus 'adj')  
Also: https://fiawec.alkamelsystems.com/Results_NoticeBoard/13_2025/committee/02_Decisions/WEC_2025_D40_Hypercar_BOP_02092025.pdf (official COTA PDF; did not load)  
Also: https://trendingsportsupdates.blogspot.com/2025/09/cadillac-porsche-get-biggest-bop-hits.html (Sportscar365 copy, deltas vs Sao Paulo)  
Also: https://www.onlyendurance.com/cota-bop-crunching-power-weight-numbers-toyota  
Note: Derived (Fuji current - adj). Every value cross-checks with Sao Paulo + Sportscar365 deltas (kg, kW, gain) and OnlyEndurance MJ deltas; stated directly: Porsche 1065 kg, Cadillac 1059, Ferrari 1069/480, Toyota 1069, Peugeot/Aston 1030/520.

| Car | kg | kW | gain >250 | MJ | Ft depl dry/wet | Dock s | Note |
|---|---|---|---|---|---|---|---|
| Alpine A424 | 1052 | 506 | -4.5% | 890 | - | 1.0 |  |
| Aston Martin Valkyrie | 1030 | 520 | +0.0% | 918 | - | 0.0 |  |
| BMW M Hybrid V8 | 1056 | 497 | +1.0% | 899 | - | 1.0 |  |
| Cadillac V-Series.R | 1059 | 511 | -0.8% | 902 | - | 1.0 |  |
| Ferrari 499P | 1069 | 480 | +4.8% | 890 | 190/190 | 1.2 |  |
| Peugeot 9X8 | 1030 | 520 | -7.3% | 895 | 190/190 | 1.2 |  |
| Porsche 963 | 1065 | 488 | +2.9% | 901 | - | 1.0 |  |
| Toyota GR010 Hybrid | 1069 | 484 | +7.4% | 901 | 190/190 | 1.2 |  |

### Fuji

Decision: WEC_2025_D41_Hypercar_BOP (19/09/2025)  
Source: https://fiawec.alkamelsystems.com/Results_NoticeBoard/13_2025/committee/02_Decisions/WEC_2025_D41_Hypercar_BOP_19092025.pdf  

| Car | kg | kW | gain >250 | MJ | Ft depl dry/wet | Dock s | Note |
|---|---|---|---|---|---|---|---|
| Alpine A424 | 1052 | 512 | -3.9% | 893 | - | 1.0 |  |
| Aston Martin Valkyrie | 1030 | 520 | +0.0% | 919 | - | 0.0 |  |
| BMW M Hybrid V8 | 1056 | 499 | +1.4% | 902 | - | 1.0 |  |
| Cadillac V-Series.R | 1059 | 510 | +0.2% | 903 | - | 1.0 |  |
| Ferrari 499P | 1069 | 480 | +5.0% | 893 | 190/190 | 1.2 |  |
| Peugeot 9X8 | 1030 | 520 | -4.8% | 895 | 190/190 | 1.2 |  |
| Porsche 963 | 1065 | 490 | +2.9% | 904 | - | 1.0 |  |
| Toyota GR010 Hybrid | 1069 | 483 | +7.7% | 905 | 190/190 | 1.2 |  |

### Bahrain

Decision: WEC_2025_D46_Hypercar_BOP (31/10/2025)  
Source: https://fiawec.alkamelsystems.com/Results_NoticeBoard/13_2025/committee/02_Decisions/WEC_2025_D46_Hypercar_BOP_31102025.pdf  

| Car | kg | kW | gain >250 | MJ | Ft depl dry/wet | Dock s | Note |
|---|---|---|---|---|---|---|---|
| Alpine A424 | 1054 | 503 | -2.8% | 887 | - | 1.0 |  |
| Aston Martin Valkyrie | 1030 | 520 | -1.7% | 915 | - | 0.0 |  |
| BMW M Hybrid V8 | 1054 | 498 | +1.2% | 898 | - | 1.0 |  |
| Cadillac V-Series.R | 1063 | 486 | +6.2% | 893 | - | 1.0 |  |
| Ferrari 499P | 1064 | 483 | +4.8% | 893 | 190/190 | 1.2 |  |
| Peugeot 9X8 | 1034 | 519 | -5.6% | 891 | 190/190 | 1.2 |  |
| Porsche 963 | 1069 | 481 | +5.2% | 901 | - | 1.0 |  |
| Toyota GR010 Hybrid | 1062 | 489 | +6.3% | 909 | 190/190 | 1.2 |  |

Qatar original D09 (19/02) vs amended (20/02): Alpine 1043/-3.0%/903 -> 1044/-2.6%/904; BMW 0.6 -> 0.8%; Cadillac 3.2%/898 -> 3.4%/899; Peugeot -5.8%/908 -> -5.2%/909; Porsche 0.8 -> 1.0%; Toyota 1065 -> 1064 kg.

Lamborghini SC63: not in any 2025 WEC BoP table.

## IMSA GTP

IMSA GTP DOES use Maximum Stint Energy (MJ) plus an Energy Replenishment Rate (MJ/s, i.e. refuel speed) instead of a docking-time add-on. Power is given as % of each car's homologated high-power curve at <=V1 (230 km/h) and >=V2 (240 km/h), interpolated between; not as kW. Also Nmax (rpm) and fuel R80.

### 2026 Daytona (Roar + Rolex 24)

Source: https://au.motorsport.com/imsa/news/2026-daytona-24-hours-bop-analysis-imsa-also-silences-teams/10789090/  
Note: Press gives kW (converted by motorsport.com) rather than %.

- Acura ARX-06: kg=1041, kW_below_230=520, kW_above_240=505.96, MJ=899, energy_rate_MJ_s=22.475
- Aston Martin Valkyrie: kg=1030, kW_below_230=513.76, kW_above_240=520, MJ=913, energy_rate_MJ_s=22.825
- BMW M Hybrid V8: kg=1038, kW_below_230=517.92, kW_above_240=510.12, MJ=903, energy_rate_MJ_s=22.575
- Cadillac V-Series.R: kg=1033, kW_below_230=520, kW_above_240=504.92, MJ=896, energy_rate_MJ_s=22.4
- Porsche 963: kg=1035, kW_below_230=517.92, kW_above_240=510.12, MJ=903, energy_rate_MJ_s=22.575

### 2026 Sebring

Source: https://www.autosport.com/imsa/news/porsche-pays-dearly-for-rolex-24-win-bop-analysis-sebring-12-hours-2026/10805691/  
Note: Partial: only Porsche 1055 kg and Valkyrie 520 kW stated; others only kg/kW ratios.

- Porsche 963: kg=1055
- Aston Martin Valkyrie: kW=520

### 2026 Watkins Glen

Source: https://www.imsa.com/wp-content/uploads/sites/32/2026/06/17/TB-IWSC-26-40-Watkins-Glen-Event-BoP-06172026.pdf  

- Acura ARX-06: kg=1045, power_v1_pct=98.3, power_v2_pct=99.6, MJ=911, energy_rate_MJ_s=22.775
- Aston Martin Valkyrie: kg=1020, power_v1_pct=100.0, power_v2_pct=100.0, MJ=914, energy_rate_MJ_s=22.85
- BMW M Hybrid V8: kg=1030, power_v1_pct=98.8, power_v2_pct=96.9, MJ=901, energy_rate_MJ_s=22.525
- Cadillac V-Series.R: kg=1032, power_v1_pct=97.1, power_v2_pct=99.0, MJ=903, energy_rate_MJ_s=22.575
- Porsche 963 (2026 homologation): kg=1073, power_v1_pct=96.3, power_v2_pct=100.0, MJ=913, energy_rate_MJ_s=22.825
- Porsche 963 (2025 homologation): kg=1058, power_v1_pct=100.0, power_v2_pct=97.3, MJ=909, energy_rate_MJ_s=22.725

### 2026 Road America

Source: https://www.imsa.com/wp-content/uploads/sites/32/2026/07/22/TB-IWSC-26-49-Road-America-Event-BoP-07222026.pdf  

- Acura ARX-06: kg=1045, power_v1_pct=99.0, power_v2_pct=100.0, MJ=912, energy_rate_MJ_s=22.8
- Aston Martin Valkyrie: kg=1020, power_v1_pct=100.0, power_v2_pct=100.0, MJ=912, energy_rate_MJ_s=22.8
- BMW M Hybrid V8: kg=1030, power_v1_pct=100.0, power_v2_pct=98.5, MJ=906, energy_rate_MJ_s=22.65
- Cadillac V-Series.R: kg=1053, power_v1_pct=97.9, power_v2_pct=99.6, MJ=908, energy_rate_MJ_s=22.7
- Porsche 963 (2026 homologation): kg=1066, power_v1_pct=96.5, power_v2_pct=99.2, MJ=907, energy_rate_MJ_s=22.675
- Porsche 963 (2025 homologation): kg=1062, power_v1_pct=97.3, power_v2_pct=99.0, MJ=906, energy_rate_MJ_s=22.65

Missing IMSA: all 2025 GTP rounds; 2026 Long Beach, Laguna Seca, Detroit, Indianapolis, Petit Le Mans
