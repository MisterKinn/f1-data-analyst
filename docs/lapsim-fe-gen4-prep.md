# Formula E Gen4 - modelling preparation (2026-11-11)

Status: preparation only. No car values are fitted, nothing in production changes. Product entry stays `coming-soon`
(`worker/lapsim/series.js`, key `fe`).

## 1. Inputs with a source

### 1.1 Regulation (FIA Formula E Technical Regulations 2026-2027 V4, WMSC 30.09.2026, pages 12-79; Sporting Regulations 2026-2027, published 30.09.2026; read on 2026-11-11)

Numbers in square brackets are printed that way in the regulation (still provisional there).
Rows without a prefix are Technical Regulations (TR). SR = Sporting Regulations; SR page = page of the PDF (same as the printed page for pages 15-40).
"Bulletin" = the value is not in the regulation; the FIA or the Stewards publish it for each event.

| Input | Value | Article / page |
|---|---|---|
| Overall width, max | [1800] mm | 4.4.1 / p17 |
| Bodywork height, max | [1025] mm above reference plane | 4.4.2 / p17 |
| Overall length, max | 5540 mm | 4.4 / p17 |
| Wheelbase | 3070 to 3090 mm | 4.4 / p17 |
| Overhang, max | 1466 mm front, 994 mm rear of wheel centre lines | 4.4 / p17 |
| Min mass with driver | 1046 kg | 5.1 / p20 |
| Driver with seat and equipment, min | 82 kg | 5.1 / p20 |
| Mass on front axle (with driver) | 44 to 46 % | 5.2 / p20 |
| Ballast | allowed; on the keel under the survival cell (other place only if on the homologation form) | 5.3 / p20 |
| Max power from battery | 600 kW (max 350 rear, max 250 front) | 7.5 / p22 |
| Max power to battery (regen) | 700 kW (max 350 rear, max 350 front) | 7.5 / p23 |
| Max net energy used in the race | 51.25 kWh, or the value in the event note | 7.5 / p23 |
| Added net energy by fast charging (Pit Boost) in the race | [4.05 max TBC] kWh | 7.5 / p23 |
| DC-DC power taken off the RESS power count | up to 3.0 kW (1.2 kW under red flag, Full Course Yellow or safety car); energy limit 1.2 kWh, more is added to the net energy used | 7.5 / p23 |
| Max voltage | 1000 V | 7 / p23 |
| Drive | 4 drive shafts; front system drives only front wheels, rear only rear | 9 / p31 |
| Reduction gear ratios | max 6 homologated, one set per car | 9 / p31 |
| Differential | torque vectoring not allowed; active differential and mechanical limited-slip allowed | 9 / p31 |
| Suspension | double wishbone, pushrod, no active suspension | 10 / p32 |
| Camber range | between 0° and -4.0° front, between 0° and -3.0° rear (by instruction of the tyre supplier) | 10.9 / p33 |
| Turning radius | minimum turning radius must not exceed 10 m | 10.7 / p33 |
| Brakes | 4 circuits; front and rear axle may not get opposite torque demands from the motors | 11 / p34 |
| Brake cooling | front only | 11 / p35 |
| Rims | 18 inch; width 11.5 inch front, 13 inch rear | 13.5 / p37 |
| Tyre sectional width | 295 mm front, 345 mm rear | 13.8 / p37 |
| Tyre overall diameter | 710 mm front, 710 mm rear | 13.8 / p37 |
| Tyre fitting pressure, maximum | "3.0 5.0 bars at 20°C" (both numbers are printed; fitting on the rim only, not a running pressure); no device may change tyre pressure while the car runs | 13.9 / p38 |
| Tyres | used as supplied by the single supplier; air only | 13 / p37-38 |
| Aero adjustment | only with tools; no gurneys or trim tabs beyond the supplier specification | 4 / p19 |
| Aero configurations (definition) | only 2 configurations may be used: LDF (low downforce) = reference bodywork of the supplier catalogue; HDF (high downforce) = made by adding or replacing bodywork parts of the reference | TR 4.5, 4.5.1, 4.5.2 / p17 (full page read) |
| Aero: free practice | choice of the Competitor, HDF or LDF | SR 22.3 / p28 |
| Aero: qualifying | defined by the FIA at least 21 days before the event; in a Bulletin | SR 23.1 / p29 |
| Aero: race | defined by the FIA at least 21 days before the event; in a Bulletin; mandatory | SR 27.3 a) / p37 |
| Race Mode power | maximum 450kW in all cases; the value for each race (may include a speed / maximum power schedule) is announced at least 21 days before; schedule in a Bulletin | SR 27.3 b) / p37 |
| Attack Mode power | Race Mode power plus 150kW | SR 27.3 d) / p37 |
| Attack Mode time and number of uses | no number in the regulation: time is in a Bulletin for each event; the defined number of activations is mandatory, using all the time is not | SR 27.4 / p37 |
| Attack Mode limits | not in the Driver's first 2 laps; not under Full Course Yellow or Safety Car; not before the Line after a Safety Car; not when the Attack Zone is under yellow; timer may be frozen in a neutralisation | SR 27.4 b)-f) / p37 |
| Standing start power | 600 kW allowed; must end when front or rear powertrain power goes under 5kW and the car is over 110 kph | SR 26.20 / p36 |
| Regeneration in the race | 700 kW (350 kW front 350 kW rear) - same as TR 7.5 | SR 27.3 c) / p37 |
| Qualifying power | all laps at 600kW maximum power level, Groups and Duels | SR 23.5, 23.6 / p30 |
| Free practice | 2 sessions of 45 minutes; maximum 600kW; first 30 minutes maximum 450kW | SR 22.2, 22.3 / p28 |
| Shakedown | 10 minutes, maximum 3 laps, power limited to 350kW | SR 22.1 b) / p28 |
| Reconnaissance lap; pit lane | 450kW; pit lane speed limit 50 km/h | SR 26.1 / p33; 13.17 / p15; 20.14 / p26 |
| Qualifying format: Groups | Group A and Group B, maximum 12 cars each, 10 minutes each, no lap limit; fastest four of each Group go to the Duels | SR 23.1, 23.5 / p29-30 |
| Qualifying format: Duels | Quarter-finals, Semi-finals, Final; each Driver: out lap, timed lap, in lap; out and in lap maximum 120% of the fastest Group lap | SR 23.6, 23.7 / p30 |
| Qualifying: charging and tyres | 5 minutes charging between Group and Duels; tyre change allowed with a minimum time (Bulletin) until the car is eliminated | SR 23.2, 23.5 / p29-30 |
| Qualifying 110% rule | best lap over 110% of the fastest time of the Group = no race start (not if the track was declared wet) | SR 25.3 / p32 |
| Tyre allocation, 1-race event | no more than 2 sets of All-Weather tyres and 1 set of Wet tyres per race number | SR 15.6 / p18 |
| Tyre allocation, 2-race event | no more than 3 sets of All-Weather tyres and 1 set of Wet tyres; the Wet set may be replaced by a new set after race 1 if a session was declared "Wet Track" before the end of race 1 | SR 15.6 / p18 |
| Joker tyres | 2 front and 2 rear All-Weather per car number per season; 2 front and 2 rear "Typhoon tyres" per car per competition; only after a puncture or damage | SR 15.11 / p18 |
| Typhoon (Wet) tyre use | only from the moment the Race Director declares "Wet Track"; then Wet or All-Weather is the Competitor's choice until the end of that session; no mixing on one car | SR 15.7 / p18 |
| Tyre pressure and camber | no number in the regulation: working ranges come from the tyre supplier before the end of initial scrutineering; pressures and temperatures are monitored; pressure may be adjusted in Parc Ferme after a "Wet Track" message | SR 15.8, 15.9 / p18 |
| Tyre heating | no heating, cooling or covers | SR 15.3, 15.4, 15.16 / p17-19 |
| Race energy | Maximum Net Energy as in the Stewards' Bulletin of each event (with Pit Boost: plus the selected quantity rule); at the limit, power must go to zero (0) kW | SR 27.8 / p39 (TR 7.5: 51.25 kWh or the event value) |
| Minimum Energy Consumption (MEC) | may be published for specific races; a lap below the MEC counts as the MEC; not on lap 1, last lap, FCY / Safety Car laps, "Wet Track", pit lane laps | SR 27.9 / p39 |
| Pit-lane start energy offset | +X kWh, value in a Bulletin | SR 26.3 / p33 |
| Pit Boost | mandatory only in races named by the FIA at least 21 days before; one stop; the Bulletin gives a table of energy quantities (kWh), each with a minimum stop time, and the SoC window; no tyre change before it is finished | SR 27.5-27.7 / p38-39 |
| Testing limits | each competitor: Eight (8) days of testing, six (6) Official Test days and two (2) Test Days, 1 October 2026 to 30 September 2027; promotional running limited to 40kWh total discharge energy throughput and 350kW power output; "Rig testing, wind tunnel testing, and CFD studies are strictly forbidden" | SR 12.3, 12.8-12.11 / p11-13 |
| Race distance | number of laps published by the FIA twenty-one (21) days before each event; maximum 7 "Added Laps" for FCY / Safety Car time | SR 2.6 / p2 (full page read); 27.2 / p36 |
| Race time cap | Performance Race ("e-Prix Unleashed"): sixty (60) minutes, with a suspension up to ninety (90) minutes plus one lap; Efficiency Race ("e-Prix"): seventy-five (75) minutes, with a suspension up to three (3) hours plus one lap | SR 2.6 a), b) / p2-3 |
| Event format | 1 race: 2 days (Shakedown and Free Practice; then Free Practice, Qualifying, Race); 2 races: 3 days (Shakedown; then two days of Free Practice, Qualifying, Race) | SR 2.5 / p2 |
| Attack Mode procedure (Appendix 4, "S13 v3") | driver arms with a push button, "Max 5s windows before first loop of Attack zone", unlimited armings; three timing loops in the zone; while active: "600 kW or PS", when the timer goes to 0 sec: "450 kW or PS" (PS = power schedule); "Maximum 2 activations during the race (Unfreeze activations not included)"; time split scenario 1 to 3 chosen on the steering wheel before the first activation, examples: "Scenario 1: 2 + 6min", "Scenario 2: 4 + 4min", "Scenario 3: 6 + 2min"; choice frozen at the first successful activation; ignored in a race with a maximum of 1 activation; a frozen timer must be unfrozen before the second activation; "For each race, number of armings, activations and time split scenario will be published in the race official Event Note"; free practice: unlimited armings and activations | SR Appendix 4 / PDF p76 - confirmed by eye on 2026-11-11 (page image from the owner) |

