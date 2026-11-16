// Driver ratings, part 3 (task P1c/P1d): the official SRO entry-list PDFs print the category of every driver at that meeting
// (GT World Challenge Europe / America / Asia / Australia, British GT "GRADE", IGTC). They sit on each meeting's noticeboard
// (/noticeboard?meeting_id=<id>), event page (/event/<id>/x), or are linked from the site's news articles (event previews:
// "Provisional entry list: ..."). Runs in GitHub Actions (network, poppler).
// Raw texts go to .cache/sro-entry-pdfs (uploaded as a workflow artifact, never committed: physics rule 2.9); the derived table
// scripts/sim/data/learn/sro-entry-ratings.json keeps per meeting and car the drivers' printed categories (parseEntryText, sro-entry-parse.mjs;
// a change to the parser needs a change here too, so the workflow reruns this script; parser rev 6, crawl rev 5).
import {writeFileSync, mkdirSync, mkdtempSync, readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseEntryText} from './sro-entry-parse.mjs';
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}}, TMP = mkdtempSync(join(tmpdir(), 'sro-ep-')), CACHE = '.cache/sro-entry-pdfs';
mkdirSync(CACHE, {recursive: true});
const get = async (u, bin) => { for (let i = 0; i < 2; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(45000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 1000)); } return null; };
const dec = s => { try { return decodeURIComponent(s); } catch { return s; } };
const clean = t => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const SITES = ['https://www.gt-world-challenge-europe.com', 'https://www.gt-world-challenge-america.com', 'https://www.gt-world-challenge-asia.com',
  'https://www.gt-world-challenge-australia.com', 'https://www.britishgt.com', 'https://www.intercontinentalgtchallenge.com'];
