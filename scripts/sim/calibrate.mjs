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
import {fitSeason, withGrip, holdout} from './calibrate-lib.mjs';
import {SERIES} from '../../worker/lapsim/series.js';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const ITERS = Number(process.env.LAPSIM_ITERS || 90), HOLDOUT_ITERS = Number(process.env.LAPSIM_HOLDOUT_ITERS || 40);
const traces = JSON.parse(await readFile(join(CACHE, 'traces.json'), 'utf8'));
const tracks = Object.fromEntries(Object.entries(lapsimTracks).map(([id, d]) => [id, trackFromData(d)]));
const PARAMS = ['muY', 'clA', 'cdA', 'cdALow', 'pIce'];
// physical bounds, so geometry error cannot be absorbed by impossible cars. ClA up to 8 m²:
// modern F1 cars make about 3.5x their weight in downforce near 300 km/h (ClA ≈ 6.5–7). The fitted
// values are effective ones: they also absorb what the quasi-steady-state model leaves out.
const BOUNDS = {muY: [1.5, 2.4], clA: [2.5, 8], cdA: [0.7, 1.9], cdALow: [0.45, 1.6], pIce: [0.85, 1.15]};

const seasons = {};
const report = ['# Lap simulator calibration', '', `Generated ${new Date().toISOString().slice(0, 10)}. Real qualifying laps from OpenF1 on tracks built from OpenF1 car positions.`, ''];
for (const year of [...new Set(traces.map(t => t.year))].sort()) {
  const prior = PRIOR[year]; if (!prior) continue;
  const laps = traces.filter(t => t.year === year && tracks[t.track] && !t.weather.rain && t.s.length > 100)
    .map(t => ({name: t.track, track: tracks[t.track], lapSeconds: t.lap_seconds, weight: t.position === 1 ? 1 : 0.5,
      obs: {s: t.s, v: t.v.map(x => x / 3.6)}, weather: t.weather, meta: {sessionKey: t.session_key, driver: t.driver_number, position: t.position}}));
  if (laps.length < 4) { report.push(`${year}: not enough laps (${laps.length})`); continue; }
  const base = {...structuredClone(prior), linkMu: true};
  const params = PARAMS.map(k => {
    const [lo, hi] = BOUNDS[k], rel = k === 'pIce';
    return {key: k, path: k, base: base[k], step: 0.08, min: rel ? lo * base[k] : lo, max: rel ? hi * base[k] : hi};
  });
  const t0 = Date.now();
  const fit = fitSeason(laps, base, params, {iters: ITERS});
  const car = fit.car; delete car.linkMu;
  // per-track result from the pole lap (position 1)
  const perTrack = {};
  for (const p of fit.perTrack) {
    if (p.meta?.position !== 1 && perTrack[p.name]) continue;
    const trace = traces.find(t => t.year === year && t.track === p.name && t.session_key === p.meta?.sessionKey && t.position === p.meta?.position);
    perTrack[p.name] = {grip: +p.grip.toFixed(4), rmsKph: +p.rmsKph.toFixed(1), errorSec: +p.dt.toFixed(3), simLap: +p.simLap.toFixed(3), realLap: p.realLap,
      sessionKey: p.meta?.sessionKey, driver: p.meta?.driver, position: p.meta?.position ?? 1, weather: trace?.weather || null};
  }
  seasons[year] = {car, tracks: perTrack, score: +fit.score.toFixed(3), laps: laps.length, fitLaps: laps, base, params};
  report.push(`## ${year}`, '', `${laps.length} laps, fit score ${fit.score.toFixed(3)}, ${((Date.now() - t0) / 1000).toFixed(0)} s.`, '',
    `Car: grip μy ${car.muY.toFixed(3)}, downforce ClA ${car.clA.toFixed(2)} m², drag CdA ${car.cdA.toFixed(3)} m², low-drag CdA ${car.cdALow.toFixed(3)} m², ICE ${(car.pIce / 1e3).toFixed(0)} kW.`, '',
    '| Track | Real | Sim | Error | Speed RMS | Track grip |', '|---|---|---|---|---|---|',
    ...Object.entries(perTrack).map(([id, r]) => `| ${id} | ${r.realLap.toFixed(3)} | ${r.simLap.toFixed(3)} | ${r.errorSec > 0 ? '+' : ''}${r.errorSec.toFixed(3)} | ${r.rmsKph} km/h | ${r.grip} |`), '');
}

