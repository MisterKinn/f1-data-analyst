## Handoff

**Snapshot: 24 November 2026, Korea time.** The CSV covers 113 held Grands Prix and includes two upcoming rounds so the next run can fill them. There are 350 rows. 345 have status `document`. The 2026 maps identify 68 Straight Mode zones at 20 venues. Monaco explicitly gives Straight Mode as N/A. Each zone has a normal- and low-grip entry. The FIA maps give activation positions. I found no fixed end position in those maps for the 130 usable zone/grip combinations. A low-grip activation is a second start.

| Year | Held events | Upcoming | CSV rows | Unit counted |
|---|---:|---:|---:|---|
| 2022 | 22 | 0 | 53 | DRS activation in one published layout, including both Melbourne layouts |
| 2023 | 22 | 0 | 50 | DRS activation |
| 2024 | 24 | 0 | 54 | DRS activation |
| 2025 | 24 | 0 | 54 | DRS activation |
| 2026 | 21 | 2 | 139 | 136 zone/grip rows, one documented zero-zone event, two pending events |

### Read the CSV

- `event map` gives the published geometry. Permission to use the wing can change during a session. A named session attached to a grip declaration means the session bulletin recorded that declaration, sometimes before green light. A declaration alone does not prove a driver opened a wing. The message table below gives the clock time and source.
- In a DRS row the first point is the detector and the second is the opening line. Several opening lines can share a detector. Melbourne, Montréal, Budapest, Mexico City and Singapore provide examples. Keep the FIA zone numbering for each revision.
- In a Straight Mode row the first point is the opening line for the stated condition. `not found` in the end column means no fixed end distance was verified. `N/A` means the FIA explicitly marks that condition unavailable. A blank zone plus an explicit N/A means zero zones. An empty zone on an upcoming event means a map is pending.
- `status=document` identifies a published, page-cited geometry or an explicit N/A. A 2026 row can have a documented start and an unresolved end. `status=not found` identifies an upcoming event or a DRS pair with an unresolved field. The other field is retained when it could be identified. The reference column names the anchor used for each offset. Offsets are in metres. A corner apex, corner entry, pit exit, control line, marshal light panel or safety-car line retains its own meaning.
- The 207 late-weekend historical DRS rows start from the earlier FIA page transcriptions for this project. I reopened the cited PDFs or checked alternate copies and event listings. Some drawings expose only their cover text to search. Those transcriptions have less independent verification than machine-readable legends. Five late-revision URLs could not be reopened in this pass. They are identified in the CSV and below. All geometry citations point to FIA publications. I did not transfer a value from another year.

### Find the indexes

Use the following annual decision-document indexes. The next table gives the exact event-level URLs consulted, including unsuccessful lookups. The FIA site can serve a 200 response with an unrelated season when it ignores a filter. Require the event title and local event dates from the PDF cover. The accompanying timing indexes give an independent route to the map or Grand Prix preview.

| Season | Decision-document index |
|---|---|
| 2022 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005>) |
| 2023 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042>) |
| 2024 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043>) |
| 2025 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071>) |
| 2026 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072>) |

Read `a[href]` inside the matching event group. Match labels with `(?i)\bcircuit\s+map\b|remov(?:e|ing)\s+DRS\s+zone|race\s+director.{0,3}s?\s+(event|competition)\s+notes`. Also inspect links named `Event Notes`, `Competition Notes`, `Circuit Map`, `Race Control Messages` and `Grand Prix Preview`. In the timing archive, the usual sections are **Circuit Information**, **FIA Communications** and individual session headings under **Timing Information**. When an event group has several formulae, require the Formula One heading and competition dates. The enclosing FIA round document takes precedence over a support-series copy.

**Document number and revisions.** Use `(?i)\bdoc(?:ument)?\.?\s*(\d+)\b` in the listing or on the PDF cover. A document number is local to a Grand Prix. A map has no fixed document number. Strip the optional `Doc 6 -` prefix only for title matching. Use `(?i)\b(?:v(?:ersion)?\s*\.?\s*\d+|rev(?:ised|ision)?\s*\d*|corrected|recalled|withdrawn)\b` after turning filename underscores into spaces. Preserve the original filename and href. Sort by publication timestamp, then compare the cover, map version and effective session. Skip recalled files when applying changes. Store their identities for the audit. A timing-sheet revision such as `v01` belongs to that session. A map footer version belongs to its drawing. A revised pit-lane drawing in the same bundle does not by itself revise the DRS or Straight Mode coordinates.

### PDF routes and event manifest

Observed URL families are listed below. The authoritative download address is the href or the exact `source_url` in the CSV. Guessing the address from the event name can return a different document.

```text
https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-{year}-{season_id}/event/{percent_encoded_event_label}
https://www.fia.com/events/fia-formula-one-world-championship/season-{year}/{event_web_slug}/eventtiming-information
https://www.fia.com/sites/default/files/decision-document/{year}%20{case_sensitive_event}%20-%20{case_sensitive_title}.pdf
https://www.fia.com/system/files/decision-document/{year}_{event_slug}_-_{doc_slug}.pdf
https://www.fia.com/sites/default/files/doc_{number}_-_{year}_{event_slug}_-_{doc_slug}.pdf
https://www.fia.com/sites/default/files/{year}_{event_slug}_-_{doc_slug}.pdf
https://www.fia.com/sites/default/files/{year}_{round:02d}_{fia_code}_f1_{session_code}_timing_{session_file_stem}racecontrolmessages_v{revision:02d}.pdf
```

The event token is the prefix from the selected attachment where available. For legacy mixed-case filenames it is printed exactly as decoded. The slug for a future event is a search key. The CSV has the full source URL. In the index column, **archive lookup** means the event list did not yield an identifiable circuit-map entry in this pass. A successfully read PDF can still document this event. Timing indexes marked **lookup** did not yield usable links. The final column records the map listing's revision history and the published time as displayed by the FIA, including its time-zone label. Publication of a bundle can follow the issue date printed on the map.

