// Step 31 (docs/prereg/step31-decoupled-2026-11-25.md): leave-one-track-out fit of decoupled car limits (lateral quad, own braking,
// own traction) + one F1 kerb-use factor f_kerb on the corridor geometry, judged against the step 28 A2 baseline. Research only.
// Usage (repo root): node scripts/sim/learn/step31-fit.mjs <held-out track> <V1|V2> <out.json>
// Inputs (repo): scripts/sim/data/f1-envelope/traces.json, scripts/sim/data/step31/corridor.json, f1-delta case and zone CSVs.
// 2022 is never read: every event and case year is asserted in 2023..2025.
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../../worker/lapsim/tracks.js';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {carsFor, realConditions} from '../../../worker/lapsim/scenario.js';
import {nelderMead} from '../calibrate-lib.mjs';

const K = lapsimKernel(), here = new URL('../data/', import.meta.url), G = 9.81;
const EV = Object.values(JSON.parse(readFileSync(new URL('f1-envelope/traces.json', here))).events);
const COR = JSON.parse(readFileSync(new URL('step31/corridor.json', here)));
const CASES = readFileSync(new URL('f1-delta/f1-delta-cases-pooled-2026-11-24.csv', here), 'utf8').trim().split(/\r?\n/);
const ZT = readFileSync(new URL('f1-delta/zone-mapping-table.csv', here), 'utf8').trim().split(/\r?\n/), zh = splitCsv(ZT.shift());
const ZONES = {}; for (const l of ZT) { const r = Object.fromEntries(splitCsv(l).map((v, i) => [zh[i], v])); if (r.sim_from_m !== '' && +r.year >= 2023 && +r.year <= 2025) (ZONES[r.year + '|' + r.event] ??= []).push({n: +r.zone, z: [+r.sim_from_m, +r.sim_to_m]}); }
const head = CASES.shift().split(','), cases = CASES.map(l => Object.fromEntries(splitCsv(l).map((v, i) => [head[i], v]))).filter(c => c.kept === '1');
for (const x of [...EV, ...cases]) if (!(+x.year >= 2023 && +x.year <= 2025)) throw new Error('year outside 2023-2025: ' + x.year); // 2022 LOCKED
const SEASONS = [2023, 2024, 2025], P_ICE = 540000, U_SD = 0.03, ITERS = +(process.env.STEP31_SMOKE_ITERS || 300); // smoke runs only; the fold runs use 300
// pre-reg §3.2 priors (mean, sd); mu0, b0, aTr in g; ka, b2 in 1/m
const PRIOR = {mu0: [3.07, 0.45], ka: [0.00474, 0.0013], b0: [1.15, 0.30], b2: [0.00583, 0.0015], aTr: [1.34, 0.20]}, KEYS = Object.keys(PRIOR);
const FK = [0.5, 0.3], STEP = {mu0: 0.1, ka: 0.0005, b0: 0.1, b2: 0.0005, aTr: 0.05};
const FOLD = [...new Set(EV.map(e => e.track))].sort(), shippedGrip = id => carsFor(id)['2025'].grip || 1;
const a2Grip = held => Math.exp(FOLD.filter(t => t !== held).reduce((a, t) => a + Math.log(shippedGrip(t)), 0) / (FOLD.length - 1));

