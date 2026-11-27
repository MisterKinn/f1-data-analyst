# Race-data engineering evidence — 2026-11-27

Research-only, baseline main `8a9c2e0`. No brake/kerb/regen/noise parameter changes.
Published zone peaks, independently derived statistics, and missing evidence are
kept separate. “Not found” means not verified in the reviewed public sources, not
proof that no such data exists. This is not a pipeline reproduction or accuracy gate.

A. Sources: [n] title, year, URL

[1] Brembo, Monza Brake Circuit Identity Card, 2025:
https://brem-p-001.sitecorecontenthub.cloud/api/public/content/a7758d9026e14e81b940a82dd992941c?v=cc87e1fe

[2] Brembo, Mexico Brake Circuit Identity Card, 2025:
https://brem-p-001.sitecorecontenthub.cloud/api/public/content/7732fabcfcbe4c62845ac2bed7e368c5?v=06195d33

[3] Brembo, 5 facts about the Japanese Grand Prix, 2025:
https://www.brembo.com/en/motorsport/formula1/2025/facts-formula1-gp-japan

[4] Brembo, All the numbers of the 2025 Formula 1 Championship, 2025 season review:
https://www.brembo.com/en/motorsport/formula1/2025-numbers

[5] Brembo, Le Mans Brake Circuit Identity Card, 2025:
https://brem-p-001.sitecorecontenthub.cloud/api/public/content/68f05b4734c14b26b702b349ccc16bc0?v=90b0e9ba

[6] Brembo, Unveils the Secrets of IMSA Braking, 2025 season:
https://www.brembo.com/en/motorsport/wec/imsa

[7] Bosch, Bosch and IMSA announce long-term partnership, 2023:
https://us.bosch-press.com/pressportal/us/en/press-release-20096.html

[8] FIA/ACO/IMSA, LMDh Technical Regulations, revision 16 October 2025, p.32,
Articles 5.3.10(a–d), 5.3.11:
https://www.fia.com/system/files/documents/lmdh-technical-regulations-2025.10.16-blackline.pdf
Downloaded PDF SHA256: 36b30366a5c5e690f034fc394daefad4da907d65931189dd5629847e5c2585d6.
This is the reviewed revision, not a claim to have verified every subsequent issue.

[9] FIA, Formula 1 Sporting Regulations, issue 5, 30 April 2025, Article 33.3:
https://api.fia.com/system/files/documents/fia_2025_formula_1_sporting_regulations_-_issue_5_-_2025-04-30.pdf

[10] iRacing, Track Technology, undated (reviewed 2026-11-27):
https://www.iracing.com/track-technology/

[11] FIA, Italian GP Qualifying Session Maximum Speeds, 2025:
https://www.fia.com/sites/default/files/2025_16_ita_f1_q0_timing_qualifyingsessionmaximumspeeds_v01_0.pdf

[12] FIA WEC/Al Kamel, Le Mans Hyperpole 2 Hypercar Best Top Speeds, 12 June 2025:
https://fiawec.alkamelsystems.com/Results/14_2025/04_LE%20MANS/600_FIA%20WEC/202506122140_Hyperpole%202%20HYPERCAR/14_BestTopSpeed_Hyperpole%202%20HYPERCAR.PDF

B. Braking table: series | speed | g | source

Speed is initial → final speed of a braking ZONE, unless marked “instantaneous”.
Maximum deceleration is the peak somewhere in that zone. These pairs do NOT give
g(initial speed), a universal tyre limit, or a continuous deceleration-versus-speed curve.

F1 | instantaneous 300 km/h | not verified | [1–4] do not provide that channel
F1 | instantaneous 200 km/h | not verified | same limitation
F1 | instantaneous 100 km/h | not verified | same limitation
F1 Monza 2025 T1 | 337 → 89 km/h | peak 4.7 g | [1]
F1 Monza 2025 T2 | 92 → 73 km/h | peak 1.4 g | [1]
F1 Monza 2025 T4 | 324 → 125 km/h | peak 4.5 g | [1]
F1 Monza 2025 T6 | 261 → 211 km/h | peak 3.1 g | [1]
F1 Monza 2025 T7 | 269 → 183 km/h | peak 4.2 g | [1]
F1 Monza 2025 T8 | 328 → 206 km/h | peak 4.5 g | [1]
F1 Monza 2025 T11 | 328 → 234 km/h | peak 3.8 g | [1]
F1 Mexico 2025 T1 | 340 → 110 km/h | peak 4.0 g | [2]
F1 Mexico 2025 T4 | 315 → 92 km/h | peak 4.1 g | [2]
F1 Mexico 2025 T13 | 205 → 76 km/h | peak 3.2 g | [2]
F1 Suzuka 2025 T16 | 303 → 103 km/h | peak 4.5 g | [3]
F1 Canada 2025 penultimate corner | 320 → 145 km/h | 5.1 g | [4]
WEC Hypercar Le Mans 2025 T7 | 331 → 114 km/h | peak 3.0 g | [5]
WEC Hypercar Le Mans 2025 T12 | 201 → 73 km/h | peak 1.7 g | [5]
IMSA GTP Daytona 2025 T1 | 320 → 130 km/h | 3 g | [6]
IMSA GTD Daytona 2025 T1 | entry/exit not separately stated | 2 g | [6]
WEC LMGT3 | speed-resolved/zone-specific g not verified | not verified | no direct class-specific source established

