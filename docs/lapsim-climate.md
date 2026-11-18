# Typical weather when a car is picked (/simulation)

Owner rule (2026-11-18): the season and the weather follow the car's real event.

1. **Real session.** A car with a real session at this track keeps that session's weather (TracingInsights for F1, Al Kamel and Timing71 for the other series). Nothing changes for these cars.
2. **Typical weather.** A car without a real session here (a future round, a projected car, or a series that has not raced here) gets the typical weather of its series at this track, from ERA5 2016–2025 (W4, ChatGPT compute 2026-11-18, reviewed by Claude):
   - the documented session slot of that series here (month and local hour, values [p10, p50, p90]). The month comes from this series' event in the race calendar. Without one, a known usual month is used (Bahrain GP: March), else the month with most documented hours. The hour comes from the official qualifying start in the session schedule, else the race start, else the first hour of the documented block. A 24-hour race covers the whole day, so it gets 14:00, labelled "hour assumed".
   - else the month × hour grid cell (p50) of the series' calendar event here, labelled "typical month and hour".
   - a series that never races here uses the slot of the main series that does (F1, WEC, IMSA, FE, … in that order), with that series named on the page.
   - a track with no series slot and no calendar event (17 club and national circuits) uses a summer afternoon (July, or January south of the equator, 14:00), labelled assumed.
3. **Manual mode** still overrides everything.

The page shows the p50 values in the sliders, the p10–p90 air temperature band, the rain probability (share of hours with rain in that slot) and the source tag. Track temperature uses the existing fitted rule `air + 4.806 °C + 0.01776 × shortwave` (held-out ±3.97 °C, `tracktemp-data.js`).

**Error, not corrected.** ERA5 vs the F1 trackside sensor (28,065 minute pairs, 172 weekends): air −1.02 ± 0.14 °C bias, RMS 2.25 °C. The page shows this as the error. No correction is applied, because none has passed a gate.

**Future sessions.** The presets hold only percentiles over ten years: no dated value of any session, so a future, postponed or cancelled session never shows archive weather (`tests/lapsim-climate.test.mjs`).

**Rwanda.** W4 has no coordinates for it and the site has no track centre (the owner's 5.302 km diagram has no geographic anchor), so the page says "climate not available" and keeps the old fallback.

Coverage: 99 of 100 menu tracks, 147 presets. Every track × car on the menu gets a tagged source: 1,389 real sessions, the rest typical presets.

First view, before → after (server render / first compute / HTML): Sakhir F1 86 → 96 ms / 56 → 58 ms / 523 → 529 KB; Monza 77 → 71 / 58 → 61 / 522 → 524; Le Mans LMH 59 → 56 / 64 → 44 / 874 → 875; Las Vegas 70 → 75 / 40 → 40 / 539 → 542. Only the selected track's presets are embedded; the change is within run-to-run noise.

Build: `node scripts/sim/climate.mjs` (input `.cache/gpt-2026-11-18/w4-climatology.json`, git-ignored) writes `worker/lapsim/climate-data.js` (34 KB).

Sources: ERA5 hourly reanalysis via the [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api). Contains modified Copernicus Climate Change Service information (ERA5), via Open-Meteo, CC BY 4.0. Session clocks: TracingInsights, Al Kamel, official timetables (W4 report).
