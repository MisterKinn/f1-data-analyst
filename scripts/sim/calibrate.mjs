// Fits 2023–2026 car parameters to real qualifying laps on the built tracks, then projects
// 2027 and 2028. Reads worker/lapsim/tracks-data.js and .cache/lapsim/traces.json (from
// build-geometry.mjs); writes worker/lapsim/calibration-data.js and docs/lapsim-report.md.
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {trackFromData} from '../../worker/lapsim/tracks.js';
import {poleTrend} from '../../worker/lapsim/pole-trend.js';
import {rechargeLimitMJ} from '../../worker/lapsim/energy-limits.js';
import {PRIOR, applyRules, applyDevelopment, RULE_CHANGES} from '../../worker/lapsim/cars.js';
import {simulateLap} from '../../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../../worker/lapsim/atmosphere.js';
import {fitSeason, withGrip, holdout, fitJoint, holdoutJoint} from './calibrate-lib.mjs';
import {fitJointBCD, holdoutBCD, backtestBCD} from './joint-bcd.mjs';
import {SERIES} from '../../worker/lapsim/series.js';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const ITERS = Number(process.env.LAPSIM_ITERS || 70), HOLDOUT_ITERS = Number(process.env.LAPSIM_HOLDOUT_ITERS || 25);
// experiment knobs (defaults are the published settings)
const WTIME = Number(process.env.LAPSIM_WTIME || 2);
const E = process.env;
const FITTER = E.LAPSIM_FITTER || 'nm';
const BCD = {rounds: Number(E.LAPSIM_ROUNDS || 4), iters: Number(E.LAPSIM_BCD_ITERS || 150), wTime: WTIME, wSector: Number(E.LAPSIM_WSECTOR || 0),
  trackDrag: E.LAPSIM_TRACK_DRAG === 'on', wPrior: Number(E.LAPSIM_WPRIOR || 2), log: m => console.log(m)};
const MAX_POS = Number(E.LAPSIM_MAX_POS || 3);
const HOLDOUT_YEARS = (E.LAPSIM_HOLDOUT_YEARS || '2025,2026').split(',').map(Number);
const fitAll = gs => FITTER === 'bcd' ? fitJointBCD(gs, BCD) : fitJoint(gs, {iters: ITERS, wTime: WTIME});
const holdoutOf = (gs, key) => FITTER === 'bcd' ? holdoutBCD(gs, key, {...BCD, rounds: Math.max(2, BCD.rounds - 1)}) : holdoutJoint(gs, key, {iters: HOLDOUT_ITERS, wTime: WTIME});
const GRIP_LIMITS = FITTER === 'bcd' ? [0.7, 1.3] : [0.85, 1.15];
const ONLY_YEARS = process.env.LAPSIM_SEASONS ? process.env.LAPSIM_SEASONS.split(',').map(Number) : null;
const traces = JSON.parse(await readFile(join(CACHE, 'traces.json'), 'utf8'));
const tracks = Object.fromEntries(Object.entries(lapsimTracks).map(([id, d]) => [id, trackFromData(d)]));
const PARAMS = ['muY', 'clA', 'cdA', 'cdALow', 'pIce'];
// physical bounds, so geometry error cannot be absorbed by impossible cars. ClA up to 8 m²:
// modern F1 cars make about 3.5x their weight in downforce near 300 km/h (ClA ≈ 6.5–7). The fitted
// values are effective ones: they also absorb what the quasi-steady-state model leaves out.
const BOUNDS = {muY: [1.5, 2.4], clA: [2.5, 8], cdA: [0.7, 1.9], cdALow: [0.45, 1.6], pIce: [0.85, 1.15]};

