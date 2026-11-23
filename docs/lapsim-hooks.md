# Lap simulator: plug-in hooks and kernel step

Step 1 of `claude/physics-critique-skills-2026-11-23.md` (pre-registration `claude/gate-kernel-step1-prereg-2026-11-23.md`).
Later steps add physics as modules behind these hooks and do not edit the body of `worker/lapsim/kernel.js`.

Every hook is optional. **Unset, the lap is byte-identical to the kernel without hooks** (tests: `tests/lapsim-hooks.test.mjs`).
A lap with `env.gripHook`, `env.windAt` or function hooks in `car.ers.law` is never taken from the lap cache (functions are not part
of the cache key). Settings given as data (`car.ers.law = 'b'`, `car.lateralCap`) are part of the car, so those laps are cached.

## Kernel step

| Setting | Values | Default |
|---|---|---|
| `opts.kernelStep` (4th argument of `simulateLap`), else env `LAPSIM_KERNEL_STEP` (Node only) | `1` one explicit step per track point (until 2026-11-23); `2` converged step | `2` since the step-1 gate passed (attempt 2, 2026-11-23); `LAPSIM_KERNEL_STEP=1` gives the old kernel |

Step 2 (`simulateLapRaw`, `forward2`, backward pass with `heun`):
- Heun (second order) on w = v² in both passes, the rate at both ends of each track step; up to 8 substeps where the rate changes by
  more than 2 m/s² across a step or the curvature changes sign, with every per-point value interpolated linearly (virtual point `n`).
- Each step's profile is the lowest of three straight lines in v² (accelerating, braking, lateral limit). Where the lowest changes
  inside the step (braking meets accelerating, the limit takes over) the step is split and each part is timed and booked by itself.
  One-line steps are timed with Simpson's rule.
