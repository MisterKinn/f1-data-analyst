# Al Kamel full lap files (step 16)

Every lap of the endurance sessions Al Kamel publishes, kept for lap-level work (WEC warm-up after a pit stop, step 15;
step 17). Data only: no lap of the simulator changes.

| What | Where |
|---|---|
| Fetch (Actions only; the workspace cannot reach Al Kamel) | `scripts/sim/learn/fetch-alkamel-full-laps.mjs`, workflow `alkamel-full-laps.yml` (monthly and by hand) |
| Raw files (gzip, one per session and file) | draft release `data-alkamel-full-laps`, asset `alkamel-full-laps.tar` → `.cache/alkamel-full-laps/<series>/<season>/<event>/<start>_<session>/{analysis,weather}.csv.gz` |
| Manifest (URL, fetch date, SHA-256, rows, columns, cars, laps per car, cars per class) | `scripts/sim/data/learn/alkamel-full-laps-manifest.json` |
| Loader | `scripts/sim/learn/alkamel-full-laps.mjs`: `sessions(manifest, filter)`, `readSession(session, dir)`, `typedLaps(rows, weather)` |
| Tests | `tests/alkamel-full-laps.test.mjs` (two invented fixtures in the Al Kamel layouts: WEC Analysis + weather, IMSA Time Cards + °F weather) |

In a workflow job:

```sh
gh release download data-alkamel-full-laps -p alkamel-full-laps.tar -D .cache && tar -xf .cache/alkamel-full-laps.tar -C .cache
```
```js
import {sessions, readSession} from './scripts/sim/learn/alkamel-full-laps.mjs';
for (const s of sessions(undefined, s => s.series === 'wec' && s.kind === 'race')) for (const lap of readSession(s)) { /* ... */ }
```

## Scope

- FIA WEC 2023–2025, every event and session of the "FIA WEC" folder (Le Mans 24 Hours, 6 Hours of Spa, the other rounds;
  practice, qualifying, Hyperpole, race). Prologue and support series are not read.
- IMSA: the Rolex 24 at Daytona (WeatherTech class only), 2023–2025.
- ELMS 2023–2025, every event (4 h races, Le Mans Cup support not read).
- **Spa 24 Hours is not on Al Kamel** (SRO timing, PDFs; read by `fetch-sro-pdf.mjs`). "Spa" in the pass check is the WEC 6 Hours.
- Endurance races publish cumulative "Hour N" folders; the last hour holds every lap and is the one kept.

## Typed lap row

| Field | Meaning |
|---|---|
| car, cls, team, manufacturer, driver, driverNumber | as printed (car number kept as text: 007 ≠ 7) |
| lap, time, sectors | lap number; lap time in s; S1–S3 in s (`Sn_SECONDS`, else `Sn`) |
| elapsed, topSpeedKph, flag | session time at the line (s); trap speed; flag at the line (GF, FCY, SC, FF …) |
| pitIn, pitOut, pitTime | lap ends in the pit lane; lap starts from the pit lane (first lap too); time in the pit lane (s) |
| stint, stintLap | stint = pit-ins before this lap + 1; lap number inside the stint |
| tyre | only when the file has a tyre or compound column (Al Kamel WEC files have none); else null |
| airTempC, trackTempC, humidityPct, rain | nearest weather row by session time (≤ 10 min, else null); IMSA °F converted to °C |

Limits: no tyre information in WEC/ELMS files; weather is matched by time from the first weather row (assumed to start with the
session); deleted laps (track limits) are not marked, use `LAP_IMPROVEMENT` logic from `fetch-alkamel-laps.mjs` if needed.

## Coverage

Written by the fetch script after every run.

<!-- coverage:start -->
Not fetched yet: run the workflow "Al Kamel full lap files".
<!-- coverage:end -->