const MAXID = +(process.env.SRO_MAXID || 320), MAXNEWS = +(process.env.SRO_MAXNEWS || 400);
const pool = async (items, n, f) => { const out = []; let i = 0; await Promise.all(Array.from({length: n}, async () => { while (i < items.length) { const k = i++; try { out[k] = await f(items[k]); } catch (e) { console.log('skip', items[k], e.message); } } })); return out; };
const OUT = 'scripts/sim/data/learn/sro-entry-ratings.json', PARSER = 6, FULL = !!process.env.SRO_FULL || !existsSync(OUT) || JSON.parse(readFileSync(OUT, 'utf8')).parser !== PARSER; // a new parser re-reads every PDF
const meetings = [], log = [], seen = new Set(), dbg = Object.fromEntries(SITES.map(x => [x, 0]));
// incremental run (default once the table exists): keep the meetings read before, add only the archive and results-page sources below
if (!FULL) { const old = JSON.parse(readFileSync(OUT, 'utf8')); for (const m of old.meetings) { meetings.push(m); for (const d of m.docs) seen.add(d.url); } log.push(...(old.log || []).filter(l => !/archive|results pages/.test(l))); }
const ENTRY = (name, text) => /entry|entries|engag/i.test(name + ' ' + text) && !/spotter|timetable|regulation|bulletin|decision/i.test(name + ' ' + text);
const pdfLinks = (p, out) => { for (const m of p.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) { const text = clean(m[2]), name = dec(m[1].split('/').pop()); if (ENTRY(name, text)) out.set(m[1], text || name); } };
// a 4-digit year, else a dd.mm.yy date ("05.05.25"), in the file name, link text or first lines of the PDF
const yearOf = s => { const y = (s.match(/20(1[2-9]|2[0-7])/g) || []).sort((a, b) => s.split(b).length - s.split(a).length)[0]; if (y) return +y; const d = s.match(/\b\d{1,2}[.\/-]\d{1,2}[.\/-](1[2-9]|2[0-7])\b/); return d ? 2000 + +d[1] : null; };
async function readDocs(site, id, title, pdfs) {
  const docs = [];
  for (const [href, text] of pdfs) {
    const url = href.startsWith('http') ? href : site + (href.startsWith('/') ? '' : '/') + href; if (seen.has(url)) continue; seen.add(url);
    let u2 = url; try { u2 = encodeURI(decodeURI(url)); } catch {} const buf = await get(u2, true);
    if (!buf || buf.subarray(0, 4).toString() !== '%PDF') continue;
    const f = join(TMP, `${String(id).replace(/\W/g, '')}-${docs.length}.pdf`); writeFileSync(f, buf); let txt = '';
    try { txt = execFileSync('pdftotext', ['-layout', f, '-'], {maxBuffer: 1 << 26}).toString(); } catch { continue; }
    const key = `${site.replace(/^https:\/\/www\./, '')}-${id}-${docs.length}`; writeFileSync(join(CACHE, key + '.txt'), `URL ${url}\nTITLE ${title}\nLINK ${text}\n\n` + txt);
    const head = txt.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 8).join(' | ').slice(0, 400), name = dec(url.split('/').pop());
    const yr = yearOf(name + ' ' + text + ' ' + head), cars = parseEntryText(txt);
    if (cars.length < 3 && dbg[site] < 6) { dbg[site]++; console.log(`::group::unparsed ${url}`); console.log(txt.split('\n').filter(l => /\d/.test(l) && l.trim()).slice(0, 14).map(l => l.slice(0, 200)).join('\n')); console.log('::endgroup::'); }
    docs.push({url, link: text, year: yr, head, cars});
  }
  return docs;
}
for (const site of FULL ? SITES : []) {
  let found = 0, news = 0;
  // 1. noticeboard and event page of every meeting id
  await pool(Array.from({length: MAXID}, (_, i) => i + 1), 8, async id => {
    const ev = await get(`${site}/event/${id}/x`), pages = [ev, await get(`${site}/noticeboard?meeting_id=${id}`)].filter(Boolean);
    const pdfs = new Map(), title = clean(ev?.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
    for (const p of pages) pdfLinks(p, pdfs);
    if (!pdfs.size) return;
    const docs = await readDocs(site, id, title, pdfs);
    if (docs.length) { meetings.push({site: site.replace(/^https:\/\/www\./, ''), id, title, docs}); found++; }
  });
  // 2. news articles that link an entry list (event previews), found through the news index pages
  const arts = new Set();
  for (let p = 1; p <= MAXNEWS; p++) { const t = await get(`${site}/news?page=${p}`); if (!t) break; const before = arts.size;
    for (const m of t.matchAll(/href="((?:https?:\/\/[^"]+)?\/news\/\d+\/[^"]+)"/g)) arts.add(m[1].replace(/^https?:\/\/[^/]+/, ''));
    if (arts.size === before) break; }
  // no paged index: every article id (the slug is not needed, as for /event/<id>/x)
  if (arts.size < 50) for (let i = 1; i <= +(process.env.SRO_MAXNEWSID || 2500); i++) arts.add(`/news/${i}/x`);
  await pool([...arts], 8, async a => { const t = await get(site + a); if (!t) return; const pdfs = new Map(); pdfLinks(t, pdfs); if (!pdfs.size) return;
    const title = clean(t.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''), docs = await readDocs(site, 'news' + a.split('/')[2], title, pdfs);
    if (docs.length) { meetings.push({site: site.replace(/^https:\/\/www\./, ''), id: 'news' + a.split('/')[2], title, docs}); news++; } });
  log.push(`${site}: ${found} meetings and ${news} news articles with entry-list PDFs (${arts.size} articles read)`); console.log(log.at(-1));
}
// 3. older entry lists (2013-2020) are stored under /images/results/<meeting id>/ and linked from the results pages of the season,
// not from the noticeboard: (a) every results page of every season, (b) the Internet Archive index of /images/results/ on the site and on
// the series' earlier domains (the PDF is read from the site, else from its archived copy). P1e.
const OLD = {'https://www.gt-world-challenge-europe.com': ['www.blancpain-gt-series.com', 'www.blancpain-endurance-series.com', 'www.blancpain-sprint-series.com'],
  'https://www.gt-world-challenge-asia.com': ['www.blancpain-gt-series-asia.com', 'www.gt-asia.com'], 'https://www.gt-world-challenge-america.com': ['www.world-challenge.com'],
  'https://www.gt-world-challenge-australia.com': [], 'https://www.britishgt.com': [], 'https://www.intercontinentalgtchallenge.com': []};
