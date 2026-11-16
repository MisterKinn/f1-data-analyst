// LMGT3 / LMP3 pace per car and event from every Al Kamel Analysis CSV (WEC 2024-2026 LMGT3; ELMS 2024-2026 LMGT3 and LMP3), for the
// BoP simulator (owner 2026-11-16). Same logic and columns as scripts/sim/data/learn/wec-bop-pace.txt (fetch-wec-bop.mjs): green flying
// laps only (flag GF, no in-/out-lap); per car: best qualifying/hyperpole lap, mean of the fastest 20 % race laps, median top speed,
// longest full-green race stint. A multi-hour race keeps only its last (complete) hourly file.
// Runs in GitHub Actions (lapsim-learn.yml): the shell of a Claude session cannot reach Al Kamel.
// Also writes the Hypercar rows (scripts/sim/data/learn/wec-bop-pace.txt) so the BoP refresh workflow refits every class after each race.
// Out: scripts/sim/data/learn/gt3-bop-pace.txt (series year event class car manufacturer vehicle qBest raceF20 topMed maxGreenStint)
import {writeFile} from 'node:fs/promises';
import {parseCsv} from '../../../worker/wec.js';

const OUT = 'scripts/sim/data/learn/gt3-bop-pace.txt';
const CLASSES = {wec: /^(LMGT3|HYPERCAR)$/, elms: /^(LMGT3|LMP3)$/};
const get = async url => { const r = await fetch(url, {headers: {'user-agent': 'Mozilla/5.0 kongboda-learn'}}); if (!r.ok) throw Error(`${r.status} ${url}`); return r.text(); };
const flat = (nodes, folders = [], out = []) => { for (const n of nodes ?? []) { if (n.url) out.push({title: n.name, url: new URL(n.url, 'https://files.alkamelcloud.com/').href, folders}); else flat(n.children, [...folders, n.name].filter(Boolean), out); } return out; };
const sec = s => { if (!s) return NaN; const p = String(s).split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const med = a => { a = [...a].sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
const r3 = x => x == null || !isFinite(x) ? '-' : String(Math.round(x * 1000) / 1000);
const tok = s => String(s || '-').replace(/[^A-Za-z0-9.\-]+/g, '') || '-';
const EVENT = [[/QATAR|LOSAIL|LUSAIL/, 'LOSAIL'], [/IMOLA/, 'IMOLA'], [/SPA/, 'SPA'], [/LE ?MANS/, 'LEMANS'], [/PAULO|INTERLAGOS/, 'SAOPAULO'], [/AMERICAS|COTA|AUSTIN|LONE STAR/, 'COTA'], [/FUJI/, 'FUJI'], [/BAHRAIN|SAKHIR/, 'BAHRAIN'], [/BARCELONA|CATALUNYA/, 'BARCELONA'], [/MONZA/, 'MONZA'], [/SILVERSTONE/, 'SILVERSTONE'], [/RICARD|CASTELLET/, 'PAULRICARD'], [/PORTIM|ALGARVE/, 'PORTIMAO'], [/MUGELLO/, 'MUGELLO'], [/ARAG/, 'ARAGON'], [/HUNGARORING/, 'HUNGARORING']];
const evName = s => (EVENT.find(([re]) => re.test(String(s).toUpperCase())) || [, tok(String(s).toUpperCase())])[1];
const kind = s => /hyperpole|qualif/i.test(s) ? 'Q' : /race|hour/i.test(s) && !/practice|warm|test/i.test(s) ? 'R' : null;

const hyper = ['# Hypercar pace per car and event, every Al Kamel FIA WEC Analysis CSV 2024- (scripts/sim/learn/fetch-gt3-bop-pace.mjs; same columns as before).',
  '# Green flying laps only (flag GF, no in-lap, no out-lap). Columns:', '# year event car manufacturer qBest(s, best of Qualifying/Hyperpole) raceF20(s, mean of the fastest 20 % race laps) topMed(km/h) maxGreenStint(laps, longest full-green race stint)'];
const lines = ['# LMGT3/LMP3 pace per car and event, Al Kamel Analysis CSV (WEC LMGT3, ELMS LMGT3+LMP3) 2024-2026 (scripts/sim/learn/fetch-gt3-bop-pace.mjs).',
  '# Green flying laps only. Columns: series year event class car manufacturer vehicle qBest(s) raceF20(s) topMed(km/h) maxGreenStint(laps)'];
for (const series of Object.keys(CLASSES)) {
  let idx; try { idx = JSON.parse(await get(`https://files.alkamelcloud.com/${series}/manifests/results.json`)); } catch (e) { console.log(series, e.message); continue; }
  for (const s of (idx.seasons || []).filter(x => /202[4-9]/.test(x.name) && !/test|prologue only/i.test(x.name))) {
    const year = s.name.match(/20\d\d/)[0];
    let files; try { files = flat(JSON.parse(await get(new URL(s.manifestUrl, 'https://files.alkamelcloud.com/').href)).folders); } catch (e) { console.log(series, year, e.message); continue; }
    files = files.filter(f => /\.csv$/i.test(new URL(f.url).pathname) && /analysis/i.test(f.title) && !/lmp2/i.test(f.title));
    for (const event of new Set(files.map(f => f.folders[0]))) {
      const bySession = new Map();
      for (const f of files.filter(x => x.folders[0] === event)) { const k = kind(f.folders.slice(1).join(' ') + ' ' + f.title); if (!k) continue; const key = f.folders.slice(1, 3).join('/') + '|' + k; const p = bySession.get(key); if (!p || (f.folders.join('/') + f.title).localeCompare(p.folders.join('/') + p.title, undefined, {numeric: true}) > 0) bySession.set(key, f); }
      const cars = {};
      for (const [key, f] of bySession) {
        const k = key.split('|')[1]; let rows;
        try { rows = parseCsv(await get(f.url)).records.filter(r => CLASSES[series].test(String(r.CLASS || '').trim().toUpperCase())); } catch (e) { console.log(series, year, event, key, e.message); continue; }
        const by = {}; for (const r of rows) (by[r.NUMBER] ||= []).push(r);
        for (const [num, laps] of Object.entries(by)) {
          laps.sort((p, q) => +p.LAP_NUMBER - +q.LAP_NUMBER);
          const green = [], top = [], stints = []; let cur = 0, ok = true, first = true;
          laps.forEach((r, i) => { const inLap = !!r.CROSSING_FINISH_LINE_IN_PIT, outLap = i > 0 && !!laps[i - 1].CROSSING_FINISH_LINE_IN_PIT, t = sec(r.LAP_TIME); cur++;
            if (r.FLAG_AT_FL !== 'GF' && !inLap) ok = false; if (inLap) { if (!first && ok) stints.push(cur); first = false; cur = 0; ok = true; }
            if (r.FLAG_AT_FL !== 'GF' || inLap || outLap || i === 0 || !(t > 0)) return; green.push(t); if (+r.TOP_SPEED > 0) top.push(+r.TOP_SPEED); });
          if (!green.length) continue; green.sort((p, q) => p - q);
          const c = cars[num] ||= {cls: String(laps[0].CLASS).trim().toUpperCase(), mfr: tok(laps[0].MANUFACTURER), mfrRaw: laps[0].MANUFACTURER || '-', veh: tok(laps[0].VEHICLE || laps[0].CAR || ''), q: null, r: null, top: [], st: 0};
          if (k === 'Q') c.q = Math.min(c.q ?? Infinity, green[0]); else { const f20 = mean(green.slice(0, Math.max(1, Math.ceil(green.length * 0.2)))); c.r = c.r == null ? f20 : Math.min(c.r, f20); c.st = Math.max(c.st, ...stints, 0); }
          if (top.length) c.top.push(med(top));
        }
      }
      for (const [num, c] of Object.entries(cars)) if (c.cls === 'HYPERCAR') { if (c.r != null) hyper.push([year, evName(event), num, String(c.mfrRaw).split(/\s+/)[0], r3(c.q), r3(c.r), r3(med(c.top)), c.st || '-'].join(' ')); }
        else if (c.r != null || c.q != null) lines.push([series, year, evName(event), c.cls, num, c.mfr, c.veh, r3(c.q), r3(c.r), r3(med(c.top)), c.st || '-'].join(' '));
      console.log(series, year, event, Object.keys(cars).length, 'cars');
    }
  }
}
await writeFile(OUT, lines.join('\n') + '\n');
// Hypercar rows feed scripts/sim/bop-estimate.mjs; written only when the run found a full set (a failed fetch never empties the file)
if (hyper.length > 300) await writeFile('scripts/sim/data/learn/wec-bop-pace.txt', hyper.join('\n') + '\n');
console.log('wrote', OUT, lines.length - 2);
