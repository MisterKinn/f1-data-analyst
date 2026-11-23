// Step 7a: WEC warm-up gap (first vs second push lap after the out-lap; WEC has no tyre warmers) against the two-node
// tyre thermal model. Pre-registration: Project doc claude/gate-tyre-thermal-wec-warmup-prereg-2026-11-23.md.
// In: per-unit tables from tyre-thermal-wec-aggregate.mjs (2025 tuning; 2026 hold-out only after the power check).
//   node scripts/sim/tyre-thermal-wec.mjs [holdout-units.json] → scripts/sim/data/learn/tyre-thermal-wec.json
import {readFileSync, writeFileSync} from 'node:fs';
import {signFlip, mde} from './gate.mjs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {carsFor, realConditions} from '../../worker/lapsim/scenario.js';
import {lapsimCalibration as C} from '../../worker/lapsim/calibration-data.js';
import {TYRE_THERMAL_DEFAULTS, lapLoads, runSequence, solveEta} from '../../worker/lapsim/tyre-thermal.js';

const K = lapsimKernel(), r4 = x => Math.round(x * 1e4) / 1e4, mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const rmsOf = a => Math.sqrt(mean(a.map(x => x * x)));
const CAL = {hypercar: 'lmh', lmgt3: 'lmgt3'}, CAR = {hypercar: 'wec-lmh', lmgt3: 'wec-lmgt3'};
const load = f => JSON.parse(readFileSync(f, 'utf8')).units.filter(u => u.n >= 5);
const tune = load('scripts/sim/data/learn/tyre-thermal-wec-units-2025.json'), holdFile = process.argv[2];

// per unit: weather, loads, S_g (cached)
const ctx = new Map();
function ctxOf(u) {
  const k = `${u.year}|${u.track}|${u.cls}`; if (ctx.has(k)) return ctx.get(k);
  const w = C.series?.wec?.[CAL[u.cls]]?.[u.year]?.tracks?.[u.track]?.weather || realConditions(u.track)?.[CAR[u.cls]];
  if (!w || !Number.isFinite(w.trackTempC) || !lapsimTracks[u.track]) { ctx.set(k, null); return null; }
  const c = carsFor(u.track)[CAR[u.cls]], tr = K.trackFromData(lapsimTracks[u.track]); tr.mu.fill(c.grip);
  const env = {...K.conditionsFromWeather(w), grip: 1}, lap = K.simulateLap(tr, c.car, env);
  const Sg = 100 * (K.simulateLap(tr, c.car, {...env, grip: 1.01}).lapTime / lap.lapTime - 1) / 0.01; // % lap per unit grip
  const o = {w, L: lapLoads(tr, c.car, lap, env), Sg, eta: new Map()}; ctx.set(k, o); return o;
}
const paramsOf = x => ({...TYRE_THERMAL_DEFAULTS, tauS: x.tauS, tauB: 13.3 * x.tauS, window: {S: {tc: 100, w: 35}, H: {tc: x.tcH, w: 35}, G: {tc: x.tcG, w: 35}}});
function predict(u, x) {
  const o = ctxOf(u), P = paramsOf(x); if (!o) return NaN;
  if (!o.eta.has(x.tauS)) o.eta.set(x.tauS, solveEta(o.L, P));
  const T = o.w.trackTempC, s = runSequence(o.L, [{r: 0.6}, {r: 1}, {r: 1}], {trackC: T, airC: o.w.airTempC, eta: o.eta.get(x.tauS), fam: u.cls === 'hypercar' ? 'H' : 'G'}, {...P, blanketC: T});
  return o.Sg * (s[1].grip - s[2].grip);
}
// runSequence starts from P.blanketC: here the track temperature (no warmers)
const errors = (U, f, fitU) => { const off = {}; for (const [c, us] of Object.entries(Object.groupBy(fitU, u => u.cls))) off[c] = mean(us.map(u => u.y - f(u))); return U.map(u => u.y - f(u) - off[u.cls]); };
const SPACE = {tauS: [5, 120], tcH: [60, 140], tcG: [60, 140]};
function fit(U) {
  let x = {tauS: 30, tcH: 100, tcG: 100}, best = Infinity;
  const L = x => { const e = errors(U, u => predict(u, x), U); return mean(e.map(v => v * v)); };
  for (let sweep = 0; sweep < 3; sweep++) for (const k of Object.keys(SPACE)) {
    const [lo, hi] = SPACE[k], span = (hi - lo) / 3 ** sweep;
    for (let g = 0; g <= 8; g++) { const v = Math.min(hi, Math.max(lo, x[k] - span / 2 + span * g / 8)), y = {...x, [k]: v}, f = L(y); if (f < best) { best = f; x = y; } }
  }
  return {x, loss: best};
}
const valid = U => U.filter(u => ctxOf(u));
const T = valid(tune), F = fit(T);
const errs = (U, fitU, x) => ({constant: errors(U, () => 0, fitU), production: errors(U, u => u.prod, fitU), thermal: errors(U, u => predict(u, x), fitU)});
const perTrack = (U, eb, em) => Object.values(Object.groupBy(U.map((u, i) => ({t: u.track, b: eb[i] ** 2, m: em[i] ** 2})), z => z.t)).map(z => mean(z.map(q => q.b)) - mean(z.map(q => q.m)));

