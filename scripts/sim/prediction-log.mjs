// Prediction log (AGENTS.md Gate G v3.1 "Prediction log", v3.2 "the main source of new truth"; owner 2026-11-22).
// Before an event starts, the production prediction of its qualifying (lapsim_simulate: lap, ±1σ, sectors, top speed) is stored for every
// car the site predicts in that series, with the model version and the calibration hash. After the event the real result is added next
// to it. A stored prediction is never changed: an entry is written once, and later runs only fill its `result`.
// Usage: node scripts/sim/prediction-log.mjs [--days 14] [--now 2026-11-22T00:00:00Z]   (run from the refresh workflows)
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {calendarEvents} from '../../worker/race-calendar-data.js';
import {simulate} from '../../worker/lapsim/tool.js';
import {lapsimAllTracks} from '../../worker/lapsim/tracks.js';
import {lapsimF1Poles} from '../../worker/lapsim/f1-poles-data.js';
import {lapsimF1WetQuali} from '../../worker/lapsim/f1-wet-quali-data.js';
import {lapsimWecPoles} from '../../worker/lapsim/wec-poles-data.js';
import {lapsimSeriesPoles} from '../../worker/lapsim/series-poles-data.js';
import {lapsimFe} from '../../worker/lapsim/fe-data.js';
import {lapsimCalibration} from '../../worker/lapsim/calibration-data.js';
import {tiTrack} from './ti-races.mjs';

const arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null;
const FILE = arg('--file') || 'scripts/sim/data/prediction-log.json';
const NOW = new Date(arg('--now') || Date.now()), DAYS = +(arg('--days') || 14), today = NOW.toISOString().slice(0, 10);
// calendar series → cars the site predicts for that series (page and tool keys)
const CARS = {f1: y => [String(Math.min(2028, Math.max(2026, y)))], wec: () => ['wec-lmh', 'wec-lmdh', 'wec-lmgt3'], imsa: () => ['imsa-gtp', 'imsa-gtdpro', 'imsa-gtd'],
  elms: () => ['elms-lmgt3'], alms: () => ['alms-gt3'], 'gtwc-europe': () => ['gtwc-gt3'], 'gtwc-america': () => ['gtwc-gt3'], 'gtwc-asia': () => ['gtwc-gt3'],
  'gtwc-australia': () => ['gtwc-gt3'], igtc: () => ['igtc-gt3'], nls: () => ['nur-gt3'], macau: () => ['macau-gt3'], 'formula-e': y => [y >= 2027 ? 'fe-gen4' : 'fe-gen3evo']};
// calendar circuit ids that differ from the simulator's track ids (same layout only)
const CIRCUIT = {'yas-marina': 'yas-marina-circuit', spa: 'spa-francorchamps', cota: 'austin', bahrain: 'sakhir', barcelona: 'catalunya', guia: 'macau',
  'mexico-fe': 'fe-mexico', 'miami-fe': 'fe-miami', berlin: 'fe-berlin', tokyo: 'fe-tokyo', sanya: 'fe-sanya', 'jeddah-fe': 'fe-jeddah', 'sao-paulo-fe': 'fe-sao-paulo',
  'shanghai-fe': 'fe-shanghai', 'brands-hatch-fe': 'fe-london'};
