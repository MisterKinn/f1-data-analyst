// Gate G (v2): F1 shift points learned from the measured real pole laps vs the page's model gear trace (owner 2026-11-22). Pre-registered
// in the Project (claude/gate-f1-shifts-prereg-2026-11-22.md). Usage: node scripts/sim/learn/f1-shift-gate.mjs [--json out.json]
import {writeFileSync} from 'node:fs';
import {simulationPage, lapsimScript} from '../../../worker/simulation.js';
import {lapsimF1RealTel} from '../../../worker/lapsim/f1-real-telemetry-data.js';
import {cleanTel} from '../../../worker/lapsim/real-tel-gaps.js';
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null, K = 1.45;
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
// shifts of one lap: x (m), v (m/s), gear, rpm; rpm before an upshift = max over the 0.5 s before it; landing rpm of a downshift
const shiftsOf = (x, v, G, P, top, near = () => false) => { const n = v.length, t = [0]; for (let i = 1; i < n; i++) t.push(t[i - 1] + Math.max(0, x[i] - x[i - 1]) / Math.max(1, (v[i] + v[i - 1]) / 2));
  const up = [], down = [];
  for (let i = 1; i < n; i++) { if (near(x[i])) continue; if (G[i] > G[i - 1] && G[i - 1] > 0) { let m = P[i - 1]; for (let j = i - 1; j >= 0 && t[i - 1] - t[j] <= 0.5; j--) m = Math.max(m, P[j]); up.push(m / top); }
    if (G[i] < G[i - 1] && G[i] > 0) down.push(P[i] / top); }
  return {up, down}; };
const page = (track, car, drv) => {
  const d = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); if (d.carId !== car) return null; d.realTel = null;
  const top = d.cars[car].car.engine.rpmMax, R = {...V.R, lapChannels: (a, b, c, e, o) => V.R.lapChannels(a, b, c, e, {...o, drv})};
  const v = V.computeView(V.K, d, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, R);
  const lane = k => v.tel.lanes.find(l => l.key === k), sp = lane('speed'), n = sp.ser[0].v.length;
  const s = shiftsOf(Array.from({length: n}, (_, i) => i * sp.ds), sp.ser[0].v.map(x => x / 3.6), lane('gear').ser[0].v, lane('rpm').ser[0].v, top);
  return {up: med(s.up), down: med(s.down), top};
};
const result = {};
for (const year of ['2025', '2026']) {
  const tracks = Object.keys(lapsimF1RealTel).filter(tr => lapsimF1RealTel[tr][year]), top = page(tracks[0], year, null).top;
  const M = Object.fromEntries(tracks.map(tr => { const c = cleanTel(lapsimF1RealTel[tr][year]); if (c.share > 0.5) { console.log('dropped (more than half broken):', tr, year); return [tr, {up: [], down: []}]; } return [tr, shiftsOf(c.x, c.speed.map(s => s / 3.6), c.gear, c.rpm, top, c.near)]; })); // broken stretches out
  const g = {up: [], down: []}, rows = [];
  for (const tr of tracks) {
    const D = {up: med(tracks.filter(x => x !== tr).flatMap(x => M[x].up)), down: med(tracks.filter(x => x !== tr).flatMap(x => M[x].down))};
    const b = page(tr, year, null); if (!b) continue; const cd = page(tr, year, D), row = {track: tr};
    for (const q of ['up', 'down']) { const eb = med(M[tr][q].map(o => Math.abs(o - b[q]))), ec = med(M[tr][q].map(o => Math.abs(o - cd[q]))); row[q] = [+eb.toFixed(3), +ec.toFixed(3)]; if (Number.isFinite(eb - ec)) g[q].push(eb - ec); }
    rows.push(row); console.log(year, JSON.stringify(row));
  }
  const verdict = Object.fromEntries(['up', 'down'].map(q => { const a = g[q], mu = a.reduce((s, x) => s + x, 0) / a.length, se = Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / (a.length - 1) / a.length);
    return [q, {tracks: a.length, gain: +mu.toFixed(4), se: +se.toFixed(4), pass: a.length >= 5 && mu - K * se > 0}]; }));
  result[year] = {top, table: {up: +med(tracks.flatMap(x => M[x].up)).toFixed(3), down: +med(tracks.flatMap(x => M[x].down)).toFixed(3)}, verdict, rows};
  console.log(year, JSON.stringify(verdict), JSON.stringify(result[year].table));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 1));
