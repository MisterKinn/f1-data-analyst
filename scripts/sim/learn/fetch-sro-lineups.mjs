// Driver ratings, part 2 (task P1b): who drove each SRO car, and the FIA category of those drivers. Runs in GitHub Actions (network, poppler).
// 1. SRO entry lists (GT World Challenge Europe / America / Asia / Australia, British GT, Intercontinental GT Challenge): the
//    /entry-lists index of every season -> /entry-list/<year>/<meeting> pages -> car number, team, car, cup, driver names.
// 2. FIA Driver Categorisation public list PDFs: the category and next category are printed as medal images (S silver, B bronze,
//    G gold, P platinum), not text. Each row is read at the column of the "Category" / "Next Category" headers: the page is rendered
//    at 72 dpi (pdftoppm) and the medal colour at the row is matched to the four medals (reference colours measured from the list's
//    own images, 2026-11-16). Only drivers named in a line-up are written (no copy of the whole list).
// Output (derived tables): scripts/sim/data/learn/sro-lineups.json.gz, scripts/sim/data/learn/fia-categorisation.json
import {writeFileSync, readFileSync, mkdtempSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}}, TMP = mkdtempSync(join(tmpdir(), 'sro-lu-'));
const get = async (u, bin) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 1500)); } return null; };
const clean = t => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&([a-z])(acute|grave|uml|circ|tilde|cedil|ring|slash);/gi, '$1').replace(/\s+/g, ' ').trim();
const abs = (site, h) => h.startsWith('http') ? h : site + (h.startsWith('/') ? '' : '/') + h;
const links = (t, re) => [...new Set([...t.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => re.test(h)))];

// ---- 1. SRO entry lists ----
const SITES = ['https://www.gt-world-challenge-europe.com', 'https://www.gt-world-challenge-america.com', 'https://www.gt-world-challenge-asia.com',
  'https://www.gt-world-challenge-australia.com', 'https://www.britishgt.com', 'https://www.intercontinentalgtchallenge.com'];
