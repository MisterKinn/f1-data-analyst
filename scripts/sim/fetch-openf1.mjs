// Downloads what the lap-simulator pipeline needs from OpenF1 (qualifying laps, car
// positions, telemetry, weather), MultiViewer circuit info (official corner positions) and
// the f1-circuits GeoJSON (north alignment). Raw responses stay in .cache/lapsim (Actions
// cache, never committed); only derived geometry and fitted parameters are committed.
// Usage: node scripts/sim/fetch-openf1.mjs [years=2025,2026]
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const YEARS = (process.argv[2] || process.env.LAPSIM_YEARS || '2025,2026').split(',').map(Number);
const GEOMETRY_YEAR = Math.max(...YEARS);
const GEOMETRY_DRIVERS = Number(process.env.LAPSIM_GEOMETRY_DRIVERS || 8);
const TRACE_DRIVERS = Number(process.env.LAPSIM_TRACE_DRIVERS || 3);
const UA = 'Kongboda-lapsim/1.0 (+https://kongboda-motorsports.vercel.app)';
const OPENF1 = 'https://api.openf1.org/v1/';
let lastOpenf1 = 0, calls = 0, cached = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = url => createHash('sha1').update(url).digest('hex');

async function cachedJson(url, {throttle = 0, allow404 = false} = {}) {
  const file = join(CACHE, 'raw', key(url) + '.json');
  try { const hit = JSON.parse(await readFile(file, 'utf8')); cached++; return hit; } catch {}
  for (let attempt = 0; ; attempt++) {
    if (throttle) { const wait = lastOpenf1 + throttle - Date.now(); if (wait > 0) await sleep(wait); lastOpenf1 = Date.now(); }
    let res;
    try { res = await fetch(url, {headers: {accept: 'application/json', 'user-agent': UA}, signal: AbortSignal.timeout(60000)}); }
    catch (e) { if (attempt < 4) { await sleep(5000 * (attempt + 1)); continue; } throw e; }
    calls++;
    if (res.status === 429 || res.status >= 500) { if (attempt < 6) { await sleep(Math.min(90000, 15000 * (attempt + 1))); continue; } }
    if (res.status === 404 && allow404) { await writeFile(file, '[]'); return []; }
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    const data = await res.json();
    await writeFile(file, JSON.stringify(data));
    return data;
  }
}
// Same query encoding the site uses: {'date>': iso} becomes date%3E=<iso>, i.e. date >= iso.
const openf1 = (path, params) => {
  const q = Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');
  return cachedJson(OPENF1 + path + '?' + q, {throttle: 2300, allow404: true});
};

const iso = ms => new Date(ms).toISOString();
const bestOf = r => Array.isArray(r.duration) ? Math.min(...r.duration.filter(Number.isFinite)) : (Number.isFinite(r.duration) ? r.duration : Infinity);

async function session(s, isGeometryYear) {
  const sk = s.session_key;
  const [laps, results, weather] = await Promise.all([
    openf1('laps', {session_key: sk}), openf1('session_result', {session_key: sk}), openf1('weather', {session_key: sk}),
  ]);
  const ranked = results.filter(r => Number.isFinite(r.position)).sort((a, b) => a.position - b.position);
  const want = Math.max(isGeometryYear ? GEOMETRY_DRIVERS : 1, TRACE_DRIVERS);
  const chosen = [];
  for (const r of ranked) {
    if (chosen.length >= want) break;
    const target = bestOf(r);
    const own = laps.filter(l => l.driver_number === r.driver_number && Number.isFinite(l.lap_duration) && !l.is_pit_out_lap && l.date_start);
    if (!own.length) continue;
    const lap = own.find(l => Math.abs(l.lap_duration - target) < 0.0025) || own.sort((a, b) => a.lap_duration - b.lap_duration)[0];
    chosen.push({driver_number: r.driver_number, position: r.position, lap});
  }
  const out = [];
  for (const [i, c] of chosen.entries()) {
    const t0 = Date.parse(c.lap.date_start), t1 = t0 + c.lap.lap_duration * 1000;
    const window = {'date>': iso(t0 - 1500), 'date<': iso(t1 + 1500)};
    const needLocation = isGeometryYear ? i < GEOMETRY_DRIVERS : i < TRACE_DRIVERS;
    const location = needLocation ? await openf1('location', {session_key: sk, driver_number: c.driver_number, ...window}) : [];
    const carData = i < TRACE_DRIVERS ? await openf1('car_data', {session_key: sk, driver_number: c.driver_number, ...window}) : [];
    out.push({...c, location: location.map(p => [p.date, p.x, p.y, p.z]), carData: carData.map(p => [p.date, p.speed, p.throttle, p.brake, p.n_gear, p.rpm, p.drs])});
  }
  return {
    session_key: sk, meeting_key: s.meeting_key, year: s.year, circuit_key: s.circuit_key, circuit: s.circuit_short_name,
    location: s.location, country: s.country_name, date_start: s.date_start, date_end: s.date_end,
    laps: out, weather: weather.map(w => [w.date, w.air_temperature, w.track_temperature, w.humidity, w.pressure, w.rainfall, w.wind_speed, w.wind_direction]),
  };
}

await mkdir(join(CACHE, 'raw'), {recursive: true});
await mkdir(join(CACHE, 'sessions'), {recursive: true});
const index = [];
for (const year of YEARS) {
  const sessions = (await openf1('sessions', {year})).filter(s => s.session_name === 'Qualifying' && Date.parse(s.date_end) < Date.now() - 3 * 3600e3);
  for (const s of sessions) {
    try {
      const data = await session(s, year === GEOMETRY_YEAR);
      if (!data.laps.length) { console.log(`skip ${year} ${s.circuit_short_name}: no laps`); continue; }
      const file = `${year}-${s.circuit_short_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
      await writeFile(join(CACHE, 'sessions', file), JSON.stringify(data));
      index.push({file, year, circuit_key: s.circuit_key, circuit: s.circuit_short_name, session_key: s.session_key});
      console.log(`ok ${year} ${s.circuit_short_name} (${data.laps.length} laps)`);
    } catch (e) { console.log(`fail ${year} ${s.circuit_short_name}: ${e.message}`); }
  }
}
// Official corner positions (MultiViewer, same coordinate frame as OpenF1 positions)
const circuits = {};
for (const {circuit_key, year} of index.filter(x => x.year === GEOMETRY_YEAR)) {
  try { circuits[circuit_key] = await cachedJson(`https://api.multiviewer.app/api/v1/circuits/${circuit_key}/${year}`, {throttle: 0}); await sleep(400); }
  catch (e) { console.log(`no circuit info for ${circuit_key}: ${e.message}`); }
}
await writeFile(join(CACHE, 'circuits.json'), JSON.stringify(circuits));
try { await writeFile(join(CACHE, 'f1-circuits.geojson'), JSON.stringify(await cachedJson('https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson'))); }
catch (e) { console.log('no geojson: ' + e.message); }
await writeFile(join(CACHE, 'index.json'), JSON.stringify(index, null, 1));
console.log(`done: ${index.length} sessions, ${calls} requests, ${cached} from cache`);
