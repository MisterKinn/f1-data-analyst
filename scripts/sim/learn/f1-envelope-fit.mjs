// Step 28 (pre-reg 6e944cd1…, A1): envelope + DRS fit on 2023–25 quali speed traces, one leave-one-track-out fold per call.
// usage: node scripts/sim/learn/f1-envelope-fit.mjs <heldOutTrack> <variant V1|V2|V1-A3|V2-A3> <out.json>   (-A3: J = sum over laps, amendment A3)
//        node scripts/sim/learn/f1-envelope-fit.mjs --a2-baseline <out.json>   (A2 baseline rows: shipped car, held-out grip = geometric mean of the other tracks')
//        node scripts/sim/learn/f1-envelope-fit.mjs --baseline-check <out.json>   (node baseline vs the python rows; no candidate)
// Inputs (repo): scripts/sim/data/f1-envelope/traces.json, scripts/sim/data/f1-delta/f1-delta-cases-pooled-2026-11-24.csv.
// 2022 is never read: every event and case year is asserted in 2023..2025.
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../../worker/lapsim/tracks.js';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {carsFor, realConditions} from '../../../worker/lapsim/scenario.js';
import {nelderMead} from '../calibrate-lib.mjs';

const K = lapsimKernel(), here = new URL('../data/', import.meta.url);
const EV = Object.values(JSON.parse(readFileSync(new URL('f1-envelope/traces.json', here))).events);
const CASES = readFileSync(new URL('f1-delta/f1-delta-cases-pooled-2026-11-24.csv', here), 'utf8').trim().split(/\r?\n/);
const ZT = readFileSync(new URL('f1-delta/zone-mapping-table.csv', here), 'utf8').trim().split(/\r?\n/), zh = splitCsv(ZT.shift());
const ZONES = {}; for (const l of ZT) { const r = Object.fromEntries(splitCsv(l).map((v, i) => [zh[i], v])); if (r.sim_from_m !== '' && +r.year >= 2023 && +r.year <= 2025) (ZONES[r.year + '|' + r.event] ??= []).push({n: +r.zone, z: [+r.sim_from_m, +r.sim_to_m]}); }
const head = CASES.shift().split(','), cases = CASES.map(l => Object.fromEntries(splitCsv(l).map((v, i) => [head[i], v]))).filter(c => c.kept === '1'); // 125 kept (σ ≤ 0.1 s)
const BASEPRED = Object.fromEntries(readFileSync(new URL('f1-delta/baseline-pooled-2026-11-24.csv', here), 'utf8').trim().split(/\r?\n/).slice(1).map(l => splitCsv(l)).map(r => [r[0], +r[10]]));
for (const x of [...EV, ...cases]) if (!(+x.year >= 2023 && +x.year <= 2025)) throw new Error('year outside 2023-2025: ' + x.year); // 2022 LOCKED
const SEASONS = [2023, 2024, 2025], DELAY_M = 54, BIN = [120, 240];
const PRIOR = {muY: [carsFor('monza')['2025'].car.muY, 0.3], clA: [8.0, 2.0], cdA: [1.35, 0.12], c: [0.20, 0.015]}, KEYS = Object.keys(PRIOR);
const STEP = {muY: 0.05, clA: 0.5, cdA: 0.05, c: 0.01}, U_SD = 0.03, P_ICE = 540000, RHO_REF = 1.2;
// A2: the baseline of a held-out track uses the geometric mean of the other fold tracks' shipped grip (LOTO like the candidate)
const FOLD_TRACKS = [...new Set(EV.map(e => e.track))].sort(), shippedGrip = id => carsFor(id)['2025'].grip || 1;
const a2Grip = held => Math.exp(FOLD_TRACKS.filter(t => t !== held).reduce((a, t) => a + Math.log(shippedGrip(t)), 0) / (FOLD_TRACKS.length - 1));
// V2 (pre-reg §5): a_y,max = μ_y (1+u) g + k_y v², via the kernel's existing car.lateralCap hook ({quad: a0 + k v²} × grip, unset = today);
// k is divided by (1+u) so the speed term is not scaled by the track effect. Braking stays on the shipped path (lateralCap.braking unset).
const kyPrior = (p, car) => p.muY * RHO_REF * p.clA / (2 * car.mass);

