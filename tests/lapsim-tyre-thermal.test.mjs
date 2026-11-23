import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {carsFor} from '../worker/lapsim/scenario.js';
import {TYRE_THERMAL_DEFAULTS as P, conductances, stepAxle, lapLoads, scaleLoads, runLap, runSequence, steadyLap, solveEta, windowGrip, initState, gripHookFromTrace} from '../worker/lapsim/tyre-thermal.js';

const K = lapsimKernel();
function pushLap(id) {
  const c = carsFor(id)['2025'], tr = K.trackFromData(lapsimTracks[id]);
  tr.mu.fill(c.grip);
  const env = K.conditionsFromWeather({trackTempC: 35, airTempC: 25});
  return {L: lapLoads(tr, c.car, K.simulateLap(tr, c.car, env), env), lapTime: K.simulateLap(tr, c.car, env).lapTime};
}
const {L: bah} = pushLap('sakhir');
const eta = solveEta(bah, P);

test('each node closes its energy balance every step', () => {
  const Kc = conductances(P);
  let n = {s: 70, b: 70}, worst = 0;
  for (let i = 0; i < bah.dt.length; i++) {
    const o = stepAxle(n, {qs: eta * P.slip * bah.slide[i] * 0.45, qb: eta * P.rr * (bah.rollW[i] + bah.rollA[i]) * 0.45, v: bah.v[i], dt: bah.dt[i], trackC: 40, airC: 28}, Kc, P);
    for (const node of [o.ledger.surface, o.ledger.bulk]) {
      const scale = Math.max(1, Math.abs(node.in), Math.abs(node.out), Math.abs(node.stored));
      worst = Math.max(worst, Math.abs(node.in - node.out - node.stored) / scale);
    }
    n = {s: o.s, b: o.b};
  }
  assert.ok(worst < 1e-9, `worst relative imbalance ${worst}`);
});

test('no heat and both sinks at one temperature: nodes relax to it (limit)', () => {
  const o = steadyLap(bah, {trackC: 30, airC: 30, eta: 0}, P);
  assert.ok(Math.abs(o.meanTs - 30) < 1e-6);
});

test('reference steady lap sits at the reference surface temperature', () => {
  const o = steadyLap(bah, {trackC: P.ref.trackC, airC: P.ref.airC, eta}, P);
  assert.ok(Math.abs(o.meanTs - P.ref.surfaceC) < 1e-6, String(o.meanTs));
  assert.ok(eta > 0);
});

test('hot and cold cases stay plausible', () => {
  const hot = runSequence(bah, [{r: 0.75}, ...Array(15).fill({r: 1})], {trackC: 55, airC: 40, eta}, P);
  const cold = runSequence(bah, [{r: 0.6}, {r: 1}, {r: 0.7}, {r: 1}], {trackC: 12, airC: 8, eta}, P);
  for (const o of [...hot, ...cold]) {
    for (const ax of [o.state.f, o.state.r]) {
      assert.ok(ax.s > 0 && ax.s < 160, `surface ${ax.s}`);
      assert.ok(ax.b > 0 && ax.b < 130, `bulk ${ax.b}`);
    }
    assert.ok(o.grip >= 1 - P.depth - 1e-12 && o.grip <= 1);
  }
  // sign checks: hotter conditions give a hotter tyre, a slow lap cools it
  assert.ok(hot.at(-1).meanTs > steadyLap(bah, {trackC: 35, airC: 25, eta}, P).meanTs);
  assert.ok(cold[2].meanTs < cold[1].meanTs);
});

test('window: peak 1 at Tc, depth far away; scaled loads keep energy per metre physical', () => {
  assert.equal(windowGrip(P.window.S.tc, 'S', P), 1);
  assert.ok(Math.abs(windowGrip(P.window.S.tc + 1e3, 'S', P) - (1 - P.depth)) < 1e-12);
  const h = scaleLoads(bah, 0.5), T = a => a.reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(T(h.dt) - 2 * T(bah.dt)) < 1e-6);
});

test('grip hook proposal returns a per-point multiplier', () => {
  const o = runLap(initState(P), bah, {trackC: 35, airC: 25, eta}, P, {trace: true});
  const hook = gripHookFromTrace(o.trace, o.grip);
  assert.ok(Number.isFinite(hook(0)) && Math.abs(hook(10) - o.trace.grip[10] / o.grip) < 1e-12);
});

test('fitted data file: every parameter has a value, a 90 % interval and an identified flag', async () => {
  const {lapsimTyreThermal: D} = await import('../worker/lapsim/tyre-thermal-data.js');
  for (const k of ['tauS', 'tauB', 'tcS', 'tcM', 'tcH', 'wS', 'wM', 'wH']) {
    const iv = D.intervals[k];
    assert.ok(Number.isFinite(iv.value) && iv.ci90.length === 2 && iv.ci90[0] <= iv.ci90[1] && typeof iv.identified === 'boolean', k);
  }
});
