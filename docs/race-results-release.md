# Race results panels

F1 and WEC pages place race results between the calendar and championship points.
The selector defaults to the latest published race in the current season. It lists
published classifications, not future calendar entries. Each panel refreshes every
five minutes while visible and rechecks when returning to the page.

## F1

- Classification and leader gaps use Jolpica, the database used by FastF1's Ergast
  interface. Published classification order is preserved after penalties.
- Optional tyre records use the TracingInsights FastF1 lap archive (Apache-2.0),
  with separate source attribution. Session name and date must match the race.
- Tokens such as `(S)33/(M)11/(S)01/(S)26` count completed race laps in each
  distinct stint, including pit and deleted laps. They do not report total tyre
  lifetime from earlier sessions. Same-compound changes remain separate.
- S/M/H use red/yellow/white. Confirmed new tyres are bold, confirmed used tyres
  are regular weight. Unknown freshness uses a question mark and dotted underline.
- Missing or inconsistent lap records show unavailable strategy instead of
  incomplete lap totals. Classification still loads independently.

## WEC

- Full race classifications and Analysis CSV files come from the existing Al Kamel
  archive. Arbitrary Hour N snapshots are excluded; final, amended and explicitly
  provisional classifications are distinguished.
- Hypercar/LMGT3 class selection preserves official order and raw car numbers,
  including leading zeros. Gaps are recalculated against the selected class leader.
- Pit visits count the published pit-entry/exit records. Total time sums PIT_TIME,
  which can include pit-lane traversal, service and penalties; it is not stationary
  service time or an estimate of race time lost.
- Duplicate lap records are not counted twice. Incomplete lap coverage withholds
  totals; an unfinished pit visit withholds total time rather than displaying zero.

## Validation and delivery

- Regression tests cover classification completeness, penalties/status, lapped
  cars, same-compound tyre changes, unknown freshness, class gaps, zero-padded car
  numbers, duplicate/incomplete pit records, source selection and page placement.
- Checked against the published 2026 Mexico FastF1 lap archive and Barcelona WEC
  classification/Analysis CSVs. Russell's stint lengths are 33/11/1/26 laps;
  Barcelona #8 has six recorded pit visits and 416.437 seconds of PIT_TIME.
- Browser preview checked at desktop and 390px mobile width, including compound
  colours, new/used font weights, class switching and no page horizontal overflow.
- Login implementation, collector infrastructure and secret configuration are
  outside this change. The installed legacy Sites app's reconnection failure is
  separate; these panels do not require that ChatGPT app connection.
- Production is unchanged until this branch is reviewed, merged and deployed
  through the existing Vercel project.