Technical Regulations pages 42-79 hold no model input: safety equipment and structures (Articles 14-16), materials (17),
safety tests, cameras and transponders (18-19), drawings 1-13 (pages 57-73) and the rear suspension appendix (74-79).

Second check on 2026-11-11 (full page reads of TR p17, p20-24, p33-37 and SR p2-3): the first read of TR pages 12-41 had
missed four values that are printed there - tyre width and diameter (13.8), camber range (10.9), the fast-charging
energy (7.5) and the DC-DC rule (7.5). They are now in the table. Pages 25-32 and 38-42 were read again in a third check: one more value (tyre fitting pressure,
13.9) and no other model input (electrical safety, sensors, lights, cockpit and seat rules).

Still not in either regulation (see section 2): tyre pressure numbers; Attack Mode total time; the energy value, Pit Boost
table and aero configuration of each event. Sporting Regulations Appendix 4 (Attack Mode, PDF page 76) is a rotated diagram.
The text reader returns it scrambled; the row above was first rebuilt from word positions and then confirmed against the
page image. The whole Sporting Regulations PDF (77 pages, supplied by the owner) was also scanned locally: pages not read
before hold no further car input; the testing rules (Article 12) are in the table.

Derived checks (arithmetic only on the rows above; not new inputs):

| Check | Result |
|---|---|
| Rim diameter 18 inch | 457.2 mm |
| Tyre sidewall height, (710 - 457.2) / 2 | 126.4 mm, front and rear |
| Unloaded tyre radius, 710 / 2 | 355 mm, front and rear (loaded radius is not known) |
| Rim width 11.5 / 13 inch | 292.1 mm / 330.2 mm |
| 51.25 kWh over the 75 minute cap / over 45 minutes | 41 kW / 68 kW average net power (Race Mode limit is 450kW) |
| 51.25 kWh at a constant 450kW | 410 s of full power |
| [4.05 max TBC] kWh as a share of 51.25 kWh | 7.9 % |

