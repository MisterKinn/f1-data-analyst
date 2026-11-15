// Telemetry channels of a simulated lap (owner 2026-11-15): front brake line pressure (bar), gear and engine rpm, steering wheel
// angle. Self-contained (the /simulation page sends its source to the browser). Per-class values are engineering estimates; their
// basis and the Wolfram checks are in docs/lapsim-physics-rules.md, "Telemetry channels".
// track: kernel track (ds, kappa, mu), res: simulateLap result (v, time, limit), cls: 'f1' | 'hyper' | 'gt3' | 'fe', seed: any string.
export function lapChannels(track, car, env, res, {cls = 'f1', seed = ''} = {}) {
  const G = 9.81, v = res.v, n = v.length, ds = track.ds, rho = env.rho ?? 1.2, m = car.mass, Rt = car.tyreRadius ?? 0.34;
  // bal: front share of the brake force; mu: pad friction; rf, rr: effective disc radius (m); af, ar: piston area on one side of the
  // caliper (mm²; the two pads each press with p·A); ratio: steering ratio; kus: understeer gradient (deg/g at the road wheels)
  const C = {
    f1: {bal: 0.57, mu: 0.5, rf: 0.137, af: 3060, rr: 0.115, ar: 1323, ratio: 11, kus: 0.6},
    hyper: {bal: 0.56, mu: 0.5, rf: 0.160, af: 3409, rr: 0.150, ar: 1712, ratio: 12, kus: 0.8},
    gt3: {bal: 0.58, mu: 0.45, rf: 0.160, af: 2956, rr: 0.150, ar: 1511, ratio: 14, kus: 1.0},
    fe: {bal: 0.6, mu: 0.45, rf: 0.115, af: 1926, rr: 0.1, ar: 0, ratio: 12, kus: 0.8}, // Gen3 on: no rear friction brakes, rear by regen
  }[cls] || {};
  const ers = car.ers || {}, axle = ers.axle || (ers.rule === 'f1-2026' || ers.pMax || car.regen ? 'rear' : null);
  const regenW = ers.regenMax ?? ers.eMax ?? car.regen?.maxW ?? 0, regenShare = ers.regenShare ?? car.regen?.share ?? 0.6;
  const perBar = 2 * 2 * C.mu * C.rf * C.af * 1e-6 * 1e5 / Rt; // front axle brake force (N) per bar: 2 wheels × 2 pads × mu × r × A / R
  const brakeBar = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n; if (!(v[j] < v[i])) continue;
    const vm = (v[i] + v[j]) / 2, dec = (v[i] * v[i] - v[j] * v[j]) / (2 * ds), q = 0.5 * rho * vm * vm;
    const need = Math.max(0, m * dec - q * car.cdA - (car.cRoll ?? 0.012) * (m * G + q * car.clA)); // drag and rolling resistance brake too
    const regen = axle ? Math.min(regenW / Math.max(vm, 1), regenShare * need) : 0;
    let front = C.bal * need - (axle === 'front' ? regen : 0), rear = (1 - C.bal) * need - (axle === 'rear' ? regen : 0);
    if (!C.ar && rear > 0) { front += rear; rear = 0; } // no rear friction brakes: the brake-by-wire moves the rest forward
    brakeBar[i] = +(Math.max(0, front) / perBar).toFixed(1);
  }
  // gear and rpm: the gear with the most engine power at this speed (same rule as kernel powertrain()); a gear within 1 % of the
  // best is kept, so the trace does not hunt on the flat top of the curve
  const e = car.engine, g = car.gears;
  let gear = null, rpm = null, shifts = [];
  if (e?.rpm?.length && g?.length) {
    const r = e.rpm, P = e.kW || (e.Nm ? e.Nm.map((T, k) => T * r[k]) : e.frac), top = e.rpmMax ?? r.at(-1), k = (car.finalDrive ?? 1) * 60 / (2 * Math.PI * Rt);
    const at = x => { if (x <= r[0]) return P[0] * x / r[0]; for (let a = 1; a < r.length; a++) if (x <= r[a]) return P[a - 1] + (P[a] - P[a - 1]) * (x - r[a - 1]) / (r[a] - r[a - 1]); return P.at(-1); };
    gear = new Array(n); rpm = new Array(n);
    let cur = 0;
    for (let i = 0; i < n; i++) {
      let best = 0, bp = -1;
      for (let a = 0; a < g.length; a++) { const x = v[i] * g[a] * k; if (x > top * 1.0001) continue; const p = at(x); if (p > bp * 1.01) { bp = p; best = a; } }
      const xc = v[i] * g[cur] * k;
      if (i === 0 || xc > top * 1.0001 || at(xc) < bp * 0.99) cur = best;
      gear[i] = cur + 1; rpm[i] = Math.round(Math.min(top, v[i] * g[cur] * k));
      if (i && gear[i] !== gear[i - 1]) shifts.push({i, from: gear[i - 1], to: gear[i]});
    }
  }
  // steering wheel angle (deg, + = left): Ackermann angle L·kappa plus the understeer gradient times the lateral acceleration, times
  // the steering ratio; plus the driver's small corrections near the limit (seeded, so the page is stable)
  let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const waves = [1.3, 2.4, 3.7].map((f, a) => ({f, w: [0.55, 0.3, 0.15][a], ph: rnd() * 2 * Math.PI})); // 1–4 Hz, the band of driver corrections
  const kus = (C.kus ?? 0.8) * Math.PI / 180 / G, L = car.wheelbase ?? 3, mean = new Array(n), use = new Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, kap = track.kappa[i], ay = v[i] * v[i] * kap, ax = (v[j] * v[j] - v[i] * v[i]) / (2 * ds);
    mean[i] = (L * kap + kus * ay) * (C.ratio ?? 12) * 180 / Math.PI;
    const cap = (car.muY ?? 1.5) * (env.grip ?? 1) * (track.mu ? track.mu[i] : 1) * (G + 0.5 * rho * car.clA * v[i] * v[i] / m);
    use[i] = Math.hypot(ay, ax) / cap;
  }
  // grip use scaled so the 98th percentile of the lap is the limit (the point-mass capacity above ignores tyre load sensitivity)
  const ref = use.slice().sort((a, b) => a - b)[Math.floor(n * 0.98)] || 1;
  const steerDeg = mean.map((d, i) => {
    const u = Math.min(1, use[i] / ref), amp = 1.2 * u * u * u * (1 + 25 / Math.max(v[i], 10)); // deg at the wheel: grows near the limit and at low speed
    const t = res.time[i], wob = waves.reduce((s, w) => s + w.w * Math.sin(2 * Math.PI * w.f * t + w.ph), 0);
    return +(d + amp * wob).toFixed(1);
  });
  return {brakeBar, gear, rpm, shifts, steerDeg, steerMeanDeg: mean.map(d => +d.toFixed(1))};
}