// power check: leave one track out on 2025
const tracks = [...new Set(T.map(u => u.track))], loo = {production: [], constant: []};
for (const t of tracks) { const fitU = T.filter(u => u.track !== t), test = T.filter(u => u.track === t), x = fit(fitU).x, E = errs(test, fitU, x);
  for (const b of Object.keys(loo)) loo[b].push(mean(E[b].map(v => v * v)) - mean(E.thermal.map(v => v * v))); }
const Et = errs(T, T, F.x), nHold = 6, useful = 2 * rmsOf(Et.production) * 0.02; // 2026 WEC tracks in the files: imola, spa, interlagos, austin, catalunya, monza
const power = {nHoldTracks: nHold, usefulGainPp2: r4(useful), loo: Object.fromEntries(Object.entries(loo).map(([k, g]) => [k, {meanGain: r4(mean(g)), sd: r4(sd(g)), mde: r4(mde(sd(g), nHold)), n: g.length}]))};
power.judgeable = ['production', 'constant'].every(b => power.loo[b].mde <= useful);

// bootstrap over 2025 events (event = track here)
let s = 11; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), boots = [];
for (let i = 0; i < 60; i++) { const pick = tracks.map(() => tracks[Math.floor(rnd() * tracks.length)]).flatMap(t => T.filter(u => u.track === t)); boots.push(fit(pick).x); }
const ident = Object.fromEntries(Object.keys(SPACE).map(k => { const v = boots.map(b => b[k]).sort((a, b) => a - b), lo = v[3], hi = v[56], [a, b] = SPACE[k];
  return [k, {value: r4(F.x[k]), ci90: [r4(lo), r4(hi)], identified: lo > a + 1e-6 && hi < b - 1e-6 && hi - lo < 0.8 * (b - a)}]; }));
// plausibility: warm-up gap at 10 °C and 40 °C track (Spa layout, Hypercar)
const plaus = Object.fromEntries([10, 40].map(Tt => { const u = {year: 2025, track: 'spa-francorchamps', cls: 'hypercar'}, o = ctxOf(u), P = paramsOf(F.x), eta = solveEta(o.L, P);
  const seq = runSequence(o.L, [{r: 0.6}, {r: 1}, {r: 1}], {trackC: Tt, airC: Tt - 5, eta, fam: 'H'}, {...P, blanketC: Tt}); return [Tt + 'C', r4(o.Sg * (seq[1].grip - seq[2].grip))]; }));

const out = {generatedAt: new Date().toISOString().slice(0, 10), prereg: 'claude/gate-tyre-thermal-wec-warmup-prereg-2026-11-23.md', fit: F.x, ident, power,
  tuning: {units: T.length, tracks: tracks.length, rms: Object.fromEntries(Object.entries(Et).map(([k, v]) => [k, r4(rmsOf(v))])),
    meanY: Object.fromEntries(Object.entries(Object.groupBy(T, u => u.cls)).map(([c, us]) => [c, r4(mean(us.map(u => u.y)))])),
    predicted: T.map(u => ({track: u.track, cls: u.cls, y: u.y, thermal: r4(predict(u, F.x)), trackTempC: ctxOf(u).w.trackTempC}))}, plausibility: plaus};
if (holdFile) {
  if (!power.judgeable) out.holdout = 'not judgeable at this n: not opened';
  else { const H = valid(load(holdFile)), E = errs(H, T, F.x); out.holdout = {units: H.length, tracks: new Set(H.map(u => u.track)).size, rms: Object.fromEntries(Object.entries(E).map(([k, v]) => [k, r4(rmsOf(v))])), medAbs: Object.fromEntries(Object.entries(E).map(([k, v]) => [k, r4(median(v.map(Math.abs)))]))};
    for (const b of ['production', 'constant']) { const sf = signFlip(perTrack(H, E[b], E.thermal), {m: 1}); out.holdout['vs_' + b] = {gain: r4(sf.gain), ci90: sf.ci90.map(r4), p: r4(sf.p), accept: sf.accept, reason: sf.reason, rmsGain: r4(rmsOf(E[b]) - rmsOf(E.thermal))}; }
    out.holdout.pass = ['production', 'constant'].every(b => out.holdout['vs_' + b].accept && out.holdout['vs_' + b].rmsGain >= 0.02); }
}
writeFileSync('scripts/sim/data/learn/tyre-thermal-wec.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
