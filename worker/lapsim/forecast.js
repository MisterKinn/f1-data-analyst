// Race-week weather forecast for /simulation (step 8, docs/lapsim-forecast.md). Open-Meteo forecast (models=best_match) at the track
// centre, read on the server and cached per track and hour; the browser never calls Open-Meteo. Only sessions of the race calendar that
// start within the next 7 days get a forecast: a past, cancelled or postponed session never does (docs/lapsim-climate.md).
// The default lap is unchanged; the page runs the lap on these values only when the user asks ("Run on forecast").
import {TRACK_LL} from './track-coords.js';
import {lapsimTrackTemp} from './tracktemp-data.js';
import {calendarEvents} from '../race-calendar-data.js';
import {sessionSchedule} from '../session-schedule.js';
import {cachedPublished} from '../published-cache.js';

export const DAYS = 7, TTL = 3600e3, API = 'https://api.open-meteo.com';
export const CREDIT = 'Weather data by Open-Meteo.com (CC BY 4.0)';
// calendar circuit ids that differ from the simulator track ids (= simulator-controls.js, prediction-log.mjs)
const CIRCUIT = {'albert-park': 'melbourne', spa: 'spa-francorchamps', cota: 'austin', mexico: 'mexico-city', barcelona: 'catalunya', 'red-bull-ring': 'spielberg',
  madrid: 'madring', sepang: 'kuala-lumpur', monaco: 'monte-carlo', bahrain: 'sakhir', 'yas-marina': 'yas-marina-circuit'};
const HOURLY = ['temperature_2m', 'relative_humidity_2m', 'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'shortwave_radiation', 'precipitation_probability'];
const Q15 = ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'wind_direction_10m', 'shortwave_radiation'];

// sessions at this track starting in [now, now + 7 days]; an event or session marked cancelled or postponed is skipped
export function upcomingSessions(id, now = Date.now(), {events = calendarEvents, schedule = sessionSchedule} = {}) {
  const off = x => /cancel|postpon/i.test(x?.status || '') || x?.cancelled === true, out = [];
  for (const e of events) if ((CIRCUIT[e.circuit] || e.circuit) === id && !off(e))
    for (const s of schedule[e.id] || []) { const t = Date.parse(s.start); if (!off(s) && t >= now && t <= now + DAYS * 864e5) out.push({event: e.id, series: e.series, name: s.nameEn, start: s.start, t}); }
  return out.sort((a, b) => a.t - b.t);
}

// The model best_match uses here, following Open-Meteo's own routing (open-meteo ForecastapiController.swift, best_match, commit of
// 2026-11-22). meta = the domain whose meta.json gives the run time; q15 = native 15-minute data (ICON-D2, AROME, NOAA). HRRR CONUS is
// marked discontinued from 2026-11-30: best_match then falls back by itself, nothing here depends on it.
export function bestMatchModel(lat, lon) {
  const inR = (a, b, c, d) => lat >= a && lat < b && lon >= c && lon < d;
  if (inR(49.35, 53.79, 2.19, 7.66)) return {name: 'KNMI HARMONIE-AROME (with ICON-D2)', meta: 'knmi_harmonie_arome_netherlands', q15: false};
  if (lat >= 54.9 && inR(54.9, 72, 0, 32)) return {name: 'MET Nordic', meta: 'metno_nordic_pp', q15: false};
  const channel = lat >= 49.9 && lon >= -0.2 && (lon + 0.2) * 0.6 - (lat - 49.9) >= 0; // the Channel cut-out triangle (49.9/−0.2, 49.9/1.8, 51.1/1.8)
  if (inR(49.9, 61, -11, 1.8) && !channel) return {name: 'UKMO UK 2 km', meta: 'ukmo_uk_deterministic_2km', q15: false};
  if (inR(43.18, 58.08, -3.94, 20.34)) return {name: 'DWD ICON-D2', meta: 'dwd_icon_d2', q15: true};
  if (inR(42.10, 51.32, -6.18, 8.35)) return {name: 'Météo-France AROME France HD', meta: 'meteofrance_arome_france_hd', q15: true};
  if (inR(44, 66, -30, 45)) return {name: 'DMI HARMONIE-AROME Europe', meta: 'dmi_harmonie_arome_europe', q15: false};
  if (inR(21.14, 52.62, -134.1, -60.9)) return {name: 'NOAA HRRR CONUS (RRFS from 2026-11-30)', meta: 'ncep_hrrr_conus', q15: true};
  if (inR(27.4, 42.65, 125, 145)) return {name: 'JMA MSM', meta: 'jma_msm', q15: false};
  return {name: 'global models (ECMWF IFS, GFS, ICON)', meta: 'ecmwf_ifs025', q15: false};
}

