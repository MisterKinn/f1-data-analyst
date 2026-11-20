# Learning tracks and cars from onboard videos (model / learned from video)

Session D, started 2026-11-21. Video files never go into git; only derived numbers do, and every number here is labelled
"model / learned from video".

- `pole-lap-index.json`: the owner's pole-lap onboard index (19 Nov 2026), one row per link: series, year, round, event, track id
  (`resolveTrack`), class, car, driver, URL, host (official / YouTube / third-party). Status "listed, not watched".
- `hud_ocr.py`: reads a data overlay (speed, gear, rpm, throttle and brake bars) frame by frame with Tesseract. The crop boxes fit the
  720×1280 "Car #98" GT3 overlay; a new overlay needs new boxes.
- `macau-gt3-98.json`: first video, Macau Guia Circuit, GT3 #98 onboard, 10 Hz trace by time with GPS distance and a quality block.

Pipeline plan (Task 1): watch-video frames → overlay OCR (or speed from the broadcast graphic) → lap clock → track distance from
corner landmarks and the official lap time → speed trace per lap with a quality score. Validate first on F1 laps that also have
TracingInsights telemetry (km/h RMS, braking point m); use it for WEC/GT3/FE geometry checks and car fits only if it passes.

## First result: Macau seam kink (fixed in scripts/sim/build-geometry-extra.mjs)

The video showed ~210 km/h at the start line; the model braked to 117 km/h there. The integrated centre line of extra tracks did not
close (3.6 m at Macau) and the least-curvature line turned the gap into an S-bend (R 58 m) at the seam. Gaps over 3 m are now closed
(Macau, Portimão, Detroit, Yongin, Rwanda, Lausitz). Gate G on the extra-track check rows: 165 rows, 101 events,
RMS 2.460 % → 2.404 %, gain +0.371 ± 0.174 pp², pass. ✗ Detroit IMSA 2025 −0.87, 2026 −0.58, 2024 −0.21 pp².
