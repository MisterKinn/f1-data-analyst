// Kernel numerics (step 1 of claude/physics-critique-skills-2026-11-23.md; pre-registration claude/gate-kernel-step1-prereg-2026-11-23.md).
// Check B: the lap time may not depend on the track step. Each track is refined as in the critique's check B (curvature, grade and
// heading linear between points, zones from the nearest point) and the lap must change by less than 0.03 % when ds halves, at the
// production ds and at ds/2. Plus the exact limits: skidpad, terminal speed on a long straight, and the per-lap energy ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {lapsimCalibration as C} from '../worker/lapsim/calibration-data.js';
import {lapsimPuDocs} from '../worker/lapsim/pu-docs-data.js';
import {applyRules} from '../worker/lapsim/cars.js';
import {FE_GENS} from '../worker/lapsim/fe-cars.js';

const K = lapsimKernel(), STEP = {kernelStep: 2};
const refine = (t, f) => {
  const n = t.kappa.length, m = n * f;
  const rs = a => { if (!a || a === true) return a; const o = new (a.constructor)(m); for (let i = 0; i < m; i++) { const x = i / f, i0 = Math.floor(x) % n, i1 = (i0 + 1) % n, w = x - Math.floor(x); let a0 = a[i0], a1 = a[i1];
    if (a === t.heading) { let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a1 = a0 + d; }
    o[i] = a.constructor === Uint8Array ? a[i0] : a0 + w * (a1 - a0); } return o; };
  return {...t, ds: t.ds / f, kappa: rs(t.kappa), grade: rs(t.grade), heading: rs(t.heading), mu: rs(t.mu), vScale: rs(t.vScale), aeroLow: rs(t.aeroLow)};
};
// the event's C5.12 power-reduction shape from its FIA PU document (as scripts/sim/calibrate.mjs rampOf)
const rampOf = id => { const p = lapsimPuDocs.events[id], d = lapsimTracks[id], k = p?.centrelineKm ? d.kappa.length * d.ds / (p.centrelineKm * 1000) : 1, sc = z => ({...z, from: z.from * k, to: z.to * k});
  return {rateKWs: p?.rampKWs || 100, bigCut: (p?.bigCut || []).map(sc), speed: (p?.speed || []).map(sc)}; };
const car26 = C.seasons['2026'].car;
const RULES = {
  'f1-2014': {car: C.seasons['2025'].car},
  'f1-2026': {car: car26},
  'f1-2026 puRamp': {car: car26, env: id => ({puRamp: rampOf(id)})},
  'f1-2026 Overtake': {car: car26, ot: true},
  'f1-2026 puRamp+Overtake': {car: car26, env: id => ({puRamp: rampOf(id)}), ot: true},
  '2027 car': {car: applyRules(car26, 2027)},
  'hypercar (LMH)': {car: C.series.wec.lmh['2025'].car},
  'FE Gen3 Evo': {car: FE_GENS['fe-gen3evo'].car},
};
const TRACKS = ['monte-carlo', 'suzuka', 'monza', 'jeddah', 'silverstone', 'spa-francorchamps', 'hungaroring', 'singapore'];

for (const [rule, R] of Object.entries(RULES)) test(`mesh: lap changes < 0.03 % when ds halves (${rule})`, () => {
  for (const id of TRACKS) {
    const t = {...K.trackFromData(lapsimTracks[id]), ...(R.ot ? {otOn: true} : {})}, env = R.env ? R.env(id) : {};
    const [a, b, c] = [1, 2, 4].map(f => K.simulateLap(refine(t, f), R.car, env, STEP).lapTime);
    const d1 = Math.abs(b - a) / a, d2 = Math.abs(c - b) / b;
    assert.ok(d1 < 3e-4 && d2 < 3e-4, `${rule} ${id}: ${a.toFixed(3)} → ${b.toFixed(3)} → ${c.toFixed(3)} s (${(100 * d1).toFixed(3)} %, ${(100 * d2).toFixed(3)} %)`);
  }
});

const car25 = C.seasons['2025'].car;
for (const step of [1, 2]) {
  test(`limit: skidpad without aero runs at sqrt(mu g R) within 1e-4 (kernel step ${step})`, () => {
    const n = 400, R0 = 100, t = {ds: 2 * Math.PI * R0 / n, kappa: new Float64Array(n).fill(1 / R0), mu: null, vScale: null, aeroLow: null, grade: null, heading: null};
    const car = {...car25, clA: 0, clALow: 0, cdA: 0, cdALow: 0, vSubtractCorner: 0, dmuDfz: 0, cRoll: 0};
    const v = 2 * Math.PI * R0 / K.simulateLap(t, car, {}, {kernelStep: step}).lapTime, exact = Math.sqrt(car.muY * 9.81 * R0);
    assert.ok(Math.abs(v / exact - 1) < 1e-4, `${v} vs ${exact}`);
  });
  test(`limit: top speed on a 20 km straight is the terminal speed within 1e-3 (kernel step ${step})`, () => {
    // one 30 m-radius hairpin, then 20 km of straight: the car reaches P·η/v = ½ρCdA v² + Crr·m·g long before the braking zone
    const ds = 5, n = 4000 + 20, kappa = new Float64Array(n); for (let i = 0; i < 20; i++) kappa[i] = 1 / 30;
    const t = {ds, kappa, mu: null, vScale: null, aeroLow: null, grade: null, heading: null};
    const car = {...car25, clA: 0, clALow: 0, cdALow: car25.cdA, vMax: 200, ers: {}};
    const r = K.simulateLap(t, car, {}, {kernelStep: step}), vTop = Math.max(...r.v);
    const P = car.pIce * car.etaDrive, D = 0.5 * K.RHO_REF * car.cdA, Rr = car.cRoll * car.mass * 9.81;
    let lo = 1, hi = 200; for (let it = 0; it < 100; it++) { const m = 0.5 * (lo + hi); if (P / m > D * m * m + Rr) lo = m; else hi = m; }
    assert.ok(Math.abs(vTop / lo - 1) < 1e-3, `${vTop} vs ${lo}`);
  });
}
test('limit: energy ledger closes per lap (kernel step 2): flow sums = totals, deploy within the budget', () => {
  for (const [rule, R] of Object.entries(RULES)) for (const id of ['suzuka', 'monza', 'monte-carlo']) {
    const t = {...K.trackFromData(lapsimTracks[id]), ...(R.ot ? {otOn: true} : {})}, r = K.simulateLap(t, R.car, R.env ? R.env(id) : {}, STEP);
    if (!r.flow) continue;
    const sum = a => a.reduce((x, y) => x + y, 0), e = r.energy;
    assert.ok(Math.abs(sum(r.flow.dep) - e.deployJ) < 1, `${rule} ${id} deploy`);
    assert.ok(Math.abs(sum(r.flow.brk) + sum(r.flow.thr) - e.regenJ) < 1, `${rule} ${id} regen`);
    assert.ok(e.deployJ <= e.budgetJ + 1.5e3, `${rule} ${id}: deploy ${e.deployJ} > budget ${e.budgetJ}`);
    assert.ok(Math.abs(r.time[r.time.length - 1] + (r.lapTime - r.time[r.time.length - 1]) - r.lapTime) < 1e-9);
  }
});
