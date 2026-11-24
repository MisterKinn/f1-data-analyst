## Handoff

**2026 season snapshot, 24 November 2026 (Korea).** The CSV covers 21 completed Grands Prix, 105 sessions and 24 FIA *Power Unit Information* notices. It contains 1,490 clause rows. Filter `applies_to_session = 1` for the 1,293 rows in force at session start. Filter `latest_event_revision = 1` for the last complete sheet issued for each event. Those selections differ for Friday practice at three events.

The calendar lists Qatar as round 22 (27–29 November) and Abu Dhabi as round 23 (4–6 December). Neither had a verified 2026 PU sheet at the cutoff. Saudi Arabia is marked called off. Bahrain was held at Sepang on 2–4 October. Pending and cancelled events have no numerical rows. [FIA season page](https://api.fia.com/events/fia-formula-one-world-championship/season-2026/2026-fia-formula-one-world-championship) · [FIA calendar, media kit §3.1](https://www.fia.com/sites/default/files/media_kit_-_azgp_2026_0.pdf)

### 1. Start from the event indexes

Use the [2026 championship decision index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072) or the [numeric season index](https://www.fia.com/documents/championships/110/2026). The event filter matters because the unfiltered HTML can show only the latest expanded round. Use the FIA event name in the index URL. The filename uses a different slug. This manifest gives the exact event index, every selected PDF, document number and publication time. All times in this table preserve the listing's literal **CET** label.

| R | Event | PDF event_slug | Listing URL | FIA document, in order | Published (DD.MM.YY HH:MM) |
|---:|---|---|---|---|---|
| 1 | Australian Grand Prix | `australian_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Australian%20Grand%20Prix) | [6](https://www.fia.com/system/files/decision-document/2026_australian_grand_prix_-_power_unit_information.pdf#page=2) | 05.03.26 07:33 |
| 2 | Chinese Grand Prix | `chinese_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Chinese%20Grand%20Prix) | [2](https://www.fia.com/system/files/decision-document/2026_chinese_grand_prix_-_power_unit_information.pdf#page=2) | 12.03.26 01:41 |
| 3 | Japanese Grand Prix | `japanese_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Japanese%20Grand%20Prix) | [4](https://www.fia.com/system/files/decision-document/2026_japanese_grand_prix_-_power_unit_information.pdf#page=2) | 26.03.26 01:49 |
| 4 | Miami Grand Prix | `miami_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Miami%20Grand%20Prix) | [7](https://www.fia.com/system/files/decision-document/2026_miami_grand_prix_-_power_unit_information.pdf#page=2) | 01.05.26 00:32 |
| 5 | Canadian Grand Prix | `canadian_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Canadian%20Grand%20Prix) | [5](https://www.fia.com/system/files/decision-document/2026_canadian_grand_prix_-_power_unit_information.pdf#page=2) | 21.05.26 16:10 |
| 6 | Monaco Grand Prix | `monaco_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Monaco%20Grand%20Prix) | [4](https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_power_unit_information.pdf#page=2) | 03.06.26 15:04 |
| 7 | Barcelona-Catalunya Grand Prix | `barcelona-catalunya_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Barcelona-Catalunya%20Grand%20Prix) | [5](https://www.fia.com/system/files/decision-document/2026_barcelona-catalunya_grand_prix_-_power_unit_information.pdf#page=2) → [31 V2](https://www.fia.com/system/files/decision-document/2026_barcelona-catalunya_grand_prix_-_power_unit_information_v2.pdf#page=2) | 11.06.26 16:32 → 13.06.26 11:12 |
| 8 | Austrian Grand Prix | `austrian_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Austrian%20Grand%20Prix) | [5](https://www.fia.com/system/files/decision-document/2026_austrian_grand_prix_-_power_unit_information.pdf#page=2) | 25.06.26 11:56 |
| 9 | British Grand Prix | `british_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/British%20Grand%20Prix) | [7](https://www.fia.com/system/files/decision-document/2026_british_grand_prix_-_power_unit_information.pdf#page=2) | 02.07.26 20:04 |
| 10 | Belgian Grand Prix | `belgian_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Belgian%20Grand%20Prix) | [4](https://www.fia.com/system/files/decision-document/2026_belgian_grand_prix_-_power_unit_information.pdf#page=2) | 16.07.26 13:17 |
| 11 | Hungarian Grand Prix | `hungarian_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Hungarian%20Grand%20Prix) | [3](https://www.fia.com/system/files/decision-document/2026_hungarian_grand_prix_-_power_unit_information.pdf#page=2) | 22.07.26 19:37 |
| 12 | Dutch Grand Prix | `dutch_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Dutch%20Grand%20Prix) | [3](https://www.fia.com/system/files/documents/doc_3_-_2026_dutch_grand_prix_-_power_unit_information.pdf#page=2) | 19.08.26 18:30 |
| 13 | Italian Grand Prix | `italian_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Italian%20Grand%20Prix) | [8](https://www.fia.com/system/files/decision-document/2026_italian_grand_prix_-_power_unit_information.pdf#page=2) | 03.09.26 20:50 |
| 14 | Spanish Grand Prix | `spanish_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Spanish%20Grand%20Prix) | [3](https://www.fia.com/system/files/decision-document/2026_spanish_grand_prix_-_power_unit_information.pdf#page=2) → [25 V2](https://www.fia.com/system/files/decision-document/2026_spanish_grand_prix_-_power_unit_information_v2.pdf#page=2) | 10.09.26 15:56 → 11.09.26 22:06 |
| 15 | Azerbaijan Grand Prix | `azerbaijan_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Azerbaijan%20Grand%20Prix) | [5](https://www.fia.com/system/files/decision-document/2026_azerbaijan_grand_prix_-_power_unit_information.pdf#page=2) | 23.09.26 16:14 |
| 16 | Bahrain Grand Prix in Malaysia | `bahrain_grand_prix_in_malaysia` | [Event index](https://www.fia.com/documents/event/Bahrain%20Grand%20Prix) | [4](https://www.fia.com/system/files/decision-document/2026_bahrain_grand_prix_in_malaysia_-_power_unit_information.pdf#page=2) | 01.10.26 06:16 |
| 17 | Singapore Grand Prix | `singapore_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Singapore%20Grand%20Prix) | [3](https://www.fia.com/system/files/decision-document/2026_singapore_grand_prix_-_power_unit_information.pdf#page=2) | 08.10.26 05:03 |
| 18 | United States Grand Prix | `united_states_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/United%20States%20Grand%20Prix) | [8](https://www.fia.com/system/files/decision-document/2026_united_states_grand_prix_-_power_unit_information.pdf#page=2) | 23.10.26 00:22 |
| 19 | Mexico City Grand Prix | `mexico_city_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Mexico%20City%20Grand%20Prix) | [6](https://www.fia.com/system/files/decision-document/2026_mexico_city_grand_prix_-_power_unit_information.pdf#page=2) | 29.10.26 22:46 |
| 20 | São Paulo Grand Prix | `sao_paulo_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/S%C3%A3o%20Paulo%20Grand%20Prix) | [3](https://www.fia.com/system/files/decision-document/2026_sao_paulo_grand_prix_-_power_unit_information.pdf#page=2) → [28 V2](https://www.fia.com/system/files/decision-document/2026_sao_paulo_grand_prix_-_power_unit_information_v2.pdf#page=2) | 05.11.26 20:23 → 07.11.26 14:04 |
| 21 | Las Vegas Grand Prix | `las_vegas_grand_prix` | [Event index](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Las%20Vegas%20Grand%20Prix) | [3](https://www.fia.com/system/files/decision-document/2026_las_vegas_grand_prix_-_power_unit_information.pdf#page=2) | 18.11.26 00:42 |

Additional event listings used for cross-checks were [Barcelona-Catalunya](https://www.fia.com/documents/event/Barcelona-Catalunya%20Grand%20Prix) and [Singapore](https://www.fia.com/documents/event/Singapore%20Grand%20Prix). The [Qatar event listing](https://www.fia.com/documents/event/Qatar%20Grand%20Prix) showed 2025 documents. The [Abu Dhabi event listing](https://www.fia.com/documents/event/Abu%20Dhabi%20Grand%20Prix) and the 2026-filtered URLs below did not yield a 2026 PU sheet. [Qatar 2026 filter](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Qatar%20Grand%20Prix) · [Abu Dhabi 2026 filter](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Abu%20Dhabi%20Grand%20Prix)

### 2. Link and version discovery

```text
Event index    https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/{URL-encoded event display name}
Short index    https://www.fia.com/documents/event/{URL-encoded event display name}
Usual PDF      https://www.fia.com/system/files/decision-document/{year}_{event_slug}_-_power_unit_information{revision_suffix}.pdf
Dutch PDF      https://www.fia.com/system/files/documents/doc_{number}_-_{year}_{event_slug}_-_power_unit_information.pdf
Suffix         empty for first public issue, _v2 for the three public revisions found here
```

Use the actual anchor href. The templates are useful for validating paths. Document numbers restart at each competition. An original can be Doc 2 through Doc 8 in this snapshot. The Dutch listing inserts the year and event between the number and title. São Paulo keeps its accent in the index and uses `sao_paulo` in the PDF. Barcelona-Catalunya keeps its hyphen. Madrid is the Spanish GP. The Bahrain listing uses “Bahrain Grand Prix” while its filename includes `in_malaysia`. The Netherlands uses the alternate directory shown above. A guessed URL that fails does not establish that the FIA withdrew a notice.

The following Python function extracts candidate notices from each manifest listing. It requires `requests` and `beautifulsoup4`. Confirm the year, event, title and document number inside each PDF before accepting it, especially with the short event index. If the HTML has only collapsed headings, select the event filter in a browser and run the same match on the rendered links.

```python
import re
from urllib.parse import unquote, urljoin, urlsplit

import requests
from bs4 import BeautifulSoup

title_rx = re.compile(
    r"^Doc\s*(\d+)\s*[-–—]\s*(?:20\d{2}\s+.+?\s*[-–—]\s*)?"
    r"Power\s+Unit\s+Information(?:\s*[-–—]?\s*V\s*0*(\d+))?$", re.I
)
def notices(listing_url, year=2026):
    response = requests.get(listing_url, timeout=30)
    response.raise_for_status()
    for anchor in BeautifulSoup(response.content, "html.parser").select("a[href]"):
        text = " ".join(anchor.stripped_strings)
        title, _, stamp = re.split(r"(?i)(Published\s+on)", text, maxsplit=1) if re.search(r"(?i)Published\s+on", text) else (text, "", "")
        match = title_rx.fullmatch(" ".join(title.split()))
        if not match:
            continue
        url = urljoin(response.url, anchor["href"])
        parts = urlsplit(url)
        if parts.hostname not in {"www.fia.com","api.fia.com","fia.com"}:
            continue
        if f"{year}_" in unquote(parts.path).lower() and parts.path.lower().endswith(".pdf"):
            yield int(match[1]), int(match[2] or 1), stamp.strip(), url
```

Skip recalled or withdrawn entries, including a recall label on the enclosing list item. Retain all other public issues, each PDF's SHA-256, its listing timestamp and its cover issue time. A version label on the cover and the listing identifies a new public issue. A suffix in the enclosure name alone is insufficient. The British Doc 7 encloses `R09_Great_Britain_Power_Unit_Information_V02.pdf` but is the single visible public notice. Madrid and São Paulo use `V02` inside their V2 covers. The Australian enclosure is `01AUS - PU Info.pdf`. The enclosure name is printed inside page 1 and is not the download path.

### 3. Extract the fields

Use one-based **physical PDF pages**. Each selected file has a one-page Race Director cover and a one-page technical sheet. Page 1 supplies identity and issue time. Page 2 supplies the values. Keep the printed sector label, square brackets, any asterisk, loop and TBC flag. Distances in the sector tables are FIA lap-distance windows in metres. Do not convert them to corner-apex distances.

| Page / block | Parser anchor and fields | Two real checks |
|---|---|---|
| 1 · Cover | Match `Document\s+(\d+)`, `Title\s+Power\s+Unit\s+Information`, Date, Time and Enclosed. | Australia Doc 6, issued 5 March at 17:28. São Paulo Doc 28, issued 7 November at 10:03, title V2. |
| 2 · Competition information | Match `ROUND No\.\s*R(\d+)`, VENUE, CENTRELINE (km), FORMAT. | Melbourne R01, 5.278 km, Standard. Singapore R17, 4.927 km, Alternative (Sprint weekend). |
| 2 · C5.2.10 | Under the maximum recharge heading, match `([\d.]+)\s*MJ\b`. Read the merged session labels above the five cells. Left to right: race-type off, race-type on, qualifying-type, FP, out lap. | China Sprint/Race 8.5/9.0 MJ, SQ/Q 9.0, FP 9.0, out lap 9.0. Italy Race 7.0/7.5 MJ, Q 5.0, FP 7.5, out lap 9.0. |
| 2 · C5.2.8 | In the maximum DC power table match `(?:Base\|Rev\s*1)\s*-\s*(?:Standard\|Overtake)\|Alt\s*[12]` (the vertical bars denote regex alternation). Read the scope headings above. Plot axes are vehicle speed in km/h and MGU-K DC power in kW. | Miami uses Base Standard/Overtake in the main zones and Alt 1 in the specified race sectors. Singapore uses Rev 1 Standard/Overtake and Alt 2. Both sheets assign the Overtake-family curve to practice and qualifying. |
| 2 · C5.2.8iii | Locate the alternative-curve sector table. Read sector and lap window, in metres. | Miami T1–T8, 370–1550 m. Las Vegas T5–T12, 1520–3150 m. |
| 2 · C5.12.4 | In the initial power-drop table read sector, window and maximum permitted reduction (kW). Brackets restrict that entry to SQ/Q. | Australia T11–T13, 4100–4550 m, 350 kW. Singapore [Exit T17], [4300–4750] m, 350 kW, SQ/Q only. |
| 2 · C5.12.5 | In the reduction-reset table read sector and window. “Permitted” is a Boolean permission. | Belgium Exit T17, 6150–6350 m. Canada [Exit T14], [4000–4400] m, SQ/Q only. |
| 2 · C5.12.7 | Within the higher-threshold table read sector, window and `(\d+)\s*km\s*/\s*h`. | Barcelona V2 T13, 3980–4400 m at 270 km/h. Las Vegas T10–T12, 2550–3100 m at 310 km/h. |
| 2 · C5.12.8 | At upper right read Power Limited Distance (m) and Rate Limit (kW/s). Use the article label printed on the sheet. | Monaco 1388 m and 100 kW/s. Belgium 4594 m and 50 kW/s. |
| 2 · B7.2 | Read detection gap (s), detection line and activation line (m), and the loop below each line. Preserve TBC even when accompanied by a number. | Las Vegas 1.0 s, 5299 m L19, 5400 m L20. Madrid V1 lists TBC for both distances with loops L24/L25. V2 supplies 5160/5230 m. |

**Spatial parsing.** Use PDF word bounding boxes, for example `page.get_text("words")` in PyMuPDF. Locate each article title, take its enclosing table's horizontal bounds, identify the header columns, and collect the data directly below each column in visual order. In the middle row of newer sheets, the left, centre and right tables belong to C5.2.8iii, C5.12.4 and C5.12.5. Match the nth sector with the nth window and, where present, the nth kW value **within that table**. Several source cells contain multiline lists separated only by line breaks. The early sheets have only the initial-drop and reset tables in this row. Use `\[?\s*(\d+)\s*[-–—]\s*(\d+)\s*\]?\*?` inside distance columns. Global PDF text order can put the numbers ahead of their headings. The B7.2 cells are next to C5.12.7 and must be isolated before applying a distance regex.

**Curves.** Each CSV curve row contains ordered JSON pairs `[speed_km/h, power_kW]`. Hold the first power below the first speed, interpolate linearly between pairs and hold zero at or beyond the last speed. These are the published propulsion ceilings under the listed mode and location. Recharge, initial PU drop, reduction rate and higher-speed exception have separate units and meanings.

| Curve | Breakpoints (km/h, kW) | Numeric basis |
|---|---|---|
| Base – Standard | (290,350), (340,100), (345,0) | Combine the 350 kW ceiling with C5.2.8(i). |
| Base – Overtake | (337.5,350), (355,0) | 7100 − 20v intersects 350 kW at 337.5 km/h. |
| Alt 1 | (310,250), (340,100), (345,0) | The 250 kW cap and the two C5.2.8(iii) taper segments. |
| Rev 1 – Standard | ≈(200,350), (300,0) | Read from Monaco and Singapore event graphs. |
| Rev 1 – Overtake | ≈(200,350), (300,150), (310,0) | Dashed line in the same graphs. |
| Alt 2 | ≈(229,250), (300,0) | Singapore graph. The 250 kW cap intersects the Rev 1 Standard line at about 228.6 km/h by interpolation. |

For Base and Alt 1 use the regulation equations and event-selected label. For Rev 1 and Alt 2 the published event pages show plotted lines. The CSV marks their numeric basis as plotted. To digitise them, calibrate x and y separately against two labelled ticks on each axis, then recover each line's vertices from vector paths or a high-resolution render. Use the actual plot for that event. Monaco and Singapore have different left x-axis limits. A text extractor returns tick labels and legend text without the line geometry. [Technical regulations, issue 16, C5.2.7–8](https://api.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_16_-_2026-02-27.pdf) · [Issue 17, C5.2.7–8](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_17_-_2026-04-28.pdf) · [Monaco, p. 2](https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_power_unit_information.pdf#page=2) · [Singapore, p. 2](https://www.fia.com/system/files/decision-document/2026_singapore_grand_prix_-_power_unit_information.pdf#page=2)

### 4. Publication and session applicability

The original sheets were posted before FP1. Typical publication was the previous local day, with earlier issues at some rounds. For example, the Las Vegas cover gives 17 November at 15:40 before the 19–21 November weekend. The index gives 18 November at 00:42 CET. Miami's cover gives 30 April at 18:30 and the index gives 1 May at 00:32 CET. Keep these clocks separately. To order a future revision against the sessions, localise the cover and session timetable to the event's time zone, retain the listing's original timestamp, and read any explicit effective-session statement first.

| Event | FP1 and FP2 | FP3, qualifying and race | Changed entries on p. 2 |
|---|---|---|---|
| Barcelona-Catalunya | Doc 5 | Doc 31 V2, before FP3 | T13 higher threshold changed from 260 km/h over 3980–4100 m to 270 km/h over 3980–4400 m. |
| Spain (Madrid) | Doc 3 | Doc 25 V2, Friday after FP2 | The initial-drop table added T7–T8 and T10–T11 and replaced the two separate T18–T19 and T20–T21 windows with T18–T21 (4100–4800 m). The reset table added T12 and Exit T19 and moved the start of the qualifying-only Exit T22 window from 5200 to 5150 m. T12, T14 and T19 gained higher thresholds (260, 250, 240 km/h). Both B7.2 line distances were confirmed. The asterisk on the alternative window also disappeared. |
| São Paulo | Doc 3 | Doc 28 V2, before FP3 | T11 gained a 240 km/h threshold over 2870–2970 m. The 3250 m detection line lost its TBC flag. |

Each of these revisions retained the five recharge values and the C5.12.8 distance/rate pair. For replay, use the revision in force at the start of the session. For an in-session update in future seasons, store an effective timestamp or lap and split that session's validity interval. A fully superseded sheet can still be authoritative for earlier sessions.

### 5. Missing and ambiguous data

- **Session scope.** Standard weekends have FP1/FP2/FP3/Q/Race. Sprint weekends have FP1/SQ/Sprint/Q/Race. A qualifying or practice recharge cell supplies a single cap. The out-lap exception covers only non-race-type sessions. For rounds 1–3 the curve table lists mode names without a separate practice column. Its two conditional curves are preserved; when enabled, Overtake is activated throughout an LTCS under B7.2.3(b). From Miami the practice column makes the curve selection explicit. [Sporting regulations, issue 05, B7.2.3](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_05_-_2026-02-27.pdf)
- **Blank states.** `not_on_sheet` means the early sheet lacks that article block. `none_listed` means the table contains dashes or explicitly lists no sectors. `qualifying_only_entries` means every published entry is bracketed and the selected session is outside its scope. `TBC` retains the FIA's provisional status. None of these should become a numerical zero. The simulator can use a baseline rule in a separate calculation.
- **Distance bounds.** Keep literal end distances even when slightly beyond the printed centreline. Canada's qualifying-only reset ends at 4400 m on a 4361 m centreline. Monaco's ends at 3400 m on a 3337 m centreline. A parser that clips or wraps these endpoints changes the notice.
- **Dates and typography.** China's p. 2 says “15-15 March”, while the cover spans 13–15 March. Monaco's cover says 7–9 June, while its p. 2 F1 weekend is 5–7 June. Hungary's cover says 23–25 July and p. 2 says 24–26 July. Austin p. 2 starts 22 October, one day before the F1 sessions. Use the championship calendar and session timetable to date rows. Madrid V1 prints an asterisk on 1500–5100 m without a matching numeric replacement on that sheet. Keep the annotation in `note`.
- **Retrieval and image failures.** A direct fetch of Barcelona V2 initially failed. Following the document link returned the FIA-hosted two-page Doc 31, including the revised T13 row. All 24 selected sheets yielded selectable table text. If a later PDF is scanned, render the page at 300–400 dpi, crop by clause, OCR each column, and compare every bracket, dash and digit against the image. If either the image or text is unreadable, quarantine that field and preserve the original PDF. A newer matching title with an unreadable attachment blocks claims that the older values are current.
- **Refresh.** Recheck the FIA event index before FP1, after each session and once after the final classification. Record a new file hash even when the link or filename has been reused. Follow a conflicting same-version publication or recall to the event index and cover. Leave the conflict unresolved unless the FIA establishes precedence. No text values in this dataset come from press reports.

### 6. Validation before import

1. For this snapshot expect 21 distinct rounds, 6 Sprint weekends (2, 4, 5, 9, 12, 17), 24 distinct PDFs and 3 public V2s. With `applies_to_session=1`, expect exactly 105 round/session pairs and one distance/rate pair per session. For future dates, derive counts from the calendar and available notices.
2. In each PDF, verify five MJ cells, one distance cell and one kW/s cell in the top table. In these 24 notices the active race-type allowance exceeds the inactive value by exactly 0.5 MJ. The qualifying range is 5.0–9.0 MJ. Italy is the minimum. The observed rate is 50 kW/s for a power-limited distance above 3500 m and 100 kW/s otherwise.
3. Count sector names, windows and numeric limits independently in each table before joining. Each start must be smaller than its end. Preserve brackets and match their scope. Match the literal article number on the event sheet even where the general technical regulation discusses the same rate under a neighbouring subclause.
4. Check these cases after filtering to the active session version. Barcelona FP2 T13 is 260 km/h, while Q T13 is 270. Madrid FP2 has no higher threshold and Q has three. São Paulo Q has one higher threshold. Monaco Race has no alternative sector, initial-drop exception or reset. Singapore Sprint has three Alt 2 sectors and no qualifying-only reset.
5. Reconstruct the curve and check its knots. Base Standard at 340 km/h is 100 kW. Base Overtake at 345 km/h is 200 kW. Rev 1 Overtake at 300 km/h is about 150 kW. Singapore Alt 2 at 200 km/h is about 250 kW. Curve points must be ordered in speed and non-increasing in power.
6. Reject duplicate active keys across `round, session, clause, item, sector, overtake, lap_scope`. For the archive view, add `revision` to that key. Every output row must retain the FIA PDF URL, physical page and `status=document`. Preserve `value_state` and `basis` even when `value` is empty.

