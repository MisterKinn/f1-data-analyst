# Handoff

**Scope checked on 24 November 2026.** The CSV covers 31 championship races. There are 326 published model allocations from 36 committee decisions, 136 model entries with no public 2026 BoP table located, and two event records per race. A Prologue or test day does not create another championship round. The 2023 GT field was LMGTE Am. LMGT3 coverage starts in 2024.

### Reading the CSV

| Row or field | Meaning |
|---|---|
| `published` | Hypercar allocation printed in the applicable decision. A model may have an allocation even if no car of that model started. |
| `published_curve_id` | The LMGT3 bulletin gives a homologated curve code. Read `other.curve_id`, the speed break and the signed high-speed gain. The PDF gives no absolute maximum in kW. |
| `bop_not_found_public` | A 2026 entry list identifies the model. The numerical cells are empty. The linked entry list supports the name only. |
| `min_weight_kg` | Hypercar minimum dry weight. For LMGT3 use the manufacturer's base weight, before any car-specific success ballast. The lower competitor table, where present, gives entry-specific weights. |
| `max_power_kw` | In the two-stage tables, this is the published maximum **below** the speed break. See `other.power_gain_above_pct` for the higher-speed setting, including zero and negative values. |
| `front_axle_threshold_kmh` | Dry front-axle deployment speed when assigned. The wet-tyre speed is in `other.front_axle_wet_kmh`. A dash in the published table stays empty. A non-hybrid LMH can have no front deployment value. |
| `energy_per_stint_mj` | Maximum stint energy in megajoules. Keep it distinct from fuel tank capacity, refuelling time or battery capacity. |
| `class=Event` | The car-model and numeric cells are empty. JSON key `record` identifies `circuit_map` or `track_limits`. “Both laps” means the current lap and the following lap. T is a turn, MP a marshal post. |
| Map evidence | `map_confirmed` means the briefing and drawing agree. `map_archived` identifies the published drawing where a briefing version was not independently confirmed. `map_version_conflict` keeps both records. |
| Track-limit evidence | `track_limits` summarizes the event instructions. `track_limits_partial` marks a specific source limitation. The page numbers are 1-based PDF sheet numbers, including covers. |

### Official indexes

