// Fits 2025 and 2026 car parameters to real qualifying laps on the built tracks, then projects
// 2027 and 2028. Reads worker/lapsim/tracks-data.js and .cache/lapsim/traces.json (from
// build-geometry.mjs); writes worker/lapsim/calibration-data.js and docs/lapsim-report.md.
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {trackFromData} from '../../worker/lapsim/tracks.js';
import {poleTrend} from '../../worker/lapsim/pole-trend.js';
import {PRIOR, applyRules, applyDevelopment, RULE_CHANGES} from '../../worker/lapsim/cars.js';
import {simulateLap} from '../../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../../worker/lapsim/atmosphere.js';
import {fitSeason, withGrip} from './calibrate-lib.mjs';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const ITERS = Number(process.env.LAPSIM_ITERS || 90);
const traces = JSON.parse(await readFile(join(CACHE, 'traces.json'), 'utf8'));
const tracks = Object.fromEntries(Object.entries(lapsimTracks).map(([id, d]) => [id, trackFromData(d)]));
const PARAMS = ['muY', 'clA', 'cdA', 'cdALow', 'pIce'];

const seasons = {};
const report = ['# Lap simulator calibration', '', `Generated ${new Date().toISOString().slice(0, 10)}. Real qualifying laps from OpenF1 on tracks built from OpenF1 car positions.`, ''];
for (const year of [...new Set(traces.map(t => t.year))].sort()) {
  const prior = PRIOR[year]; if (!prior) continue;
  const laps = traces.filter(t => t.year === year && tracks[t.track] && !t.weather.rain && t.s.length > 100)
    .map(t => ({name: t.track, track: tracks[t.track], lapSeconds: t.lap_seconds, weight: t.position === 1 ? 1 : 0.5,
      obs: {s: t.s, v: t.v.map(x => x / 3.6)}, weather: t.weather, meta: {sessionKey: t.session_key, driver: t.driver_number, position: t.position}}));
  if (laps.length < 4) { report.push(`${year}: not enough laps (${laps.length})`); continue; }
  const base = {...structuredClone(prior), linkMu: true};
  const params = PARAMS.map(k => ({key: k, path: k, base: base[k], step: 0.08}));
  const t0 = Date.now();
  const fit = fitSeason(laps, base, params, {iters: ITERS});
  const car = fit.car; delete car.linkMu;
  // per-track result from the pole lap (position 1)
  const perTrack = {};
  for (const p of fit.perTrack) {
    if (p.meta?.position !== 1 && perTrack[p.name]) continue;
    const trace = traces.find(t => t.year === year && t.track === p.name && t.session_key === p.meta?.sessionKey && t.position === p.meta?.position);
    perTrack[p.name] = {grip: +p.grip.toFixed(4), rmsKph: +p.rmsKph.toFixed(1), errorSec: +p.dt.toFixed(3), simLap: +p.simLap.toFixed(3), realLap: p.realLap,
      sessionKey: p.meta?.sessionKey, driver: p.meta?.driver, weather: trace?.weather || null};
  }
  seasons[year] = {car, tracks: perTrack, score: +fit.score.toFixed(3), laps: laps.length};
  report.push(`## ${year}`, '', `${laps.length} laps, fit score ${fit.score.toFixed(3)}, ${((Date.now() - t0) / 1000).toFixed(0)} s.`, '',
    `Car: grip μy ${car.muY.toFixed(3)}, downforce ClA ${car.clA.toFixed(2)} m², drag CdA ${car.cdA.toFixed(3)} m², low-drag CdA ${car.cdALow.toFixed(3)} m², ICE ${(car.pIce / 1e3).toFixed(0)} kW.`, '',
    '| Track | Real | Sim | Error | Speed RMS | Track grip |', '|---|---|---|---|---|---|',
    ...Object.entries(perTrack).map(([id, r]) => `| ${id} | ${r.realLap.toFixed(3)} | ${r.simLap.toFixed(3)} | ${r.errorSec > 0 ? '+' : ''}${r.errorSec.toFixed(3)} | ${r.rmsKph} km/h | ${r.grip} |`), '');
}

// Projections from the latest calibrated season (2026)
const projections = {};
const s26 = seasons[2026];
if (s26) {
  const ids = Object.keys(s26.tracks);
  const lapAt = (car, id) => {
    const r = s26.tracks[id];
    return simulateLap(withGrip(tracks[id], r.grip), car, conditionsFromWeather(r.weather || {})).lapTime;
  };
  const meanChange = (a, b) => ids.reduce((acc, id) => acc + (lapAt(b, id) / lapAt(a, id) - 1), 0) / ids.length * 100;
  // find the development factor that gives the target lap-time change (%)
  const solveDev = (car, target) => {
    let lo = 0, hi = 0.4;
    for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (meanChange(car, applyDevelopment(car, mid)) > target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  // note: applyDevelopment(applyDevelopment(c, a), b) ≈ applyDevelopment(c, a + b) for small a, b
  const step = k => poleTrend.steps[k] || {meanOfMedians: -1, min: -1.5, max: -0.5};
  let dPrev = 0, rulesPrev = s26.car;
  for (const [year, k] of [[2027, '1'], [2028, '2']]) {
    const rules = applyRules(s26.car, year);
    const target = step(k).meanOfMedians;
    // rule effect with development held fixed, then this year's development on top
    const rulesEffect = meanChange(applyDevelopment(rulesPrev, dPrev), applyDevelopment(rules, dPrev));
    const d = dPrev + solveDev(applyDevelopment(rules, dPrev), target);
    const car = applyDevelopment(rules, d);
    car.label = String(year);
    projections[year] = {car, development: +d.toFixed(4), developmentTargetPct: target, bandPct: [step(k).max, step(k).min],
      rulesEffectPct: +rulesEffect.toFixed(2), rules: RULE_CHANGES[year].note};
    dPrev = d; rulesPrev = rules;
  }
  report.push('## Projections', '', ...Object.entries(projections).map(([y, p]) => `- ${y}: rules ${p.rulesEffectPct}% lap time, development ${p.developmentTargetPct}% (historical range ${p.bandPct.join(' to ')}%).`), '');
}

const out = {generatedAt: new Date().toISOString().slice(0, 10), method: 'Nelder–Mead fit of season car parameters plus a per-track grip factor to real pole laps (speed trace and lap time).', seasons, projections};
await writeFile('worker/lapsim/calibration-data.js', `// Generated by scripts/sim/calibrate.mjs. Do not edit by hand.\nexport const lapsimCalibration=${JSON.stringify(out)};\n`);
await writeFile('docs/lapsim-report.md', report.join('\n') + '\n');
console.log(report.join('\n'));
