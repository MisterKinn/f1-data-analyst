// Two-node tyre thermal model, stand-alone (step 7a, claude/gate-tyre-thermal-7a-prereg-2026-11-23.md).
// Per axle: tread surface Ts and carcass bulk Tb (°C), lumped nodes.
//   C_s dTs/dt = q_s − G_t (Ts − T_track) − G_a(v) (Ts − T_air) − G_sb (Ts − Tb)
//   C_b dTb/dt = q_b + G_sb (Ts − Tb) − G_b(v) (Tb − T_air)
// q_s = η · slip · |F| · v (sliding power), |F| = m √(a_x² + a_y²); q_b = η · rr · (m g + ½ ρ ClA v²) · v (rolling).
// Convective G ∝ (v / 60 m/s)^0.8. The power and speed traces come from a lap the kernel returned (read only).
// Each step is backward Euler, so it is stable at any step and each node's energy balance closes exactly
// (in − out = stored, with the fluxes at the new temperatures). Grip = window(Ts) per compound family.
// Everything here is an assumption except what tyre-thermal-fit.mjs fits (τ_s, τ_b, Tc, w per family); the
// temperature scale is set by η (steady push lap at the reference = T_REF_SURFACE), so Tc is effective on that scale.

export const TYRE_THERMAL_DEFAULTS = {
  Cs: 2000, Cb: 24000,                  // J/K per axle (assumption)
  tauS: 30, tauB: 400,                  // s at 60 m/s (fitted by tyre-thermal-fit.mjs; these are start values)
  shareS: {track: 0.3, air: 0.3, bulk: 0.4},
  heatFront: 0.45,                      // share of the heat into the front axle (assumption, not identifiable)
  slip: 0.05, rr: 0.015,                // sliding-speed ratio and rolling loss share (only their ratio matters; η scales both)
  vRef: 60, convExp: 0.8,
  ref: {trackC: 35, airC: 25, surfaceC: 100}, // η is solved so the steady push lap at ref has mean Ts = surfaceC
  blanketC: 70,                         // both nodes at pit exit (F1 2023–26 blankets, assumption)
  depth: 0.10,                          // grip lost far outside the window (assumption)
  window: {S: {tc: 100, w: 35}, M: {tc: 105, w: 35}, H: {tc: 110, w: 35}},
};

const G = 9.81;

// Conductances (W/K) of one axle from the time constants. Surface: total C_s/τ_s at vRef, split by shareS.
// Bulk: total C_b/τ_b = G_sb + G_b(vRef); G_b keeps at least 10 % of the total.
export function conductances(P = TYRE_THERMAL_DEFAULTS) {
  const gs = P.Cs / P.tauS, gsb = P.shareS.bulk * gs, gbTot = P.Cb / P.tauB;
  return {gt: P.shareS.track * gs, ga: P.shareS.air * gs, gsb, gb: Math.max(0.1 * gbTot, gbTot - gsb)};
}

// Per-point loads from a kernel lap: dt (s), v (m/s) and the two heat powers before η (W).
export function lapLoads(track, car, lap, env = {}) {
  const n = lap.v.length, ds = track.ds, rho = env.rho ?? 1.18, m = car.mass;
  const dt = new Float64Array(n), v = new Float64Array(n), slide = new Float64Array(n), rollW = new Float64Array(n), rollA = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, vm = Math.max(1, 0.5 * (lap.v[i] + lap.v[j]));
    const ax = (lap.v[j] * lap.v[j] - lap.v[i] * lap.v[i]) / (2 * ds), ay = vm * vm * Math.abs(track.kappa[i]);
    dt[i] = ds / vm; v[i] = vm;
    slide[i] = m * Math.hypot(ax, ay) * vm;
    rollW[i] = m * G * vm; rollA[i] = 0.5 * rho * car.clA * vm * vm * vm;
  }
  return {dt, v, slide, rollW, rollA};
}

// The same lap driven at a fraction r of the push speed (out-lap, cool lap): times / r, forces × r².
export function scaleLoads(L, r) {
  if (r === 1) return L;
  const r3 = r * r * r;
  return {dt: L.dt.map(x => x / r), v: L.v.map(x => x * r), slide: L.slide.map(x => x * r3), rollW: L.rollW.map(x => x * r), rollA: L.rollA.map(x => x * r3)};
}

export const initState = (P = TYRE_THERMAL_DEFAULTS, T = P.blanketC) => ({f: {s: T, b: T}, r: {s: T, b: T}});

