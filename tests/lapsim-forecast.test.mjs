import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingSessions, buildForecast, forecastFor, bestMatchModel, trackTempEst, CREDIT} from '../worker/lapsim/forecast.js';
import {TRACK_LL} from '../worker/lapsim/track-coords.js';
import {lapsimTrackTemp as TT} from '../worker/lapsim/tracktemp-data.js';
import {simulationPage, lapsimScript} from '../worker/simulation.js';

const NOW = Date.parse('2026-11-23T01:30:00Z'); // Monday 10:30 KST: Las Vegas is past, Lusail (27–29 Nov) is within 7 days
// a fake Open-Meteo answer: hourly air = 20 + hour index / 10, 15-minute air = 30 (to see which one is used)
function fakeApi(calls = []) {
  return async url => {
    calls.push(url);
    if (url.includes('/static/meta.json')) return {ok: true, json: async () => ({last_run_initialisation_time: 1795392000})};
    const t0 = Math.floor(NOW / 3600e3) * 3600, n = 24 * 8, time = Array.from({length: n}, (_, i) => t0 + i * 3600);
    const col = f => time.map((_, i) => f(i)), q = Array.from({length: n * 4}, (_, i) => t0 + i * 900);
    return {ok: true, json: async () => ({hourly: {time, temperature_2m: col(i => 20 + i / 10), relative_humidity_2m: col(() => 55), surface_pressure: col(() => 1010), wind_speed_10m: col(() => 3),
      wind_direction_10m: col(() => 90), shortwave_radiation: col(() => 400), precipitation_probability: col(() => 10)},
      minutely_15: {time: q, temperature_2m: q.map(() => 30), relative_humidity_2m: q.map(() => 60), wind_speed_10m: q.map(() => 4), wind_direction_10m: q.map(() => 80), shortwave_radiation: q.map(() => 0)}})};
  };
}
const memBucket = () => { const m = new Map(); return {get: async k => m.has(k) ? {json: async () => JSON.parse(m.get(k))} : null, put: async (k, v) => m.set(k, v)}; };

test('only sessions of the next 7 days: none for a past session, none for a cancelled or postponed one', () => {
  assert.deepEqual(upcomingSessions('las-vegas', NOW), []); // raced 19–21 Nov
  const lu = upcomingSessions('lusail', NOW);
  assert.deepEqual(lu.map(s => s.name), ['FP1', 'FP2', 'FP3', 'Qualifying', 'Race']); assert.ok(lu.every(s => s.t >= NOW && s.t <= NOW + 7 * 864e5));
  assert.deepEqual(upcomingSessions('yas-marina-circuit', NOW), []); // 4 Dec: beyond 7 days
  const ev = [{id: 'x', circuit: 'lusail', series: 'f1', status: 'cancelled'}, {id: 'y', circuit: 'lusail', series: 'wec', status: 'postponed'}, {id: 'z', circuit: 'lusail', series: 'f1'}];
  const sch = {x: [{nameEn: 'Qualifying', start: '2026-11-25T18:00:00Z'}], y: [{nameEn: 'Hyperpole', start: '2026-11-25T18:00:00Z'}], z: [{nameEn: 'Qualifying', start: '2026-11-25T18:00:00Z', cancelled: true}]};
  assert.deepEqual(upcomingSessions('lusail', NOW, {events: ev, schedule: sch}), []);
});

test('no API call when no session is upcoming; the API failing gives "unavailable" (the page keeps the climate preset)', async () => {
  const calls = [];
  assert.equal((await forecastFor('las-vegas', {}, {now: NOW, fetchFn: fakeApi(calls)})).status, 'no-upcoming-session');
  assert.equal((await forecastFor('__proto__', {}, {now: NOW, fetchFn: fakeApi(calls)})).status, 'no-coordinates');
  assert.equal(calls.length, 0);
  const down = await forecastFor('lusail', {}, {now: NOW, fetchFn: async () => ({ok: false, status: 503})});
  assert.equal(down.status, 'unavailable'); assert.deepEqual(down.sessions, []);
});

