// Fit lap-simulator car parameters to real qualifying laps.
// Inputs per lap: a track (curvature on a uniform grid), the real speed trace (distance, speed),
// the real lap time and the session weather. Output: season-wide car parameters plus a
// per-track grip factor that absorbs asphalt differences and geometry error.
import {simulateLap} from '../../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../../worker/lapsim/atmosphere.js';

// Real trace -> arrays on the track's distance scale. The trace distance is speed-integrated,
// so it is stretched to the track length; shift (m) aligns the timing line with the track start.
export function traceOnTrack(trace, trackLength, shift = 0) {
  const rows = trace.samples.filter(r => Number.isFinite(r[1]) && Number.isFinite(r[2]));
  const total = trace.distance_m || rows[rows.length - 1][1];
  const s = [], v = [];
  for (const r of rows) {
    let x = r[1] / total * trackLength + shift;
    x = ((x % trackLength) + trackLength) % trackLength;
    s.push(x); v.push(r[2] / 3.6);
  }
  return {s, v};
}

export function sampleAt(simV, ds, s) {
  const n = simV.length, x = s / ds, i = Math.floor(x) % n, j = (i + 1) % n, f = x - Math.floor(x);
  return simV[i] * (1 - f) + simV[j] * f;
}

// Corner (minimum) and straight-end (maximum) speeds of the real trace compared with the simulated
// extreme within ±window m: robust to small distance misalignment, which a point-by-point RMS is not.
export function realExtremes(obs, prominence = 4) {
  const {s, v} = obs, out = [];
  for (let k = 2; k < v.length - 2; k++) {
    const isMin = v[k] < v[k - 1] && v[k] <= v[k + 1] && v[k] < v[k - 2] && v[k] <= v[k + 2];
    const isMax = v[k] > v[k - 1] && v[k] >= v[k + 1] && v[k] > v[k - 2] && v[k] >= v[k + 2];
    if (!isMin && !isMax) continue;
    let lo = Infinity, hi = -Infinity;
    for (let j = Math.max(0, k - 8); j <= Math.min(v.length - 1, k + 8); j++) { lo = Math.min(lo, v[j]); hi = Math.max(hi, v[j]); }
    if ((isMin ? hi - v[k] : v[k] - lo) >= prominence) out.push({s: s[k], v: v[k], min: isMin});
  }
  return out;
}
export function extremaRms(simV, ds, ext, window = 50) {
  if (!ext?.length) return 0;
  const n = simV.length, h = Math.round(window / ds);
  let se = 0;
  for (const e of ext) {
    const i0 = Math.round(e.s / ds); let x = e.min ? Infinity : -Infinity;
    for (let j = -h; j <= h; j++) { const y = simV[((i0 + j) % n + n) % n]; x = e.min ? Math.min(x, y) : Math.max(x, y); }
    se += (x - e.v) ** 2;
  }
  return Math.sqrt(se / ext.length);
}

export function rmsSpeed(simV, ds, obs) {
  let se = 0;
  for (let k = 0; k < obs.s.length; k++) { const d = sampleAt(simV, ds, obs.s[k]) - obs.v[k]; se += d * d; }
  return Math.sqrt(se / obs.s.length);
}

// Find the start-line offset (m) that best lines up the real trace with a simulated profile:
// coarse search over the whole lap, then a fine search around the best value.
export function bestShift(simV, ds, trace, trackLength, {coarse = 20, fine = 2} = {}) {
  let best = {shift: 0, rms: Infinity};
  const half = trackLength / 2;
  for (let sh = -half; sh <= half; sh += coarse) {
    const r = rmsSpeed(simV, ds, traceOnTrack(trace, trackLength, sh));
    if (r < best.rms) best = {shift: sh, rms: r};
  }
  const c = best.shift;
  for (let sh = c - coarse; sh <= c + coarse; sh += fine) {
    const r = rmsSpeed(simV, ds, traceOnTrack(trace, trackLength, sh));
    if (r < best.rms) best = {shift: sh, rms: r};
  }
  return best;
}

export function withGrip(track, g) {
  const n = track.kappa.length, mu = new Float64Array(n);
  for (let i = 0; i < n; i++) mu[i] = g * (track.mu ? track.mu[i] : 1);
  return {...track, mu};
}