const seasons = {};
const report = ['# Lap simulator calibration', '', `Generated ${new Date().toISOString().slice(0, 10)}. Real qualifying laps from OpenF1 on tracks built from OpenF1 car positions.`, ''];
// F1: all seasons fitted together (common rule): one car per season, one grip factor per track
// shared by every season (same asphalt and line), so a car can be predicted on a track it has not
// raced yet with the factor learned from another season.
// 2026+ qualifying laps: the per-event ERS recharge limit is part of the conditions
const withEnergy = (w, id, year) => { const mj = year >= 2026 && process.env.LAPSIM_ENERGY_LIMITS !== 'off' ? rechargeLimitMJ(id, year) : null; return mj ? {...w, rechargeMJ: mj} : w; };
const groups = [];
for (const year of [...new Set(traces.map(t => t.year))].sort()) {
  const prior = PRIOR[year]; if (!prior || (ONLY_YEARS && !ONLY_YEARS.includes(year))) continue;
  const laps = traces.filter(t => t.year === year && tracks[t.track] && !t.weather.rain && t.s.length > 100 && t.position <= MAX_POS)
    .map(t => ({name: t.track, track: tracks[t.track], lapSeconds: t.lap_seconds, weight: t.position === 1 ? 1 : 0.5,
      // non-pole laps: other cars, so by default they count for the speed trace shape only
      timeScale: t.position === 1 || E.LAPSIM_NONPOLE === 'time' ? 1 : 0, sectors: t.sectors, date: t.date,
      obs: {s: t.s, v: t.v.map(x => x / 3.6)}, weather: withEnergy(t.weather, t.track, year), meta: {sessionKey: t.session_key, driver: t.driver_number, position: t.position}}));
  if (laps.length < 4) { report.push(`${year}: not enough laps (${laps.length})`); continue; }
  const base = {...structuredClone(prior), linkMu: true};
  if (process.env.LAPSIM_THROTTLE_HARVEST === 'off' && base.ers) base.ers.throttleHarvest = false;
  const params = PARAMS.map(k => {
    const [lo, hi] = BOUNDS[k], rel = k === 'pIce';
    return {key: k, path: k, base: base[k], step: 0.08, min: rel ? lo * base[k] : lo, max: rel ? hi * base[k] : hi};
  });
  groups.push({key: year, laps, base, params});
}
const t0 = Date.now();
let joint = await fitAll(groups);
// clean data (common rule): a lap more than 4% off after the fit is not a normal dry lap
// (wet track, red flag, wrong lap); drop that season's laps on that track and fit again
const bad = joint.perLap.filter(p => Math.abs(p.dt / p.realLap) > 0.04);
if (bad.length) {
  for (const g of groups) { const drop = new Set(bad.filter(p => p.group === g.key).map(p => p.name)); g.laps = g.laps.filter(l => !drop.has(l.name)); }
  report.push(`Dropped (lap more than 4% off after the first fit): ${[...new Set(bad.map(p => p.group + ' ' + p.name))].join(', ')}`, '');
  joint = await fitAll(groups);
}
report.push(`F1 joint fit of ${groups.map(g => g.key).join(' and ')}: ${((Date.now() - t0) / 1000).toFixed(0)} s, score ${joint.score.toFixed(3)}.`, '');
for (const g of groups) {
  const year = g.key, car = joint.cars[year]; delete car.linkMu;
  const perTrack = {};
  for (const p of joint.perLap.filter(x => x.group === year)) {
    if (p.meta?.position !== 1 && perTrack[p.name]) continue;
    const trace = traces.find(t => t.year === year && t.track === p.name && t.session_key === p.meta?.sessionKey && t.position === p.meta?.position);
    perTrack[p.name] = {grip: +p.grip.toFixed(4), drag: p.drag != null && p.drag !== 1 ? +p.drag.toFixed(4) : undefined, rmsKph: +p.rmsKph.toFixed(1), errorSec: +p.dt.toFixed(3), simLap: +p.simLap.toFixed(3), realLap: p.realLap,
      sessionKey: p.meta?.sessionKey, driver: p.meta?.driver, position: p.meta?.position ?? 1, weather: trace?.weather || null};
  }
  // holdout: this season's laps on a quarter of the tracks left out, predicted with the factor the
  // other season gives that track
  const h = HOLDOUT_YEARS.includes(year) ? await holdoutOf(groups, year) : {n: 0, errors: [], rmsPct: null};
  seasons[year] = {car, tracks: perTrack, laps: g.laps.length,
    holdout: {rmsPct: h.rmsPct != null ? +h.rmsPct.toFixed(2) : null, n: h.n, tracks: h.errors.map(e => ({track: e.name, errorSec: +e.dt.toFixed(3)}))}};
  report.push(`## ${year}`, '', `${g.laps.length} laps. Holdout: ${h.n ? `predicted ${h.n} unseen pole laps, typical error ${h.rmsPct.toFixed(2)}% (RMS)` : 'no track had a factor from another season'}.`, '',
    `Car: grip μy ${car.muY.toFixed(3)}, downforce ClA ${car.clA.toFixed(2)} m², drag CdA ${car.cdA.toFixed(3)} m², low-drag CdA ${car.cdALow.toFixed(3)} m², ICE ${(car.pIce / 1e3).toFixed(0)} kW.`, '',
    '| Track | Real | Sim | Error | Corner/straight speed error | Track grip (shared) |', '|---|---|---|---|---|---|',
    ...Object.entries(perTrack).map(([id, r]) => `| ${id} | ${r.realLap.toFixed(3)} | ${r.simLap.toFixed(3)} | ${r.errorSec > 0 ? '+' : ''}${r.errorSec.toFixed(3)} | ${r.rmsKph} km/h | ${r.grip}${r.drag ? ` / drag ${r.drag}` : ''}${r.grip <= GRIP_LIMITS[0] + 0.001 || r.grip >= GRIP_LIMITS[1] - 0.001 ? ' (at limit: check this track)' : ''} |`), '');
}