The GTD value is a labelled GT3-family proxy, NOT a measured LMGT3 value. The Le
Mans table is Hypercar evidence, not an isolated LMH-versus-LMDh comparison.
Do not interpolate the Monza or Mexico rows to manufacture g at 300/200/100 km/h:
different braking effort, downforce, grip and corner conditions are confounded.

Existing year/track archive: [2024–2026 tables](lapsim-brembo.md), structured
`scripts/sim/data/brembo.json`. It includes sources/mirrors and missing values;
only the rows above were newly checked for this audit. The 2026 figures in that
archive are pre-race estimates, not a newly measured 2026 braking envelope.
The Mexico PDF T1 differs from the archived web-page row; retain source/version
identity, not an automatic overwrite or an average of incompatible versions.
Use the year-stamped Le Mans PDF: a web URL containing “2025” is not reliable
year evidence when its body has subsequently been updated.

C. Kerb table: corner type | m beyond edge | source

Slow | not verified | [9–10] do not publish vehicle excursion statistics
Medium | not verified | same
Fast | not verified | same
Chicane / exit | not verified | same

Article 33.3 [9] defines leaving the track by loss of contact with the defined
track; white lines count as track, kerbs do not. It does not prescribe a
corner-type excursion in metres. Car-centre displacement, outer tyre extent,
and distance beyond the outside of a kerb are different quantities.
Laser-scanned geometry [10] establishes track shape, not how far drivers use it.

The repository's iRacing kerb-use product is SIMULATION-DERIVED, relative to drawn
track edges, not surveyed white lines or published F1/WEC excursion data. Its
clipping/smoothing choices are ASSUMED processing settings, not measured maximum
usage. Do not promote them to real-car allowances or legal track-limit margins.

D. Noise: apex SD km/h | straight SD km/h | source

Pure driver-to-driver apex/straight-end repeatability: not established for F1
or WEC by the sources reviewed. Within-driver lap-to-lap values: not established.
The following are useful but DIFFERENT descriptive statistics, calculated from
published session maxima, not published noise estimates:

F1 Monza 2025 Q | apex unavailable | session-maximum spread SD 3.209 km/h, n=20 | derived from [11]
WEC Hypercar Le Mans 2025 HP2 | apex unavailable | session-maximum spread SD 2.902 km/h, n=10 | derived from [12]
WEC LMGT3 | unavailable | unavailable | no complete source table verified for calculation

Method: one SPEED TRAP maximum per entrant in [11]; one Top 1 value per car in
[12], all rows included. Sample SD s = sqrt(sum((v_i − mean(v))²)/(n−1)).
Reproduce: `node scripts/sim/race-data-evidence.mjs`.
Source transcriptions and independent arithmetic tests accompany the script.

These are car+driver+setup+tow/weather/session-selection spreads; they do NOT
isolate driver skill or measurement noise. A session maximum is not necessarily
the straight-end speed of that driver's best qualifying lap. HP2 selects the
cars that advanced, so it is not the whole-field WEC spread. Do not calculate
lap repeatability from the Top 1–5 columns: those include slow/out laps and are
ordered maxima, not a controlled clean-push-lap sample.

Existing `noise-floor.mjs` reports lap-time variability, not speed SD. Existing
driver-margin split-sample estimates describe telemetry sampling sensitivity,
not lap-to-lap repeatability. Neither supplies the requested missing values.

E. LMDh cap: value or "not public" + source

Current numeric Equity Model cap/map: not publicly verified in this audit.
[8] 5.3.10(a) delegates instantaneous energy/power to the standard HCU Equity
Model, dependent on cooling performance, requested power and battery SoC,
and refers readers to the Hybrid System Documentation Package.
5.3.10(c) and (d) separately subject deploy and regeneration power to that model.
This public regulation does not supply a replacement numeric cap/map.

Historical public operating figures: drive 50 kW; recuperation up to 200 kW,
Bosch 2023 [7]. These are explicitly described as then-regulation figures,
NOT merely an undocumented 200 kW motor rating. They still do not establish
the current event/SoC/temperature-dependent Equity Model.

Shipped model: deploy 50 kW, regen 50 kW. The regeneration value is ASSUMED,
not a sourced rule. Retained unchanged; raising it needs an independently
validated rear-axle regeneration/blended-braking/SoC controller and energy
checks, not just substitution of a hardware or historical headline value.

F. Assumptions

- No invented instantaneous g, kerb distances, apex SD or within-driver SD.
- Derived session-max SD uses a stated estimator, not an assumed physical value;
  it is report-only and is never loaded by runtime or calibration.
- Applying GTD braking g to LMGT3, or a Hypercar table to a specific LMH car,
  would be ASSUMED and is not done here.
- Existing LMDh regenMax, regenShare and etaRegen are model assumptions.
- To close the gaps: fixed-location speed traces over repeated clean push laps,
  matched session/compound/conditions and per-car sampling; registered apex/trap
  extraction and clustered event/driver reporting. Kerb work additionally needs
  registered tyre/centre reference and surveyed edge coordinates. Neither a
  generic metre allowance nor an invented speed-noise constant is substituted.
- No physics accuracy improvement or complete FIA compliance is claimed by this
  evidence release; the executable simulation remains unchanged.
