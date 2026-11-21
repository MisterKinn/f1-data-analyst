// NLS (ADAC RAVENOL Nürburgring Langstrecken-Serie) every lap from the wige SOLUTIONS PDFs the series posts in its results archive
// (nuerburgring-langstrecken-serie.de/wp-content/uploads/ergebnisse/<date><kind>.pdf; robots.txt allows /wp-content/uploads).
// Per event: t = qualifying result, tl = its lap by lap, r = race result, rl = its lap by lap. Needs pdftotext (poppler).
// Raw PDFs are not stored: one derived row per car and session in scripts/sim/data/learn/nls-laps.json.gz.
// As for the 24H Series, the result's fastest lap is the authority; laps quicker than it in the lap file were deleted (dropped).
//   node scripts/sim/learn/fetch-nls.mjs
import {writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const ARCHIVE = 'https://www.nuerburgring-langstrecken-serie.de/language/de/ergebnisarchiv/', UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const TIME = /(?<![\d:.])(\d{1,2}):(\d{2})\.(\d{3})(?![\d:])/g;  // m:ss.sss, not part of h:mm:ss.sss
const secs = m => +(+m[1] * 60 + +(m[2] + '.' + m[3])).toFixed(3);
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : +((s[n / 2 - 1] + s[n / 2]) / 2).toFixed(3)) : null; };
const squeeze = s => s.replace(/\s+/g, ' ').trim();

// lap by lap: "    4 Goroyan RT by Car Collection     Goroyan(1) / Kvitka(2) / Berthon(3)" then "   8:19.755 1(3)  9:17.951 2(3) ..."
export function lapByLap(text) {
  const cars = []; let car = null;
  for (const line of String(text).split('\n')) {
    const head = /^\s{0,6}(\d{1,3})(?:\s+(.*?))?\s{2,}(\S.*\(\d\).*)$/.exec(line);
    if (head && !/\d:\d{2}\.\d{3}/.test(line)) {
      const drivers = Object.fromEntries([...head[3].matchAll(/([^/()]+?)\((\d)\)/g)].map(m => [m[2], squeeze(m[1])]));
      car = {car: head[1], team: squeeze(head[2] || ''), drivers, laps: []}; cars.push(car); continue;
    }
    if (car) for (const m of line.matchAll(/(?<![\d:.])(\d{1,2}):(\d{2})\.(\d{3})\s+(\d{1,3})\s*\((\d)\)/g)) car.laps.push({lap: +m[4], t: secs(m), driver: car.drivers[m[5]] || m[5]});
  }
  return cars;
}