// Error for one lap, common to every series. Observations: a speed trace (obs: {s, v}) and/or a
// speed trap (trapKph, compared with the top speed), always the lap time. Units: m/s and s.
export function lapError(track, car, env, obs, lapTime, {wTime = 2, trapKph = null, wTrap = 0.5} = {}) {
  const res = simulateLap(track, car, env);
  const rms = !obs ? 0 : obs.ext ? extremaRms(res.v, track.ds, obs.ext) : rmsSpeed(res.v, track.ds, obs);
  const trap = trapKph ? (res.vMaxKph - trapKph) / 3.6 : 0;
  const dt = res.lapTime - lapTime;
  return {score: rms * rms + wTime * dt * dt + wTrap * trap * trap, rms, dt, trap: trap * 3.6, res};
}

// 1-D golden-section search for the per-track grip factor (same answer for the same car, so the
// Nelder–Mead objective stays a fixed function of the car parameters).
export function fitGrip(track, car, env, obs, lapTime, lo = 0.85, hi = 1.15, opts = {}) {
  const phi = (Math.sqrt(5) - 1) / 2;
  const f = g => ({grip: g, ...lapError(withGrip(track, g), car, env, obs, lapTime, opts)});
  const search = (a, b, iters) => {
    let c = f(b - phi * (b - a)), d = f(a + phi * (b - a));
    for (let it = 0; it < iters; it++) {
      if (c.score < d.score) { b = d.grip; d = c; c = f(b - phi * (b - a)); }
      else { a = c.grip; c = d; d = f(a + phi * (b - a)); }
    }
    return c.score < d.score ? c : d;
  };
  return search(lo, hi, 14); // bracket 0.3 → 3e-4 of grip
}

// Nelder–Mead on a parameter vector (minimisation)
export function nelderMead(f, x0, {step = 0.05, iters = 200, tol = 1e-6} = {}) {
  const n = x0.length;
  let pts = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] = p[i] + (Array.isArray(step) ? step[i] : step); pts.push(p); }
  let vals = pts.map(f);
  for (let it = 0; it < iters; it++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    pts = order.map(i => pts[i]); vals = order.map(i => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < tol) break;
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += pts[i][j] / n;
    const xr = c.map((cj, j) => cj + (cj - pts[n][j])), fr = f(xr);
    if (fr < vals[0]) {
      const xe = c.map((cj, j) => cj + 2 * (cj - pts[n][j])), fe = f(xe);
      if (fe < fr) { pts[n] = xe; vals[n] = fe; } else { pts[n] = xr; vals[n] = fr; }
    } else if (fr < vals[n - 1]) { pts[n] = xr; vals[n] = fr; }
    else {
      const xc = c.map((cj, j) => cj + 0.5 * (pts[n][j] - cj)), fcv = f(xc);
      if (fcv < vals[n]) { pts[n] = xc; vals[n] = fcv; }
      else for (let i = 1; i <= n; i++) { pts[i] = pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j])); vals[i] = f(pts[i]); }
    }
  }
  const best = vals.indexOf(Math.min(...vals));
  return {x: pts[best], value: vals[best]};
}

