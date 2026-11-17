// Telemetry channels of a simulated lap (owner 2026-11-15): front brake line pressure (bar), gear and engine rpm, steering wheel
// angle. Self-contained (the /simulation page sends its source to the browser). Per-class values are engineering estimates; their
// basis and the Wolfram checks are in docs/lapsim-physics-rules.md, "Telemetry channels".
// track: kernel track (ds, kappa, mu), res: simulateLap result (v, time, limit), cls: 'f1' | 'hyper' | 'gt3' | 'fe', seed: any string.
export function lapChannels(track, car, env, res, {cls = 'f1', seed = '', surface = null, wet = false} = {}) {
  const G = 9.81, v = res.v, n = v.length, ds = track.ds, rho = env.rho ?? 1.2, m = car.mass, Rt = car.tyreRadius ?? 0.34;
  // bal: front share of the brake force; mu: pad friction; rf, rr: effective disc radius (m); af, ar: piston area on one side of the
  // caliper (mm²; the two pads each press with p·A); ratio: steering ratio; kus: understeer gradient (deg/g at the road wheels)
  // Learned from the owner's iRacing data (owner 2026-11-17, docs/lapsim-physics-rules.md rule 14; layer 4, shown as "model"):
  // k: deceleration per bar of front line pressure (m/s², straight-line, no ABS; GT3 0.255 over 11 cars, GTP 0.203 over 6),
  // ratio and kus: steering wheel angle = ratio × (L·kappa + kus·ay) fitted on clean cornering samples (GT3 530k, R² 0.88; GTP 45k,
  // 0.83; open wheel SFL/F3 18k, 0.71), h: the driver's foot (time to 90 % of the zone's peak pressure, overshoot over the hold,
  // hold ripple, trail-brake tail time constant; medians over 6,860 GT3, 472 GTP and 157 open-wheel braking zones). F1 and FE take
  // the open-wheel foot and steering (no F1 or FE car in the data); F1 and FE pressure stay on the pad and caliper physics below.
  const OW = {t90: 0.217, os: 0.11, rip: 0.0176, tau: 0.251};
  const C = {
    f1: {bal: 0.57, mu: 0.5, rf: 0.137, af: 3060, rr: 0.115, ar: 1323, ratio: 11.0, kus: 0.44, h: OW},
    hyper: {bal: 0.56, mu: 0.5, rf: 0.160, af: 3409, rr: 0.150, ar: 1712, ratio: 12.8, kus: 0.32, k: 0.203, h: {t90: 0.25, os: 0.148, rip: 0.012, tau: 0.372}},
    gt3: {bal: 0.58, mu: 0.45, rf: 0.160, af: 2956, rr: 0.150, ar: 1511, ratio: 17.6, kus: 0.34, k: 0.255, h: {t90: 0.383, os: 0.085, rip: 0.0112, tau: 0.343}},
    fe: {bal: 0.6, mu: 0.45, rf: 0.115, af: 1926, rr: 0.1, ar: 0, ratio: 12, kus: 0.8, h: OW}, // Gen3 on: no rear friction brakes, rear by regen
  }[cls] || {};
  const ers = car.ers || {}, axle = ers.axle || (ers.rule === 'f1-2026' || ers.pMax || car.regen ? 'rear' : null);
  const regenW = ers.regenMax ?? ers.eMax ?? car.regen?.maxW ?? 0, regenShare = ers.regenShare ?? car.regen?.share ?? 0.6;
  const perBar = 2 * 2 * C.mu * C.rf * C.af * 1e-6 * 1e5 / Rt; // front axle brake force (N) per bar: 2 wheels × 2 pads × mu × r × A / R
  // drag and downforce of this lap's own low-drag layout (Straight Mode / DRS zones and options, owner 2026-11-16): aeroLow share 0..1
  const lowI = i => track && track.aeroLow ? Math.min(1, Math.max(0, Number(track.aeroLow[i]) || 0)) : 0;
  const cdI = i => car.cdA + lowI(i) * ((car.cdALow ?? car.cdA) - car.cdA), clI = i => car.clA + lowI(i) * ((car.clALow ?? car.clA) - car.clA);
  const brakeBar = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n; if (!(v[j] < v[i])) continue;
    const vm = (v[i] + v[j]) / 2, dec = (v[i] * v[i] - v[j] * v[j]) / (2 * ds), q = 0.5 * rho * vm * vm;
    const need = Math.max(0, m * dec - q * cdI(i) - (car.cRoll ?? 0.012) * (m * G + q * clI(i))); // drag and rolling resistance brake too
    const regen = axle ? Math.min(regenW / Math.max(vm, 1), regenShare * need) : 0;
    let front = C.bal * need - (axle === 'front' ? regen : 0), rear = (1 - C.bal) * need - (axle === 'rear' ? regen : 0);
    if (!C.ar && rear > 0) { front += rear; rear = 0; } // no rear friction brakes: the brake-by-wire moves the rest forward
    // with a learned gain the front line pressure follows the whole stopping need, as in the iRacing fit (bias and regen inside k)
    brakeBar[i] = +(C.k ? Math.max(0, need) / (m * C.k) : Math.max(0, front) / perBar).toFixed(1);
  }
  // gear and rpm: the gear with the most engine power at this speed (same rule as kernel powertrain()); a gear within 1 % of the
  // best is kept, so the trace does not hunt on the flat top of the curve
  const e = car.engine, g = car.gears;
  let gear = null, rpm = null, shifts = [], powerW = null;
  if (e?.rpm?.length && g?.length) {
    const r = e.rpm, P = e.kW ? e.kW.map(x => x * 1e3) : e.Nm ? e.Nm.map((T, k) => T * r[k] * 2 * Math.PI / 60) : e.frac.map(f => f * car.pIce), top = e.rpmMax ?? r.at(-1), k = (car.finalDrive ?? 1) * 60 / (2 * Math.PI * Rt);
    const at = x => { if (x <= r[0]) return P[0] * x / r[0]; for (let a = 1; a < r.length; a++) if (x <= r[a]) return P[a - 1] + (P[a] - P[a - 1]) * (x - r[a - 1]) / (r[a] - r[a - 1]); return P.at(-1); };
    gear = new Array(n); rpm = new Array(n); powerW = new Array(n);
    let cur = 0;
    for (let i = 0; i < n; i++) {
      let best = 0, bp = -1;
      for (let a = 0; a < g.length; a++) { const x = v[i] * g[a] * k; if (x > top * 1.0001) continue; const p = at(x); if (p > bp * 1.01) { bp = p; best = a; } }
      const xc = v[i] * g[cur] * k;
      if (i === 0 || xc > top * 1.0001 || at(xc) < bp * 0.99) cur = best;
      gear[i] = cur + 1; rpm[i] = Math.round(Math.min(top, v[i] * g[cur] * k)); powerW[i] = Math.min(car.pIce, at(v[i] * g[cur] * k));
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
  // where grip is easy to lose (owner 2026-11-15), 0–1 per point: weight lost over a crest (v² × vertical curvature from the track
  // grade), braking downhill, downforce lost to a tailwind, lower surface grip (FIA changes switched on), fresh asphalt or patched
  // bumps named in the latest FIA notes (surface), a track away from the tyre's temperature window, rain. The driver's corrections
  // grow with it (steering, brake ripple and lock-up relief, throttle ripple and lifts).
  const gr = track.grade, hd = track.heading, ws = env.windSpeed || 0, wTo = ((env.windFromDeg || 0) + 180) * Math.PI / 180;
  const risk = new Array(n);
  for (let i = 0; i < n; i++) {
    let kv = 0; if (gr) { for (let o = -4; o <= 4; o++) kv += (gr[(i + o + 1 + n) % n] - gr[(i + o - 1 + n) % n]) / (2 * ds); kv /= 9; }
    const crest = Math.max(0, -v[i] * v[i] * kv / G), down = gr && v[(i + 1) % n] < v[i] ? Math.max(0, -Math.sin(gr[i])) * 5 : 0;
    const tail = hd && ws ? ws * Math.sin(wTo) * Math.cos(hd[i]) + ws * Math.cos(wTo) * Math.sin(hd[i]) : 0;
    const aero = 0.5 * rho * car.clA * v[i] * v[i] / (m * G + 0.5 * rho * car.clA * v[i] * v[i]), tailLoss = aero * (1 - (Math.max(0, v[i] - tail) / Math.max(v[i], 1)) ** 2);
    risk[i] = Math.min(1, 0.6 * crest + 0.3 * down + 3 * tailLoss + 2 * Math.max(0, 1 - (track.mu ? track.mu[i] : 1)) + (surface ? surface[i] || 0 : 0) + 3 * Math.max(0, 1 - (env.grip ?? 1)) + (wet ? 0.5 : 0));
  }
  const steerDeg = mean.map((d, i) => {
    const u = Math.min(1, use[i] / ref), amp = 1.2 * u * u * u * (1 + 25 / Math.max(v[i], 10)) * (1 + 1.5 * risk[i]); // deg at the wheel: grows near the limit, at low speed and where grip is easy to lose
    const t = res.time[i], wob = waves.reduce((s, w) => s + w.w * Math.sin(2 * Math.PI * w.f * t + w.ph), 0);
    return +(d + amp * wob).toFixed(1);
  });
  // throttle (0–1) the lap needs: full where power-limited, none under braking, else the share of the available power (engine in
  // its gear plus the hybrid) that the acceleration, drag and rolling resistance take
  // above the deploy cut-off or clipping speed the battery, not the foot, limits the car: the driver stays flat out
  const clip = Math.min(res.energy?.cutoffKph ?? Infinity, res.energy?.clipFromKph ?? Infinity) / 3.6 - 0.3;
  const lim = res.limit || [], ersW = ers.pMax ?? ers.eMax ?? 0, eta = car.etaDrive ?? 0.95;
  const throttle = v.map((vi, i) => {
    if (brakeBar[i] > 0) return 0; if (lim[i] === 2 || lim[(i + 1) % n] === 2 || lim[(i - 1 + n) % n] === 2 || vi >= clip) return 1; // next to a power-limited point the foot is flat (the kernel's deploy toggles point to point) // a speed drop with no brake need (2026 clipping, lift) keeps the pedal
    // acceleration over ±2 points: the kernel's deploy on/off from point to point is not a foot movement
    const a2 = v[(i + 2) % n], b2 = v[(i - 2 + n) % n], q = 0.5 * rho * vi * vi, F = m * (a2 * a2 - b2 * b2) / (8 * ds) + q * cdI(i) + (car.cRoll ?? 0.012) * (m * G + q * clI(i));
    return Math.max(0, Math.min(1, F * vi / ((powerW ? powerW[i] : car.pIce) * eta + ersW)));
  });
  const ped = humanPedals(brakeBar, throttle, risk, res.time, res.lapTime ?? res.time[n - 1], String(seed) + '|pedals', C.h || OW);
  return {brakeBar, gear, rpm, shifts, steerDeg, steerMeanDeg: mean.map(d => +d.toFixed(1)), throttle, risk: risk.map(x => +x.toFixed(2)), ...ped};

  // A human foot on the pedals (owner 2026-11-15: "the trace is too honest"), on a grid twice as fine as the lap (half a point
  // apart, so a 0.1 s stab still has a few samples at 300 km/h). Physics gives the pressure and throttle the lap needs; the driver:
  // brake: builds to 90 % of the pressure in t90 (open wheel 0.22 s, GTP 0.25 s, GT3 0.38 s), overshoots the hold by the class
  //   median (8.5–15 %, ±40 %), holds it with a 4–7 Hz ripple of about 1–2 % and a slower 1–2 Hz wander, sometimes eases off 10–18 %
  //   for a moment (lock-up relief), and releases with a trail-brake tail (class time constant 0.25–0.37 s, ±30 %) into the corner.
  //   Per-class values learned from the owner's iRacing data (H, see C above; the 2026-11-15 values were 0.08 s, 4–10 %, 0.10–0.18 s).
  //   Each zone keeps the brake impulse of the physics (same deceleration on average).
  // throttle: squeezed on (time constant 0.10 s), snapped off (0.025 s), with a 2.5–4 Hz traction ripple while it is part-open and
  //   sometimes a short lift on the way up; off whenever the brake is on.
  // Seeded per track and car, so the page is stable. Values checked with Wolfram (docs/lapsim-physics-rules.md).
  function humanPedals(pb, th, rk, time, lapT, sd, H) {
    let hh = 2166136261; for (const c of sd) { hh ^= c.charCodeAt(0); hh = Math.imul(hh, 16777619); }
    const r = () => { hh = Math.imul(hh ^ (hh >>> 15), 2246822507) ^ Math.imul(hh ^ (hh >>> 13), 3266489909); return ((hh ^= hh >>> 16) >>> 0) / 4294967296; };
    const N = 2 * n, tAt = k => { const i = k >> 1; return k & 1 ? (time[i] + (i + 1 < n ? time[i + 1] : lapT)) / 2 : time[i]; };
    const up = (a, k) => { const i = k >> 1; return k & 1 ? (a[i] + a[(i + 1) % n]) / 2 : a[i]; };
    const t = Array.from({length: N}, (_, k) => tAt(k)), R = Array.from({length: N}, (_, k) => up(rk, k)), base = Array.from({length: N}, (_, k) => up(pb, k)), brake = new Array(N).fill(0);
    const fmax = k => 0.4 / Math.max(1e-3, (t[(k + 1) % N] - t[k] + lapT) % lapT); // stay below the sample rate (no aliasing in slow corners)
    for (let k = 0; k < N; k++) {
      if (!(base[k] > 0.5) || base[(k - 1 + N) % N] > 0.5) continue;
      let e = k; while (e + 1 < N && base[e + 1] > 0.5) e++;
      const t0 = t[k], P = Math.max(...base.slice(k, e + 1)), os = H.os * (0.6 + 0.8 * r()), f1 = 4 + 3 * r(), f2 = 1 + r(), a1 = H.rip * (0.7 + 0.6 * r()), ph1 = 6.28 * r(), ph2 = 6.28 * r();
      const tr = H.t90 / 2.303 * (0.8 + 0.4 * r()), tg = Math.max(0.09, 0.9 * H.t90); // rise: 90 % of the pressure after t90 (learned per class)
      // the riskiest point of the zone (crest, tailwind, bumps, ...) is where a lock-up is most likely: the relief goes there
      let kr = k; for (let q = k; q <= e; q++) if (R[q] > R[kr]) kr = q;
      const rz = R[kr], dipAt = r() < 0.25 + 0.6 * rz ? (rz > 0.15 ? t[kr] : t0 + (0.35 + 0.25 * r()) * (t[e] - t0)) : -1, dip = (0.1 + 0.08 * r()) * (1 + rz), tauOff = H.tau * (0.7 + 0.6 * r());
      let sumB = 0, sumH = 0;
      for (let q = k; q <= e; q++) {
        const x = t[q] - t0, rise = 1 - Math.exp(-x / tr), hold = Math.min(1, x / 0.15), g = x / tg * Math.exp(1 - x / tg);
        const rip = P * hold * (1 + 2 * R[q]) * (a1 * Math.sin(2 * Math.PI * Math.min(f1, fmax(q)) * x + ph1) + 0.012 * Math.sin(2 * Math.PI * f2 * x + ph2));
        const d = dipAt > 0 ? dip * base[q] * Math.exp(-(((t[q] - dipAt) / 0.04) ** 2)) : 0;
        brake[q] = Math.max(0, base[q] * rise + os * P * g + rip - d); sumB += base[q]; sumH += brake[q];
      }
      for (let q = k; q <= e; q++) brake[q] *= sumB / Math.max(1e-9, sumH); // same impulse as the physics
      const pEnd = Math.max(0.06 * P, brake[e]);
      for (let q = e + 1; q < N && t[q] - t[e] < 2.5 * tauOff && !(base[q] > 0.5); q++) { const y = pEnd * Math.exp(-(t[q] - t[e]) / tauOff); if (y < 0.5) break; brake[q] = y; }
      k = e;
    }
    const thr = new Array(N), fT = 2.5 + 1.5 * r(), phT = 6.28 * r();
    let y = up(th, N - 1), lift = -1;
    for (let k = 0; k < N; k++) {
      const want = up(th, k), dt = Math.max(1e-3, (t[k] - t[(k - 1 + N) % N] + lapT) % lapT);
      if (want > y && y < 0.05 && want > 0.2) { // start of a pick-up: maybe a short lift on the way up, likelier where grip is easy to lose
        let rm = 0; for (let q = k; q < Math.min(N, k + 24); q++) rm = Math.max(rm, R[q]);
        lift = r() < 0.2 + 0.6 * rm ? t[k] + 0.15 + 0.2 * r() : -1;
      }
      y += (want - y) * (1 - Math.exp(-dt / (want > y ? 0.1 : 0.025)));
      let o = y + (y > 0.05 && y < 0.97 ? 0.04 * (1 + 2 * R[k]) * Math.sin(2 * Math.PI * Math.min(fT, fmax(k)) * t[k] + phT) * Math.min(y, 1 - y) * 4 : 0);
      if (lift > 0 && Math.abs(t[k] - lift) < 0.06) o *= 0.85;
      thr[k] = brake[k] > 2 ? 0 : Math.max(0, Math.min(1, o));
    }
    return {brakeHuman: brake.map(x => +x.toFixed(1)), throttleHuman: thr.map(x => +(x * 100).toFixed(1))};
  }
}
