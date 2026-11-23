// Loader for the full Al Kamel lap files (step 16). The raw files are fetched in Actions by fetch-alkamel-full-laps.mjs and kept
// outside git (physics rule 9) as a draft release asset; the repo keeps only the manifest (URL, fetch date, checksum, rows, columns).
// Get the files in a workflow job:
//   gh release download data-alkamel-full-laps -p alkamel-full-laps.tar -D .cache && tar -xf .cache/alkamel-full-laps.tar -C .cache
// then: for (const s of sessions()) for (const lap of readSession(s)) ...
// Typed row: car, cls, team, manufacturer, driver, driverNumber, lap, time, sectors [s, s, s], elapsed, topSpeedKph, flag, pitIn, pitOut,
// pitTime, stint, stintLap, tyre (when a tyre column exists, else null), airTempC, trackTempC, humidityPct, rain (nearest weather row).
import {readFileSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {parseCsv} from '../../../worker/wec.js';
import {secs} from './fetch-alkamel-laps.mjs';

export const MANIFEST = 'scripts/sim/data/learn/alkamel-full-laps-manifest.json';
export const STORE = '.cache/alkamel-full-laps';

const num = x => { const s = String(x ?? '').trim().replace(',', '.'); return s && Number.isFinite(+s) ? +s : null; };
const sec = x => { const v = secs(x); return v > 0 ? v : null; };
const col = (headers, re) => headers.find(h => re.test(h));
export const csvRows = text => parseCsv(String(text)).records;

// weather rows -> [{t, airTempC, trackTempC, humidityPct, rain}], t = seconds after the first row. IMSA files are in °F and inHg (pressure near 30).
export function weatherSeries(rows) {
  if (!rows?.length) return [];
  const t0 = num(rows[0].TIME_UTC_SECONDS), p = rows.map(r => num(r.PRESSURE)).filter(x => x != null).sort((a, b) => a - b);
  const imperial = p.length && p[p.length >> 1] < 100, c = x => x == null ? null : imperial ? +((x - 32) / 1.8).toFixed(2) : x;
  return rows.map(r => ({t: t0 == null || num(r.TIME_UTC_SECONDS) == null ? null : num(r.TIME_UTC_SECONDS) - t0,
    airTempC: c(num(r.AIR_TEMP)), trackTempC: c(num(r.TRACK_TEMP)), humidityPct: num(r.HUMIDITY), rain: num(r.RAIN) == null ? null : num(r.RAIN) > 0})).filter(w => w.t != null);
}
// nearest weather row to a lap (by session elapsed time); none when the nearest row is more than 10 minutes away
function nearest(ws, t) {
  if (!ws.length || t == null) return null;
  let lo = 0, hi = ws.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (ws[m].t < t) lo = m + 1; else hi = m; }
  const w = [ws[lo], ws[lo - 1]].filter(Boolean).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
  return Math.abs(w.t - t) <= 600 ? w : null;
}

// Analysis / Time Cards rows (+ weather rows) -> typed laps, sorted by car and lap. Stint = count of pit-ins before the lap + 1.
export function typedLaps(analysis, weather = []) {
  if (!analysis.length) return [];
  const headers = Object.keys(analysis[0]), tyreCol = col(headers, /TYRE|TIRE|COMPOUND/i), ws = weatherSeries(weather), byCar = new Map();
  for (const r of analysis) { const n = String(r.NUMBER ?? '').trim(); if (n) (byCar.get(n) || byCar.set(n, []).get(n)).push(r); }
  const out = [];
  for (const [car, rows] of byCar) {
    rows.sort((a, b) => +a.LAP_NUMBER - +b.LAP_NUMBER);
    let stint = 1, stintLap = 0;
    rows.forEach((r, i) => {
      const pitIn = !!String(r.CROSSING_FINISH_LINE_IN_PIT ?? '').trim(), pitOut = i === 0 || !!String(rows[i - 1].CROSSING_FINISH_LINE_IN_PIT ?? '').trim();
      if (i > 0 && pitOut) { stint++; stintLap = 0; }
      stintLap++;
      const elapsed = sec(r.ELAPSED), w = nearest(ws, elapsed);
      out.push({car, cls: r.CLASS || null, team: r.TEAM || null, manufacturer: r.MANUFACTURER || null, driver: r.DRIVER_NAME || null,
        driverNumber: num(r.DRIVER_NUMBER), lap: +r.LAP_NUMBER, time: sec(r.LAP_TIME),
        sectors: ['S1', 'S2', 'S3'].map(k => num(r[k + '_SECONDS']) ?? sec(r[k])), elapsed, topSpeedKph: num(r.TOP_SPEED),
        flag: r.FLAG_AT_FL || null, pitIn, pitOut, pitTime: sec(r.PIT_TIME), stint, stintLap, tyre: tyreCol ? r[tyreCol] || null : null,
        airTempC: w?.airTempC ?? null, trackTempC: w?.trackTempC ?? null, humidityPct: w?.humidityPct ?? null, rain: w?.rain ?? null});
    });
  }
  return out;
}

