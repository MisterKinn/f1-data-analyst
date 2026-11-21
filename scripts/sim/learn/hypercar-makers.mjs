// Hypercar per maker (owner 2026-11-21: "engine layouts all differ, one regulation car hides them; show the car the BoP makes fastest,
// let the others be chosen; link LapSim, BoPSim and SetupSim"). Gate G v2 experiment, pre-registered in claude/status-2026-11-21-C.md:
// rows = best dry qualifying/Hyperpole lap per maker and WEC event 2024–2025 (endurance-cars.csv.gz), as the gap to that event's
// Hypercar mean (%). Baseline: 0 (one car per regulation, makers not told apart). A: the kernel with the maker's published BoP
// (weight, power; wec-bop-data.js) on its regulation car (LMH front motor / LMDh rear). B: A plus the maker's mean residual on the
// other tracks (leave one track out). Accuracy claim, m = 2 (k = 1.45), one vote per event, groups all / lmh / lmdh.
// node scripts/sim/learn/hypercar-makers.mjs [--write]  (--write: worker/lapsim/hypercar-maker-data.js, the residuals and the BoP ranking)
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lapsimAllTracks as lapsimTracks} from '../../../worker/lapsim/tracks.js';
import {carsFor} from '../../../worker/lapsim/scenario.js';
import {lapsimWecBop} from '../../../worker/lapsim/wec-bop-data.js';
import {gate, kForVariants} from '../gate.mjs';
import {withGrip} from '../calibrate-lib.mjs';

const EV = {losail: 'lusail', imola: 'imola', 'spa-francorchamps': 'spa-francorchamps', 'sao-paulo': 'interlagos', 'circuit-of-the-americas': 'austin',
  'fuji-speedway': 'fuji', 'bahrain-international-circuit': 'sakhir', 'le-mans': 'le-mans'};
const LMH = ['Toyota', 'Ferrari', 'Peugeot', 'Aston Martin', 'Isotta Fraschini', 'Glickenhaus', 'Vanwall'];
const csv = gunzipSync(readFileSync('scripts/sim/data/learn/endurance-cars.csv.gz')).toString().trim().split('\n'), H = csv[0].split(',');
const rowsRaw = csv.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [H[i], v])))
  .filter(r => r.series === 'wec' && r.cls === 'HYPERCAR' && r.type === 'Q' && +r.rainShare < 0.05 && +r.best > 0 && EV[r.event] && ['2024', '2025'].includes(r.season));
const best = new Map();
for (const r of rowsRaw) { const k = `${r.season}|${r.event}|${r.manufacturer}`; if (!best.has(k) || +r.best < best.get(k).lap) best.set(k, {season: r.season, track: EV[r.event], maker: r.manufacturer, lap: +r.best, w: r}); }
const K = lapsimKernel(), simCache = new Map();
const simLap = (track, maker, season) => {
  const key = `${track}|${maker}|${season}`; if (simCache.has(key)) return simCache.get(key);
  const B = lapsimWecBop?.[track]?.[season]?.cars || {}, name = Object.keys(B).find(n => n.toLowerCase().startsWith(maker.toLowerCase().split(' ')[0])); if (!name) return null;
  const all = Object.values(B), kg0 = all.reduce((a, x) => a + x.kg, 0) / all.length, kW0 = all.reduce((a, x) => a + x.kW, 0) / all.length;
  const cls = LMH.includes(maker) ? 'wec-lmh' : 'wec-lmdh', c = carsFor(track)[cls]; if (!c || !lapsimTracks[track]) return null;
  const car = {...c.car, mass: c.car.mass * B[name].kg / kg0, pIce: c.car.pIce * B[name].kW / kW0};
  const r = K.simulateLap(withGrip(K.trackFromData(lapsimTracks[track]), c.grip || 1), car, K.conditionsFromWeather({})).lapTime;
  simCache.set(key, r); return r;
};
const events = {};
for (const b of best.values()) { const s = simLap(b.track, b.maker, b.season); if (s == null) continue; (events[`${b.season}|${b.track}`] ||= []).push({...b, sim: s, cls: LMH.includes(b.maker) ? 'lmh' : 'lmdh'}); }
const rows = [];
for (const [ev, list] of Object.entries(events)) { if (list.length < 4) continue;
  const mReal = list.reduce((a, x) => a + x.lap, 0) / list.length, mSim = list.reduce((a, x) => a + x.sim, 0) / list.length;
  for (const x of list) rows.push({ev, track: x.track, maker: x.maker, cls: x.cls, real: (x.lap / mReal - 1) * 100, a: (x.sim / mSim - 1) * 100}); }
