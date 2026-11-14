// Real qualifying laps per car type on the extra circuits, from Al Kamel's published timing (WEC: fiawec.alkamelsystems.com,
// IMSA: imsa.results.alkamelcloud.com), the sources fetch-wec.mjs and the connector tools already use.
// Why: the Timing71 best-lap table keeps only the fastest car of a class, so an LMH that was not on pole (Aston Martin in
// IMSA GTP, Ferrari or Toyota behind a Cadillac at Le Mans) had no real lap. Here every car type gets its own best lap.
// Raw files are not stored. Out: scripts/sim/data/track-real-laps.json (derived: one row per track, series, season, car type).
// Needs network access to the two hosts: run in GitHub Actions (workflow lapsim-track-laps.yml).
import {writeFileSync} from 'node:fs';
import {archive, readDocument, readPublishedDocument} from '../../worker/wec.js';
import {officialArchive, officialSource} from '../../worker/official.js';
import {SERIES} from '../../worker/lapsim/series.js';

const LMH = SERIES.wec.classes.lmh.manufacturers; // Toyota, Ferrari, Peugeot, Aston Martin, ...
const YEARS = (process.env.TRACK_LAPS_YEARS || '2023,2024,2025,2026').split(',');
// event name -> track id. Order matters: the first match wins; null = not this circuit's race weekend
const WEC_EVENTS = [[/LE MANS/i, 'le-mans'], [/FUJI/i, 'fuji'], [/SEBRING/i, 'sebring'], [/PORTIM|ALGARVE/i, 'portimao']];
const IMSA_EVENTS = [[/test|roar|\(.*\)/i, null], [/daytona/i, 'daytona'], [/sebring/i, 'sebring'], [/long beach/i, 'long-beach'], [/laguna/i, 'laguna-seca'], [/detroit/i, 'detroit'],
  [/watkins/i, 'watkins-glen'], [/canadian tire|mosport/i, 'mosport'], [/road america/i, 'road-america'], [/virginia/i, 'vir'], [/indianapolis/i, 'indianapolis'],
  [/road atlanta|petit/i, 'road-atlanta'], [/mid-ohio/i, 'mid-ohio'], [/lime rock/i, 'lime-rock']];
const meanWeather = rows => toMetric(meanWeatherRaw(rows));
const trackOf = (list, name) => { for (const [re, id] of list) if (re.test(name)) return id; return null; };
const secs = t => { const p = String(t || '').split(':').map(Number); return p.some(x => !Number.isFinite(x)) || !p.length ? NaN : p.reduce((a, x) => a * 60 + x, 0); };
const num = x => { const v = Number(String(x ?? '').replace(',', '.')); return Number.isFinite(v) && String(x ?? '').trim() !== '' ? v : null; };
// IMSA weather files are in °F and inHg (pressure near 30); WEC files are in °C and hPa
export const toMetric = w => w && w.pressureHpa != null && w.pressureHpa < 100 ? {...w, airTempC: w.airTempC == null ? null : +((w.airTempC - 32) / 1.8).toFixed(2), trackTempC: w.trackTempC == null ? null : +((w.trackTempC - 32) / 1.8).toFixed(2), pressureHpa: +(w.pressureHpa * 33.8639).toFixed(1), units: 'converted from °F and inHg'} : w;
const meanWeatherRaw = rows => { if (!rows?.length) return null; const m = k => { const v = rows.map(r => num(r[k])).filter(x => x != null); return v.length ? +(v.reduce((p, q) => p + q, 0) / v.length).toFixed(2) : null; };
  return {airTempC: m('AIR_TEMP'), trackTempC: m('TRACK_TEMP'), humidityPct: m('HUMIDITY'), pressureHpa: m('PRESSURE'), rain: rows.some(r => num(r.RAIN) > 0)}; };