function splitCsv(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const envOf = id => { const cs = realConditions(id), r = cs['2025'] || cs['2026'] || Object.values(cs)[0] || {}, p = (k, f) => Number.isFinite(r[k]) ? r[k] : f;
  return K.conditionsFromWeather({airTempC: p('airTempC', 25), trackTempC: p('trackTempC', 35), humidityPct: p('humidityPct', 50), pressureHpa: p('pressureHpa', 1013.25), windSpeed: p('windSpeed', 0), windFromDeg: p('windFromDeg', 0)}); };
const L = id => T[id].kappa.length * T[id].ds;

// corridor κ multiplier (pre-reg §3.1): per corner scale(f) on the f grid, made non-increasing in f (more corridor never tightens),
// linear in f between grid points; × scale within ±60 m of the apex, linear back to 1 at ±120 m; overlapping corners take the smaller
const COR_MULT = new Map();
function corridorMult(id, fk) {
  const c = COR.tracks[id]; if (!c || fk == null) return null;
  const key = id + '|' + fk; if (COR_MULT.has(key)) return COR_MULT.get(key);
  const n = T[id].kappa.length, ds = T[id].ds, fs = COR.fs, m = new Float64Array(n).fill(1);
  for (const r of c.corners) {
    const sc = r.scale.map((x, i) => Math.min(...r.scale.slice(0, i + 1)));
    const j = Math.min(fs.length - 2, Math.floor(fk / (fs[1] - fs[0]))), w = (fk - fs[j]) / (fs[j + 1] - fs[j]), s = sc[j] + w * (sc[j + 1] - sc[j]);
    for (let k = 0; k < n; k++) {
      const d = Math.min(Math.abs(k - r.ia), n - Math.abs(k - r.ia)) * ds;
      const mk = d <= COR.core_m ? s : d <= COR.taper_m ? s + (1 - s) * (d - COR.core_m) / (COR.taper_m - COR.core_m) : 1;
      if (mk < m[k]) m[k] = mk;
    }
  }
  if (COR_MULT.size > 2000) COR_MULT.clear(); COR_MULT.set(key, m); return m;
}
function trackFor(id, zones, grip, fk) {
  const d = T[id];
  let tr = K.trackFromData(d);
  tr = {...tr, aeroLow: zones.length ? K.trackFromData({...d, aeroZones: zones}, {aero: 'fia'}).aeroLow : new Uint8Array(d.kappa.length)};
  const m = corridorMult(id, fk); if (m) tr = {...tr, kappa: Float64Array.from(tr.kappa, (x, i) => x * m[i])};
  return {...tr, mu: Float64Array.from(tr.mu, x => x * grip)};
}
function carOf(id, p) { // p = null → shipped car
  const c = carsFor(id)['2025'].car; if (!p) return c;
  return {...c, pIce: P_ICE, lateralCap: {kind: 'quad', a0: p.mu0 * G, k: p.ka, rhoRef: 1.2}, decoupled: {b0: p.b0 * G, b2: p.b2, aTr: p.aTr * G}};
}
const memo = new Map();
function sim(id, zones, car, grip, fk) {
  const k = JSON.stringify([id, zones, car, grip, fk]); if (memo.has(k)) return memo.get(k);
  const r = K.simulateLap(trackFor(id, zones, grip, fk), car, envOf(id)), out = {v: Array.from(r.v, x => x * 3.6), time: r.time, lap: r.lapTime, ds: T[id].ds};
  if (memo.size > 400) memo.clear(); memo.set(k, out); return out;
}

// per-event scores on the measured frame (same definitions as step31_power.py / step 30c)
function score(e, r) {
  const n = e.n, ds = e.ds, meas = e.a.map(x => x == null ? NaN : x), vm = k => r.v[(((k - e.shift) % n) + n) % n], w = Math.trunc(40 / ds);
  const apex = [], entry = [], exit = [], st = e.straights;
  e.corners.forEach(([i], j) => {
    let vmin = Infinity; for (let q = -w; q <= w; q++) vmin = Math.min(vmin, vm(i + q));
    apex.push({meas: meas[i], err: vmin - meas[i]});
    if (st.length < 2) return;
    const a0 = st[j], a1 = st[(j + 1) % st.length], seg = []; for (let q = a0; q <= a1 + (a1 <= a0 ? n : 0); q++) seg.push(q % n);
    const k0 = seg.indexOf(i); if (k0 < 0) return;
    const vv = seg.map(q => meas[q]), dt = seg.map((q, z) => Number.isFinite(vv[z]) ? ds / (vm(q) / 3.6) - ds / (vv[z] / 3.6) : 0);
    let lo = k0, hi = k0; const lim = 1.05 * meas[i];
    while (lo > 0 && Number.isFinite(vv[lo - 1]) && vv[lo - 1] <= lim) lo--;
    while (hi < seg.length - 1 && Number.isFinite(vv[hi + 1]) && vv[hi + 1] <= lim) hi++;
    entry.push(dt.slice(0, lo).reduce((a, b) => a + b, 0)); exit.push(dt.slice(hi + 1).reduce((a, b) => a + b, 0));
  });
  const rms = xs => xs.length ? Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length) : null;
  const band = (lo, hi) => rms(apex.filter(c => c.meas >= lo && c.meas < hi).map(c => c.err));
  return {apexAll: rms(apex.map(c => c.err)), apex120_240: band(120, 240), apex120_180: band(120, 180), entry: rms(entry), exit: rms(exit),
    lapErr: 100 * (r.lap - e.lap_meas_s) / e.lap_meas_s};
}
const Je = s => (s.apexAll ?? 0) / 5 + (s.entry ?? 0) / 0.10 + (s.exit ?? 0) / 0.10 + Math.abs(s.lapErr) / 0.5; // pre-reg §4
const candRun = (e, p, u, fk) => sim(e.track, e.zones, carOf(e.track, p), 1 + u, fk);
const baseRun = (e, g) => sim(e.track, e.zones, carOf(e.track, null), g, null);
const priorZ2 = p => KEYS.reduce((s, k) => s + ((p[k] - PRIOR[k][0]) / PRIOR[k][1]) ** 2, 0);
const physical = p => p.mu0 > 0 && p.ka >= 0 && p.b0 > 0 && p.b2 >= 0 && p.aTr > 0;

