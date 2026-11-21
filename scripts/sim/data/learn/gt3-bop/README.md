# GT3 BoP bulletins: IGTC and NLS SP9 (W13, measured lookup)

Signed official settings extracted by ChatGPT compute W13 (2026-11-19), reviewed by Claude 2026-11-21. Copied unchanged from the W13
hand-back (`enhancements/otherbop/`), so they replay their extraction at 0.000 %.

- `igtc-weights.csv` (149 rows): IGTC Bathurst 2024–2026, Suzuka 2025–2026. Base BoP mass, and where printed crew ballast and final mass.
- `nls-weights.csv` (147 rows): NLS SP9 2023–2026; 91 latest located settings, 56 superseded (`scope`).
- Each row keeps its **scope**: race-day versions, pre-race / practice-qualifying versions and superseded sheets are separate rows
  (`scope`, `status`, `doc`). Use only the version whose scope matches the session.
- `press-only-not-official.csv`: press-reported race changes (2025 Suzuka). Not official: never use them in a lookup or a gate.
- `event-coverage.csv`: the 27 investigated events, including the 8 WEC LMGT3 and 4 IGTC rounds that stay without a signed setting
  (WEC 2026 publishes no model BoP mass).

W13 coverage: signed settings for 205 of 253 GT3 meetings (81.0 %). Checks: W13 replayed a hash-ranked 10 % sample (30/30 cells match the
PDFs); Claude re-read NLS 2023-04-01 Rev 1 (organiser PDF): 11/11 GT3 masses match.
Sources: intercontinentalgtchallenge.com bulletins, teilnehmer.vln.de technical bulletins (URL, page and SHA-256 per row).