// One backward-Euler step of one axle. Returns the new node temperatures and the energy ledger (J).
export function stepAxle(n, {qs, qb, v, dt, trackC, airC}, K, P = TYRE_THERMAL_DEFAULTS) {
  const c = Math.pow(Math.max(0, v) / P.vRef, P.convExp), ga = K.ga * c, gb = K.gb * c;
  // [a11 a12; a21 a22] [Ts'; Tb'] = [r1; r2]
  const a11 = P.Cs / dt + K.gt + ga + K.gsb, a12 = -K.gsb, r1 = P.Cs / dt * n.s + qs + K.gt * trackC + ga * airC;
  const a21 = -K.gsb, a22 = P.Cb / dt + K.gsb + gb, r2 = P.Cb / dt * n.b + qb + gb * airC;
  const det = a11 * a22 - a12 * a21, s = (r1 * a22 - a12 * r2) / det, b = (a11 * r2 - a21 * r1) / det;
  const exch = K.gsb * (s - b) * dt;
  return {s, b, ledger: {
    surface: {in: qs * dt, out: (K.gt * (s - trackC) + ga * (s - airC)) * dt + exch, stored: P.Cs * (s - n.s)},
    bulk: {in: qb * dt + exch, out: gb * (b - airC) * dt, stored: P.Cb * (b - n.b)},
  }};
}

export function windowGrip(Ts, fam = 'S', P = TYRE_THERMAL_DEFAULTS) {
  const w = P.window[fam] || P.window.S, x = (Ts - w.tc) / w.w;
  return 1 - P.depth * (1 - Math.exp(-x * x));
}

// Drive one lap (loads already scaled) from a state. η scales the heat. Returns the end state, the
// time-weighted mean grip and mean surface temperature, and optionally per-point traces.
export function runLap(state, L, {trackC, airC, eta, fam = 'S'}, P = TYRE_THERMAL_DEFAULTS, {trace = false} = {}) {
  const K = conductances(P), n = L.dt.length, hf = P.heatFront;
  let f = {...state.f}, r = {...state.r}, gSum = 0, tsSum = 0, T = 0;
  const tr = trace ? {ts: new Float64Array(n), tb: new Float64Array(n), grip: new Float64Array(n)} : null;
  for (let i = 0; i < n; i++) {
    const qs = eta * P.slip * L.slide[i], qb = eta * P.rr * (L.rollW[i] + L.rollA[i]), base = {v: L.v[i], dt: L.dt[i], trackC, airC};
    const nf = stepAxle(f, {...base, qs: hf * qs, qb: hf * qb}, K, P), nr = stepAxle(r, {...base, qs: (1 - hf) * qs, qb: (1 - hf) * qb}, K, P);
    f = {s: nf.s, b: nf.b}; r = {s: nr.s, b: nr.b};
    const g = 0.5 * (windowGrip(f.s, fam, P) + windowGrip(r.s, fam, P)), dt = L.dt[i];
    gSum += g * dt; tsSum += 0.5 * (f.s + r.s) * dt; T += dt;
    if (tr) { tr.ts[i] = 0.5 * (f.s + r.s); tr.tb[i] = 0.5 * (f.b + r.b); tr.grip[i] = g; }
  }
  return {state: {f, r}, grip: gSum / T, meanTs: tsSum / T, time: T, trace: tr};
}

// Steady (periodic) push lap: repeat until the end state stops changing.
export function steadyLap(L, cond, P = TYRE_THERMAL_DEFAULTS, {laps = 60, tol = 1e-6} = {}) {
  let st = initState(P, 0.5 * (cond.trackC + cond.airC)), out = null;
  for (let k = 0; k < laps; k++) {
    out = runLap(st, L, cond, P);
    const d = Math.abs(out.state.f.s - st.f.s) + Math.abs(out.state.r.b - st.r.b);
    st = out.state; if (d < tol) break;
  }
  return out;
}

// η such that the steady push lap at the reference conditions has mean Ts = ref.surfaceC. The model is linear in
// η once the temperatures are given, so two runs give it exactly.
export function solveEta(L, P = TYRE_THERMAL_DEFAULTS) {
  const c = {trackC: P.ref.trackC, airC: P.ref.airC};
  const t0 = steadyLap(L, {...c, eta: 0}, P).meanTs, t1 = steadyLap(L, {...c, eta: 1}, P).meanTs;
  return (P.ref.surfaceC - t0) / (t1 - t0);
}

// A run of laps from pit exit: seq = [{r: speed fraction, ...}], first lap starts from the blankets.
export function runSequence(L, seq, cond, P = TYRE_THERMAL_DEFAULTS) {
  let st = initState(P);
  return seq.map(lap => { const o = runLap(st, scaleLoads(L, lap.r), cond, P); st = o.state; return o; });
}

// Proposed grip hook for step 1 / 7b (docs/lapsim-hooks.md once published): the kernel asks
// env.gripHook(i, state) for a grip multiplier at point i. This factory precomputes the per-point grip of one
// lap of a run and returns a hook that reads it; state is not needed by the thermal model (its history is the run).
export function gripHookFromTrace(trace, gRef = 1) {
  const g = trace.grip;
  return i => g[i % g.length] / gRef;
}
