// WEC line-ups and best-lap drivers of events the tobi/imsa_data archive does not hold yet (step 34 A2/A3, driver ratings data fix).
// Source: the official Al Kamel files of FIA WEC (files.alkamelcloud.com manifests): 03_Classification*.CSV (DRIVERn_FIRSTNAME,
// _SECONDNAME, _LICENSE = the FIA category printed by the organiser) and 23_Analysis*.CSV (every lap with DRIVER_NAME) of the
// qualifying sessions. Runs in GitHub Actions (the session cannot reach Al Kamel). Output = an "extra" file for build-driver-ratings.mjs:
// {lineups: {"wec|<season>|<event>": {<car>: {drivers: [{name, rating}], bestLap: [{name, lap, source}], source, date}}}}.
//   node scripts/sim/learn/fetch-wec-lineups.mjs <season> <event ids, comma> <out.json>
import {writeFileSync} from 'node:fs';

const [SEASON, EVENTS, OUT] = process.argv.slice(2), WANT = new Set(EVENTS.split(','));
const MATCH = {interlagos: /SAO PAULO|INTERLAGOS/i, austin: /AMERICAS|AUSTIN|COTA/i, catalunya: /BARCELONA|CATALUNYA/i, monza: /MONZA/i, fuji: /FUJI/i, sakhir: /BAHRAIN/i, lusail: /LOSAIL|LUSAIL|QATAR/i};
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const get = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 1000)); } return null; };
export const split = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ';' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o.map(x => x.trim()); };
export const csv = t => { const L = t.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()), H = split(L[0]).map(h => h.toUpperCase()); return L.slice(1).map(l => { const c = split(l); return Object.fromEntries(H.map((h, i) => [h, c[i] ?? ''])); }); };
export const secs = t => { const p = String(t || '').split(':').map(Number); return p.length && p.every(Number.isFinite) ? p.reduce((a, x) => a * 60 + x, 0) : NaN; };
const car = n => String(n).trim().replace(/^0+(?=\d)/, '');

if (process.argv[1]?.endsWith('fetch-wec-lineups.mjs')) {
  const idx = await get('https://files.alkamelcloud.com/wec/manifests/results.json') || '';
  const id = [...idx.matchAll(/results_(\d\d_(20\d\d))\.json/g)].find(m => m[2] === SEASON)?.[1]; if (!id) throw new Error('no manifest for ' + SEASON);
  const m = await get(`https://files.alkamelcloud.com/wec/manifests/results_${id}.json`);
  const urls = [...new Set([...m.matchAll(/"url":"([^"]+?\.CSV)"/gi)].map(x => x[1].replace(/\\\//g, '/')))].map(u => u.startsWith('http') ? u : `https://files.alkamelcloud.com/${u.replace(/^\//, '')}`);
  const out = {source: `files.alkamelcloud.com/wec/manifests/results_${id}.json`, fetched: new Date().toISOString(), lineups: {}}, log = [];
  for (const ev of WANT) {
    const re = MATCH[ev], mine = urls.filter(u => re.test(decodeURIComponent(u).split('/')[3] || '') && /Qualifying|Hyperpole/i.test(decodeURIComponent(u)));
    const cars = out.lineups[`wec|${SEASON}|${ev}`] = {};
    for (const u of mine.filter(u => /\/03_Classification[^/]*\.CSV$/i.test(decodeURIComponent(u)))) { const t = await get(encodeURI(decodeURI(u))); if (!t) continue;
      for (const r of csv(t)) { const c = cars[car(r.NUMBER)] ||= {drivers: [], bestLap: [], source: decodeURIComponent(u), date: (/\/(20\d{6})\d{4}_/.exec(decodeURIComponent(u))?.[1] || '').replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')};
        for (const i of ['1', '2', '3', '4', '5', '6']) { const name = `${r[`DRIVER${i}_FIRSTNAME`] || ''} ${r[`DRIVER${i}_SECONDNAME`] || ''}`.trim(); if (name && !c.drivers.some(d => d.name === name)) c.drivers.push({name, rating: r[`DRIVER${i}_LICENSE`] || ''}); } } }
    for (const u of mine.filter(u => /\/23_Analysis[^/]*\.CSV$/i.test(decodeURIComponent(u)))) { const t = await get(encodeURI(decodeURI(u))); if (!t) continue;
      const best = new Map(); for (const l of csv(t)) { const s = secs(l.LAP_TIME), k = car(l.NUMBER); if (s > 0 && (!best.has(k) || s < best.get(k).lap)) best.set(k, {name: (l.DRIVER_NAME || '').trim(), lap: +s.toFixed(3), source: decodeURIComponent(u)}); }
      for (const [k, b] of best) (cars[k] ||= {drivers: [], bestLap: [], source: b.source}).bestLap.push(b); }
    log.push(`${ev}: ${mine.length} files, ${Object.keys(cars).length} cars, ${Object.values(cars).filter(c => c.drivers.some(d => d.rating)).length} with a printed category`);
  }
  out.log = log; console.log(log.join('\n')); writeFileSync(OUT, JSON.stringify(out, null, 1));
}