// Holdout (common rule): refit without a quarter of the tracks, then predict their pole laps using
// the track factor fitted in the other season. Tests the car fit on tracks it has not seen.
const otherGrip = (year, id) => Object.entries(seasons).filter(([y]) => Number(y) !== year).map(([, s]) => s.tracks[id]?.grip).find(g => g != null) ?? null;
for (const [year, s] of Object.entries(seasons)) {
  const h = holdout(s.fitLaps, s.base, s.params, {iters: HOLDOUT_ITERS, gripFor: l => otherGrip(Number(year), l.name)});
  s.holdout = {rmsPct: h.rmsPct != null ? +h.rmsPct.toFixed(2) : null, n: h.n, tracks: h.errors.map(e => ({track: e.name, errorSec: +e.dt.toFixed(3)}))};
  report.push(`### ${year} holdout`, '', h.n ? `Predicted ${h.n} unseen pole laps: typical error ${h.rmsPct.toFixed(2)}% (RMS).` : 'No track had a factor from another season.', '');
  delete s.fitLaps; delete s.base; delete s.params;
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

// WEC classes, same rules: BoP values fixed; drag, downforce and tyre grip fitted to the best
// qualifying/Hyperpole laps (lap time + speed trap). Track factors are shared from the F1 fit.
const series = {};
const wec = JSON.parse(await readFile(join(CACHE, 'wec.json'), 'utf8').catch(() => '[]'));
const f1Grip = id => [2026, 2025].map(y => seasons[y]?.tracks?.[id]?.grip).find(g => g != null) ?? null;
for (const [cls, def] of Object.entries(SERIES.wec.classes)) {
  for (const year of [...new Set(wec.map(w => w.year))].sort()) {
    const sessions = wec.filter(w => w.cls === cls && w.year === year && tracks[w.track] && !w.weather?.rain && f1Grip(w.track) != null);
    const laps = sessions.flatMap(w => w.laps.map((l, i) => ({name: w.track, track: tracks[w.track], lapSeconds: l.lap, trapKph: l.topSpeedKph,
      weight: i === 0 ? 1 : 0.5, grip: f1Grip(w.track), weather: w.weather || {}, meta: {event: w.event, car: l.car, manufacturer: l.manufacturer, session: l.session}})));
    if (new Set(laps.map(l => l.name)).size < 3) { report.push(`WEC ${cls} ${year}: not enough tracks (${new Set(laps.map(l => l.name)).size})`); continue; }
    const base = {...structuredClone(def.prior), linkMu: true};
    const params = Object.entries(def.bounds).map(([k, [lo, hi]]) => ({key: k, path: k, base: base[k], step: 0.08, min: lo, max: hi}));
    const fit = fitSeason(laps, base, params, {iters: ITERS});
    const car = fit.car; delete car.linkMu;
    const perTrack = {};
    for (const p of fit.perTrack) if (!perTrack[p.name]) {
      const w = sessions.find(x => x.track === p.name);
      perTrack[p.name] = {grip: +p.grip.toFixed(4), errorSec: +p.dt.toFixed(3), simLap: +p.simLap.toFixed(3), realLap: p.realLap,
        trapKph: p.vMaxReal, simTopKph: +p.vMaxSim.toFixed(1), event: p.meta.event, car: p.meta.car, manufacturer: p.meta.manufacturer, weather: w?.weather || null};
    }
    const h = holdout(laps, base, params, {iters: HOLDOUT_ITERS, folds: 99, gripFor: l => l.grip});
    ((series.wec ||= {})[cls] ||= {})[year] = {car, tracks: perTrack, score: +fit.score.toFixed(3), laps: laps.length,
      holdout: {rmsPct: h.rmsPct != null ? +h.rmsPct.toFixed(2) : null, n: h.n, tracks: h.errors.map(e => ({track: e.name, errorSec: +e.dt.toFixed(3)}))}};
    report.push(`## WEC ${def.label.en} ${year}`, '', `${laps.length} laps on ${Object.keys(perTrack).length} tracks, fit score ${fit.score.toFixed(3)}. Holdout (one track left out at a time): ${h.rmsPct?.toFixed(2) ?? '–'}% RMS over ${h.n} laps.`, '',
      `Car: grip μy ${car.muY.toFixed(3)}, downforce ClA ${car.clA.toFixed(2)} m², drag CdA ${car.cdA.toFixed(3)} m² (mass ${car.mass} kg and ${(car.pIce / 1e3).toFixed(0)} kW fixed).`, '',
      '| Track | Real | Sim | Error | Trap | Sim top | Track factor (F1) |', '|---|---|---|---|---|---|---|',
      ...Object.entries(perTrack).map(([id, r]) => `| ${id} | ${r.realLap.toFixed(3)} | ${r.simLap.toFixed(3)} | ${r.errorSec > 0 ? '+' : ''}${r.errorSec.toFixed(3)} | ${r.trapKph ?? '–'} | ${r.simTopKph} | ${r.grip} |`), '');
  }
}

const out = {generatedAt: new Date().toISOString().slice(0, 10), method: 'Nelder–Mead fit of season car parameters plus a per-track grip factor to real pole laps (speed trace and lap time); WEC classes fitted to lap time and speed trap with F1 track factors.', seasons, projections, series};
await writeFile('worker/lapsim/calibration-data.js', `// Generated by scripts/sim/calibrate.mjs. Do not edit by hand.\nexport const lapsimCalibration=${JSON.stringify(out)};\n`);
await writeFile('docs/lapsim-report.md', report.join('\n') + '\n');
console.log(report.join('\n'));
