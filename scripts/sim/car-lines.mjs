// Fastest racing line per car and per mode (qualifying / race), inside the measured track width.
// The line is moved sideways (control points every CTRL m, interpolated) and kept when the lap
// simulator, run for that car, says the lap is quicker (SPSA: two simulations per step, all control
// points perturbed at once). Start: the minimum-curvature line of racing-lines-data.js.
// Qualifying: the calibrated car as on the page. Race: + mid-race fuel, and for F1 the grip scaled so
// the lap on the line equals the real mid-race pace (race-data.js: pole × raceRatio + fuel slope at
// half distance); WEC has no fitted race pace, so its race grip uses the F1 ratio of the track
// (assumption, labelled). Writes worker/lapsim/car-lines-data.js and docs/lapsim-car-lines.md.
import {writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync} from 'node:fs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lineTrack as lineTrackK} from '../../worker/lapsim/racing-line.js';
import {lapsimRacingLines} from '../../worker/lapsim/racing-lines-data.js';
import {lapsimRace} from '../../worker/lapsim/race-data.js';
import {carsFor, realConditions} from '../../worker/lapsim/scenario.js';

const K = lapsimKernel(), DS = 10, CTRL = 6, ITERS = Number(process.env.LAPSIM_LINE_ITERS || 1200), CAR_HALF = 1.0;
const CARS = (process.env.LAPSIM_LINE_CARS || '2026,wec-lmh,wec-lmdh,wec-lmgt3').split(',');
const ONLY = process.env.LAPSIM_LINE_TRACKS ? process.env.LAPSIM_LINE_TRACKS.split(',') : null;
const OUT = (process.env.LAPSIM_CACHE || '.cache/lapsim') + '/car-lines';
const FUEL = {f1: 35, wec: 45}; // kg at half distance / half stint (assumed)

export const lineTrack = (px, py, ds = DS) => lineTrackK(K, px, py, ds);

function setup(L) {
  const n = L.line.length, mx = [], my = [], nx = [], ny = [], half = [], o0 = [];
  for (let i = 0; i < n; i++) { mx.push((L.left[i][0] + L.right[i][0]) / 2); my.push((L.left[i][1] + L.right[i][1]) / 2); }
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n, dx = mx[b] - mx[a], dy = my[b] - my[a], l = Math.hypot(dx, dy) || 1;
    nx.push(-dy / l); ny.push(dx / l);
    half.push(Math.max(0, Math.hypot(L.left[i][0] - L.right[i][0], L.left[i][1] - L.right[i][1]) / 2 - CAR_HALF));
    o0.push(Math.max(-half[i], Math.min(half[i], (L.line[i][0] - mx[i]) * nx[i] + (L.line[i][1] - my[i]) * ny[i])));
  }
  return {n, mx, my, nx, ny, half, o0};
}

export function optimise(L, car, env, grip, iters = ITERS, seed = 1) {
  const g = setup(L), {n} = g, nc = Math.ceil(n / CTRL), rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const offs = c => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { const j = Math.floor(i / CTRL), f = (i % CTRL) / CTRL; o[i] = Math.max(-g.half[i], Math.min(g.half[i], g.o0[i] + c[j] * (1 - f) + c[(j + 1) % nc] * f)); } return o; };
  const lap = c => { const o = offs(c), tr = lineTrack(Array.from(o, (v, i) => g.mx[i] + g.nx[i] * v), Array.from(o, (v, i) => g.my[i] + g.ny[i] * v)); tr.mu.fill(grip); return K.simulateLap(tr, car, env).lapTime; };
  let c = new Float64Array(nc), best = lap(c);
  const start = best;
  for (let k = 0; k < iters; k++) {
    const a = 0.6 / Math.pow(k + 10, 0.6), h = 0.5 / Math.pow(k + 1, 0.1), d = Float64Array.from({length: nc}, () => rnd() < 0.5 ? -1 : 1);
    const up = lap(c.map((v, j) => v + h * d[j])), dn = lap(c.map((v, j) => v - h * d[j]));
    const step = (up - dn) / (2 * h), next = c.map((v, j) => v - a * step * d[j] * 10);
    const t = lap(next); if (t < best) { best = t; c = next; }
  }
  const o = offs(c);
  return {offset: Array.from(o), x: Array.from(o, (v, i) => g.mx[i] + g.nx[i] * v), y: Array.from(o, (v, i) => g.my[i] + g.ny[i] * v), lapStart: start, lap: best};
}

