// Track geometry of the endurance tracks checked against measured sector times (task A4 part 2, docs/lapsim-geometry-fit.md section 2;
// declared before running).  node scripts/sim/sector-geometry.mjs <track-atlas dir>  -> probe-out/sector-geometry.json
// Measured data (Al Kamel best laps and their sector times) is never changed. Per layout and sector, the measured share of the lap
// (sector / lap) is compared with the simulated share on our geometry, car by car. A sector share error that the prototypes (LMH, LMDh)
// and the GT3s show alike is the track; one that only a class shows is that class's car model. Sector lines: track-atlas timing sectors
// (MIT; lines measured on aerial imagery for the IMSA and Le Mans circuits), as lap fractions from the start/finish line.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks, lapsimExtraTracks} from '../../worker/lapsim/tracks-data.js';
import {lapsimCalibration} from '../../worker/lapsim/calibration-data.js';
import {modelOf} from './learn/models.mjs';
import {layoutOf} from './learn/fit-endurance.mjs';

const K = lapsimKernel(), ALL = {...lapsimTracks, ...lapsimExtraTracks};
const ATLAS = {daytona: 'daytona', sebring: 'sebring', 'watkins-glen': 'watkins-glen', 'road-america': 'road-america', 'road-atlanta': 'road-atlanta', vir: 'virginia-international-raceway',
  'laguna-seca': 'laguna-seca', 'long-beach': 'long-beach', 'lime-rock': 'lime-rock', mosport: 'mosport', indianapolis: 'indianapolis', 'le-mans': 'circuit-de-la-sarthe', austin: 'circuit-of-the-americas',
  fuji: 'fuji', imola: 'imola', 'spa-francorchamps': 'spa-francorchamps', interlagos: 'interlagos', lusail: 'losail', sakhir: 'bahrain', portimao: 'portimao', monza: 'monza', mugello: 'mugello'};
const LINES = JSON.parse(readFileSync('scripts/sim/data/tracks/imsa-sector-lines.json', 'utf8')).tracks;
// official IMSA sector lines of that season (nearest season when that one is not published), as lap fractions from the finish line
const sectorsOf = (id, season) => { const T = LINES[id]; if (!T) return null; const ss = Object.keys(T).map(Number), s = ss.includes(season) ? season : ss.sort((a, b) => Math.abs(a - season) - Math.abs(b - season))[0];
  const m = T[s].sectorsM, L = m[0] + m[1] + m[2]; return {cuts: [m[0] / L, (m[0] + m[1]) / L], measured: true, layout: 'imsa ' + s}; };
const groupOfCls = c => /^(HYPERCAR|LMH)$/i.test(c) ? 'proto' : /GTP|DPI/i.test(c) ? 'proto' : /LMP2/i.test(c) ? 'lmp2' : /GT3|GTD|LMGT3|GTE|GT$/i.test(c) ? 'gt3' : null;
const CARGROUP = {proto: 'lmdh', lmp2: 'lmp2', gt3: 'gt3'};
const split = l => { const o = []; let f = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { o.push(f); f = ''; } else f += c; } o.push(f); return o; };
const rows = [], LAY = new Map(); // layout per venue, length, season and class (layoutOf is slow)
for (const file of ['endurance-cars.csv.gz', 'wec-alkamel-cars.csv.gz']) {
  const [head, ...lines] = gunzipSync(readFileSync('scripts/sim/data/learn/' + file)).toString().trim().split('\n'), cols = head.split(',');
  let ln = 0; for (const l of lines) { if (++ln % 5000 === 0) console.error(file, ln, rows.length, LAY.size); const a = split(l), r = Object.fromEntries(cols.map((c, i) => [c, a[i]])), cls = groupOfCls(r.cls);
    if (!cls || r.type !== 'Q' || +r.rainShare > 0.02) continue;
    const best = +r.best, s = [+r.s1, +r.s2, +r.s3]; if (!(best > 20) || s.some(x => !(x > 1)) || Math.abs(s[0] + s[1] + s[2] - best) > 0.06) continue; // sectors of the best lap itself
    const lk = [r.venue || r.event, r.lenKm, r.season, cls, r.lenKm ? '' : Math.round(best / 5)].join('|');
    if (!LAY.has(lk)) LAY.set(lk, layoutOf({name: r.venue || r.event, lengthKm: r.lenKm ? +r.lenKm : null, season: +r.season, lap: best, group: CARGROUP[cls], feed: r.feed, event: r.event}));
    const tr = LAY.get(lk);
    if (!tr.sim || !LINES[tr.sim] || r.series !== 'imsa' || tr.sim === 'austin') continue;
    rows.push({series: r.series, season: +r.season, event: r.event, cls, entry: r.entry, model: modelOf(r.vehicle, +r.season, r.cls)?.key, sim: tr.sim, best, share: s.map(x => x / best), trap: +r.trapKph || null, w: {airC: +r.airC || 25, trackC: +r.trackC || 35, hpa: +r.hpa || 1013, hum: +r.hum || 50}}); } }