// DRS Δ for one pooled case (as f1-envelope-fit.mjs): zone time with all zones open minus with this zone closed; zones unchanged (shipped)
function drsPred(c, run) {
  const zl = ZONES[c.year + '|' + c.event]; if (!zl) return null; const zones = zl.map(q => q.z), z = zl.find(q => q.n === +c.zone)?.z; if (!z) return null;
  const Ln = L(c.track), a = z[0], end = (z[1] < z[0] ? z[1] + Ln : z[1]) + 150, others = zones.filter(q => q !== z);
  const tAt = (r, s) => { const lap = r.lap, ex = s >= Ln ? lap : 0, x = (s % Ln) / r.ds, i = Math.floor(x), m = r.time.length, t0 = r.time[i % m], t1 = i + 1 < m ? r.time[i + 1] : lap; return ex + t0 + (t1 - t0) * (x - i); };
  const on = run(zones), off = run(others);
  return (tAt(on, end) - tAt(on, a)) - (tAt(off, end) - tAt(off, a));
}
function golden(f, lo, hi, it = 14) {
  const g = (Math.sqrt(5) - 1) / 2; let c = hi - g * (hi - lo), d = lo + g * (hi - lo), fc = f(c), fd = f(d);
  for (let i = 0; i < it; i++) { if (fc < fd) { hi = d; d = c; fd = fc; c = hi - g * (hi - lo); fc = f(c); } else { lo = c; c = d; fc = fd; d = lo + g * (hi - lo); fd = f(d); } }
  return (lo + hi) / 2;
}

