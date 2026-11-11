// Downloads what the lap-simulator pipeline needs from OpenF1 (qualifying laps, car
// positions, telemetry, weather), MultiViewer circuit info (official corner positions) and
// the f1-circuits GeoJSON (north alignment). Raw responses stay in .cache/lapsim (Actions
// cache, never committed); only derived geometry and fitted parameters are committed.
// Usage: node scripts/sim/fetch-openf1.mjs [years=2023,2024,2025,2026]
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {chooseGeometrySources, slug} from './geometry-sources.mjs';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const YEARS = (process.argv[2] || process.env.LAPSIM_YEARS || '2023,2024,2025,2026').split(',').map(Number);
const GEOMETRY_DRIVERS = Number(process.env.LAPSIM_GEOMETRY_DRIVERS || 14);
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
  const [laps, results, weather, drivers] = await Promise.all([
    openf1('laps', {session_key: sk}), openf1('session_result', {session_key: sk}), openf1('weather', {session_key: sk}), openf1('drivers', {session_key: sk}),
  ]);
  const teamOf = n => drivers.find(d => d.driver_number === n)?.team_name || null;
  const ranked = results.filter(r => Number.isFinite(r.position)).sort((a, b) => a.position - b.position);
  const want = Math.max(isGeometryYear ? GEOMETRY_DRIVERS : 1, TRACE_DRIVERS);
  const chosen = [];
  for (const r of ranked) {
    if (chosen.length >= want) break;
    const target = bestOf(r);
    const own = laps.filter(l => l.driver_number === r.driver_number && Number.isFinite(l.lap_duration) && !l.is_pit_out_lap && l.date_start);
    if (!own.length) continue;
    const lap = own.find(l => Math.abs(l.lap_duration - target) < 0.0025) || own.sort((a, b) => a.lap_duration - b.lap_duration)[0];
    chosen.push({driver_number: r.driver_number, team: teamOf(r.driver_number), position: r.position, lap});
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
const byYear = {};
for (const year of YEARS) byYear[year] = (await openf1('sessions', {year})).filter(s => s.session_name === 'Qualifying' && Date.parse(s.date_end) < Date.now() - 3 * 3600e3);
// Fetch session weather before selecting geometry; older dry sources need the full
// geometry driver count and matching-year corner coordinates too.
const wet = JSON.parse(await readFile(new URL('./data/wet-sessions.json', import.meta.url), 'utf8'));
const candidates = [];
for (const year of YEARS) for (const s of byYear[year]) {
  let weather = [];
  try { weather = await openf1('weather', {session_key: s.session_key}); }
  catch (e) { console.warn(`${s.circuit_short_name}: weather unavailable for session ${s.session_key}: ${e.message}`); }
  candidates.push({...s, circuit: s.circuit_short_name, weather});
}
const choices = chooseGeometrySources(candidates, lapsimTracks, wet);
for (const choice of Object.values(choices)) if (choice.warning) console.warn(choice.warning);
const isGeometry = s => {
  const id = slug(s.circuit_short_name ?? s.circuit);
  return choices[id]?.source?.session_key === s.session_key || lapsimTracks[id]?.sessionKey === s.session_key;
};
for (const year of YEARS) {
  for (const s of byYear[year]) {
    try {
      const data = await session(s, isGeometry(s));
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
for (const {circuit_key, year} of index.filter(isGeometry)) {
  try { circuits[`${circuit_key}/${year}`] = await cachedJson(`https://api.multiviewer.app/api/v1/circuits/${circuit_key}/${year}`, {throttle: 0}); await sleep(400); }
  catch (e) { console.log(`no circuit info for ${circuit_key}: ${e.message}`); }
}
await writeFile(join(CACHE, 'circuits.json'), JSON.stringify(circuits));
try { await writeFile(join(CACHE, 'f1-circuits.geojson'), JSON.stringify(await cachedJson('https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson'))); }
catch (e) { console.log('no geojson: ' + e.message); }
await writeFile(join(CACHE, 'index.json'), JSON.stringify(index, null, 1));

// Race sessions for the race-pace model (fuel burn, tyre wear, pit loss): every lap of every
// driver with its stint (compound, tyre age), pit stops and race-control messages (SC/VSC/flags).
// Compact form in .cache/lapsim/races; only fitted factors are committed.
async function race(s) {
  const sk = s.session_key;
  const [laps, stints, pits, control, weather, drivers, results] = await Promise.all(['laps', 'stints', 'pit', 'race_control', 'weather', 'drivers', 'session_result'].map(p => openf1(p, {session_key: sk})));
  const teamOf = n => drivers.find(d => d.driver_number === n)?.team_name || null;
  const byDriver = {};
  for (const l of laps) {
    const st = stints.find(t => t.driver_number === l.driver_number && l.lap_number >= t.lap_start && l.lap_number <= (t.lap_end ?? 999));
    (byDriver[l.driver_number] ||= []).push([l.lap_number, l.lap_duration ?? null, l.duration_sector_1 ?? null, l.duration_sector_2 ?? null, l.duration_sector_3 ?? null,
      st?.compound || null, st ? st.tyre_age_at_start + l.lap_number - st.lap_start : null, st?.stint_number ?? null, l.is_pit_out_lap ? 1 : 0, l.date_start || null]);
  }
  return {
    session_key: sk, meeting_key: s.meeting_key, year: s.year, circuit: s.circuit_short_name, session: s.session_name, date_start: s.date_start,
    columns: ['lap', 'time', 's1', 's2', 's3', 'compound', 'tyreAge', 'stint', 'pitOut', 'date'],
    drivers: Object.fromEntries(Object.entries(byDriver).map(([n, ls]) => [n, {team: teamOf(Number(n)), position: results.find(r => r.driver_number === Number(n))?.position ?? null, laps: ls.sort((a, b) => a[0] - b[0])}])),
    pits: pits.map(p => [p.driver_number, p.lap_number, p.pit_duration ?? null, p.stop_duration ?? null]),
    control: control.map(c => [c.date, c.lap_number ?? null, c.category, c.flag ?? null, c.message]),
    weather: weather.map(w => [w.date, w.air_temperature, w.track_temperature, w.humidity, w.pressure, w.rainfall, w.wind_speed, w.wind_direction]),
  };
}
if (process.env.LAPSIM_RACES !== 'off') {
  await mkdir(join(CACHE, 'races'), {recursive: true});
  const races = [];
  for (const year of YEARS) {
    const list = (await openf1('sessions', {year})).filter(s => (s.session_name === 'Race' || s.session_name === 'Sprint') && Date.parse(s.date_end) < Date.now() - 3 * 3600e3);
    for (const s of list) {
      try {
        const data = await race(s);
        if (!Object.keys(data.drivers).length) { console.log(`skip race ${year} ${s.circuit_short_name}: no laps`); continue; }
        const file = `${year}-${s.circuit_short_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s.session_name.toLowerCase()}.json`;
        await writeFile(join(CACHE, 'races', file), JSON.stringify(data));
        races.push({file, year, circuit: s.circuit_short_name, session: s.session_name, session_key: s.session_key});
        console.log(`ok race ${year} ${s.circuit_short_name} ${s.session_name}`);
      } catch (e) { console.log(`fail race ${year} ${s.circuit_short_name}: ${e.message}`); }
    }
  }
  await writeFile(join(CACHE, 'races.json'), JSON.stringify(races, null, 1));
}
console.log(`done: ${index.length} qualifying sessions, ${calls} requests, ${cached} from cache`);
