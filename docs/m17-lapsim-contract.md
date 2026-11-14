# M17 power unit and LapSim: data contract

Contract version: **0.2.1 (draft)**. Date: 2026-11-14. Code read: upstream `main` at `fe3d758`.
Status: proposal. No code reads or writes these files yet. This document changes no code.

Rules that stand above this file: `docs/lapsim-physics-rules.md` (the project copy is
`claude/lapsim-physics-rules.md`). If the two disagree, the physics rules win.

---

## 1. Purpose

Two projects exchange data. They share no code.

| Project | What it is | Where |
|---|---|---|
| **M17** | The owner's own model of an F1 power unit, with the Mercedes M17 as its subject. It is a separate, unfinished project. It has two parts: a CAD model and analysis models (section 10.2). It is built from regulations and public information, not from manufacturer data. | Outside this repo |
| **LapSim** | The lap simulator | `worker/lapsim/`, `scripts/sim/` |

The only link is a set of **table files**. Each file flows **one way**.

| Direction | Content | Section |
|---|---|---|
| M17 → LapSim | Power unit tables (candidate model inputs) | 6 |
| LapSim → M17 | Load cases (model output of a simulated lap) | 7 |

No file is edited by the receiving side. A correction is a new file version from the sender.

## 2. Hard rules

1. **Every M17 value is evidence layer 4** (Borrowed, label "Low, wide range") under section 3.1 of the physics rules. This is true even when the M17 file says a value is well founded. M17 cannot raise its own layer.
2. **Flag off by default.** M17 values are used only behind one flag (proposed name `LAPSIM_M17`, not created yet). With the flag off, LapSim does not open the M17 files and its output is byte-identical to before (physics rule 2.4).
3. **Gate required.** An M17 value enters production only after `scripts/sim/gate.mjs` accepts it on all rows, no group is worse, F1 2025 and F1 2026 held-out error is not higher than the production baseline in the same run, and the owner approves a separate PR (physics rules 2.1, 2.2, 2.6, 2.11).
4. **M17 never replaces a measured value.** If a layer 1, 2 or 3 value exists for the same quantity, that value is used and the M17 row is ignored. See 2.1 below.
5. **One value, one flag setting.** Each M17 table or scalar is tested alone (physics rule 2.4).
6. **Label everywhere.** Any output that used an M17 value shows "layer 4, M17 model" and the held-out error of its test (physics rule 2.7).
7. **No loop without a record.** If an M17 table was built with a LapSim load case, its manifest must name that load case version. Such a table cannot be validated on the same sessions the load case came from (physics rule 2.3).
8. **Raw third-party data stays out of both directions** (physics rule 2.9). Only derived tables with a source line.
9. **The same protection in the other direction.** LapSim is also unfinished. A load case is never proof for M17. M17 must not fix a design value, or call itself validated, because of a LapSim load case alone. M17 keeps load-case use behind its own switch, off by default, so M17 gives the same result without LapSim.
10. **Unfinished stays out.** A table or load case marked `draft` in its manifest is for reading only. The other side must not compute with it.

### 2.1 Which value wins

| Quantity | Source that wins today | Layer | Role left for M17 |
|---|---|---|---|
| Fuel energy flow limit, ERS-K power limit and speed taper, battery window, recharge per lap | Regulations (`rules-data.js`, `erskLimitW`, `energy-limits.js`) | 1 | None. M17 is checked against these and rejected if it exceeds them. |
| Gear ratios | RPM, speed and gear channels (build step 1) | 2 | None |
| ICE power level (`pIce`) | Fitted to real laps, bounded to ±15 % of the rules estimate (`calibrate.mjs`, `BOUNDS.pIce`) | 3 | None for the level. See the warning below. |
| Torque curve shape | Not in the model today (constant power). Build step 2 will infer it from acceleration. | 3, when built | Shape only, normalised, until step 2 exists. Then step 2 wins. |
| `etaErs` 0.95, `etaRegen` 0.9, `etaDrive` 0.96, `inertiaFactor` 1.06, air-density exponent 0.15 | Assumed constants in `cars.js` and `kernel.js` | 4 | Candidate replacement, layer 4 against layer 4, through the gate |

