// Every-lap timing of the series Al Kamel publishes but no other fetcher reads (owner 2026-11-21: GTWC must read Al Kamel too).
// Today: GT World Challenge America and the IGTC Indianapolis 8 Hour (usac.alkamelsystems.com, series "06_SRO"; same results site as
// IMSA/ELMS: one folder per session with 23_AnalysisEnduranceWithSections_*.CSV = every lap with sectors, 03_Results_*.CSV = official
// classification, 26_Weather_*.CSV). Runs in GitHub Actions (network). Raw files are not stored (physics rule 2.9): out is one derived
// row per car and session in scripts/sim/data/learn/alkamel-laps.json.gz.
//   node scripts/sim/learn/fetch-alkamel-laps.mjs [--years=2023,2024,2025,2026]
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

export const SITES = {usac: {base: 'https://usac.alkamelsystems.com/', series: '06_SRO', champ: /GT World Challenge America|IGTC/i}};
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator; official results reader)'}};

export const secs = t => { const p = String(t ?? '').trim().split(':').map(Number); return !String(t ?? '').trim() || p.some(x => !Number.isFinite(x)) ? null : p.reduce((a, x) => a * 60 + x, 0); };
const num = x => { const s = String(x ?? '').trim().replace(',', '.'); return s && Number.isFinite(+s) ? +s : null; };
export function parseCsv(text) {
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split(';').map(h => h.trim());
  return lines.slice(1).map(l => { const c = l.split(';'); return Object.fromEntries(head.map((h, i) => [h, (c[i] ?? '').trim()])); });
}
export const sessionKind = name => /race/i.test(name) && !/qualif/i.test(name) ? 'race' : /qualif|pole/i.test(name) ? 'qualifying' : /test/i.test(name) ? 'test' : 'practice';

// one row per car: best lap of any kind (as the official classification counts it), best clean lap (green or finish flag, not into
// the pit lane), its sectors and the top speed; laps counted. results: rows of 03_Results (car model, official best for the parity check)
export function carRows(analysis, results = [], weather = []) {
  const official = new Map(results.map(r => [String(r.NUMBER).trim(), r])), cars = new Map();
  for (const r of analysis) {
    const n = String(r.NUMBER).trim(), lap = secs(r.LAP_TIME); if (!n || !(lap > 20)) continue;
    const c = cars.get(n) || {car: n, cls: r.CLASS || null, team: r.TEAM || null, manufacturer: r.MANUFACTURER || null, laps: 0, best: null, clean: null};
    c.laps++;
    if (c.best == null || lap < c.best) c.best = lap;
    const isClean = !r.CROSSING_FINISH_LINE_IN_PIT && ['GF', 'FF'].includes(r.FLAG_AT_FL);
    if (isClean && (!c.clean || lap < c.clean.lap)) c.clean = {lap, sectors: ['S1', 'S2', 'S3'].map(k => num(r[k + '_SECONDS']) ?? secs(r[k])), topSpeedKph: num(r.TOP_SPEED), driver: r.DRIVER_NAME || null};
    cars.set(n, c);
  }
  const w = weather.length ? {airTempC: avg(weather.map(x => num(x.AIR_TEMP))), trackTempC: avg(weather.map(x => num(x.TRACK_TEMP))), rain: weather.some(x => num(x.RAIN) > 0)} : null;
  return [...cars.values()].map(c => { const o = official.get(c.car); return {...c, model: o?.VEHICLE || null, officialBest: secs(o?.FL_TIME || o?.TIME), weather: w}; });
}
const avg = a => { const v = a.filter(x => x != null); return v.length ? +(v.reduce((p, q) => p + q, 0) / v.length).toFixed(1) : null; };

async function get(url) {
  for (let i = 0; i < 3; i++) { try { const r = await fetch(url, {...UA, signal: AbortSignal.timeout(45000)}); if (r.ok) return await r.text(); if (r.status === 404) return ''; } catch {} await new Promise(s => setTimeout(s, 2000)); }
  return '';
}
export const options = (html, name) => [...(String(html).match(new RegExp(`<select[^>]*name=["']${name}["'][^>]*>([\\s\\S]*?)</select>`, 'i'))?.[1] || '').matchAll(/value=(?:"([^"]*)"|'([^']*)')/gi)].map(m => m[1] ?? m[2]);
const csvLinks = (html, base) => [...new Set([...html.matchAll(/href=["']([^"']+\.CSV)["']/gi)].map(m => new URL(m[1].replace(/&amp;/g, '&'), base).href))];

if (process.argv[1]?.endsWith('fetch-alkamel-laps.mjs')) {
  const years = (process.argv.find(a => a.startsWith('--years='))?.slice(8) || '2023,2024,2025,2026').split(',');
  const out = [], log = [];
  for (const [site, s] of Object.entries(SITES)) {
    const q = o => s.base + '?' + new URLSearchParams(o);
    const seasons = options(await get(q({series: s.series})), 'season').filter(v => years.some(y => v.endsWith(y)));
    for (const season of seasons) {
      const events = options(await get(q({series: s.series, season})), 'evvent');
      for (const event of events) {
        const files = csvLinks(await get(q({series: s.series, season, evvent: event})), s.base), bySession = new Map();
        for (const f of files) { const p = decodeURIComponent(new URL(f).pathname).split('/'), champ = p[5], session = p[6]; if (!s.champ.test(champ || '')) continue;
          const k = champ + '|' + session; (bySession.get(k) || bySession.set(k, {champ, session, files: {}}).get(k)).files[p[7]] = f; }
        for (const {champ, session, files: fs} of bySession.values()) {
          const pick = re => Object.entries(fs).find(([n]) => re.test(n))?.[1];
          const an = pick(/^23_AnalysisEnduranceWithSections/i) || pick(/^23_Analysis/i); if (!an) continue;
          const [a, r, w] = await Promise.all([an, pick(/^03_Results_/i), pick(/^26_Weather/i)].map(u => u ? get(u).then(parseCsv) : []));
          const name = session.replace(/^\d{12}_/, ''), rows = carRows(a, r, w);
          for (const c of rows) out.push({site, season: +season.slice(-4), event: event.replace(/^\d+_/, ''), championship: champ.replace(/^\d+_/, ''), session: name, kind: sessionKind(name), start: session.slice(0, 12), ...c});
          log.push(`${season} ${event} ${champ} ${name}: ${rows.length} cars`);
        }
      }
    }
  }
  writeFileSync('scripts/sim/data/learn/alkamel-laps.json.gz', gzipSync(JSON.stringify({
    source: 'Al Kamel Systems published timing (usac.alkamelsystems.com: GT World Challenge America, IGTC Indianapolis 8 Hour). One row per car and session; raw files not stored.',
    fields: 'best = fastest lap of any kind; clean = fastest green/finish-flag lap not into the pit lane, with sectors (s) and top speed; officialBest = 03_Results classification',
    fetched: new Date().toISOString().slice(0, 10), rows: out})));
  console.log(log.join('\n')); console.log('rows', out.length);
}
