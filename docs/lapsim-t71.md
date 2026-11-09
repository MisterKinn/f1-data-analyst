# Timing71 archive — reader, collector, checks

Source: Timing71 replay archive (`archive.timing71.org`, files on Backblaze). Timing data belongs to each
series' timing provider; Timing71 publishes no data terms. **Calibration use only**: raw files and
per-series summaries stay in the GitHub Actions cache; this repo commits only counts, checks and fit
results. Credit: "Timing71 archive".

## Files

| File | What |
|---|---|
| `scripts/sim/t71-read.mjs` | Replay ZIP → one row per completed lap (lap, time, all sector columns, tyre, tyre age, VFT, speed trap, class, driver, flag, pit) + frame weather + end flag. Own dictdiffer patcher (no AGPL code imported). |
| `scripts/sim/t71-collect.mjs` | Lists the archive, picks qualifying + race sessions (2018+) of the series below, reads them in 8 shards, writes a compact per-car summary. |
| `scripts/sim/t71-tracks.mjs` | Session name → track id (keyword table + "nearby session" rule). |
| `scripts/sim/t71-check.mjs` | Three-way check vs the calibration references (TI/OpenF1 for F1, Al Kamel for WEC). |
| `scripts/sim/gate.mjs` | Held-out gate used by every fit (see below). |
| `scripts/sim/wec-tyre-fit.mjs` | WEC compound effect from race stints (K3). |
| `.github/workflows/lapsim-t71.yml` | Collect → merge → check → fit; commits only small outputs. |

## Reader checks (22 real sessions, 11 series)

- Frame lap *n* = analysis-file lapNumber *n + 1* (same offset on every series).
- Lap times equal to the analysis file on 99.9%+ of laps in 19 sessions. F1 qualifying replays are
  partly incomplete (107/204 laps in one sample); F1 is cross-check only.
- Sector sum = lap time (±0.002 s) on ≥95% of laps where all sectors exist.
- Nürburgring feeds have no analysis file (frames only), 9 sectors, and "track data" = slow zones, not weather.
- Some feeds (ALMS, VLN) have no `Laps` column: a lap is counted when `Last` changes.

## Collection (run 3)

1,845 sessions, 0 failures. Per series (Q / R): F1 172/156, WEC 129/65, IMSA 111/146, FE 245/151,
GTWC 86/93, IGTC 35/23, DTM 29/31, Nürburgring 25/47, Macau 34/28, ELMS 106/55, ALMS 38/40.
About 150 sessions hold no laps (short partial recordings of 5–50 min, split feeds).

**Replays are often incomplete.** Share that reached the chequered flag: WEC Q 101/129, IMSA Q 79/111,
F1 Q 107/172, FE Q 105/245, GTWC Q 52/86 (Nürburgring feeds have no chequered flag state). A qualifying
best is used as a pole reference only when the replay reached the chequered flag.

## Track ids

1,785 / 1,845 sessions mapped. Not mapped (listed, not guessed): 57 GTWC Europe 2018–19 sessions named
only "Round N", 3 sessions of IMSA "Motul 100% Synthetic Grand Prix" 2020.

## Three-way check (TI / OpenF1 · Al Kamel · Timing71), 108 reference laps

| Result | Rows |
|---|---|
| Same lap (±0.0015 s), sectors identical | 59 |
| Timing71 slower: reference lap not recorded (Hyperpole / Q3 missing, partial replay) | 26 |
| **Timing71 faster (real conflict)** | **0** |
| Event not in the archive | 23 |

Weather on the same sessions: air and track temperature within about 1 °C of the references.

## Tyre field

Timing71 tyre cells are `[letters, colour label]`. Letters (S/M/H/W, one per corner on a mixed set, e.g.
`SMSM`) match the known WEC allocations (`wec-tyres-data.js`) on 549/549 best laps; the colour label is
wrong on 44/523 (e.g. Fuji 2026 "hard" when only soft/medium were supplied). The letters are used.

## Gate (applies to every fit)

A new model is kept only if its held-out error (leave-one-event/track-out or unseen season) is lower
than the current model's on the same rows, beyond one standard error of the paired squared-error gain,
with at least 5 rows. Otherwise the current model stays and the result is written here as rejected.
The test can be applied per group (series, class, track) so a model is used only where it helps.

## K3 — WEC compound effect: rejected

Method: race stints 2024+ with ≥5 green laps; stint best green lap as % of the race trend (Theil–Sen line
over stint start time, removes track evolution and fuel); car mean removed; residual = k × tyre score
(S 0, M 1, H 2, mean over corners). Leave one event out. Variants declared before testing.

| Variant | Rows | Events | k (%/step) | LOO RMS no effect | LOO RMS model | Gate |
|---|---|---|---|---|---|---|
| Hypercar, same car | 643 | 6 | 0.163 | 1.406% | 1.444% | rejected (worse) |
| Hypercar, same car + driver | 550 | 6 | 0.189 | 1.495% | 2.035% | rejected (worse) |
| LMGT3 | 0 | 0 | — | — | — | no car ran two compounds in one race |

Stint-to-stint noise (~1.4%) is far larger than any compound step. The page keeps
"not measured, lap unchanged". No further variants were tried (that would tune on the test set).

## J6 — Stints (2026-11-09)

**Full-stint rule.** Timing71 marks local yellows as `yellow`; Al Kamel's flag column only marks
full-course neutralisations. A full stint is therefore "no FCY / VSC / SC / Code 60 / red lap"
(local yellows are racing laps). With this rule Timing71 and Al Kamel give the same full stint (±1 lap)
for **68 / 80** Hypercar cars in 2025–2026; the other 12 are cases where Timing71 finds no full stint
(stricter), never a different value. Stint lengths themselves are identical in both sources.

