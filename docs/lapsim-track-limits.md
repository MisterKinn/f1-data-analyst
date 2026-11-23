# LapSim track-limit catalogue (step 4a)

Data only. No lap uses it yet: step 4b turns it into a usable width.
Data: `worker/lapsim/track-limits-data.js` (`lapsimTrackLimits`), built by `scripts/sim/track-limits.mjs`.
Pre-registration: Project `claude/gate-track-limits-catalogue-prereg-2026-11-23.md`; ledger line 2026-11-23 "4a".

## What one entry holds

`{track, year, series, event, status, corners:[{turn, letter?, rule, text}], allCorners, generalRule, unparsed, doc:{title,url,published}, raw}`

- `rule` per corner, read from the text only (never from drawings):
  - `line`: white or yellow line is the edge (also when the section says "the white lines define the track edges" and
    the corner is named without its own mechanism, e.g. the last-corner "lap and next lap" clause);
  - `kerb`: the kerb is the limit ("cutting behind the kerb", "passes completely to the left of the apex kerb",
    IMSA "two wheels ... including painted curbing");
  - `loop`: a detection loop judges it;
  - `other`: a rejoin route, bollard, escape road or a corner named with no stated mechanism.
  One record per corner; the most specific rule named for it wins (loop > kerb > line > other).