When M17 and a higher layer disagree, LapSim does not average them. It keeps the higher layer and reports the conflict.

**Warning about `pIce`.** In `calibration-data.js` (generated 2026-11-09) the fitted `pIce` is 340 kW for 2026 and 476 kW for 2025. Both are exactly the lower bound (400 kW and 560 kW × 0.85). Under physics rule 3.4 a value at its bound is a finding: physics is missing, and the number absorbs other errors. So:

- M17 must not use the LapSim `pIce` as the real ICE power, as a target, or as a check of its own curve.
- LapSim must not move `pIce` toward an M17 number either. An M17 curve that disagrees is written down as a conflict, nothing more.

## 3. File rules (both directions)

| Item | Rule |
|---|---|
| Format | CSV, UTF-8, LF line ends, comma separator, dot decimal, no thousands separator, one header row |
| Sidecar | One `manifest.json` per delivery (section 3.1) |
| File name | `m17-<table>-v<MAJOR.MINOR.PATCH>.csv` or `lapsim-<table>-v<MAJOR.MINOR.PATCH>.csv` |
| Column name | `quantity_location_unit`, lower case, for example `torque_crank_Nm`, `power_dc_W` |
| Missing value | Empty cell. Never `0`, `-1`, `NaN` or text. |
| Grid axes | Strictly increasing. Maps are full rectangles. |
| Outside the grid | LapSim holds the edge value and counts how many points did so. No extrapolation. |
| Numbers | Plain decimal or `1.2e5`. At least 5 significant digits. |
| Proposed place, M17 → LapSim | `scripts/sim/data/m17/` |
| Proposed place, LapSim → M17 | Workflow artifact or `probe-out/m17-loadcases/` (not committed) |

### 3.1 Manifest fields

| Field | Meaning | Required |
|---|---|---|
| `contract_version` | Version of this document the file follows | Yes |
| `direction` | `m17-to-lapsim` or `lapsim-to-m17` | Yes |
| `status` | `draft` or `released` (hard rule 10) | Yes |
| `created_utc` | ISO 8601 time | Yes |
| `producer` | Project name and its revision (commit or model revision) | Yes |
| `rule_set` | `f1-2026` and the regulation issue used (LapSim uses Section C, Issue 21, 19 Oct 2026) | Yes |
| `files[]` | Name, table version, row count, SHA-256 | Yes |
| `evidence_layer` | M17 files: always `4`. LapSim files: `model output`. | Yes |
| `columns[]` | Name, unit, sign rule, measuring location | Yes |
| `source[]` | Per column or scalar: regulation article, public document with link, or `assumption` | Yes |
| `uncertainty[]` | Per column or scalar: low and high as a fraction of the value | Yes for M17 |
| `depends_on_loadcase` | Load case version used to build the table, or `null` | Yes for M17 |
| `lapsim_inputs` | Track, car, year, weather, flags, calibration file version, held-out error of the car group | Yes for LapSim |

## 4. Units

SI only, in every file.

| Quantity | Unit | Not allowed |
|---|---|---|
| Power | W | kW, hp |
| Energy | J | MJ, kWh |
| Torque | N·m (`Nm` in names) | |
| Rotational speed | rad/s | rpm |
| Speed | m/s | km/h |
| Distance, length | m | |
| Time | s | |
| Mass | kg | |
| Inertia | kg·m² | |
| Force | N | |
| Acceleration | m/s² | g |
| Temperature | K | °C |
| Pressure | Pa | bar, hPa |
| Density | kg/m³ | |
| Angle | rad | degrees |
| Fuel energy flow | W | MJ/h |
| Efficiency, share | Fraction 0–1 | percent |

The LapSim kernel is already SI inside (W, J, m/s). It uses km/h only for the ERS-K taper and for display fields (`vMaxKph`, `cutoffKph`, `clipFromKph`). The export converts these.

## 5. Sign and axis rules