// Fit a season. laps: [{name, track, trace, weather}] ; base: car object ; params: [{key, path, scale}]
// The car parameters are optimised in log space around the base values.
// A lap with a fixed track factor (l.grip, e.g. shared from F1) is not given its own grip fit;
// a lap with l.trapKph is also scored on top speed.
export function fitSeason(laps, base, params, {iters = 120, wTime = 2, wGrip = 50, log = () => {}} = {}) {
  const prepared = laps.map(l => {
    const env = conditionsFromWeather(l.weather || {}, l.conditionOptions);
    const lapSeconds = l.lapSeconds ?? l.trace.lap_seconds;
    const withExt = obs => obs && process.env.LAPSIM_TRACE_ERROR !== 'rms' ? {...obs, ext: realExtremes(obs)} : obs;
    if (l.obs || !l.trace) return {...l, env, lapSeconds, shift: 0, obs: withExt(l.obs)}; // distance already measured, or timing only
    const L = l.track.kappa.length * l.track.ds;
    const sim0 = simulateLap(l.track, base, env);
    const {shift} = bestShift(sim0.v, l.track.ds, l.trace, L);
    return {...l, env, lapSeconds, obs: withExt(traceOnTrack(l.trace, L, shift)), shift};
  });
  let outside = 0;
  const build = x => {
    outside = 0;
    const car = structuredClone(base);
    params.forEach((p, i) => {
      const parts = p.path.split('.');
      let o = car; for (let k = 0; k < parts.length - 1; k++) o = o[parts[k]];
      const last = parts[parts.length - 1];
      o[last] = p.base * Math.exp(x[i]);
      // clamp to the bounds, and record how far outside (log scale) so the objective can push back
      if (p.min != null && o[last] < p.min) { outside += Math.log(p.min / o[last]) ** 2; o[last] = p.min; }
      if (p.max != null && o[last] > p.max) { outside += Math.log(o[last] / p.max) ** 2; o[last] = p.max; }
    });
    if (base.linkMu) { car.muX = base.muX * car.muY / base.muY; car.muXTrac = base.muXTrac * car.muY / base.muY; }
    if (base.noLowDrag) { car.clALow = car.clA; car.cdALow = car.cdA; } // no DRS / straight mode
    return car;
  };
  const objective = x => {
    const car = build(x);
    let total = 0, logGrip = 0, free = 0;
    for (const l of prepared) {
      const r = evalLap(l, car);
      total += (l.weight ?? 1) * r.score;
      if (l.grip == null) { logGrip += Math.log(r.grip); free++; }
    }
    // car grip and track grip only appear as a product: keep the average fitted track factor at 1
    return total / prepared.length + (free ? wGrip * (logGrip / free) ** 2 : 0) + 100 * outside;
  };
  // l.patch(car) → car for this lap (e.g. per-event BoP weight and power); no patch = season car
  const evalLap = (l, car) => (car = l.patch ? l.patch(car) : car, l.grip != null
    ? {grip: l.grip, ...lapError(withGrip(l.track, l.grip), car, l.env, l.obs, l.lapSeconds, {wTime, trapKph: l.trapKph})}
    : fitGrip(l.track, car, l.env, l.obs, l.lapSeconds, 0.85, 1.15, {wTime, trapKph: l.trapKph}));
  const x0 = params.map(() => 0);
  const result = nelderMead(objective, x0, {step: params.map(p => p.step ?? 0.08), iters});
  const car = build(result.x);
  const perTrack = prepared.map(l => {
    const r = evalLap(l, car);
    return {name: l.name, grip: r.grip, rmsKph: r.rms * 3.6, dt: r.dt, simLap: r.res.lapTime, realLap: l.lapSeconds,
      shift: l.shift, rho: l.env.rho, vMaxSim: r.res.vMaxKph, vMaxReal: l.obs ? Math.max(...l.obs.v) * 3.6 : l.trapKph ?? null, meta: l.meta};
  });
  log({score: result.value});
  return {car, perTrack, score: result.value, x: result.x};
}

// Holdout test, common to all series: refit without some tracks (folds by track name), then predict
// the main lap (weight 1) on each left-out track. gripFor(lap) gives the track factor to use for a
// left-out lap (from another season or series); null skips that lap.
export function holdout(laps, base, params, {folds = 4, iters = 40, gripFor, ...opts} = {}) {
  const names = [...new Set(laps.map(l => l.name))].sort();
  const k = Math.min(folds, names.length), errors = [];
  for (let f = 0; f < k; f++) {
    const test = new Set(names.filter((_, i) => i % k === f));
    const train = laps.filter(l => !test.has(l.name));
    if (new Set(train.map(l => l.name)).size < 2) continue;
    const fit = fitSeason(train, base, params, {...opts, iters});
    for (const l of laps.filter(x => test.has(x.name) && (x.weight ?? 1) >= 1)) {
      const g = gripFor(l); if (g == null) continue;
      const res = simulateLap(withGrip(l.track, g), l.patch ? l.patch(fit.car) : fit.car, conditionsFromWeather(l.weather || {}));
      errors.push({name: l.name, dt: res.lapTime - l.lapSeconds, pct: (res.lapTime / l.lapSeconds - 1) * 100});
    }
  }
  const rmsPct = errors.length ? Math.sqrt(errors.reduce((a, e) => a + e.pct ** 2, 0) / errors.length) : null;
  return {errors, rmsPct, n: errors.length};
}