function splitCsv(l) { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }
const envOf = id => { const cs = realConditions(id), r = cs['2025'] || cs['2026'] || Object.values(cs)[0] || {}, p = (k, f) => Number.isFinite(r[k]) ? r[k] : f;
  return K.conditionsFromWeather({airTempC: p('airTempC', 25), trackTempC: p('trackTempC', 35), humidityPct: p('humidityPct', 50), pressureHpa: p('pressureHpa', 1013.25), windSpeed: p('windSpeed', 0), windFromDeg: p('windFromDeg', 0)}); };
const L = id => T[id].kappa.length * T[id].ds;
// shipped = production path (c.grip, zones from the line); candidate = (1+u) grip, zones open DELAY_M after the line
function trackFor(id, zones, grip, delay) {
  const d = T[id], zs = zones.map(([a, b]) => [(a + delay) % L(id), b]);
  let tr = K.trackFromData(d);
  tr = {...tr, aeroLow: zs.length ? K.trackFromData({...d, aeroZones: zs}, {aero: 'fia'}).aeroLow : new Uint8Array(d.kappa.length)};
  return {...tr, mu: Float64Array.from(tr.mu, m => m * grip)};
}
function carOf(id, p, u = 0) { // p = null → shipped car
  const c = carsFor(id)['2025'].car; if (!p) return c;
  const s = p.muY / c.muY;
  const out = {...c, pIce: P_ICE, muX: c.muX * s, muY: p.muY, muXTrac: c.muXTrac * s, clA: p.clA, clALow: p.clA * c.clALow / c.clA, cdA: p.cdA, cdALow: p.cdA * (1 - p.c)};
  if (p.ky != null) out.lateralCap = {kind: 'quad', a0: p.muY * 9.81, k: p.ky / (1 + u), rhoRef: RHO_REF};
  return out;
}
const memo = new Map();
function sim(id, zones, car, grip, delay) {
  const k = JSON.stringify([id, zones, car, grip, delay]); if (memo.has(k)) return memo.get(k);
  const r = K.simulateLap(trackFor(id, zones, grip, delay), car, envOf(id)), out = {v: Array.from(r.v, x => x * 3.6), time: r.time, lap: r.lapTime, ds: T[id].ds};
  if (memo.size > 400) memo.clear(); memo.set(k, out); return out;
}
// per-event errors on the telemetry frame (same definitions as f1-envelope-baseline.py)
function score(e, r) {
  const n = e.n, w = e.w, vm = i => r.v[(((i - e.shift) % n) + n) % n], seg = c => { const d = []; for (let i = c - w; i <= c + w; i++) { const k = ((i % n) + n) % n, a = e.a[k]; if (a != null) d.push(vm(k) - a); } return d; };
  const rms = ds => ds.length ? Math.sqrt(ds.reduce((s, x) => s + x * x, 0) / ds.length) : null;
  const corner = e.corners.flatMap(([c]) => seg(c)), straight = e.straights.flatMap(c => seg(c)), bin = e.corners.filter(([, a]) => a >= BIN[0] && a < BIN[1]).flatMap(([c]) => seg(c));
  return {corner: rms(corner), straight: rms(straight), bin: rms(bin), lapErr: 100 * (r.lap - e.lap_meas_s) / e.lap_meas_s};
}
const Je = s => (s.corner ?? 0) / 5 + (s.straight ?? 0) / 5 + Math.abs(s.lapErr) / 0.5;
const evalEvent = (e, p, u, baseGrip) => score(e, p ? sim(e.track, e.zones, carOf(e.track, p, u), 1 + u, DELAY_M) : sim(e.track, e.zones, carOf(e.track, null), baseGrip ?? shippedGrip(e.track), 0));
const priorZ2 = p => KEYS.reduce((s, k) => s + ((p[k] - PRIOR[k][0]) / PRIOR[k][1]) ** 2, 0) + (p.ky != null ? ((p.ky - kyPrior(p, carsFor('monza')['2025'].car)) / (0.5 * kyPrior(p, carsFor('monza')['2025'].car))) ** 2 : 0);
const physical = p => p.muY > 0 && p.clA > 0 && p.cdA > 0 && p.c > 0 && p.c < 1 && (p.ky == null || p.ky > 0);

