# Official-document tables (FIA F1 and FIA WEC), snapshot 2026-11-24

Raw tables compiled from official FIA and Al Kamel documents (each row cites the PDF URL and physical page).
**Data only. Nothing in the simulator or the fit reads these files yet.** A value enters the model only through a
separate, reviewed change that checks at least 3 rows per document type against the PDFs.

| File | What | Rows | Handoff (how to re-collect) |
|---|---|---:|---|
| `f1-2026-power-unit-information.csv` | 2026 FIA "Power Unit Information" sheets: recharge MJ per session, MGU-K curves (Base / Rev 1 / Alt), alternative sectors, power-drop, reset, higher-speed thresholds, power-limited distance and rate. Filter `applies_to_session = 1` | 1,490 | `handoff-f1-2026-power-unit-information.md` |
| `f1-2026-energy-limits-summary.csv` | Earlier one-row-per-session summary of the same sheets (21 events) | 81 | (same) |
| `f1-low-drag-zones-2022-2026.csv` | DRS zones 2022–25 (detection, activation) and 2026 Straight Mode zones (normal and low grip start; no end point in the FIA maps) | 350 | `handoff-f1-low-drag-zones.md` |
| `f1-drs-zones-2022-2025.csv` | Earlier DRS-only table with year-to-year change notes | 207 | (same) |
| `f1-circuit-changes-track-limits-2022-2026.csv` | Race Director event/competition notes: resurfacing, kerbs, layout, barriers, track limits | 648 | `handoff-f1-circuit-changes-track-limits.md` |
| `wec-bop-2023-2026.csv` | WEC Hypercar and LMGT3 BoP per event and model, plus circuit-map and track-limit records. 2026 BoP not public (blank) | 524 | `handoff-wec-bop.md` |
| `wec-timing-lines-2023-2025.csv` | Al Kamel sector ends (sourced), speed traps, mini-loops (unverified) | 344 | — |

Notes
- Positions are as printed (e.g. "250 m after Turn 5" or FIA lap-distance windows). Do not convert or clip them here.
- Values marked approximate/plotted (2026 Rev 1 and Alt 2 curves) or `estimated` must not be used as measured data.
- Collected by an external assistant on 2026-11-24 and reviewed by the central session
  (`claude/review-external-inputs-2026-11-24.md` in the claude.ai Project). Re-collection scripts are in the handoffs.
