// Every-lap timing of the series Al Kamel publishes but no other fetcher reads (owner 2026-11-21: GTWC must read Al Kamel too).
// Today: GT World Challenge America and the IGTC Indianapolis 8 Hour (usac), ELMS (elms), the Michelin Le Mans Cup (lemanscup) and the Asian Le Mans Series (alms, JSON manifests) (usac.alkamelsystems.com, series "06_SRO"; same results site as
// IMSA/ELMS: one folder per session with 23_AnalysisEnduranceWithSections_*.CSV = every lap with sectors, 03_Results_*.CSV = official
// classification, 26_Weather_*.CSV). Runs in GitHub Actions (network). Raw files are not stored (physics rule 2.9): out is one derived
// row per car and session in scripts/sim/data/learn/alkamel-laps.json.gz.
//   node scripts/sim/learn/fetch-alkamel-laps.mjs [--years=2023,2024,2025,2026]
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

export const SITES = {
  usac: {base: 'https://usac.alkamelsystems.com/', series: '06_SRO', champ: /GT World Challenge America|IGTC/i},
  elms: {base: 'https://elms.alkamelsystems.com/', champ: /^\d+_European Le Mans Series$/i},
  lemanscup: {base: 'https://lemanscup.alkamelsystems.com/', champ: /^\d+_Michelin Le Mans Cup$/i},
  // alms.alkamelsystems.com is a newer app: same folders and CSV files, listed in JSON manifests instead of index pages
  alms: {manifest: 'https://files.alkamelcloud.com/alms/manifests/results.json', files: 'https://files.alkamelcloud.com/', champ: /^\d+_Asian Le Mans Series$/i},
};
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator; official results reader)'}};

