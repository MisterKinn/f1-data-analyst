// Driver ratings, part 6 (task P1f): the FIA category each driver had in a season, as printed by the Al Kamel results of the ACO series
// in the seasons the local archive (tobi/imsa_data, 2021+) does not hold: WEC 2013-2020 (files.alkamelcloud.com manifests), ELMS
// 2013-2020, Asian Le Mans 2013-2021 and Michelin Le Mans Cup (all seasons; *.alkamelsystems.com result pages). Classification CSVs
// only ("03_Classification*.CSV"; DRIVERn_LICENSE or a category column). Writes scripts/sim/data/learn/alkamel-ratings.json.gz:
// one row per driver, season and printed value, with the first file that prints it. Raw files are not kept. Runs in GitHub Actions (rev 4).
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const get = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 800)); } return null; };
const pool = async (items, n, f) => { let i = 0; await Promise.all(Array.from({length: n}, async () => { while (i < items.length) { const k = i++; try { await f(items[k]); } catch (e) { console.log('skip', e.message); } } })); };
const log = [], rows = new Map(), headers = new Map();
// a CSV line split on ";" with quotes
const split = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ';' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o.map(x => x.trim()); };
function readCsv(series, url, txt) {
  const L = txt.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()); if (L.length < 2) return 0;
  const H = split(L[0]).map(h => h.toUpperCase()), year = +(/\/(20\d\d)\d{8}_/.exec(decodeURIComponent(url))?.[1] || /_(20\d\d)\//.exec(url)?.[1] || 0);
  if (!headers.has(series + year)) { headers.set(series + year, 1); console.log(`header ${series} ${year}: ${H.join(';').slice(0, 400)}`); }
  let n = 0;
  for (const l of L.slice(1)) { const c = split(l), v = k => { const i = H.indexOf(k); return i >= 0 ? c[i] : ''; };
    for (const i of ['1', '2', '3', '4', '5', '6', '']) {
      const first = v(`DRIVER${i}_FIRSTNAME`) || v(`DRIVER_${i}_FIRSTNAME`), last = v(`DRIVER${i}_SECONDNAME`) || v(`DRIVER_${i}_SECONDNAME`) || v(`DRIVER${i}_SURNAME`),
        full = first || last ? `${first} ${last}`.trim() : (v(`DRIVER_${i}`) || v(`DRIVER${i}`) || v(`DRIVER${i}_NAME`)),
        cat = v(`DRIVER${i}_LICENSE`) || v(`DRIVER_${i}_LICENSE`) || v(`DRIVER${i}_CATEGORY`) || v(`DRIVER_${i}_CATEGORY`) || v(`DRIVER${i}_RATING`);
      if (!full || !cat || !year) continue; const k = `${full}|${year}|${cat}`;
      if (!rows.has(k)) rows.set(k, {name: full, season: year, value: cat, series, url, date: (/\/(20\d{6})\d{4}_/.exec(decodeURIComponent(url))?.[1] || '').replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')}); n++; } }
  return n;
}
const isClass = u => /\/03_Classification[^/]*\.CSV$/i.test(decodeURIComponent(u));
async function readAll(series, urls) { let n = 0, files = 0; await pool(urls, 6, async u => { const t = await get(u); if (t) { files++; n += readCsv(series, u, t); } }); return {files, n}; }

// 1. WEC: manifests (season list, then one JSON per season with every published file)
{ const idx = await get('https://files.alkamelcloud.com/wec/manifests/results.json') || ''; console.log('wec index', idx.length, idx.slice(0, 300));
  const seasons = [...new Set([...idx.matchAll(/results_(\d\d_(20\d\d)(?:-\d{4})?)\.json/g)].filter(m => +m[2] >= 2013 && +m[2] <= 2020).map(m => m[1]))]
    .map(id => ({name: id, url: `https://files.alkamelcloud.com/wec/manifests/results_${id}.json`}));
  for (const s of seasons) {
    const m = await get(s.url); if (!m) { log.push(`wec ${s.name}: no manifest`); continue; } if (s === seasons[0]) console.log('manifest sample', m.slice(0, 600));
    // manifest leaves: {"url":"wec/results/04_2014/<event>/<series>/<session>/03_Classification_<session>.CSV"} on files.alkamelcloud.com
    const urls = [...new Set([...m.matchAll(/"url":"([^"]+?\.CSV)"/gi)].map(x => x[1].replace(/\\\//g, '/')).map(u => u.startsWith('http') ? u : `https://files.alkamelcloud.com/${u.replace(/^\//, '')}`).map(u => encodeURI(u)).filter(isClass))];
    const r = await readAll('wec', urls); log.push(`wec ${s.name}: ${urls.length} classification files, ${r.files} read, ${r.n} driver values`); console.log(log.at(-1)); } }

// 2. ELMS / Asian LMS / Le Mans Cup: <select name="season"> and <select name="evvent"> options; each event page (?season=&evvent=)
// lists that event's files as Results/<season>/<event>/... links
const opts = (t, name) => [...(new RegExp(`<select[^>]*name="${name}"[\\s\\S]*?</select>`, 'i').exec(t || '')?.[0] || '').matchAll(/value="([^"]+)"/gi)].map(m => m[1]);
for (const [series, host, from, to] of [['elms', 'https://elms.alkamelsystems.com', 2013, 2020], ['alms', 'https://asianlms.alkamelsystems.com', 2013, 2021], ['alms', 'https://alms.alkamelsystems.com', 2013, 2021], ['alms', 'https://asianlemansseries.alkamelsystems.com', 2013, 2021], ['lmc', 'https://lemanscup.alkamelsystems.com', 2013, 2026]]) {
  const root = await get(host + '/') || ''; let seasons = opts(root, 'season');
  if (!seasons.length) { const cur = /Results\/(\d\d)_(20\d\d)/.exec(root); if (cur) for (let y = from; y <= to; y++) seasons.push(`${String(+cur[1] - (+cur[2] - y)).padStart(2, '0')}_${y}`); }
  if (!seasons.length) { console.log(series, host, 'no season menu', root.length, (root.match(/<select[^>]*>/g) || []).join(' ')); continue; }
  seasons = seasons.filter(id => { const y = +(/(20\d\d)/.exec(id)?.[1] || 0); return y >= from && y <= to; }); console.log(series, 'seasons', seasons.join(' '));
  for (const sid of seasons) { const page = await get(`${host}/?season=${encodeURIComponent(sid)}`) || '', events = opts(page, 'evvent'), urls = new Set();
    const pages = [page, ...await Promise.all(events.map(e => get(`${host}/?season=${encodeURIComponent(sid)}&evvent=${encodeURIComponent(e)}`)))];
    for (const t of pages) for (const m of (t || '').matchAll(/href="([^"]+?\.CSV)"/gi)) { const u = m[1].startsWith('http') ? m[1] : `${host}/${m[1].replace(/^\.?\//, '')}`; if (isClass(u)) urls.add(encodeURI(decodeURI(u))); }
    const r = await readAll(series, [...urls]); log.push(`${series} ${sid}: ${events.length} events, ${urls.size} classification files, ${r.files} read, ${r.n} driver values`); console.log(log.at(-1)); } }

writeFileSync('scripts/sim/data/learn/alkamel-ratings.json.gz', gzipSync(JSON.stringify({generated: new Date().toISOString().slice(0, 10),
  note: 'FIA category printed per driver by Al Kamel classification CSVs of WEC 2013-2020, ELMS 2013-2020, Asian LMS 2013-2021 and Le Mans Cup (seasons the tobi/imsa_data archive lacks). One row per driver, season and printed value. Built by fetch-alkamel-ratings.mjs.',
  log, rows: [...rows.values()]}), {level: 9}));