Use the timing site's **Noticeboard** for event bulletins, **Committee** for BoP, and **Results → event information** for circuit maps. Its current interface shares one URL across event selections. The two JSON links below are the repeatable listing pages for each year's events. The folder names in the next table identify the exact event slice. Old HTML links can return a page containing only “Loading…”. [Al Kamel timing site](https://fiawec.alkamelsystems.com/)


| Year | Notices and decisions | Results and maps | HTML committee indexes |
|---|---|---|---|
| 2023 | [Noticeboard JSON](https://files.alkamelcloud.com/wec/manifests/results_noticeboard_11_2023.json) | [Results JSON](https://files.alkamelcloud.com/wec/manifests/results_12_2023.json) | [Al Kamel](https://fiawec.alkamelsystems.com/committe.php?season=11_2023) · [FIA](https://www.fia.com/events/world-endurance-championship/season-2023/wec-committee) |
| 2024 | [Noticeboard JSON](https://files.alkamelcloud.com/wec/manifests/results_noticeboard_12_2024.json) | [Results JSON](https://files.alkamelcloud.com/wec/manifests/results_13_2024.json) | [Al Kamel](https://fiawec.alkamelsystems.com/committe.php?season=12_2024) · [FIA](https://www.fia.com/events/world-endurance-championship/season-2024/wec-committee) |
| 2025 | [Noticeboard JSON](https://files.alkamelcloud.com/wec/manifests/results_noticeboard_13_2025.json) | [Results JSON](https://files.alkamelcloud.com/wec/manifests/results_14_2025.json) | [Al Kamel](https://fiawec.alkamelsystems.com/committe.php?season=13_2025) · [FIA](https://www.fia.com/events/world-endurance-championship/season-2025/wec-committee) |
| 2026 | [Noticeboard JSON](https://files.alkamelcloud.com/wec/manifests/results_noticeboard_14_2026.json) | [Results JSON](https://files.alkamelcloud.com/wec/manifests/results_15_2026.json) | [Al Kamel](https://fiawec.alkamelsystems.com/committe.php?season=14_2026) · [FIA](https://www.fia.com/events/world-endurance-championship/season-2026/wec-committee) |

The FIA season-page label can differ from the year on the linked decision. Check the actual PDF year. The legacy noticeboard URL spells the parameter “evvent” and the committee filename is “committe.php”.

### Event indexes and exact slugs

Each JSON index covers all events in that season. Select an event by matching the full slug. The board link gives the legacy event route. The briefing and map links contain the full paths to the selected PDFs. The model counts are in Hypercar / LMGT3 order. For 2026 they are roster counts. Decision numbers link the event to the bulletin register below.

| Year / round | Noticeboard slug | Results slug | Event links | BoP decision, H / GT | Models, H / GT |
|---|---|---|---|---|---|
| 2023 R1 | `01_1000 Miles of Sebring` | `01_SEBRING` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=01_1000+Miles+of+Sebring&season=11_2023) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/01_1000%20Miles%20of%20Sebring/003_Doc%203%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/12_2023/01_SEBRING/00_Event%20information/Sebring_2023_WEC_CircuitMap_V2.pdf) | D0031 / — | 7 / 0 |
| 2023 R2 | `02_6 Hours of Portimao` | `02_AUTODROMO DO ALGARVE` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=02_6+Hours+of+Portimao&season=11_2023) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/02_6%20Hours%20of%20Portimao/010_Doc%2010%20-%20Briefing%20Notes%20updated.pdf) · [map](https://files.alkamelcloud.com/wec/results/12_2023/02_AUTODROMO%20DO%20ALGARVE/00_EVENT%20INFORMATION/Circuit_Map.pdf) | D0031 / — | 7 / 0 |
| 2023 R3 | `03_6 Hours of Spa` | `03_SPA FRANCORCHAMPS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=03_6+Hours+of+Spa&season=11_2023) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/03_6%20Hours%20of%20Spa/006_Doc%206%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/12_2023/03_SPA%20FRANCORCHAMPS/00_Event%20Information/Circuit_Map.pdf) | D0031 / — | 7 / 0 |
| 2023 R4 | `04_24 Hours of Le Mans` | `04_LE MANS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=04_24+Hours+of+Le+Mans&season=11_2023) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/04_24%20Hours%20of%20Le%20Mans/029_Doc%2029%20-%20Briefing%20notes%20.pdf) · [map](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/04_24%20Hours%20of%20Le%20Mans/008_Doc%208%20-%20Circuit%20Map%20-%20corrected.pdf) | D0049 / — | 7 / 0 |
| 2023 R5 | `05_6 Hours of Monza` | `05_AUTODROMO NAZIONALE DI MONZA` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=05_6+Hours+of+Monza&season=11_2023) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/05_6%20Hours%20of%20Monza/004_Doc%204%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/12_2023/05_AUTODROMO%20NAZIONALE%20DI%20MONZA/00_EVENT%20INFORMATION/Circuit%20Map.pdf) | D0054 / — | 7 / 0 |
| 2023 R6 | `06_6 Hours of Fuji` | `06_FUJI SPEEDWAY` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=06_6+Hours+of+Fuji&season=11_2023) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/06_6%20Hours%20of%20Fuji/006_Doc%206%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/12_2023/06_FUJI%20SPEEDWAY/00_EVENT%20INFORMATION/Circuit_Map.pdf) | D0054 / — | 7 / 0 |
| 2023 R7 | `07_8 Hours of Bahrain` | `07_BAHRAIN INTERNATIONAL CIRCUIT` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=07_8+Hours+of+Bahrain&season=11_2023) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/07_8%20Hours%20of%20Bahrain/006_Doc%206%20-%20Briefing%20Presentation.pdf) · [map](https://files.alkamelcloud.com/wec/results/12_2023/07_BAHRAIN%20INTERNATIONAL%20CIRCUIT/00_EVENT%20INFORMATION/Circuit%20Map.pdf) | D0060 / — | 7 / 0 |
| 2024 R1 | `01_1812 km of Qatar` | `01_LOSAIL` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=01_1812+km+of+Qatar&season=12_2024) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/01_1812%20km%20of%20Qatar/005_Doc%205%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/13_2024/01_LOSAIL/00_EVENT%20INFORMATION/Circuit%20Map.pdf) | D21/D22 | 9 / 9 |
| 2024 R2 | `02_6 Hours of Imola` | `02_IMOLA` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=02_6+Hours+of+Imola&season=12_2024) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/02_6%20Hours%20of%20Imola/007_Doc%207%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/13_2024/02_IMOLA/00_EVENT%20INFORMATION/Circuit%20Map.pdf) | D33/D34 | 9 / 9 |
| 2024 R3 | `03_6 Hours of Spa` | `03_SPA FRANCORCHAMPS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=03_6+Hours+of+Spa&season=12_2024) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/03_6%20Hours%20of%20Spa/025_Doc%2025%20-%20BRIEFING%20NOTES%20AMENDED.pdf) · [map](https://files.alkamelcloud.com/wec/results/13_2024/03_SPA%20FRANCORCHAMPS/00_EVENT%20INFORMATION/Circuit%20Map.pdf) | D37/D38 | 9 / 9 |
| 2024 R4 | `04_24 Hours of Le Mans` | `04_LE MANS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=04_24+Hours+of+Le+Mans&season=12_2024) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/04_24%20Hours%20of%20Le%20Mans/036_Doc%2036%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/13_2024/04_LE%20MANS/01_24H%20EVENT%20INFORMATION/Circuit%20Map.pdf) | D39/D41 | 9 / 9 |
| 2024 R5 | `05_6 Hours of Sao Paulo` | `05_SAO PAULO` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=05_6+Hours+of+Sao+Paulo&season=12_2024) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/05_6%20Hours%20of%20Sao%20Paulo/006_Doc%206%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/13_2024/05_SAO%20PAULO/00_EVENT%20INFO/Circuit%20Map.pdf) | D45/D46 | 9 / 9 |
| 2024 R6 | `06_Lone Star Le Mans` | `06_CIRCUIT OF THE AMERICAS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=06_Lone+Star+Le+Mans&season=12_2024) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/06_Lone%20Star%20Le%20Mans/006_Doc%206%20-%20Briefing%20notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/13_2024/06_CIRCUIT%20OF%20THE%20AMERICAS/00_EVENT%20INFO/Circuit%20Map%20v2.pdf) | D48/D47 | 8 / 9 |
| 2024 R7 | `07_6 Hours of Fuji` | `07_FUJI SPEEDWAY` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=07_6+Hours+of+Fuji&season=12_2024) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/07_6%20Hours%20of%20Fuji/008_Doc%208%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/13_2024/07_FUJI%20SPEEDWAY/00_Event%20Info/Circuit%20Map.pdf) | D53/D52 | 8 / 9 |
| 2024 R8 | `08_8 Hours of Bahrain` | `08_BAHRAIN INTERNATIONAL CIRCUIT` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=08_8+Hours+of+Bahrain&season=12_2024) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/08_8%20Hours%20of%20Bahrain/008_Doc%208%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/13_2024/08_BAHRAIN%20INTERNATIONAL%20CIRCUIT/00_Event%20Info/Circuit%20Map%20v2.pdf) | D56/D55 | 8 / 9 |
| 2025 R1 | `01_1812 km of Qatar` | `01_LOSAIL` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=01_1812+km+of+Qatar&season=13_2025) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/01_1812%20km%20of%20Qatar/012_Doc%2012%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/14_2025/01_LOSAIL/00_Event%20Info/1_CircuitMap.pdf) | D09/D08 | 8 / 9 |
| 2025 R2 | `02_6 Hours of Imola` | `02_IMOLA` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=02_6+Hours+of+Imola&season=13_2025) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/02_6%20Hours%20of%20Imola/007_Doc%207%20-%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/14_2025/02_IMOLA/00_Event%20Info/Circuit%20Map.pdf) | D18/D19 | 8 / 9 |
| 2025 R3 | `03_6 Hours of Spa` | `03_SPA FRANCORCHAMPS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=03_6+Hours+of+Spa&season=13_2025) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/03_6%20Hours%20of%20Spa/007_Doc%207%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/14_2025/03_SPA%20FRANCORCHAMPS/00_Circuit%20Info/Circuit%20Map.pdf) | D24/D23 | 8 / 9 |
| 2025 R4 | `04_24 Hours of Le Mans` | `04_LE MANS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=04_24+Hours+of+Le+Mans&season=13_2025) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/04_24%20Hours%20of%20Le%20Mans/059_Doc%2059%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/14_2025/04_LE%20MANS/00_Event%20Info/Circuit%20Map.pdf) | D29/D30 | 8 / 9 |
| 2025 R5 | `05_6 Hours of Sao Paulo` | `05_SAO PAULO` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=05_6+Hours+of+Sao+Paulo&season=13_2025) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/05_6%20Hours%20of%20Sao%20Paulo/005_Doc%205%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/14_2025/05_SAO%20PAULO/00_Circuit%20Info/Circuit%20Map%20v2.pdf) | D36/D35 | 8 / 9 |
| 2025 R6 | `06_Lone Star Le Mans` | `06_CIRCUIT OF THE AMERICAS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=06_Lone+Star+Le+Mans&season=13_2025) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/06_Lone%20Star%20Le%20Mans/008_Doc%208%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/14_2025/06_CIRCUIT%20OF%20THE%20AMERICAS/00_Event%20Info/Circuit%20Map%20v2.pdf) | D40/D39 | 8 / 9 |
| 2025 R7 | `07_6 Hours of Fuji` | `07_FUJI SPEEDWAY` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=07_6+Hours+of+Fuji&season=13_2025) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/07_6%20Hours%20of%20Fuji/006_Doc%206%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/14_2025/07_FUJI%20SPEEDWAY/00_Event%20Info/Circuit%20Map.pdf) | D41/D42 | 8 / 9 |
| 2025 R8 | `08_8 Hours of Bahrain` | `08_BAHRAIN INTERNATIONAL CIRCUIT` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=08_8+Hours+of+Bahrain&season=13_2025) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/08_8%20Hours%20of%20Bahrain/006_Doc%206%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/14_2025/08_BAHRAIN%20INTERNATIONAL%20CIRCUIT/00_Event%20Info/Circuit%20Map.pdf) | D46/D47 | 8 / 9 |
| 2026 R1 | `01_6 Hours of Imola` | `01_IMOLA` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=01_6+Hours+of+Imola&season=14_2026) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/01_6%20Hours%20of%20Imola/007_Doc%207%20-%20Drivers'%20and%20Team%20Managers'%20Briefing%20Notes.pdf) · [map](https://files.alkamelcloud.com/wec/results/15_2026/01_IMOLA/00_Event%20Info/1_Circuit%20Map.pdf) · [WEC race](https://www.fiawec.com/en/race/6-hours-of-imola-2026) | unavailable | 8 / 9 |
| 2026 R2 | `02_6 Hours of Spa` | `02_SPA FRANCORCHAMPS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=02_6+Hours+of+Spa&season=14_2026) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/02_6%20Hours%20of%20Spa/007_Doc%207%20-%20Drivers%20and%20Team%20Managers'%20Briefing%20Notes%20V1.pdf) · [map](https://files.alkamelcloud.com/wec/results/15_2026/02_SPA%20FRANCORCHAMPS/00_Event%20Info/Circuit%20Map.pdf) · [WEC race](https://www.fiawec.com/en/race/totalenergies-6-hours-of-spa-francorchamps-2026) | unavailable | 8 / 9 |
| 2026 R3 | `03_24 Hours of Le Mans` | `03_LE MANS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=03_24+Hours+of+Le+Mans&season=14_2026) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/03_24%20Hours%20of%20Le%20Mans/006_Doc%206%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/15_2026/03_LE%20MANS/00_Event%20Info/Circuit%20Map%20v3.pdf) · [WEC race](https://www.fiawec.com/en/race/24-hours-of-le-mans-2026) | unavailable | 8 / 9 |
| 2026 R4 | `05_6 Hours of Sao Paulo` | `04_SAO PAULO` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=05_6+Hours+of+Sao+Paulo&season=14_2026) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/05_6%20Hours%20of%20Sao%20Paulo/006_Doc%206%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/15_2026/04_SAO%20PAULO/00_Event%20Info/Circuit%20Map.pdf) · [WEC race](https://www.fiawec.com/en/race/rolex-6-hours-of-sao-paulo-2026) | unavailable | 8 / 9 |
| 2026 R5 | `06_Lone Star Le Mans` | `05_CIRCUIT OF THE AMERICAS` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=06_Lone+Star+Le+Mans&season=14_2026) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/06_Lone%20Star%20Le%20Mans/004_Doc%204%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/15_2026/05_CIRCUIT%20OF%20THE%20AMERICAS/00_Event%20Info/Circuit%20Map%20v3.pdf) · [WEC race](https://www.fiawec.com/en/race/lone-star-le-mans-2026) | unavailable | 8 / 9 |
| 2026 R6 | `07_6 Hours of Fuji` | `06_FUJI SPEEDWAY` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=07_6+Hours+of+Fuji&season=14_2026) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/07_6%20Hours%20of%20Fuji/005_Doc%205%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/15_2026/06_FUJI%20SPEEDWAY/00_Event%20Info/Circuit%20Map.pdf) · [WEC race](https://www.fiawec.com/en/race/6-hours-of-fuji-2026) | unavailable | 8 / 9 |
| 2026 R7 | `09_6 Hours of Barcelona` | `07_BARCELONA-CATALUNYA` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=09_6+Hours+of+Barcelona&season=14_2026) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/09_6%20Hours%20of%20Barcelona/006_Doc%206%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/15_2026/07_BARCELONA-CATALUNYA/00_Event%20Info/Circuit%20Map%20v1.pdf) · [WEC race](https://www.fiawec.com/en/race/6-hours-of-barcelona-2026) | unavailable | 8 / 9 |
| 2026 R8 | `10_6 Hours of Monza` | `08_AUTODROMO NAZIONALE DI MONZA` | [board](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=10_6+Hours+of+Monza&season=14_2026) · [briefing](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/10_6%20Hours%20of%20Monza/005_Doc%205%20-%20BRIEFING%20NOTES.pdf) · [map](https://files.alkamelcloud.com/wec/results/15_2026/08_AUTODROMO%20NAZIONALE%20DI%20MONZA/00_Event%20Info/Circuit%20Map%20v2.pdf) · [WEC race](https://www.fiawec.com/en/race/6-hours-of-monza-2026) | unavailable | 8 / 9 |

Five initial 2026 legacy lookups used race order where the noticeboard uses a different folder number. These were the attempted listing URLs:

- R4 [6 Hours of Sao Paulo](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=04_6+Hours+of+Sao+Paulo&season=14_2026)
- R5 [Lone Star Le Mans](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=05_Lone+Star+Le+Mans&season=14_2026)
- R6 [6 Hours of Fuji](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=06_6+Hours+of+Fuji&season=14_2026)
- R7 [6 Hours of Barcelona](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=07_6+Hours+of+Barcelona&season=14_2026)
- R8 [6 Hours of Monza](https://fiawec.alkamelsystems.com/noticeBoard.php?evvent=08_6+Hours+of+Monza&season=14_2026)

Use the corrected slugs above. Other source paths include the [2023 race-folder Le Mans map](https://files.alkamelcloud.com/wec/results/12_2023/04_LE%20MANS/01_24H%20EVENT%20INFORMATION/Circuit_Map.pdf), the [2023 Bahrain written briefing](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/07_8%20Hours%20of%20Bahrain/005_Doc%205%20-%20RD%20Briefing%20Notes.pdf), and the [2026 track-limit clarification](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/05_6%20Hours%20of%20Sao%20Paulo/055_Doc%2055%20-%20RACE%20DIRECTOR%20COMMUNICATION%20N.042026.pdf).

### Discover and select documents

The public archive uses these direct-file templates. Copy spelling, accents, case, spaces and the entire basename from the manifest. The event slug belongs in the map and briefing paths. Technical decisions usually live in the season committee folder and carry no event slug.

```text
https://files.alkamelcloud.com/wec/results_noticeboard/{notice_season}/committee/{filename}
https://files.alkamelcloud.com/wec/results_noticeboard/{notice_season}/committee/02_Decisions/{filename}
https://files.alkamelcloud.com/wec/results_noticeboard/{notice_season}/{notice_slug}/{NNN}_Doc%20{N}%20-%20{title}.pdf
https://files.alkamelcloud.com/wec/results/{result_season}/{result_slug}/{event_information_folder}/{map_filename}
https://www.fia.com/sites/default/files/{exact_basename_from_fia_link}
https://www.fiawec.com/en/race/document/download/{entry_list_id}
```

Use the first committee form for 2023–24 and the second for 2025–26. The FIA mirror commonly lowercases basenames. Its suffixes can differ, including `_0.pdf` for 2023 D0060. The official event URL uses an opaque integer for entry lists. Follow the link labelled **Entry List**. In the modern timing interface a selected noticeboard PDF can also produce `https://fiawec.alkamelsystems.com/?section=noticeboard&file={percent_encoded_manifest_path}`. Download the PDF bytes from the file host for extraction.

The following Python 3 code lists candidate PDFs without a search engine. Its four output columns are season, archive, exact folder path and exact PDF URL. Use the slug and decision register below to select each file. Inspect other bulletins and race-director communications for amendments, even when their titles omit the subject.

```python
import json, re
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

host = "https://files.alkamelcloud.com/"
pick = re.compile(r"bop|balance.{1,5}performance|circuit[ _-]*map|"
                  r"briefing|race director communication|bulletin", re.I)

def leaves(nodes, parent=()):
    for node in nodes:
        parts = parent + ((node["name"],) if node.get("name") else ())
        if node.get("children"):
            yield from leaves(node["children"], parts)
        elif node.get("url") and node["url"].lower().endswith(".pdf"):
            yield parts, node["url"]

for year in range(2023, 2027):
    for kind, offset in (("results_noticeboard", 2012), ("results", 2011)):
        season = f"{year-offset}_{year}"
        index = f"{host}wec/manifests/{kind}_{season}.json"
        req = Request(index, headers={"User-Agent": "WEC-document-index/1.0"})
        with urlopen(req, timeout=60) as reply:
            nodes = json.load(reply)["folders"]
        for parts, path in leaves(nodes):
            if pick.search(parts[-1]):
                print(year, kind, "/".join(parts), urljoin(host, quote(path, safe="/")), sep="\t")
```

For an HTML mirror, follow PDF links whose visible title mentions the class and BoP. Accept case, underscores and spaces. The filename pattern is `(?i)WEC_(20\d{2})_D(\d{1,4})_.*?(HYPERCAR|LMGT3).*?BOP.*\.pdf$`. Confirm the year, class, decision number, date and application on page 1. Read the event heading on page 2. A steward's event document number (“Doc 6”) is a separate series from a committee decision (“D06”). A single decision can cover multiple race headings across pages.

For revisions match `(?i)amended|corrected|updated|\bv\.?\s*\d+|[_-]v\d+` against the title **and** basename. Group by year, subject, event and class. Compare printed dates, effective wording, scope and revision number. A new decision number can replace only one round of an earlier multi-round table. Retain URL, page and SHA-256 per PDF. If two files still disagree after these checks, retain both with a conflict flag. A bare higher document number or a newer archive timestamp is insufficient.

### Locations and extraction examples

Flatten line breaks in headers and normalize decimal commas. Keep the column positions in the body with a layout-aware extractor, for example `pypdf.PageObject.extract_text(extraction_mode="layout")`. Read the **current** column within each group. The same row may contain `previous`, `adj` and `current` numbers. For image tables render the physical page and check the numbers against column boundaries.

| Document type | Location, anchor and units | Two real extraction checks |
|---|---|---|
| 2023 Hypercar decision | Page 1 gives the decision scope. Page 2, sometimes page 3, contains the race heading and `Min. Dry Weight` (kg), `Max. Power` (kW), `Ft.Depl. Speed` (dry and wet kph) and `Maximum Stint Energy` (MJ). Anchor the model and event before reading its current cells. | D0031 p2 Sebring, Ferrari 499P = 1057 kg, 515 kW, 908 MJ, dry/wet 190/190. D0054 p3 Fuji, Peugeot 9X8 = 1038 kg, 520 kW, 907 MJ, dry/wet 135/150. |
| 2023 power curve | D0031 p3, Table 1, `Engine Speed (N/Nmax)`. Match the row keyed by the p2 nominal kW. Read 20 columns at 0.550–1.025 in 0.025 steps. CSV stores both arrays, in order, on the 21 referenced rows. | At 0.550/0.950/1.025, the 513 kW row reads 253/513/438 kW. The 520 kW row reads 256/520/444 kW. |
| 2024–25 Hypercar decision | Page 2 vehicle table under the event name. Use `(?i)Max\.?\s*Power\s*below\s*(\d+)\s*kph`, plus the current percentage under the power-gain header. Dry and wet are separate from the speed break. | D21 p2 Qatar 2024, Ferrari = 1075 kg, 503 kW below 210 km/h, 0%, 902 MJ, dry/wet 190/190. D39 p2 Le Mans 2024, Ferrari = 1043 kg, 508 kW below 250 km/h, −1.7%, 889 MJ, dry/wet 190/190. |
| LMGT3 decision | Page 2 manufacturer table. Anchor `Max. Power below 200 kph` and `(?<!\w)P\d{1,2}\b` in the **current** curve column. Extract signed percentage above 200 km/h, base weight (kg) and maximum stint energy (MJ). Qatar 2024 visually orders the weight before the manufacturer in extracted text. | D22 p2 Qatar 2024, BMW = P4, +1%, 1321 kg, 687 MJ. D41 p2 Le Mans 2024, Corvette = P4, −2%, 1347 kg, 671 MJ. |
| Timing map | Standalone map PDF p1, normally the lower-right title block. Match `(?i)\bv(?:ersion)?\.?\s*(\d+)(?:-(20\d{2}))?`; examine the image if embedded fonts corrupt the text. In briefing PDFs, strip whitespace and match `(?i)Timekeepingcircuitmapv(\d+)`. A timetable version elsewhere on the page is separate. | Qatar 2024 drawing p1 = V4, dated 26 February 2024 at 10:30. Fuji 2024 drawing p1 = V3, dated 12 September at 11:24, while the briefing cites V2. |
| Event briefing or presentation | Search every sheet for `(?i)track\s*limits|cameras?\s*at|judges?\s*of\s*fact`, and then for `T\s*\d+|MP\s*\d+`. Read the nearby session scope, line side, apex/exit and sanctions. The CSV gives exact pages. | Portimão 2023 Doc 10 p1 applies the T15 two-lap rule in qualifying if the car stays out. Fuji 2026 Doc 5 p1 states separate two-lap rules for T15 and T16. |
| Supplemental race-director communication | Page 1, locate `(?i)track limits|clarification|commitment to enter`. Read the date and effective period before applying it outside that race. | São Paulo 2026 Doc 55 p1 starts the review window at the infringement and sets 15 minutes. Fuji 2023 Doc 27 p1 uses the dotted line for pit commitment when entry closes. The latter does not replace the event's T16 track-limit rule. |
| Entry list | PDF p1, class blocks and the `CARS` column. Anchor `(?i)HYPERCAR|LMGT3|RESERVE`. Keep models in the two requested class blocks and deduplicate team entries. At Le Mans skip the LMP2 block and reserves. | Imola 2026 p1 lists Genesis GMR-001-Hypercar. Le Mans 2026 p1 lists Ferrari 296 LMGT3 Evo. Neither line supplies a BoP number. |

### Publication timing, exceptions and checks

- Decisions can appear before the first session or be amended during event week. The printed decision date establishes issue timing. It does not establish the minute a file first became public. Le Mans 2024 Hypercar D39 is dated 31 May, nine days before the 9 June test day. The LMGT3 D41 is dated 4 June. Imola 2025 Hypercar D18 was amended on 16 April before the 20 April race. The 2025 Bahrain decisions are dated 31 October ahead of the 8 November race.
- Entry lists can appear weeks before a session and can be revised before scrutineering. The 2026 Imola PDF is marked provisional V2, dated 12 April, one week before the race. The Le Mans roster is provisional V3 dated 19 May. Preserve the printed revision and report whether a list is provisional or final.
- Briefings and maps tend to appear with event information or around the drivers’ meeting. The Bahrain 2023 presentation is stamped 19:11 on 2 November, before the 4 November race. The V5 Le Mans 2023 map is dated 3 June and the corrected V6 is dated 4 June. Race-week and test-day headings can differ. Poll before practice, after each briefing and through race start. Record the first successful observation in UTC. A manifest rebuild can give hundreds of old files the same timestamp.
- In 2023 D0031 covers Sebring and an initial Portimão/Spa/Le Mans block. D0049 replaces only Le Mans. D0054 has Monza, Fuji and an early Bahrain block. The Fuji table continues onto page 3 before Bahrain begins. D0060 replaces Bahrain and spells its heading “BARHAIN”. In 2024 the Fuji LMGT3 file is D52 amended on 13 September. In 2025 select amended D09 (20 February), D18 (16 April) and D30 (6 June). Extract the full eight-digit date even when “Amended” comes before it.
- Distinguish Losail/Lusail/Qatar, Algarve/Portimão, Interlagos/São Paulo and Circuit of the Americas/Austin/Lone Star Le Mans. The last is distinct from the 24 Hours of Le Mans. In 2026 the actual closing rounds were Barcelona and Monza after the calendar changed. The noticeboard skips numbers 04 and 08 among race folders. Reconstruct paths from the slug table. [FIA WEC calendar change](https://www.fiawec.com/en/news/fia-wec-and-fia-confirm-venues-for-final-two-rounds-of-2026/13698)
- Map files mix `Circuit_Map`, `Circuit Map`, `1_CircuitMap` and versions in the basename. Le Mans has separate information folders for the test day and race. Austin and Fuji 2024 have older versions named in the briefing than the archived drawing. The Le Mans 2023 race-information folder retains V5 alongside the corrected noticeboard V6. In these three cases the public record does not uniquely establish which drawing was used in the race.
- Portimão 2023 uses updated Doc 10 and Spa 2024 uses amended Doc 25. Bahrain 2023 Doc 5 displays only a posting stamp. Its companion Doc 6 slide 12 identifies the T3 judge. At Le Mans 2026 the sole general briefing on the public event board combines an appendix and test-day material. Page 24 explicitly applies the chicane count to race and sessions. The race-specific warning count was not verified.
- Raster pages can yield empty text or just a stamp. Render at 200–300 dpi, retain the page number, use OCR with cell boundaries and visually verify signs and labels. Two known fixtures are D0031’s tables and D41’s Le Mans LMGT3 table. In D41 the Ford is 1327 kg and 683 MJ, while the Porsche is 1327 kg and 674 MJ. The ability to extract page 1 says nothing about page 2.
- The public 2026 committee decision folder listed 31 files, including revisions. None was an identifiable event BoP allocation for these classes. No event-titled BoP table was located on the eight public event boards either. BMW’s R03 concerns when stint-energy accounting starts. D06 and D13 address compensation ballast. These documents do not provide a full model base weight or a model energy allocation. Keep numerical fields empty and retry the official indexes if they change. [BMW R03](https://files.alkamelcloud.com/wec/results_noticeboard/14_2026/committee/03_Requests/WEC_2026_R03_BMW_M_Team_WRT_Energy_per_stint.pdf)
- On an HTTP error or a “Loading…” response, retry the manifest-derived file and the FIA mirror. Check for PDF magic bytes `%PDF-`, then validate page count and heading. If both fail, record a retrieval failure separately from an inspected index with no applicable document. A search miss or an entry list does not authorize copying last season's allocation.



### Bulletin register

The digest is for the PDF downloaded from Al Kamel. Recompute it when checking new versions. A mirror may re-encode a PDF while preserving its table.

| Year | Decision | Official PDF | SHA-256 of archived copy |
|---|---|---|---|
| 2023 | D0031 | [WEC_2023_D0031_Hypercar_BOP_08032023.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/committee/WEC_2023_D0031_Hypercar_BOP_08032023.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2023_d0031_hypercar_bop_08032023.pdf) | `44feaf4ef21f69b799c62211f9976225ab2bd9fcf2cd1888e1ea537f3e4dae41` |
| 2023 | D0049 | [WEC_2023_D0049_Hypercar_BOP_31052023.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/committee/WEC_2023_D0049_Hypercar_BOP_31052023.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2023_d0049_hypercar_bop_31052023.pdf) | `d0dbe127c1634702a87dacbbcbb4f90c9be010b9e60f536faf061fbbba9a4c82` |
| 2023 | D0054 | [WEC_2023_D0054_Hypercar_BOP_03072023.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/committee/WEC_2023_D0054_Hypercar_BOP_03072023.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2023_d0054_hypercar_bop_03072023.pdf) | `16187a8a5a7338b1aced899c89f0a26f02e232e8c2837a067617abd51e6da688` |
| 2023 | D0060 | [WEC_2023_D0060_Hypercar_BOP_26102023.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/11_2023/committee/WEC_2023_D0060_Hypercar_BOP_26102023.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2023_d0060_hypercar_bop_26102023_0.pdf) | `43430cf71bfb9d36b32c6738050239a385f4fe21f7b438cf6cb3ab079f68f9a6` |
| 2024 | D21 | [WEC_2024_D21_Hypercar_BOP_16022024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D21_Hypercar_BOP_16022024.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2024_d21_hypercar_bop_16022024.pdf) | `800c42353612e9bcdcd0fd08663a8648b5c583f90e97e85f7484f486eae1a284` |
| 2024 | D22 | [WEC_2024_D22_LMGT3_BOP_16022024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D22_LMGT3_BOP_16022024.pdf) | `f28097c27c126b0219919bd83a1f045a92438f8c1e4d2a6820cdcab68204ed5e` |
| 2024 | D33 | [WEC_2024_D33_Hypercar_BOP_12042024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D33_Hypercar_BOP_12042024.pdf) | `80e65891e80dd9c569f87870fa07de0ee363adb90cd11508dd8e1a052028ebe7` |
| 2024 | D34 | [WEC_2024_D34_LMGT3_BOP_12042024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D34_LMGT3_BOP_12042024.pdf) | `d550b6c50c3b3031d5f859edeebd0dfbf68000f6da5064d79e02006e5c3834f2` |
| 2024 | D37 | [WEC_2024_D37_Hypercar_BOP_07052024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D37_Hypercar_BOP_07052024.pdf) | `5e4dcf24efe6e96a9460e638765a8bc1e2d814b166d2a253cc15251fdb80b2cb` |
| 2024 | D38 | [WEC_2024_D38_LMGT3_BOP_07052024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D38_LMGT3_BOP_07052024.pdf) | `92591a9ae8469b9dda3b0f27dcaaa753f63581f781fec61aa474beca810e1778` |
| 2024 | D39 | [WEC_2024_D39_Hypercar_BOP_31052024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D39_Hypercar_BOP_31052024.pdf) | `62f2c9e0bb8fba5e4c33709d37d7c0427242efc84c3218ca68b7ffe7fa3720ab` |
| 2024 | D41 | [WEC_2024_D41_LMGT3_BOP_04062024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D41_LMGT3_BOP_04062024.pdf) | `a9caffe18be4ee8c0f8b91f3ffd91c0337b636950fcb6c7d3246cd90e9ff0f28` |
| 2024 | D45 | [WEC_2024_D45_Hypercar_BOP_05072024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D45_Hypercar_BOP_05072024.pdf) | `ba8589ce1870661e1af9987f42dc9641a727125ac08d56ec4c3237a66b1a107d` |
| 2024 | D46 | [WEC_2024_D46_LMGT3_BOP_05072024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D46_LMGT3_BOP_05072024.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2024_d46_lmgt3_bop_05072024.pdf) | `6996f6d99b862a0449676dcdf19a52f337090b02e0a95b689de32c0079f35614` |
| 2024 | D47 | [WEC_2024_D47_LMGT3_BOP_23082024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D47_LMGT3_BOP_23082024.pdf) | `967b939d1c8556e00b6c89b7673a79d350eb58ae96922e37317d40e3c553d3a7` |
| 2024 | D48 | [WEC_2024_D48_Hypercar_BOP_23082024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D48_Hypercar_BOP_23082024.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2024_d48_hypercar_bop_23082024.pdf) | `b21165b5e7fc4b6610e9c619159dd50c834de0be2ecb631036cee724d3936bc6` |
| 2024 | D52 | [WEC_2024_D52_LMGT3_BOP_13092024_amended.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D52_LMGT3_BOP_13092024_amended.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2024_d52_lmgt3_bop_13092024_amended.pdf) | `27b3454f7622284a83fe0762c0292a0e69e5f190e78202039c4ac297052ebc0d` |
| 2024 | D53 | [WEC_2024_D53_Hypercar_BOP_10092024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D53_Hypercar_BOP_10092024.pdf) | `5ecda5db1f971d998c7e984d29baaad031fd199d4654b06083e2a7d167c7d517` |
| 2024 | D55 | [WEC_2024_D55_LMGT3_BOP_22102024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D55_LMGT3_BOP_22102024.pdf) | `3f04e539c9687813b08b12efefd0a897f348559626421bdbf78d553cb4024841` |
| 2024 | D56 | [WEC_2024_D56_Hypercar_BOP_25102024.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/12_2024/committee/WEC_2024_D56_Hypercar_BOP_25102024.pdf) | `9f2852fc4279b1998d666b6bf77a71651e91384cc6aaa6cb26017576d9f52ded` |
| 2025 | D08 | [WEC_2025_D08_LMGT3_BOP_19022025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D08_LMGT3_BOP_19022025.pdf) | `50c8ee1547642770d960caa00e53b07d3533a4f0ca7e201a6844e67bf4ec0f1d` |
| 2025 | D09 | [WEC_2025_D09_Hypercar_BOP_Amended_20022025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D09_Hypercar_BOP_Amended_20022025.pdf) | `206c2760725a71b42ae92fb41042023ace1be880e8122eb8e739d406bd0013b1` |
| 2025 | D18 | [WEC_2025_D18_Hypercar_BOP_Amended_16042025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D18_Hypercar_BOP_Amended_16042025.pdf) | `6a1daeccb5a83e2b2a9c55e72b9f5315fd3efe269bfb86da554c9cc3478e2432` |
| 2025 | D19 | [WEC_2025_D19_LMGT3_BOP_11042025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D19_LMGT3_BOP_11042025.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2025_d19_lmgt3_bop_11042025.pdf) | `daa4a2a0c1751c4fab1ddcb42b35b750fffa473d397af599d3da7199bc988539` |
| 2025 | D23 | [WEC_2025_D23_LMGT3_BOP_05052025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D23_LMGT3_BOP_05052025.pdf) | `1ef07ea0454a2f9c97c3412bc948f740c16538f59a33bc1831f00ecc35d894dc` |
| 2025 | D24 | [WEC_2025_D24_Hypercar_BOP_05052025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D24_Hypercar_BOP_05052025.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2025_d24_hypercar_bop_05052025.pdf) | `a2a850647784b7e0bc8a727ce0f2dc78b1ee01f2915eb3093116eb64352cca62` |
| 2025 | D29 | [WEC_2025_D29_Hypercar_BOP_03062025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D29_Hypercar_BOP_03062025.pdf) | `861ed64dbf8f03a6e85b3891e712d4419509f5c446ff84f899030dda4d7f8f45` |
| 2025 | D30 | [WEC_2025_D30_LMGT3_BOP_Amended_06062025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D30_LMGT3_BOP_Amended_06062025.pdf) | `cdc898caae8f690e48027be11ecbd8292aa7193a22b3c7c7fc64348496fbbccb` |
| 2025 | D35 | [WEC_2025_D35_LMGT3_BOP_07072025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D35_LMGT3_BOP_07072025.pdf) | `f3253cef9bd81b914e5fb97aaf2f8d1ad5b3c8868d6ec82d8bd3b493f0a7eecc` |
| 2025 | D36 | [WEC_2025_D36_Hypercar_BOP_07072025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D36_Hypercar_BOP_07072025.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2025_d36_hypercar_bop_07072025.pdf) | `b220792f89782684412ad20d7efc673acea4af547d11fb1c0be5696e4cddb87a` |
| 2025 | D39 | [WEC_2025_D39_LMGT3_BOP_02092025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D39_LMGT3_BOP_02092025.pdf) | `4a8a14a339dce739578be818bac4deba95faa205b11e20d6ea131fc424b5e320` |
| 2025 | D40 | [WEC_2025_D40_Hypercar_BOP_02092025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D40_Hypercar_BOP_02092025.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2025_d40_hypercar_bop_02092025.pdf) | `2e321a676904fb83f195e0eefc3e623ce664f9ce3a2d03d795dac98a5487f644` |
| 2025 | D41 | [WEC_2025_D41_Hypercar_BOP_19092025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D41_Hypercar_BOP_19092025.pdf) | `e3d296f7c1d1538e3ea3b831f9670278e224cdd86dd625b87d58e357a0da643b` |
| 2025 | D42 | [WEC_2025_D42_LMGT3_BOP_19092025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D42_LMGT3_BOP_19092025.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2025_d42_lmgt3_bop_19092025.pdf) | `6f2cdbb7975b8d578cdec4b6776bc0b2c53747fbf01f034144e6af32ac0b4892` |
| 2025 | D46 | [WEC_2025_D46_Hypercar_BOP_31102025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D46_Hypercar_BOP_31102025.pdf) · [FIA copy](https://www.fia.com/sites/default/files/wec_2025_d46_hypercar_bop_31102025.pdf) | `46c0406ce78b45a23c7567049048289449a6df616ba0d906133078a00132f4e0` |
| 2025 | D47 | [WEC_2025_D47_LMGT3_BOP_31102025.pdf](https://files.alkamelcloud.com/wec/results_noticeboard/13_2025/committee/02_Decisions/WEC_2025_D47_LMGT3_BOP_31102025.pdf) | `b16d621fd1893f745750a34d384833841f40d164b028068c661da3b83f471bae` |

### Validate a snapshot

There are 524 data rows. The 182 published Hypercar rows have weight, kW and MJ. The 144 published LMGT3 rows have weight, MJ and a curve code. The 136 remaining car rows record gaps. There are 31 map and 31 track-limit records. Use the per-round model counts above to catch a dropped OCR line. These ranges and counts describe this snapshot. Flag changes for review.

Run this with Python 3 beside the CSV.

```python
import csv, json
from collections import Counter
from pathlib import Path

with Path("WEC_2023-2026_BoP.csv").open(encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
events = {(r["year"], r["event"]) for r in rows}
assert len(rows) == 524 and len(events) == 31
assert Counter(y for y, e in events) == {"2023": 7, "2024": 8, "2025": 8, "2026": 8}
keys = set()
for r in rows:
    extra = json.loads(r["other"])
    key = (r["year"], r["event"], r["class"], r["car_model"], extra.get("record"))
    assert key not in keys
    keys.add(key)
    assert r["source_url"].startswith("https://") and r["page"]
    if r["class"] == "Event":
        continue
    if r["status"] == "bop_not_found_public":
        assert r["year"] == "2026"
        assert all(not r[k] for k in ("min_weight_kg", "max_power_kw",
                   "energy_per_stint_mj", "front_axle_threshold_kmh"))
        continue
    assert 1030 <= int(r["min_weight_kg"]) <= 1374
    assert 657 <= int(r["energy_per_stint_mj"]) <= 923
    if r["class"] == "Hypercar":
        assert 480 <= int(r["max_power_kw"]) <= 520
        if "curve_kw" in extra:
            assert len(extra["curve_kw"]) == len(extra["curve_axis"]) == 20
            assert max(extra["curve_kw"]) == int(r["max_power_kw"])
    else:
        assert r["year"] != "2023" and r["max_power_kw"] == ""
        assert extra["curve_id"].startswith("P") and extra["speed_break_kmh"] == 200
for y, e in events:
    subset = [r for r in rows if (r["year"], r["event"]) == (y, e)]
    assert Counter(json.loads(r["other"])["record"] for r in subset
                   if r["class"] == "Event") == {"circuit_map": 1, "track_limits": 1}
print("Snapshot checks passed")
```