// race grip factor: lap on the min-curvature line equals the real mid-race pace (F1 race fit)
function raceGrip(L, car, env, grip, target) {
  const g = setup(L), tr = lineTrack(g.o0.map((v, i) => g.mx[i] + g.nx[i] * v), g.o0.map((v, i) => g.my[i] + g.ny[i] * v));
  const at = f => { tr.mu.fill(grip * f); return K.simulateLap(tr, car, env).lapTime; };
  let lo = 0.7, hi = 1.05; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (at(m) > target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

if (import.meta.url === 'file://' + process.argv[1]) process.env.LAPSIM_LINE_MERGE ? merge() : main();
function main() {
const out = {generatedAt: new Date().toISOString(), method: `SPSA ${ITERS} steps, control points every ${CTRL} line points, kernel ds ${DS} m`, tracks: {}};
for (const [id, L] of Object.entries(lapsimRacingLines.tracks)) {
  if (ONLY && !ONLY.includes(id)) continue;
  const cars = carsFor(id), cond = realConditions(id) || {}, env = K.conditionsFromWeather(cond['2026'] || {}), rt = lapsimRace.tracks?.[id];
  const shift = o => { const g = setup(L); return +(o.reduce((s, v, i) => s + Math.abs(v - g.o0[i]), 0) / o.length).toFixed(2); };
  if (existsSync(`${OUT}/${id}.json`) && !process.env.LAPSIM_LINE_FORCE) continue;
  const t = out.tracks[id] = {};
  let f1Ratio = null;
  for (const key of CARS) {
    const c = cars[key]; if (!c) continue;
    const wec = !!c.series, q = optimise(L, c.car, env, c.grip);
    // race: fuel at half distance, grip so the lap matches real mid-race pace (F1) or the F1 ratio (WEC)
    const carR = {...c.car, mass: c.car.mass + FUEL[wec ? 'wec' : 'f1']};
    let gR = null, basis = 'assumed';
    if (!wec && rt?.pole && rt.raceRatio) {
      const target = q.lapStart * (rt.raceRatio + (rt.slope || 0) * ((rt.laps || 50) - 1) / 2 / rt.pole);
      gR = raceGrip(L, carR, env, c.grip, target); f1Ratio = gR; basis = 'race-fit';
    } else gR = f1Ratio ?? 0.97;
    const r = optimise(L, carR, env, c.grip * gR, ITERS, 7);
    const pack = (m, x) => ({off: x.offset.map(v => Math.round(v * 10)), lap: +x.lap.toFixed(3), gain: +(x.lap - x.lapStart).toFixed(3), shift: shift(x.offset), ...m});
    t[key] = {q: pack({}, q), r: pack({grip: +gR.toFixed(4), fuelKg: FUEL[wec ? 'wec' : 'f1'], basis}, r)};
    console.log(id, key, 'q', t[key].q.gain, t[key].q.shift, 'r', t[key].r.gain, t[key].r.shift, gR.toFixed(3));
  }
  mkdirSync(OUT, {recursive: true}); writeFileSync(`${OUT}/${id}.json`, JSON.stringify({id, method: out.method, cars: t}));
}
}

// all tracks from the per-track files -> data module + report
function merge() {
  const files = readdirSync(OUT).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
  const out = {generatedAt: new Date().toISOString(), method: files[0]?.method, tracks: Object.fromEntries(files.map(f => [f.id, f.cars]))};
  const report = ['# Racing line per car', '', 'Fastest line from the lap simulator for each car, qualifying and race. Gain = lap on the car line minus lap on the minimum-curvature line (same kernel, same car). Shift = mean sideways distance from the minimum-curvature line.', '', '| Track | Car | Q gain (s) | Q shift (m) | Race gain (s) | Race shift (m) | Race grip factor |', '|---|---|---|---|---|---|---|'];
  for (const [id, cars] of Object.entries(out.tracks)) for (const [k, c] of Object.entries(cars)) report.push(`| ${id} | ${k} | ${c.q.gain} | ${c.q.shift} | ${c.r.gain} | ${c.r.shift} | ${c.r.grip} (${c.r.basis}) |`);
  writeFileSync('worker/lapsim/car-lines-data.js', '// Generated by scripts/sim/car-lines.mjs: per-car qualifying/race line offsets (0.1 m) from the track midline\nexport const lapsimCarLines = ' + JSON.stringify(out) + ';\n');
  writeFileSync('docs/lapsim-car-lines.md', report.join('\n') + '\n');
  console.log(files.length, 'tracks merged');
}
