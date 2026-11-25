# Step 35 G — FE sector lines by projection (data-mapping fix, method change) — pre-registration

Date: 2026-11-26 (central 08:00 KST go). Written and hashed **before** the run. One run, lane C. Attempt 1 of 1 (m = 1).
Origin: screen S9 follow-up (claude/status-2026-11-26-screen-S9.md): the official I1/I2 positions are published on every Season 11–12 FE
circuit map; ours are mapped to the driven line by the same fraction of length. Projection shifts −13 … +15 m (median |6| m).

## Change
- **Old method (kept, field `f1` / `f2`):** printed distance ÷ printed length, used as the same fraction of the driven line.
- **New method (new fields `f1Proj` / `f2Proj`, plus `projShiftM`, `projOffM`, `lineRatio`; file-level `projMethod`):** the printed
  distance is placed on the track's centre line (`t.map`, scaled to the printed length), then projected to the nearest point of the
  driven line, rebuilt from the same map points and half width (`minCurvatureLine`). Search window ±10 % of the lap around the old point.
  The fraction is taken along the rebuilt line (it is 0.6–2.4 % longer than the stored kernel line from resampling; only fractions are used).
- Tracks with no centre line (Monaco: F1 driven line; old layouts without a map line) get `null` and readers keep `f1` / `f2`.
  This is fixed now, before the run: **all 15 projectable layouts use the projection; none is picked or dropped after the run.**
- Reader: `fe-residual-audit.mjs` uses `f1Proj`/`f2Proj` when `FE_SECTOR_MAP=proj`. The FE lap fit (`build-fe.mjs`) does not read sector lines.
- Code: `scripts/sim/learn/fe-sector-lines-proj.mjs`, `fe-sector-G-judge.mjs`, test `tests/lapsim-fe-sector-proj.test.mjs`
  (branch `step35-fe-G-sector-proj`, base `step35-fe-D` 9f51f773 = upstream main 4e60d9fa + D V1 + E; `fe-sector-lines.json` taken
  unchanged from `step35-fe`, sha256 8151d236…).

## Labels (owner rule decision-central-0731)
- **Measured (never changed):** FE lap and sector times (Al Kamel; duel rows asset fe-duel-rows-r45580183103, 433 files / 850 rows,
  sha256 413d58f8…), printed I1/I2 distances and track lengths.
- **Measured-derived (this change):** the sector-line position on our line, by the fixed projection method above.
- **Model:** the driven line, the FE car, the model speed at the line points (used only for the floor term).

## Run (one, when a runner is free after the screens)
Flags `LAPSIM_FE_AXLE=v1 LAPSIM_FE_BRAKE=on`. Steps in the header of `fe-sector-G-judge.mjs`: keep the base fit, write the new fields,
rebuild the FE fit, run `SAME_LAP=1 fe-residual-audit.mjs` with the old and the new map, judge. Measured data sha256 before/after.

## Decision: lane C (rule C, central 05:50) — data-mapping fix
1. CI list: 0 new test failures vs the base.
2. FE lap held-out paired |e| harm (Gen3 Evo rows, layout bootstrap 2000, seed 35), one-sided 95 % UB ≤ 0.10 pp.
3. No single layout worse than +1.0 pp.
4. No new parameter at a bound.
Expected by construction: the lap fit is byte-identical (the fit does not read sector lines); the judge checks this.
**Pass → the projection becomes the sector mapping for FE sector reports** (it agrees with the named source), whatever the sector numbers do.
**Fail → not used; old f1/f2 stay.** No second attempt.

## Report (not a pass criterion; no MDE, nothing is decided on it)
Duel-matched sector rows (SAME_LAP, A2 label rule ≤ 150 m unchanged): RMS old vs new, layout-bootstrap 90 % interval of ΔRMS,
per layout and sector mean error old vs new, check that each row's three sectors still sum to its lap error.

## Remainder → FE sector floor (data-limit protocol)
What projection cannot remove (where the timing loop lies vs the printed figure; Monaco not projectable) is unsourced. Per sector line a
placement half-range u = the label check (`labelVsPrintedM`) where ≤ 150 m, else 30 m; standard uncertainty u/√3; time = that ÷ model
speed at the line point; per sector the two bounding lines in quadrature (finish line 0), as % of lap. Added in quadrature to the FE
sector floor of the step-35 sector data-limit row.

## Never
Line positions are never fitted to sector errors (the S9 §3 diagnostic shifts are not positions). No change to measured data. 2022 LOCKED not read.
