// Macau Grand Prix best laps from the official results (macau.grandprix.gov.mo; robots.txt allows everything). The results page
// reads /api/game/result_list?year=<y> (events with one PDF per session); the PDFs are ITS-events classifications (one line per car:
// laps, best lap, the lap it was set on). Needs pdftotext (poppler). Scanned PDFs (no text) are skipped and logged.
// One derived row per car and session in scripts/sim/data/learn/macau-laps.json.gz; the PDFs are not stored.
//   node scripts/sim/learn/fetch-macau.mjs [--years=2023,2024,2025,2026]
import {writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const API = 'https://www.macau.grandprix.gov.mo/api/game/result_list', UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const TIME = /^(\d{1,2}):(\d{2})\.(\d{3})$/;
const secs = m => +(+m[1] * 60 + +(m[2] + '.' + m[3])).toFixed(3);
export const kindOf = s => /race/i.test(s) ? 'race' : /quali/i.test(s) ? 'qualifying' : 'practice';

// "1    8   Laurin HEINRICH   [Gold   1]   AO BY ABSOLUTE   911 GT3 R (992) (Evo)   13   [27:20.064  gaps]   02:15.632   13 ..."
export function itsRows(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    if (!/^\s*\d{1,3}\s+\d{1,3}\s{2,}\S/.test(line)) continue;
    const p = line.trim().split(/\s{2,}/), [pos, car] = p[0].split(/\s+/).length > 1 ? p[0].split(/\s+/) : [p[0], p.splice(1, 1)[0]];
    const iBest = p.findIndex((x, j) => j > 2 && TIME.test(x) && /^\d+$/.test(p[j + 1] || ''));
    const iLaps = p.findIndex((x, j) => j > 2 && /^\d+$/.test(x) && (TIME.test(p[j + 1] || '') || /^\d+:\d{2}:\d{2}/.test(p[j + 1] || '')));
    if (iLaps < 0) continue;
    out.push({pos: +pos, car: String(car), driver: p[1].replace(/\s+(Platinum|Gold|Silver|Bronze)\b.*$/, '').trim(), team: p[iLaps - 2] || null, model: p[iLaps - 1] || null,
      laps: +p[iLaps], best: iBest > 0 ? secs(TIME.exec(p[iBest])) : null, bestLap: iBest > 0 ? +p[iBest + 1] : null});
  }
  return out;
}
export const overallBest = text => { const m = /Best time Overall\s*:\s*(\d{1,2}):(\d{2})\.(\d{3}).*?\(No\.\s*(\d+)\)/.exec(text); return m ? {best: secs(m), car: m[4]} : null; };

const get = async (u, bin) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.json(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 3000)); } return null; };
const pdfText = (buf, dir) => { const f = join(dir, 'x.pdf'); writeFileSync(f, buf); return execFileSync('pdftotext', ['-layout', f, '-'], {encoding: 'utf8', maxBuffer: 1 << 28}); };

if (process.argv[1]?.endsWith('fetch-macau.mjs')) {
  const years = (process.argv.find(a => a.startsWith('--years='))?.slice(8) || '2023,2024,2025,2026').split(','), TMP = mkdtempSync(join(tmpdir(), 'macau-')), out = [];
  for (const year of years) {
    const list = (await get(`${API}?year=${year}&_locale=en`))?.data || [];
    for (const ev of list) for (const s of ev.results || []) {
      if (!s.pdf || /combined|grid|entry/i.test(s.title)) continue;
      const buf = await get(s.pdf, true); if (!buf) continue;
      const text = pdfText(buf, TMP), rows = itsRows(text), ob = overallBest(text);
      if (!rows.length) { const t = text.replace(/\s+/g, " ").trim(); console.log(`${year} ${ev.title} ${s.title}: no rows (${t.length} chars of text${t.length > 40 ? ": " + t.slice(0, 300) : ", scanned"}), skipped`); continue; }
      const check = ob ? (rows.find(r => r.car === ob.car)?.best === ob.best ? 'overall best ok' : 'overall best ✗') : 'no overall line';
      for (const r of rows) out.push({series: 'macau', season: +year, event: ev.title, session: s.title.trim(), kind: kindOf(s.title), ...r});
      console.log(`${year} ${ev.title} ${s.title}: ${rows.length} cars, ${check}`);
    }
  }
  writeFileSync('scripts/sim/data/learn/macau-laps.json.gz', gzipSync(JSON.stringify({
    source: 'Macau Grand Prix official results (macau.grandprix.gov.mo, ITS-events classification PDFs). Derived rows only, one per car and session.',
    fields: 'best = best lap (s); bestLap = the lap it was set on; laps; model = car as listed', fetched: new Date().toISOString().slice(0, 10), rows: out})));
  console.log('rows', out.length);
}
