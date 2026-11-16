// Driver ratings, part 3 (task P1c): the official SRO entry-list PDFs print the category of every driver at that meeting
// (GT World Challenge Europe / America / Asia / Australia, British GT "GRADE", IGTC). They sit on each meeting's noticeboard
// (/noticeboard?meeting_id=<id>) or event page (/event/<id>/x). Runs in GitHub Actions (network, poppler).
// Raw texts go to .cache/sro-entry-pdfs (uploaded as a workflow artifact, never committed: physics rule 2.9); the derived table
// scripts/sim/data/learn/sro-entry-ratings.json keeps per meeting and car the drivers' printed categories (parseEntryText).
import {writeFileSync, mkdirSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseEntryText} from './sro-entry-parse.mjs';
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}}, TMP = mkdtempSync(join(tmpdir(), 'sro-ep-')), CACHE = '.cache/sro-entry-pdfs';
mkdirSync(CACHE, {recursive: true});
const get = async (u, bin) => { for (let i = 0; i < 2; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(45000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 1000)); } return null; };
const clean = t => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const SITES = ['https://www.gt-world-challenge-europe.com', 'https://www.gt-world-challenge-america.com', 'https://www.gt-world-challenge-asia.com',
  'https://www.gt-world-challenge-australia.com', 'https://www.britishgt.com', 'https://www.intercontinentalgtchallenge.com'];
const MAXID = +(process.env.SRO_MAXID || 320);
const pool = async (items, n, f) => { const out = []; let i = 0; await Promise.all(Array.from({length: n}, async () => { while (i < items.length) { const k = i++; out[k] = await f(items[k]); } })); return out; };
const meetings = [], log = [];
for (const site of SITES) {
  let found = 0;
  await pool(Array.from({length: MAXID}, (_, i) => i + 1), 8, async id => {
    const pages = [await get(`${site}/noticeboard?meeting_id=${id}`), await get(`${site}/event/${id}/x`)].filter(Boolean);
    const pdfs = new Map(); let title = '';
    for (const p of pages) {
      title ||= clean(p.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '') || clean(p.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
      for (const m of p.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) { const href = m[1], text = clean(m[2]), name = decodeURIComponent(href.split('/').pop());
        if (/entry|entries|engag/i.test(name + ' ' + text) && !/spotter|timetable|regulation|bulletin|decision/i.test(name + ' ' + text)) pdfs.set(href, text || name); }
    }
    if (!pdfs.size) return;
    const docs = [];
    for (const [href, text] of pdfs) {
      const url = href.startsWith('http') ? href : site + (href.startsWith('/') ? '' : '/') + href, buf = await get(encodeURI(decodeURI(url)), true);
      if (!buf || buf.subarray(0, 4).toString() !== '%PDF') continue;
      const f = join(TMP, `${id}.pdf`); writeFileSync(f, buf); let txt = '';
      try { txt = execFileSync('pdftotext', ['-layout', f, '-'], {maxBuffer: 1 << 26}).toString(); } catch { continue; }
      const key = `${site.replace(/^https:\/\/www\./, '')}-${id}-${docs.length}`; writeFileSync(join(CACHE, key + '.txt'), `URL ${url}\nTITLE ${title}\nLINK ${text}\n\n` + txt);
      docs.push({url, link: text, cars: parseEntryText(txt)});
    }
    if (docs.length) { meetings.push({site: site.replace(/^https:\/\/www\./, ''), id, title, docs}); found++; }
  });
  log.push(`${site}: ${found} meetings with entry-list PDFs`); console.log(log.at(-1));
}
meetings.sort((a, b) => a.site.localeCompare(b.site) || a.id - b.id);
writeFileSync('scripts/sim/data/learn/sro-entry-ratings.json', JSON.stringify({generated: new Date().toISOString().slice(0, 10),
  note: 'Official SRO entry-list PDFs (noticeboard / event page of each meeting): per car the drivers with the category printed beside them (P/G/S/B). Built by fetch-sro-entry-pdfs.mjs + sro-entry-parse.mjs.', log, meetings}));
