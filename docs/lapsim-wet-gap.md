# F1 wet and intermediate lap: measured gap to dry pace

**Model (live).** For an F1 car on intermediates or full wets, the lap is the same car's dry lap × (1 + gap/100):

| Tyre | Gap (all seasons) | Gap (trained through 2025) |
|---|---|---|
| Intermediate | +17.74% | +17.84% |
| Full wet | +28.19% | +27.87% |

The gap is the lap-weighted mean of every clean wet-tyre lap against the same car model's dry reference at the same Grand Prix (W2-F, ChatGPT compute 2026-11-18, reviewed by Claude). A past session in the measured table is replayed exactly: one car model's group mean (tool: `car_model`, `wet_season`, `wet_session`), or on the page the session's mean over every car. The page and the tool say which value they used.

The evolution curve (rubber, wetness, drying) is **not** added on top. It failed Gate G: the measured gap already carries the wet effect, so stacking them counts it twice.

WEC Hypercar and LMGT3 wet pace is **not measured**. Those cars keep the wetness formula with assumed tyre penalties, labelled "not measured".

## Gate G (same laps, one Grand Prix left out, each weekend one vote)

Errors are percentage points (pp) of the dry lap. SE is one standard error across weekends. A pass needs a gain above one paired SE.

| Comparison | Laps / weekends | Candidate MAE ± SE | Baseline MAE ± SE | Gain ± paired SE | Gate G |
|---|---|---|---|---|---|
| Constant vs site today | 11,050 / 49 | 6.718 ± 0.577 | 20.299 ± 0.820 | +13.580 ± 0.655 | pass |
| 2026 unseen (train ≤ 2025): constant vs site | 760 / 4 | 3.786 ± 1.234 | 13.910 ± 2.365 | +10.124 ± 3.308 | pass |
| Per-track offsets vs constant (W2-F) | 11,050 / 49 | 6.659 ± 0.532 | 6.718 ± 0.577 | +0.059 ± 0.214 | reject |
| Constant × evolution curve vs constant | 11,050 / 49 | 7.120 ± 0.551 | 6.718 ± 0.577 | -0.402 ± 0.143 | reject |
| Refit constant × evolution curve vs constant | 11,050 / 49 | 7.104 ± 0.555 | 6.718 ± 0.577 | -0.386 ± 0.145 | reject |
| 2026: refit × evolution vs constant | 760 / 4 | 5.612 ± 1.571 | 3.786 ± 1.234 | -1.827 ± 0.888 | reject |

"Site today" is the tool path before this change (tyre set, starting wetness 0, the tool's curve sample at or before the minute). Reproduction: `node scripts/sim/wet-gap-gate.mjs` rebuilds the 13,697 laps from TracingInsights with the W2 filters (valid time, no pit in/out, no race/sprint lap 1, not deleted or generated, accurate timing, track status all-clear, 0.055 s per remaining scheduled race lap). It matches all 928 W2-F group means (max 0.000134 pp, from the 4-decimal dry reference) and gives the W2-F scores exactly (6.718 / 3.786 pp). One 2023 Hungarian GP FP1 pit-lap fragment is removed as in W2. `node scripts/sim/wet-gap.mjs` then writes `worker/lapsim/wet-gap-data.js`.

Exact lookup: 928/928 groups replay at 0.000% (`tests/lapsim-wet-gap.test.mjs`).

## Not covered by the site comparison (122 groups, 2,647 laps)

These groups have no stored evolution curve at the live track id (`no_track_curve_at_site_id`), so W2-F left them out of the site comparison. Their measured gaps are still in the lookup, and the constant still applies there. Car model, tyre (I/W) and laps:

| Track | Season | Grand Prix | Session | Groups |
|---|---|---|---|---|
| hockenheim | 2018 | German Grand Prix | Practice 3 | C37 W (8), FW41 W (7), SF71H W (2), STR13 W (2) |
| hockenheim | 2018 | German Grand Prix | Race | C37 I (1), MCL33 I (1), STR13 W (1) |
| hockenheim | 2019 | German Grand Prix | Race | C38 I (48), FW42 I (36), FW42 W (4), MCL34 I (38), MCL34 W (1), R.S.19 I (33), RB15 I (47), RB15 W (1), RP19 I (19), RP19 W (2), SF90 I (41), STR14 I (46), VF-19 I (38), VF-19 W (3), W10 I (52), W10 W (2) |
| istanbul | 2020 | Turkish Grand Prix | Practice 3 | AT01 I (1), C39 I (2), C39 W (3), MCL35 I (1), R.S.20 I (2), R.S.20 W (1), RB16 I (3), RP20 I (1), SF1000 I (4), SF1000 W (2), W11 I (1) |
| istanbul | 2020 | Turkish Grand Prix | Qualifying | AT01 W (4), C39 W (16), MCL35 I (3), MCL35 W (5), R.S.20 I (1), R.S.20 W (16), RB16 W (14), RP20 I (2), RP20 W (12), SF1000 I (1), SF1000 W (12), W11 W (13) |
| istanbul | 2020 | Turkish Grand Prix | Race | AT01 I (68), AT01 W (12), C39 I (33), C39 W (10), FW43 I (61), MCL35 I (66), MCL35 W (14), R.S.20 I (69), R.S.20 W (13), RB16 I (57), RB16 W (17), RP20 I (66), RP20 W (13), SF1000 I (71), SF1000 W (8), VF-20 I (52), VF-20 W (9), W11 I (72), W11 W (9) |
| istanbul | 2021 | Turkish Grand Prix | Practice 3 | A521 I (11), AMR21 I (9), AT02 I (13), AT02 W (4), C41 I (13), C41 W (2), FW43B I (1), MCL35M I (11), MCL35M W (3), RB16B I (11), SF21 I (13), SF21 W (6), VF-21 I (12), VF-21 W (2), W12 I (3) |
| istanbul | 2021 | Turkish Grand Prix | Race | A521 I (104), AMR21 I (102), AT02 I (102), C41 I (103), FW43B I (101), MCL35M I (104), RB16B I (105), SF21 I (105), VF-21 I (101), W12 I (104) |
| kuala-lumpur | 2026 | Bahrain Grand Prix | Race | AMR26 I (3), FW48 I (8), MAC-26 I (3), MCL40 I (3), R26 I (6), RB22 I (8), SF-26 I (2), VCARB 03 I (8), VF-26 I (4), W17 I (8) |
| paul-ricard-f1 | 2018 | French Grand Prix | Practice 3 | FW41 W (2) |
| sochi | 2021 | Russian Grand Prix | Qualifying | A521 I (16), A521 W (1), AMR21 I (17), AT02 I (20), C41 I (7), FW43B I (12), MCL35M I (16), RB16B I (11), SF21 I (12), VF-21 I (9), W12 I (22) |
| sochi | 2021 | Russian Grand Prix | Race | A521 I (3), AMR21 I (3), AT02 I (3), C41 I (4), FW43B I (3), MCL35M I (3), RB16B I (4), SF21 I (2), VF-21 I (2), W12 I (4) |

## Sources

- Lap times: [TracingInsights](https://github.com/TracingInsights) season archives (FastF1 timing), 2018–2026.
- Method, filters and gates: W2 and W2-F reports (ChatGPT compute on upstream 9e37dee, 2026-11-18).