- Battery empty, the C5.12 hold start (charge left = the ramp's own energy) and a C5.12 cut are placed inside the step.
- Deploy and throttle-harvest power are read at up to 7 points inside a step where they change fast (friction ellipse less than 60 %
  open, or any throttle-harvest step).
- Per-step time and energy are stored; the lap account, the flow arrays and the battery tracking are the same numbers.
- A C5.12 cut is a drop of more than 200 W per metre (1 kW per 5 m step, the step-1 threshold at the production grid).
- A causal 2026 lap overspends only by rounding: 1 J is not an overspend. So with exact accounting the 2026 cut-off/super-clip
  search starts only for cars with `car.ers.law = 'b'` (strategy B, step 10b).

Pass checks (`tests/lapsim-mesh.test.mjs`): the lap changes by less than 0.03 % when ds halves (8 tracks × 8 rule sets); skidpad
v = √(μgR) within 1e-4; terminal speed on a 20 km straight within 1e-3; energy ledger closes per lap.

## Hooks

### `env.gripHook(i, state)` — tyre grip (step 7b)
- In: `i` track point index; `state = {s, ds, n, v, t}`: distance of the point (m), step (m), number of points, and from the previous
  run of the same lap (only with `env.hookPasses ≥ 2`) its speed at the point (m/s) and time at the point (s), else `null`.
- Out: grip multiplier (dimensionless) on top of `env.grip` and `track.mu`. Called once per point per run, before the lap.
- Default: unset (= 1).

### `env.windAt(s, t)` — wind along the lap (step 12b)
- In: `s` distance (m); `t` time at that point of the previous run (s), `null` on the first run.
- Out: `{speed, fromDeg}` — wind speed (m/s) and the meteorological direction it comes from (deg, 0 = from north). Replaces
  `env.windSpeed` / `env.windFromDeg`; needs the track heading.
- Default: unset (the session wind).

### `env.hookPasses`
Number of runs of the lap (default 1). Run k sees run k − 1 in `state.v`, `state.t` and `windAt`'s `t`.

### `car.ers.law` — ERS deploy and regen (step 10b)
- `deploy({i, s, v, lim, pErs, soc})` → DC deploy power allowed (W). In: point, distance (m), speed (m/s), the rule's ERS-K limit
  at that speed (W), the power today's logic allows there (W, after the cut-off, Overtake cap and C5.12 ramp), and the state of
  charge (J; step 1 causal pass only, else `null`). Default: `pErs`.
- `regen({pBrake, v, i, s, regenMax, share, eta})` → DC power recovered under braking (W). In: braking power at the wheels from the
  kinetic-energy drop (W), mean speed of the step (m/s), point, distance (m), the car's DC limit (W), braking share and efficiency.
  Default: `min(regenMax, share · pBrake · eta)` (the step-1 formula; step 10b replaces it).
- Either may be omitted. The energy strategy (cut-off search, super-clipping, budgets) is unchanged.
- **`car.ers.law = 'b'`** (data, step 10b; `withErsLaw(car)` in `worker/lapsim/ers-law.js`): law (b) built into the kernel.
  Regen from the tyres' braking force above drag and rolling resistance: `min(regenMax, share·max(0, m·a − D − R)·v·η)`,
  D = ½ρ·CdA·v², R = c_roll·(m·g + ½ρ·ClA·v²) (corner-mode aero). 2014–25: the lap deploy budget does not bind (MGU-H → MGU-K is not
  limited), so the MGU-K gives its limit at every full-throttle point. 2026: deploy unchanged (FIA taper TR 2026 5.4.8 and the event
  PU documents), and causal laps always search a cut-off / super-clip plan and keep the fastest legal one (strategy B).
  `ersLaw(car, env)` gives the same law as `deploy` / `regen` functions (tests: `tests/lapsim-ers-law.test.mjs`).

### `car.lateralCap` — measured lateral capacity (step 14, spec `claude/handoff-14a-to-10b-lateralcap-hook-2026-11-23.md`)
- Data: `{kind: 'quad', a0, k, rhoRef, braking}` with a_y = a0 + k·ve² (a0 m/s², k 1/m), or `{kind: 'table', kph: [...], ay: [...],
  rhoRef, braking}` (non-decreasing m/s², PCHIP between knots, flat outside). `rhoRef` default 1.2 kg/m³.
- Speed: air speed scaled to density, ve = va·√(ρ/ρref). Lateral force capacity (N): m·(a_w·N_w/(m·g) + a_y(ve) − a_w) with
  a_w = a_y(0) and N_w the normal load without aero (grade, vertical curvature and banking stay on the weight part). Replaces the
  tyre-load and axle model in the lateral limit, the friction ellipse (both kernel steps) and, with `braking: true`, the braking
  capacity (× μX0/μY0). Still × grip (`env.grip` × `track.mu` × `gripHook`).
- Unchanged: traction, drag, rolling resistance and normal load (`car.clA`), ERS, `vScale`, `vSubtractCorner`.
- Default: unset (today's capacity). Tests: `tests/lapsim-lateral-cap.test.mjs` (100 m circle, quad and table, density).

### `track.changeFactors(change)` — circuit-change factors (step 5b)
- In: one parsed change (`worker/lapsim/track-changes.js`; `change.effect` is today's default).
- Out: `{kind: 'grip' | 'cornerSpeed', factor}` or `null` (the change has no lap effect). Used by `applyTrackChanges`.
- Default: unset (`change.effect`).
- Step 5b: the tool sets it to `gatedChangeFactors` (`worker/lapsim/scenario.js`, data `change-gate-data.js`); the page and the tool
  also drop the effect of every change type at strength 0 (`gateChange`), so those changes are information only.

### `usableWidth(i, side, halfWidth)` — usable width for the racing line (step 4b)
- Option of `minCurvatureLine(x, y, half, {usableWidth})` in `worker/lapsim/racing-line.js`.
- In: point index, `'left'` or `'right'`, the half width given (m). Out: usable half width (m), e.g. asphalt minus what the track-limit
  rule forbids. Default: unset (the half widths as given).