### 1.2 Tyres (supplier and press; no regulation number yet)

| Item | Value | Source |
|---|---|---|
| Supplier | Bridgestone, sole supplier from 2026-27 | racingnews365 (tyre launch); theevreport |
| Standard tyre | "Potenza Gen4": grooved all-weather tyre for dry and light rain | theevreport; The Race (tender) |
| Heavy-rain tyre | "Potenza Gen4 for Typhoon Tyre": new, for heavy rain and standing water | theevreport; racingnews365 |
| Slick tyre | not planned for races now; talk of 2028 | fenotebook; e-formula.news |
| Grip numbers | none published | - |

Consequence for the wet/dry rule of the dataset: Gen4 has two tyre types, so a wet lap must also record which tyre was
fitted. The timing feed has to be checked for a tyre field at the first event.

### 1.3 Series and manufacturer values (cross-checks only)

| Input | Value | Source |
|---|---|---|
| Race power / qualifying and attack power | 450 kW / 600 kW | fiaformulae.com "GEN4 Unleashed"; Porsche newsroom |
| Aero | two packages: high downforce (qualifying), low drag (race) | fiaformulae.com; Porsche |
| Top speed claim | over 200 mph (series); 208 mph (Bridgestone) | fiaformulae.com; theevreport |
| 0-100 km/h | about 1.8 s | Porsche |
| Mass without driver | 954 kg (Porsche, provisional) | Porsche newsroom |
| Race formats (plan of the series) | E-PrixUnleashed: high downforce, 6-minute Attack Mode, no Pit Boost. E-Prix: low downforce, 8-minute Attack Mode, mandatory Pit Boost. E-Prix runs at every event; double-headers run both | fiaformulae.com (format explainer; "What is Formula E?") |
| Qualifying aero (plan) | high downforce planned for qualifying; teams asked for low downforce qualifying on E-Prix days, still under discussion in 06.2026 | Motorsport Week 23.06.2026 (P. Martino, Formula E) |
| Aero per event | "confirmed 21 days before the race" | fia.com WMSC news 06.2026 |
| Downforce | "up to 150 percent more downforce compared to the GEN3 Evo" (high-downforce package); no absolute number | Porsche newsroom |
| Drag targets of the 2023 FIA tender | SCx 0.65 low downforce, 0.75 high downforce - tender target reported on a forum, not a measured value; do not use as input | forums.autosport.com |
| Lap time claim | about 10 seconds per lap faster than Gen3 in qualifying mode; 0-200 km/h in 4.4 s; top speed 335 km/h | fiaformulae.com |
| Jeddah, first event | 18 and 19 December 2026, double-header, night races; 3.001 km, 19 turns | Saudi Press Agency 20.09.2026; fiaformulae.com |