// track temperature: the fitted rule of tracktemp-data.js (air + a + k × shortwave), an estimate (held-out ±rmsC)
export const trackTempEst = (air, sw) => Math.round((air + lapsimTrackTemp.a + lapsimTrackTemp.k * (sw || 0)) * 10) / 10;

const r1 = x => Math.round(x * 10) / 10;
// value at time t (unix s): native 15-minute value on that quarter when the model has one, else linear between the hours
function at(j, k, t, q15) {
  const M = q15 && j.minutely_15, H = j.hourly;
  if (M && M[k]) { const i = M.time.indexOf(Math.floor(t / 900) * 900); if (i >= 0 && Number.isFinite(M[k][i])) return {v: M[k][i], step: '15 min'}; }
  const i = H.time.findIndex(x => x > t) - 1; if (i < 0) return null;
  const a = H[k]?.[i], b = H[k]?.[i + 1]; if (!Number.isFinite(a)) return null;
  if (k === 'wind_direction_10m' || k === 'precipitation_probability' || !Number.isFinite(b)) return {v: a, step: 'hourly'};
  return {v: a + (b - a) * (t - H.time[i]) / (H.time[i + 1] - H.time[i]), step: 'hourly'};
}

// one track: the forecast at each upcoming session's start. No upcoming session → no API call.
export async function buildForecast(id, {now = Date.now(), fetchFn = fetch, sessions = upcomingSessions(id, now)} = {}) {
  const ll = Object.hasOwn(TRACK_LL, id) ? TRACK_LL[id] : null;
  if (!ll) return {track: id, status: 'no-coordinates', sessions: []};
  if (!sessions.length) return {track: id, status: 'no-upcoming-session', sessions: []};
  const [lat, lon] = ll, model = bestMatchModel(lat, lon);
  const url = `${API}/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${HOURLY}&minutely_15=${Q15}&models=best_match&wind_speed_unit=ms&timezone=GMT&timeformat=unixtime&forecast_days=${DAYS + 1}`;
  const get = async u => { const r = await fetchFn(u, {signal: AbortSignal.timeout(5000)}); if (!r.ok) throw Error('Open-Meteo ' + r.status); return r.json(); };
  const [j, meta] = await Promise.all([get(url), get(`${API}/data/${model.meta}/static/meta.json`).catch(() => null)]);
  if (!j?.hourly?.time) throw Error('Open-Meteo: no hourly data');
  const out = [];
  for (const s of sessions) {
    const t = s.t / 1000, g = k => at(j, k, t, model.q15), air = g('temperature_2m'), sw = g('shortwave_radiation');
    if (!air) continue; // beyond the forecast
    const v = k => { const x = g(k); return x ? r1(x.v) : null; };
    out.push({event: s.event, series: s.series, name: s.name, start: s.start, step: air.step, rainProb: v('precipitation_probability'), shortwave: v('shortwave_radiation'),
      w: {airTempC: r1(air.v), humidityPct: v('relative_humidity_2m'), pressureHpa: v('surface_pressure'), windSpeed: v('wind_speed_10m'), windFromDeg: v('wind_direction_10m'),
        trackTempC: trackTempEst(air.v, sw ? sw.v : 0)}});
  }
  const run = meta?.last_run_initialisation_time;
  return {track: id, status: out.length ? 'ok' : 'beyond-forecast', model: model.name, q15: model.q15, lat, lon,
    issued: Number.isFinite(run) ? new Date(run * 1000).toISOString() : null, retrieved: new Date(now).toISOString(),
    trackTempErrC: lapsimTrackTemp.test.rmsC, credit: CREDIT, sessions: out};
}

// served by /api/lapsim/forecast: cached per track and UTC hour (BUCKET read-through cache), so Open-Meteo is called at most once an hour
// per track. On failure the page keeps the ERA5 climate preset (status 'unavailable').
export async function forecastFor(id, env = {}, {now = Date.now(), fetchFn = fetch} = {}) {
  if (!Object.hasOwn(TRACK_LL, id)) return {track: String(id).slice(0, 40), status: 'no-coordinates', sessions: []};
  const sessions = upcomingSessions(id, now);
  if (!sessions.length) return {track: id, status: 'no-upcoming-session', sessions: []};
  const hour = new Date(now).toISOString().slice(0, 13);
  try { return await cachedPublished(env, `lapsim-forecast/${id}/${hour}`, () => buildForecast(id, {now, fetchFn, sessions}), {ttl: TTL, maxStale: 0, now: () => now}); }
  catch (e) { return {track: id, status: 'unavailable', error: String(e.message || e), sessions: []}; }
}
