// GT3 transfer test: the calibrated WEC LMGT3 car predicts GT3 qualifying in other series (Timing71:
// GTWC, DTM, IGTC; chequered replays, dry, simulator tracks only). Candidate: one pace factor per series
// (tyres, BoP level), fitted leave-one-track-out; gate vs the LMGT3 car unchanged.
//   node scripts/sim/t71-gt3.mjs [summaryDir] → scripts/sim/data/t71-gt3.json
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {mapSessions} from './t71-tracks.mjs';
import {gate} from './gate.mjs';

const K = lapsimKernel(), dir = process.argv[2] || 'scripts/sim/data/t71';
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const rows = [];
for (const key of ['gtwc', 'dtm', 'igtc']) {
  if (!existsSync(`${dir}/${key}.json`)) continue;
  for (const s of mapSessions(JSON.parse(readFileSync(`${dir}/${key}.json`, 'utf8')).sessions.map(x => ({...x, key})))) {
    if (s.kind !== 'Q' || s.endFlag !== 'chequered' || !lapsimTracks[s.track] || s.weather?.wet > 0) continue;
    const year = new Date(s.start * 1e3).getUTCFullYear(); if (year < 2023) continue;
    const best = Object.values(s.cars).filter(c => c.best && !/gt4|tcr|cup|am$/i.test(c.cls || '')).sort((a, b) => a.best - b.best)[0];
    if (!best) continue;
    const c = carsFor(s.track)['wec-lmgt3']; if (!c) continue;
    const tr = K.trackFromData(lapsimTracks[s.track]); tr.mu.fill(c.grip);
    const w = s.weather || {};
    const env = K.conditionsFromWeather({airTempC: w.air, trackTempC: w.track, humidityPct: w.hum, pressureHpa: w.press, windSpeed: 0});
    const sim = K.simulateLap(tr, c.car, env).lapTime;
    rows.push({series: key, track: s.track, year, session: s.description, real: best.best, sim: +sim.toFixed(3), ratio: best.best / sim});
  }
}
// keep the fastest qualifying per series, track and year
const uniq = Object.values(rows.reduce((m, r) => { const k = `${r.series}|${r.track}|${r.year}`; if (!m[k] || r.real < m[k].real) m[k] = r; return m; }, {}));
const result = {method: 'LMGT3 car (calibrated WEC) vs GT3 qualifying bests; candidate = one pace factor per series, leave one track out', series: {}};
for (const ser of [...new Set(uniq.map(r => r.series))]) {
  const rs = uniq.filter(r => r.series === ser), tracks = [...new Set(rs.map(r => r.track))];
  const eCur = [], eNew = [];
  for (const t of tracks) {
    const f = median(rs.filter(r => r.track !== t).map(r => r.ratio));
    for (const r of rs.filter(r => r.track === t)) { eCur.push((r.ratio - 1) * 100); eNew.push((r.ratio / (Number.isFinite(f) ? f : 1) - 1) * 100); }
  }
  const g = gate(eCur, eNew, {minRows: 4});
  result.series[ser] = {rows: rs.length, tracks, factor: +median(rs.map(r => r.ratio)).toFixed(4), looRmsLmgt3: +g.rmsCur.toFixed(2), looRmsWithFactor: +g.rmsNew.toFixed(2), gate: g.reason, accept: g.accept,
    detail: rs.map(r => `${r.year} ${r.track} real ${r.real} sim ${r.sim}`)};
}
writeFileSync('scripts/sim/data/t71-gt3.json', JSON.stringify(result, null, 1));
for (const [k, v] of Object.entries(result.series)) console.log(k, v.rows, 'rows', v.tracks.join(','), 'factor', v.factor, 'LOO', v.looRmsLmgt3, '→', v.looRmsWithFactor, v.gate);
