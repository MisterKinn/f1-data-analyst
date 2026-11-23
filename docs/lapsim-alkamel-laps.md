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
698 files (manifest: scripts/sim/data/learn/alkamel-full-laps-manifest.json).

| Season | Series | Event | Class | Sessions | Race cars | Race file rows (all classes) | Weather |
|---|---|---|---|---|---|---|---|
| 2023 | elms | BARCELONA-CATALUNYA | LMGTE | 5 | 10 | 4935 | yes |
| 2023 | elms | BARCELONA-CATALUNYA | LMP2 | 4 | 7 | 4935 | yes |
| 2023 | elms | BARCELONA-CATALUNYA | LMP2 Pro/Am | 5 | 11 | 4935 | yes |
| 2023 | elms | BARCELONA-CATALUNYA | LMP3 | 5 | 11 | 4935 | yes |
| 2023 | elms | CIRCUITO MOTORLAND ARAGON | LMGTE | 5 | 12 | 4487 | yes |
| 2023 | elms | CIRCUITO MOTORLAND ARAGON | LMP2 | 4 | 8 | 4487 | yes |
| 2023 | elms | CIRCUITO MOTORLAND ARAGON | LMP2 Pro/Am | 5 | 10 | 4487 | yes |
| 2023 | elms | CIRCUITO MOTORLAND ARAGON | LMP3 | 5 | 12 | 4487 | yes |
| 2023 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMGTE | 5 | – | – | yes |
| 2023 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP2 | 5 | – | – | yes |
| 2023 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP2 Pro/Am | 5 | – | – | yes |
| 2023 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP3 | 5 | – | – | yes |
| 2023 | elms | PAUL RICARD | LMGTE | 5 | 12 | 5082 | yes |
| 2023 | elms | PAUL RICARD | LMP2 | 3 | 7 | 5082 | yes |
| 2023 | elms | PAUL RICARD | LMP2 Pro/Am | 6 | 11 | 5082 | yes |
| 2023 | elms | PAUL RICARD | LMP3 | 5 | 12 | 5082 | yes |
| 2023 | elms | SPA FRANCORCHAMPS | LMGTE | 5 | 12 | 3158 | yes |
| 2023 | elms | SPA FRANCORCHAMPS | LMP2 | 4 | 7 | 3158 | yes |
| 2023 | elms | SPA FRANCORCHAMPS | LMP2 Pro/Am | 5 | 10 | 3158 | yes |
| 2023 | elms | SPA FRANCORCHAMPS | LMP3 | 5 | 11 | 3158 | yes |
| 2023 | imsa | Daytona International Speedway | GTD | 5 | 23 | 39736 | yes |
| 2023 | imsa | Daytona International Speedway | GTDPRO | 5 | 10 | 39736 | yes |
| 2023 | imsa | Daytona International Speedway | GTP | 6 | 9 | 39736 | yes |
| 2023 | imsa | Daytona International Speedway | LMP2 | 5 | 10 | 39736 | yes |
| 2023 | imsa | Daytona International Speedway | LMP3 | 5 | 9 | 39736 | yes |
| 2023 | wec | AUTODROMO DO ALGARVE | HYPERCAR | 5 | 11 | 7596 | yes |
| 2023 | wec | AUTODROMO DO ALGARVE | LMGTE Am | 5 | 14 | 7596 | yes |
| 2023 | wec | AUTODROMO DO ALGARVE | LMP2 | 5 | 12 | 7596 | yes |
| 2023 | wec | AUTODROMO NAZIONALE DI MONZA | HYPERCAR | 5 | 13 | 6390 | yes |
| 2023 | wec | AUTODROMO NAZIONALE DI MONZA | LMGTE Am | 5 | 12 | 6390 | yes |
| 2023 | wec | AUTODROMO NAZIONALE DI MONZA | LMP2 | 5 | 11 | 6390 | yes |
| 2023 | wec | BAHRAIN INTERNATIONAL CIRCUIT | HYPERCAR | 5 | 12 | 8455 | yes |
| 2023 | wec | BAHRAIN INTERNATIONAL CIRCUIT | LMGTE Am | 5 | 13 | 8455 | yes |
| 2023 | wec | BAHRAIN INTERNATIONAL CIRCUIT | LMP2 | 5 | 11 | 8455 | yes |
| 2023 | wec | FUJI SPEEDWAY | HYPERCAR | 5 | 12 | 7774 | yes |
| 2023 | wec | FUJI SPEEDWAY | LMGTE Am | 5 | 13 | 7774 | yes |
| 2023 | wec | FUJI SPEEDWAY | LMP2 | 5 | 11 | 7774 | yes |
| 2023 | wec | LE MANS | HYPERCAR | 8 | 16 | 15030 | yes |
| 2023 | wec | LE MANS | INNOVATIVE CAR | 7 | 1 | 15030 | yes |
| 2023 | wec | LE MANS | LMGTE Am | 8 | 21 | 15030 | yes |
| 2023 | wec | LE MANS | LMP2 | 8 | 24 | 15030 | yes |
| 2023 | wec | SEBRING | HYPERCAR | 5 | 11 | 7417 | yes |
| 2023 | wec | SEBRING | LMGTE Am | 5 | 13 | 7417 | yes |
| 2023 | wec | SEBRING | LMP2 | 5 | 12 | 7417 | yes |
| 2023 | wec | SPA FRANCORCHAMPS | HYPERCAR | 5 | 13 | 4817 | yes |
| 2023 | wec | SPA FRANCORCHAMPS | LMGTE Am | 5 | 13 | 4817 | yes |
| 2023 | wec | SPA FRANCORCHAMPS | LMP2 | 5 | 11 | 4817 | yes |
| 2024 | elms | AUTODROMO DO ALGARVE | LMGT3 | 5 | 10 | 5027 | yes |
| 2024 | elms | AUTODROMO DO ALGARVE | LMP2 | 4 | 14 | 5027 | yes |
| 2024 | elms | AUTODROMO DO ALGARVE | LMP2 Pro/Am | 5 | 8 | 5027 | yes |
| 2024 | elms | AUTODROMO DO ALGARVE | LMP3 | 5 | 10 | 5027 | yes |
| 2024 | elms | BARCELONA-CATALUNYA | LMGT3 | 5 | 11 | 5471 | yes |
| 2024 | elms | BARCELONA-CATALUNYA | LMP2 | 4 | 14 | 5471 | yes |
| 2024 | elms | BARCELONA-CATALUNYA | LMP2 Pro/Am | 5 | 8 | 5471 | yes |
| 2024 | elms | BARCELONA-CATALUNYA | LMP3 | 5 | 10 | 5471 | yes |
| 2024 | elms | IMOLA | LMGT3 | 5 | 11 | 5373 | yes |
| 2024 | elms | IMOLA | LMP2 | 4 | 14 | 5373 | yes |
| 2024 | elms | IMOLA | LMP2 Pro/Am | 5 | 8 | 5373 | yes |
| 2024 | elms | IMOLA | LMP3 | 5 | 10 | 5373 | yes |
| 2024 | elms | MUGELLO | LMGT3 | 5 | 11 | 4399 | yes |
| 2024 | elms | MUGELLO | LMP2 | 4 | 14 | 4399 | yes |
| 2024 | elms | MUGELLO | LMP2 Pro/Am | 5 | 8 | 4399 | yes |
| 2024 | elms | MUGELLO | LMP3 | 5 | 10 | 4399 | yes |
| 2024 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMGT3 | 5 | – | – | yes |
| 2024 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP2 | 5 | – | – | yes |
| 2024 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP2 Pro/Am | 5 | – | – | yes |
| 2024 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP3 | 5 | – | – | yes |
| 2024 | elms | PAUL RICARD | LMGT3 | 5 | 11 | 4959 | yes |
| 2024 | elms | PAUL RICARD | LMP2 | 4 | 14 | 4959 | yes |
| 2024 | elms | PAUL RICARD | LMP2 Pro/Am | 5 | 8 | 4959 | yes |
| 2024 | elms | PAUL RICARD | LMP3 | 5 | 10 | 4959 | yes |
| 2024 | elms | SPA FRANCORCHAMPS | LMGT3 | 5 | 11 | 3562 | yes |
| 2024 | elms | SPA FRANCORCHAMPS | LMP2 | 4 | 14 | 3562 | yes |
| 2024 | elms | SPA FRANCORCHAMPS | LMP2 Pro/Am | 5 | 8 | 3562 | yes |
| 2024 | elms | SPA FRANCORCHAMPS | LMP3 | 5 | 10 | 3562 | yes |
| 2024 | imsa | Daytona International Speedway | GTD | 10 | 23 | 36628 | yes |
| 2024 | imsa | Daytona International Speedway | GTDPRO | 10 | 13 | 36628 | yes |
| 2024 | imsa | Daytona International Speedway | GTP | 10 | 10 | 36628 | yes |
| 2024 | imsa | Daytona International Speedway | LMP2 | 10 | 13 | 36628 | yes |
| 2024 | wec | BAHRAIN INTERNATIONAL CIRCUIT | HYPERCAR | 6 | 18 | 7486 | yes |
| 2024 | wec | BAHRAIN INTERNATIONAL CIRCUIT | LMGT3 | 6 | 18 | 7486 | yes |
| 2024 | wec | CIRCUIT OF THE AMERICAS | HYPERCAR | 6 | 18 | 5675 | yes |
| 2024 | wec | CIRCUIT OF THE AMERICAS | LMGT3 | 6 | 18 | 5675 | yes |
| 2024 | wec | FUJI SPEEDWAY | HYPERCAR | 6 | 18 | 7042 | yes |
| 2024 | wec | FUJI SPEEDWAY | LMGT3 | 6 | 18 | 7042 | yes |
| 2024 | wec | IMOLA | HYPERCAR | 6 | 19 | 6825 | yes |
| 2024 | wec | IMOLA | LMGT3 | 6 | 18 | 6825 | yes |
| 2024 | wec | LE MANS | HYPERCAR | 8 | 23 | 15593 | yes |
| 2024 | wec | LE MANS | LMGT3 | 8 | 23 | 15593 | yes |
| 2024 | wec | LE MANS | LMP2 | 8 | 16 | 15593 | yes |
| 2024 | wec | LOSAIL | HYPERCAR | 6 | 19 | 11211 | yes |
| 2024 | wec | LOSAIL | LMGT3 | 6 | 18 | 11211 | yes |
| 2024 | wec | SAO PAULO | HYPERCAR | 6 | 19 | 7796 | yes |
| 2024 | wec | SAO PAULO | LMGT3 | 6 | 17 | 7796 | yes |
| 2024 | wec | SPA FRANCORCHAMPS | HYPERCAR | 6 | 19 | 4410 | yes |
| 2024 | wec | SPA FRANCORCHAMPS | LMGT3 | 6 | 18 | 4410 | yes |
| 2025 | elms | AUTODROMO DO ALGARVE | LMGT3 | 5 | 13 | 5093 | yes |
| 2025 | elms | AUTODROMO DO ALGARVE | LMP2 | 4 | 12 | 5093 | yes |
| 2025 | elms | AUTODROMO DO ALGARVE | LMP2 Pro/Am | 5 | 8 | 5093 | yes |
| 2025 | elms | AUTODROMO DO ALGARVE | LMP3 | 5 | 10 | 5093 | yes |
| 2025 | elms | BARCELONA-CATALUNYA | LMGT3 | 5 | 13 | 5386 | yes |
| 2025 | elms | BARCELONA-CATALUNYA | LMP2 | 4 | 13 | 5386 | yes |
| 2025 | elms | BARCELONA-CATALUNYA | LMP2 Pro/Am | 5 | 8 | 5386 | yes |
| 2025 | elms | BARCELONA-CATALUNYA | LMP3 | 5 | 10 | 5386 | yes |
| 2025 | elms | IMOLA | LMGT3 | 5 | 13 | 4773 | yes |
| 2025 | elms | IMOLA | LMP2 | 4 | 13 | 4773 | yes |
| 2025 | elms | IMOLA | LMP2 Pro/Am | 5 | 8 | 4773 | yes |
| 2025 | elms | IMOLA | LMP3 | 5 | 10 | 4773 | yes |
| 2025 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMGT3 | 5 | – | – | yes |
| 2025 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP2 | 5 | – | – | yes |
| 2025 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP2 Pro/Am | 5 | – | – | yes |
| 2025 | elms | OFFICIAL TEST - BARCELONA-CATALUNYA | LMP3 | 5 | – | – | yes |
| 2025 | elms | PAUL RICARD | LMGT3 | 5 | 13 | 4209 | yes |
| 2025 | elms | PAUL RICARD | LMP2 | 4 | 13 | 4209 | yes |
| 2025 | elms | PAUL RICARD | LMP2 Pro/Am | 5 | 8 | 4209 | yes |
| 2025 | elms | PAUL RICARD | LMP3 | 5 | 10 | 4209 | yes |
| 2025 | elms | SILVERSTONE | LMGT3 | 5 | 13 | 3984 | yes |
| 2025 | elms | SILVERSTONE | LMP2 | 4 | 13 | 3984 | yes |
| 2025 | elms | SILVERSTONE | LMP2 Pro/Am | 5 | 8 | 3984 | yes |
| 2025 | elms | SILVERSTONE | LMP3 | 5 | 10 | 3984 | yes |
| 2025 | elms | SPA FRANCORCHAMPS | LMGT3 | 5 | 13 | 3524 | yes |
| 2025 | elms | SPA FRANCORCHAMPS | LMP2 | 4 | 13 | 3524 | yes |
| 2025 | elms | SPA FRANCORCHAMPS | LMP2 Pro/Am | 5 | 8 | 3524 | yes |
| 2025 | elms | SPA FRANCORCHAMPS | LMP3 | 5 | 10 | 3524 | yes |
| 2025 | imsa | Daytona International Speedway | GTD | 5 | 22 | 37885 | yes |
| 2025 | imsa | Daytona International Speedway | GTDPRO | 5 | 15 | 37885 | yes |
| 2025 | imsa | Daytona International Speedway | GTP | 5 | 12 | 37885 | yes |
| 2025 | imsa | Daytona International Speedway | LMP2 | 5 | 12 | 37885 | yes |
| 2025 | wec | BAHRAIN INTERNATIONAL CIRCUIT | HYPERCAR | 6 | 18 | 7795 | yes |
| 2025 | wec | BAHRAIN INTERNATIONAL CIRCUIT | LMGT3 | 6 | 18 | 7795 | yes |
| 2025 | wec | CIRCUIT OF THE AMERICAS | HYPERCAR | 6 | 18 | 3964 | yes |
| 2025 | wec | CIRCUIT OF THE AMERICAS | LMGT3 | 6 | 18 | 3964 | yes |
| 2025 | wec | FUJI SPEEDWAY | HYPERCAR | 6 | 18 | 6683 | yes |
| 2025 | wec | FUJI SPEEDWAY | LMGT3 | 6 | 18 | 6683 | yes |
| 2025 | wec | IMOLA | HYPERCAR | 6 | 18 | 7044 | yes |
| 2025 | wec | IMOLA | LMGT3 | 6 | 18 | 7044 | yes |
| 2025 | wec | LE MANS | HYPERCAR | 9 | 21 | 20182 | yes |
| 2025 | wec | LE MANS | LMGT3 | 9 | 24 | 20182 | yes |
| 2025 | wec | LE MANS | LMP2 | 9 | 17 | 20182 | yes |
| 2025 | wec | LOSAIL | HYPERCAR | 6 | 18 | 9696 | yes |
| 2025 | wec | LOSAIL | LMGT3 | 6 | 18 | 9696 | yes |
| 2025 | wec | SAO PAULO | HYPERCAR | 6 | 18 | 7930 | yes |
| 2025 | wec | SAO PAULO | LMGT3 | 6 | 18 | 7930 | yes |
| 2025 | wec | SPA FRANCORCHAMPS | HYPERCAR | 6 | 18 | 4630 | yes |
| 2025 | wec | SPA FRANCORCHAMPS | LMGT3 | 6 | 18 | 4630 | yes |
<!-- coverage:end -->
