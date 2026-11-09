// S5 — validation table. For every F1 pole lap the model was calibrated on: corner minimum speeds,
// speed trap (lap maximum), braking points, sectors and lap, model vs real (OpenF1 trace). Plus the
// held-out tests the acceptance uses: 2025↔2026 (track left out, factor from the other season) and
// F1→WEC (WEC lap on a track left out of the WEC fit, F1 track factor).
//   node scripts/sim/validate.mjs [name] → probe-out/validate-<name>.json (needs .cache/lapsim/traces.json)
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {trackFromData} from '../../worker/lapsim/tracks.js';
import {simulateLap} from '../../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../../worker/lapsim/atmosphere.js';
import {rechargeLimitMJ} from '../../worker/lapsim/energy-limits.js';
import {withGrip, bestShift, traceOnTrack, realExtremes, addBanking} from './calibrate-lib.mjs';

const name = process.argv[2] || 'run';
const {lapsimCalibration: cal} = await import(`../../worker/lapsim/calibration-data.js?${Date.now()}`);
const traces = JSON.parse(readFileSync('.cache/lapsim/traces.json', 'utf8'));
const rms = a => a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : null;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const r3 = x => x == null ? null : +x.toFixed(3);
const kv = process.env.LAPSIM_KV === 'on';
const bankData = process.env.LAPSIM_BANK === 'on' ? JSON.parse(readFileSync('scripts/sim/data/banking.json', 'utf8')) : null;
const addBankingTo = (id, tr) => addBanking(id, tr, bankData);

// braking point before a corner minimum: last point (going backwards) where speed is within 3 km/h of the
// preceding maximum
function brakePoint(s, v, k) {
  let j = k, vmax = v[k];
  while (j > 0 && v[j - 1] >= v[j] - 0.05) { j--; vmax = Math.max(vmax, v[j]); if (k - j > 400) break; }
  let b = j; for (let i = j; i <= k; i++) if (v[i] >= vmax - 3 / 3.6) b = i;
  return s[b];
}

const rows = [];
for (const [year, season] of Object.entries(cal.seasons || {})) for (const [id, r] of Object.entries(season.tracks || {})) {
  const t = traces.find(x => String(x.year) === year && x.track === id && x.session_key === r.sessionKey && x.position === r.position);
  if (!t || !lapsimTracks[id]) continue;
  const tr = trackFromData(lapsimTracks[id]);
  if (bankData) addBankingTo(id, tr);
  if (kv && tr.grade) { const g = tr.grade, n = g.length; tr.kv = Float64Array.from(g, (_, i) => (g[(i + 1) % n] - g[(i - 1 + n) % n]) / (2 * tr.ds)); }
  const car = r.drag ? {...season.car, cdA: season.car.cdA * r.drag, cdALow: season.car.cdALow * r.drag} : season.car;
  const mj = +year >= 2026 ? rechargeLimitMJ(id, +year) : null;
  const res = simulateLap(withGrip(tr, r.grip), car, conditionsFromWeather(mj ? {...r.weather, rechargeMJ: mj} : r.weather || {}));
  const L = tr.kappa.length * tr.ds, trace = {s: t.s, v: t.v.map(x => x / 3.6)};
  const {shift} = bestShift(res.v, tr.ds, trace, L);
  const obs = traceOnTrack(trace, L, shift);
  const mins = realExtremes(obs, 15 / 3.6).filter(e => e.min);
  const h = Math.round(50 / tr.ds), n = res.v.length;
  const corner = mins.map(e => { const i0 = Math.round(e.s / tr.ds); let x = Infinity, at = i0; for (let j = -h; j <= h; j++) { const i = ((i0 + j) % n + n) % n; if (res.v[i] < x) { x = res.v[i]; at = i; } } return {s: e.s, real: e.v * 3.6, sim: x * 3.6, at}; });
  // braking: real braking point vs simulated one before the same corner
  const simS = Array.from(res.v, (_, i) => i * tr.ds);
  const brake = corner.map(c => { const k = obs.s.findIndex(s => s >= c.s); if (k < 1) return null; const real = brakePoint(obs.s, obs.v, k), sim = brakePoint(simS, Array.from(res.v), c.at); const d = sim - real; return Math.abs(d) < L / 2 ? d : null; }).filter(x => x != null && Math.abs(x) < 200);
  const mult = r.simLap / res.lapTime; // team / development multiplier used in the fit
  const sec = r.realSectors && res.sectors?.length === 3 ? res.sectors.map((x, i) => (x * mult / r.realSectors[i] - 1) * 100) : [];
  rows.push({series: 'f1', year: +year, track: id, lapPct: r3(r.errorSec / r.realLap * 100),
    sectorPct: sec.map(r3), cornerKph: {n: corner.length, rms: r3(rms(corner.map(c => c.sim - c.real))), bias: r3(mean(corner.map(c => c.sim - c.real)))},
    trapKph: r3(res.vMaxKph - Math.max(...t.v)), brakeM: {n: brake.length, rms: r3(rms(brake)), bias: r3(mean(brake))}});
}
const pick = (f, a) => a.map(f).filter(x => x != null);
const summary = {};
for (const y of [...new Set(rows.map(r => r.year))]) {
  const R = rows.filter(r => r.year === y);
  summary[`f1/${y}`] = {tracks: R.length, lapRmsPct: r3(rms(pick(r => r.lapPct, R))), sectorRmsPct: r3(rms(R.flatMap(r => r.sectorPct))),
    cornerRmsKph: r3(rms(R.flatMap(r => r.cornerKph.rms != null ? [r.cornerKph.rms] : []))), cornerBiasKph: r3(mean(pick(r => r.cornerKph.bias, R))),
    trapRmsKph: r3(rms(pick(r => r.trapKph, R))), trapBiasKph: r3(mean(pick(r => r.trapKph, R))), brakeRmsM: r3(rms(R.flatMap(r => r.brakeM.rms != null ? [r.brakeM.rms] : []))), brakeBiasM: r3(mean(pick(r => r.brakeM.bias, R))),
    holdout2025to2026Pct: cal.seasons[y]?.holdout?.rmsPct ?? null};
}
for (const [cls, ys] of Object.entries(cal.series?.wec || {})) for (const [y, s] of Object.entries(ys)) {
  const tr = Object.values(s.tracks), traps = tr.filter(t => t.trapKph);
  summary[`wec-${cls}/${y}`] = {tracks: tr.length, lapRmsPct: r3(rms(tr.map(t => t.errorSec / t.realLap * 100))), trapRmsKph: r3(rms(traps.map(t => t.simTopKph - t.trapKph))),
    trapBiasKph: r3(mean(traps.map(t => t.simTopKph - t.trapKph))), f1ToWecHoldoutPct: s.holdout?.rmsPct ?? null, clA: r3(s.car.clA), muY: r3(s.car.muY)};
}
mkdirSync('probe-out', {recursive: true});
writeFileSync(`probe-out/validate-${name}.json`, JSON.stringify({summary, rows}, null, 1));
console.log(JSON.stringify(summary, null, 1));
