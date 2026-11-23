# Race-week weather forecast (/simulation, step 8)

Pre-registration: Project doc `claude/gate-forecast-prereg-2026-11-23.md`; ledger line 2026-11-23 "step 8" (diag, no model change).

## What the page does

- For a car with **no real session at this track** (an upcoming round), the weather panel shows the forecast for each calendar
  session at this track that starts **within the next 7 days** (`worker/session-schedule.js`), next to the ERA5 typical-weather line.
  This car's series and its qualifying are picked first; other sessions are in the menu.
- A **past session never gets a forecast**: a car with a real session keeps its trackside weather, and a session that has started, or
  whose event or session is marked cancelled or postponed, is skipped (`upcomingSessions`, `tests/lapsim-forecast.test.mjs`).
- Shown: air, estimated track temperature, humidity, pressure, wind, rain probability, the model, its issue time (the model run time
  from Open-Meteo's `meta.json`), whether 15-minute data were used, the ERA5 p10–p90 air band, and the **climate** error (ERA5 vs trackside
  sensor: air −1.02 °C bias, RMS 2.25 °C). No forecast error is shown until the log below has data.
- **"Run on forecast"** puts that session's values into the existing weather input (`pressureHpa, airTempC, humidityPct, windSpeed,
  windFromDeg, trackTempC`) and runs the lap. The default lap is unchanged (real session, else the W10 fallback): the forecast is a
  user choice, like manual mode, and makes no accuracy claim.
- If the forecast cannot be read, the page says so and keeps the climate preset.

## Source

- Open-Meteo forecast API, `models=best_match`, hourly `temperature_2m, relative_humidity_2m, surface_pressure, wind_speed_10m,
  wind_direction_10m, shortwave_radiation, precipitation_probability`, plus `minutely_15` where the model has native 15-minute data.
- **Model named:** best_match does not say which model it used, so `bestMatchModel(lat, lon)` follows Open-Meteo's own best_match routing
  (open-meteo `ForecastapiController.swift`, commit of 2026-11-22): KNMI (NL/BE box), MET Nordic, UKMO UK 2 km, DWD ICON-D2, Météo-France
  AROME France HD, DMI, NOAA HRRR CONUS, JMA MSM, else global models. The regional boxes are the rectangles of that code (ICON-D2 and HRRR:
  their grid extents), so a track near a domain edge may be named one model off.
- **HRRR:** Open-Meteo marks NCEP HRRR CONUS discontinued from 2026-11-30. Nothing depends on it: best_match falls back by itself (RRFS),
  and the label says "RRFS from 2026-11-30".
- **Track temperature** is estimated with the fitted rule of `tracktemp-data.js`: air + 4.806 °C + 0.01776 × shortwave (held-out ±3.97 °C).
- Model per track today: Sakhir, Jeddah, Melbourne, Shanghai, Catalunya, Baku, Singapore, Mexico City, Interlagos, Lusail, Yas Marina,
  Madring, Kuala Lumpur: global models; Imola, Monte-Carlo, Spielberg, Hungaroring, Monza: ICON-D2 (15 min); Spa, Zandvoort: KNMI;
  Silverstone: UKMO 2 km; Miami, Montreal, Austin, Las Vegas: NOAA HRRR / RRFS (15 min); Suzuka: JMA MSM. Tracks without coordinates in
  `track-coords.js` get no forecast.

## Server, cache, limits

- The browser calls only `/api/lapsim/forecast?track=<id>`; the server reads Open-Meteo. No call from the browser to Open-Meteo.
- Cache: `published-cache.js` (BUCKET read-through), key per track and UTC hour, TTL 1 h. So at most one forecast call (+ one `meta.json`)
  per track and hour, and only for tracks with a session in the next 7 days (today: Lusail). Worst case 26 tracks × 24 h × 2 = 1,248 calls a
  day; the free tier allows < 10,000 a day, 5,000 an hour, 600 a minute (open-meteo.com/en/terms, checked 2026-11-23).
- The free tier is **non-commercial only**; the data are CC BY 4.0. Attribution on the page: "Weather data by Open-Meteo.com (CC BY 4.0)",
  as for the ERA5 presets (docs/lapsim-climate.md).
- The forecast loads after the first view, so the stored first view is unchanged.

## Verification log (diagnostic only)

`scripts/sim/forecast-log.mjs`, hourly (`.github/workflows/forecast-log.yml`): up to 6 h before a session the forecast for its start is
stored once in `scripts/sim/data/forecast-log.json` (model, issue time, lead time) and never changed; 2 h after the start the trackside
sensor mean over the session is added (F1: OpenF1 weather; WEC / Al Kamel: not yet). RMS and bias per model, shown when a model has
≥ 5 sessions. It never changes a real lap, the fit, the shown ± or a gate.

<!-- forecast-log:start -->
No session verified yet.
<!-- forecast-log:end -->