Conflicts resolved by the regulation: mass = 1046 kg with driver (press: 1012, 1016); width 1800 and height 1025 mm
(series page: 1790 x 1113 mm); race energy 51.25 kWh net (series page: 55 kWh, likely the battery, not the allowance).

Conflicts found on 2026-11-11 (the regulation is used):

| Item | Series / manufacturer pages | Regulation |
|---|---|---|
| Rear tyre width | 330 mm (fiaformulae.com "GEN4 Unleashed"; Wikipedia) | 345 mm sectional width (TR 13.8). Note: the rear rim is 13 inch = 330.2 mm, which may be where 330 comes from. e-formula.news (06.2025) also reports 345 mm |
| Race length | 30-minute E-PrixUnleashed, 45-minute E-Prix (fiaformulae.com) | a number of laps, published 21 days before; time caps 60 and 75 minutes (SR 2.6) |
| Pit Boost | 10 % (3.85kWh) in 30 seconds at 600kW; SoC window 40 % to 60 % (fiaformulae.com pages, written for Season 12; TotalEnergies repeats 3.85 kWh for Gen4) | [4.05 max TBC] kWh maximum (TR 7.5); a table of selectable energy quantities with stop times, and the SoC window, in the event Bulletin (SR 27.6, 27.7) |
| Aero by session | high downforce in qualifying, low drag in the race | not fixed: the FIA defines the configuration for qualifying and for the race of each event, at least 21 days before (SR 23.1, 27.3 a)); free practice is free choice (SR 22.3) |
| Race power | 450 kW | maximum 450kW; the Race Mode value of each race is set by the FIA and may be lower or follow a speed schedule (SR 27.3 b)) |
| Attack power | 600 kW | Race Mode power plus 150kW (SR 27.3 d)); equal to 600 kW only when Race Mode is 450kW |

Product gap seen on the way (first read): the rules index (`rules_lookup`) held only the Formula E Financial Rulebook.
On the second read (2026-11-11) the index returns Technical, Sporting and General Provisions articles with page numbers.
Open gap: Sporting Regulations Appendix 4 (Attack Mode diagram) is indexed as scrambled text.

## 2. What is not known (no source yet)

Solved on 2026-11-11 and moved to section 1.1: the 450kW Race Mode limit, the Attack Mode power rule, power by session,
the qualifying format, tyre allocation, when the Typhoon tyre may be used, the race energy and Pit Boost rules,
tyre width and diameter, the camber range, the maximum fast-charging energy, the race time caps.

### 2.1 Unpublished car values: best evidence and calculated bounds (third check, 2026-11-11)

Searched: regulations, FIA and series pages, Bridgestone and Porsche press material, test reports (The Race, RacingNews365,
e-formula.news, DIVEBOMB), technical press, video pages. No source gives these numbers. They stay fitted values.
The "bound" column is a calculation from sourced numbers (mass 1046 kg, air 1.225 kg/m3, 97 % drive efficiency as the series claims).

| Item | Best public evidence | Calculated bound | Status |
|---|---|---|---|
| Front/rear power split | caps 250 kW front, 350 kW rear (TR 7.5); FIA: teams "will play a lot with torque distribution" (Autosport, V. Gaillardot) | at 600 kW the caps add up to exactly 600, so the split is forced: 250 / 350 (41.7 % front). At 450kW: front 100 to 250 kW, rear 200 to 350 kW (22 to 56 % front). At 700 kW regen: forced 350 / 350 | closed for 600 kW and full regen; a free control choice in Race Mode |
| Tyre grip, All-Weather | 0-100 km/h in about 1.8 s (series, Bridgestone) | mean 15.4 m/s2 = 1.57 g; power allows this up to about 130 km/h, so the launch is grip-limited: mean longitudinal grip of at least about 1.5 (four wheels driven, little downforce at this speed) | lower bound only; lateral grip and load sensitivity open |
| Drag | top speed 335 km/h (series); 338 km/h reached (RacingNews365); FIA tender target SCx 0.65 low downforce / 0.75 high downforce (forum report) | from 335 km/h at 600 kW: SCx no more than 1.18 m2. With the tender targets the car would only need 321 / 370 kW at 335 km/h, so 335 km/h is not a drag-limited speed and cannot fix SCx | bounded: about 0.65 to 1.18 m2; fit from straight-line data |
| Downforce | tender target SCz 2.0 low / 3.0 high downforce (forum report); Porsche: up to 150 percent more than Gen3 Evo | at the tender targets, 200 km/h: 3781 N / 5671 N = 37 % / 55 % of car weight. The Porsche claim and the tender ratio (3.0 / 2.0) do not agree, so neither is used as input | open; fit per package |
| Centre-of-gravity height | battery under the centre of the monocoque, ballast on the keel (TR 5.3); pack about 340 kg (tender maximum; batterydesign.net) | none possible from public data | open |
| Tyre pressure, running | supplier working range, not public; fitting maximum 5.0 bar (TR 13.9) | none | open |
| Loaded tyre radius | unloaded 355 mm (TR 13.8) | below 355 mm; exact value needs tyre stiffness | open |