// "1:34.023", and "2'03.875" as the ELMS / Le Mans Cup race classifications write it
export const secs = t => { const s = String(t ?? '').trim().replace(/'/g, ':'), p = s.split(':').map(Number); return !s || p.some(x => !Number.isFinite(x)) ? null : p.reduce((a, x) => a * 60 + x, 0); };
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
    // a lap quicker than the car's best that the timing does not mark as an improvement was deleted (track limits); the official best skips it
    const deleted = r.LAP_IMPROVEMENT === '0' && (c.best == null || lap < c.best);
    if (!deleted && (c.best == null || lap < c.best)) c.best = lap;
    const isClean = !deleted && !r.CROSSING_FINISH_LINE_IN_PIT && ['GF', 'FF'].includes(r.FLAG_AT_FL);
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
// .../<championship>/<yyyymmddhhmm_Session>[/Hour N]/<file>.CSV: endurance races repeat the files per hour, the last hour is complete
export function sessionFile(path) {
  const p = decodeURIComponent(path).split('/'), i = p.findIndex(x => /^\d{12}_/.test(x));
  if (i < 1) return null;
  return {champ: p[i - 1], session: p[i], hour: +(p.slice(i + 1, -1).join(' ').match(/\d+/)?.[0] || 0), file: p.at(-1)};
}
// every analysis row as a lap for σ_meas: stint = pit-ins before it + 1, lap in stint, pit-in / pit-out laps marked
export function lapRows(a) {
  const byCar = new Map(); for (const r of a) { const n = String(r.NUMBER ?? '').trim(); if (n) (byCar.get(n) || byCar.set(n, []).get(n)).push(r); }
  const out = []; for (const [car, rows] of byCar) { rows.sort((x, y) => +x.LAP_NUMBER - +y.LAP_NUMBER); let stint = 1, k = 0;
    rows.forEach((r, i) => { const pitIn = !!r.CROSSING_FINISH_LINE_IN_PIT, pitOut = i === 0 || !!rows[i - 1].CROSSING_FINISH_LINE_IN_PIT; if (i > 0 && pitOut) { stint++; k = 0; } k++;
      out.push({who: car + '|' + (r.DRIVER_NUMBER || r.DRIVER_NAME || ''), cls: r.CLASS || null, clock: secs(r.ELAPSED), stint, k, y: secs(r.LAP_TIME), pit: pitIn || pitOut, flag: r.FLAG_AT_FL || null}); }); }
  return out;
}
const csvLinks = (html, base) => [...new Set([...html.matchAll(/href=["']([^"']+\.CSV)["']/gi)].map(m => new URL(m[1].replace(/&amp;/g, '&'), base).href))];

if (process.argv[1]?.endsWith('fetch-alkamel-laps.mjs')) {
  const years = (process.argv.find(a => a.startsWith('--years='))?.slice(8) || '2023,2024,2025,2026').split(',');
  const out = [], log = [], lapsOut = [], LAPS_OUT = process.env.ALKAMEL_LAPS_OUT;
  // every (season, event, CSV links) of a site, from its index pages or its JSON manifests
  async function* eventsOf(s) {
    if (s.manifest) {
      for (const {id, manifestUrl} of JSON.parse(await get(s.manifest) || '{}').seasons || []) { if (!years.some(y => id.endsWith(y))) continue;
        const paths = new Set(), walk = o => Array.isArray(o) ? o.forEach(walk) : o && typeof o === 'object' ? Object.values(o).forEach(walk) : typeof o === 'string' && /\.csv$/i.test(o) && paths.add(o);
        walk(JSON.parse(await get(s.files + manifestUrl) || '{}')); const byEvent = new Map();
        for (const path of paths) { const ev = path.split('/')[3]; (byEvent.get(ev) || byEvent.set(ev, []).get(ev)).push(s.files + path.split('/').map(encodeURIComponent).join('/')); }
        for (const [event, files] of byEvent) yield {season: id, event, files};
      }
      return;
    }
    const q = o => s.base + '?' + new URLSearchParams(s.series ? {series: s.series, ...o} : o);
    for (const season of options(await get(q({})), 'season').filter(v => years.some(y => v.endsWith(y))))
      for (const event of options(await get(q({season})), 'evvent')) yield {season, event, files: csvLinks(await get(q({season, evvent: event})), s.base)};
  }
  for (const [site, s] of Object.entries(SITES)) {
    for await (const {season, event, files: links} of eventsOf(s)) {
      {
        const files = links.map(f => ({f, ...sessionFile(new URL(f).pathname)})).filter(x => x.champ && s.champ.test(x.champ)).sort((a, b) => a.hour - b.hour), bySession = new Map();
        for (const {f, champ, session, file} of files) { const k = champ + '|' + session; (bySession.get(k) || bySession.set(k, {champ, session, files: {}}).get(k)).files[file] = f; }
        for (const {champ, session, files: fs} of bySession.values()) {
          const pick = re => Object.entries(fs).find(([n]) => re.test(n))?.[1];
          const an = pick(/^23_AnalysisEnduranceWithSections/i) || pick(/^23_Analysis/i); if (!an) continue;
          const [a, r, w] = await Promise.all([an, pick(/^03_(Results|Classification)_/i), pick(/^26_Weather/i)].map(u => u ? get(u).then(parseCsv) : []));
          const name = session.replace(/^\d{12}_/, ''), rows = carRows(a, r, w);
          for (const c of rows) out.push({site, season: +season.slice(-4), event: event.replace(/^\d+_/, ''), championship: champ.replace(/^\d+_/, ''), session: name, kind: sessionKind(name), start: session.slice(0, 12), ...c});
          // step 36: every lap of the session for σ_meas (ALKAMEL_LAPS_OUT; raw laps, kept out of git: draft release only)
          if (LAPS_OUT) lapsOut.push({series: site, season: +season.slice(-4), event: event.replace(/^\d+_/, ''), session: name, kind: sessionKind(name),
            laps: lapRows(a), rain: w.some(r => num(r.RAIN) > 0)});
          log.push(`${season} ${event} ${champ} ${name}: ${rows.length} cars`);
        }
      }
    }
  }
  writeFileSync('scripts/sim/data/learn/alkamel-laps.json.gz', gzipSync(JSON.stringify({
    source: 'Al Kamel Systems published timing (usac.alkamelsystems.com: GT World Challenge America, IGTC Indianapolis 8 Hour; elms.alkamelsystems.com: European Le Mans Series; lemanscup.alkamelsystems.com: Michelin Le Mans Cup; files.alkamelcloud.com manifests: Asian Le Mans Series). One row per car and session; raw files not stored.',
    fields: 'best = fastest lap of any kind; clean = fastest green/finish-flag lap not into the pit lane, with sectors (s) and top speed; officialBest = 03_Results classification',
    fetched: new Date().toISOString().slice(0, 10), rows: out})));
  if (LAPS_OUT) writeFileSync(LAPS_OUT, gzipSync(JSON.stringify({source: 'Al Kamel analysis CSVs (every lap), sites as above; raw laps for σ_meas (step 36), never committed', sessions: lapsOut})));
  console.log(log.join('\n')); console.log('rows', out.length);
}