| Year | Grand Prix | Event token in map filename | Event listing | Timing listing | Map postings |
|---:|---|---|---|---|---|
| 2022 | Bahrain | `Bahrain` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Bahrain%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/bahrain-grand-prix/eventtiming-information>) | map · 16.03.22 10:51 CET |
| 2022 | Saudi Arabian | `Saudi Arabian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Saudi%20Arabian%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/saudi-arabian-grand-prix/eventtiming-information>) | map · 23.03.22 14:05 CET |
| 2022 | Australian | `Australian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Australian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/australian-grand-prix/eventtiming-information>) | V2 · 09.04.22 05:35 CET<br>map · 06.04.22 01:52 CET |
| 2022 | Emilia Romagna | `Emilia Romagna Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Emilia%20Romagna%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/emilia-romagna-grand-prix/eventtiming-information>) | v2 · 21.04.22 12:35 CET<br>map · 20.04.22 14:58 CET |
| 2022 | Miami | `Miami Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Miami%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/miami-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2022 | Spanish | `Spanish Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Spanish%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/spanish-grand-prix/eventtiming-information>) | v2 · 19.05.22 13:36 CET<br>map · 18.05.22 12:03 CET |
| 2022 | Monaco | `Monaco Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Monaco%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/monaco-grand-prix/eventtiming-information>) | map · 25.05.22 11:51 CET |
| 2022 | Azerbaijan | `Azerbaijan Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Azerbaijan%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/azerbaijan-grand-prix/eventtiming-information>) | v2 · 10.06.22 10:11 CET<br>map · 08.06.22 10:16 CET |
| 2022 | Canadian | `Canadian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Canadian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/canadian-grand-prix/eventtiming-information>) | v2 · 16.06.22 19:07 CET<br>map · 15.06.22 16:11 CET |
| 2022 | British | `british_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/British%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/british-grand-prix/eventtiming-information>) | v2 · 30.06.22 14:56 CET<br>map · 29.06.22 12:01 CET |
| 2022 | Austrian | `austrian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Austrian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/austrian-grand-prix/eventtiming-information>) | v2 · 07.07.22 11:22 CET<br>map · 06.07.22 12:31 CET |
| 2022 | French | `French Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/French%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/french-grand-prix/eventtiming-information>) | v2 · 21.07.22 13:01 CET<br>map · 20.07.22 12:51 CET |
| 2022 | Hungarian | `Hungarian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Hungarian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/hungarian-grand-prix/eventtiming-information>) | map · 27.07.22 09:47 CET |
| 2022 | Belgian | `Belgian Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Belgian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/belgian-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2022 | Dutch | `Dutch Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Dutch%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/dutch-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2022 | Italian | `Italian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Italian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/italian-grand-prix/eventtiming-information>) | v2 · 08.09.22 11:26 CET<br>map · 07.09.22 11:21 CET |
| 2022 | Singapore | `Singapore Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Singapore%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/singapore-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2022 | Japanese | `Japanese Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Japanese%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/japanese-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2022 | United States | `United States Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/United%20States%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/united-states-grand-prix/eventtiming-information>) | v2 · 20.10.22 19:42 CET<br>map · 19.10.22 19:46 CET |
| 2022 | Mexico City | `Mexican Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Mexico%20City%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/mexico-city-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2022 | São Paulo | `Brazilian Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/S%C3%A3o%20Paulo%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/sao-paulo-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2022 | Abu Dhabi | `Abu Dhabi Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Abu%20Dhabi%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2022/abu-dhabi-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2023 | Bahrain | `Bahrain Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Bahrain%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/bahrain-grand-prix/eventtiming-information>) | map · 01.03.23 09:45 CET |
| 2023 | Saudi Arabian | `Saudi Arabian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Saudi%20Arabian%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/saudi-arabian-grand-prix/eventtiming-information>) | V4 · 17.03.23 15:12 CET<br>V3 · 17.03.23 14:14 CET<br>v2 · 17.03.23 10:30 CET<br>map · 15.03.23 14:31 CET |
| 2023 | Australian | `Australian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Australian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/australian-grand-prix/eventtiming-information>) | map · 30.03.23 01:46 CET |
| 2023 | Azerbaijan | `Azerbaijan Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Azerbaijan%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/azerbaijan-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2023 | Miami | `Miami Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Miami%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/miami-grand-prix/eventtiming-information>) | map · 04.05.23 17:18 CET |
| 2023 | Monaco | `Monaco Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Monaco%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/monaco-grand-prix/eventtiming-information>) | map · 24.05.23 16:17 CET |
| 2023 | Spanish | `Spanish Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Spanish%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/spanish-grand-prix/eventtiming-information>) | map · 01.06.23 11:32 CET |
| 2023 | Canadian | `Canadian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Canadian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/canadian-grand-prix/eventtiming-information>) | map · 15.06.23 17:02 CET |
| 2023 | Austrian | `Austrian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Austrian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/austrian-grand-prix/eventtiming-information>) | map · 29.06.23 12:45 CET |
| 2023 | British | `British Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/British%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/british-grand-prix/eventtiming-information>) | map · 06.07.23 13:01 CET |
| 2023 | Hungarian | `Hungarian Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Hungarian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/hungarian-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2023 | Belgian | `Belgian Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Belgian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/belgian-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2023 | Dutch | `Dutch Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Dutch%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/dutch-grand-prix/eventtiming-information>) | map · 24.08.23 13:40 CET |
| 2023 | Italian | `Italian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Italian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/italian-grand-prix/eventtiming-information>) | map · 31.08.23 11:25 CET |
| 2023 | Singapore | `Singapore Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Singapore%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/singapore-grand-prix/eventtiming-information>) | map · 14.09.23 10:51 CET |
| 2023 | Japanese | `Japanese Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Japanese%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/japanese-grand-prix/eventtiming-information>) | map · 21.09.23 05:16 CET |
| 2023 | Qatar | `Qatar Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Qatar%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/qatar-grand-prix/eventtiming-information>) | V2 · 06.10.23 13:51 CET<br>map · 05.10.23 20:38 CET |
| 2023 | United States | `United States Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/United%20States%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/united-states-grand-prix/eventtiming-information>) | map · 19.10.23 18:51 CET |
| 2023 | Mexico City | `Mexico City Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Mexico%20City%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/mexico-city-grand-prix/eventtiming-information>) | map · 26.10.23 19:45 CET |
| 2023 | São Paulo | `São Paulo Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/S%C3%A3o%20Paulo%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/sao-paulo-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2023 | Las Vegas | `Las Vegas Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Las%20Vegas%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/las-vegas-grand-prix/eventtiming-information>) | V3 · 18.11.23 04:10 CET<br>V2 · 17.11.23 04:22 CET<br>map · 16.11.23 07:26 CET |
| 2023 | Abu Dhabi | `Abu Dhabi Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Abu%20Dhabi%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2023/abu-dhabi-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2024 | Bahrain | `Bahrain Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Bahrain%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/bahrain-grand-prix/eventtiming-information>) | map · 28.02.24 12:45 CET |
| 2024 | Saudi Arabian | `Saudi Arabian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Saudi%20Arabian%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/saudi-arabian-grand-prix/eventtiming-information>) | map · 06.03.24 14:30 CET |
| 2024 | Australian | `Australian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Australian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/australian-grand-prix/eventtiming-information>) | map · 21.03.24 05:16 CET |
| 2024 | Japanese | `Japanese Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Japanese%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/japanese-grand-prix/eventtiming-information>) | map · 04.04.24 10:22 CET |
| 2024 | Chinese | `Chinese Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Chinese%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/chinese-grand-prix/eventtiming-information>) | map · 18.04.24 12:19 CET |
| 2024 | Miami | `Miami Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Miami%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/miami-grand-prix/eventtiming-information>) | map · 02.05.24 20:30 CET |
| 2024 | Emilia Romagna | `emilia_romagna_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Emilia%20Romagna%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/emilia-romagna-grand-prix/eventtiming-information>) | map · 16.05.24 14:30 CET |
| 2024 | Monaco | `Monaco Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Monaco%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/monaco-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2024 | Canadian | `Canadian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Canadian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/canadian-grand-prix/eventtiming-information>) | map · 06.06.24 23:54 CET |
| 2024 | Spanish | `Spanish Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Spanish%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/spanish-grand-prix/eventtiming-information>) | Doc 12 V2 · 21.06.24 13:00 CET<br>Doc 3 map · 20.06.24 15:17 CET |
| 2024 | Austrian | `Austrian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Austrian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/austrian-grand-prix/eventtiming-information>) | Doc 3 map · 27.06.24 16:32 CET |
| 2024 | British | `British Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/British%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/british-grand-prix/eventtiming-information>) | Doc 4 map · 04.07.24 16:14 CET |
| 2024 | Hungarian | `Hungarian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Hungarian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/hungarian-grand-prix/eventtiming-information>) | Doc 3 map · 18.07.24 15:40 CET |
| 2024 | Belgian | `Belgian Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Belgian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/belgian-grand-prix/eventtiming-information>) | Doc 8 V2 · 26.07.24 10:15 CET<br>Doc 3 map · 25.07.24 17:15 CET |
| 2024 | Dutch | `Dutch Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Dutch%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/dutch-grand-prix/eventtiming-information>) | Doc 4 map · 22.08.24 20:23 CET |
| 2024 | Italian | `Italian Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Italian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/italian-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2024 | Azerbaijan | `Azerbaijan Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Azerbaijan%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/azerbaijan-grand-prix/eventtiming-information>) | Doc 12 V2 · 13.09.24 10:24 CET<br>Doc 4 map · 12.09.24 14:51 CET |
| 2024 | Singapore | `Singapore Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Singapore%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/singapore-grand-prix/eventtiming-information>) | Doc 4 map · 19.09.24 15:26 CET |
| 2024 | United States | `United States Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/United%20States%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/united-states-grand-prix/eventtiming-information>) | Doc 4 map · 17.10.24 21:20 CET |
| 2024 | Mexico City | `Mexico City Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Mexico%20City%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/mexico-city-grand-prix/eventtiming-information>) | Doc 4 map · 24.10.24 19:39 CET |
| 2024 | São Paulo | `São Paulo Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/S%C3%A3o%20Paulo%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/sao-paulo-grand-prix/eventtiming-information>) | Doc 4 map · 31.10.24 18:28 CET |
| 2024 | Las Vegas | `Las Vegas Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Las%20Vegas%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/las-vegas-grand-prix/eventtiming-information>) | Doc 9 map · 22.11.24 03:27 CET |
| 2024 | Qatar | `Qatar Grand Prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Qatar%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/qatar-grand-prix/eventtiming-information>) | Doc 4 map · 28.11.24 20:31 CET |
| 2024 | Abu Dhabi | `Abu Dhabi Grand Prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Abu%20Dhabi%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2024/abu-dhabi-grand-prix/eventtiming-information>) | See season index / PDF cover |
| 2025 | Australian | `australian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Australian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/australian-grand-prix/eventtiming-information>) | Doc 5 map · 13.03.25 09:54 CET |
| 2025 | Chinese | `chinese_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Chinese%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/chinese-grand-prix/eventtiming-information>) | Doc 8 map · 21.03.25 00:44 CET |
| 2025 | Japanese | `japanese_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Japanese%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/japanese-grand-prix/eventtiming-information>) | Doc 5 map · 03.04.25 12:33 CET |
| 2025 | Bahrain | `bahrain_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Bahrain%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/bahrain-grand-prix/eventtiming-information>) | Doc 6 V4 · 11.04.25 09:29 CET<br>Doc 5 map · 10.04.25 17:32 CET |
| 2025 | Saudi Arabian | `saudi_arabian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Saudi%20Arabian%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/saudi-arabian-grand-prix/eventtiming-information>) | Doc 4 map · 18.04.25 08:39 CET |
| 2025 | Miami | `miami_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Miami%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/miami-grand-prix/eventtiming-information>) | Doc 5 map · 01.05.25 23:58 CET |
| 2025 | Emilia Romagna | `emilia_romagna_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Emilia%20Romagna%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/emilia-romagna-grand-prix/eventtiming-information>) | map · 15.05.25 19:51 CET |
| 2025 | Monaco | `monaco_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Monaco%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/monaco-grand-prix/eventtiming-information>) | map · 22.05.25 19:31 CET |
| 2025 | Spanish | `spanish_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Spanish%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/spanish-grand-prix/eventtiming-information>) | map · 29.05.25 17:55 CET |
| 2025 | Canadian | `canadian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Canadian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/canadian-grand-prix/eventtiming-information>) | Doc 5 map · 13.06.25 00:34 CET |
| 2025 | Austrian | `austrian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Austrian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/austrian-grand-prix/eventtiming-information>) | Doc 6 map · 26.06.25 19:19 CET |
| 2025 | British | `british_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/British%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/british-grand-prix/eventtiming-information>) | Doc 6 V2 · 03.07.25 20:18 CET<br>Doc 4 map · 03.07.25 19:24 CET |
| 2025 | Belgian | `belgian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Belgian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/belgian-grand-prix/eventtiming-information>) | Doc 4 map · 24.07.25 19:13 CET |
| 2025 | Hungarian | `hungarian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Hungarian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/hungarian-grand-prix/eventtiming-information>) | Doc 4 map · 31.07.25 19:17 CET |
| 2025 | Dutch | `dutch_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Dutch%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/dutch-grand-prix/eventtiming-information>) | Doc 3 map · 28.08.25 17:02 CET |
| 2025 | Italian | `italian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Italian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/italian-grand-prix/eventtiming-information>) | Doc 5 map · 04.09.25 18:54 CET |
| 2025 | Azerbaijan | `azerbaijan_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Azerbaijan%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/azerbaijan-grand-prix/eventtiming-information>) | Doc 5 map · 18.09.25 17:40 CET |
| 2025 | Singapore | `singapore_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Singapore%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/singapore-grand-prix/eventtiming-information>) | Doc 7 map · 02.10.25 16:11 CET |
| 2025 | United States | `united_states_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/United%20States%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/united-states-grand-prix/eventtiming-information>) | Doc 4 map · 17.10.25 00:41 CET |
| 2025 | Mexico City | `mexico_city_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Mexico%20City%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/mexico-city-grand-prix/eventtiming-information>) | Doc 3 map · 24.10.25 01:21 CET |
| 2025 | São Paulo | `sao_paulo_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/S%C3%A3o%20Paulo%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/sao-paulo-grand-prix/eventtiming-information>) | Doc 5 map · 06.11.25 22:30 CET |
| 2025 | Las Vegas | `las_vegas_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Las%20Vegas%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/las-vegas-grand-prix/eventtiming-information>) | Doc 2 V2 · 20.11.25 06:50 CET |
| 2025 | Qatar | `qatar_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Qatar%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/qatar-grand-prix/eventtiming-information>) | Doc 4 map · 27.11.25 14:29 CET |
| 2025 | Abu Dhabi | `abu_dhabi_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Abu%20Dhabi%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2025/abu-dhabi-grand-prix/eventtiming-information>) | Doc 4 map · 04.12.25 16:27 CET |
| 2026 | Australian | `australian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Australian%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/australian-grand-prix/eventtiming-information>) | Doc 5 map · 05.03.26 07:30 CET |
| 2026 | Chinese | `chinese_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Chinese%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/chinese-grand-prix/eventtiming-information>) | Doc 7 map · 12.03.26 09:59 CET |
| 2026 | Japanese | `japanese_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Japanese%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/japanese-grand-prix/eventtiming-information>) | Doc 6 map · 26.03.26 07:52 CET |
| 2026 | Miami | `miami_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Miami%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/miami-grand-prix/eventtiming-information>) | Doc 5 map · 01.05.26 00:09 CET |
| 2026 | Canadian | `canadian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Canadian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/canadian-grand-prix/eventtiming-information>) | Doc 9 V2 · 22.05.26 15:04 CET<br>Doc 8 map · 22.05.26 00:12 CET |
| 2026 | Monaco | `monaco_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Monaco%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/monaco-grand-prix/eventtiming-information>) | Doc 7 map · 04.06.26 16:33 CET |
| 2026 | Barcelona-Catalunya | `barcelona-catalunya_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Barcelona-Catalunya%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/barcelona-catalunya-grand-prix/eventtiming-information>) | Doc 8 map · 11.06.26 17:59 CET |
| 2026 | Austrian | `austrian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Austrian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/austrian-grand-prix/eventtiming-information>) | Doc 7 map · 25.06.26 17:25 CET |
| 2026 | British | `british_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/British%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/british-grand-prix/eventtiming-information>) | Doc 6 map · 02.07.26 17:38 CET |
| 2026 | Belgian | `belgian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Belgian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/belgian-grand-prix/eventtiming-information>) | Doc 7 map · 16.07.26 17:50 CET |
| 2026 | Hungarian | `hungarian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Hungarian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/hungarian-grand-prix/eventtiming-information>) | Doc 5 map · 23.07.26 17:14 CET |
| 2026 | Dutch | `dutch_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Dutch%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/dutch-grand-prix/eventtiming-information>) | Doc 6 map · 20.08.26 16:57 CET |
| 2026 | Italian | `italian_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Italian%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/italian-grand-prix/eventtiming-information>) | Doc 6 map · 03.09.26 17:04 CET |
| 2026 | Spanish | `spanish_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Spanish%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/spanish-grand-prix/eventtiming-information>) | Doc 6 map · 10.09.26 19:25 CET |
| 2026 | Azerbaijan | `azerbaijan_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Azerbaijan%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/azerbaijan-grand-prix/eventtiming-information>) | Doc 8 map · 23.09.26 17:21 CET |
| 2026 | Bahrain Grand Prix in Malaysia | `bahrain_grand_prix_in_malaysia` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Bahrain%20Grand%20Prix%20in%20Malaysia>) · [Bahrain archive (Oct)](<https://www.fia.com/documents/cik-fia-technical-regulations-2026/event/Bahrain%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/bahrain-grand-prix/eventtiming-information>) | Doc 7 · 01.10.26 12:44 CET |
| 2026 | Singapore | `singapore_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Singapore%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/singapore-grand-prix/eventtiming-information>) | Doc 7 map · 08.10.26 15:00 CET |
| 2026 | United States | `united_states_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/United%20States%20Grand%20Prix>) | [timing lookup](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/united-states-grand-prix/eventtiming-information>) | Doc 7 map · 23.10.26 00:21 CET |
| 2026 | Mexico City | `mexico_city_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Mexico%20City%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/mexico-city-grand-prix/eventtiming-information>) | Doc 7 map · 29.10.26 23:07 CET |
| 2026 | São Paulo | `sao_paulo_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/S%C3%A3o%20Paulo%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/sao-paulo-grand-prix/eventtiming-information>) | Doc 7 map · 05.11.26 23:18 CET |
| 2026 | Las Vegas | `las_vegas_grand_prix` | [decision index](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Las%20Vegas%20Grand%20Prix>) | [timing](<https://www.fia.com/events/fia-formula-one-world-championship/season-2026/las-vegas-grand-prix/eventtiming-information>) | Doc 6 map · 19.11.26 08:16 CET |
| 2026 | Qatar | `qatar_grand_prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Qatar%20Grand%20Prix>) | — | See season index / PDF cover |
| 2026 | Abu Dhabi | `abu_dhabi_grand_prix` | [archive lookup](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Abu%20Dhabi%20Grand%20Prix>) | — | See season index / PDF cover |
### Locate and parse the geometry

Use physical PDF pages, numbered from one including the cover. The examples below identify the value-bearing page. The numbers printed inside a race director’s enclosure can start again at one. A map is a drawing with a legend, so some files have no text-table header. Read by page coordinates. Raw PDF extraction may emit every label, then every measurement, or combine adjacent Overtake and Straight Mode cells on one line.

| Document type | Page, header and parser anchor | Two worked examples |
|---|---|---|
| DRS circuit map, stand-alone or the first enclosure of Event Notes | Usually PDF p. 2. Find `Circuit Map`, then the legend labels `(?i)DRS\s*(Detection\|Activation)\s*(\d*)`. On single-zone maps the numeral can be absent. Read same-row text in the legend. Units are m, plus named points without a distance. | 2022 Bahrain Z1 has detection 50 m before T1 and activation 23 m after T3. [Bahrain p. 2](<https://www.fia.com/sites/default/files/decision-document/2022%20Bahrain%20-%20Circuit%20Map.pdf#page=2>) · 2025 Las Vegas Z2 has detection 710 m after T12 and activation 870 m **before T14**. [Las Vegas p. 2](<https://www.fia.com/system/files/decision-document/2025_las_vegas_grand_prix_-_event_notes_-_circuit_map_v2_pit_lane_drawing_emergency_map_exits_quarantine_zone_and_red_zones.pdf#page=2>) |
| Straight Mode circuit map in Competition Notes or revised map enclosure | PDF p. 2 in this snapshot. Locate `STRAIGHT MODE`, its `NORMAL GRIP ACTIVATION` and `LOW GRIP ACTIVATION` key, and the data rows `(?i)ZONE\s*A\s*(\d+)`. Read the red normal-grip and blue low-grip positions horizontally across each row. Ignore the adjacent OVERTAKE block. Units are m or a named point. | 2026 Miami A2 starts 165 m after **T8** in normal grip and reads N/A in low grip. [Miami p. 2](<https://www.fia.com/system/files/decision-document/2026_miami_grand_prix_-_competition_notes_-_circuit_map_pit_lane_drawing_emergency_exits_map_and_red_zone.pdf#page=2>) · 2026 Las Vegas A1 starts 40 m after T4 in normal grip and 90 m after T4 in low grip. [Las Vegas p. 2](<https://www.fia.com/system/files/decision-document/2026_las_vegas_grand_prix_-_competition_notes_-_circuit_map_pit_lane_drawing_emergency_exits_map_and_red_zone.pdf#page=2>) |
| Race Director’s note or competition notes, including session amendments | Search prose for `(?i)remov\w*\s+DRS\s+Zone\|for the remainder of the event\|Driver Adjustable Bodywork\|following any standing start`. Record effective time, affected sessions and each stated point. Follow any revised map for exact metres. | Melbourne 2022 Doc 35, PDF p. 1, removes one DRS zone, moves detection 1 and renumbers activations. The revised map has three. [removal note](<https://www.fia.com/sites/default/files/decision-document/2022%20Australian%20Grand%20Prix%20-%20Race%20Director%27s%20Note%20-%20Removing%20DRS%20Zone.pdf#page=1>) · Japan 2026, §9 on PDF p. 4, enables Straight Mode after T1 following a standing start or standing-start resumption. [Japan competition notes](<https://www.fia.com/system/files/decision-document/2026_japanese_grand_prix_-_race_directors_competition_notes_v2.pdf#page=4>) |
| Session Race Control Messages | Header `TIME MESSAGE`. Match `(?i)\b(\d{2}:\d{2})\s+(LOW\|NORMAL) GRIP CONDITIONS\b` within a row. Times are the document’s session clock. `LOW GRIP DELTA ACTIVE` is a separate message. Keep pre-session declarations and multiple switches. These reports document conditions, without proving deployment by a particular car. | Las Vegas FP1, 16:25 low grip, PDF p. 1. [FP1 bulletin](<https://www.fia.com/sites/default/files/2026_21_usa_f1_p1_timing_firstpracticesessionracecontrolmessages_v01.pdf#page=1>) · São Paulo race, 13:13 low, 14:35 normal and 15:24 low, PDF pp. 1, 2 and 5. [race bulletin](<https://www.fia.com/sites/default/files/2026_20_bra_f1_r0_timing_raceracecontrolmessages_v01.pdf>) |

For distances use `(?i)\b(\d+(?:[.,]\d+)?)\s*m(?:et(?:re|er)s?)?\s+(before|after)\s+(.+)` on the position cell only. Also accept named-only anchors, including `entry`, `exit`, `apex`, `Safety Car Line 1`, `SC2`, `TSP11`, `Panel 11`, `Pit Exit` and `control line`. Preserve qualifiers such as *before the corner exit*. The printed Event/T&S timing lines and circuit centreline length cannot convert these references to a unique distance from the start.

### Publication, sessions and exceptions

- Publish timing is empirical. Bahrain’s 2022 map appeared on Wednesday 16 March at 10:51 CET, before Friday practice. The first event notes followed on Thursday and V2 on Saturday. Las Vegas’s 2026 map was listed Thursday 19 November at 08:16 CET before local FP1. The map’s issue footer is dated 14 November. A script needs both dates. [Bahrain decision log](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Bahrain%20Grand%20Prix>) · [Las Vegas decision log](<https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Las%20Vegas%20Grand%20Prix>)
- Teams receive zone information in advance under 2026 Sporting Regulations B7.1.1(e). Issue 06 specifies at least four weeks. This is a deadline for giving information to competitors. The public PDF may appear in race week. B7.1.2 describes the race director’s power to restrict full activation in low grip. [Sporting Regulations, printed p. B61](<https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_06_-_2026-04-28.pdf>)
- From the week before FP1, inspect the event listing daily. Inspect it again before each session and after the final classification. Archive every changed file hash, even when its URL stays the same. The timestamp on an article, the circuit map footer and a race-control clock use different conventions. Keep the printed offset or time-zone label.
- Melbourne 2022 needs **two** maps. FP1/FP2 used four zones. FP3, qualifying and the race used three. The early map uses a light panel as a reference. Do not apply Saturday’s renumbering to Friday. [opening map](<https://www.fia.com/sites/default/files/decision-document/2022%20Australian%20Grand%20Prix%20-%20Circuit%20Map.pdf#page=2>) · [revised map](<https://www.fia.com/sites/default/files/decision-document/2022%20Australian%20Grand%20Prix%20-%20Race%20Director%27s%20Note%20-%20Circuit%20Map%20V2.pdf#page=2>) · [effective change](<https://www.fia.com/sites/default/files/decision-document/2022%20Australian%20Grand%20Prix%20-%20Race%20Director%27s%20Note%20-%20Removing%20DRS%20Zone.pdf>)
- Montréal 2026 has a map bundle followed by standalone V2 (Doc 9, 22 May, 15:04 CET). The CSV uses V2. Las Vegas 2026 has three zones, with A3 printed apart from the other two in the text stream. Miami A2 is **165 m after T8**. A text rendering inserted an extra “1” before the 8. The native PDF text resolves the disagreement. Barcelona-Catalunya A5 and Suzuka A3–A5 are unused template slots with N/A on both sides. Monaco’s whole Straight Mode field reads N/A, even though the legend still defines the symbol. [Montréal V2](<https://www.fia.com/system/files/decision-document/2026_canadian_grand_prix_-_competition_notes_-_circuit_map_v2.pdf#page=2>) · [Monaco](<https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_competition_notes_-_circuit_map_pit_lane_drawing_emergency_exits_map_and_red_zone.pdf#page=2>)
- The standings name and PDF token can differ. The 2022 Mexico City and São Paulo decisions use **Mexican** and **Brazilian**. Later files use **Mexico City**, **São Paulo** or ASCII **sao_paulo**. The 2022 Bahrain filename omits “Grand Prix”. **Barcelona-Catalunya** and **Spanish** designate different 2026 races (Barcelona and Madrid). The 2026 Bahrain Grand Prix took place at **Sepang, Malaysia** in October and uses **bahrain_grand_prix_in_malaysia**. The session filename code is **brn**. The April Sakhir and Saudi dates were withdrawn. [FIA venue notice](<https://admin.fia.com/news/fia-and-fom-confirm-malaysia-will-join-2026-calendar-host-venue-bahrain-grand-prix>) · [April calendar change](<https://www.fia.com/news/bahrain-and-saudi-arabian-grands-prix-will-not-take-place-april>)
- Preserve oddities in source paths, including the final underscore in the 2025 Miami PDF, `emergency_map_exits` in the 2025 Las Vegas filename, singular/plural `red_zone(s)`, accents, punctuation, hyphens and case. The 2025 Qatar listing uses “Circuit Map. Pit Lane Drawing”. Bahrain 2025 reaches V4. The 2023 Saudi Arabian listing has V2, V3 and V4. The exact published attachments are in the CSV. An unaccented URL or a generic `2023 Melbourne Event` map linked from another FIA championship is not sufficient evidence of the F1 revision.
- Five entries reuse the previous page-specific FIA transcription where this run could not reopen the late F1 PDF: 2022 Miami V4, France V2, Singapore V2, United States V2 and 2023 Australia. Some earlier versions or duplicates were accessible. Recheck those late PDFs when refreshing. For 2022 Silverstone and Spielberg the CSV supplies accessible same-revision FIA copies. For 2022 Monaco Z1 activation, 2024 Bahrain Z1 activation and 2024 Saudi Arabia Z1 detection, competing text readings remain unresolved. The CSV keeps the confirmed part and labels the pair `not found`.
- For 2026 standing-start restrictions checked separately, Melbourne, Shanghai, Suzuka and Miami specify availability after T1. This governs the start or restart of the relevant race or sprint. It does not relocate the openings for a flying lap. [Australian](<https://www.fia.com/system/files/decision-document/2026_australian_grand_prix_-_race_directors_competition_notes_v2.pdf#page=3>) · [Chinese](<https://www.fia.com/system/files/decision-document/2026_chinese_grand_prix_-_race_directors_competition_notes_v3.pdf#page=3>) · [Japanese](<https://www.fia.com/system/files/decision-document/2026_japanese_grand_prix_-_race_directors_competition_notes_v2.pdf#page=4>) · [Miami](<https://www.fia.com/system/files/decision-document/2026_miami_grand_prix_-_race_directors_competition_notes_v3.pdf#page=3>)
- Qatar and Abu Dhabi 2026 were upcoming at the cutoff. No geometry was copied from 2025. On the next run, replace the pending row when the event-specific F1 map appears. The April Sakhir date, Jeddah 2026 and Imola 2023 were not held races in this dataset.

### Session evidence

The snapshot distinguishes a published change to the geography from a change to the grip condition. The following messages are the positive evidence recovered for grip declarations. Times include pre-session tests or switches. The evidence does not establish how long a driver used the system or prove continuous use for a whole session.

| 2026 Grand Prix | Session | Local message time, condition and PDF page | Source |
|---|---|---|---|
| Miami | FP1 | 12:00 low (p. 1), 12:01 normal (p. 1), 13:38 low (p. 2), 13:39 normal (p. 2) | [FIA messages](<https://www.fia.com/sites/default/files/2026_04_usa_f1_p1_timing_firstpracticesessionracecontrolmessages_v01.pdf>) |
| Canadian | FP1 | 12:29 low (p. 1), 12:31 normal (p. 1), 13:55 low (p. 3) | [FIA messages](<https://www.fia.com/sites/default/files/2026_05_can_f1_p1_timing_firstpracticesessionracecontrolmessages_v01.pdf>) |
| Belgian | FP1 | 13:29 low (p. 1), 13:31 normal (p. 1) | [FIA messages](<https://www.fia.com/sites/default/files/2026_10_bel_f1_p1_timing_firstpracticesessionracecontrolmessages_v01.pdf>) |
| Dutch | FP1 | 12:38 normal (p. 1) | [FIA messages](<https://www.fia.com/sites/default/files/2026_12_ned_f1_p1_timing_firstpracticesessionracecontrolmessages_v01.pdf>) |
| Dutch | Race | 14:14 low (p. 1), 14:51 normal (p. 3) | [FIA messages](<https://www.fia.com/sites/default/files/2026_12_ned_f1_r0_timing_raceracecontrolmessages_v01.pdf>) |
| Bahrain Grand Prix in Malaysia | Race | 14:19 low (p. 1), 17:04 normal (p. 6) | [FIA messages](<https://www.fia.com/sites/default/files/2026_16_brn_f1_r0_timing_raceracecontrolmessages_v01.pdf>) |
| Singapore | Sprint | 16:54 low (p. 1) | [FIA messages](<https://www.fia.com/sites/default/files/2026_17_sgp_f1_s0_timing_sprintracecontrolmessages_v01.pdf>) |
| Singapore | Q | 21:16 normal (p. 1) | [FIA messages](<https://www.fia.com/sites/default/files/2026_17_sgp_f1_q0_timing_qualifyingsessionracecontrolmessages_v01.pdf>) |
| United States | FP1 | 13:31 low (p. 2), 13:37 normal (p. 3) | [FIA messages](<https://www.fia.com/sites/default/files/2026_18_usa_f1_p1_timing_firstpracticesessionracecontrolmessages_v01.pdf>) |
| São Paulo | Q | 14:52 low (p. 1) | [FIA messages](<https://www.fia.com/sites/default/files/2026_20_bra_f1_q0_timing_qualifyingsessionracecontrolmessages_v01.pdf>) |
| São Paulo | Race | 13:13 low (p. 1), 14:35 normal (p. 2), 15:24 low (p. 5) | [FIA messages](<https://www.fia.com/sites/default/files/2026_20_bra_f1_r0_timing_raceracecontrolmessages_v01.pdf>) |
| Las Vegas | FP1 | 16:25 low (p. 1) | [FIA messages](<https://www.fia.com/sites/default/files/2026_21_usa_f1_p1_timing_firstpracticesessionracecontrolmessages_v01.pdf>) |
| Las Vegas | FP2 | 19:55 low (p. 1) | [FIA messages](<https://www.fia.com/sites/default/files/2026_21_usa_f1_p2_timing_secondpracticesessionracecontrolmessages_v01.pdf>) |

The search recovered 86 of 105 session bulletins. Omission from the table means no declaration was verified, including when the bulletin was unavailable. For reruns use the exact session links on each timing page. The following bulletins still need verification:

- 2026 Monaco: FP2, FP3.
- 2026 Barcelona-Catalunya: FP3.
- 2026 British: FP1.
- 2026 Belgian: FP3.
- 2026 Italian: FP1, Q.
- 2026 Spanish: FP1.
- 2026 Azerbaijan: FP1, FP2, Race.
- 2026 Bahrain Grand Prix in Malaysia: FP2.
- 2026 United States: FP3, Q, Race.
- 2026 Mexico City: FP1, FP2, FP3, Q.

### Failure handling

1. On a missing event index, open the matching season index, expand the correct event and look for the named document. Try the event timing archive or a site-limited search for the quoted F1 event, year and document title. Verify the cover and event dates. Keep the exact URL. A web challenge, a search tool failure, a blank cover or a generic championship landing page cannot establish zero zones.
2. Extract the map page at its native rotation using word coordinates. Match normal/low-grip values by horizontal position on the same row as each A-number. On a scan or outlined text, render at 300–400 dpi, then OCR the legend separately with bounding boxes. Retain the underlying crop, the page index and source SHA-256 locally. Compare any doubtful digit to the drawing or an official same-revision copy. Reject unresolved digits. A regular expression over the entire PDF can pair an activation with a sector line or overtake detector.
3. When two files differ, compare zone identifiers, both endpoints, conditions, effective time, and attachment footer. Keep separate session intervals only if the operative geometry changed. Use a note that withdraws a zone from its stated effective time. If alternate transcriptions disagree and the intended position cannot be confirmed, emit the verified field and `not found` for the other.
4. Keep the explicit N/A cases, pending events, missing fields and failed download logs separate in downstream counts. For a 2026 renderer that requires a closed interval, do not construct a coloured sector from an unknown end.

### Repeat the search

The Python block below uses the CSV as a seed manifest. Run it beside the CSV with `requests`, `beautifulsoup4` and `pymupdf` installed. It follows published links, retains revisions and hashes the bytes. It exports positioned text and map images so a changed PDF can be compared with the previous one. It leaves the original CSV intact. Read the official cover before promoting a newly discovered candidate. This is a reference implementation; the complete live crawler was not executed end to end in this run.

```python
from collections import defaultdict
from hashlib import sha256
from pathlib import Path
from urllib.parse import urljoin, urlparse, quote, unquote
import csv, json, re, time
import requests
from bs4 import BeautifulSoup
import fitz

CSV = Path("FIA_F1_Low_Drag_Zones_2022-2026.csv")
OUT = Path("fia-zone-cache")
OUT.mkdir(exist_ok=True)
rows = list(csv.DictReader(CSV.open(encoding="utf-8-sig", newline="")))
season_ids = {2022:2005, 2023:2042, 2024:2043, 2025:2071, 2026:2072}
base = "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-"
match_title = re.compile(r"circuit\s+map|remov(?:e|ing)\s+drs\s+zone|straight[ -]mode|(?:event|competition)\s+notes|race\s+control\s+messages", re.I)
published = re.compile(r"Published\s+on\s+(\d[\d.]+\s+\d\d:\d\d\s+\w+)", re.I)
session = requests.Session()
session.headers["User-Agent"] = "FIA public archive research/1.0"
failures, manifest = [], []
events = defaultdict(list)
for row in rows:
    events[(int(row["year"]), row["event"])].append(row)

def official(url):
    h = (urlparse(url).hostname or "").lower()
    return h == "fia.com" or h.endswith(".fia.com")

def get(url):
    for attempt in range(3):
        try:
            r = session.get(url, timeout=(12, 60))
            if not official(r.url):
                raise ValueError("Unexpected redirect outside FIA")
            if r.status_code in (429, 502, 503, 504) and attempt < 2:
                delay = r.headers.get("Retry-After", "")
                time.sleep(min(60, int(delay)) if delay.isdigit() else 2 ** (attempt+1))
                continue
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

def harvest(index, event_name=None):
    soup = BeautifulSoup(get(index).content, "html.parser")
    if soup.title and re.search(r"just a moment|access denied|security check", soup.title.get_text(), re.I):
        raise RuntimeError("Index requires access verification")
    targets = []
    for a in soup.select("a[href]"):
        u = urljoin(index, a["href"])
        title = " ".join(a.stripped_strings)
        name = unquote(urlparse(u).path).replace("_", " ")
        if official(u) and name.lower().endswith(".pdf") and match_title.search(title+" "+name):
            parent = a.find_parent("li") or a.parent
            stamp = published.search(" ".join(parent.stripped_strings))
            if event_name:
                # On season pages, keep only an exact event section or an unambiguous filename.
                normalize = lambda t: re.sub(r"[^\w]+"," ",t.casefold()).strip()
                if normalize(event_name) not in normalize(name):
                    continue
            targets.append((u, title, stamp.group(1) if stamp else ""))
    return targets

for (year, event), group in events.items():
    season = base + str(year) + "-" + str(season_ids[year])
    index_name = "Bahrain Grand Prix" if "in Malaysia" in event else event
    index = season + "/event/" + quote(index_name, safe="")
    names = [index]
    web_slug = index_name.lower().replace(" ", "-").replace("ã", "a")
    names.append(f"https://www.fia.com/events/fia-formula-one-world-championship/season-{year}/{web_slug}/eventtiming-information")
    docs = {}
    for index_url in names:
        try:
            for u, title, stamp in harvest(index_url):
                docs[u] = (title, stamp, index_url)
        except Exception as exc:
            failures.append([year, event, index_url, str(exc)])
    if not docs:
        try:
            for u, title, stamp in harvest(season, index_name):
                docs[u] = (title, stamp, season)
        except Exception as exc:
            failures.append([year, event, season, str(exc)])
    for row in group:
        u = row["source_url"]
        if official(u) and urlparse(u).path.lower().endswith(".pdf"):
            docs.setdefault(u, ("Cited PDF in previous snapshot", "", "CSV"))
    if not docs:
        failures.append([year, event, index, "No event-specific PDF discovered"])
    for u, (title, stamp, origin) in docs.items():
        try:
            content = get(u).content
            if not content.startswith(b"%PDF-"):
                raise ValueError("Response is not a PDF")
            digest = sha256(content).hexdigest()
            path = OUT / (digest + ".pdf")
            if not path.exists():
                path.write_bytes(content)
            with fitz.open(stream=content, filetype="pdf") as pdf:
                candidates = []
                for page_index, page in enumerate(pdf):
                    words = page.get_text("words", sort=True)
                    body = page.get_text()
                    flag = re.search(r"DRS\s*(?:Detection|Activation)|Straight\s*Mode|Driver Adjustable Bodywork|LOW GRIP CONDITIONS|NORMAL GRIP CONDITIONS|Removing DRS Zone", body, re.I)
                    if flag or (page_index == 1 and "map" in (title+" "+unquote(u)).lower()):
                        candidates.append(page_index+1)
                        (OUT / f"{digest}-p{page_index+1}.json").write_text(json.dumps(words), encoding="utf8")
                        if page_index == 1 and "map" in (title+" "+unquote(u)).lower():
                            page.get_pixmap(dpi=300, alpha=False).save(str(OUT / f"{digest}-p2.png"))
                manifest.append(dict(year=year,event=event,title=title,url=u,listing=origin,published=stamp,
                                     sha256=digest,pages=len(pdf),candidate_pages=candidates))
        except Exception as exc:
            failures.append([year, event, u, str(exc)])
    time.sleep(0.5)
(OUT/"manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
(OUT/"failures.json").write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf8")
```

For image-only entries, run `tesseract <map-page.png> stdout -l eng --psm 11 tsv` and join labels by their bounding boxes. Repeat on the cropped legend using `--psm 6`. If PDF words are available, prefer their original coordinates. Row sorting and distinct left/right columns matter at Montréal, Budapest, Interlagos and Las Vegas. Keep the map image separate from a pit-lane or emergency-exits page headed by the same event name. If a document lists a position in the legend and marks a different landmark on the drawing, report the conflict.

### Automated validation

Use checks that distinguish repeated condition rows and revisions from the number of physical zones.

```python
from collections import Counter
from urllib.parse import urlparse

expected_columns = ["year","event","session_scope","zone","kind","start_or_detection","end_or_activation","reference","source_url","page","status"]
assert list(rows[0]) == expected_columns
key = lambda r: (r["year"], r["event"], r["session_scope"], r["kind"], r["zone"])
assert len({key(r) for r in rows}) == len(rows)
assert all(r["status"] in {"document", "not found"} for r in rows)
for r in rows:
    assert (r["kind"] == "DRS") == (int(r["year"]) <= 2025)
    if r["status"] == "document":
        assert official(r["source_url"])
        assert urlparse(r["source_url"]).path.lower().endswith(".pdf")
        assert int(r["page"]) >= 1
        if r["kind"] == "DRS":
            assert all(r[c] not in {"", "N/A", "not found"} for c in ("start_or_detection","end_or_activation"))
    for col in ("start_or_detection", "end_or_activation"):
        for magnitude in re.findall(r"(?i)\b(\d+(?:\.\d+)?)\s*m\b", r[col]):
            assert float(magnitude) >= 0
            # A large landmark offset may be real (Las Vegas has 870 m).
            if float(magnitude) > 1500:
                print("Review large offset", key(r), col, magnitude)
sm_rows = [r for r in rows if r["kind"] == "straight_mode" and r["zone"]]
pairs = Counter((r["event"],r["zone"]) for r in sm_rows)
assert all(n == 2 for n in pairs.values())  # This snapshot, one normal + one low
assert len(pairs) == 68
assert sum(r["event"] == "Monaco Grand Prix" and r["year"] == "2026" and
           r["start_or_detection"] == "N/A" and not r["zone"] for r in rows) == 1
assert Counter(r["session_scope"] for r in rows if r["event"]=="Australian Grand Prix"
               and r["year"]=="2022") == {"FP1, FP2":4, "FP3, qualifying, race":3}
assert Counter(r["year"] for r in rows) == {"2022":53,"2023":50,"2024":54,"2025":54,"2026":139}
```

These snapshot counts should change when the FIA publishes a new round or an additional effective layout. Check the source page instead of forcing new data to match an old count. Compare the number of **activation labels** with the number of physical zones in each scope. Count shared detectors once for detector inventory and once per linked activation when exporting the CSV.