Engineering starting ranges for the fit only. These are priors from general single-seater practice, NOT sources and not
Gen4 data; they must never be quoted as values: centre-of-gravity height 0.25 to 0.33 m; loaded radius 0.97 to 0.98 of
unloaded (344 to 348 mm); hot running pressure 1.3 to 1.8 bar.

Electrical checks (calculated from TR 7.5 and series values):

| Check | Result |
|---|---|
| Battery C-rate, 55 kWh pack | 10.9 C at 600 kW discharge; 12.7 C at 700 kW regen |
| Current at the 1000 V maximum | at least 600 A at 600 kW, at least 700 A at 700 kW (more at the real, lower pack voltage) |
| Pit Boost time at 600 kW | [4.05 max TBC] kWh = 24.3 s; 3.85 kWh = 23.1 s. The series quotes 30 s for 3.85 kWh, a mean of 462 kW |
| Gross energy if regen is 40 % / 50 % of the energy used (series claim) | 85 / 103 kWh through the motors for 51.25 kWh net; 114 / 137 kW mean over 45 minutes |
| Pack energy density at 340 kg | about 162 Wh/kg |

### 2.2 Test records found (unofficial unless stated; not usable for a fit yet)

| Test | Result | Source | Limits |
|---|---|---|---|
| Monteblanco, November 2025 | first manufacturer test, low downforce only, no official times | The Race; e-formula.news | development cars |
| Almeria (Circuit Andalusia), January 2026 | best laps: Porsche 1m47.873s, Jaguar 1m49.322s, Stellantis 1m49.386s, Lola 1m49.529s, Nissan 1m49.692s; high downforce kit first run on the last day | The Race | power level not stated; track not in the simulator |
| Paul Ricard, June 2026 | onboard lap video (J. Rossiter), no lap time published | fiaformulae.com video; YouTube | promotional |
| Jarama, unofficial | over 200 mph on the main straight (J. Rossiter) | DIVEBOMB | no lap time |
| Monza, 17-18 October 2026, Porsche | lap "in the 1:32 range", about 320 km/h, used tyres, no qualifying run; wet running on Typhoon tyres on day 2 | RacingNews365; e-formula.news; DIVEBOMB | unofficial, source-reported; aero package and power not confirmed. F2 pole 2026 at Monza: 1:31.326 |
| Guadix; Valencia group shakedown, early November 2026 | running reported, no times published | forum reports only | not verified |
| Jarama, Gen3 Evo reference laps (same layout with the extra chicane) | Madrid E-Prix 21 March 2026: 23 laps, 90.48 km (3.934 km per lap), race fastest lap 1:32.941; rookie test the next day: best 1m29.888s, best at 300kW 1m31.881s | Wikipedia (Madrid ePrix); The Race | Gen3 Evo, not Gen4; the base for the first Gen4 fit |
| Assetto Corsa, Race Sim Studio official Gen4 car | announced 7 November 2026, "Developed using technical data supplied for the project"; no release date | racesimstudio.com; traxion.gg | a game model; when released, its data files (mass split, aero, tyres) are a cross-check, not a source |
| Jarama official pre-season test, 16-20 November 2026 | not run yet. Track days Monday, Wednesday, Friday, two 3-hour sessions each; two race simulations (E-Prix and E-PrixUnleashed) | fiaformulae.com; e-formula.news | first official Gen4 times. Gen3 Evo reference on the same layout: race fastest lap 1:32.941 (Madrid E-Prix, 21 March 2026) |

The Jarama test is the first data that can close items in 2.1: a Gen3 Evo reference exists on the same layout, both race
formats are simulated, and all teams run. The Jeddah Bulletins follow about 27 November 2026.

Still open, published per event in a Bulletin (collect before each race, first one Jeddah):

