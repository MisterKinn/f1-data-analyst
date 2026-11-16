// SetupSim during an event weekend (owner 2026-11-16): after every FP1/FP2/FP3/qualifying/race the set-up estimate uses that
// latest session's real weather. F1: OpenF1 sessions + weather of the circuit (circuit_key). WEC: the Al Kamel weather file of the
// latest published session of the event at this track. Outside an event weekend (or if a source does not answer in 4 s) this
// returns null and the plan keeps its history-based weather. OpenF1 locks free users during a live F1 session (401): the update then
// arrives once the session data opens. IMSA/ELMS/GT3 series: no live source in the worker yet.
import {openf1Get} from './openf1.js';
import {archive, readDocument} from './wec.js';
import {SERIES, WEC_SEASONS} from './lapsim/series.js';
import {lapsimAllTracks} from './lapsim/tracks.js';

const WINDOW_MS = 4 * 86400e3, num = x => { const v = Number(String(x ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const mean = (rows, f) => { const v = rows.map(f).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const clean = w => Object.fromEntries(Object.entries(w).filter(([, v]) => v != null));
const within = (ms, p) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

export async function f1Live(trackId, now = Date.now(), io = {}) {
  const ck = lapsimAllTracks[trackId]?.circuitKey; if (!ck) return null;
  const year = new Date(now).getUTCFullYear(), list = await openf1Get('sessions', {year}, io);
  const s = (list || []).filter(x => x.circuit_key === ck && Date.parse(x.date_start) <= now && now - Date.parse(x.date_start) < WINDOW_MS)
    .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start))[0]; if (!s) return null;
  const rows = (await openf1Get('weather', {session_key: s.session_key}, io) || []).slice(-30); if (!rows.length) return null;
  return {series: 'f1', year, session: s.session_name, at: s.date_start, weather: clean({airTempC: mean(rows, r => r.air_temperature), trackTempC: mean(rows, r => r.track_temperature),
    humidityPct: mean(rows, r => r.humidity), pressureHpa: mean(rows, r => r.pressure), windSpeed: mean(rows, r => r.wind_speed), rain: rows.some(r => r.rainfall > 0)})};
}

export async function wecLive(trackId, env, now = Date.now()) {
  const year = new Date(now).getUTCFullYear(), season = WEC_SEASONS[year]; if (!season) return null;
  const a = await archive(season, env), events = a.events.filter(e => SERIES.wec.events[e] === trackId); if (!events.length) return null;
  const w = a.files.filter(f => events.includes(f.folders[0]) && f.format === 'csv' && /^Weather_/i.test(f.title) && f.published_at && now - Date.parse(f.published_at) < WINDOW_MS)
    .sort((x, y) => Date.parse(y.published_at) - Date.parse(x.published_at))[0]; if (!w) return null;
  const rows = (await readDocument({url: w.url, limit: 100000}, env)).records || []; if (!rows.length) return null;
  return {series: 'wec', year, session: w.folders.at(-1) || w.title, at: w.published_at, weather: clean({airTempC: mean(rows, r => num(r.AIR_TEMP)), trackTempC: mean(rows, r => num(r.TRACK_TEMP)),
    humidityPct: mean(rows, r => num(r.HUMIDITY)), pressureHpa: mean(rows, r => num(r.PRESSURE)), windSpeed: mean(rows, r => (num(r.WIND_SPEED) ?? 0) / 3.6), rain: rows.some(r => num(r.RAIN) > 0)})};
}

export async function setupLive(query = {}, env, now = Date.now()) {
  const kind = ['hypercar', 'gt3', 'lmp2'].includes(query.series) ? query.series : query.series === 'f1-2025' ? null : 'f1';
  const track = query.track || 'monza'; if (!kind || !lapsimAllTracks[track]) return null;
  try { return await within(4000, kind === 'f1' ? f1Live(track, now) : wecLive(track, env, now)); } catch { return null; }
}