// DRS Δ for one pooled case (as f1-delta-bench.mjs model stage): zone time with all zones open minus with this zone closed
function drsPred(c, p, u, baseGrip) {
  const zl = ZONES[c.year + '|' + c.event]; if (!zl) return null; const zones = zl.map(q => q.z), z = zl.find(q => q.n === +c.zone)?.z; if (!z) return null;
  const id = c.track, Ln = L(id), a = z[0], end = (z[1] < z[0] ? z[1] + Ln : z[1]) + 150, others = zones.filter(q => q !== z);
  const run = zs => p ? sim(id, zs, carOf(id, p, u), 1 + u, DELAY_M) : sim(id, zs, carOf(id, null), baseGrip ?? shippedGrip(id), 0);
  const tAt = (r, s) => { const lap = r.lap, ex = s >= Ln ? lap : 0, x = (s % Ln) / r.ds, i = Math.floor(x), m = r.time.length, t0 = r.time[i % m], t1 = i + 1 < m ? r.time[i + 1] : lap; return ex + t0 + (t1 - t0) * (x - i); };
  const on = run(zones), off = run(others);
  return (tAt(on, end) - tAt(on, a)) - (tAt(off, end) - tAt(off, a));
}

const mode = process.argv[2];
if (mode === '--baseline-check') {
  const py = Object.fromEntries(JSON.parse(readFileSync(new URL('f1-envelope/envelope-baseline.json', here))).rows.filter(r => !r.drop).map(r => [r.year + '|' + r.event, r]));
  const rows = EV.map(e => { const s = evalEvent(e, null, 0), q = py[e.year + '|' + e.event]; return {key: e.year + '|' + e.event, node_bin: s.bin, py_bin: q.rms_bin_kph, node_lap: s.lapErr, py_lap: q.lap_err_pct}; });
  const dmax = Math.max(...rows.filter(r => r.py_bin != null).map(r => Math.abs(r.node_bin - r.py_bin))), lmax = Math.max(...rows.map(r => Math.abs(r.node_lap - r.py_lap)));
  const csvPred = cases.map(c => ({id: c.case_id, csv: BASEPRED[c.case_id], node: drsPred(c, null, 0)})), pmax = Math.max(...csvPred.map(x => Math.abs(x.csv - x.node)));
  writeFileSync(process.argv[3], JSON.stringify({maxAbsBinKph: dmax, maxAbsLapPct: lmax, drsCases: csvPred.length, maxAbsDrsS: pmax, rows, csvPred}, null, 1));
  console.log({maxAbsBinKph: dmax, maxAbsLapPct: lmax, drsCases: csvPred.length, maxAbsDrsS: pmax});
  if (dmax > 0.5 || !(pmax < 0.005)) process.exit(1);
} else if (mode === '--a2-baseline') {
  const rows = [], drs = [];
  for (const t of FOLD_TRACKS) {
    const g = a2Grip(t);
    for (const e of EV.filter(x => x.track === t)) { const s = evalEvent(e, null, 0, g); rows.push({key: e.year + '|' + e.event, year: e.year, event: e.event, track: t, grip: g, shipped_grip: shippedGrip(t), rms_bin_kph: s.bin, lap_err_pct: s.lapErr}); }
    for (const c of cases.filter(x => x.track === t)) drs.push({id: c.case_id, track: t, year: +c.year, meas: +c.meas_delta_s, pred: drsPred(c, null, 0, g)});
  }
  if (drs.some(d => d.pred == null) || drs.length !== cases.length) throw new Error('A2 baseline: DRS case without a prediction or outside the fold tracks');
  writeFileSync(process.argv[3], JSON.stringify({rule: 'A2: held-out grip = geometric mean of the other fold tracks shipped grip', rows, drs}, null, 1));
  console.log('A2 baseline rows', rows.length, 'drs', drs.length);
} else {
  const [held, variant, out] = process.argv.slice(2);
  if (!['V1', 'V2', 'V1-A3', 'V2-A3'].includes(variant)) throw new Error('V1, V2, V1-A3 or V2-A3 only (V3 dropped, A3.3)');
  const form = variant.slice(0, 2), DIV = variant.endsWith('-A3') ? 1 : null; // A3: sum over training laps (DIV 1), else mean (divide by N)
  const train = EV.filter(e => e.track !== held), test = EV.filter(e => e.track === held), N = DIV ?? train.length;
  if (!test.length) throw new Error('no events for ' + held);
  const tracks = [...new Set(train.map(e => e.track))].sort();
  const u = Object.fromEntries(tracks.map(t => [t, 0])), P = Object.fromEntries(SEASONS.map(s => [s, Object.fromEntries(KEYS.map(k => [k, PRIOR[k][0]]))]));
  let rng = 28; const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
  const seasonJ = (s, p) => physical(p) ? train.filter(e => e.year === s).reduce((a, e) => a + Je(evalEvent(e, p, u[e.track])), 0) / N + priorZ2(p) : 1e9;
  const log = [];
  for (let round = 0; round < 3; round++) {
    for (const s of SEASONS) {
      if (!train.some(e => e.year === s)) continue;
      const KS = form === 'V2' ? [...KEYS, 'ky'] : KEYS, ky0 = p => kyPrior(p, carsFor('monza')['2025'].car);
      const draw = () => { const p = Object.fromEntries(KEYS.map(k => [k, PRIOR[k][0] + (rand() - 0.5) * PRIOR[k][1]])); if (form === 'V2') p.ky = ky0(p) * (1 + (rand() - 0.5) * 0.5); return KS.map(k => p[k]); };
      if (form === 'V2' && P[s].ky == null) P[s].ky = ky0(P[s]);
      const starts = [KS.map(k => P[s][k]), draw(), draw()];
      let best = null;
      for (const x0 of starts) { const r = nelderMead(x => seasonJ(s, Object.fromEntries(KS.map((k, i) => [k, x[i]]))), x0, {step: KS.map(k => k === 'ky' ? 0.1 * ky0(P[s]) : STEP[k]), iters: 300, relTol: 1e-4}); if (!best || r.value < best.value) best = r; }
      P[s] = Object.fromEntries(KS.map((k, i) => [k, best.x[i]])); log.push({round, season: s, J: best.value, it: best.it});
    }
    for (const t of tracks) { // golden search on u_t
      const ev = train.filter(e => e.track === t), f = x => ev.reduce((a, e) => a + Je(evalEvent(e, P[e.year], x)), 0) / N + (x / U_SD) ** 2;
      let lo = -0.15, hi = 0.15; const g = (Math.sqrt(5) - 1) / 2; let c = hi - g * (hi - lo), d = lo + g * (hi - lo), fc = f(c), fd = f(d);
      for (let i = 0; i < 14; i++) { if (fc < fd) { hi = d; d = c; fd = fc; c = hi - g * (hi - lo); fc = f(c); } else { lo = c; c = d; fc = fd; d = lo + g * (hi - lo); fd = f(d); } }
      u[t] = (lo + hi) / 2;
    }
    console.error('round', round, JSON.stringify(P));
  }
  const zOf = (p, k) => k === 'ky' ? (p.ky - kyPrior(p, carsFor('monza')['2025'].car)) / (0.5 * kyPrior(p, carsFor('monza')['2025'].car)) : (p[k] - PRIOR[k][0]) / PRIOR[k][1];
  const offPrior = SEASONS.flatMap(s => Object.keys(P[s]).filter(k => Math.abs(zOf(P[s], k)) > 2).map(k => ({season: s, key: k, value: P[s][k], z: zOf(P[s], k)})));
  const priorZ = Object.fromEntries(SEASONS.map(s => [s, Object.fromEntries(Object.keys(P[s]).map(k => [k, zOf(P[s], k)]))]));
  const g2 = a2Grip(held);
  const heldScores = test.map(e => ({key: e.year + '|' + e.event, year: e.year, cand: evalEvent(e, P[e.year], 0), base: evalEvent(e, null, 0, g2)})); // base = A2
  const drs = cases.filter(c => c.track === held).map(c => ({id: c.case_id, year: +c.year, meas: +c.meas_delta_s, cand: drsPred(c, P[+c.year], 0), base: drsPred(c, null, 0, g2)}));
  writeFileSync(out, JSON.stringify({held, variant, baseline: 'A2', params: P, priorZ, u, offPrior, log, heldScores, drs}, null, 1));
  console.log(held, 'events', test.length, 'drs', drs.length);
}