- Aero configuration for qualifying and for the race (SR 23.1, 27.3 a)).
- Race Mode power and any speed / power schedule (SR 27.3 b)).
- Attack Mode total time and number of mandatory activations (SR 27.4, Appendix 4). Series plan: 6 minutes / 8 minutes (section 1.3).
- Maximum Net Energy, MEC, pit-lane start energy offset (SR 27.8, 27.9, 26.3).
- Whether Pit Boost is mandatory; its energy quantities, minimum stop times and SoC window (SR 27.5-27.7).
- Race distance and the reference lap time for Added Laps (SR 2.6, 27.2).
- Minimum tyre change time in qualifying (SR 23.2).

These must come from the event Bulletins, from timing data once the cars race, or from a regulation article. They are not to be guessed.

## 3. Simulator readiness

| Need | In kernel today | Gap |
|---|---|---|
| All-wheel drive traction | `awdAboveKph` switch exists (F1/Gen3-style part-time) | permanent AWD with a power cap per axle (250 front / 350 rear) |
| Regeneration | `regenMax`, regen share exist | 700 kW limit on both axles; brake blending front/rear |
| Two aero packages | one car value set per session type | select package by session from the event Bulletin (HDF or LDF; not fixed by the regulation) |
| Power levels | power is one value | Race Mode per event (maximum 450kW), Attack Mode = Race Mode plus 150kW, 600kW qualifying |
| Energy-limited race pace | F1 energy logic exists (`energy-limits.js`, `stint-energy.js`) | Formula E race allowance, lift-and-coast, attack mode time |

Each gap is a model change: draft PR, production baseline in the same run, no merge without the gate.

## 4. Tracks (season 2026-27, 13 venues, 21 races, first race Jeddah 18 December 2026)

| Venue | Track in simulator | Note |
|---|---|---|
| Jeddah, Mexico City, Austin, Miami, Monaco, Zandvoort, Shanghai | F1 layout exists | Formula E layout not confirmed; separate id until confirmed. Jeddah: reported as 3.001 km, 19 turns (Saudi Press Agency), so it is not the full F1 layout |
| Brands Hatch | map/TUM candidate (warning mark) | layout not confirmed |
| Jarama, Sao Paulo (street), Sanya, Berlin, Tokyo | none accepted | see programme document section 9 |

Section 13 of the programme document applies: map-built tracks are about 5 % off, so they cannot be used to fit Gen4 values.

## 5. Data plan

1. Before the first race: no Gen4 race laps exist. Only test reports. Nothing to fit.
2. Gen3 Evo laps (Timing71 Formula E sessions already in the all-laps dataset) give the class a starting point for
   tyre-independent items only (track factors on shared venues). Gen4 has new tyres, aero and drive, so car values do not carry over.
