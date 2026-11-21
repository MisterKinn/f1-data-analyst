// F2 and F3 best laps per driver and session from the FIA classification documents (fia.com decision documents; owner approved
// 2026-11-21 although the PDFs say "no reproduction": nothing from the PDFs is stored or shown as a document, only derived numbers).
// One row per driver and session in scripts/sim/data/learn/f2f3-laps.json.gz:
//   practice / qualifying: best lap, laps, km/h;  race: laps, best lap and the lap it was set on, km/h, status (classified / DNF ...)
// For each session the newest version is used: final > amended > plain > provisional.
//   node scripts/sim/learn/fetch-f2f3.mjs [--years=2024,2025,2026]
import {writeFileSync, readFileSync, existsSync} from 'node:fs';
import {gzipSync, gunzipSync} from 'node:zlib';
import {parseDocuments, fiaDocumentText} from '../../../worker/fia.js';

export const CHAMPS = {f2: '/documents/championships/fia-formula-2-championship-44', f3: '/documents/championships/fia-formula-3-championship-1012'};
const ROOT = 'https://www.fia.com';
const TIME = /^\d{1,2}:\d{2}\.\d{3}$/, SPEED = /^\d{2,3}\.\d{3}$/;
export const secs = t => +String(t).split(":").map(Number).reduce((a, x) => a * 60 + x, 0).toFixed(3);
export const kindOf = s => /race|sprint|feature/i.test(s) ? 'race' : /qualif/i.test(s) ? 'qualifying' : 'practice';
const RANK = {final: 3, amended: 2, '': 1, provisional: 0};

// "Doc 59 - F2 Qualifying 2 - final classification" -> {session: 'Qualifying 2', version: 'final'}; null for anything else
export function sessionOf(title) {
  const m = /^(?:Doc\s*\d+\s*-\s*)?(?:F[23]\s+)?(.+?)\s*-\s*(final|provisional|amended)?\s*classification\s*$/i.exec(String(title).trim());
  if (!m || /championship|grid|lap time/i.test(m[1])) return null;
  return {session: m[1].trim(), version: (m[2] || '').toLowerCase()};
}
export function pickDocs(docs) {
  const best = new Map();
  for (const d of docs) { const s = sessionOf(d.title); if (!s || d.recalled || !d.url) continue; const o = best.get(s.session);
    if (!o || RANK[s.version] > RANK[o.version] || (RANK[s.version] === RANK[o.version] && +d.document_number > +o.document_number)) best.set(s.session, {...s, url: d.url, document_number: d.document_number}); }
  return [...best.values()];
}

// rows of a classification page as the FIA reader joins them ("1 | 15 | Alexander DUNNE | Rodin Motorsport | 1:55.383 | 8 | ...")
export function classificationRows(text, kind) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const t = line.split(' | ').map(s => s.trim()), i = /^\d+$/.test(t[1]) && /[A-Za-z]/.test(t[2] || '') ? 1 : 0;
    if (!/^\d+$/.test(t[i]) || !/[A-Za-z]/.test(t[i + 1] || '') || !/[A-Za-z]/.test(t[i + 2] || '')) continue;
    const pos = i ? +t[0] : null, car = t[i], driver = t[i + 1].replace(/\s*\*$/, ''), team = t[i + 2], rest = t.slice(i + 3);
    if (kind === 'race') {
      if (!/^\d+$/.test(rest[0] || '')) continue;
      const s = rest.findIndex((x, j) => SPEED.test(x) && TIME.test(rest[j + 1] || '')), best = s >= 0 ? secs(rest[s + 1]) : null;  // km/h, then the fastest lap (gaps can look like speeds)
      out.push({pos, car, driver, team, laps: +rest[0], best, bestLap: best != null && /^\d+$/.test(rest[s + 2] || '') ? +rest[s + 2] : null,
        kph: s >= 0 ? +rest[s] : +rest.find(x => SPEED.test(x) && +x > 100) || null, status: pos ? 'classified' : (rest.find(x => /^(DNF|DNS|DSQ|NC)$/.test(x)) || 'not classified')});
    } else {
      if (!TIME.test(rest[0] || '')) continue;
      out.push({pos, car, driver, team, best: secs(rest[0]), laps: /^\d+$/.test(rest[1] || '') ? +rest[1] : null, kph: +rest.filter(x => SPEED.test(x)).at(-1) || null});  // last speed-shaped value; the % column comes before it
    }
  }
  return out;
}
// the race documents also print the overall fastest lap: a parity check for the rows
export const overallFastest = text => { const m = /OVERALL FASTEST LAP\n[^\n]*?\|\s*(\d{1,2}:\d{2}\.\d{3})/.exec(text); return m ? secs(m[1]) : null; };