// Joint fit of several seasons (common rule): each season has its own car, but a track keeps ONE
// grip factor across seasons (same asphalt and line), fitted to all its laps together. This makes
// track factors transferable, so a car can be predicted on a track it has not raced yet.
// groups: [{key, laps, base, params}] (laps as for fitSeason, with obs)
export function fitJoint(groups, {iters = 90, wTime = 2, wGrip = 50, lo = 0.85, hi = 1.15} = {}) {
  const prep = groups.map(g => ({...g, laps: g.laps.map(l => ({...l, env: conditionsFromWeather(l.weather || {}), obs: l.obs && process.env.LAPSIM_TRACE_ERROR !== 'rms' ? {...l.obs, ext: realExtremes(l.obs)} : l.obs}))}));
  const names = [...new Set(prep.flatMap(g => g.laps.map(l => l.name)))];
  const offsets = []; let n = 0; for (const g of prep) { offsets.push(n); n += g.params.length; }
  let outside = 0;
  const buildOne = (g, x) => {
    const car = structuredClone(g.base);
    g.params.forEach((p, i) => {
      let v = p.base * Math.exp(x[i]);
      if (p.min != null && v < p.min) { outside += Math.log(p.min / v) ** 2; v = p.min; }
      if (p.max != null && v > p.max) { outside += Math.log(v / p.max) ** 2; v = p.max; }
      car[p.path] = v;
    });
    if (g.base.linkMu) { car.muX = g.base.muX * car.muY / g.base.muY; car.muXTrac = g.base.muXTrac * car.muY / g.base.muY; }
    if (g.base.noLowDrag) { car.clALow = car.clA; car.cdALow = car.cdA; }
    return car;
  };
  const build = x => { outside = 0; return prep.map((g, k) => buildOne(g, x.slice(offsets[k], offsets[k] + g.params.length))); };
  const phi = (Math.sqrt(5) - 1) / 2;
  // best shared grip for one track, given the cars
  const trackFit = (name, cars) => {
    const laps = prep.flatMap((g, k) => g.laps.filter(l => l.name === name).map(l => ({l, car: cars[k]})));
    const f = gr => { let s = 0; const r = laps.map(({l, car}) => { const e = lapError(withGrip(l.track, gr), car, l.env, l.obs, l.lapSeconds, {wTime, trapKph: l.trapKph}); s += (l.weight ?? 1) * e.score; return e; }); return {grip: gr, score: s, r}; };
    let a = lo, b = hi, c = f(b - phi * (b - a)), d = f(a + phi * (b - a));
    for (let it = 0; it < 14; it++) { if (c.score < d.score) { b = d.grip; d = c; c = f(b - phi * (b - a)); } else { a = c.grip; c = d; d = f(a + phi * (b - a)); } }
    const best = c.score < d.score ? c : d;
    return {...best, laps};
  };
  const total = prep.reduce((a, g) => a + g.laps.length, 0);
  const objective = x => {
    const cars = build(x);
    let s = 0, lg = 0;
    for (const name of names) { const t = trackFit(name, cars); s += t.score; lg += Math.log(t.grip); }
    return s / total + wGrip * (lg / names.length) ** 2 + 100 * outside;
  };
  const result = nelderMead(objective, new Array(n).fill(0), {step: 0.08, iters});
  const cars = build(result.x);
  const grips = {}, perLap = [];
  for (const name of names) {
    const t = trackFit(name, cars); grips[name] = t.grip;
    t.laps.forEach(({l}, i) => { const r = t.r[i]; perLap.push({group: prep.find(g => g.laps.includes(l)).key, name, grip: t.grip, rmsKph: r.rms * 3.6, dt: r.dt, simLap: r.res.lapTime, realLap: l.lapSeconds, rho: l.env.rho, vMaxSim: r.res.vMaxKph, meta: l.meta}); });
  }
  return {cars: Object.fromEntries(prep.map((g, k) => [g.key, cars[k]])), grips, perLap, score: result.value};
}

// Holdout for the joint fit: leave one season's laps on some tracks out, refit, and predict them
// with the track factor learned from the other seasons' laps on that track (skipped if none).
export function holdoutJoint(groups, key, {folds = 4, iters = 40, ...opts} = {}) {
  const target = groups.find(g => g.key === key);
  const names = [...new Set(target.laps.map(l => l.name))].sort();
  const k = Math.min(folds, names.length), errors = [];
  for (let f = 0; f < k; f++) {
    const test = new Set(names.filter((_, i) => i % k === f));
    const train = groups.map(g => g.key === key ? {...g, laps: g.laps.filter(l => !test.has(l.name))} : g);
    const fit = fitJoint(train, {...opts, iters});
    for (const l of target.laps.filter(x => test.has(x.name) && (x.weight ?? 1) >= 1)) {
      const g = fit.grips[l.name]; if (g == null) continue;
      const res = simulateLap(withGrip(l.track, g), fit.cars[key], conditionsFromWeather(l.weather || {}));
      errors.push({name: l.name, dt: res.lapTime - l.lapSeconds, pct: (res.lapTime / l.lapSeconds - 1) * 100});
    }
  }
  const rmsPct = errors.length ? Math.sqrt(errors.reduce((a, e) => a + e.pct ** 2, 0) / errors.length) : null;
  return {errors, rmsPct, n: errors.length};
}
