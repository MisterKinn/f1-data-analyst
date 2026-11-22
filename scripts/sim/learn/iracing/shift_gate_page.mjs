// Gate G (v2): GT3 / Hypercar shift points learned from the owner's iRacing laps vs the page's gear trace. Pre-registered in the Project
// (claude/gate-iracing-shifts-prereg-2026-11-22.md). Usage: node scripts/sim/learn/iracing/shift_gate_page.mjs <results dir> [--json out]
import {readFileSync, writeFileSync} from 'node:fs';
import {simulationPage, lapsimScript} from '../../../../worker/simulation.js';
const dir = process.argv[2], jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null, K = 1.45;
const TRACK = {cota: 'austin', fuji: 'fuji', indianapolis: 'indianapolis', lemans: 'le-mans', longbeach: 'long-beach', mexicocity: 'mexico-city',
  misano: 'misano', montreal: 'montreal', nurburgring: 'nurburgring-gp', roadatlanta: 'road-atlanta', silverstone: 'silverstone', spa: 'spa-francorchamps',
  spielberg: 'spielberg', suzuka: 'suzuka', twinring: 'motegi', zandvoort: 'zandvoort'};
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const L = readFileSync(dir + '/driver_events_shifts.csv', 'utf8').trim().split(/\r?\n/), H = L[0].split(','), c = k => H.indexOf(k);
const obs = L.slice(1).map(l => l.split(',')).map(x => ({cls: x[c('cls')], track: TRACK[x[c('track')]], dir: x[c('dir')], red: +x[c('redline')],
  up: x[c('dir')] === 'up' && +x[c('thr')] > 0.9 ? +x[c('rpmBefore')] / +x[c('redline')] : NaN, down: x[c('dir')] === 'down' ? +x[c('rpmAfter')] / +x[c('redline')] : NaN}))
  .filter(o => o.track && o.red > 0);
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const page = (track, car, drv) => {
  const d = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); if (d.carId !== car) return null;
  const top = d.cars[car].car.engine.rpmMax, R = {...V.R, lapChannels: (a, b, cc, e, o) => V.R.lapChannels(a, b, cc, e, {...o, drv})};
  const v = V.computeView(V.K, d, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, R);
  const G = v.tel.lanes.find(l => l.key === 'gear').ser[0].v, P = v.tel.lanes.find(l => l.key === 'rpm').ser[0].v, up = [], down = [];
  for (let i = 1; i < G.length; i++) { if (G[i] > G[i - 1]) up.push(P[i - 1] / top); if (G[i] < G[i - 1]) down.push(P[i] / top); }
  return {up: med(up), down: med(down)};
};
const result = {};
for (const [cls, car] of [['GT3', 'wec-lmgt3'], ['GTP', 'wec-lmdh']]) {
  const O = obs.filter(o => o.cls === cls), tracks = [...new Set(O.map(o => o.track))].filter(t => page(t, car, null)), g = {up: [], down: []}, rows = [];
  for (const tr of tracks) {
    const trn = O.filter(o => o.track !== tr), te = O.filter(o => o.track === tr), D = {up: med(trn.map(o => o.up)), down: med(trn.map(o => o.down))};
    const b = page(tr, car, null), cd = page(tr, car, D), row = {track: tr};
    for (const q of ['up', 'down']) { const eb = med(te.map(o => Math.abs(o[q] - b[q]))), ec = med(te.map(o => Math.abs(o[q] - cd[q]))); row[q] = [+eb.toFixed(3), +ec.toFixed(3), +b[q].toFixed(3), +cd[q].toFixed(3)]; if (Number.isFinite(eb - ec)) g[q].push(eb - ec); }
    rows.push(row); console.log(cls, JSON.stringify(row));
  }
  const verdict = Object.fromEntries(['up', 'down'].map(q => { const a = g[q], mu = a.reduce((s, x) => s + x, 0) / a.length, se = Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / (a.length - 1) / a.length);
    return [q, {tracks: a.length, gain: +mu.toFixed(4), se: +se.toFixed(4), pass: a.length >= 5 && mu - K * se > 0}]; }));
  result[cls] = {car, table: {up: +med(O.map(o => o.up)).toFixed(3), down: +med(O.map(o => o.down)).toFixed(3)}, verdict, rows};
  console.log(cls, JSON.stringify(verdict), JSON.stringify(result[cls].table));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 1));
