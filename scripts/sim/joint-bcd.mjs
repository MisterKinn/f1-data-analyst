// Joint calibration by block coordinate descent (common rule for every series).
// One car per group (season / class), one set of factors per track shared by every group:
//   grip (corners) and, optionally, drag (straights; absorbs track-line length and wind error).
// Each round: (1) fit every group's car with the track factors fixed (Nelder–Mead, a few
// parameters, run in parallel worker threads); (2) fit every track's factors with the cars fixed.
// This converges much further than one Nelder–Mead over all cars at once.
import {Worker} from 'node:worker_threads';
import os from 'node:os';
import {lapError, withGrip, realExtremes, nelderMead} from './calibrate-lib.mjs';
import {conditionsFromWeather} from '../../worker/lapsim/atmosphere.js';

export const DEFAULTS = {rounds: 4, iters: 150, wTime: 2, wSector: 0, wPrior: 2, lo: 0.7, hi: 1.3, trackDrag: false, dragLo: 0.85, dragHi: 1.15};

export function prepGroups(groups) {
  return groups.map(g => ({key: g.key, base: g.base, params: g.params, laps: g.laps.map(l => ({...l, group: g.key,
    env: conditionsFromWeather(l.weather || {}),
    obs: l.obs && process.env.LAPSIM_TRACE_ERROR !== 'rms' ? {...l.obs, ext: realExtremes(l.obs)} : l.obs}))}));
}

export function buildCar(g, x) {
  let outside = 0;
  const car = structuredClone(g.base);
  g.params.forEach((p, i) => {
    let v = p.base * Math.exp(x[i] ?? 0);
    if (p.min != null && v < p.min) { outside += Math.log(p.min / v) ** 2; v = p.min; }
    if (p.max != null && v > p.max) { outside += Math.log(v / p.max) ** 2; v = p.max; }
    car[p.path] = v;
  });
  if (g.base.linkMu) { car.muX = g.base.muX * car.muY / g.base.muY; car.muXTrac = g.base.muXTrac * car.muY / g.base.muY; }
  if (g.base.noLowDrag) { car.clALow = car.clA; car.cdALow = car.cdA; }
  return {car, outside};
}

// Score of one lap with track factors f = {grip, drag}
export function lapScore(l, car, f, o) {
  const c = f.drag && f.drag !== 1 ? {...car, cdA: car.cdA * f.drag, cdALow: (car.cdALow ?? car.cdA) * f.drag} : car;
  const e = lapError(withGrip(l.track, f.grip), c, l.env, l.obs, l.lapSeconds, {wTime: o.wTime * (l.timeScale ?? 1), trapKph: l.trapKph});
  let sec = 0;
  if (o.wSector && l.sectors && e.res.sectors) for (let k = 0; k < 3; k++) if (Number.isFinite(l.sectors[k])) sec += (e.res.sectors[k] - l.sectors[k]) ** 2;
  return {...e, score: e.score + o.wSector * sec * (l.timeScale ?? 1)};
}

const fOf = (factors, name) => factors[name] || {grip: 1, drag: 1};

export function fitGroup(g, factors, x0, o) {
  const laps = g.laps.filter(l => factors[l.name]);
  const wsum = laps.reduce((a, l) => a + (l.weight ?? 1), 0) || 1;
  const objective = x => {
    const {car, outside} = buildCar(g, x);
    let s = 0; for (const l of laps) s += (l.weight ?? 1) * lapScore(l, car, fOf(factors, l.name), o).score;
    return s / wsum + 100 * outside;
  };
  const r = nelderMead(objective, x0 || g.params.map(() => 0), {step: 0.06, iters: o.iters});
  return {x: r.x, value: r.value};
}

// Track factors for one track given the cars (one per group, by key)
export function fitTrack(laps, cars, prev, o) {
  const phi = (Math.sqrt(5) - 1) / 2;
  const score = f => { let s = 0; for (const l of laps) s += (l.weight ?? 1) * lapScore(l, cars[l.group], f, o).score; return s + o.wPrior * (Math.log(f.grip) ** 2 + Math.log(f.drag) ** 2) * laps.length; };
  const golden = (fn, a, b, iters) => {
    let c = b - phi * (b - a), d = a + phi * (b - a), fc = fn(c), fd = fn(d);
    for (let it = 0; it < iters; it++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = fn(c); } else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = fn(d); } }
    return fc < fd ? c : d;
  };
  let f = {grip: prev?.grip ?? 1, drag: prev?.drag ?? 1};
  for (let pass = 0; pass < (o.trackDrag ? 2 : 1); pass++) {
    f.grip = golden(g => score({...f, grip: g}), o.lo, o.hi, 16);
    if (o.trackDrag) f.drag = golden(d => score({...f, drag: d}), o.dragLo, o.dragHi, 12);
  }
  return {...f, score: score(f)};
}

// ---------- worker pool ----------
class Pool {
  constructor(n, groups, o) {
    this.workers = Array.from({length: n}, () => new Worker(new URL('./bcd-worker.mjs', import.meta.url)));
    const {log, ...plain} = o; this.workers.forEach(w => w.postMessage({type: 'init', groups, o: plain}));
    this.queue = []; this.idle = [...this.workers]; this.jobs = new Map(); this.seq = 0;
    for (const w of this.workers) w.on('message', m => { const j = this.jobs.get(m.id); this.jobs.delete(m.id); this.idle.push(w); j.resolve(m.result); this.pump(); });
    for (const w of this.workers) w.on('error', e => { for (const j of this.jobs.values()) j.reject(e); });
  }
  run(msg) { return new Promise((resolve, reject) => { this.queue.push({msg: {...msg, id: ++this.seq}, resolve, reject}); this.pump(); }); }
  pump() { while (this.idle.length && this.queue.length) { const w = this.idle.pop(), j = this.queue.shift(); this.jobs.set(j.msg.id, j); w.postMessage(j.msg); } }
  close() { return Promise.all(this.workers.map(w => w.terminate())); }
}

