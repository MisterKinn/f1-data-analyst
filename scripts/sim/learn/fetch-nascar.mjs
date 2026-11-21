// NASCAR every-lap timing from the public results feed nascar.com uses (cf.nascar.com/cacher, no login; owner approved 2026-11-21).
// Cup (1), Xfinity/O'Reilly (2), Truck (3). Raw files are not stored (physics rule 2.9): out is one derived row per car and session in
// scripts/sim/data/learn/nascar-laps.json.gz. Label: official timing feed, derived values.
//   race: laps, best lap, best clean lap (green flag, not in a caution, not the restart lap, not a pit-in or pit-out lap), median clean lap
//   qualifying / practice: best lap, speed and laps as the weekend feed lists them
//   node scripts/sim/learn/fetch-nascar.mjs [--years=2024,2025,2026]
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

export const SERIES = {1: 'cup', 2: 'xfinity', 3: 'truck'};
const BASE = 'https://cf.nascar.com/cacher/';
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator; public results reader)'}};
const KIND = {1: 'practice', 2: 'qualifying', 3: 'race'};
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

// laps that are not representative: inside a caution (start..end) and the restart lap after it
export function cautionLaps(segments = []) {
  const out = new Set();
  for (const c of segments) for (let l = c.start_lap; l <= c.end_lap + 1; l++) out.add(l);
  return out;
}

export function raceRows(lapTimes, race, pits = []) {
  const yellow = cautionLaps(race.caution_segments), official = new Map((race.results || []).map(r => [String(r.car_number), r]));
  const pitLaps = new Map();
  for (const p of pits) { const s = pitLaps.get(String(p.vehicle_number)) || new Set(); s.add(p.lap_count); s.add(p.lap_count + 1); pitLaps.set(String(p.vehicle_number), s); }
  return (lapTimes.laps || []).map(c => {
    const car = String(c.Number), timed = (c.Laps || []).filter(l => l.Lap > 0 && l.LapTime > 0), pit = pitLaps.get(car) || new Set();
    const clean = timed.filter(l => l.Lap > 1 && !yellow.has(l.Lap) && !pit.has(l.Lap)).map(l => l.LapTime), o = official.get(car);
    return {car, driver: c.FullName?.replace(/\s*\(.*\)$/, '') || null, manufacturer: o?.car_make || c.Manufacturer || null, team: o?.team_name || null,
      laps: timed.length, officialLaps: o?.laps_completed ?? null, best: timed.length ? Math.min(...timed.map(l => l.LapTime)) : null,
      cleanBest: clean.length ? Math.min(...clean) : null, cleanMedian: median(clean), cleanLaps: clean.length,
      start: o?.starting_position ?? null, finish: o?.finishing_position ?? null, status: o?.finishing_status ?? null};
  });
}

export const runRows = run => (run.results || []).map(r => ({car: String(r.car_number), driver: r.driver_name || null, manufacturer: r.manufacturer || null,
  laps: r.laps_completed ?? null, best: r.best_lap_time > 0 ? r.best_lap_time : null, bestSpeedMph: r.best_lap_speed || null, position: r.finishing_position ?? null}));

async function get(url) {
  for (let i = 0; i < 3; i++) { try { const r = await fetch(url, {...UA, signal: AbortSignal.timeout(45000)}); if (r.ok) return await r.json(); if (r.status === 404 || r.status === 403) return null; } catch {} await new Promise(s => setTimeout(s, 2000)); }
  return null;
}

if (process.argv[1]?.endsWith('fetch-nascar.mjs')) {
  const years = (process.argv.find(a => a.startsWith('--years='))?.slice(8) || '2024,2025,2026').split(',');
  const out = [], log = [];
  for (const year of years) {
    const list = await get(`${BASE}${year}/race_list_basic.json`) || {};
    for (const [sid, name] of Object.entries(SERIES)) for (const race of list['series_' + sid] || []) {
      if (!(new Date(race.race_date) < new Date()) || race.race_type_id !== 1) continue;  // points races that have run
      const base = `${BASE}${year}/${sid}/${race.race_id}/`, feed = await get(base + 'weekend-feed.json'); if (!feed) continue;
      const w = feed.weekend_race?.[0] || race, head = {series: name, season: +year, raceId: race.race_id, event: race.race_name, track: race.track_name, trackId: race.track_id, date: race.race_date?.slice(0, 10), plate: !!race.restrictor_plate};
      for (const run of feed.weekend_runs || []) { const rows = runRows(run); for (const r of rows) out.push({...head, session: run.run_name, kind: KIND[run.run_type] || 'practice', ...r}); }
      const laps = await get(base + 'lap-times.json');
      if (laps?.laps?.length) { const rows = raceRows(laps, w, await get(base + 'live-pit-data.json') || []); for (const r of rows) out.push({...head, session: 'Race', kind: 'race', ...r});
        const off = rows.filter(r => r.officialLaps != null && r.laps !== r.officialLaps).length; log.push(`${year} ${name} ${race.race_name}: ${rows.length} cars, lap count != official ${off}`); }
    }
  }
  writeFileSync('scripts/sim/data/learn/nascar-laps.json.gz', gzipSync(JSON.stringify({
    source: 'NASCAR public results feed (cf.nascar.com/cacher: race list, weekend feed, lap times, pit data). One row per car and session; raw files not stored.',
    fields: 'race: best = fastest lap; cleanBest / cleanMedian = green-flag laps outside cautions (and their restart lap), pit-in and pit-out laps; officialLaps = laps_completed. qualifying/practice: best lap as listed.',
    fetched: new Date().toISOString().slice(0, 10), rows: out})));
  console.log(log.join('\n')); console.log('rows', out.length);
}
