// Forecast verification log (step 8, docs/lapsim-forecast.md; diagnostic only, ledger type diag). Run hourly by .github/workflows/forecast-log.yml.
// Before a session: the forecast for its start (worker/lapsim/forecast.js, the value the page shows) is stored once, with model, issue time and
// lead time, and never changed. After it: the trackside sensor mean over the session is added (F1: OpenF1 weather; other series: not yet).
// The summary (RMS and bias per model, n ≥ 5 sessions per model) is written into docs/lapsim-forecast.md. It never changes a lap or the fit.
// Usage: node scripts/sim/forecast-log.mjs [--now ISO] [--file path] [--lead-h 6]
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {TRACK_LL} from '../../worker/lapsim/track-coords.js';
import {upcomingSessions, buildForecast} from '../../worker/lapsim/forecast.js';

const arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null;
const FILE = arg('--file') || 'scripts/sim/data/forecast-log.json', DOC = 'docs/lapsim-forecast.md';
const LEAD_H = +(arg('--lead-h') || 6), SESSION_H = 2, MIN_N = 5;
const r2 = x => Math.round(x * 100) / 100;

// store: sessions starting within LEAD_H hours that are not logged yet
export async function logForecasts(log, now, {fetchFn = fetch} = {}) {
  for (const id of Object.keys(TRACK_LL)) {
    const due = upcomingSessions(id, now).filter(s => s.t - now <= LEAD_H * 3600e3 && !log.entries.some(e => e.key === s.event + '|' + s.name));
    if (!due.length) continue;
    let f; try { f = await buildForecast(id, {now, fetchFn, sessions: due}); } catch (e) { console.warn(`${id}: forecast unavailable (${e.message})`); continue; }
    for (const s of f.sessions) log.entries.push({key: s.event + '|' + s.name, track: id, series: s.series, session: s.name, start: s.start, model: f.model, issued: f.issued,
      retrieved: f.retrieved, leadH: r2((Date.parse(s.start) - now) / 3600e3), step: s.step, forecast: s.w, sensor: null});
  }
  return log;
}

// F1 trackside sensor (OpenF1): the session that starts within 30 min of the logged start; mean of its weather rows
async function openf1Sensor(e, fetchFn) {
  const t = Date.parse(e.start), iso = ms => new Date(ms).toISOString().slice(0, 19);
  const get = async q => { const r = await fetchFn('https://api.openf1.org/v1/' + q, {signal: AbortSignal.timeout(15000)}); if (!r.ok) throw Error('OpenF1 ' + r.status); return r.json(); };
  const ss = await get(`sessions?date_start>=${iso(t - 1800e3)}&date_start<=${iso(t + 1800e3)}`);
  const s = ss.find(x => x.circuit_short_name) || ss[0]; if (!s) return null;
  const w = await get('weather?session_key=' + s.session_key); if (!w.length) return null;
  const m = k => r2(w.reduce((a, x) => a + x[k], 0) / w.length);
  return {source: 'OpenF1 weather, session ' + s.session_key, n: w.length, airTempC: m('air_temperature'), trackTempC: m('track_temperature'), humidityPct: m('humidity'), pressureHpa: m('pressure'), windSpeed: m('wind_speed')};
}

export async function addSensors(log, now, {fetchFn = fetch} = {}) {
  for (const e of log.entries) if (!e.sensor && Date.parse(e.start) + SESSION_H * 3600e3 < now && e.series === 'f1')
    try { e.sensor = await openf1Sensor(e, fetchFn); } catch (err) { console.warn(`${e.key}: sensor not read (${err.message})`); }
  return log;
}

// per model: n, mean bias (forecast − sensor) and RMS for air, track (estimate), humidity, wind
export function summarize(log) {
  const by = {};
  for (const e of log.entries) if (e.sensor) (by[e.model] ||= []).push(e);
  return Object.entries(by).map(([model, es]) => {
    const st = k => { const d = es.map(e => e.forecast[k] - e.sensor[k]).filter(Number.isFinite); return d.length ? {bias: r2(d.reduce((a, x) => a + x, 0) / d.length), rms: r2(Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length))} : null; };
    return {model, n: es.length, enough: es.length >= MIN_N, air: st('airTempC'), track: st('trackTempC'), humidity: st('humidityPct'), wind: st('windSpeed')};
  });
}

function writeDoc(rows) {
  if (!existsSync(DOC)) return;
  const f = s => s ? `${s.bias >= 0 ? '+' : ''}${s.bias} / ${s.rms}` : '–';
  const table = ['| Model | Sessions | Air °C bias / RMS | Track °C (estimate) bias / RMS | Humidity % bias / RMS | Wind m/s bias / RMS |', '|---|---:|---|---|---|---|',
    ...rows.map(r => r.enough ? `| ${r.model} | ${r.n} | ${f(r.air)} | ${f(r.track)} | ${f(r.humidity)} | ${f(r.wind)} |` : `| ${r.model} | ${r.n} | not enough data (n < ${MIN_N}) | | | |`)];
  const doc = readFileSync(DOC, 'utf8'), a = '<!-- forecast-log:start -->', b = '<!-- forecast-log:end -->';
  writeFileSync(DOC, doc.slice(0, doc.indexOf(a) + a.length) + '\n' + (rows.length ? table.join('\n') : 'No session verified yet.') + '\n' + doc.slice(doc.indexOf(b)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = Date.parse(arg('--now') || new Date().toISOString());
  const log = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {note: 'Forecast vs trackside sensor (diagnostic only; never used for a lap or the fit). docs/lapsim-forecast.md', entries: []};
  await logForecasts(log, now); await addSensors(log, now);
  writeFileSync(FILE, JSON.stringify(log, null, 1) + '\n'); writeDoc(summarize(log));
  console.log(`${log.entries.length} entries, ${log.entries.filter(e => e.sensor).length} verified`);
}
