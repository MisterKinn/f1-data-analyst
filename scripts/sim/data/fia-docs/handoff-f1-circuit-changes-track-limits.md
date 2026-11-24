## Handoff

**Snapshot: 24 November 2026, after Las Vegas.** Part 1 contains 648 records covering 113 held Grands Prix. The season counts are 22, 22, 24, 24 and 21. Qatar and Abu Dhabi 2026 were still ahead. The cancelled 2023 Emilia Romagna and 2026 Saudi Arabian races have no rows. There are two separate Spanish venues in 2026. Barcelona-Catalunya is the Barcelona race; the Spanish Grand Prix is Madrid. The 2026 Bahrain Grand Prix took place at Sepang in Malaysia. [FIA 2026 calendar](https://www.fia.com/events/fia-formula-one-world-championship/season-2026/2026-fia-formula-one-world-championship)

### Reading Part 1

- A row combines related works of one type if the side, corner and extent can still be read together. T means turn and sides follow the driver's direction. Surface repairs and grinding fall under `resurfacing`. Verges, run-off and gravel-bed changes fall under `layout`. The description distinguishes them from changes to the racing route. Fences and gates fall under `barrier`. `track_limits` includes changed boundary markings, named enforcement provisions and rejoin instructions.
- The page is the **physical PDF viewer page**, counting the FIA transmittal cover as page 1. A range points to the section supporting a grouped row. The event notes often print a page number one lower. The exact issue used is in the event manifest below. It is the later consolidated description when multiple editions exist. For session-by-session historical replay, keep the publication timeline.
- `document` is an event-note statement. `document_diagram` uses the drawing as well as its instruction. `regulation` gives the season-wide definition from an FIA sporting rule. `document_no_change` means the director explicitly recorded no changes. `first_visit` identifies Miami’s first race. `not_stated` means the inspected notes contain no change list. This applies to Sepang 2026. These last three statuses use `layout` as the umbrella field because the requested schema has five item types.
- A named corner may have a two-lap sanction, a rejoin route, a detection marking or an expressly monitored location. The description says which. A camera inventory and a list of corners where drivers happened to lose laps are different datasets. The FIA often gives only a circuit-wide boundary. A blue backing line is recorded as a marking. It does not move the legal edge unless the source also moves the boundary. Melbourne 2023 and 2024 explicitly identify **yellow** lines. [2023 Australian, PDF p. 5](https://www.fia.com/sites/default/files/decision-document/2023%20Australian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf#page=5) · [2024 Australian, PDF p. 4](https://www.fia.com/sites/default/files/decision-document/2024%20Australian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf#page=4)
- Use the comparison stated by the director. A circuit that returned after a gap may refer to its last visit. Suzuka 2022 compares with 2019. Miami 2022 identifies resurfacing and pit-entry kerb work during its debut weekend. Qatar 2023 uses the FIA description “New circuit” and separately records two 0.80 m boundary moves. This wording alone does not establish that 2023 was the first Qatar Grand Prix. [2022 Japanese, PDF p. 5](https://www.fia.com/sites/default/files/decision-document/2022%20Japanese%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf#page=5) · [2022 Miami, PDF p. 5](https://www.fia.com/sites/default/files/decision-document/2022%20Miami%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf#page=5) · [2023 Qatar, PDF p. 6](https://www.fia.com/sites/default/files/decision-document/2023%20Qatar%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V4.pdf#page=6)

### Indexes, document links and revisions

Use the year filter first. The season page's **Event** select contains the event-specific URLs in its option values. In the inspected HTML the event select is `select#facetapi_select_facet_form_2`. Resolve each option value relative to the FIA page. The season landing page initially expands one event. Reading only its visible document list will miss most of the season.

| Year | Held races in extract | Exact decision-document season index |
|---|---:|---|
| 2022 | 22 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005) |
| 2023 | 22 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042) |
| 2024 | 24 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043) |
| 2025 | 24 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071) |
| 2026 | 21 | [https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072) |

