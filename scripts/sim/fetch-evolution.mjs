// Lap-by-lap timing of practice and qualifying sessions for the track-evolution fit
// (scripts/sim/evolution-fit.mjs): every lap with its session minute, out-lap flag and tyre.
//  - F1: OpenF1 laps, stints, weather and race control (qualifying all seasons, practice recent ones)
//  - WEC: Al Kamel analysis files (every class, practice, qualifying and Hyperpole)
// Raw responses stay in .cache/lapsim/raw; compact sessions go to .cache/lapsim/evolution.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {archive, readDocument} from '../../worker/wec.js';
import {SERIES, WEC_SEASONS} from '../../worker/lapsim/series.js';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim', OUT = join(CACHE, 'evolution');
const Q_YEARS = (process.env.LAPSIM_EVO_QUALI_YEARS || '2023,2024,2025,2026').split(',').map(Number);
const P_YEARS = (process.env.LAPSIM_EVO_PRACTICE_YEARS || '2025,2026').split(',').map(Number);
const UA = 'Kongboda-lapsim/1.0 (+https://kongboda-motorsports.vercel.app)';
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0;

// same cache layout and URL encoding as fetch-openf1.mjs, so its cached responses are reused
async function openf1(path, params) {
  const url = 'https://api.openf1.org/v1/' + path + '?' + Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');
  const file = join(CACHE, 'raw', createHash('sha1').update(url).digest('hex') + '.json');
  try { return JSON.parse(await readFile(file, 'utf8')); } catch {}
  for (let a = 0; ; a++) {
    const wait = last + 2300 - Date.now(); if (wait > 0) await sleep(wait); last = Date.now();
    let res;
    try { res = await fetch(url, {headers: {accept: 'application/json', 'user-agent': UA}, signal: AbortSignal.timeout(60000)}); }
    catch (e) { if (a < 4) { await sleep(5000 * (a + 1)); continue; } throw e; }
    if ((res.status === 429 || res.status >= 500) && a < 6) { await sleep(15000 * (a + 1)); continue; }
    if (res.status === 404) { await writeFile(file, '[]'); return []; }
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    const data = await res.json(); await writeFile(file, JSON.stringify(data)); return data;
  }
}

const typeOf = name => /practice/i.test(name) ? 'practice' : /qualifying|shootout|hyperpole/i.test(name) ? 'qualifying' : null;
await mkdir(join(CACHE, 'raw'), {recursive: true});
await mkdir(OUT, {recursive: true});
const index = [];

// F1 — rows: [car, lap, time, minute, outLap, compound, tyreAge, neutral]
if (process.env.LAPSIM_EVO_F1 !== 'off') for (const year of [...new Set([...Q_YEARS, ...P_YEARS])]) {
  // OpenF1 refuses anonymous calls (401) while a live session runs: skip the season, a rerun fills it
  let all; try { all = await openf1('sessions', {year}); } catch (e) { console.log(`f1 ${year}: ${e.message}`); continue; }
  const list = all.filter(s => Date.parse(s.date_end) < Date.now() - 3 * 3600e3 && typeOf(s.session_name)
    && (typeOf(s.session_name) === 'qualifying' ? Q_YEARS : P_YEARS).includes(year));
  for (const s of list) {
    try {
      const sk = s.session_key, t0 = Date.parse(s.date_start);
      const [laps, stints, weather, control] = await Promise.all(['laps', 'stints', 'weather', 'race_control'].map(p => openf1(p, {session_key: sk})));
      // yellow/red/SC periods: laps that start inside one are flagged
      const flags = []; let open = null;
      for (const c of control.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
        const t = Date.parse(c.date), bad = ['RED', 'DOUBLE YELLOW'].includes(c.flag) || /SAFETY CAR DEPLOYED|VSC DEPLOYED/.test(c.message || '');
        if (bad && open == null) open = t;
        else if (open != null && (c.flag === 'GREEN' || c.flag === 'CLEAR' || /ENDING|RESUME/.test(c.message || ''))) { flags.push([open, t]); open = null; }
      }
      if (open != null) flags.push([open, Infinity]);
      const rows = [];
      for (const l of laps) {
        if (!Number.isFinite(l.lap_duration) || !l.date_start) continue;
        const ts = Date.parse(l.date_start), st = stints.find(x => x.driver_number === l.driver_number && l.lap_number >= x.lap_start && l.lap_number <= (x.lap_end ?? 999));
        rows.push([l.driver_number, l.lap_number, l.lap_duration, Math.round((ts - t0) / 600) / 100, l.is_pit_out_lap ? 1 : 0, st?.compound || null,
          st ? st.tyre_age_at_start + l.lap_number - st.lap_start : null, flags.some(([a, b]) => ts + l.lap_duration * 1000 > a && ts < b) ? 1 : 0]);
      }
      if (rows.length < 30) continue;
      const file = `f1-${year}-${slug(s.circuit_short_name)}-${slug(s.session_name)}.json`;
      await writeFile(join(OUT, file), JSON.stringify({series: 'f1', year, track: slug(s.circuit_short_name), session: s.session_name, type: typeOf(s.session_name),
        columns: ['car', 'lap', 'time', 'minute', 'outLap', 'compound', 'tyreAge', 'neutral'], rows,
        weather: weather.map(w => [Math.round((Date.parse(w.date) - t0) / 600) / 100, w.track_temperature, w.rainfall])}));
      index.push({file, series: 'f1', year, track: slug(s.circuit_short_name), type: typeOf(s.session_name), session: s.session_name});
      console.log(`f1 ${year} ${s.circuit_short_name} ${s.session_name}: ${rows.length} laps`);
    } catch (e) { console.log(`f1 ${year} ${s.circuit_short_name} ${s.session_name}: ${e.message}`); }
  }
}