// car type of one timing row: which fitted car this lap belongs to
export function carType(series, cls, manufacturer) {
  const c = String(cls || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (series === 'wec') return c === 'HYPERCAR' ? (LMH.test(manufacturer || '') ? 'lmh' : 'lmdh') : c === 'LMGT3' ? 'lmgt3' : null;
  return c === 'GTP' ? (LMH.test(manufacturer || '') ? 'lmh' : 'lmdh') : c === 'GTDPRO' ? 'gtdpro' : c === 'GTD' ? 'gtd' : null;
}
// best clean lap per car type in the rows of one session (green or finish flag, not through the pit lane)
export function bestPerType(series, rows) {
  const best = {};
  for (const r of rows) {
    const type = carType(series, r.CLASS, r.MANUFACTURER), lap = secs(r.LAP_TIME); if (!type || !(lap > 30) || r.CROSSING_FINISH_LINE_IN_PIT || !['GF', 'FF'].includes(r.FLAG_AT_FL)) continue;
    if (!best[type] || lap < best[type].lap) best[type] = {lap, car: r.NUMBER, manufacturer: r.MANUFACTURER, team: r.TEAM, driver: r.DRIVER_NAME, cls: r.CLASS,
      sectors: ['S1', 'S2', 'S3'].map(k => num(r[k + '_SECONDS']) ?? (Number.isFinite(secs(r[k])) ? secs(r[k]) : null)), topSpeedKph: num(r.TOP_SPEED)};
  }
  return best;
}

if (process.argv[1]?.endsWith('fetch-track-laps.mjs')) {
  const out = [], log = [], keep = (track, series, season, event, session, url, best, weather) => { for (const [type, b] of Object.entries(best)) out.push({track, series, season: +season, type, ...b, event, session, weather, url}); };
  // WEC
  try {
    const seasons = (await archive()).records.filter(s => YEARS.some(y => String(s.name).includes(y)));
    for (const s of seasons) { const year = YEARS.find(y => String(s.name).includes(y)); let a; try { a = await archive(s.season_id); } catch (e) { log.push(`wec ${year}: ${e.message}`); continue; }
      for (const event of a.events) { const track = trackOf(WEC_EVENTS, event); if (!track) continue;
        const files = a.files.filter(f => f.folders[0] === event && f.folders[1] === 'FIA WEC' && f.format === 'csv'), merged = {}; let w = null, sess = null, url = null;
        for (const f of files.filter(f => /^Analysis_(?:Qualifying|Hyperpole)/i.test(f.title))) { try { const rows = (await readDocument({url: f.url, limit: 100000})).records, b = bestPerType('wec', rows);
          for (const [t, x] of Object.entries(b)) if (!merged[t] || x.lap < merged[t].lap) { merged[t] = {...x, session: f.folders[2]}; }
          const wf = files.find(x => x.folders[2] === f.folders[2] && /^Weather_/i.test(x.title)); if (wf && !w) { w = meanWeather((await readDocument({url: wf.url, limit: 100000})).records); sess = f.folders[2]; url = f.url; } } catch (e) { log.push(`wec ${year} ${event} ${f.title}: ${e.message}`); } }
        keep(track, 'wec', year, event, sess, url, merged, w); log.push(`wec ${year} ${event} -> ${track}: ${Object.entries(merged).map(([t, x]) => `${t} ${x.lap.toFixed(3)} #${x.car} ${x.manufacturer}`).join(', ') || 'no qualifying file'}`); } }
  } catch (e) { log.push(`wec: ${e.message}`); }
  // IMSA
  try {
    const seasons = (await officialArchive('imsa')).seasons.filter(s => YEARS.includes(String(s.name)));
    for (const s of seasons) { let a; try { a = await officialArchive('imsa', s.id); } catch (e) { log.push(`imsa ${s.name}: ${e.message}`); continue; }
      for (const ev of a.events) { const track = trackOf(IMSA_EVENTS, ev.name); if (!track) continue;
        let files; try { files = (await officialArchive('imsa', s.id, ev.id)).files || []; } catch (e) { log.push(`imsa ${s.name} ${ev.name}: ${e.message}`); continue; }
        const q = files.filter(f => /weathertech/i.test(f.folders[1] || '') && /qualifying/i.test(f.folders[2] || '') && f.format === 'csv'), tc = q.find(f => /time.?cards/i.test(f.title)), wf = q.find(f => /weather/i.test(f.title));
        if (!tc) { log.push(`imsa ${s.name} ${ev.name}: no qualifying time cards`); continue; }
        try { const read = async u => (await readPublishedDocument({url: u, limit: 100000}, await officialSource(u))).records, best = bestPerType('imsa', await read(tc.url)), w = wf ? meanWeather(await read(wf.url)) : null;
          keep(track, 'imsa', s.name, ev.name, tc.folders[2], tc.url, best, w); log.push(`imsa ${s.name} ${ev.name} -> ${track}: ${Object.entries(best).map(([t, x]) => `${t} ${x.lap.toFixed(3)} #${x.car} ${x.manufacturer}`).join(', ')}`);
        } catch (e) { log.push(`imsa ${s.name} ${ev.name}: ${e.message}`); } } }
  } catch (e) { log.push(`imsa: ${e.message}`); }
  out.sort((a, b) => a.track.localeCompare(b.track) || a.series.localeCompare(b.series) || a.season - b.season || a.type.localeCompare(b.type));
  writeFileSync('scripts/sim/data/track-real-laps.json', JSON.stringify({source: 'Al Kamel Systems published timing: FIA WEC (Analysis files of Qualifying and Hyperpole) and IMSA WeatherTech (Time Cards of Qualifying). Best clean lap per car type; raw files are not stored.',
    note: 'type: lmh / lmdh by manufacturer (worker/lapsim/series.js), lmgt3 (WEC), gtdpro / gtd (IMSA GT3). An IMSA GTP lap of an LMH (Aston Martin) is an LMH lap.', fetched: new Date().toISOString().slice(0, 10), log, laps: out}, null, 1) + '\n');
  console.log(log.join('\n')); console.log(`rows ${out.length}`);
}
