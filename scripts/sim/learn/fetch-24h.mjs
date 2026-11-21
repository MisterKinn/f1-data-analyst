// 24H Series (Creventic) every lap from Time Service's published PDFs (getraceresults.com -> resultscdn.getraceresults.com; no robots
// rule on the files). Each session has "<session>.pdf" (result, fastest lap per car) and "<session> - laptimes.pdf" (every lap per
// driver). Needs pdftotext (poppler). Raw PDFs are not stored: one derived row per car and session in
// scripts/sim/data/learn/24h-laps.json.gz (best lap, laps, clean median, class from the result, official fastest for the check).
// The PDFs set letters and digits with odd gaps ("1: 36.1 47", "Porsc he"), so numbers are read with optional single spaces.
//   node scripts/sim/learn/fetch-24h.mjs [--years=2024,2025,2026]
import {writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const SITE = 'https://getraceresults.com', UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
// a lap or fastest-lap time with the PDF's stray single spaces: "1: 36.1 47", "1:33.5 09", "10 :32.224"
// minutes are never split ("2 2:02.788" is a column digit, then 2:02.788); a gap before the colon is ("10 :32.224")
const LAP = /(?<![\d:])(\d{1,2}) ?: ?(\d) ?(\d) ?\. ?(\d) ?(\d) ?(\d)(?![\d.])/g;
const lapOf = m => +(+m[1] * 60 + +(m[2] + m[3] + '.' + m[4] + m[5] + m[6])).toFixed(3);
export const laps = line => [...String(line).matchAll(LAP)].map(lapOf);
const squeeze = s => s.replace(/\s+/g, ' ').trim();
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : +((s[n / 2 - 1] + s[n / 2]) / 2).toFixed(3)) : null; };

// "<session> - laptimes.pdf" text: car header "  11 H OFOR Racing   41 0 Laps   Merc edes-AMG GT3 EVO", then driver rows
// "  Alexander P rinz   1 - 25   1: 41.6 19 ..." and continuation rows "  26 - 50   1: 34.2 46 ...".
export function lapTimes(text) {
  const cars = []; let car = null, driver = null;
  for (const line of String(text).split('\n')) {
    const head = /^\s{0,10}(\d{1,3})\s+(\S.*?)\s+((?:\d ?){1,4})\s?Laps\b\s*(.*)$/.exec(line);  // one space can be all that separates the columns
    if (head) { car = {car: head[1], team: squeeze(head[2]), lapsListed: +head[3].replace(/ /g, ''), model: squeeze(head[4]), drivers: {}, laps: []}; cars.push(car); continue; }
    if (!car) continue;
    const range = /^(\s*\S.*?)?\s{2,}((?:\d ?){1,4})\s?-\s?((?:\d ?){1,4})\s{2,}(.*)$/.exec(line);
    if (!range) continue;
    if (range[1] && /[A-Za-z]/.test(range[1])) driver = squeeze(range[1]);
    const from = +range[2].replace(/ /g, ''), times = laps(range[4]);
    times.forEach((t, i) => { car.laps.push({lap: from + i, t, driver}); (car.drivers[driver] ??= []).push(t); });
  }
  return cars;
}

// "<session>.pdf" result: "  1     69     GT3      AM     Continental ... 1:32.0 90    74 ..." -> car, class, fastest lap.
// The fastest lap is the time under the "Fastest" header (pdftotext -layout keeps columns); gaps and diffs can also be m:ss times.
// Long names push a race car's times to the next line.
export function resultRows(text) {
  const out = new Map(); let open = null, fx = null;
  const near = line => { const t = [...String(line).matchAll(LAP)]; if (!t.length) return null; if (fx == null) return lapOf(t[0]);
    return lapOf(t.reduce((a, m) => Math.abs(m.index - fx) < Math.abs(a.index - fx) ? m : a)); };
  for (const line of String(text).split('\n')) {
    const h = line.indexOf('Fastest'); if (h >= 0 && /Pos|Gap|Laps|Team|Laptime/.test(line)) { fx = h; continue; }
    const m = /^\s{0,4}(\d{1,3})\s{1,8}(\d{1,3})\s{2,}([A-Z0-9][A-Z0-9-]*)\s/.exec(line);
    if (m) { open = {pos: +m[1], cls: m[3], fastest: near(line)}; out.set(m[2], open); continue; }
    if (open && open.fastest == null) open.fastest = near(line);
  }
  return out;
}