test('forecast at the session start: best_match, named model, issue time, estimated track temperature, attribution', async () => {
  const calls = [], f = await buildForecast('lusail', {now: NOW, fetchFn: fakeApi(calls)});
  assert.match(calls[0], /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?.*models=best_match/); assert.doesNotMatch(calls[0], /hrrr/);
  assert.match(calls[0], /precipitation_probability/); assert.match(calls[0], /minutely_15=/);
  assert.equal(f.status, 'ok'); assert.equal(f.model, 'global models (ECMWF IFS, GFS, ICON)'); assert.equal(f.issued, '2026-11-23T00:00:00.000Z'); assert.equal(f.credit, CREDIT);
  const q = f.sessions.find(s => s.name === 'Qualifying'), h = (Date.parse(q.start) / 1000 - Math.floor(NOW / 3600e3) * 3600) / 3600;
  assert.equal(q.step, 'hourly'); assert.equal(q.w.airTempC, Math.round((20 + h / 10) * 10) / 10); // global: hourly, not the 15-minute stream
  assert.equal(q.w.trackTempC, trackTempEst(20 + h / 10, 400)); assert.equal(trackTempEst(20, 400), Math.round((20 + TT.a + TT.k * 400) * 10) / 10);
  assert.deepEqual([q.w.humidityPct, q.w.pressureHpa, q.w.windSpeed, q.w.windFromDeg, q.rainProb], [55, 1010, 3, 90, 10]);
  assert.equal(f.trackTempErrC, 3.97);
});

test('the 15-minute stream is used where the model has native 15-minute data (ICON-D2, AROME, NOAA)', async () => {
  const sessions = [{event: 'e', series: 'f1', name: 'Qualifying', start: '2026-11-24T14:15:00Z', t: Date.parse('2026-11-24T14:15:00Z')}];
  const f = await buildForecast('monza', {now: NOW, fetchFn: fakeApi(), sessions});
  assert.equal(f.model, 'DWD ICON-D2'); assert.equal(f.sessions[0].step, '15 min'); assert.equal(f.sessions[0].w.airTempC, 30);
  const m = id => bestMatchModel(...TRACK_LL[id]).name;
  assert.equal(m('silverstone'), 'UKMO UK 2 km'); assert.equal(m('zandvoort'), 'KNMI HARMONIE-AROME (with ICON-D2)'); assert.match(m('las-vegas'), /^NOAA HRRR CONUS \(RRFS from 2026-11-30\)/);
  assert.equal(m('suzuka'), 'JMA MSM'); assert.equal(bestMatchModel(42.5, 2.0).name, 'Météo-France AROME France HD'); // south of the ICON-D2 box
});

test('server cache: one Open-Meteo call per track and hour', async () => {
  const calls = [], env = {BUCKET: memBucket()}, get = now => forecastFor('lusail', env, {now, fetchFn: fakeApi(calls)});
  const a = await get(NOW), b = await get(NOW + 20 * 60e3);
  assert.equal(a.status, 'ok'); assert.equal(b.cached, true); assert.equal(calls.length, 2); // forecast + meta.json, once
  await get(NOW + 61 * 60e3); assert.equal(calls.length, 4); // next hour: refreshed
});

// the page: computeView in the browser script, as tests/lapsim-climate.test.mjs
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const pageData = (track, car) => JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
const st = (d, extra = {}) => ({carId: d.carId, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}, ...extra});

test('page: no browser call to Open-Meteo; attribution; forecast block next to the ERA5 band; default lap unchanged; button runs the lap on it', async () => {
  assert.doesNotMatch(js, /api\.open-meteo\.com/); assert.match(js, /\/api\/lapsim\/forecast\?track=/);
  const d = pageData('lusail', '2026'); assert.equal(d.conds['2026'], undefined);
  const base = V.computeView(V.K, d, st(d), V.R);
  d.forecast = await buildForecast('lusail', {now: NOW, fetchFn: fakeApi()});
  const v = V.computeView(V.K, d, st(d), V.R), q = d.forecast.sessions.find(s => s.name === 'Qualifying');
  assert.equal(v.lap, base.lap, 'the default lap does not use the forecast');
  assert.match(v.airHtml, /For reference, typical weather/); // the ERA5 preset stays
  assert.match(v.airHtml, /Race-week forecast<\/dt>.*<option value="3" selected>F1 Qualifying 11-28 21:00 local/);
  assert.match(v.airHtml, /global models \(ECMWF IFS, GFS, ICON\), Open-Meteo best match · issued 2026-11-23 00:00 UTC · hourly values interpolated/);
  assert.match(v.airHtml, /ERA5 typical air p10–p90: [\d.-]+–[\d.-]+ °C/); assert.match(v.airHtml, /air -1\.02 °C bias, RMS 2\.25 °C\. Forecast error not measured yet/);
  assert.match(v.airHtml, /track [\d.]+ °C \(estimated, ±3\.97 °C\)/); assert.match(v.airHtml, /data-fc-run="3">Run on forecast<\/button>/); assert.match(v.airHtml, /Open-Meteo\.com \(CC BY 4\.0\)/);
  const r = V.computeView(V.K, d, st(d, {mode: 'forecast', fcIdx: 3}), V.R);
  assert.match(r.airHtml, new RegExp(`Air temperature</dt><dd data-no-translate>${q.w.airTempC.toFixed(1)} °C`)); assert.match(r.airHtml, /forecast F1 Qualifying 11-28 21:00/);
  assert.notEqual(r.lap, base.lap);
});

