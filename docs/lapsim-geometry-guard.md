# Geometry source guard — 2026-11-10

Owner decision: choose the latest zero-rain qualifying session per track. A missing weather record is not evidence of zero rain. F1 entries in wet-sessions.json veto a source. With no eligible source, retain the existing record and warn with the track and source session; a new track without a dry source is skipped. Do not abort other tracks.

Existing sources are reused without rebuilding their geometry. The three owner-deferred records (Las Vegas 9854, Montreal 11287, Zandvoort 11349) remain fixed pending separate model experiments. New geometry stores its projection settings. Legacy projection settings come from docs/lapsim-geometry.md, generated 2026-11-07: sigma 7, POS_K 0.4, SIGMA_MIN 3. The fetch step obtains full geometry positions and matching-year corners for the selected source, including an older retained source. Retained traces use the stored source, original driver count and original projection settings; tuning flags cannot move that projection.

| Track | Current source | Rain observations | Latest verified zero-rain alternative | Source fastest classified lap / nearby dry pole | Assessment |
|---|---|---|---|---|---|
| Interlagos | 9865 / 2025 | 0/82 (0%) | 9865 / 2025 | — | Retained; newer 11408 has 106/160 rain observations (66.25%) |
| Las Vegas | 9854 / 2025 | 34/85 (40%) | 9640 / 2024, 0/98 rain | 107.934 s / 92.312 s (2024), 92.726 s (2023) | 16.92% slower than 2024: not dry-pole pace; retained only by owner hold |
| Montreal | 11287 / 2026 | 1/76 (1.32%) | 9959 / 2025, 0/85 rain | 72.578 s / 70.899 s (2025) | 2.37% slower; dry-like pace is plausible, but the 2026 car-rule change prevents a firm inference |
| Zandvoort | 11349 / 2026 | 5/77 (6.49%) | 9916 / 2025, 0/78 rain | 71.163 s / 68.662 s (2025), 69.673 s (2024) | 3.64% slower than 2025; dry-like pace is plausible, not proof of a wholly dry session |

Sources: OpenF1 weather and session_result endpoints, queried 2026-11-10. Fastest classified lap means the minimum finite qualifying segment duration in session_result, not an unfiltered telemetry lap (which may include deleted laps). Pole comparisons use the winner's Q3 time. Weather classification is for the entire session, never inferred from these lap comparisons.

- https://api.openf1.org/v1/weather?session_key=11408
- https://api.openf1.org/v1/weather?session_key=9865
- https://api.openf1.org/v1/weather?session_key=9854
- https://api.openf1.org/v1/weather?session_key=11287
- https://api.openf1.org/v1/weather?session_key=11349
- https://api.openf1.org/v1/weather?session_key=9640
- https://api.openf1.org/v1/weather?session_key=9959
- https://api.openf1.org/v1/weather?session_key=9916
- https://api.openf1.org/v1/session_result?session_key=9854
- https://api.openf1.org/v1/session_result?session_key=9640
- https://api.openf1.org/v1/session_result?session_key=9314
- https://api.openf1.org/v1/session_result?session_key=11287
- https://api.openf1.org/v1/session_result?session_key=9959
- https://api.openf1.org/v1/session_result?session_key=11349
- https://api.openf1.org/v1/session_result?session_key=9916
- https://api.openf1.org/v1/session_result?session_key=9578

Validation: six tests pass, including the three requested source cases, missing weather/manual exclusions, the three deferred tracks, and an integration test of the builder with all 26 current source identities. The generated geometry module is byte-identical (SHA-256 fe67d1ecf2a4c151f35f98e3da334d835881904ffb4ebda24488983952cee5eb). This is a source-selection/retention fixture, not a claim that all raw telemetry was downloaded and rebuilt. No production geometry or calibration file is changed.

The existing workflow would select wet Interlagos 11408 without this guard. It writes a refresh branch for review, not directly to main. This PR does not change or trigger that workflow.
