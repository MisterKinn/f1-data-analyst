// Best qualifying/Hyperpole laps per WEC class from Al Kamel's published timing (lap time, sectors,
// speed trap) plus the session weather. Writes .cache/lapsim/wec.json for calibrate.mjs.
import {writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {archive, readDocument} from '../../worker/wec.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {SERIES, WEC_SEASONS} from '../../worker/lapsim/series.js';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const YEARS = (process.env.LAPSIM_WEC_YEARS || Object.keys(WEC_SEASONS).join(',')).split(',').map(Number);
// Hypercar timing is split into LMH and LMDh by manufacturer (series.js)
const CLASSES = {HYPERCAR: ['lmh', 'lmdh'], LMGT3: ['lmgt3']};
const secs = t => { const p = String(t || '').split(':').map(Number); return p.some(x => !Number.isFinite(x)) || !p.length ? NaN : p.reduce((a, x) => a * 60 + x, 0); };
const num = x => { const v = Number(String(x ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const rows = async url => (await readDocument({url, limit: 100000})).records;

await mkdir(CACHE, {recursive: true});
const out = [];
for (const year of YEARS) {
  let a;
  try { a = await archive(WEC_SEASONS[year]); } catch (e) { console.log(`wec ${year}: ${e.message}`); continue; }
  for (const event of a.events) {
    const track = SERIES.wec.events[event];
    if (!track || !lapsimTracks[track]) { console.log(`wec ${year} ${event}: no simulator track`); continue; }
    const files = a.files.filter(f => f.folders[0] === event && f.folders[1] === 'FIA WEC' && f.format === 'csv');
    for (const [label, clsList] of Object.entries(CLASSES)) {
      const sessions = files.filter(f => /^Analysis_(?:Qualifying|Hyperpole)/i.test(f.title) && new RegExp(label, 'i').test(f.title));
      const best = new Map(), weatherBySession = {};
      for (const f of sessions) {
        try {
          for (const r of await rows(f.url)) {
            if (r.CLASS !== label || r.CROSSING_FINISH_LINE_IN_PIT || !['GF', 'FF'].includes(r.FLAG_AT_FL)) continue;
            const lap = secs(r.LAP_TIME);
            if (!(lap > 30)) continue;
            const prev = best.get(r.NUMBER);
            if (!prev || lap < prev.lap) best.set(r.NUMBER, {car: r.NUMBER, manufacturer: r.MANUFACTURER, team: r.TEAM, session: f.folders[2], lap,
              sectors: [num(r.S1_SECONDS), num(r.S2_SECONDS), num(r.S3_SECONDS)], topSpeedKph: num(r.TOP_SPEED)});
          }
          // weather file of the same session folder (titles can differ by spaces, folders do not)
          const w = files.find(x => x.folders[2] === f.folders[2] && /^Weather_/i.test(x.title));
          if (w) weatherBySession[f.folders[2]] = await rows(w.url);
        } catch (e) { console.log(`wec ${year} ${event} ${f.title}: ${e.message}`); }
      }
      for (const cls of clsList) {
      const def = SERIES.wec.classes[cls];
      const laps = [...best.values()].filter(l => !def.manufacturers || def.manufacturers.test(l.manufacturer || '')).sort((x, y) => x.lap - y.lap).slice(0, 3);
      if (!laps.length) continue;
      const weatherRows = weatherBySession[laps[0].session] || []; // the session the fastest lap came from
      const mean = k => { const v = weatherRows.map(r => num(r[k])).filter(x => x != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
      // wind as a vector mean (direction is where it blows from)
      let we = 0, wn = 0;
      for (const r of weatherRows) { const s = (num(r.WIND_SPEED) || 0) / 3.6, d = (num(r.WIND_DIRECTION) || 0) * Math.PI / 180; we += s * Math.sin(d); wn += s * Math.cos(d); }
      const weather = weatherRows.length ? {airTempC: mean('AIR_TEMP'), trackTempC: mean('TRACK_TEMP'), humidityPct: mean('HUMIDITY'), pressureHpa: mean('PRESSURE'),
        windSpeed: Math.hypot(we, wn) / weatherRows.length, windFromDeg: (Math.atan2(we, wn) * 180 / Math.PI + 360) % 360,
        rain: weatherRows.some(r => num(r.RAIN) > 0)} : null;
      out.push({series: 'wec', year, event, track, cls, laps, weather});
      console.log(`wec ${year} ${event} ${cls}: best ${laps[0].lap.toFixed(3)} (#${laps[0].car} ${laps[0].manufacturer}), trap ${laps[0].topSpeedKph}`);
      }
    }
  }
}
await writeFile(join(CACHE, 'wec.json'), JSON.stringify(out));
console.log(`wec: ${out.length} class sessions`);