**Duplicates.** Two archive replays can share series, description and minute; session files are now named
by the archive's own file name, duplicates are dropped at merge (more laps kept), unreadable files skipped.

**Stint energy fit with 2024 rows** (`scripts/sim/t71-stints.mjs` → `scripts/sim/data/t71-wec-stints.json`,
used by `stint-fit.mjs` for events with no Al Kamel file; 2024 BoP stint energy from the eight FIA
decisions, see `docs/lapsim-wec-bop.md`):

| Rows (leave one event out) | Previous model (k from 2025 only) | Candidate (k from 2024 + 2025) |
|---|---|---|
| 2024: 30 rows, 4 events — **never used to fit the previous model** | **3.04 %** | 3.11 % |
| 2025: 29 rows, 4 events | 3.74 % | 3.58 % |
| All | 3.40 % | 3.35 % |

Gate: **rejected (gain within noise)** → model unchanged (k = 0.857). The unseen-season test (3.04 % on 2024)
is shown on the page under the stint table.

**IMSA GTP energy per lap from VFT** (`scripts/sim/t71-imsa-vft.mjs` → `scripts/sim/data/t71-imsa-vft.json`):
a measurement, not a model. Stints with no full-course lap, ≥10 laps, starting on a full virtual tank
(VFT ≥85 %) and ending ≤40 %; % per lap = ΔVFT / (laps − 1), median per car. Examples (median %/lap of the
stint energy): Road Atlanta 2024 2.27, 2025 2.25; Indianapolis 2025 2.16, 2026 2.26; Sebring 2025 3.32;
Daytona 2026 3.28; Road America 2026 3.66 (× 912 MJ BoP ≈ 33 MJ/lap). Turning this into the lap-simulator
energy model needs IMSA track geometry (step 9). VFT exists from late 2024 (21 races).

## Fits round 2 (2026-11-09)

Every candidate below went through the held-out gate. Only accepted changes reach the page.

| Candidate | Test | Result |
|---|---|---|
| WEC class fits + Timing71 2023–24 qualifying bests (half weight; `t71-wec-extra.json`, 11 rows) | leave-one-track-out on each calibrated season, **inside `calibrate.mjs`** (real pipeline: top-3 Al Kamel laps) | **all 6 class-seasons rejected** — LMH 2025 3.80→3.76 % (noise), 2026 1.28→1.42 %; LMDh 2025 3.87→4.01 %, 2026 1.40→1.42 %; LMGT3 2025 2.22→2.15 % (noise), 2026 1.48→1.45 % (noise). Model unchanged. A simplified local experiment (best car only, `t71-wec-pool.mjs`) had accepted 2025; the pipeline gate shows it does not hold with the real inputs. The gate stays in `calibrate.mjs` and re-tests on every run. `LAPSIM_ONLY=wec` refits WEC alone (F1 kept). |
| GT3 transfer: WEC LMGT3 car vs GTWC / DTM / IGTC qualifying (`t71-gt3.mjs`) | one pace factor per series, leave one track out | **not enough data**: 4 usable sessions on simulator tracks (GTWC Europe in the archive is mostly 2018–19; GTWC America meets our tracks only at COTA). A GT3 class needs new track geometry. |
| Track temperature + 189 Timing71 sessions of other series at the same circuits (F1 replays excluded) | leave-one-event-out on the F1 events | **rejected** (3.97 → 3.97 °C). Unseen-series test of the current model: **4.96 °C** on those sessions (recorded in `tracktemp-data.js`). First run showed 16.9 °C: some feeds store missing weather as 0 or garbage (air 255 °C); values outside air 1–45 °C / track 1–70 °C are now dropped in the collector. |
| LMGT3 full-stint lengths (`t71-lmgt3-stints.mjs`) | measurement | table per event and brand (e.g. Le Mans 11 laps for all, Bahrain ~25, Interlagos ~33). No fuel model: per-car fuel capacity is not published with the BoP. Some 2025–26 feeds have no car make. |
| Track evolution + 60 Timing71 WEC practice/qualifying tables 2021–24 (`t71-collect.mjs` with `T71_EVO=1`) | same-track-other-season holdout on the Al Kamel sessions only | **rejected**: practice end error 0.827 → 0.885 %, qualifying 1.235 → 1.946 %. WEC evolution stays off; F1 unchanged (WEC-only session-name matching). |

## Step 1a — wet session hidden in the data (2026-11-09)

COTA 2025 WEC qualifying/Hyperpole ran on a wet track (official reports), but the Al Kamel weather shows no
rain. It was fitted as a dry session: Hypercar laps 5 % slower than 2026 and speed traps 241–259 km/h
(~300 in 2026). Now listed in `scripts/sim/data/wet-sessions.json` with sources and skipped like any wet session.
`calibrate.mjs` warns when a class speed trap is under 90 % of the same class at that track in other years.

| WEC 2025 holdout (track left out) | Before | After |
|---|---|---|
| LMH | 3.80 % | 1.54 % |
| LMDh | 3.87 % | 1.61 % |
| LMGT3 | 2.22 % | 2.14 % |

F1 and all 2026 cars unchanged (identical). Note for step 3: Hypercar ClA sits at its upper bound (7.0) and
LMGT3 at 3.5 in every fit — the fit compensates for missing physics.