// WEC (Al Kamel) — rows: [car, lap, time, minute, outLap, class, null, neutral]
const secs = t => { const p = String(t || '').split(':').map(Number); return p.some(x => !Number.isFinite(x)) || !p.length ? NaN : p.reduce((a, x) => a * 60 + x, 0); };
if (process.env.LAPSIM_EVO_WEC !== 'off') for (const year of Object.keys(WEC_SEASONS).map(Number)) {
  let a; try { a = await archive(WEC_SEASONS[year]); } catch (e) { console.log(`wec ${year}: ${e.message}`); continue; }
  for (const event of a.events) {
    const track = SERIES.wec.events[event]; if (!track) continue;
    const files = a.files.filter(f => f.folders[0] === event && f.folders[1] === 'FIA WEC' && f.format === 'csv' && /^Analysis_/i.test(f.title) && typeOf(f.title));
    for (const f of files) {
      try {
        const recs = (await readDocument({url: f.url, limit: 100000})).records, rows = [], lastPit = new Map();
        for (const r of recs) {
          const time = secs(r.LAP_TIME), el = secs(r.ELAPSED);
          if (!(time > 30) || !Number.isFinite(el)) continue;
          const out = lastPit.get(r.NUMBER) === true; lastPit.set(r.NUMBER, !!r.CROSSING_FINISH_LINE_IN_PIT);
          rows.push([r.NUMBER, Number(r.LAP_NUMBER), time, Math.round((el - time) / 0.6) / 100, out || r.CROSSING_FINISH_LINE_IN_PIT ? 1 : 0, r.CLASS, null, ['GF', 'FF'].includes(r.FLAG_AT_FL) ? 0 : 1]);
        }
        if (rows.length < 30) continue;
        const w = a.files.find(x => x.folders[2] === f.folders[2] && /^Weather_/i.test(x.title));
        const wr = w ? (await readDocument({url: w.url, limit: 100000})).records : [];
        const file = `wec-${year}-${track}-${slug(f.folders[2] || f.title)}.json`;
        await writeFile(join(OUT, file), JSON.stringify({series: 'wec', year, track, session: f.folders[2] || f.title, type: typeOf(f.title),
          columns: ['car', 'lap', 'time', 'minute', 'outLap', 'class', 'tyreAge', 'neutral'], rows,
          weather: wr.map(x => [null, Number(x.TRACK_TEMP), Number(x.RAIN)])}));
        index.push({file, series: 'wec', year, track, type: typeOf(f.title), session: f.folders[2] || f.title});
        console.log(`wec ${year} ${event} ${f.title}: ${rows.length} laps`);
      } catch (e) { console.log(`wec ${year} ${event} ${f.title}: ${e.message}`); }
    }
  }
}
await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log(`evolution: ${index.length} sessions`);
