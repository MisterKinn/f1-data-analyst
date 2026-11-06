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

// Error for one lap: speed-trace RMS (m/s) plus lap-time error, with weights.
export function lapError(track, car, env, obs, lapTime, {wTime = 2} = {}) {
  const res = simulateLap(track, car, env);
  const rms = rmsSpeed(res.v, track.ds, obs);
  const dt = res.lapTime - lapTime;
  return {score: rms * rms + wTime * dt * dt, rms, dt, res};
}

// 1-D golden-section search for the per-track grip factor
export function fitGrip(track, car, env, obs, lapTime, lo = 0.85, hi = 1.15, opts) {
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - phi * (b - a), d = a + phi * (b - a);
  const f = g => lapError(withGrip(track, g), car, env, obs, lapTime, opts).score;
  let fc = f(c), fd = f(d);
  for (let it = 0; it < 18; it++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = f(d); }
  }
  const g = fc < fd ? c : d;
  return {grip: g, ...lapError(withGrip(track, g), car, env, obs, lapTime, opts)};
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
export function fitSeason(laps, base, params, {iters = 120, wTime = 2, log = () => {}} = {}) {
  const prepared = laps.map(l => {
    const env = conditionsFromWeather(l.weather, l.conditionOptions);
    const lapSeconds = l.lapSeconds ?? l.trace.lap_seconds;
    if (l.obs) return {...l, env, lapSeconds, shift: 0}; // distance already measured on this track
    const L = l.track.kappa.length * l.track.ds;
    const sim0 = simulateLap(l.track, base, env);
    const {shift} = bestShift(sim0.v, l.track.ds, l.trace, L);
    return {...l, env, lapSeconds, obs: traceOnTrack(l.trace, L, shift), shift};
  });
  const build = x => {
    const car = structuredClone(base);
    params.forEach((p, i) => {
      const parts = p.path.split('.');
      let o = car; for (let k = 0; k < parts.length - 1; k++) o = o[parts[k]];
      const last = parts[parts.length - 1];
      o[last] = p.base * Math.exp(x[i]);
      if (p.min != null) o[last] = Math.max(p.min, o[last]);
      if (p.max != null) o[last] = Math.min(p.max, o[last]);
    });
    if (base.linkMu) { car.muX = base.muX * car.muY / base.muY; car.muXTrac = base.muXTrac * car.muY / base.muY; }
    return car;
  };
  const objective = x => {
    const car = build(x);
    let total = 0;
    for (const l of prepared) total += (l.weight ?? 1) * fitGrip(l.track, car, l.env, l.obs, l.lapSeconds, 0.85, 1.15, {wTime}).score;
    return total / prepared.length;
  };
  const x0 = params.map(() => 0);
  const result = nelderMead(objective, x0, {step: params.map(p => p.step ?? 0.08), iters});
  const car = build(result.x);
  const perTrack = prepared.map(l => {
    const r = fitGrip(l.track, car, l.env, l.obs, l.lapSeconds, 0.85, 1.15, {wTime});
    return {name: l.name, grip: r.grip, rmsKph: r.rms * 3.6, dt: r.dt, simLap: r.res.lapTime, realLap: l.lapSeconds,
      shift: l.shift, rho: l.env.rho, vMaxSim: r.res.vMaxKph, vMaxReal: Math.max(...l.obs.v) * 3.6, meta: l.meta};
  });
  log({score: result.value});
  return {car, perTrack, score: result.value, x: result.x};
}