Other directory entry points consulted were the [championship-wide document list](https://www.fia.com/documents/championships/fia-formula-one-world-championship-), [season directory](https://www.fia.com/documents/season), [Formula 1 document directory](https://www.fia.com/documents/formula-1), [alternate 2022 season index](https://www.fia.com/documents/season/season-2022-2005/championships/fia-formula-one-world-championship-14) and [2026 Las Vegas event/timing page](https://www.fia.com/events/fia-formula-one-world-championship/season-2026/las-vegas-grand-prix/eventtiming-information). Use the year-specific URLs in the manifest for repeat runs.

**Link selection.** Read the rendered anchor text and its href. Normalize nonbreaking spaces, accents on apostrophes, hyphens and repeated spaces for matching only. Strip the publication suffix. Use this full-title pattern, case insensitive:

```regex
^(?:(?:DOC(?:UMENT)?\s*\d+\s*[-–—]\s*)?(?:20\d{2}\s+.+?Grand Prix\s*[-–—]\s*)?)(?:Race Directors?['’´`]?s?\s+)?(?:Event|Competition)\s+Notes(?:\s*[-–—]?\s*V(?:ersion)?\s*(\d+))?\s*$
```

The cover commonly has `Document 24` or the word and number on separate lines. Use `(?i)\bDocument\s*[:#]?\s*(\d+)\b`. Also accept `Doc 24 -` in the listing. A base edition has revision 1. Keep the version and document number separately. The number identifies an event issue and resets with the next event. The cover of Bahrain 2022 is Doc 24 V2, while Singapore 2026 is Doc 13 V2. Exclude recalled versions and decisions about failures to follow the instructions. Inspect any separate supplement whose title mentions circuit changes, track limits, an escape road or a specific amendment. A Circuit Map V2 or a Pirelli Preview V3 has its own revision sequence.

**URL families.** These templates explain observed names. The source of truth is the href.

```text
https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-{year}-{season_id}/event/{percent_encoded_event_filter}
https://www.fia.com/system/files/decision-document/{year}_{event_slug}_-_{doc_slug}.pdf
https://www.fia.com/sites/default/files/decision-document/{year}%20{event_slug}%20-%20{doc_slug}.pdf
https://www.fia.com/sites/default/files/doc_{number}_-_{year}_{event_slug}_-_{doc_slug}.pdf
```

The manifest gives the literal PDF event slug, including `grand_prix` or its spaced equivalent. Preserve its spelling and the rest of each href verbatim. Common modern document slugs include `race_directors_event_notes_`, `race_directors_competition_notes` and `race_directors_competition_notes_v3`. Older documents use spaces, mixed-case V/v and straight or acute apostrophes. Some are simply `Event Notes`. Examples include the trailing space before the 2024 Qatar extension, the singular “Director” in Las Vegas 2024 and the acute accent in Japan and Abu Dhabi 2024. The São Paulo filter uses uppercase in 2023. In 2022 its document name is Brazilian, and Mexico City's is Mexican. Bahrain in Malaysia has a longer PDF slug than the event filter. Keep Barcelona-Catalunya's hyphen. Encoding a guessed English name can produce a different archive entry.

### Page and paragraph extraction

These event and competition note families use **numbered prose and bullets**. There is no common table header or fixed field position. Use page-aware extraction, then join wrapped lines inside each section. Include the next page when a numbered item or bullet crosses the break. Strip repeated footers while preserving numeric values. A metrically important number can be on a line by itself.

| Document family | Section or anchor | Two examples from this extract |
|---|---|---|
| Race Director’s Event Notes, 2022–25 | `(?i)changes to the circuit\b` plus optional baseline year; `(?i)track limits\b`, `escape road`, or `cutting the chicanes`. Units commonly m, cm, or a count. | Miami 2022 V3 §22 p. 5 lists pit-entry bollards and T17 repaving. The subclauses are labelled **21.1–21.2**. Spain 2022 V3 §14 p. 4 sets the T1–2 rejoin and the possible two-lap deletion at T13–15; §21.8 p. 5 removes two T1 run-off bumps. [2022 Miami, PDF p. 5](https://www.fia.com/sites/default/files/decision-document/2022%20Miami%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf#page=5) · [2022 Spanish, PDF p. 4](https://www.fia.com/sites/default/files/decision-document/2022%20Spanish%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf#page=4) |
| Race Director’s Competition Notes, 2026 | Same change heading. Also match `Lap times in all LTCS and TTCS`, `Track Limits`, `Escape Roads`, `Leaving the track and gaining an advantage`, and `marks the track edge`. LTCS is a lap-time classified session. | China V3 §15.8 p. 6 names the pit-entry-road bend; §18 p. 7 defines the pit-exit edge; §28 p. 8 covers the T3 kerb and T7 barrier. Canada §31.1–31.4 pp. 9–10 gives the T1, T9 and T13 rejoin rules and the T13–14 two-lap sanction. [2026 Chinese, PDF p. 6](https://www.fia.com/system/files/decision-document/2026_chinese_grand_prix_-_race_directors_competition_notes_v3.pdf#page=6) · [2026 Canadian, PDF p. 9](https://www.fia.com/system/files/decision-document/2026_canadian_grand_prix_-_race_directors_competition_notes_.pdf#page=9) |
| Drawing embedded in event or competition notes | Match `(?i)(as shown in (?:the )?(?:image\|drawing)\|following the .*route)`. Retain the page and inspect the arrow path, shaded zones and labelled markers. | Canada 2025 §17.2 p. 7 and Canada 2026 §31.1 p. 9 both draw the T1 route across the paved escape area to its far end and then right into the direction of traffic. The arrow carries information omitted from the prose. [2025 Canadian, PDF p. 7](https://www.fia.com/system/files/decision-document/2025_canadian_grand_prix_-_race_directors_event_notes_v2.pdf#page=7) · [2026 Canadian, PDF p. 9](https://www.fia.com/system/files/decision-document/2026_canadian_grand_prix_-_race_directors_competition_notes_.pdf#page=9) |
| FIA F1 Sporting Regulations | `(?i)white lines defining the track edges`, followed by `kerbs`. Art. 33.3 in 2022–25; B1.8.6 in the 2026 pre-season issue used here. No units. | 2022 issue 5, PDF p. 32; 2026 Section B issue 5, PDF p. 12. Both define loss of all contact and distinguish the boundary marking from the kerb. [2022 rule](https://api.fia.com/sites/default/files/2022_formula_1_sporting_regulations_-_iss_5_-_2022-03-15.pdf#page=32) · [2026 rule](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_05_-_2026-02-27.pdf#page=12) |

The other season-rule examples used are [2023 issue 4, p. 39](https://api.fia.com/sites/default/files/fia_2023_formula_1_sporting_regulations_-_issue_4_-_2023-02-22.pdf#page=39), [2024 issue 5, p. 40](https://api.fia.com/sites/default/files/fia_2024_formula_1_sporting_regulations_-_issue_5_-_2024-02-28.pdf#page=40) and [2025 issue 4, p. 42](https://www.fia.com/system/files/documents/fia_2025_formula_1_sporting_regulations_-_issue_4_-_2025-02-26.pdf#page=42). These are season-opening baseline editions. Read the event note alongside them.

Useful secondary anchors include `(?i)(?:immediately )?following lap`, `(?:white|yellow|blue) line`, `(?:re[-\s]?join|run[-\s]?off)`, `(?:resurfac\w*|asphalt|repav\w*|grind\w*)`, `(?:kerb|bollard|TecPro|guardrail|debris fenc\w*)`. Parse decimal commas as well as points, ranges and “approximately”. Preserve direction, side, entry/apex/exit, original corner numbering and the object the distance is measured from. A 1.5 m line-to-gravel distance and a 1.5 m line-to-kerb distance describe different boundaries.

### Publication timing and exceptions

- Initial notes usually appear before FP1. Revisions can follow practice, qualifying or a sprint. There is no fixed publication deadline inferred here. The 2026 Las Vegas page lists the first note on 19 Nov at 07:54 CET and V2 on 20 Nov at 03:43 CET, after the FP1 classification. China 2024 lists its first note on 18 Apr at 06:41, V2 on 19 Apr at 04:55, and V3 on 20 Apr at 02:43 CET, before the sprint. Qatar 2023 reached **V4** on race day, 8 Oct at 16:32 CET. [Las Vegas directory](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Las%20Vegas%20Grand%20Prix) · [Shanghai directory](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Chinese%20Grand%20Prix) · [Lusail directory](https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Qatar%20Grand%20Prix)
- Store the original listing timestamp and zone label, cover date/time, event weekend, revision, document number and SHA-256. The cover and list can show different time bases. For replay, convert against an independently checked event timetable, select the latest live edition at session start, and process a mid-session amendment from its stated effective time. Poll again after each session and after the race. For changed bytes under the same URL retain both hashes.
- Historical PDF indexing is uneven. Where search surfaced an earlier copy, I checked the event directory and recovered later material. Examples include 2022 Brazil V3, Miami V3, Spain V3, Las Vegas 2025 V2 and Singapore 2026 V2. The Sepang final issue is **V3, Doc 33**, even though V2 is easier to find. Source rows use the actual edition. The Belgian 2022 note lists a temporary T9 apex kerb and later records its removal in §24.15. Miami 2022 has no earlier F1 visit but still contains weekend changes. Neither case should be reduced to a single inferred annual change.
- An empty text match can mean a missing heading, a wrapped phrase, or an image. Keep “no changes” only when explicitly stated. If a cover is present but the enclosure is missing, flag the file for review. For a scan, render the page, OCR it and compare every unit, number, side, and qualifier against the image. No value in this CSV depends on unverified OCR. For Montreal I inspected the actual diagrams. No distances or camera locations were estimated from them.
- The FIA sometimes writes “may” for deletion of the next lap. The CSV preserves that discretion. Singapore 2025 says “18 or and 19”; the extract identifies both turns, with no inference about a new lap-wide limit. Interlagos and Austin 2026 say blue detection lines were added at most turns, without enumerating them. Point a review queue at this wording whenever a corner-by-corner monitoring inventory is required.

### Validation and retrieval

Read Part 1 as UTF-8 CSV. Require the eight requested headers, an allowed item type, a nonempty event-season key, a positive physical page or inclusive page range for each row, no duplicate complete rows, and source hosts under `fia.com`. Each event-season needs at least one track-limits record and a physical change or explicit coverage status. Multiple rows per event are expected. The cursor for each new season starts at its own index. Never count testing, right-of-review listings, future or cancelled races as held events.

For example, require 2024 Australia to contain the yellow boundary, 2022 Miami to contain T17 repaving, 2022 Belgium to record removal of the T9 temporary kerb, and 2023 Qatar to contain **both** T12–13 and T13–14 with the same 0.80 m shift. A script should verify section anchors against extracted pages and require the highest eligible document on the index. If the highest edition cannot be fetched, retain an explicitly provisional earlier edition in the cache and raise a coverage flag. Do not publish it as final. PDF byte checks alone cannot confirm a diagram interpretation.

### Event manifest

Tab-separated UTF-8. Each exact event listing and PDF is provided so a script can use it without URL generation. `changes_pages` and `limits_pages` refer to the corresponding headings. An empty field means no stand-alone heading was identified. Other relevant instructions can appear elsewhere, as recorded in the CSV.

```tsv
year	event	event_slug	doc_number	revision	changes_pages	limits_pages	index_url	pdf_url
2022	Abu Dhabi Grand Prix	Abu Dhabi Grand Prix	9	2	5	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Abu%20Dhabi%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Abu%20Dhabi%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2022	Australian Grand Prix	Australian Grand Prix	36	2	3–4		https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Australian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Australian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2022	Austrian Grand Prix	Austrian Grand Prix	30	2	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Austrian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Austrian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2022	Azerbaijan Grand Prix	Azerbaijan Grand Prix	37	4	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Azerbaijan%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Azerbaijan%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V4.pdf
2022	Bahrain Grand Prix	bahrain_grand_prix	24	2	4	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Bahrain%20Grand%20Prix	https://www.fia.com/sites/default/files/doc_24_-_2022_bahrain_grand_prix_-_event_notes_v2.pdf
2022	Belgian Grand Prix	Belgian Grand Prix	39	2	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Belgian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Belgian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2022	British Grand Prix	British Grand Prix	22	3	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/British%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20British%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2022	Canadian Grand Prix	Canadian Grand Prix	61	3	5–6	4–5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Canadian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Canadian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2022	Dutch Grand Prix	Dutch Grand Prix	29	2	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Dutch%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Dutch%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2022	Emilia Romagna Grand Prix	Emilia Romagna Grand Prix	33	3	3	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Emilia%20Romagna%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Emilia%20Romagna%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2022	French Grand Prix	French Grand Prix	24	3	8	5–7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/French%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20French%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2022	Hungarian Grand Prix	Hungarian Grand Prix	11	2	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Hungarian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Hungarian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2022	Italian Grand Prix	italian_grand_prix	46	2	7	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Italian%20Grand%20Prix	https://www.fia.com/sites/default/files/doc_46_-_2022_italian_grand_prix_-_event_notes_v2.pdf
2022	Japanese Grand Prix	Japanese Grand Prix	3	1	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Japanese%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Japanese%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2022	Mexico City Grand Prix	Mexican Grand Prix	3	1	5	4–5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Mexican%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Mexican%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2022	Miami Grand Prix	Miami Grand Prix	33	3	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Miami%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Miami%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2022	Monaco Grand Prix	Monaco Grand Prix	24	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Monaco%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Monaco%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2022	São Paulo Grand Prix	Brazilian Grand Prix	30	3	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Brazilian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Brazilian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2022	Saudi Arabian Grand Prix	Saudi Arabian Grand Prix	28	2	3		https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Saudi%20Arabian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Saudi%20Arabian%20Grand%20Prix%20-%20Event%20Notes%20v2.pdf
2022	Singapore Grand Prix	Singapore Grand Prix	4	1	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Singapore%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Singapore%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2022	Spanish Grand Prix	Spanish Grand Prix	34	3	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/Spanish%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20Spanish%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2022	United States Grand Prix	United States Grand Prix	2	1	5–6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005/event/United%20States%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2022%20United%20States%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2023	Abu Dhabi Grand Prix	Abu Dhabi Grand Prix	30	3	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Abu%20Dhabi%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Abu%20Dhabi%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2023	Australian Grand Prix	Australian Grand Prix	22	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Australian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Australian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2023	Austrian Grand Prix	Austrian Grand Prix	14	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Austrian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Austrian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2023	Azerbaijan Grand Prix	Azerbaijan Grand Prix	36	4	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Azerbaijan%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Azerbaijan%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V4.pdf
2023	Bahrain Grand Prix	Bahrain Grand Prix	19	2	5	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Bahrain%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Bahrain%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2023	Belgian Grand Prix	Belgian Grand Prix	9	2	5	4–5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Belgian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Belgian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2023	British Grand Prix	British Grand Prix	10	2	5–6	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/British%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20British%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2023	Canadian Grand Prix	Canadian Grand Prix	53	2	7	5–6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Canadian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Canadian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2023	Dutch Grand Prix	Dutch Grand Prix	26	3	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Dutch%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Dutch%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2023	Hungarian Grand Prix	Hungarian Grand Prix	5	1	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Hungarian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Hungarian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2023	Italian Grand Prix	Italian Grand Prix	20	3	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Italian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Italian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20v3.pdf
2023	Japanese Grand Prix	Japanese Grand Prix	3	1	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Japanese%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Japanese%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2023	Las Vegas Grand Prix	Las Vegas Grand Prix	49	4	6	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Las%20Vegas%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Las%20Vegas%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V4.pdf
2023	Mexico City Grand Prix	Mexico City Grand Prix	3	1	5	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Mexico%20City%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Mexico%20City%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2023	Miami Grand Prix	Miami Grand Prix	21	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Miami%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Miami%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2023	Monaco Grand Prix	Monaco Grand Prix	13	3	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Monaco%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Monaco%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2023	Qatar Grand Prix	Qatar Grand Prix	63	4	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Qatar%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Qatar%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V4.pdf
2023	São Paulo Grand Prix	São Paulo Grand Prix	4	1	6	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/S%C3%83O%20PAULO%20GRAND%20PRIX	https://www.fia.com/sites/default/files/decision-document/2023%20S%C3%A3o%20Paulo%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2023	Saudi Arabian Grand Prix	Saudi Arabian Grand Prix	29	3	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Saudi%20Arabian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Saudi%20Arabian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2023	Singapore Grand Prix	Singapore Grand Prix	16	2	5	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Singapore%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Singapore%20Grand%20Prix%20-%20Event%20Notes%20v2.pdf
2023	Spanish Grand Prix	Spanish Grand Prix	9	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/Spanish%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20Spanish%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2023	United States Grand Prix	United States Grand Prix	15	2	5	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042/event/United%20States%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2023%20United%20States%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Abu Dhabi Grand Prix	Abu Dhabi Grand Prix	13	2	6	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Abu%20Dhabi%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Abu%20Dhabi%20Grand%20Prix%20-%20Race%20Director%C2%B4s%20Event%20Notes%20V2.pdf
2024	Australian Grand Prix	Australian Grand Prix	3	1	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Australian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Australian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2024	Austrian Grand Prix	Austrian Grand Prix	16	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Austrian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Austrian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Azerbaijan Grand Prix	Azerbaijan Grand Prix	21	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Azerbaijan%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Azerbaijan%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Bahrain Grand Prix	Bahrain Grand Prix	14	2	5	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Bahrain%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Bahrain%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Belgian Grand Prix	Belgian Grand Prix	2	1	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Belgian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Belgian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2024	British Grand Prix	British Grand Prix	3	1	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/British%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20British%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2024	Canadian Grand Prix	Canadian Grand Prix	29	2	6–7	5–6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Canadian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Canadian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Chinese Grand Prix	Chinese Grand Prix	29	3	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Chinese%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Chinese%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2024	Dutch Grand Prix	Dutch Grand Prix	2	1	7	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Dutch%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Dutch%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2024	Emilia Romagna Grand Prix	emilia_romagna_grand_prix	4	1	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Emilia%20Romagna%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/doc_4_-_2024_emilia_romagna_grand_prix_-_race_directors_event_notes.pdf
2024	Hungarian Grand Prix	Hungarian Grand Prix	28	3	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Hungarian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Hungarian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf
2024	Italian Grand Prix	Italian Grand Prix	47	4	6–7	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Italian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Italian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V4.pdf
2024	Japanese Grand Prix	Japanese Grand Prix	6	1	4–5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Japanese%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Japanese%20Grand%20Prix%20-%20Race%20Director%C2%B4s%20Event%20Notes.pdf
2024	Las Vegas Grand Prix	Las Vegas Grand Prix	19	2	6	5–6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Las%20Vegas%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Las%20Vegas%20Grand%20Prix%20-%20Race%20Director%20Event%20Notes%20V2.pdf
2024	Mexico City Grand Prix	Mexico City Grand Prix	3	1	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Mexico%20City%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Mexico%20City%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2024	Miami Grand Prix	Miami Grand Prix	36	2	5	4	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Miami%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Miami%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Monaco Grand Prix	Monaco Grand Prix	14	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Monaco%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Monaco%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Qatar Grand Prix	Qatar Grand Prix	3	1	6–7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Qatar%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Qatar%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20.pdf
2024	São Paulo Grand Prix	São Paulo Grand Prix	50	2	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/S%C3%A3o%20Paulo%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20S%C3%A3o%20Paulo%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Saudi Arabian Grand Prix	Saudi Arabian Grand Prix	2	1	5	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Saudi%20Arabian%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Saudi%20Arabian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf
2024	Singapore Grand Prix	Singapore Grand Prix	45	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Singapore%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Singapore%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	Spanish Grand Prix	Spanish Grand Prix	17	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/Spanish%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20Spanish%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2024	United States Grand Prix	United States Grand Prix	12	2	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043/event/United%20States%20Grand%20Prix	https://www.fia.com/sites/default/files/decision-document/2024%20United%20States%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf
2025	Abu Dhabi Grand Prix	abu_dhabi_grand_prix	19	2	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Abu%20Dhabi%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_abu_dhabi_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Australian Grand Prix	australian_grand_prix	17	2	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Australian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_australian_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Austrian Grand Prix	austrian_grand_prix	35	3	6	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Austrian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_austrian_grand_prix_-_race_directors_event_notes_v3.pdf
2025	Azerbaijan Grand Prix	azerbaijan_grand_prix	38	4	8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Azerbaijan%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_azerbaijan_grand_prix_-_race_directors_event_notes_v4.pdf
2025	Bahrain Grand Prix	bahrain_grand_prix	23	2	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Bahrain%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_bahrain_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Belgian Grand Prix	belgian_grand_prix	34	3	8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Belgian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_belgian_grand_prix_-_race_directors_event_notes_v3.pdf
2025	British Grand Prix	british_grand_prix	18	2	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/British%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_british_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Canadian Grand Prix	canadian_grand_prix	19	2	9	7–8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Canadian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_canadian_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Chinese Grand Prix	chinese_grand_prix	59	3	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Chinese%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_chinese_grand_prix_-_race_directors_event_notes_v3.pdf
2025	Dutch Grand Prix	dutch_grand_prix	5	1	9	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Dutch%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_dutch_grand_prix_-_race_directors_event_notes_.pdf
2025	Emilia Romagna Grand Prix	emilia_romagna_grand_prix	4	1	6–7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Emilia%20Romagna%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_emilia_romagna_grand_prix_-_race_directors_event_notes_.pdf
2025	Hungarian Grand Prix	hungarian_grand_prix	10	2	8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Hungarian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_hungarian_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Italian Grand Prix	italian_grand_prix	4	1	8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Italian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_italian_grand_prix_-_race_directors_event_notes_.pdf
2025	Japanese Grand Prix	japanese_grand_prix	32	3	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Japanese%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_japanese_grand_prix_-_race_directors_event_notes_v3.pdf
2025	Las Vegas Grand Prix	las_vegas_grand_prix	20	2	7–8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Las%20Vegas%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_las_vegas_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Mexico City Grand Prix	mexico_city_grand_prix	20	3	8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Mexico%20City%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_mexico_city_grand_prix_-_race_directors_event_notes_v3.pdf
2025	Miami Grand Prix	miami_grand_prix	33	3	6–7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Miami%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_miami_grand_prix_-_race_directors_event_notes_v3.pdf
2025	Monaco Grand Prix	monaco_grand_prix	42	2	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Monaco%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_monaco_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Qatar Grand Prix	qatar_grand_prix	56	3	7–8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Qatar%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_qatar_grand_prix_-_race_directors_event_notes_v3.pdf
2025	São Paulo Grand Prix	sao_paulo_grand_prix	6	1	9	8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/S%C3%A3o%20Paulo%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_sao_paulo_grand_prix_-_race_directors_event_notes_.pdf
2025	Saudi Arabian Grand Prix	saudi_arabian_grand_prix	8	2	7	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Saudi%20Arabian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_saudi_arabian_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Singapore Grand Prix	singapore_grand_prix	13	2	9	8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Singapore%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_singapore_grand_prix_-_race_directors_event_notes_v2.pdf
2025	Spanish Grand Prix	spanish_grand_prix	5	1	6	5	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Spanish%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_spanish_grand_prix_-_race_directors_event_notes_.pdf
2025	United States Grand Prix	united_states_grand_prix	25	2	7	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/United%20States%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2025_united_states_grand_prix_-_race_directors_event_notes_v2.pdf
2026	Australian Grand Prix	australian_grand_prix	29	2	7	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Australian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_australian_grand_prix_-_race_directors_competition_notes_v2.pdf
2026	Austrian Grand Prix	austrian_grand_prix	6	1	8	8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Austrian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_austrian_grand_prix_-_race_directors_competition_notes.pdf
2026	Azerbaijan Grand Prix	azerbaijan_grand_prix	56	3	8		https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Azerbaijan%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_azerbaijan_grand_prix_-_race_directors_competition_notes_v3.pdf
2026	Bahrain Grand Prix in Malaysia	bahrain_grand_prix_in_malaysia	33	3		6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Bahrain%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_bahrain_grand_prix_in_malaysia_-_race_directors_competition_notes_v3.pdf
2026	Barcelona-Catalunya Grand Prix	barcelona-catalunya_grand_prix	51	3	7–8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Barcelona-Catalunya%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_barcelona-catalunya_grand_prix_-_race_directors_competition_notes_v3.pdf
2026	Belgian Grand Prix	belgian_grand_prix	6	1	8	8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Belgian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_belgian_grand_prix_-_race_directors_competition_notes.pdf
2026	British Grand Prix	british_grand_prix	5	1	8	8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/British%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_british_grand_prix_-_race_directors_competition_notes.pdf
2026	Canadian Grand Prix	canadian_grand_prix	6	1	9	9–10	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Canadian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_canadian_grand_prix_-_race_directors_competition_notes_.pdf
2026	Chinese Grand Prix	chinese_grand_prix	31	3	8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Chinese%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_chinese_grand_prix_-_race_directors_competition_notes_v3.pdf
2026	Dutch Grand Prix	dutch_grand_prix	5	1	9		https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Dutch%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_dutch_grand_prix_-_race_directors_competition_notes.pdf
2026	Hungarian Grand Prix	hungarian_grand_prix	42	2	8	8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Hungarian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_hungarian_grand_prix_-_race_directors_competition_notes_v2.pdf
2026	Italian Grand Prix	italian_grand_prix	48	2	8	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Italian%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_italian_grand_prix_-_race_directors_competition_notes_v2.pdf
2026	Japanese Grand Prix	japanese_grand_prix	21	2	8	6	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Japanese%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_japanese_grand_prix_-_race_directors_competition_notes_v2.pdf
2026	Las Vegas Grand Prix	las_vegas_grand_prix	12	2	7	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Las%20Vegas%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_las_vegas_grand_prix_-_race_directors_competition_notes_v2.pdf
2026	Mexico City Grand Prix	mexico_city_grand_prix	63	2	9	7–8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Mexico%20City%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_mexico_city_grand_prix_-_race_directors_competition_notes_v2.pdf
2026	Miami Grand Prix	miami_grand_prix	36	3	8	9	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Miami%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_miami_grand_prix_-_race_directors_competition_notes_v3.pdf
2026	Monaco Grand Prix	monaco_grand_prix	48	3	8		https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Monaco%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_race_directors_competition_notes_v3.pdf
2026	São Paulo Grand Prix	sao_paulo_grand_prix	34	2	8		https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/S%C3%A3o%20Paulo%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_sao_paulo_grand_prix_-_race_directors_competition_notes_v2.pdf
2026	Singapore Grand Prix	singapore_grand_prix	13	2	8	8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Singapore%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_singapore_grand_prix_-_race_directors_competition_notes_v2.pdf
2026	Spanish Grand Prix	spanish_grand_prix	61	3	10–11	8	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/Spanish%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_spanish_grand_prix_-_race_directors_competition_notes_v3.pdf
2026	United States Grand Prix	united_states_grand_prix	27	3	7	7	https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072/event/United%20States%20Grand%20Prix	https://www.fia.com/system/files/decision-document/2026_united_states_grand_prix_-_race_directors_competition_notes_v3.pdf
```

### Additional listing pages used for cross-checks

- <https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/event/Belgian%20Grand%20Prix/season/season-2023-2042>
- <https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/event/Italian%20Grand%20Prix/season/season-2024-2043>
- <https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/event/Monaco%20Grand%20Prix/season/season-2024-2043>
- <https://www.fia.com/documents/season/season-2022-2005/championships/fia-formula-one-world-championship-14/event/Japanese%20Grand%20Prix>
- <https://www.fia.com/documents/season/season-2022-2005/championships/fia-formula-one-world-championship-14/event/Miami%20Grand%20Prix>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2022/belgian-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2022/brazilian-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2022/dutch-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2022/miami-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2022/singapore-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2022/spanish-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2023/abu-dhabi-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2023/azerbaijan-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2023/hungarian-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2023/sao-paulo-grand-prix/eventtiming-information>
- <https://www.fia.com/events/fia-formula-one-world-championship/season-2026/bahrain-grand-prix/eventtiming-information>

The event dropdown is case-sensitive in some cached copies. The current 2023 event filter for São Paulo is uppercase, and the 2022 event filters are Brazilian and Mexican. Attempts with modern spellings were resolved against the season dropdown. A search hit for a support-series timing page was discarded. Use the F1 championship filter and verify the PDF cover.

### Repeat the search

Save the following block as `collect_fia.py` beside this Markdown file. Run `python -m pip install requests beautifulsoup4 pypdf`, then `python collect_fia.py F1_Circuit_Handoff.md`. It reads the embedded manifest, fetches each live FIA event directory, checks the selected revision, and writes PDFs, hashes, the publication history, and page text to a local cache. The original run used the same official directories plus the fallback listings above. The script produces evidence for review. Paraphrases and interpretation of diagrams require the checks described above.

```python
import csv
import hashlib
import io
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

md = Path(sys.argv[1]).read_text(encoding="utf-8-sig")
manifest = md.split("```tsv\n", 1)[1].split("\n```", 1)[0]
events = list(csv.DictReader(io.StringIO(manifest), delimiter="\t"))
out = Path("fia_event_note_cache")
out.mkdir(exist_ok=True)
session = requests.Session()
session.headers["User-Agent"] = "F1 circuit-notes research/1.0"
title = re.compile(
    r"^(?:doc(?:ument)?\s*\d+\s*[-–—]\s*)?"
    r"(?:20\d{2}\s+.*?grand prix\s*[-–—]\s*)?"
    r"(?:race director(?:['’´]s|s|s['’´])?\s+)?"
    r"(?:event|competition)\s+notes"
    r"(?:\s*[-–—]?\s*v(?:ersion)?\s*(\d+))?$", re.I
)
anchors = re.compile(
    r"changes\s+to\s+the\s+circuit|track\s+limits?|track\s+edges?|"
    r"escape\s+roads?|re[-\s]?join|following\s+lap|leaving\s+the\s+track|"
    r"lap\s+times\s+in\s+all\s+LTCS", re.I
)

def get(url):
    host = urlparse(url).hostname or ""
    if host != "fia.com" and not host.endswith(".fia.com"):
        raise ValueError(f"Unexpected source host: {host}")
    for attempt in range(4):
        response = session.get(url, timeout=60)
        if response.status_code not in (429, 500, 502, 503, 504):
            response.raise_for_status()
            return response
        wait = response.headers.get("Retry-After", "")
        time.sleep(int(wait) if wait.isdecimal() else 2 ** attempt)
    response.raise_for_status()

for e in events:
    try:
        soup = BeautifulSoup(get(e["index_url"]).content, "html.parser")
        history = []
        for a in soup.select("a[href]"):
            text = " ".join(a.stripped_strings)
            text = " ".join(unicodedata.normalize("NFC", text).split())
            label, _, issued = re.split(r"(Published on)", text, maxsplit=1,
                                         flags=re.I) if re.search(
                "Published on", text, re.I) else (text, "", "")
            match = title.fullmatch(label.strip())
            if match and "recalled" not in text.lower():
                history.append(dict(v=int(match.group(1) or 1), label=label.strip(),
                                    published=issued.strip(),
                                    url=urljoin(e["index_url"], a["href"])))
        if not history:
            raise ValueError("No matching notes in HTML. Render the event dropdown and expand the listing.")
        v = max(h["v"] for h in history)
        candidates = {h["url"] for h in history if h["v"] == v}
        if len(candidates) != 1:
            raise ValueError("Same-version conflict. Check recalls, cover and publication time.")
        url = candidates.pop()
        response = get(url)
        if not response.content.startswith(b"%PDF-"):
            raise ValueError("Response is not a PDF")
        digest = hashlib.sha256(response.content).hexdigest()
        stem = f"{e['year']}_{e['event_slug']}_v{v}_{digest[:12]}"
        (out / (stem + ".pdf")).write_bytes(response.content)
        reader = PdfReader(io.BytesIO(response.content))
        pages = [(p.extract_text() or "") for p in reader.pages]
        cover = " ".join(pages[0].split())
        if e["year"] not in cover:
            raise ValueError("Year absent from cover. Check the event manually.")
        numbered = re.search(r"\bDocument\s*[:#]?\s*(\d+)\b", cover, re.I)
        review = []
        if not numbered or numbered.group(1) != e["doc_number"]:
            review.append("cover document number differs or is unreadable")
        if v != int(e["revision"]):
            review.append("live revision differs from snapshot")
        record = dict(year=e["year"], event=e["event"], index=e["index_url"],
                      source=url, version=v, sha256=digest, history=history, review=review,
                      pages=[dict(page=i, anchor=bool(anchors.search(txt)), text=txt,
                                  inspect_image=(len(txt.strip()) < 80 or
                                  bool(re.search(r"(drawing|image|diagram) below", txt, re.I))))
                             for i, txt in enumerate(pages, 1)])
        (out / (stem + ".json")).write_text(json.dumps(record, ensure_ascii=False, indent=2),
                                            encoding="utf-8")
        print(e["year"], e["event"], "V" + str(v), len(pages), "; ".join(review))
    except (requests.RequestException, OSError, ValueError) as err:
        print("REVIEW", e["year"], e["event"], str(err), file=sys.stderr)
    time.sleep(0.5)

```

