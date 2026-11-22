// Gate G (v2) of F1 model driver timing learned from the measured real pole laps (owner 2026-11-22). Pre-registered in the Project
// (claude/gate-f1-driver-timing-prereg-2026-11-22.md) before running. Usage: node scripts/sim/learn/f1-driver-gate.mjs [--json out.json]
import {writeFileSync} from 'node:fs';
import {simulationPage, lapsimScript} from '../../../worker/simulation.js';
import {lapsimF1RealTel} from '../../../worker/lapsim/f1-real-telemetry-data.js';

const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null, K = 1.45, Q = ['rise', 'pick', 'off'];
const binOf = kph => kph < 90 ? 0 : kph < 160 ? 1 : 2, med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
// corners and timing of one lap given position (m), speed (m/s), throttle (0–1) and brake (any unit, > 5 % of the zone peak = on)
export function corners(x, vs, th, br) {
  const n = vs.length, t = [0]; for (let i = 1; i < n; i++) t.push(t[i - 1] + Math.max(0, x[i] - x[i - 1]) / Math.max(1, (vs[i] + vs[i - 1]) / 2));
  const idx = (i0, dtS) => { let j = i0; if (dtS > 0) while (j < n - 1 && t[j] - t[i0] < dtS) j++; else while (j > 0 && t[i0] - t[j] < -dtS) j--; return j; };
  const out = [];
  for (let i = 1; i < n - 1; i++) {
    const a = idx(i, -2), b = idx(i, 2); let mn = Infinity; for (let j = a; j <= b; j++) mn = Math.min(mn, vs[j]); if (vs[i] !== mn || vs[i - 1] === vs[i]) continue;
    const p0 = idx(i, -8); let vin = 0; for (let j = p0; j < i; j++) vin = Math.max(vin, vs[j]); if (vin - vs[i] < 5) continue;
    const c = {bin: binOf(vs[i] * 3.6), rise: NaN, pick: NaN, off: NaN};
    let pk = 0; for (let j = p0; j <= i; j++) pk = Math.max(pk, br[j]);
    if (pk > 0) { let j = i; while (j > p0 && !(br[j] > 0.05 * pk)) j--; if (br[j] > 0.05 * pk) c.off = t[j] - t[i]; }
    const w0 = idx(i, -3), w1 = idx(i, 1); let tm = Infinity; for (let j = w0; j <= w1; j++) tm = Math.min(tm, th[j]);
    if (tm <= 0.9) { let km = w0; for (let j = w0; j <= w1; j++) if (th[j] <= tm + 0.02) km = j; const end = idx(km, 6);
      const first = lv => { for (let j = km; j <= end; j++) if (th[j] >= lv) return j; return -1; }, k10 = first(tm + 0.1 * (1 - tm)), k90 = first(tm + 0.9 * (1 - tm));
      if (k10 >= 0) c.pick = t[k10] - t[i]; if (k10 >= 0 && k90 >= 0 && t[k90] - t[k10] < 4) c.rise = t[k90] - t[k10]; }
    out.push(c);
  }
  return out;
}
const measured = r => corners(r.f.map(f => f / 1e4 * r.len), r.speed.map(s => s / 3.6), r.throttle.map(x => x / 100), r.brake);
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const pageCorners = (track, car, drv) => {
  const d = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); if (d.carId !== car) return null; d.realTel = null; // the model channels
  const R = {...V.R, lapChannels: (a, b, c, e, o) => V.R.lapChannels(a, b, c, e, {...o, drv})};
  const v = V.computeView(V.K, d, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, R);
  const L = k => v.tel.lanes.find(l => l.key === k), sp = L('speed'), n = sp.ser[0].v.length, ds = sp.ds;
  return corners(Array.from({length: n}, (_, i) => i * ds), sp.ser[0].v.map(x => x / 3.6), L('throttle').ser[0].v.filter((_, k) => k % 2 === 0).map(x => x / 100), L('brake').ser[0].v.filter((_, k) => k % 2 === 0));
};
const err = (O, P, q) => { const all = med(P.map(c => c[q])); return med(O.filter(o => Number.isFinite(o[q])).map(o => { const b = med(P.filter(c => c.bin === o.bin).map(c => c[q])); return Math.abs(o[q] - (Number.isFinite(b) ? b : all)); })); };
const tableOf = O => ({rise: [0, 1, 2].map(b => +med(O.filter(o => o.bin === b).map(o => o.rise)).toFixed(3)), pick: +med(O.map(o => o.pick)).toFixed(3), off: +med(O.map(o => o.off)).toFixed(3)});
const SHIP = {2025: ['off'], 2026: ['off']}; // passed in the pre-registered run (2026-11-22)
const result = {};
for (const year of ['2025', '2026']) {
  const tracks = Object.keys(lapsimF1RealTel).filter(tr => lapsimF1RealTel[tr][year]), M = Object.fromEntries(tracks.map(tr => [tr, measured(lapsimF1RealTel[tr][year])]));
  const g = Object.fromEntries(Q.map(q => [q, []])), rows = [];
  for (const tr of tracks) {
    const D = tableOf(tracks.filter(x => x !== tr).flatMap(x => M[x]));
    if (process.env.SHIP) { for (const q of Q) if (!(SHIP[year] || []).includes(q)) D[q] = null; Object.assign(D, year === '2025' ? {up: 0.771, down: 0.675} : {up: 0.778, down: 0.727}); } // confirmatory run: the shipped table
    const base = pageCorners(tr, year, null); if (!base) continue; const cand = pageCorners(tr, year, D), row = {track: tr, n: M[tr].length};
    for (const q of Q) { const eb = err(M[tr], base, q), ec = err(M[tr], cand, q); row[q] = [+eb.toFixed(3), +ec.toFixed(3)]; if (Number.isFinite(eb) && Number.isFinite(ec)) g[q].push(eb - ec); }
    rows.push(row); console.log(year, JSON.stringify(row));
  }
  const verdict = Object.fromEntries(Q.map(q => { const a = g[q], mu = a.reduce((s, x) => s + x, 0) / a.length, se = Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / (a.length - 1) / a.length);
    return [q, {tracks: a.length, gain: +mu.toFixed(3), se: +se.toFixed(3), pass: a.length >= 5 && mu - K * se > 0}]; }));
  result[year] = {table: tableOf(tracks.flatMap(x => M[x])), verdict, rows}; console.log(year, JSON.stringify(verdict), 'table', JSON.stringify(result[year].table));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 1));