// result (t / r). A car starts with "Pl. Nr." ("  1     47   SP9 PRO"); its class can stand alone on the line before ("SP9 PRO-AM"),
// and car, laps and times are on the same line or the next one ("Mercedes-AMG GT3   8   7:52.393   185.627"). The fastest lap is
// the last m:ss.sss of that line (race: total time h:mm:ss.sss and gap come first, "8:01.780  5" last).
export function results(text) {
  const out = new Map(); let pending = '', open = null;
  const fill = (rest, first) => { const t = [...rest.matchAll(TIME)];
    const cols = rest.trim().split(/\s{2,}/).filter(x => !/^[\d:.]+$/.test(x));
    if (first && !open.cls) { open.cls = cols.shift() || null; }
    open.model = cols[0] || null; open.best = t.length ? secs(t[t.length - 1]) : null; };
  for (const line of String(text).split('\n')) {
    const m = /^\s{0,4}(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/.exec(line);
    if (m) {
      open = {pos: +m[1], cls: pending || null, model: null, best: null}; out.set(m[2], open); pending = '';
      const rest = m[3] || '';
      if ([...rest.matchAll(TIME)].length) fill(rest, true); else if (!open.cls) open.cls = squeeze(rest) || null;
      continue;
    }
    if (open && open.best == null && [...line.matchAll(TIME)].length) { fill(line, false); continue; }
    const cls = /^\s{8,20}([A-Z][A-Z0-9 .+/-]{1,20}?)\s*$/.exec(line); if (cls) pending = squeeze(cls[1]);
  }
  return out;
}

export function carRows(lapText, resultText) {
  const res = results(resultText || '');
  return lapByLap(lapText).map(c => {
    const r = res.get(c.car), all = c.laps.map(l => l.t), quickest = all.length ? Math.min(...all) : null;
    const off = r?.best != null && (quickest == null || Math.abs(r.best / quickest - 1) <= 0.1) ? r.best : null;
    const ts = off == null ? all : all.filter(t => t >= off - 0.0005), best = off ?? (ts.length ? Math.min(...ts) : null), green = ts.filter(t => t <= best * 1.07);
    const drivers = Object.values(c.drivers).map(name => { const t = c.laps.filter(l => l.driver === name && (off == null || l.t >= off - 0.0005)).map(l => l.t); return {name, best: t.length ? Math.min(...t) : null, laps: t.length}; });
    return {car: c.car, team: c.team, model: r?.model ?? null, cls: r?.cls ?? null, pos: r?.pos ?? null, laps: all.length, best, lapBest: ts.length ? Math.min(...ts) : null,
      deleted: all.length - ts.length, cleanMedian: median(green), cleanLaps: green.length, officialBest: off, drivers};
  });
}

const get = async (u, bin) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 3000)); } return null; };
const pdfText = (buf, dir) => { const f = join(dir, 'x.pdf'); writeFileSync(f, buf); return execFileSync('pdftotext', ['-layout', f, '-'], {encoding: 'utf8', maxBuffer: 1 << 28}); };
export const SESSIONS = {t: ['Qualifying', 'qualifying', 'tl'], r: ['Race', 'race', 'rl']};

if (process.argv[1]?.endsWith('fetch-nls.mjs')) {
  const TMP = mkdtempSync(join(tmpdir(), 'nls-')), page = await get(ARCHIVE) || '', out = [];
  console.log(`archive page ${page.length} chars, ${(page.match(/ergebnisse\/\d{4}-/g) || []).length} result links`);
  const pdfs = new Set([...page.matchAll(/href=["']([^"']*?\/wp-content\/uploads\/ergebnisse\/(\d{4}-\d{2}-\d{2})([a-z]+)\.pdf)["']/g)].map(m => m[2] + m[3]));
  const dates = [...new Set([...pdfs].map(p => p.slice(0, 10)))].sort();
  for (const date of dates) for (const [k, [session, kind, lk]] of Object.entries(SESSIONS)) {
    if (!pdfs.has(date + lk)) continue;
    const base = `https://www.nuerburgring-langstrecken-serie.de/wp-content/uploads/ergebnisse/${date}`, lb = await get(base + lk + '.pdf', true), rb = pdfs.has(date + k) ? await get(base + k + '.pdf', true) : null;
    if (!lb) continue;
    const rt = rb ? pdfText(rb, TMP) : '', event = squeeze(rt.split('\n').find(l => l.trim()) || date), rows = carRows(pdfText(lb, TMP), rt);
    const missing = rows.filter(r => r.officialBest != null && Math.abs(r.lapBest - r.officialBest) > 0.0005).length, del = rows.reduce((a, r) => a + r.deleted, 0), noResult = rows.filter(r => r.pos == null).length;
    for (const r of rows) out.push({series: 'nls', season: +date.slice(0, 4), date, event, session, kind, ...r});
    console.log(`${date} ${event} ${session}: ${rows.length} cars, no result row ${noResult}, deleted laps ${del}, official fastest missing from the lap file ${missing}`);
  }
  writeFileSync('scripts/sim/data/learn/nls-laps.json.gz', gzipSync(JSON.stringify({
    source: 'NLS results archive (nuerburgring-langstrecken-serie.de, wige SOLUTIONS timing PDFs). Derived numbers only, one row per car and session; the PDFs are not stored.',
    fields: 'best = official fastest lap (result), else quickest listed lap; deleted = listed laps quicker than it (dropped); cleanMedian = median of kept laps within 107% of best; drivers = best and laps per driver',
    fetched: new Date().toISOString().slice(0, 10), rows: out})));
  console.log('rows', out.length);
}
