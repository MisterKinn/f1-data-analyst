// NLS (ADAC RAVENOL Nürburgring Langstrecken-Serie) and the Nürburgring 24h race (series 'n24') every lap from the wige SOLUTIONS PDFs the series posts in its results archive
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

const ARCHIVE = 'https://www.nuerburgring-langstrecken-serie.de/language/de/ergebnisarchiv/', N24 = 'https://www.24h-rennen.de/ergebnisse/',
  N24_KNOWN = {lap: 'https://www.24h-rennen.de/wp-content//uploads/ergebnisse/2026-ADAC-RAVENOL-24h-Nuerburgring/41_24h_Race_Lap_by_Lap.pdf',
    result: 'https://www.24h-rennen.de/wp-content//uploads/ergebnisse/2026-ADAC-RAVENOL-24h-Nuerburgring/39_24h_Race_Result_Final.pdf'}, UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
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
    // "8:29.070 pit(1)" (N24): an in-lap, numbered after the lap before it
    if (car) for (const m of line.matchAll(/(?<![\d:.])(\d{1,2}):(\d{2})\.(\d{3})\s+(\d{1,3}|pit)\s*\((\d)\)/g)) {
      const pit = m[4] === 'pit', lap = pit ? (car.laps.at(-1)?.lap ?? 0) + 1 : +m[4];
      car.laps.push({lap, t: secs(m), driver: car.drivers[m[5]] || m[5], ...(pit ? {pit: true} : {})});
    }
  }
  return cars;
}

// result (t / r). A car starts with "Pl. Nr." ("  1     47   SP9 PRO"); its class can stand alone on the line before ("SP9 PRO-AM"),
// and car, laps and times are on the same line or the next one ("Mercedes-AMG GT3   8   7:52.393   185.627"). The fastest lap is
// the last m:ss.sss of that line (race: total time h:mm:ss.sss and gap come first, "8:01.780  5" last).
export function results(text) {
  const out = new Map(); let pending = '', open = null;
  // text columns of a line: numbers and the N24 "E: entrant" / "S: sponsor" columns are not the car
  const textCols = rest => rest.trim().split(/\s{2,}/).filter(x => !/^[\d:.+ ]+(kph)?$/.test(x) && !/^[ES]:/.test(x) && !/^\d+ Runden?$/.test(x));
  const fill = (rest, first) => { const t = [...rest.matchAll(TIME)], cols = textCols(rest);
    if (first && !open.cls) open.cls = cols.shift() || null;
    open.model = cols[0] || open.model; open.best = t.length ? secs(t[t.length - 1]) : null; };
  for (const line of String(text).split('\n')) {
    const m = /^\s{0,4}(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/.exec(line);
    if (m) {
      open = {pos: +m[1], cls: pending || null, model: null, best: null}; out.set(m[2], open); pending = '';
      const rest = m[3] || '';
      if ([...rest.matchAll(TIME)].length) fill(rest, true); else { const cols = textCols(rest); if (!open.cls) open.cls = cols.shift() || null; open.model = cols.at(-1) || null; }
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
  const TMP = mkdtempSync(join(tmpdir(), 'nls-')), page = await get(ARCHIVE) || '', out = [], lapsOut = [];
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
    // step 36: every listed lap for σ_meas (NLS_LAPS_OUT; raw laps, never committed). Clock = the car's running sum of lap times.
    if (process.env.NLS_LAPS_OUT) { const cls = new Map(rows.map(r => [r.car, r.cls])), off = new Map(rows.map(r => [r.car, r.officialBest])), laps = [];
      for (const c of lapByLap(pdfText(lb, TMP))) { let clock = 0, stint = 1, k = 0;
        for (const l of c.laps) { clock += l.t; k++; laps.push({who: c.car + '|' + l.driver, cls: cls.get(c.car) ?? null, clock, stint, k, y: l.t, pit: !!l.pit, deleted: off.get(c.car) != null && l.t < off.get(c.car) - 0.0005}); if (l.pit) { stint++; k = 0; } } }
      lapsOut.push({series: 'nls', season: +date.slice(0, 4), event, session, kind, laps}); }
    console.log(`${date} ${event} ${session}: ${rows.length} cars, no result row ${noResult}, deleted laps ${del}, official fastest missing from the lap file ${missing}`);
  }
  // Nürburgring 24h (same timing, 24h-rennen.de results page): the race has a result and a lap-by-lap file
  // the page answers browsers but not this job (empty response); the PDFs themselves are served, so the newest known files are the fallback
  const n24 = await get(N24) || '', link = re => [...n24.matchAll(/href=["']([^"']+\.pdf)["']/g)].map(m => m[1]).find(u => re.test(u));
  const lbl = link(/_Race_Lap_by_Lap\.pdf$/) || N24_KNOWN.lap, res = link(/_Race_Result_Final[^/]*\.pdf$/) || link(/_Race_Result[^/]*\.pdf$/) || N24_KNOWN.result;
  console.log(`24h-rennen.de results page ${n24.length ? 'read' : 'not readable from here (known 2026 files used; add next year\'s here)'}`);
  if (lbl) {
    const lb = await get(new URL(lbl, N24).href, true), rb = res ? await get(new URL(res, N24).href, true) : null;
    if (lb) { const rt = rb ? pdfText(rb, TMP) : '', rows = carRows(pdfText(lb, TMP), rt), year = +(/\/ergebnisse\/(\d{4})-/.exec(lbl)?.[1] || 0);
      const event = squeeze(rt.split('\n').find(l => /24h/i.test(l))?.replace(/^.*?(\d+\w* ADAC.*?24h Nürburgring).*$/, '$1') || 'Nürburgring 24h');
      const missing = rows.filter(r => r.officialBest != null && Math.abs(r.lapBest - r.officialBest) > 0.0005).length, del = rows.reduce((a, r) => a + r.deleted, 0);
      for (const r of rows) out.push({series: 'n24', season: year, date: null, event, session: 'Race', kind: 'race', ...r});
      console.log(`${year} ${event} Race: ${rows.length} cars, no result row ${rows.filter(r => r.pos == null).length}, deleted laps ${del}, official fastest missing from the lap file ${missing}`); }
  }
  writeFileSync('scripts/sim/data/learn/nls-laps.json.gz', gzipSync(JSON.stringify({
    source: 'NLS results archive (nuerburgring-langstrecken-serie.de) and the Nürburgring 24h results page (24h-rennen.de), wige SOLUTIONS timing PDFs. Derived numbers only, one row per car and session; the PDFs are not stored.',
    fields: 'best = official fastest lap (result), else quickest listed lap; deleted = listed laps quicker than it (dropped); cleanMedian = median of kept laps within 107% of best; drivers = best and laps per driver',
    fetched: new Date().toISOString().slice(0, 10), rows: out})));
  if (process.env.NLS_LAPS_OUT) writeFileSync(process.env.NLS_LAPS_OUT, gzipSync(JSON.stringify({source: 'wige SOLUTIONS lap-by-lap PDFs (NLS); raw laps for σ_meas (step 36), never committed', sessions: lapsOut})));
  console.log('rows', out.length);
}
