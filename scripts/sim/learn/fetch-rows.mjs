// Lap rows already collected (Actions run 42927630531, built on branch lapsim-laps/all-laps-2026-11-11):
//  - laps-t71-*: Timing71, every series. Kept: GT3 cars (SRO GT World Challenge in every region, IGTC, DTM, Nürburgring, Macau, …)
//  - laps-wec:  Al Kamel FIA WEC 2021-2026, every car (fills the WEC events the CSV archive lacks: Monza 2024+, Barcelona 2026, …)
// Out: one row per car and session, as endurance-cars.csv, plus `venue` (track id of the source) and `feed` (series key of the source).
// Laps stay out of git; these are derived tables.   T71_ROWS=<dir with the downloaded artifacts> node scripts/sim/learn/fetch-rows.mjs
import {readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {COLS, csvLine} from './build-endurance.mjs';
import {modelOf} from './models.mjs';

const DIR = process.env.T71_ROWS || '.cache/t71-rows', HARD = ['no_time', 'pit_in', 'pit_out', 'not_green', 'deleted', 'wet_lap', 'wet_session', 'sector_sum', 'inaccurate', 'sim'];
const files = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.ndjson(\.gz)?$/.test(f) ? [p] : []; });
const mean = a => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
const cars = new Map(), seen = {}, samples = {}, WEC_CLS = {lmh: 'HYPERCAR', lmdh: 'HYPERCAR', hypercar: 'HYPERCAR', lmgt3: 'LMGT3', lmp2: 'LMP2', lmgte: 'LMGTE', lmgteam: 'LMGTE AM', lmgtepro: 'LMGTE PRO'};
for (const f of files(DIR)) { const text = f.endsWith('.gz') ? gunzipSync(readFileSync(f)).toString() : readFileSync(f, 'utf8');
  for (const line of text.split('\n')) { if (!line) continue; let r; try { r = JSON.parse(line); } catch { continue; }
    const k0 = r.series + '|' + (r.cls || ''); seen[k0] = (seen[k0] || 0) + 1; if (!samples[r.series] || samples[r.series].length < 3) (samples[r.series] ||= []).push({...r, q: undefined, wx: undefined});
    const wec = r.source === 'alkamel' && r.series === 'wec'; if (wec) r.cls = WEC_CLS[String(r.cls || '').toLowerCase()] || String(r.cls || '').toUpperCase();
    if (!wec) { const m = modelOf(r.carModel, r.season, 'GT3'); if (!m || !/GT3|GTD/.test(m.base)) continue; } // Timing71: GT3 models only (GT4, Cup and others are not matched)
    const k = [r.series, r.season, r.session, r.entry].join('|'), c = cars.get(k) || cars.set(k, {r, laps: 0, clean: [], best: null, trap: 0, w: {a: [], t: [], h: [], p: []}, rain: 0}).get(k);
    c.laps++; if (r.rain === 1) c.rain++;
    for (const [x, y] of [['a', r.airC], ['t', r.trackC], ['h', r.humidityPct], ['p', r.pressureHpa]]) if (Number.isFinite(y) && y !== 0 && y !== 255) c.w[x].push(y);
    if ((r.q || []).some(q => HARD.includes(q)) || !(r.time > 20)) continue;
    c.clean.push(r.time); if (r.trapKph > 150 && r.trapKph < 400 && r.trapKph > c.trap) c.trap = r.trapKph; if (!c.best || r.time < c.best.time) c.best = r; } }
const out = [], outW = []; for (const c of cars.values()) { if (!c.best) continue; const r = c.r, b = c.best, sx = [b.s1, b.s2, b.s3];
  (r.source === 'alkamel' ? outW : out).push([r.series, r.season, String(r.event || '').replace(/,/g, ' '), String(r.session || '').replace(/,/g, ' '), r.sessionType, r.cls || '', r.entry, r.carModel, '', r.team || '', '',
    b.time.toFixed(3), ...sx.map(v => Number.isFinite(v) ? v.toFixed(3) : ''), sx.every(Number.isFinite) ? (sx[0] + sx[1] + sx[2]).toFixed(3) : '', c.trap || '', '', c.laps, c.clean.length, '',
    ...[mean(c.w.a), mean(c.w.t), mean(c.w.h), mean(c.w.p)].map(v => v == null ? '' : v.toFixed(1)), (c.rain / c.laps).toFixed(3), r.track || '', r.series]); }
writeFileSync('scripts/sim/data/learn/wec-alkamel-cars.csv.gz', gzipSync([[...COLS, 'venue', 'feed'].join(','), ...outW.map(csvLine)].join('\n') + '\n', {level: 9}));
writeFileSync('scripts/sim/data/learn/t71-gt3-cars.csv.gz', gzipSync([[...COLS, 'venue', 'feed'].join(','), ...out.map(csvLine)].join('\n') + '\n', {level: 9}));
writeFileSync('scripts/sim/data/learn/t71-gt3-info.json', JSON.stringify({source: 'Timing71 archive rows (Actions run 42927630531)', rows: out.length, classes: Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 400), samples}, null, 1));
console.log(out.length, 'Timing71 GT3 and', outW.length, 'WEC car-session rows from', files(DIR).length, 'files');
