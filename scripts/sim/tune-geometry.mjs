// Chooses the track-line smoothing by data, not by hand: builds the tracks with a few smoothing
// settings, fits the latest season's car to the pole laps on each, and keeps the setting whose
// fit is best (corner/straight speeds and lap times) with track grip factors closest to 1.
// Then builds the final tracks with it. Writes the comparison to docs/lapsim-geometry.md.
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {trackFromData} from '../../worker/lapsim/tracks.js';
import {PRIOR} from '../../worker/lapsim/cars.js';
import {fitSeason} from './calibrate-lib.mjs';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const VARIANTS = JSON.parse(process.env.LAPSIM_GEOMETRY_VARIANTS || '[{"LAPSIM_POS_K":"0"},{"LAPSIM_POS_K":"0.4"},{"LAPSIM_POS_K":"0.7"},{"LAPSIM_POS_K":"0.4","LAPSIM_KAPPA_K":"0.8"}]');
const ITERS = Number(process.env.LAPSIM_TUNE_ITERS || 35);
const BOUNDS = {muY: [1.5, 2.4], clA: [2.5, 8], cdA: [0.7, 1.9], cdALow: [0.45, 1.6], pIce: [0.85, 1.15]};
await mkdir(join(CACHE, 'tune'), {recursive: true});

const rows = [];
for (const [i, v] of VARIANTS.entries()) {
  const tracksOut = join(CACHE, 'tune', `tracks-${i}.mjs`), tracesOut = join(CACHE, 'tune', `traces-${i}.json`);
  execFileSync('node', ['scripts/sim/build-geometry.mjs'], {env: {...process.env, ...v, LAPSIM_TRACKS_OUT: tracksOut, LAPSIM_TRACES_OUT: tracesOut}, stdio: 'ignore'});
  const {lapsimTracks} = await import(pathToFileURL(tracksOut).href);
  const traces = JSON.parse(await readFile(tracesOut, 'utf8'));
  const year = Math.max(...traces.map(t => t.year));
  const laps = traces.filter(t => t.year === year && t.position === 1 && lapsimTracks[t.track] && !t.weather.rain && t.s.length > 100)
    .map(t => ({name: t.track, track: trackFromData(lapsimTracks[t.track]), lapSeconds: t.lap_seconds, weight: 1, obs: {s: t.s, v: t.v.map(x => x / 3.6)}, weather: t.weather}));
  const base = {...structuredClone(PRIOR[year]), linkMu: true};
  const params = Object.entries(BOUNDS).map(([k, [lo, hi]]) => ({key: k, path: k, base: base[k], step: 0.08, min: k === 'pIce' ? lo * base[k] : lo, max: k === 'pIce' ? hi * base[k] : hi}));
  const fit = fitSeason(laps, base, params, {iters: ITERS});
  const lg = fit.perTrack.map(p => Math.log(p.grip)), gripSpread = Math.sqrt(lg.reduce((a, x) => a + x * x, 0) / lg.length);
  const speed = Math.sqrt(fit.perTrack.reduce((a, p) => a + p.rmsKph ** 2, 0) / fit.perTrack.length);
  const lapPct = Math.sqrt(fit.perTrack.reduce((a, p) => a + (p.dt / p.realLap * 100) ** 2, 0) / fit.perTrack.length);
  // one number: speed error (km/h) + lap error (%) scaled + grip spread (%) — all lower is better
  const score = speed + 5 * lapPct + 0.5 * gripSpread * 100;
  rows.push({v, laps: laps.length, speed, lapPct, gripSpread: gripSpread * 100, score});
  console.log(`variant ${i} ${JSON.stringify(v)}: speed ${speed.toFixed(1)} km/h, lap ${lapPct.toFixed(2)}%, grip spread ${(gripSpread * 100).toFixed(1)}%, score ${score.toFixed(2)}`);
}
const best = rows.reduce((a, b) => (b.score < a.score ? b : a));
execFileSync('node', ['scripts/sim/build-geometry.mjs'], {env: {...process.env, ...best.v}, stdio: 'inherit'});
await writeFile('docs/lapsim-geometry.md', ['# Track-line smoothing choice', '', `Generated ${new Date().toISOString().slice(0, 10)} by scripts/sim/tune-geometry.mjs (latest season, pole laps, ${ITERS} fit iterations).`, '',
  '| Setting | Laps | Corner/straight speed error | Lap-time error | Track grip spread | Score |', '|---|---|---|---|---|---|',
  ...rows.map(r => `| ${JSON.stringify(r.v)}${r === best ? ' **chosen**' : ''} | ${r.laps} | ${r.speed.toFixed(1)} km/h | ${r.lapPct.toFixed(2)}% | ${r.gripSpread.toFixed(1)}% | ${r.score.toFixed(2)} |`), ''].join('\n'));
console.log('chosen', JSON.stringify(best.v));