const lineups = [], log = [];
for (const site of SITES) {
  const idx = await get(site + '/entry-lists') || '';
  const sel = idx.match(/<select[^>]*season[^>]*>([\s\S]*?)<\/select>/i)?.[1] || '';
  const seasons = [...sel.matchAll(/value="([^"]+)"[^>]*>\s*(\d{4})/g)].map(m => [m[1], +m[2]]).filter(([, y]) => y >= 2013 && y <= 2026);
  const name = idx.match(/<select[^>]*name="([^"]*season[^"]*)"/i)?.[1] || 'filter_season_id';
  const pages = new Set(links(idx, /entry-list\//));
  for (const [v] of seasons) { const t = await get(`${site}/entry-lists?${name}=${encodeURIComponent(v)}`) || ''; for (const h of links(t, /entry-list\//)) pages.add(h); }
  let n = 0;
  for (const h of pages) {
    const u = abs(site, h), m = /entry-list\/(\d{4})\/([^/?#]+)/.exec(decodeURIComponent(u)); if (!m) continue;
    const page = await get(u); if (!page) continue;
    const title = clean(page.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''), tables = page.match(/<table[\s\S]*?<\/table>/g) || [];
    for (const tab of tables) {
      const rows = [...tab.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(r => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => c[1]));
      const head = (rows.shift() || []).map(c => clean(c).toLowerCase()); if (!head.some(c => /driver/.test(c))) continue;
      const col = re => head.findIndex(c => re.test(c));
      for (const r of rows) { if (r.length < 3) continue;
        const drivers = head.map((c, i) => /driver/.test(c) ? r[i] : null).filter(Boolean).flatMap(c => { const sp = [...c.matchAll(/table__text">([\s\S]*?)<\/span>/g)].map(x => clean(x[1])); return sp.length ? sp : clean(c).split(/\s*\/\s*/); }).filter(x => x && !/^(tba|tbc|-)$/i.test(x));
        lineups.push({site: site.replace(/^https:\/\/www\./, ''), year: +m[1], meeting: m[2], title, url: u, car: clean(r[col(/car ?#|^no|number/)] || ''), team: clean(r[col(/team/)] || ''),
          vehicle: clean(r[col(/^car$|vehicle|model/)] || ''), cls: clean(r[col(/class|cup|cat/)] || ''), drivers}); n++; } }
  }
  log.push(`${site}: ${seasons.length} seasons, ${pages.size} entry-list pages, ${n} cars`);
}
writeFileSync('scripts/sim/data/learn/sro-lineups.json.gz', gzipSync(JSON.stringify({generated: new Date().toISOString().slice(0, 10), source: 'SRO entry-list pages (/entry-list/<year>/<meeting>) of ' + SITES.join(', '), log, lineups}), {level: 9}));
console.log(log.join('\n'));

// ---- 2. FIA public list PDFs ----
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
const key = s => fold(s).split(' ').sort().join(' ');
const known = new Set(lineups.flatMap(l => l.drivers).map(key));
if (existsSync('scripts/sim/data/learn/driver-ratings.json')) for (const p of Object.values(JSON.parse(readFileSync('scripts/sim/data/learn/driver-ratings.json', 'utf8')).drivers)) known.add(key(p.name));
// Public list PDFs (official FIA document; copies hosted by the press when fia.com has removed them). The list year and print time are
// read from the PDF itself ("FIA Driver Categorisation – 2024 List", "2024-10-09 06:00:01"); a URL that does not answer is skipped.
const LISTS = ['https://www.fia.com/sites/default/files/fia_2024_reviewed_categorisations_list_0.pdf',
  'https://www.endurance-info.com/sites/default/files/2026-01/Liste%20FIA%202026.pdf',
  'https://sportscar365.com/wp-content/uploads/2024/10/public-drivers-list-2024.pdf',
  'https://www.endurance-info.com/sites/default/files/2024-10/Cat%C3%A9gorisation%20FIA%20des%20pilotes.pdf',
  'https://www.endurance-info.com/sites/default/files/2025-09/Liste%20FIA%20Septembre%202025.pdf',
  'https://cdn-image.as-web.jp/2022/10/10141402/asimg_public-drivers-list-2022-1_compressed_ba6343aa1ad6332.pdf',
  'https://www.endurance-info.com/sites/default/files/2021-10/public-drivers-list-2021.pdf',
  ...[2019, 2020, 2021, 2022, 2023, 2025].flatMap(y => [9, 10, 11, 12].map(m => `https://sportscar365.com/wp-content/uploads/${y}/${String(m).padStart(2, '0')}/public-drivers-list-${y}.pdf`))];
const ARTICLES = ['https://www.endurance-info.com/auto/article/117908-la-premiere-liste-fia-de-categorisation-des-pilotes-2026-publiee'];
for (const a of ARTICLES) { const t = await get(a); for (const h of links(t || '', /\.pdf$/i)) LISTS.push(abs('https://www.endurance-info.com', h)); }
// Older lists (2015-2020) are no longer on fia.com: their archived copies (Internet Archive, original FIA URL kept as the source)
const ARCH = []; for (const [u, f] of [['driverscategorisation.fia.com/assets/files/', ''], ['fia.com/sites/default/files/', '&filter=original:.*(categoris|drivers?.?list).*']]) {
  const t = await get(`https://web.archive.org/cdx/search/cdx?url=${u}&matchType=prefix&output=json&from=2014&to=2021&filter=statuscode:200&filter=mimetype:application/pdf&collapse=digest&limit=3000${f}`);
  try { for (const [ts, orig] of JSON.parse(t || '[]').slice(1).map(r => [r[1], r[2]])) if (/categori|list/i.test(orig)) ARCH.push({url: `https://web.archive.org/web/${ts}id_/${orig}`, orig, ts}); } catch {}
}
console.log('archived list candidates', ARCH.length); for (const a of ARCH.slice(0, 40)) LISTS.push(a.url);
const REF = {S: [195, 206, 213], B: [198, 152, 103], G: [241, 196, 4], P: [153, 144, 147]};
const medal = ([r, g, b]) => { if (r > 235 && g > 235 && b > 235) return null; let best = null, d0 = Infinity; for (const [k, c] of Object.entries(REF)) { const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2; if (d < d0) { d0 = d; best = k; } } return d0 < 2500 ? best : '?'; };
const fia = {generated: new Date().toISOString().slice(0, 10), note: 'FIA Driver Categorisation public lists: category and next category read from the medal images (P/G/S/B). Only drivers named in a Kongboda line-up are kept.', lists: []};
const T0 = f => execFileSync('pdftotext', ['-layout', '-l', '1', f, '-']).toString().split('\n').filter(l => l.trim()).slice(0, 12).join('\n');
const seen = new Set();
for (const url of new Set(LISTS)) {
  const buf = await get(url, true); if (!buf || buf.subarray(0, 4).toString() !== '%PDF') continue;
  const pdf = join(TMP, 'list.pdf'); writeFileSync(pdf, buf);
  const pages = +(execFileSync('pdfinfo', [pdf]).toString().match(/Pages:\s+(\d+)/)?.[1] || 0), rows = [], stat = {S: 0, B: 0, G: 0, P: 0, '?': 0, none: 0}, probe = [];
  const head = execFileSync('pdftotext', ['-l', '1', pdf, '-']).toString(), stamp = head.match(/(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/)?.[1] || null,
    year = head.match(/Categori[sz]ation\s*[–-]\s*(\d{4}) List/)?.[1] || head.match(/Categori[sz]ation\s+(\d{4})/)?.[1] || head.match(/(\d{4})\s+(?:Drivers?'?\s+)?Categori[sz]ation/i)?.[1];
  if (!year || seen.has(year + stamp)) { console.log('skip', url, year, stamp); continue; } seen.add(year + stamp); const label = `${year} List (${(stamp || '').slice(0, 10)})`;
  for (let p = 1; p <= pages; p++) {
    const xml = execFileSync('pdftohtml', ['-xml', '-i', '-zoom', '1', '-f', String(p), '-l', String(p), '-stdout', pdf]).toString();
    const T = [...xml.matchAll(/<text top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)"[^>]*>([\s\S]*?)<\/text>/g)].map(m => ({top: +m[1], left: +m[2], w: +m[3], h: +m[4], s: clean(m[5])}));
    const hd = re => T.find(t => re.test(t.s)), cat = hd(/^(Category|Categori[sz]ation( \d{4})?)$/i), next = hd(/^Next Category$/), ln = hd(/^(Last ?name|Surname|Name)/i), fn = hd(/^First ?name/i), nat = hd(/^Nationality/) || cat, eff = hd(/next categorisation|^Effective date/);
    if (!cat || !ln || !fn) continue;
    execFileSync('pdftoppm', ['-r', '72', '-f', String(p), '-l', String(p), '-singlefile', pdf, join(TMP, 'pg')]);
    const ppm = readFileSync(join(TMP, 'pg.ppm')), hdr = ppm.toString('latin1', 0, 40).match(/^P6\s+(\d+)\s+(\d+)\s+255\s/), W = +hdr[1], off = hdr[0].length;
    const px = (x, y) => { const s = [0, 0, 0]; let n = 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const i = off + ((Math.round(y) + dy) * W + Math.round(x) + dx) * 3; s[0] += ppm[i]; s[1] += ppm[i + 1]; s[2] += ppm[i + 2]; n++; } return s.map(v => v / n); };
    const mid = h => h.left + h.w / 2;
    const lines = new Map(); for (const t of T.filter(t => t.top > cat.top + cat.h)) { const k = [...lines.keys()].find(y => Math.abs(y - t.top) <= 3) ?? t.top; (lines.get(k) || lines.set(k, []).get(k)).push(t); }
    for (const [y, ts] of lines) {
      const col = (a, b) => ts.filter(t => mid(t) >= a && mid(t) < b).map(t => t.s).join(' ');
      const last = col(0, fn.left - 5), first = col(fn.left - 5, nat.left - 10); if (!last || /FIA Driver Categorisation|Page \d|^\d{4}-\d\d/.test(last)) continue;
      // a list that prints the category as a word (older lists) is read as text; the others by the medal image
      const word = col(cat.left - 30, cat.left + cat.w + 60).match(/\b(Platinum|Platinium|Gold|Silver|Bronze)\b/i)?.[1];
      const cy = y + ts[0].h / 2, c = word ? {platinum: 'P', platinium: 'P', gold: 'G', silver: 'S', bronze: 'B'}[word.toLowerCase()] : medal(px(mid(cat) - 5, cy)), nx = next ? medal(px(mid(next) - 5, cy)) : null, date = eff ? col(eff.left - 30, 1e9) : '';
      if (probe.length < 12) probe.push({last, first, rgb: px(mid(cat) - 5, cy).map(Math.round), c, nx});
      stat[c ?? 'none']++;
      if (known.has(key(`${first} ${last}`))) rows.push({last, first, category: c, next: nx, nextFrom: /\d{4}/.test(date) ? date : undefined, page: p});
    }
  }
  fia.lists.push({url, label, stamp, pages, medals: stat, probe, drivers: rows});
  if (!rows.length) console.log('no rows read', url, T0(pdf));
  console.log(label, pages, 'pages', JSON.stringify(stat), 'kept', rows.length);
}
writeFileSync('scripts/sim/data/learn/fia-categorisation.json', JSON.stringify(fia));