// per-file numbers for the manifest: rows, columns, cars, laps per car (min / median / max), cars per class
export function fileStats(rows) {
  const per = new Map(), cls = new Map();
  for (const r of rows) { const n = String(r.NUMBER ?? '').trim(); if (!n) continue; per.set(n, (per.get(n) || 0) + 1); if (r.CLASS && !cls.has(n)) cls.set(n, r.CLASS); }
  const laps = [...per.values()].sort((a, b) => a - b), classes = {};
  for (const c of cls.values()) classes[c] = (classes[c] || 0) + 1;
  return {rows: rows.length, columns: rows.length ? Object.keys(rows[0]) : [], cars: per.size,
    lapsPerCar: laps.length ? {min: laps[0], median: laps[laps.length >> 1], max: laps.at(-1)} : null, classes};
}

export const readManifest = (path = MANIFEST) => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {files: []};
// sessions of the manifest: {series, season, event, session, kind, analysis: entry, weather: entry | undefined}
export function sessions(manifest = readManifest(), filter = () => true) {
  const by = new Map();
  for (const f of manifest.files) { const k = [f.series, f.season, f.event, f.session].join('|'); const s = by.get(k) || by.set(k, {series: f.series, season: f.season, event: f.event, session: f.session, kind: f.kind}).get(k); s[f.file] = f; }
  return [...by.values()].filter(s => s.analysis && filter(s));
}
const readStored = (entry, dir) => csvRows(gunzipSync(readFileSync(join(dir, entry.path))).toString('utf8'));
export const readSession = (s, dir = STORE) => typedLaps(readStored(s.analysis, dir), s.weather ? readStored(s.weather, dir) : []);

// coverage table: event x series x class, cars and laps (races) and sessions read
export function coverageMarkdown(manifest) {
  const rows = new Map();
  for (const f of manifest.files.filter(f => f.file === 'analysis')) for (const [c, cars] of Object.entries(f.classes || {})) {
    const k = [f.season, f.series, f.event, c].join('|'), r = rows.get(k) || rows.set(k, {season: f.season, series: f.series, event: f.event, cls: c, sessions: 0, raceCars: 0, raceRows: 0, weather: false}).get(k);
    r.sessions++; if (f.kind === 'race') { r.raceCars = cars; r.raceRows = f.rows; }
    if (manifest.files.some(w => w.file === 'weather' && w.event === f.event && w.season === f.season && w.session === f.session)) r.weather = true;
  }
  const list = [...rows.values()].sort((a, b) => a.season - b.season || a.series.localeCompare(b.series) || a.event.localeCompare(b.event) || a.cls.localeCompare(b.cls));
  return ['| Season | Series | Event | Class | Sessions | Race cars | Race file rows (all classes) | Weather |', '|---|---|---|---|---|---|---|---|',
    ...list.map(r => `| ${r.season} | ${r.series} | ${r.event} | ${r.cls} | ${r.sessions} | ${r.raceCars || '–'} | ${r.raceRows || '–'} | ${r.weather ? 'yes' : 'no'} |`)].join('\n');
}