test('page: a past session keeps its real weather (no forecast block); API down shows the climate preset, labelled', () => {
  const d = pageData('lusail', '2025'); assert.ok(d.conds['2025']);
  d.forecast = {status: 'ok', model: 'x', issued: null, trackTempErrC: 3.97, sessions: [{event: 'e', series: 'f1', name: 'Qualifying', start: '2026-11-28T21:00:00+03:00', step: 'hourly', rainProb: 0, w: {airTempC: 1, humidityPct: 1, pressureHpa: 1000, windSpeed: 0, windFromDeg: 0, trackTempC: 1}}]};
  const v = V.computeView(V.K, d, st(d), V.R); assert.match(v.airHtml, /real session 2025/); assert.doesNotMatch(v.airHtml, /Race-week forecast/);
  const u = pageData('lusail', '2026'); u.forecast = {status: 'unavailable', sessions: []};
  const w = V.computeView(V.K, u, st(u), V.R); assert.match(w.airHtml, /forecast not available: the typical \(climate\) weather is shown/); assert.match(w.airHtml, /For reference, typical weather/);
  const ko = pageData('lusail', '2026'); assert.match(simulationPage({track: 'lusail', car: '2026'}, 'ko'), /<option value="forecast">레이스 위크 예보<\/option>/); assert.equal(ko.forecast, undefined);
});

test('verification log: stored once before the session, never changed; sensor added after; per-model summary needs n ≥ 5', async () => {
  const {logForecasts, addSensors, summarize} = await import('../scripts/sim/forecast-log.mjs');
  const qStart = Date.parse('2026-11-28T21:00:00+03:00'), log = {entries: []};
  await logForecasts(log, NOW, {fetchFn: fakeApi()}); assert.equal(log.entries.length, 0, 'nothing more than 6 h ahead');
  const pre = qStart - 2 * 3600e3, calls = [];
  await logForecasts(log, pre, {fetchFn: fakeApi(calls)}); const q = log.entries.find(e => e.session === 'Qualifying');
  assert.ok(q && q.leadH === 2 && q.model && q.sensor === null); const frozen = JSON.stringify(q.forecast);
  await logForecasts(log, pre + 3600e3, {fetchFn: fakeApi()}); assert.equal(log.entries.filter(e => e.key === q.key).length, 1); assert.equal(JSON.stringify(q.forecast), frozen);
  const openf1 = async url => ({ok: true, json: async () => /sessions\?/.test(url) ? [{session_key: 9999, circuit_short_name: 'Lusail'}]
    : [{air_temperature: 24, track_temperature: 27, humidity: 60, pressure: 1012, wind_speed: 2}, {air_temperature: 26, track_temperature: 29, humidity: 50, pressure: 1012, wind_speed: 4}]});
  await addSensors(log, qStart + 3 * 3600e3, {fetchFn: openf1});
  assert.deepEqual([q.sensor.airTempC, q.sensor.trackTempC, q.sensor.n], [25, 28, 2]); assert.equal(JSON.stringify(q.forecast), frozen);
  const s = summarize(log); assert.equal(s.length, 1); assert.equal(s[0].enough, false);
  assert.equal(s[0].air.bias, Math.round((q.forecast.airTempC - 25) * 100) / 100);
});
