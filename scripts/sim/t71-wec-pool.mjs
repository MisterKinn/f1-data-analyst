// Experiment (gate): does adding Timing71 qualifying bests of earlier seasons (2023–2024, complete replays,
// half weight) to a WEC class fit lower the leave-one-track-out error on the calibrated season?
// Same reference rows in both set-ups (best car per track from calibration-data.js); a held-out track is
// removed from every year; only the calibrated season's rows are scored.
//   node scripts/sim/t71-wec-pool.mjs [summaryDir] → scripts/sim/data/t71-wec-pool.json
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimCalibration as cal} from '../../worker/lapsim/calibration-data.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {SERIES} from '../../worker/lapsim/series.js';
import {holdout} from './calibrate-lib.mjs';
import {mapSessions} from './t71-tracks.mjs';
import {gate} from './gate.mjs';

const K = lapsimKernel(), dir = process.argv[2] || 'scripts/sim/data/t71', ITERS = +(process.env.LAPSIM_HOLDOUT_ITERS || 40);
const tracks = Object.fromEntries(Object.keys(lapsimTracks).map(id => [id, K.trackFromData(lapsimTracks[id])]));
const f1Grip = id => Object.keys(cal.seasons).sort().reverse().map(y => cal.seasons[y]?.tracks?.[id]?.grip).find(g => g != null) ?? null;
const sessions = mapSessions(JSON.parse(readFileSync(`${dir}/wec.json`, 'utf8')).sessions.map(s => ({...s, key: 'wec'})));
const weatherOf = w => w ? {airTempC: w.air, trackTempC: w.track, humidityPct: w.hum, pressureHpa: w.press, windSpeed: w.wind ?? 0, windFromDeg: 0, rain: false} : {};
const CLS = {lmh: c => /hyper/i.test(c.cls || '') && SERIES.wec.classes.lmh.manufacturers.test(c.make || ''),
  lmdh: c => /hyper/i.test(c.cls || '') && SERIES.wec.classes.lmdh.manufacturers.test(c.make || ''), lmgt3: c => /gt3/i.test(c.cls || '')};

const rowsOut = [];
const result = {method: 'leave-one-track-out on the calibrated season; candidate adds Timing71 2023–2024 qualifying bests (chequered replays, weight 0.5)', classes: {}};
for (const [cls, years] of Object.entries(cal.series.wec)) for (const [year, v] of Object.entries(years)) {
  const def = SERIES.wec.classes[cls];
  const ref = Object.entries(v.tracks).filter(([id]) => tracks[id] && f1Grip(id) != null).map(([id, r]) => ({name: id, track: tracks[id], lapSeconds: r.realLap,
    trapKph: r.trapKph ?? null, weight: 1, grip: f1Grip(id), weather: r.weather || {}}));
  const extra = [];
  for (const s of sessions.filter(s => s.kind === 'Q' && s.endFlag === 'chequered' && tracks[s.track] && f1Grip(s.track) != null)) {
    const y = new Date(s.start * 1e3).getUTCFullYear(); if (y < 2023 || y > 2024) continue;
    const best = Object.values(s.cars).filter(CLS[cls]).filter(c => c.best).sort((a, b) => a.best - b.best)[0];
    if (best && !(s.weather?.wet > 0)) extra.push({year: y, name: s.track, track: tracks[s.track], lapSeconds: best.best, trapKph: best.spd ?? null, weight: 0.5, grip: f1Grip(s.track), weather: weatherOf(s.weather)});
  }
  // keep the fastest extra row per track and year (Hyperpole and Qualifying are separate replays)
  const ex = Object.values(extra.reduce((m, r) => { const o = m[r.name]; if (!o || r.lapSeconds < o.lapSeconds) m[r.name] = r; return m; }, {}));
  if (year === Object.keys(years)[0]) for (const r of ex) rowsOut.push({cls, track: r.name, year: r.year, lap: r.lapSeconds, trapKph: r.trapKph, weather: r.weather});
  const base = {...structuredClone(v.car), linkMu: true};
  const params = Object.entries(def.bounds).map(([k, [lo, hi]]) => ({key: k, path: k, base: base[k], step: 0.08, min: lo, max: hi}));
  const opts = {iters: ITERS, folds: 99, gripFor: l => l.grip};
  const hA = holdout(ref, base, params, opts), hB = holdout([...ref, ...ex], base, params, opts);
  const byName = h => Object.fromEntries(h.errors.map(e => [e.name, e.pct]));
  const a = byName(hA), b = byName(hB), names = Object.keys(a).filter(n => n in b);
  const g = gate(names.map(n => a[n]), names.map(n => b[n]), {minRows: 4});
  result.classes[`${cls}/${year}`] = {refTracks: ref.length, extraRows: ex.length, extraTracks: ex.map(r => r.name), looRmsCurrent: +g.rmsCur.toFixed(2), looRmsCandidate: +g.rmsNew.toFixed(2), gate: g.reason, accept: g.accept};
  console.log(cls, year, JSON.stringify(result.classes[`${cls}/${year}`]));
}
writeFileSync('scripts/sim/data/t71-wec-pool.json', JSON.stringify(result, null, 1));
// rows for calibrate.mjs (best class lap per track, 2023–2024, chequered Timing71 replays)
writeFileSync('scripts/sim/data/t71-wec-extra.json', JSON.stringify({source: 'Timing71 archive, calibration use only', rows: rowsOut}, null, 1));
