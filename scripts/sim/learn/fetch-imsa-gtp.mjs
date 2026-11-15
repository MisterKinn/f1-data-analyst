// IMSA GTP pace per car and event from the official Al Kamel IMSA results (imsa.results.alkamelcloud.com), 2024–2026, for the BoP
// simulator's "for fun" Acura ARX-06 (owner 2026-11-16): the ARX-06 never raced in WEC, so its level is carried over through the cars
// that race both series (Porsche 963, Cadillac V-Series.R, BMW M Hybrid V8, Aston Martin Valkyrie). Green flying laps only (flag GF, no
// in-/out-lap). Columns as scripts/sim/data/learn/wec-bop-pace.txt: year event car manufacturer qBest raceF20 topMed maxGreenStint.
// Runs in GitHub Actions (lapsim-learn.yml): the shell of a Claude session cannot reach Al Kamel. Out: scripts/sim/data/learn/imsa-gtp-pace.txt
import {writeFile} from 'node:fs/promises';
import {officialArchive, officialCall} from '../../../worker/official.js';

const OUT = 'scripts/sim/data/learn/imsa-gtp-pace.txt';
const sec = s => { if (!s) return NaN; const p = String(s).split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const med = a => { a = [...a].sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
const r3 = x => x == null ? '-' : String(Math.round(x * 1000) / 1000);
const MFR = m => /acura/i.test(m) ? 'Acura' : /porsche/i.test(m) ? 'Porsche' : /cadillac/i.test(m) ? 'Cadillac' : /bmw/i.test(m) ? 'BMW' : /aston/i.test(m) ? 'Aston' : /lamborghini/i.test(m) ? 'Lamborghini' : /alpine/i.test(m) ? 'Alpine' : /genesis/i.test(m) ? 'Genesis' : String(m || '?').split(' ')[0];
const read = async url => { const all = []; for (let off = 0; off < 100000; off += 5000) { const r = JSON.parse((await officialCall('motorsport_read_document', {url, offset: off, limit: 5000, category: 'GTP'})).content[0].text); const rec = r.records || []; all.push(...rec); if (rec.length < 5000 || r.next_offset == null) break; } return all; };

const lines = ['# IMSA GTP pace per car and event, official Al Kamel IMSA results 2024-2026 (scripts/sim/learn/fetch-imsa-gtp.mjs). Green flying laps only.',
  '# year event car manufacturer qBest(s) raceF20(s, mean of the fastest 20 % race laps) topMed(km/h) maxGreenStint(laps)'];
const {seasons} = await officialArchive('imsa');
for (const s of seasons.filter(x => /202[4-6]/.test(x.name))) {
  const year = s.name.match(/20\d\d/)[0]; let a; try { a = await officialArchive('imsa', s.id); } catch (e) { console.log(year, e.message); continue; }
  for (const ev of a.events) {
    let f; try { f = await officialArchive('imsa', s.id, ev.id); } catch (e) { console.log(year, ev.name, e.message); continue; }
    // WeatherTech sessions only ("TIME CARDS" CSV = every lap); per session the last file (a long race publishes hourly files, the last one is complete)
    const files = f.files.filter(x => x.format === 'csv' && /time cards/i.test(x.title) && /weathertech/i.test(x.folders.join(' ')));
    const bySession = new Map(); for (const x of files) { const k = x.folders.slice(0, 3).join('/'); const p = bySession.get(k); if (!p || (x.url).localeCompare(p.url, undefined, {numeric: true}) > 0) bySession.set(k, x); }
    const cars = {};
    for (const [k, x] of bySession) {
      const kind = /qualif/i.test(k + x.title) ? 'Q' : /race/i.test(k + x.title) ? 'R' : null; if (!kind) continue;
      let rows; try { rows = (await read(x.url)).filter(r => /^GTP$/i.test(String(r.CLASS || r.Class || '').trim())); } catch (e) { console.log(year, ev.name, k, e.message); continue; }
      const by = {}; for (const r of rows) (by[r.NUMBER] ||= []).push(r);
      for (const [num, laps] of Object.entries(by)) { laps.sort((p, q) => +p.LAP_NUMBER - +q.LAP_NUMBER);
        const green = [], top = []; let cur = 0, ok = true, first = true, stints = [];
        laps.forEach((r, i) => { const inLap = !!r.CROSSING_FINISH_LINE_IN_PIT, outLap = i > 0 && !!laps[i - 1].CROSSING_FINISH_LINE_IN_PIT, t = sec(r.LAP_TIME); cur++;
          if (r.FLAG_AT_FL !== 'GF' && !inLap) ok = false; if (inLap) { if (!first && ok) stints.push(cur); first = false; cur = 0; ok = true; }
          if (r.FLAG_AT_FL !== 'GF' || inLap || outLap || i === 0 || !(t > 0)) return; green.push(t); if (+r.TOP_SPEED > 0) top.push(+r.TOP_SPEED); });
        if (!green.length) continue; green.sort((p, q) => p - q);
        const c = cars[num] ||= {mfr: MFR(laps[0].MANUFACTURER || laps[0].VEHICLE || laps[0].TEAM), q: null, r: null, top: [], st: 0};
        if (kind === 'Q') c.q = Math.min(c.q ?? Infinity, green[0]); else { c.r = mean(green.slice(0, Math.max(1, Math.ceil(green.length * 0.2)))); c.st = Math.max(c.st, ...stints, 0); }
        if (top.length) c.top.push(med(top)); }
    }
    const tag = ev.name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 16);
    for (const [num, c] of Object.entries(cars)) if (c.r) lines.push(`${year} ${tag} ${num} ${c.mfr} ${c.q == null ? '-' : r3(c.q)} ${r3(c.r)} ${c.top.length ? r3(med(c.top)) : '-'} ${c.st || '-'}`);
    console.log(year, ev.name, Object.keys(cars).length, 'GTP cars');
  }
}
await writeFile(OUT, lines.join('\n') + '\n');
console.log('wrote', OUT, lines.length - 2, 'rows');