// fia.com throttles a burst (the first run lost every request after ~100 documents): one request per ~1.2 s, retries after 5 and 20 s; 6 failures in a row stop the run (data so far is kept)
const wait = ms => new Promise(r => setTimeout(r, ms));
let last = 0;
async function paced(fn) {
  let error;
  for (const backoff of [0, 5000, 20000]) {
    await wait(Math.max(backoff, last + 1200 - Date.now())); last = Date.now();
    try { return await fn(); } catch (e) { error = e; }
  }
  throw error;
}
const html = path => paced(async () => { const r = await fetch(new URL(path, ROOT), {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}, signal: AbortSignal.timeout(45000)}); if (!r.ok) throw Error('HTTP ' + r.status + ' ' + path); return r.text(); });
const opts = (h, re) => [...h.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)</g)].map(m => ({url: m[1].replace(/&amp;/g, '&'), label: m[2].trim()})).filter(o => re.test(o.url));

// keep what earlier runs read: a session whose newest document was already read is reused, not fetched again
export function reuse(rows) {
  const m = new Map();
  for (const r of rows || []) { const k = [r.series, r.season, r.event, r.session].join('|'); (m.get(k) || m.set(k, {document: r.document, rows: []}).get(k)).rows.push(r); }
  return m;
}

if (process.argv[1]?.endsWith('fetch-f2f3.mjs')) {
  const FILE = 'scripts/sim/data/learn/f2f3-laps.json.gz';
  const years = (process.argv.find(a => a.startsWith('--years='))?.slice(8) || '2024,2025,2026').split(',');
  const old = reuse(existsSync(FILE) ? JSON.parse(gunzipSync(readFileSync(FILE))).rows : []), seen = new Set();
  const out = [], t0 = Date.now(), BUDGET = 70 * 60e3;  // stop new reads after 70 min; the rest waits for the next run
  let fails = 0, stopped = '';
  const say = m => console.log(m);
  const step = async (what, fn) => {
    if (stopped) return null;
    if (Date.now() - t0 > BUDGET) { stopped = 'time budget used'; return null; }
    try { const r = await fn(); fails = 0; return r; }
    catch (e) { say(`${what}: failed (${String(e.message).slice(0, 80)})`); if (++fails >= 6) stopped = 'fia.com stopped answering (6 failures in a row)'; return null; }
  };
  for (const [series, path] of Object.entries(CHAMPS)) {
    const seasons = opts(await step(series + ' index', () => html(path)) || '', /\/season\//).filter(o => years.some(y => o.label.endsWith(y)));
    for (const season of seasons) {
      const year = +season.label.slice(-4), events = opts(await step(`${series} ${year}`, () => html(season.url)) || '', /\/event\//);
      say(`${series} ${year}: ${events.length} events`);
      for (const ev of events) {
        const page = await step(`${series} ${year} ${ev.label}`, () => html(ev.url));
        for (const d of pickDocs(parseDocuments(page || '', ROOT + ev.url))) {
          const key = [series, year, ev.label, d.session].join('|'), was = old.get(key); seen.add(key);
          const row = r => ({series, season: year, event: ev.label, session: d.session, kind: kindOf(d.session), version: d.version || 'plain', document: d.document_number, ...r});
          if (was && was.document === d.document_number) { out.push(...was.rows); continue; }
          const text = await step(`${series} ${year} ${ev.label} ${d.session}`, () => paced(() => fiaDocumentText(d.url, 4)));
          if (text == null) { if (was) out.push(...was.rows); continue; }
          const kind = kindOf(d.session), rows = classificationRows(text, kind), fastest = kind === 'race' ? overallFastest(text) : null;
          const check = fastest == null ? '' : Math.abs(Math.min(...rows.map(r => r.best).filter(Number.isFinite)) - fastest) < 0.0005 ? ' fastest ok' : ' fastest ✗';
          out.push(...rows.map(row));
          say(`${series} ${year} ${ev.label} ${d.session} (${d.version || 'plain'}): ${rows.length} drivers${check}`);
        }
      }
    }
  }
  for (const [k, v] of old) if (!seen.has(k)) out.push(...v.rows);  // sessions not listed this time (page failed) stay
  writeFileSync(FILE, gzipSync(JSON.stringify({
    source: 'FIA F2 / F3 classification documents (fia.com decision documents). Derived numbers only, one row per driver and session; the documents are not stored or reproduced.',
    fields: 'best = best lap (s); race rows also bestLap (lap number), laps, status; kph = speed listed by the timekeeper',
    fetched: new Date().toISOString().slice(0, 10), rows: out})));
  if (stopped) say(`stopped early: ${stopped}; the next run continues from here`);
  say(`rows ${out.length}, sessions ${new Set(out.map(r => [r.series, r.season, r.event, r.session].join('|'))).size}`);
}