// The result's fastest lap is the authority: the lap-time file still lists laps the officials deleted (track limits), so laps quicker
// than the official fastest are dropped (counted in `deleted`). Cars without a result row keep their quickest listed lap.
export function carRows(lapText, resultText, kind) {
  const res = resultRows(resultText || '');
  return lapTimes(lapText).map(c => {
    const r = res.get(c.car), all = c.laps.map(l => l.t).filter(t => t > 20), quickest = all.length ? Math.min(...all) : null;
    // an official time more than 10% from the car's own quickest lap was misread from the result: not used
    const off = r?.fastest != null && (quickest == null || Math.abs(r.fastest / quickest - 1) <= 0.1) ? r.fastest : null;
    const ts = off == null ? all : all.filter(t => t >= off - 0.0005), best = off ?? (ts.length ? Math.min(...ts) : null), green = ts.filter(t => t <= best * 1.07);
    const byDriver = Object.entries(c.drivers).map(([name, t]) => ({name, best: Math.min(...t.filter(x => off == null || x >= off - 0.0005)), laps: t.length})).filter(d => d.name && d.name !== 'null' && Number.isFinite(d.best));
    return {car: c.car, team: c.team, model: c.model, cls: r?.cls ?? null, pos: r?.pos ?? null, laps: all.length, lapsListed: c.lapsListed,
      best, lapBest: ts.length ? Math.min(...ts) : null, deleted: all.length - ts.length, quickestDropped: all.length > ts.length ? Math.min(...all) : null, cleanMedian: median(green), cleanLaps: green.length, officialBest: off, officialRead: r?.fastest ?? null, drivers: byDriver};
  });
}

const get = async (u, bin) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 3000)); } return null; };
const pdfText = (buf, dir) => { const f = join(dir, 'x.pdf'); writeFileSync(f, buf); return execFileSync('pdftotext', ['-layout', f, '-'], {encoding: 'utf8', maxBuffer: 1 << 28}); };
export const sessionKind = s => /race/i.test(s) ? 'race' : /qualif/i.test(s) ? 'qualifying' : /practice|test|track day/i.test(s) ? 'practice' : 'other';

if (process.argv[1]?.endsWith('fetch-24h.mjs')) {
  const years = (process.argv.find(a => a.startsWith('--years='))?.slice(8) || '2024,2025,2026').split(','), TMP = mkdtempSync(join(tmpdir(), '24h-'));
  const out = [];
  for (const year of years) {
    const list = await get(`${SITE}/Results/organisator/${year}/race/null?evenement=24H+Series`) || '';
    const events = [...new Set([...list.matchAll(/href="([^"]*evenement=24H\+Series&(?:amp;)?race=[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&')))];
    for (const href of events) {
      const event = decodeURIComponent(href.split('race=')[1].replace(/\+/g, ' ')), page = await get(new URL(href, SITE).href) || '';
      const pdfs = [...new Set([...page.matchAll(/href="(https:\/\/resultscdn\.getraceresults\.com\/[^"]+\.pdf)"/g)].map(m => m[1]))];
      let n = 0;
      for (const lt of pdfs.filter(u => /%20-%20laptimes\.pdf$/i.test(u))) {
        const name = decodeURIComponent(lt.split('/').pop()).replace(/ - laptimes\.pdf$/i, ''), session = name.split(' - ').slice(1).join(' - ') || name;  // drop the series prefix ("24H SERIES powered by Hankook - Free Practice")
        if (/Creventic Track Days/i.test(name) || /hour|half ?way/i.test(session)) continue;  // open track days; partial race reports repeat the race
        const lb = await get(lt, true), rb = await get(lt.replace(/%20-%20laptimes\.pdf$/i, '.pdf'), true); if (!lb) continue;
        const rows = carRows(pdfText(lb, TMP), rb ? pdfText(rb, TMP) : '', sessionKind(session));
        const bad = rows.filter(r => r.officialBest != null && Math.abs(r.lapBest - r.officialBest) > 0.0005).length, del = rows.reduce((a, r) => a + r.deleted, 0), count = rows.filter(r => r.laps !== r.lapsListed).length;
        for (const r of rows) out.push({series: '24h-series', season: +year, event, session, kind: sessionKind(session), ...r});
        const ex = rows.filter(r => r.officialBest != null && Math.abs(r.lapBest - r.officialBest) > 0.0005).slice(0, 3).map(r => `#${r.car} ${r.lapBest}/${r.officialBest}`).join(' ');
        const d1 = rows.find(r => r.deleted); console.log(`${year} ${event} ${session}: ${rows.length} cars${d1 ? ` [#${d1.car} official ${d1.officialBest}, dropped ${d1.deleted}, quickest dropped ${d1.quickestDropped}, laps ${d1.laps}/${d1.lapsListed}]` : ''}, lap count != listed ${count}, deleted laps ${del}, official fastest missing from the lap file ${bad}${ex ? ' (' + ex + ')' : ''}`); n++;
      }
      if (!n) console.log(`${year} ${event}: no lap-time files`);
    }
  }
  writeFileSync('scripts/sim/data/learn/24h-laps.json.gz', gzipSync(JSON.stringify({
    source: 'Time Service B.V. results for the 24H Series (getraceresults.com, resultscdn.getraceresults.com PDFs). Derived numbers only, one row per car and session; the PDFs are not stored.',
    fields: 'best = official fastest lap (session result), else quickest listed lap; deleted = listed laps quicker than the official fastest (removed by officials, dropped); lapBest = quickest kept lap; cleanMedian = median of kept laps within 107% of best; drivers = best and laps per driver',
    fetched: new Date().toISOString().slice(0, 10), rows: out})));
  console.log('rows', out.length);
}