const [held, variant, out] = process.argv.slice(2);
if (!['V1', 'V2'].includes(variant)) throw new Error('V1 or V2 (pre-reg §7)');
const train = EV.filter(e => e.track !== held), test = EV.filter(e => e.track === held);
if (!test.length) throw new Error('no events for ' + held);
const tracks = [...new Set(train.map(e => e.track))].sort();
const u = Object.fromEntries(tracks.map(t => [t, 0])), P = Object.fromEntries(SEASONS.map(s => [s, Object.fromEntries(KEYS.map(k => [k, PRIOR[k][0]]))]));
let fk = variant === 'V2' ? 0 : FK[0];
const seasonJ = (s, p) => physical(p) ? train.filter(e => e.year === s).reduce((a, e) => a + Je(score(e, candRun(e, p, u[e.track], fk))), 0) + priorZ2(p) : 1e9;
const log = [];
for (let round = 0; round < (process.env.STEP31_SMOKE_ITERS ? 1 : 3); round++) {
  for (const s of SEASONS) {
    const starts = [KEYS.map(k => P[s][k]), KEYS.map(k => PRIOR[k][0] + PRIOR[k][1])];
    let best = null;
    for (const x0 of starts) { const r = nelderMead(x => seasonJ(s, Object.fromEntries(KEYS.map((k, i) => [k, x[i]]))), x0, {step: KEYS.map(k => STEP[k]), iters: ITERS, relTol: 1e-4}); if (!best || r.value < best.value) best = r; }
    P[s] = Object.fromEntries(KEYS.map((k, i) => [k, best.x[i]])); log.push({round, season: s, J: best.value, it: best.it});
  }
  if (variant === 'V1') { // one F1 kerb-use factor on all training laps, prior N(0.5, 0.3²), bounded [0, 1]
    const f = x => train.reduce((a, e) => a + Je(score(e, candRun(e, P[e.year], u[e.track], x))), 0) + ((x - FK[0]) / FK[1]) ** 2;
    fk = golden(f, 0, 1); log.push({round, fk, J: f(fk)});
  }
  for (const t of tracks) { // golden search on u_t, prior N(0, 0.03²)
    const ev = train.filter(e => e.track === t), f = x => ev.reduce((a, e) => a + Je(score(e, candRun(e, P[e.year], x, fk))), 0) + (x / U_SD) ** 2;
    u[t] = golden(f, -0.15, 0.15);
  }
  console.error('round', round, 'fk', fk.toFixed(3), JSON.stringify(P));
}
// f_kerb profile (V1): training J on a grid, for the 90 % profile interval in the verdict (Δ(−2 log L) = J − J_min ≤ 2.71)
const fkProfile = variant === 'V1' ? [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map(x => ({fk: x, J: train.reduce((a, e) => a + Je(score(e, candRun(e, P[e.year], u[e.track], x))), 0) + ((x - FK[0]) / FK[1]) ** 2})) : null;
const priorZ = Object.fromEntries(SEASONS.map(s => [s, Object.fromEntries(KEYS.map(k => [k, (P[s][k] - PRIOR[k][0]) / PRIOR[k][1]]))]));
const offPrior = SEASONS.flatMap(s => KEYS.filter(k => Math.abs(priorZ[s][k]) > 2).map(k => ({season: s, key: k, value: P[s][k], z: priorZ[s][k]})));
const g2 = a2Grip(held), round2 = a => a.map(x => Math.round(x * 100) / 100);
const heldScores = test.map(e => { const rc = candRun(e, P[e.year], 0, fk), rb = baseRun(e, g2);
  return {key: e.year + '|' + e.event, year: e.year, cand: score(e, rc), base: score(e, rb), vCand: round2(rc.v), vBase: round2(rb.v)}; });
const drs = cases.filter(c => c.track === held).map(c => ({id: c.case_id, year: +c.year, meas: +c.meas_delta_s,
  cand: drsPred(c, zs => sim(c.track, zs, carOf(c.track, P[+c.year]), 1, fk)), base: drsPred(c, zs => sim(c.track, zs, carOf(c.track, null), g2, null))}));
writeFileSync(out, JSON.stringify({held, variant, baseline: 'A2', corridor: !!COR.tracks[held], params: P, fk, fkProfile, priorZ, u, offPrior, log, heldScores, drs}));
console.log(held, variant, 'events', test.length, 'drs', drs.length, 'fk', fk.toFixed(3));