| Item | Rule |
|---|---|
| Car axes | Directions as in ISO 8855: x forward, y left, z up. Origin chosen by this contract: front axle centre line, on the car centre plane, at ground level. A power unit position has negative x. |
| Shaft speed | Positive in the normal running direction |
| Torque and mechanical power | Positive when it drives the car forward |
| MGU-K electrical power (`_dc`) | Positive = deploy (battery to motor). Negative = harvest. |
| Battery energy | Stored energy in J. Rises when charging. |
| Power location | Every power column names where it is measured: `_crank` (ICE output shaft), `_mech` (MGU-K shaft), `_dc` (DC side, as in Article C5.2.7), `_wheel` |
| Longitudinal acceleration | Positive forward. Braking is negative. |
| Lateral acceleration | Positive to the left |
| Distance `s` | From the start line along the LapSim line, in the driving direction, `0 ≤ s < lap length`, fixed step `ds` |
| Time `t` | From the start line, flying lap |
| Grade | Positive uphill |
| Limit code | 0 lateral, 1 traction, 2 power, 3 braking (as in `kernel.js`) |

Note: the kernel keeps deploy and harvest as separate arrays that are never negative (`flow.dep`, `flow.brk`, `flow.thr`, J per step). The export must turn them into the signed `_dc` rule above.

## 6. Tables: M17 → LapSim

All are candidates. None is used today. Each needs its own gate run.

### 6.1 `m17-ice-fullload` (full-throttle curve)

| Column | Unit | Note |
|---|---|---|
| `speed_crank_rad_s` | rad/s | Axis |
| `torque_crank_Nm` | N·m | |
| `power_crank_W` | W | Must equal speed × torque within 0.1 % |
| `fuel_energy_flow_W` | W | Must not exceed the regulation limit (3000 MJ/h = 833 333 W in 2026) |

Use in LapSim: shape of the torque curve only (physics rules 4.4, item 1). The curve is scaled so its peak power equals the fitted `pIce`. Blocked until gears exist (build steps 1–3), because LapSim has no engine speed today.

### 6.2 `m17-mguk-envelope`

| Column | Unit | Note |
|---|---|---|
| `speed_mech_rad_s` | rad/s | Axis, MGU-K shaft |
| `torque_motor_max_Nm` | N·m | Positive |
| `torque_gen_max_Nm` | N·m | Negative |
| `eff_motor` | Fraction | DC to shaft |
| `eff_gen` | Fraction | Shaft to DC |

Use in LapSim: candidate for `etaErs` and `etaRegen`. The power limits stay with the regulations.

### 6.3 `m17-scalars`

Columns: `key`, `value`, `unit`, `lo`, `hi`, `source`.

| Key | Unit | LapSim value it could inform |
|---|---|---|
| `eff_driveline` | Fraction | `etaDrive` |
| `inertia_crank_kg_m2` | kg·m² | `inertiaFactor` (needs gears to convert) |
| `ice_density_exponent` | — | `beta` in `icePowerFactor` |
| `speed_crank_max_rad_s`, `speed_crank_idle_rad_s` | rad/s | Shift model (build step 3) |
| `mass_pu_kg` | kg | Information only. Car mass is layer 1. |
| `cog_pu_x_m`, `cog_pu_y_m`, `cog_pu_z_m` | m | Information only, for the axle model inputs |
| `eff_es_roundtrip` | Fraction | Candidate inside `etaErs` × `etaRegen` |

### 6.4 Not accepted in version 0.1

Gear ratios, part-load fuel maps, thermal limits, and any regulation limit. Gear ratios come from data (layer 2). Regulation limits come from LapSim's own rule files.

### 6.5 Checks on arrival

1. SHA-256 matches the manifest.
2. Header, units and contract major version match this document.
3. Axes increase. No value outside its `lo`–`hi`.
4. No value above a regulation limit. If one is, reject the whole file.
5. Every column has a source and an uncertainty.

## 7. Load cases: LapSim → M17

M17 may read only what `simulateLap` returns today, plus values derived from it by plain arithmetic.

### 7.1 `lapsim-loadcase-trace` (one row per track point)

