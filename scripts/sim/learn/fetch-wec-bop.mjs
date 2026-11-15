// Hypercar pace per car, session and event from every Al Kamel WEC Analysis CSV (2023-2026), for the
// 2026 BoP estimate (worker/lapsim/bop-estimate.js). Every lap is read; per car and session we keep
// green flying laps only (flag GF, not an in-lap, not an out-lap) and store compact statistics:
// best, mean of the fastest 20 % / 50 %, sector bests, top speed (max and median), full green stints (race).
// Writes scripts/sim/data/learn/wec-bop-pace.json. Runs in Actions (lapsim-learn workflow): the shell cannot reach Al Kamel.
import {writeFile} from 'node:fs/promises';
import {archive, readDocument} from '../../../worker/wec.js';

const OUT = 'scripts/sim/data/learn/wec-bop-pace.json';
const sec = s => { if (!s) return NaN; const p = String(s).split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
const q = (a, f) => a.length ? a[Math.min(a.length - 1, Math.floor(f * (a.length - 1)))] : null;
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;
const kind = t => /hyperpole/i.test(t) ? 'HP' : /qualif/i.test(t) ? 'Q' : /^race/i.test(t) ? 'R' : /warm/i.test(t) ? 'W' : 'P';

const idx = await archive();
const seasons = idx.records.filter(s => /20(23|24|25|26)/.test(s.name) && !/test|prologue only/i.test(s.name));
const out = {generated: new Date().toISOString(), source: 'Al Kamel FIA WEC Analysis CSV (files.alkamelcloud.com)', seasons: {}};
for (const s of seasons) {
  const year = (s.name.match(/20\d\d/) || [])[0];
  let a; try { a = await archive(s.season_id); } catch (e) { console.log(s.name, e.message); continue; }
  for (const event of a.events) {
    // FIA WEC sessions with a Hypercar class (prologue too); a multi-hour race keeps only its last Hour file
    const files = a.files.filter(f => f.folders[0] === event && /FIA WEC/i.test(f.folders[1] || '') && f.format === 'csv' && /^Analysis_/i.test(f.title) && !/LMGT3|LMP2|GTE/i.test(f.title));
    const bySession = new Map();
    for (const f of files) { const key = f.folders.slice(1, 3).join('/'); const prev = bySession.get(key); if (!prev || (f.folders.join('/') + f.title).localeCompare(prev.folders.join('/') + prev.title, undefined, {numeric: true}) > 0) bySession.set(key, f); }
    const ev = {sessions: []};
    for (const [key, f] of bySession) {
      let rows; try { rows = (await readDocument({url: f.url, limit: 200000, category: 'HYPERCAR'})).records; } catch (e) { console.log(year, event, key, e.message); continue; }
      rows = rows.filter(r => r.CLASS === 'HYPERCAR'); if (!rows.length) continue;
      const cars = {};
      const byCar = {}; for (const r of rows) (byCar[r.NUMBER] ||= []).push(r);
      for (const [num, laps] of Object.entries(byCar)) {
        laps.sort((x, y) => +x.LAP_NUMBER - +y.LAP_NUMBER);
        const green = [], s1 = [], s2 = [], s3 = [], top = [], stints = []; let cur = 0, curGreen = true, first = true;
        laps.forEach((r, i) => {
          const inLap = !!r.CROSSING_FINISH_LINE_IN_PIT, outLap = i > 0 && !!laps[i - 1].CROSSING_FINISH_LINE_IN_PIT, t = sec(r.LAP_TIME);
          cur++; if (r.FLAG_AT_FL !== 'GF' && !inLap) curGreen = false;
          if (inLap) { if (!first && curGreen) stints.push(cur); first = false; cur = 0; curGreen = true; }
          if (r.FLAG_AT_FL !== 'GF' || inLap || outLap || i === 0 || !(t > 0)) return;
          green.push(t); s1.push(+r.S1_SECONDS || sec(r.S1)); s2.push(+r.S2_SECONDS || sec(r.S2)); s3.push(+r.S3_SECONDS || sec(r.S3));
          if (+r.TOP_SPEED > 0) top.push(+r.TOP_SPEED);
        });
        if (green.length < 1) continue;
        green.sort((x, y) => x - y); top.sort((x, y) => y - x);
        const n20 = Math.max(1, Math.ceil(green.length * 0.2)), n50 = Math.max(1, Math.ceil(green.length * 0.5));
        cars[num] = {mfr: laps[0].MANUFACTURER, team: laps[0].TEAM, n: green.length, best: r3(green[0]), f20: r3(mean(green.slice(0, n20))), f50: r3(mean(green.slice(0, n50))),
          s: [s1, s2, s3].map(x => r3(Math.min(...x.filter(v => v > 0)))), top: top[0] ?? null, topMed: q(top, 0.5), top80: q(top, 0.2), stints: stints.length ? stints : undefined};
      }
      ev.sessions.push({key, title: f.title, kind: kind(f.folders[2] || f.title), cars});
      console.log(year, event, key, Object.keys(cars).length);
    }
    if (ev.sessions.length) ((out.seasons[year] ||= {})[event] = ev);
  }
}
await writeFile(OUT, JSON.stringify(out));
console.log('wrote', OUT);