const trackOf = e => { const t = e.series === 'f1' ? tiTrack(e.nameEn, +e.start.slice(0, 4)) : CIRCUIT[e.circuit] || e.circuit; return lapsimAllTracks[t] ? t : null; };
const sha = () => { try { return process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(); } catch { return null; } };
const calHash = createHash('sha1').update(readFileSync('worker/lapsim/calibration-data.js')).digest('hex').slice(0, 12);
const log = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {about: 'Kongboda prediction log: production qualifying predictions stored before each event, real results added after. Stored predictions are never changed (AGENTS.md Gate G v3.1).', entries: []};
const have = new Set(log.entries.map(e => e.key));
// 1. predictions for events that start within DAYS and have not started (event start date, UTC day, is after today)
let added = 0, skipped = [];
for (const e of calendarEvents) {
  if (!CARS[e.series] || !(e.start > today) || (Date.parse(e.start) - NOW) / 864e5 > DAYS) continue;
  const track = trackOf(e), year = +e.start.slice(0, 4);
  if (!track) { skipped.push(`${e.series} ${e.nameEn}: no simulator track for ${e.circuit}`); continue; }
  for (const car of CARS[e.series](year)) {
    const key = `${e.id}|${car}`; if (have.has(key)) continue;
    const r = simulate({track, car}); if (r.status !== 'ok') { skipped.push(`${key}: ${r.status}`); continue; }
    log.entries.push({key, event: {id: e.id, name: e.nameEn, series: e.series, start: e.start, end: e.end, track}, car, predictedAt: NOW.toISOString(),
      model: {sha: sha(), calibrationHash: calHash, calibrationGeneratedAt: lapsimCalibration?.generatedAt ?? null, carKind: r.car?.kind ?? null},
      prediction: {lap: r.result.lap_seconds, sigma: r.uncertainty?.error_range_s ?? null, sigmaPct: r.uncertainty?.error_range_pct ?? null, sectors: r.result.sectors_s ?? null, topSpeedKph: r.result.top_speed_kph ?? null},
      result: null});
    have.add(key); added++;
  }
}
// 2. results for finished events: the real best qualifying lap of that class and year, from the refreshed real-lap tables (read only)
const realOf = x => { const y = x.event.start.slice(0, 4), t = x.event.track, c = x.car;
  if (/^\d{4}$/.test(c)) { const p = lapsimF1Poles?.[t]?.[y], w = lapsimF1WetQuali?.[t]?.[y]; return p ? {lap: p.lap, sectors: p.sectors, driver: p.driver, source: 'TracingInsights pole (f1-poles-data.js)'} : w ? {lap: w.lap, driver: w.driver, wet: true, source: 'OpenF1 wet qualifying (f1-wet-quali-data.js)'} : null; }
  if (c.startsWith('wec-')) { const p = lapsimWecPoles?.[t]?.[y]?.[c.slice(4)]; return p ? {lap: p.lap ?? p.sectors?.reduce((s, v) => s + v, 0), sectors: p.sectors ?? null, source: 'Al Kamel class best (wec-poles-data.js)'} : null; }
  if (c.startsWith('fe-')) { const r = lapsimFe?.tracks?.[t]?.real?.[c]; return r && String(r.year) === y && r.type === 'Q' ? {lap: r.lap, source: 'FE qualifying (fe-data.js)'} : null; }
  const [ser, cls] = {'imsa-gtp': ['imsa', 'gtp'], 'imsa-gtdpro': ['imsa', 'gtdpro'], 'imsa-gtd': ['imsa', 'gtd'], 'elms-lmgt3': ['elms', 'lmgt3'], 'alms-gt3': ['alms', 'gt3'], 'gtwc-gt3': ['gtwc', 'gt3'], 'igtc-gt3': ['igtc', 'gt3'], 'nur-gt3': ['nur', 'gt3'], 'macau-gt3': ['macau', 'gt3']}[c] || [];
  const p = ser && lapsimSeriesPoles?.[ser]?.[t]?.[y]?.[cls]; return p ? {lap: p.lap, source: `series best (series-poles-data.js, ${p.session || ser})`} : null; };
let resolved = 0;
for (const x of log.entries) if (!x.result && x.event.end < today) { const r = realOf(x); if (r && Number.isFinite(r.lap)) { x.result = {...r, addedAt: NOW.toISOString(), errS: +(x.prediction.lap - r.lap).toFixed(3), errPct: +((x.prediction.lap - r.lap) / r.lap * 100).toFixed(3)}; resolved++; } }
writeFileSync(FILE, JSON.stringify(log, null, 1) + '\n');
// page summary (AGENTS.md v3.1: the logged error is what the page shows as accuracy for upcoming events): per car, the errors of the
// predictions stored before the session whose real result is in; cars with predictions still waiting are listed too
function summarize(entries) {
  const cars = {};
  for (const x of entries) { const c = (cars[x.car] ||= {n: 0, waiting: 0, sq: 0, sum: 0}); if (x.result && Number.isFinite(x.result.errPct)) { c.n++; c.sq += x.result.errPct ** 2; c.sum += x.result.errPct; } else c.waiting++; }
  return Object.fromEntries(Object.entries(cars).map(([k, c]) => [k, {n: c.n, waiting: c.waiting, rmsPct: c.n ? +Math.sqrt(c.sq / c.n).toFixed(3) : null, meanPct: c.n ? +(c.sum / c.n).toFixed(3) : null}]));
}
if (!arg('--file')) writeFileSync('worker/lapsim/prediction-log-data.js', '// Generated by scripts/sim/prediction-log.mjs from scripts/sim/data/prediction-log.json. Do not edit by hand.\n'
  + `export const lapsimPredictionLog = ${JSON.stringify({updated: NOW.toISOString().slice(0, 10), cars: summarize(log.entries)})};\n`);
console.log(`prediction log: ${log.entries.length} entries, ${added} new predictions, ${resolved} new results, ${log.entries.filter(x => !x.result).length} waiting`);
for (const s of skipped) console.log('not logged:', s);