for (const r of rows) { const o = rows.filter(q => q.maker === r.maker && q.track !== r.track); r.b = r.a + (o.length ? o.reduce((s, q) => s + q.real - q.a, 0) / o.length : 0); }
// one vote per event: the RMS of each event's rows
const vote = (rs, f) => { const by = {}; for (const r of rs) (by[r.ev] ||= []).push(f(r) - r.real); return Object.values(by).map(e => Math.sqrt(e.reduce((s, x) => s + x * x, 0) / e.length)); };
const k = kForVariants(2), out = {rows: rows.length, events: Object.keys(events).length};
for (const [g, rs] of [['all', rows], ['lmh', rows.filter(r => r.cls === 'lmh')], ['lmdh', rows.filter(r => r.cls === 'lmdh')]]) {
  const base = vote(rs, () => 0);
  for (const [name, f] of [['A BoP physics', r => r.a], ['B BoP + maker residual', r => r.b]]) { const res = gate(base, vote(rs, f), {k});
    out[`${g} ${name}`] = {n: res.n, baseRms: +res.rmsCur.toFixed(3), candRms: +res.rmsNew.toFixed(3), reason: res.reason}; } }
// fastest-car pick: does the predicted fastest maker match the real fastest at each event?
let hit = {a: 0, b: 0}, n = 0;
for (const ev of new Set(rows.map(r => r.ev))) { const rs = rows.filter(r => r.ev === ev), real = rs.reduce((m, r) => r.real < m.real ? r : m);
  n++; for (const f of ['a', 'b']) if (rs.reduce((m, r) => r[f] < m[f] ? r : m).maker === real.maker) hit[f]++; }
out.fastestPick = {events: n, A: hit.a, B: hit.b, chanceAbout: +(n / (rows.length / n)).toFixed(1)};
console.log(JSON.stringify(out, null, 1));

if (process.argv.includes('--write') || process.argv.includes('--check')) {
  // maker residual on all events (the held-out test above is what the page reports as its error)
  const residual = {};
  for (const m of new Set(rows.map(r => r.maker))) { const rs = rows.filter(r => r.maker === m); residual[m] = {pct: +(rs.reduce((s, r) => s + r.real - r.a, 0) / rs.length).toFixed(3), events: rs.length}; }
  const g = out['all B BoP + maker residual'];
  const data = {generated: new Date().toISOString().slice(0, 10), label: 'model (Al Kamel + BoP) / 모델(공식 기록 + BoP)',
    method: 'Hypercar per maker: regulation car (LMH front motor / LMDh rear) with the event BoP weight and power, times the maker residual learned from WEC dry qualifying 2024–2025 (scripts/sim/learn/hypercar-makers.mjs).',
    test: {rows: out.rows, events: out.events, baseRms: g.baseRms, rmsPct: g.candRms, lmh: out['lmh B BoP + maker residual'].candRms, lmdh: out['lmdh B BoP + maker residual'].candRms, fastestPick: `${out.fastestPick.B}/${out.fastestPick.events}`, reason: g.reason},
    residual, lmh: LMH};
  const file = 'worker/lapsim/hypercar-maker-data.js', text = '// Generated by scripts/sim/learn/hypercar-makers.mjs --write. Do not edit by hand.\nexport const lapsimHypercarMakers = ' + JSON.stringify(data) + ';\n';
  // --check (tests, refresh jobs): the stored residuals must be what the current laps, BoP tables and class cars give
  if (process.argv.includes('--check')) { const strip = t => t.replace(/"generated":"[^"]*"/, ''); if (strip(readFileSync(file, 'utf8')) !== strip(text)) { console.error('stale: rerun scripts/sim/learn/hypercar-makers.mjs --write'); process.exit(1); } }
  else { writeFileSync(file, text); console.log('wrote', file, Object.keys(residual).length, 'makers'); }
}
