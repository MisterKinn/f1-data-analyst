// Three-way data check: Timing71 summary vs the references already used for calibration
// (F1 = TracingInsights/OpenF1 pole laps, WEC = Al Kamel laps per car). Same car, same session.
//   node scripts/sim/t71-check.mjs   → docs table rows on stdout + scripts/sim/data/t71/check.json
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {lapsimCalibration as cal} from '../../worker/lapsim/calibration-data.js';
import {mapSessions} from './t71-tracks.mjs';

const DIR = 'scripts/sim/data/t71';
const load = k => existsSync(`${DIR}/${k}.json`) ? mapSessions(JSON.parse(readFileSync(`${DIR}/${k}.json`, 'utf8')).sessions.map(s => ({...s, key: k}))) : [];
const year = s => new Date(s.start * 1e3).getUTCFullYear();
const TOL = 0.0015; // timing resolution
const rows = [];

function compare(series, track, y, car, ref, sessions) {
  // the reference car's best lap in each qualifying session of that event; the closest one is the same session
  const c = sessions.filter(s => s.track === track && year(s) === y && s.cars[car]?.best).map(s => ({s, x: s.cars[car]}));
  if (!c.length) return rows.push({series, track, y, car, ref: ref.realLap, status: 'missing in Timing71'});
  const {s, x} = c.reduce((a, b) => Math.abs(b.x.best - ref.realLap) < Math.abs(a.x.best - ref.realLap) ? b : a);
  const d = x.best - ref.realLap;
  const ds = ref.realSectors && x.bestS ? x.bestS.map((v, i) => v - ref.realSectors[i]) : null;
  rows.push({series, track, y, car, session: s.description, ref: ref.realLap, t71: x.best, d: +d.toFixed(3),
    sectors: ds && ds.map(v => +v.toFixed(3)), dAir: ref.weather && s.weather?.air != null ? +(s.weather.air - ref.weather.airTempC).toFixed(1) : null,
    dTrack: ref.weather && s.weather?.track != null ? +(s.weather.track - ref.weather.trackTempC).toFixed(1) : null,
    // slower = the reference lap is not in this replay (partial recording, Hyperpole/Q3 not recorded); faster = real conflict
    status: Math.abs(d) <= TOL ? 'same' : d > 0 ? 'Timing71 slower (lap not recorded)' : 'Timing71 faster (conflict)'});
}

const f1 = load('f1').filter(s => s.kind === 'Q' && !/sprint/i.test(s.description));
for (const [y, season] of Object.entries(cal.seasons))
  for (const [track, ref] of Object.entries(season.tracks || {})) compare('f1', track, +y, String(ref.driver), ref, f1);
const wec = load('wec').filter(s => s.kind === 'Q');
for (const [cls, years] of Object.entries(cal.series.wec))
  for (const [y, v] of Object.entries(years))
    for (const [track, ref] of Object.entries(v.tracks || {})) compare(`wec-${cls}`, track, +y, String(ref.car), ref, wec);

const n = st => rows.filter(r => r.status === st).length;
const summary = {rows: rows.length, same: n('same'), notRecorded: n('Timing71 slower (lap not recorded)'), conflict: n('Timing71 faster (conflict)'), missing: n('missing in Timing71')};
writeFileSync(`${DIR}/check.json`, JSON.stringify({summary, tolerance: TOL, rows}, null, 1));
console.log(summary);
for (const r of rows.filter(r => /conflict/.test(r.status))) console.log(r.series, r.y, r.track, '#' + r.car, r.status, r.d ?? '', r.session ?? '');