// simulated sector shares per layout and class car (standard weather of the row; shares hardly move with grip)
const simCache = new Map();
function simShares(id, cls, season, w) {
  const key = [id, cls, season].join('|'); if (simCache.has(key)) return simCache.get(key);
  const sec = sectorsOf(id, season); if (!sec) return null;
  const t = K.trackFromData(ALL[id]), WEC = lapsimCalibration.series.wec, c = {proto: 'lmdh', lmp2: 'lmdh', gt3: 'lmgt3'}[cls], cs = String(Math.min(2026, Math.max(2025, season)));
  const res = K.simulateLap(t, (WEC[c][cs] || WEC[c][Object.keys(WEC[c]).sort().at(-1)]).car, K.conditionsFromWeather({}));
  const n = res.v.length, ds = t.ds, tAt = []; let acc = 0; for (let i = 0; i < n; i++) { tAt.push(acc); acc += ds / Math.max(res.v[i], 1); }
  const tr = LINES[id]?.[String(season)]?.trap, at = f => tAt[Math.min(n - 1, Math.round(f * n))], cuts = sec.cuts, out = {trapSimKph: tr ? Math.max(...[-1, 0, 1].map(k => res.v[Math.min(n - 1, Math.round(tr.lapFraction * n) + k)])) * 3.6 : null,shares: [at(cuts[0]) / acc, (at(cuts[1]) - at(cuts[0])) / acc, (acc - at(cuts[1])) / acc], measuredLines: sec.measured};
  simCache.set(key, out); return out; }
console.error("rows", rows.length, "layouts", LAY.size); const per = {}; let nn = 0; for (const r of rows) { if (++nn % 500 === 0) console.error("sim", nn, simCache.size); const s = simShares(r.sim, r.cls, r.season, r.w); if (!s) continue; r.err = r.share.map((x, i) => (x - s.shares[i]) * 100); r.trapErr = r.trap && s.trapSimKph ? r.trap - s.trapSimKph : null; (per[r.sim] ||= []).push(r); }
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null, r2 = x => x == null ? null : +x.toFixed(2);
const table = {};
for (const [id, R] of Object.entries(per)) { const by = c => R.filter(r => r.cls === c), m = (L, i) => r2(mean(L.map(r => r.err[i])));
  table[id] = {rows: R.length, measuredLines: simCache.get([...simCache.keys()].find(k => k.startsWith(id + '|')))?.measuredLines ?? null,
    proto: {n: by('proto').length, err: [0, 1, 2].map(i => m(by('proto'), i))}, gt3: {n: by('gt3').length, err: [0, 1, 2].map(i => m(by('gt3'), i))}, lmp2: {n: by('lmp2').length, err: [0, 1, 2].map(i => m(by('lmp2'), i))},
    seasons: [...new Set(R.map(r => r.season))].sort(), trap: Object.fromEntries(['proto', 'gt3', 'lmp2'].map(c => { const L = R.filter(r => r.cls === c && r.trapErr != null); return [c, L.length ? {n: L.length, errKph: r2(mean(L.map(r => r.trapErr)))} : null]; })), bySeason: Object.fromEntries([...new Set(R.map(r => r.season))].sort().map(y => { const L = R.filter(r => r.season === y); return [y, {n: L.length, err: [0, 1, 2].map(i => m(L, i))}]; }))}; }
mkdirSync('probe-out', {recursive: true}); writeFileSync('probe-out/sector-geometry.json', JSON.stringify({note: 'sector share error = measured − simulated, percentage points of the lap, mean per class', table}, null, 1));
for (const [id, t] of Object.entries(table)) console.log(id.padEnd(18), String(t.rows).padStart(5), 'proto', JSON.stringify(t.proto.err), t.proto.n, '| gt3', JSON.stringify(t.gt3.err), t.gt3.n, '| lmp2', JSON.stringify(t.lmp2.err), t.lmp2.n, t.measuredLines ? 'lines measured' : '');