for (const site of SITES) {
  const before = meetings.length, idx = await get(`${site}/results`) || '', years = [...new Set([...idx.matchAll(/\/results\/(20\d\d)\//g)].map(m => +m[1]))];
  for (let y = 2012; y <= 2026; y++) years.includes(y) || years.push(y);
  const pages = new Set();
  for (const y of years) { const t = await get(`${site}/results/${y}`) || ''; for (const m of t.matchAll(/href="((?:https?:\/\/[^"]+)?\/results\/\d{4}\/[^"?#]+)"/g)) pages.add(m[1].replace(/^https?:\/\/[^/]+/, '')); }
  await pool([...pages], 6, async pg => { const t = await get(site + pg); if (!t) return; const pdfs = new Map(); pdfLinks(t, pdfs); if (!pdfs.size) return;
    const title = clean(t.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''), id = 'results' + pg.replace(/\W+/g, '-'), docs = await readDocs(site, id, title, pdfs);
    if (docs.length) meetings.push({site: site.replace(/^https:\/\/www\./, ''), id, title, docs}); });
  const n1 = meetings.length - before, arch = new Map();
  for (const host of [site.replace(/^https:\/\//, ''), ...OLD[site]]) {
    const t = await get(`https://web.archive.org/cdx/search/cdx?url=${host}/images/&matchType=prefix&output=json&filter=statuscode:200&collapse=urlkey&limit=20000&filter=original:.*\\.pdf.*`);
    try { for (const [, ts, orig] of JSON.parse(t || '[]').slice(1)) { const name = dec(orig.split('/').pop()); if (ENTRY(name, '')) arch.set(orig.replace(/^https?:\/\/[^/]+/, '').replace(/:80\//, '/'), {ts, orig}); } } catch {} }
  // group by meeting id folder; each PDF is read from the live site, else from the archive
  const byId = new Map(); for (const [path, a] of arch) { const id = path.match(/\/results\/(\d+)\//)?.[1] || 'x'; (byId.get(id) || byId.set(id, []).get(id)).push([path, a]); }
  await pool([...byId], 4, async ([id, list]) => { const pdfs = new Map(), docs = [];
    for (const [path, a] of list) { if (seen.has(site + path)) continue; const live = await get(site + path, true);
      pdfs.set(live && live.subarray(0, 4).toString() === '%PDF' ? site + path : `https://web.archive.org/web/${a.ts}id_/${a.orig}`, dec(path.split('/').pop())); }
    docs.push(...await readDocs(site, 'archive-' + id, '', pdfs));
    if (docs.length) meetings.push({site: site.replace(/^https:\/\/www\./, ''), id: 'archive-' + id, title: '', docs}); });
  log.push(`${site}: ${pages.size} results pages (${n1} with entry-list PDFs), ${arch.size} archived entry-list PDFs in ${byId.size} folders (${meetings.length - before - n1} read)`); console.log(log.at(-1));
}
meetings.sort((a, b) => a.site.localeCompare(b.site) || String(a.id).localeCompare(String(b.id), 'en', {numeric: true}));
writeFileSync(OUT, JSON.stringify({generated: new Date().toISOString().slice(0, 10), parser: PARSER,
  note: 'Official SRO entry-list PDFs (noticeboard / event page of each meeting, and entry lists linked from the site news): per car the drivers with the category printed beside them (P/G/S/B). Built by fetch-sro-entry-pdfs.mjs + sro-entry-parse.mjs.', log, meetings}));
