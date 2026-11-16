// Hypercar pace of the WEC seasons before the BoP data (2021-2023: Glickenhaus SCG 007, Vanwall Vandervell 680, Alpine A480 and the
// first Peugeot/Ferrari/Porsche/Cadillac seasons), for the BoP simulator's cars raced only then (owner 2026-11-16: every Hypercar, latest
// spec). Same reading as fetch-wec-bop.mjs (green flying laps). Out: scripts/sim/data/learn/wec-old-pace.txt, columns as wec-bop-pace.txt.
// Runs in GitHub Actions (lapsim-learn.yml).
import {writeFile} from 'node:fs/promises';
import {archive, readDocument} from '../../../worker/wec.js';
const sec = s => { if (!s) return NaN; const p = String(s).split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const med = a => { a = [...a].sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
const r3 = x => x == null ? '-' : String(Math.round(x * 1000) / 1000);
const MF = m => /glickenhaus|scg/i.test(m) ? 'Glickenhaus' : /vanwall|vandervell|bykolles/i.test(m) ? 'Vanwall' : /alpine/i.test(m) ? 'Alpine' : /toyota/i.test(m) ? 'Toyota' : /ferrari/i.test(m) ? 'Ferrari' : /peugeot/i.test(m) ? 'Peugeot' : /porsche/i.test(m) ? 'Porsche' : /cadillac/i.test(m) ? 'Cadillac' : String(m || '?').split(' ')[0];
const lines = ['# Hypercar pace 2021-2023 per car and event, Al Kamel FIA WEC Analysis CSV (scripts/sim/learn/fetch-wec-old.mjs). Green flying laps only.',
  '# year event car manufacturer qBest(s) raceF20(s) topMed(km/h) maxGreenStint(laps)'];
const idx = await archive();
for (const s of idx.records.filter(x => /20(21|22|23)/.test(x.name) && !/test|prologue only/i.test(x.name))) {
  const year = s.name.match(/20\d\d/)[0]; let a; try { a = await archive(s.season_id); } catch (e) { console.log(s.name, e.message); continue; }
  for (const event of a.events) {
    const files = a.files.filter(f => f.folders[0] === event && /FIA WEC/i.test(f.folders[1] || '') && f.format === 'csv' && /^Analysis_/i.test(f.title) && !/LMGT3|LMP2|GTE/i.test(f.title));
    const bySession = new Map(); for (const f of files) { const k = f.folders.slice(1, 3).join('/'), p = bySession.get(k); if (!p || (f.folders.join('/') + f.title).localeCompare(p.folders.join('/') + p.title, undefined, {numeric: true}) > 0) bySession.set(k, f); }
    const cars = {};
    for (const [k, f] of bySession) { const kind = /hyperpole|qualif/i.test(k + f.title) ? 'Q' : /race/i.test(k + f.title) ? 'R' : null; if (!kind) continue;
      let rows; try { rows = (await readDocument({url: f.url, limit: 200000, category: 'HYPERCAR'})).records.filter(r => /HYPERCAR/i.test(r.CLASS)); } catch (e) { console.log(year, event, k, e.message); continue; }
      const by = {}; for (const r of rows) (by[r.NUMBER] ||= []).push(r);
      for (const [num, laps] of Object.entries(by)) { laps.sort((p, q) => +p.LAP_NUMBER - +q.LAP_NUMBER); const green = [], top = [];
        laps.forEach((r, i) => { const inL = !!r.CROSSING_FINISH_LINE_IN_PIT, outL = i > 0 && !!laps[i - 1].CROSSING_FINISH_LINE_IN_PIT, t = sec(r.LAP_TIME); if (r.FLAG_AT_FL !== 'GF' || inL || outL || i === 0 || !(t > 0)) return; green.push(t); if (+r.TOP_SPEED > 0) top.push(+r.TOP_SPEED); });
        if (!green.length) continue; green.sort((p, q) => p - q); const c = cars[num] ||= {mf: MF(laps[0].MANUFACTURER || laps[0].VEHICLE || laps[0].TEAM), q: null, r: null, top: []};
        if (kind === 'Q') c.q = Math.min(c.q ?? Infinity, green[0]); else c.r = mean(green.slice(0, Math.max(1, Math.ceil(green.length * 0.2)))); if (top.length) c.top.push(med(top)); } }
    const tag = String(event).toUpperCase().replace(/^\d+_/, '').replace(/[^A-Z0-9]+/g, '').slice(0, 16);
    for (const [num, c] of Object.entries(cars)) if (c.r) lines.push(`${year} ${tag} ${num} ${c.mf} ${c.q == null ? '-' : r3(c.q)} ${r3(c.r)} ${c.top.length ? r3(med(c.top)) : '-'} -`);
    console.log(year, event, Object.keys(cars).length, 'Hypercars'); } }
await writeFile('scripts/sim/data/learn/wec-old-pace.txt', lines.join('\n') + '\n');
console.log('wrote', lines.length - 2, 'rows');
