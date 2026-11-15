// Per-driver laps the endurance archive does not hold (owner 2026-11-15: driver lines in every series), as JSON lines for
// driver-lines-endurance.mjs (LAPSIM_DL_EXTRA):
//  - Formula E: Al Kamel "Analysis" CSV of every qualifying session (results.fiaformulae.com), seasons 2018-19 on (Gen2, Gen3, Gen3 Evo).
//  - SRO GT3: Timing71 lap rows (GT World Challenge in every region, IGTC, British GT, ...) from the all-laps artifacts (.cache/t71-rows),
//    when the row names its driver.
// Network: run in GitHub Actions. Out: <out file> (raw laps stay out of git; the fit commits only derived lines).
import {writeFileSync, readdirSync, readFileSync, statSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {officialArchive, officialSource, textOf} from '../../../worker/official.js';
import {parseCsv, secs, sessionType} from './build-endurance.mjs';
import {modelOf} from './models.mjs';
import {resolveTrack} from './track-registry.mjs';

const OUT = process.argv[2] || '.cache/learn/extra-laps.ndjson', lines = [], log = [];
const num = x => { const v = Number(String(x ?? '').trim().replace(',', '.')); return Number.isFinite(v) ? v : null; };
const feBucket = y => y <= 2022 ? 'fe-gen2' : y <= 2024 ? 'fe-gen3' : 'fe-gen3evo';
// Formula E
const list = async id => { for (let i = 0; ; i++) { try { return await officialArchive('formula-e', id); } catch (e) { if (i >= 2) { log.push(`${id}: ${e.message}`); return {catalogs: [], files: []}; } await new Promise(r => setTimeout(r, 2000)); } } };
for (const s of (await list()).catalogs.filter(c => +(c.name.match(/Season (\d+)/) || [])[1] >= 5)) {
  const year = +('20' + s.name.match(/-(\d\d)\s*$/)[1]);
  for (const ev of (await list(s.id)).catalogs) for (const champ of (await list(ev.id)).catalogs.filter(c => /formula e world championship|formula e championship/i.test(c.name)))
    for (const se of (await list(champ.id)).catalogs) {
      if (sessionType(se.name.toLowerCase().replace(/ /g, '-')) !== 'Q') continue;
      const lf = (await list(se.id)).files.find(f => /analysis/i.test(f.title) && (f.format === 'csv' || /\.csv$/i.test(f.url))); if (!lf) continue;
      try {
        for (const r of parseCsv(textOf(await officialSource(lf.url)))) {
          const t = secs(r.LAP_TIME), sx = [r.S1_SECONDS ?? secs(r.S1), r.S2_SECONDS ?? secs(r.S2), r.S3_SECONDS ?? secs(r.S3)].map(num);
          if (!r.DRIVER_NAME || !(t > 0) || r.CROSSING_FINISH_LINE_IN_PIT || (r.FLAG_AT_FL && r.FLAG_AT_FL !== 'GF')) continue;
          lines.push({series: 'fe', season: year, venue: ev.name.replace(/^R\d+\s*/, ''), lenKm: num(r.KPH) ? num(r.KPH) * t / 3600 : null, bucket: feBucket(year), driver: r.DRIVER_NAME, manufacturer: r.MANUFACTURER || null, team: r.TEAM || null, t, s: sx});
        }
      } catch (e) { log.push(`${ev.name} ${se.name}: ${e.message}`); }
    }
  console.log(s.name, 'laps so far', lines.length);
}
// SRO GT3 from Timing71 lap rows
const DIR = process.env.T71_ROWS || '.cache/t71-rows', HARD = ['no_time', 'pit_in', 'pit_out', 'not_green', 'deleted', 'wet_lap', 'wet_session', 'sector_sum', 'inaccurate', 'sim'];
const files = d => existsSync(d) ? readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.ndjson(\.gz)?$/.test(f) ? [p] : []; }) : [];
let t71 = 0, noDriver = 0, keys = null; const drop = {}, sampleDrivers = new Set(), named = {};
for (const f of files(DIR)) {
  const text = f.endsWith('.gz') ? gunzipSync(readFileSync(f)).toString() : readFileSync(f, 'utf8');
  for (const line of text.split('\n')) {
    if (!line) continue; let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.source === 'alkamel' || r.series === 'wec' || !/GT3|GTD/i.test(modelOf(r.carModel, r.season, 'GT3')?.base || '')) continue;
    keys ||= Object.keys(r);
    const d0 = r.driver ?? r.driverName ?? r.driver_name ?? null, driver0 = d0 && typeof d0 === 'object' ? d0.name ?? d0.fullName ?? ([d0.firstName, d0.lastName].filter(Boolean).join(' ') || null) : d0 != null ? String(d0) : null;
    if (sampleDrivers.size < 12 && d0 != null) sampleDrivers.add(JSON.stringify(d0).slice(0, 80));
    const driver = driver0 && /,/.test(driver0) ? driver0.split(',').map(x => x.trim()).reverse().join(' ') : driver0; // 'ENGEL, Maro' -> 'Maro ENGEL'
    if (!driver || /^\d*$/.test(driver)) { noDriver++; continue; } // a number is a car or seat number, not a person
    named[String(r.sessionType || r.session || '?').slice(0, 20)] = (named[String(r.sessionType || r.session || '?').slice(0, 20)] || 0) + 1;
    // qualifying and practice (not race laps: fuel and traffic); the field line of each group takes the common part
    if ((r.q || []).some(q => HARD.includes(q)) || /^r|race/i.test(String(r.sessionType || r.session || ''))) continue;
    let tid = null;
    const why = [r.s1, r.s2, r.s3].some(x => !(x > 0)) ? 'no sectors' : Math.abs(r.s1 + r.s2 + r.s3 - r.time) > 0.1 ? 'sectors do not add up' : !(tid = resolveTrack({name: [r.track, r.layout].filter(Boolean).join(' ').replace(/-/g, ' '), season: r.season}).sim) ? 'track ' + r.track + ' / ' + r.layout : null;
    if (why) { drop[why] = (drop[why] || 0) + 1; continue; }
    lines.push({trackId: tid, series: r.series, season: r.season, venue: [r.track, r.layout].filter(Boolean).join(' '), lenKm: r.lenKm || null, bucket: 'gt3', driver, manufacturer: modelOf(r.carModel, r.season, 'GT3')?.base?.split(' ')[0] || null, team: r.team || null, t: r.time, s: [r.s1, r.s2, r.s3]}); t71++;
  }
}
console.log('Timing71 named rows by session type', JSON.stringify(named));
console.log('Timing71 driver field samples', JSON.stringify([...sampleDrivers]));
console.log('Timing71 dropped', JSON.stringify(Object.entries(drop).sort((a, b) => b[1] - a[1]).slice(0, 25)));
console.log('Timing71 GT3 qualifying laps with a driver', t71, '· rows without a driver', noDriver, '· row fields', JSON.stringify(keys));
writeFileSync(OUT, lines.map(x => JSON.stringify(x)).join('\n') + '\n');
{ const c = {}; for (const l of lines) if (l.series !== 'fe') { const k = l.series + ' ' + l.trackId; c[k] = (c[k] || 0) + 1; } console.log('Timing71 kept by track', JSON.stringify(c)); }
console.log('extra laps', lines.length, 'errors', log.length, log.slice(0, 5));