- `allCorners`: the section states a rule for the whole lap (F1 "white lines define the track edges", IMSA "two wheels
  must remain on the racing surface"). `generalRule` says which.
- `unparsed`: a sentence in the section that names a place but no turn number (pit exit lines, "the final corner").
- `raw`: the section text the corners were read from (F1), or the track-limit lines of the briefing (IMSA).
- `status`: `parsed` (corners or an all-corners rule read), `unparsed` (document found, nothing read), `no document`.

## Sources

- **F1:** FIA Race Director's Event Notes (2019–2025) and Competition Notes (2026), section "Track Limits", highest
  version per event. Event pages from fia.com through `worker/fia.js`. 159 track-events on the 26 simulator F1 tracks.
- **IMSA (WeatherTech):** driver-briefing slides ("IWSC ... Briefing ...pdf") on the public Al Kamel notice board
  `imsa.results.alkamelcloud.com/Results_NoticeBoard/`. Slide titles like "TRACK LIMITS – TURN 1" name the corners; the
  rule comes only from a stated bullet. 67 track-events on 14 simulator tracks. 2026: no notice-board season folder yet.
- **WEC:** FIA WEC publishes "Briefing Notes" per event on its notice board (fiawec.alkamelsystems.com). The board is a
  web app; the PDFs are not reachable as plain files from our tools, and the Al Kamel result manifests used by
  `worker/wec.js` contain no track-limit documents (checked 2025 Losail and Imola). Public search shows the notes exist
  for 2025–2026 events (for example Le Mans: chicane cuts at MP3 and MP35 count as track limits; Fuji: a slide on
  T10–T12). Not parsed: **no machine-readable public source** here. Nothing was filled from memory or news.

## Coverage

Cells: `P n` = parsed with n named corners (`+` = also an all-corners rule), `U` = document found but nothing parsed,
`N` = event held but no document found, `–` = no event at this track that year. Two events in one year (Austrian +
Styrian GP, British + 70th Anniversary GP, Bahrain + Sakhir GP) are shown as `a / b`.

### F1 (FIA notes)

| Track | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| austin | P 2 | – | P 4 | P 0+ | P 1+ | P 1+ | P 1+ | P 1 |
| baku | U | – | U | P 0+ | P 0+ | P 0+ | P 0+ | U |
| catalunya | U | P 6 | P 6 | P 3+ | P 3+ | P 3+ | P 4+ | P 1 |
| hungaroring | U | P 3 | P 3 | P 0+ | P 0+ | P 1+ | P 1+ | P 1 |
| imola | – | P 3 | P 4 | P 0+ | – | P 0+ | P 0+ | – |
| interlagos | U | – | P 1 | P 0+ | P 0+ | P 0+ | P 0+ | U |
| jeddah | – | – | – | U | P 0+ | P 0+ | P 0+ | – |
| kuala-lumpur | – | – | – | – | – | – | – | P 1 |
| las-vegas | – | – | – | – | P 1+ | P 1+ | P 1+ | P 1 |
| lusail | – | – | P 3 | – | P 1+ | P 1+ | P 1+ | – |
| madring | – | – | – | – | – | – | – | P 1 |
| melbourne | N | U | – | U | P 0+ | P 0+ | P 0+ | P 0+ |
| mexico-city | P 5 | – | P 7 | P 3+ | P 1+ | P 3+ | P 4+ | P 4 |
| miami | – | – | – | P 0+ | P 0+ | P 0+ | P 0+ | P 1 |
| monte-carlo | U | – | P 2 | P 2 | P 0+ | P 0+ | P 0+ | U |
| montreal | U | – | – | P 2+ | P 4+ | P 4+ | P 3+ | P 4 |
| monza | P 4 | P 4 | P 4 | P 3+ | P 0+ | P 0+ | P 1+ | P 1 |
| sakhir | U | P 1 / P 2 | P 1 | P 0+ | P 0+ | P 1+ | P 1+ | – |
| shanghai | U | – | – | – | – | P 0+ | P 0+ | U |
| silverstone | U | P 2 | P 2 | P 1+ | P 1+ | P 1+ | P 1+ | P 1 |
| singapore | P 3 | – | – | P 2+ | P 0+ | P 0+ | P 5+ | P 5 |
| spa-francorchamps | P 1 | P 6 | P 5 | P 0+ | P 0+ | P 0+ | P 1+ | P 1 |
| spielberg | U | P 2 / P 3 | P 2 / P 2 | P 1+ | P 1+ | P 1+ | P 1+ | P 1 |
| suzuka | U | – | – | P 0+ | P 0+ | N | P 0+ | P 1 |
| yas-marina-circuit | P 3 | P 4 | P 4 | P 1+ | P 1+ | P 1+ | P 1+ | – |
| zandvoort | – | – | P 5 | P 0+ | P 0+ | P 0+ | P 0+ | U |

Totals: 159 track-events; parsed 137 (86 %), unparsed 20, no document 2. 210 named corner records.

Why `U`: 2019 notes (11 of 18) and a few later notes have no "Track limits" heading and no "track limit" phrase in their
extracted text (where their corner rules sit was not checked); Shanghai 2026 only defines the pit-exit line. Four 2023 entries were read again from an earlier run of the
same documents after a throttled read returned no text (same URLs).

### IMSA (WeatherTech driver briefings)

| Track | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|
| daytona | U | – | U | P 1 | P 1 | P 1 | P 1 | – |
| detroit | – | – | – | – | – | U | U | – |
| indianapolis | – | – | – | – | P 1+ | P 1 | P 1+ | – |
| laguna-seca | – | – | P 0+ | P 0+ | P 2+ | P 3+ | P 0+ | – |
| lime-rock | U | – | P 0+ | P 0+ | P 0+ | – | – | – |
| long-beach | U | – | P 0+ | U | U | U | U | – |
| mid-ohio | U | U | U | U | – | – | – | – |
| mosport | – | – | – | P 2+ | P 2+ | P 2+ | P 1 | – |
| road-america | – | P 0+ | P 0+ | P 0+ | P 1+ | P 1+ | P 1+ | – |
| road-atlanta | U | N / P 0+ | P 0+ | P 0+ | P 0+ | U | U | – |
| sebring | U | U / P 0+ | P 0+ | P 0+ | P 0+ | P 0+ | P 0+ | – |
| vir | – | – | P 0+ | P 0+ | P 0+ | P 0+ | P 0+ | – |
| watkins-glen | N | – | P 4+ | P 5+ | P 5+ | P 5+ | P 4+ | – |

Totals: 67 track-events; parsed 46 (69 %, most only the all-corners "two wheels" rule), unparsed 19 (slides are
images, or the turn is only in a drawing), no document 2. 45 named corner records.

### WEC

| Series | Years | Status |
|---|---|---|
| WEC | 2019–2026 | no machine-readable public source (briefing notes exist on the FIA WEC notice board app; not parsed) |

## Parse check (10 events by hand, then two hold-outs)

Each event's PDF was read independently (web text of the same PDF) and compared with the stored corners, rules and the
all-corners flag. Record = one corner record or the all-corners flag. Errors: missing or extra corner, wrong rule.

| Parse | Events | Records | Errors | Rate |
|---|---|---|---|---|
| A: first full run (pre-registered check, 10 events: Spielberg 2020, Silverstone 2021, Spa 2022, Jeddah 2023, Monaco 2024, Catalunya 2025, Singapore 2025, Las Vegas 2025, Austin 2024, Mexico City 2026) | 10 | 31 | 6 | 19 % |
| B: after fixing A's errors, on 5 unseen events (Spa 2020, Hungaroring 2021, Mexico City 2022, Montreal 2023, Singapore 2026) | 5 | 26 | 4 | 15 % |
| C: after fixing B's errors, on 4 unseen events (Imola 2021, Austin 2021, Lusail 2021, Monza 2022) | 4 | 18 | 1 | 6 % |

A's errors: loop rules read as `other` (lettered sub-items not split), duplicate records per corner, kerb-cut rejoin
rules read as `other`. B's errors: an escape road read as `line`, a section heading range ("Turn 1-2-3") given the kerb
rule. C's one doubt: Lusail 2021 may state the kerb rule for "each corner" exit (flag not set). The final parser (C)
gets all 19 checked events right except that flag. IMSA: Watkins Glen 2025 matches the public slide text (T1, T8, T10
kerb; T5 short cut).

## Where a limit most likely cuts the racing line

Tracks with corners named again and again with an edge rule (line, kerb or loop), 2022–2026 (F1 + IMSA):

| Track | Corners (rule, times named) |
|---|---|
| Montreal | T9 kerb (5), T14 kerb (4), T13 kerb (2); rejoin rules T1, T2 |
| Watkins Glen (IMSA) | T1, T8, T10 kerb (4 each); short cut T5 |
| Mexico City | T11 kerb (5), T17 line (2); rejoin T4–T6 |
| Singapore | T2 kerb (3), T18 and T19 line (2) |
| Mosport (IMSA) | T1 kerb (4), T2 kerb (3) |
| Red Bull Ring | T10 exit line (5); 2020–2021 T9 and T10 exit loop or kerb |
| Silverstone | T18 line (5); 2020–2021 T9 and T15 exit kerb |
| Yas Marina, COTA, Las Vegas | last corner line (T16, T20, T17; 4 each) |

Plus every F1 track since 2022: the white line is the edge at all corners (`allCorners`).

## Re-run

`node scripts/sim/track-limits.mjs` (network; `TL_YEARS`, `TL_SERIES=f1,imsa`), or `--reparse` to re-read the stored
section text after a parser change. fia.com throttles fast reads (HTTP 429): the script waits and retries.