export async function fitJointBCD(groups, opts = {}) {
  const o = {...DEFAULTS, ...opts};
  const prep = prepGroups(groups);
  const nW = Math.max(1, Math.min(o.workers ?? os.availableParallelism?.() ?? os.cpus().length, 8));
  const pool = new Pool(nW, prep, o);
  try {
    const names = [...new Set(prep.flatMap(g => g.laps.map(l => l.name)))].sort();
    let factors = o.startFactors ? structuredClone(o.startFactors) : Object.fromEntries(names.map(n => [n, {grip: 1, drag: 1}]));
    for (const n of names) factors[n] ||= {grip: 1, drag: 1};
    let xs = Object.fromEntries(prep.map(g => [g.key, o.startX?.[g.key] || g.params.map(() => 0)]));
    let score = Infinity;
    for (let r = 0; r < o.rounds; r++) {
      const fits = await Promise.all(prep.map(g => pool.run({type: 'group', key: g.key, factors, x0: xs[g.key]})));
      prep.forEach((g, k) => { xs[g.key] = fits[k].x; });
      const tf = await Promise.all(names.map(n => pool.run({type: 'track', name: n, xs, prev: factors[n]})));
      factors = Object.fromEntries(names.map((n, k) => [n, {grip: tf[k].grip, drag: tf[k].drag}]));
      score = tf.reduce((a, t) => a + t.score, 0) / prep.reduce((a, g) => a + g.laps.length, 0);
      o.log?.(`round ${r + 1}: score ${score.toFixed(4)}`);
    }
    const cars = Object.fromEntries(prep.map(g => [g.key, buildCar(g, xs[g.key]).car]));
    const perLap = [];
    for (const g of prep) for (const l of g.laps) {
      const f = fOf(factors, l.name), e = lapScore(l, cars[g.key], f, o);
      perLap.push({group: g.key, name: l.name, grip: f.grip, drag: f.drag, rmsKph: e.rms * 3.6, dt: e.dt, simLap: e.res.lapTime, realLap: l.lapSeconds, rho: l.env.rho, vMaxSim: e.res.vMaxKph, meta: l.meta});
    }
    return {cars, xs, factors, grips: Object.fromEntries(names.map(n => [n, factors[n].grip])), perLap, score};
  } finally { await pool.close(); }
}

// Predict laps of group `key` on left-out tracks with factors learned from the other groups' laps.
const predict = (l, car, f) => lapScore(l, car, f, {wTime: 0, wSector: 0}).res.lapTime;

export async function holdoutBCD(groups, key, {folds = 4, ...opts} = {}) {
  const target = groups.find(g => g.key === key);
  const names = [...new Set(target.laps.map(l => l.name))].sort();
  const k = Math.min(folds, names.length), errors = [];
  for (let f = 0; f < k; f++) {
    const test = new Set(names.filter((_, i) => i % k === f));
    const train = groups.map(g => g.key === key ? {...g, laps: g.laps.filter(l => !test.has(l.name))} : g);
    const fit = await fitJointBCD(train, opts);
    for (const l of prepGroups([target])[0].laps.filter(x => test.has(x.name) && (x.weight ?? 1) >= 1)) {
      const fa = fit.factors[l.name]; if (!fa || !train.some(g => g.laps.some(x => x.name === l.name))) continue;
      const t = predict(l, fit.cars[key], fa);
      errors.push({name: l.name, dt: t - l.lapSeconds, pct: (t / l.lapSeconds - 1) * 100});
    }
  }
  const rmsPct = errors.length ? Math.sqrt(errors.reduce((a, e) => a + e.pct ** 2, 0) / errors.length) : null;
  return {errors, rmsPct, n: errors.length};
}

// Forecast test in time order: each lap of group `key` is predicted from data dated before it only.
// Fits are warm-started from the previous step (which also saw only earlier data).
export async function backtestBCD(groups, key, opts = {}) {
  const target = groups.find(g => g.key === key);
  const dates = [...new Set(target.laps.filter(l => l.date).map(l => l.date.slice(0, 10)))].sort();
  const errors = []; let start = {};
  for (const d of dates) {
    const before = groups.map(g => ({...g, laps: g.laps.filter(l => !l.date || l.date.slice(0, 10) < d)})).filter(g => g.laps.length);
    if (!before.some(g => g.key === key) || before.find(g => g.key === key).laps.length < 3) continue;
    const fit = await fitJointBCD(before, {...opts, ...start});
    start = {startX: fit.xs, startFactors: fit.factors};
    for (const l of prepGroups([target])[0].laps.filter(x => x.date?.slice(0, 10) === d && (x.weight ?? 1) >= 1)) {
      const fa = fit.factors[l.name]; if (!fa) continue;
      const t = predict(l, fit.cars[key], fa);
      errors.push({name: l.name, date: d, dt: t - l.lapSeconds, pct: (t / l.lapSeconds - 1) * 100});
    }
  }
  const rmsPct = errors.length ? Math.sqrt(errors.reduce((a, e) => a + e.pct ** 2, 0) / errors.length) : null;
  return {errors, rmsPct, n: errors.length};
}