3. From Jeddah on: collect every session with the all-laps builder (same marks). Qualifying laps (600kW) and race laps
   (Race Mode, energy-limited) are different cars for the fit and stay in separate groups. Record the aero configuration
   of each session from the event Bulletin; free practice laps have no known configuration (Competitor's choice).
4. First hide-and-predict test needs at least 3 venues with production-quality tracks: earliest after Austin (6 February 2027)
   if the Formula E layouts equal the existing ones.

## 6. Declared before any Gen4 fit

- Fixed inputs: the regulation values in section 1.1 (mass, front mass share 45 % mid-range with 44-46 % as bounds, wheelbase 3080 mm mid-range, power caps per axle, regen, race energy). Not fitted.
- Fitted: drag, downforce (per aero package), tyre grip, track factor. One value set per package, all teams together first;
  team differences only after 5 venues, with the shrink widths of `docs/lapsim-all-laps.md`.
- Hold-out: leave one venue out; class-best and per-car errors reported separately with n.
- Comparison point: a "regulation-only" car (section 1 inputs, Gen3 Evo aero and grip) run in the same job, so any gain is measured.

## 7. First model: the prior car (built and revised 2026-11-11, not calibrated)

Built the same way as the F1 model: values printed in the regulations are fixed, the unknowns start from a prior with
bounds, and the fit comes later from timing data. Code is on branch `lapsim-fe-gen4/prior-model-2026-11-11`:
`worker/lapsim/fe-gen4.js` (Gen4 car, aero packages, session modes, power split, straight-line check, lap energy, and a
Gen3 Evo reference car), `scripts/sim/fe-gen4-prior.mjs` (run and report, output in `scripts/sim/data/fe-gen4-prior.json`),
`tests/lapsim-fe-gen4.test.mjs`. The kernel is not changed and the product entry stays `coming-soon`.

### 7.1 Check on real laps (Gen3 Evo, Monaco)

Monaco is the one venue where Formula E races on the layout the simulator has. A Gen3 Evo reference car (859 kg,
350 kW, four-wheel drive, tender aero SCz 1.5 to 2.0) was run against the best duel lap, 1:26.217 (2026; 1:26.315 in 2025).

| Result | Value |
|---|---|
| Lateral grip the Gen3 Evo car needs for 1:26.217 | 1.50 to 1.54 (over the aero range) |
| Gen4 qualifying gain over that lap, first prior (tender aero) | 4.9 s |
| Gain quoted by engineers and the series | 8 to 10 s per lap |
| High-downforce SCz needed for an 8 s gain (with 7.5 % more grip) | about 4.6 |
| Porsche "up to 150 percent more downforce" applied to Gen3 Evo SCz 1.75 | 4.4 |

The simulator's Monaco is 3267 m against 3337 m official, so absolute times run about 2 % short; the difference
between the two cars is not affected.

### 7.2 Revisions made from the checks

| Value | First prior | Revised prior | Why |
|---|---|---|---|
| Drive efficiency, battery to wheel | 0.97 (series claim) | 0.90 (bounds 0.88 to 0.97) | 0.97 gives 0-200 km/h in 4.19 s; the published 4.4 s needs about 0.90, a normal inverter, motor and gear chain |
| High-downforce package | SCz 3.0, SCx 0.75 (tender target) | SCz 4.4, SCx 1.10 (bounds 3.0 to 6.0, 0.75 to 1.18) | the Monaco gain and the Porsche claim agree on about 4.4 to 4.6; drag keeps the tender lift/drag ratio of 4.0 |
| Lateral grip | 1.6, basis "below the F1 slick" | 1.6, basis Gen3 Evo 1.52 times 1.05 | same value, now tied to a real lap and the reported 5 to 10 % grippier tyre |
| Low-downforce package | SCz 2.0, SCx 0.65 | unchanged | no evidence against the tender target |

All other start values are unchanged: traction grip 1.65, braking grip 1.5, speed cap 340 km/h.

### 7.3 Revised prior against the published claims

| Check | Revised prior | Claim |
|---|---|---|
| 0-100 km/h, 600kW | 1.80 s low downforce, 1.75 s high downforce | about 1.8 s |
| 0-200 km/h, 600kW | 4.38 s low downforce, 4.47 s high downforce | 4.4 s |
| Top speed, low downforce, 600kW | reaches the 340 km/h cap | 335 km/h claimed, 338 km/h reported |
| Monza top speed, high downforce, 600kW | 320 km/h | about 320 km/h (Porsche test, unofficial) |
| Monza lap, qualifying car | 1:30.0 | "1:32 range" on used tyres, no qualifying run |
| Grip needed to match 1:32.5 at Monza | 1.45 (high downforce), 1.52 (low downforce), both 600kW | inside the bounds 1.3 to 2.0 |
| Monaco gain over the Gen3 Evo duel lap | 6.7 s (7.4 s with 7.5 % more grip) | 8 to 10 s |

Prior lap times on the F1 layouts in the simulator (the Formula E layouts may differ, so these are not event predictions):

| Track | Qualifying | E-Prix Unleashed, Race Mode | E-Prix, Race Mode | E-Prix, Attack Mode | Flat-out net energy per lap, E-Prix Race Mode |
|---|---|---|---|---|---|
| Monza | 1:30.02 | 1:35.52 | 1:35.52 | 1:30.98 | 6.10 kWh |
| Zandvoort | 1:26.32 | 1:29.51 | 1:33.09 | 1:30.75 | 3.24 kWh |
| Mexico City | 1:22.91 | 1:26.26 | 1:28.07 | 1:25.45 | 3.84 kWh |
| Monte Carlo | 1:19.56 | 1:21.89 | 1:24.72 | 1:22.85 | 2.30 kWh |

Which unknown matters (Monza, qualifying car, change of lap time over the prior range):

| Unknown | Range | Lap time change |
|---|---|---|
| Lateral grip | 1.3 to 2.0 | +4.2 s to -4.3 s |
| Downforce, high package SCz | 3.0 to 6.0 | +2.0 s to -2.0 s |
| Drive efficiency | 0.88 to 0.97 | +0.4 s to -1.3 s |
| Drag, high package SCx | 0.75 to 1.18 | -0.9 s to +0.2 s |
| Braking grip | 1.3 to 1.9 | +0.5 s to -0.7 s |
| Traction grip | 1.5 to 2.0 | +0.2 s to -0.3 s |
| Rolling resistance | 0.010 to 0.020 | -0.25 s to +0.25 s |
| Centre-of-gravity height, aero balance | full range | 0 s |

Reading: tyre grip and downforce decide the lap time, so they are the first values to fit from the Jarama test.
Centre-of-gravity height and aero balance do not enter this model (all four tyres drive and the car is a point mass),
so they are not needed until the axle model is switched on.

Known limits: one power value per lap (no Attack Mode timing inside a lap, no lift-and-coast, no race energy strategy
yet); the front 250 kW and rear 350 kW caps are not applied per axle; regeneration is counted after the lap from the
speed trace (share 0.9, 700 kW limit) and does not change the lap; no Formula E track layouts except Monaco; the
revised high-downforce values rest on two claims, not on a measurement.

### 7.4 How it gets revised next

1. Jarama test (16, 18, 20 November): build or accept the Formula E Jarama layout (3.934 km, extra chicane), solve the
   Gen3 Evo grip there from 1m29.888s (350 kW) and 1m31.881s (300kW), then fit Gen4 lateral grip and SCz per package
   from the session-best laps, all else fixed. Report the change against the table in 7.2.
2. Jeddah Bulletins (about 27 November): replace the session plan in `FE_GEN4_MODES` with the published aero
   configuration, Race Mode power, Attack Mode time and energy values.
3. Jeddah race (18 and 19 December): first hide-and-predict check; then the race energy model.

## Sources

- FIA Formula E Technical Regulations 2026-2027 V4 (fia.com), via `worker/lapsim/rules-data.js`
  https://www.fia.com/system/files/documents/2026-2027_season_13_formula_e_techregs_wmsc_30.09.2026_eng_fr_v21.pdf
- FIA Formula E Sporting Regulations 2026-2027, published 30.09.2026 (77 PDF pages)
  https://www.fia.com/system/files/documents/2026-2027_fia_formula_e_world_championship_-_sporting_regulations_30.09.2026_-_clean_2.pdf
- https://www.fiaformulae.com/en/formula-e-gen4-unleashed
- https://www.fiaformulae.com/en/news/explainers/explained-formula-es-new-sporting-format-for-the-202627-season
- https://www.fiaformulae.com/en/what-is-formula-e
- https://www.fiaformulae.com/en/news/872603/everything-you-need-to-know-about-pit-boost-in-formula-e
- https://www.fia.com/news/building-stronger-future-fia-championships-updated-regulations-approved-world-motor-sport
- https://www.motorsportweek.com/2026/06/23/f1-classics-on-formula-e-calendar/
- https://e-formula.news/news/formula-e-news/formula-e-news-detail/freedom-for-manufacturers-pit-boost-remains-technical-regulations-for-formula-e-gen4-car-published-71621
- https://competition.totalenergies.com/en/auto/formula-e/formula-e-rules
- https://forums.autosport.com/topic/224023-fia-launches-tenders-for-formula-e-gen4/
- https://www.spa.gov.sa/en/N2680740
- https://www.the-race.com/formula-e/what-we-learned-private-formula-e-gen4-test/
- https://racingnews365.com/key-details-from-extraordinary-porsche-formula-e-monza-test-revealed
- https://e-formula.news/news/formula-e-news/formula-e-news-detail/porsche-gen4-stuns-at-monza-formula-e-car-hits-320-km-h-and-matches-f2-pace-31243
- https://www.dive-bomb.com/article/what-we-learnt-from-porsche-s-special-gen4-test-at-monza
- https://e-formula.news/news/formula-e-news/formula-e-news-detail/formula-e-gen4-pre-season-test-schedule-confirmed-2-race-simulations-planned-21859
- https://fiaformulae.com/en/news/1071341/jarama-to-host-formula-e-2026-27-pre-season-testing
- https://www.fiaformulae.com/en/news/1072926/video-formula-e-s-new-gen4-car-is-out-of-this-world-
- https://www.autosport.com/formula-e/news/inside-formula-es-most-ambitious-car-yet-the-making-of-gen4/10804187/
- https://www.batterydesign.net/gen-4-formula-e-battery/
- https://e-formel.de/nachrichten/formel-e-news/formel-e-news-detail/formel-e-test-von-porsche-im-video-gen4-verbluefft-in-monza-mit-f2-rundenzeit-320-km-h-10601
- https://www.the-race.com/formula-e/five-things-we-learned-formula-e-rookie-test-jarama/
- https://racesimstudio.com/rss-formula-e
- https://e-formula.news/news/formula-e-news/formula-e-news-detail/facts-figures-and-data-the-best-statistics-on-the-formula-e-races-in-monaco-2026
- https://racingnews365.com/f1-drivers-hold-conversations-with-formula-e-ceo-over-gen4-private-test
- https://www.bridgestone.com/corporate/news/2026100101.html
- https://newsroom.porsche.com/en_US/2026/motorsport/porsche-975-rse-formula-e-gen4-presentation-42191.html
- https://theevreport.com/nissan-formula-e-gen4-car-power
- https://en.wikipedia.org/wiki/Formula_E_Gen4
- https://racingnews365.com/bridgestone-unveil-formula-e-tyres-ahead-of-world-championship-return
- https://theevreport.com/bridgestone-formula-e-tires-potenza-gen4
- https://www.the-race.com/formula-e/bridgestone-formula-e-post-f1-snub/
- https://fenotebook.com/2026/07/14/formula-e-eyeing-slick-tyres-for-2028/
- https://e-formula.news/news/formula-e-news/formula-e-news-detail/austin-brands-hatch-zandvoort-confirmed-formula-e-unveils-its-2026-27-gen4-race-calendar-featuring-21-races-94843
- https://fiaformulae.com/en/news/1074658 (calendar, from `scripts/sim/data/track-requests.json`)