| Column | Unit | From |
|---|---|---|
| `s_m` | m | Point index × `ds` |
| `t_s` | s | `time[]` |
| `v_m_s` | m/s | `v[]` |
| `a_x_m_s2` | m/s² | Derived from `v[]` and `ds` |
| `a_y_m_s2` | m/s² | `v²` × curvature. Positive curvature is a left turn (`geometry.js`: heading counter-clockwise from east, curvature = change of heading per metre). No banking term. |
| `limit_code` | — | `limit[]` |
| `ice_full_power` | 0 or 1 | 1 where `limit_code` = 2. Approximate: see the limits below. |
| `power_k_dc_W` | W | (`flow.dep` − `flow.brk` − `flow.thr`) ÷ step time, signed |
| `energy_k_deploy_J`, `energy_k_brake_J`, `energy_k_throttle_J` | J | `flow.dep`, `flow.brk`, `flow.thr` |

Limits of this trace, read from `kernel.js`:

- Step time is `ds ÷ mean(v[i], v[i+1])`, with the mean never below 1 m/s. The export must use the same rule.
- `ice_full_power` is an assumption. The kernel does not return ICE power. Code 2 can also appear where speed is held by the car's top-speed cap, so the flag may be 1 where the real engine is not at full power.
- `flow.brk` and `flow.thr` are **not** cut at the per-lap recharge limit. Their sum can be higher than `energy_recharge_max_J`. M17 must not read the sum as energy that reached the battery.
- `flow` is empty for a car with no ERS.

### 7.2 `lapsim-loadcase-summary` (one row per lap)

| Column | Unit | From |
|---|---|---|
| `lap_time_raw_s` | s | `lapTime` from the kernel. Equal to the sum of the trace step times. |
| `lap_time_shown_s` | s | Lap time the site and the `lapsim_simulate` tool show. On raced tracks it is the raw time plus a sector correction (`sectorCorrection` in `tool.js`). |
| `energy_deploy_J`, `energy_regen_J`, `energy_budget_J` | J | `energy.deployJ`, `regenJ`, `budgetJ`. `regenJ` already includes the throttle harvest. |
| `energy_recharge_max_J` | J | `energy.rechargeMaxJ`, with its status: official, provisional or estimated |
| `energy_throttle_harvest_J` | J | `energy.throttleHarvestJ` |
| `v_cutoff_m_s`, `v_clip_from_m_s` | m/s | `energy.cutoffKph`, `clipFromKph`, converted |
| `v_max_m_s`, `v_min_m_s` | m/s | `vMaxKph`, `vMinKph`, converted |
| `share_full_power` | Fraction | Time share with `limit_code` = 2 |
| `battery_window_J` | J | `flow.soc` |

The inputs of the run go in the manifest: track, car, year, air density, temperatures, ICE factor, flags, calibration version.

### 7.3 What M17 cannot have yet

| Wanted | Why not |
|---|---|
| Engine speed, gear, shift events | LapSim has no gears (physics rules 4.3, limit 4). Available after build steps 1–3. |
| ICE torque or power at part throttle, throttle position | The kernel does not return it. Needs a new output behind its own PR. |
| Race stints, fuel mass over a stint, thermal state | The load case is one qualifying lap from a full battery. |
| Transients | The model is quasi-steady-state. |

### 7.4 How M17 must treat a load case

- It is model output, not a measurement. M17 labels it "LapSim model output" with the held-out error of that car group.
- A raced session reproduces the real lap time only because `tool.js` adds a sector correction (real pole sectors minus simulated sectors) after the simulation. The speed trace is **not** corrected. M17 must use `lap_time_raw_s` with the trace, never `lap_time_shown_s`.
- The trace is not checked to lap-time level: corner minimum speeds are too low and some top speeds differ from the real trap (physics rules 3.4).
- The held-out error in `calibration-data.js` is 0.84 % for F1 2025 (n = 20) and 0.90 % for F1 2026 (n = 14). It is a lap-time error. No error is measured for power or energy along the lap.
- A load case from a run with experiment flags on must say so in the manifest.

## 8. Versioning

| Change | Version step |
|---|---|
| Column removed or renamed, unit, sign or axis changed | Major |
| New optional column or new table | Minor |
| Text only | Patch |

A file with a different major version is rejected. Table data versions are separate from the contract version. This document changes only through a PR on a `docs/m17-` branch.

## 9. Path of one M17 value into LapSim