// Predictions for 2026 tracks not raced yet (e.g. Las Vegas, Qatar, Abu Dhabi): the 2026 car on
// the track factors learned from earlier seasons, weather of the latest real qualifying there, and
// the 2026 recharge limit of that event. Error range: the 2026 holdout error.
if (seasons[2026]) {
  const car26 = joint.cars[2026], preds = {};
  for (const id of Object.keys(joint.grips)) {
    if (seasons[2026].tracks[id] || !tracks[id]) continue;
    const last = [...traces].filter(t => t.track === id && t.position === 1 && !t.weather.rain).sort((a, b) => b.year - a.year)[0];
    if (!last) continue;
    const drag = joint.factors?.[id]?.drag ?? 1, c = drag !== 1 ? {...car26, cdA: car26.cdA * drag, cdALow: car26.cdALow * drag} : car26;
    const w = withEnergy(last.weather, id, 2026), res = simulateLap(withGrip(tracks[id], joint.grips[id]), c, conditionsFromWeather(w));
    preds[id] = {lap: +res.lapTime.toFixed(3), sectors: res.sectors?.map(x => +x.toFixed(3)), grip: +joint.grips[id].toFixed(4), drag: drag !== 1 ? +drag.toFixed(4) : undefined,
      weatherFrom: last.year, rechargeMJ: w.rechargeMJ ?? null, lastPole: {year: last.year, lap: last.lap_seconds}};
  }
  seasons[2026].predictions = preds;
  const h = seasons[2026].holdout?.rmsPct;
  report.push('## 2026 predictions (tracks not raced yet in 2026)', '', '| Track | Predicted pole | ± (holdout) | Last real pole | Weather from | Recharge limit |', '|---|---|---|---|---|---|',
    ...Object.entries(preds).map(([id, p]) => `| ${id} | ${p.lap.toFixed(3)} | ${h != null ? '±' + (p.lap * h / 100).toFixed(2) + ' s' : '–'} | ${p.lastPole.lap.toFixed(3)} (${p.lastPole.year}) | ${p.weatherFrom} | ${p.rechargeMJ ?? '–'} MJ |`), '');
}

// Forecast test (strictest): each 2026 qualifying predicted from data dated before it only
if (FITTER === 'bcd' && E.LAPSIM_BACKTEST === 'on' && groups.some(g => g.key === 2026)) {
  const b = await backtestBCD(groups, 2026, {...BCD, rounds: 2, iters: Math.round(BCD.iters * 0.6)});
  seasons[2026].backtest = {rmsPct: b.rmsPct != null ? +b.rmsPct.toFixed(2) : null, n: b.n, tracks: b.errors.map(e => ({track: e.name, date: e.date, errorSec: +e.dt.toFixed(3)}))};
  report.push('## 2026 forecast test', '', `Each 2026 pole lap predicted from earlier data only: ${b.rmsPct?.toFixed(2) ?? '–'}% RMS over ${b.n} laps.`, '',
    '| Date | Track | Error (s) |', '|---|---|---|', ...b.errors.map(e => `| ${e.date} | ${e.name} | ${e.dt > 0 ? '+' : ''}${e.dt.toFixed(3)} |`), '');
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
const wec = process.env.LAPSIM_SKIP_WEC ? [] : JSON.parse(await readFile(join(CACHE, 'wec.json'), 'utf8').catch(() => '[]'));
const f1Grip = id => Object.keys(seasons).sort().reverse().map(y => seasons[y]?.tracks?.[id]?.grip).find(g => g != null) ?? null;
for (const [cls, def] of Object.entries(SERIES.wec.classes)) {
  for (const year of [...new Set(wec.map(w => w.year))].sort()) {
    const sessions = wec.filter(w => w.cls === cls && w.year === year && tracks[w.track] && !w.weather?.rain && f1Grip(w.track) != null);
    // speed traps sit at different places on each track: use one only when it looks like a top speed
    const traps = sessions.flatMap(w => w.laps.map(l => l.topSpeedKph)).filter(Number.isFinite).sort((a, b) => a - b);
    const medTrap = traps[Math.floor(traps.length / 2)];
    const laps = sessions.flatMap(w => w.laps.map((l, i) => ({name: w.track, track: tracks[w.track], lapSeconds: l.lap, trapKph: l.topSpeedKph >= 0.92 * medTrap ? l.topSpeedKph : null,
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
