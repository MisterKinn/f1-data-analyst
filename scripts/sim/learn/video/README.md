# Learning tracks and cars from onboard videos (model / learned from video)

Session D, started 2026-11-21. Video files never go into git; only derived numbers do, and every number here is labelled
"model / learned from video".

- `pole-lap-index.json`: the owner's pole-lap onboard index (19 Nov 2026), one row per link: series, year, round, event, track id
  (`resolveTrack`), class, car, driver, URL, host (official / YouTube / third-party). Status "listed, not watched".
- `hud_ocr.py`: reads a data overlay (speed, gear, rpm, throttle and brake bars) frame by frame with Tesseract. The crop boxes fit the
  720×1280 "Car #98" GT3 overlay; a new overlay needs new boxes.
- `macau-gt3-98.json`: first video, Macau Guia Circuit, 2019 FIA GT World Cup, Earl Bamber, ROWE Racing Porsche 911 GT3 R (991.2) #98 (qualifying 2:16.066; the video lap, ~139.3 s, is a slower lap of unknown session). 10 Hz trace with GPS distance and a quality block.

Pipeline plan (Task 1): watch-video frames → overlay OCR (or speed from the broadcast graphic) → lap clock → track distance from
corner landmarks and the official lap time → speed trace per lap with a quality score. Validate first on F1 laps that also have
TracingInsights telemetry (km/h RMS, braking point m); use it for WEC/GT3/FE geometry checks and car fits only if it passes.

## First result: Macau seam kink (fixed in scripts/sim/build-geometry-extra.mjs)

The video showed ~210 km/h at the start line; the model braked to 117 km/h there. The integrated centre line of extra tracks did not
close (3.6 m at Macau) and the least-curvature line turned the gap into an S-bend (R 58 m) at the seam. Gaps over 3 m are now closed
(Macau, Portimão, Detroit, Yongin, Rwanda, Lausitz). Gate G on the extra-track check rows: 165 rows, 101 events,
RMS 2.460 % → 2.404 %, gain +0.371 ± 0.174 pp², pass. ✗ Detroit IMSA 2025 −0.87, 2026 −0.58, 2024 −0.21 pp².

## WEC onboard speed from sound + gear display (2026-11-21)

- `engine_comb.py`: engine order f0(t) from the onboard sound (harmonic comb over the whitened spectrum).
- `gear_ocr.py video x0,y0,x1,y1 out.json`: gear digit on the steering-wheel or dash display (Tesseract; 7 vs 1 by the top bar).
- `gear_speed.py`: clean in-gear stretches joined by upshifts; each run takes the gear the display shows; gear ratios
  from the upshifts; speed = f0 × ratio; the lap covers the official length.
- `run_lap.py wav gear.json track lap_s official_m out [lo hi]`: finds the lap start where the speed minima land on
  the map corners (needs track JSON in `LAPSIM_TRACK_JSON`).
- `wec-onboard-speed.json`: derived numbers only (no video). Checked against Al Kamel TOP_SPEED of the same lap:
  Fuji 2025 #12 293 vs 307.7 km/h (−4.8 %), Interlagos 2026 #12 269 vs 275.5 (−2.4 %), Interlagos 2025 LMGT3 #10
  251 vs 253.7 (−1.1 %). ✗ Without a gear display (Ferrari outside camera) the gear cannot be fixed yet (Imola −17 %).