1. M17 delivers the table and manifest.
2. Checks of 6.5 pass.
3. One flag setting is declared with the baseline, metrics and pass check (physics rules 5).
4. Run with the production baseline in the same experiment. Convergence shown.
5. One hide-and-predict test for the value (physics rules 3.2).
6. Gate accepted, F1 not worse, physical sense checked.
7. Separate PR, owner approval. The value stays labelled layer 4.

Known limit: F1 is fitted per season with a small team factor today. A value for Mercedes-powered cars only cannot be tested per team until the per-car fit of physics rules 4.1 exists. With n under 5 the gate rejects by rule.

## 10. Decisions and open points

### 10.1 Decided by default

These are working decisions, chosen to be the safest option under the physics rules. The owner can change any of them with a PR to this file.

| # | Topic | Decision |
|---|---|---|
| 1 | Cars | One M17 table set for all cars that use the power unit. LapSim fits F1 per season, so a per-team table has no test today. |
| 2 | Flag | `LAPSIM_M17`, one setting per table (`ice-shape`, `mguk-eff`, `scalars:<key>`). Unset means off. |
| 3 | Format | CSV plus `manifest.json`, as in section 3. |
| 4 | Place | Released M17 tables in `scripts/sim/data/m17/`. Load cases stay workflow artifacts and are not committed. |
| 5 | Axes | Files use the section 5 axes. If the M17 CAD uses other axes, M17 converts on export and says so in the manifest. |
| 6 | Uncertainty | One low–high fraction per column or scalar is required. A range per row is optional. |
| 7 | Sources | Regulations, FIA documents, patents, published papers, manufacturer statements. A press report is marked `press`. A value read from photos or guessed is marked `assumption`. |
| 8 | Engine speed and gear | Not in the load case until build steps 1–3 exist. No borrowed gear ratios. |
| 9 | Load case scope | One qualifying lap, 2026 car, tracks the 2026 car was fitted on. Start with one low-recharge and one high-recharge track. |
| 10 | Export script | Allowed later as its own PR: a read-only script in `scripts/sim/` that changes no kernel output. A part-load output in the kernel is a separate flagged PR. |
| 11 | Site | No M17-based number is shown to users before it has passed the gate. After that it carries the layer 4 label. |
| 12 | Later years | M17 is a 2026 model. LapSim keeps scaling 2027 and 2028 from the rules, without M17. |

### 10.2 M17 scope (decided 2026-11-14)

M17 is treated as both a CAD model and an analysis model. Basis: the owner's site plan describes power units that are estimated in CAD and then simulated, and the M17 project is choosing analysis programs to install. Both parts are unfinished.

| M17 part | Tables it can supply | State today |
|---|---|---|
| CAD | `m17-scalars`: mass, centre of gravity, crank inertia | Not delivered. `draft` when it arrives. |
| Analysis (engine and electrical simulation) | `m17-ice-fullload`, `m17-mguk-envelope`, efficiencies in `m17-scalars` | Not delivered. `draft` when it arrives. |

A table becomes `released` only when M17 states how it checked the table against a source outside LapSim. Until then hard rule 10 applies and LapSim does not compute with it. Nothing in LapSim waits on M17.

### 10.3 Findings for the LapSim side (not fixed here, docs only)

| Finding | Where | Why it matters |
|---|---|---|
| `pIce` is at its lower bound for 2025 and 2026 | `calibration-data.js`, `calibrate.mjs` | Section 2.1. Add it to the known open points of the physics rules. |
| The tool and page text said 2026–2028 energy is harvested only under braking | `tool.js`, `simulation.js`, `docs/simulation-plan.md` | Checked by running the kernel: the fitted 2026 car recovers 0.4–1.5 MJ per lap on throttle (Monza, Silverstone, Suzuka, Miami). The text is corrected in its own PR (`fix/lapsim-harvest-assumption-text`). The model is unchanged. |
| The shown lap time and the trace differ on raced tracks | `tool.js`, `sectorCorrection` | Section 7.4. Any export must carry both lap times. |

### 10.4 Still not checked

Curvature sign was checked only in `geometry.js`. Tracks built by other scripts, or mirrored during alignment, are not checked one by one.
