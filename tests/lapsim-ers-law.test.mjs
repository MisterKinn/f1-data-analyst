// ERS law (b) module (worker/lapsim/ers-law.js, step 10b): default off, law (b) = deploy at every full-throttle point for 2014–25,
// 2026 deploy untouched, regen from the braking force with the per-zone identity. Both kernel steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {lapsimCalibration as C} from '../worker/lapsim/calibration-data.js';
import {ersLaw, withErsLaw, regenIdentity} from '../worker/lapsim/ers-law.js';

const K = lapsimKernel(), track = K.trackFromData(lapsimTracks.suzuka), car25 = C.seasons['2025'].car, car26 = C.seasons['2026'].car;
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

test('default off: the module does not change the input car; other rule sets come back as they are', () => {
  const before = JSON.stringify(car26), c = withErsLaw(car26);
  assert.equal(JSON.stringify(car26), before); assert.ok(c.ers.law && !car26.ers.law);
  const hyper = {...car25, ers: {rule: 'hypercar', eMax: 200e3}};
  assert.equal(withErsLaw(hyper), hyper); assert.equal(ersLaw(hyper), null);
  assert.equal(c.ers.law, 'b'); assert.equal(ersLaw(car26).law.deploy, undefined, '2026 deploy: the kernel taper and PU-document limits only');
});

test('the kernel\'s built-in law (b) equals the plug-in functions of ersLaw() (2014–25; 2026 without strategy B)', () => {
  for (const kernelStep of [1, 2]) {
    const o = {kernelStep}, c14 = {...car25, ers: {...car25.ers, deployMax: Infinity, law: ersLaw(car25).law}};
    same(K.simulateLap(track, withErsLaw(car25), {}, o), K.simulateLap(track, c14, {}, o));
    const n26 = {...car26, ers: {...car26.ers, causalSoc: false}};
    same(K.simulateLap(track, withErsLaw(n26), {}, o), K.simulateLap(track, {...n26, ers: {...n26.ers, law: ersLaw(n26).law}}, {}, o));
  }
});

test('strategy B: with law (b) a causal 2026 lap always searches, and it is never slower than without the search', () => {
  for (const kernelStep of [1, 2]) {
    const o = {kernelStep}, b = K.simulateLap(track, withErsLaw(car26), {}, o);
    const noSearch = K.simulateLap(track, {...car26, ers: {...car26.ers, law: ersLaw(car26).law}}, {}, o);
    assert.ok(b.lapTime <= noSearch.lapTime + 1e-9, `${b.lapTime} > ${noSearch.lapTime}`);
    assert.ok(b.energy.deployJ <= b.energy.budgetJ + (kernelStep === 2 ? 1 : 1.5e3));
  }
});

test('limiting case: no drag and no rolling resistance → the brake-force regen is the kinetic-energy formula', () => {
  const {law} = ersLaw({...car26, cRoll: 0}, {rho: 0});
  for (const [pBrake, v] of [[2e5, 30], [1.5e6, 80], [5e6, 90]]) {
    const ctx = {pBrake, v, i: 0, s: 0, regenMax: 350e3, share: 0.4, eta: 0.9};
    assert.ok(Math.abs(law.regen(ctx) - Math.min(350e3, 0.4 * pBrake * 0.9)) < 1e-6);
  }
  assert.equal(ersLaw(car26).law.regen({pBrake: 1e3, v: 80, regenMax: 350e3, share: 0.4, eta: 0.9}), 0, 'a lift (drag alone slows the car) recovers nothing');
});

for (const kernelStep of [1, 2]) {
  const o = {kernelStep};
  test(`law (b), 2014–25 (step ${kernelStep}): same lap as a budget that never binds; MGU-K on at every power-limited point`, () => {
    const b = K.simulateLap(track, withErsLaw(car25), {}, o);
    same(b, K.simulateLap(track, {...car25, ers: {...car25.ers, deployMax: Infinity, law: {}}}, {}, o)); // law (b) = a budget that never binds
    assert.equal(b.energy.cutoffKph, null);
    const base = K.simulateLap(track, car25, {}, o);
    assert.ok(base.energy.cutoffKph != null && b.lapTime < base.lapTime && b.energy.deployJ > base.energy.deployJ);
    if (kernelStep === 1) for (let i = 0; i < b.v.length; i++) if (b.limit[i] === 2) assert.ok(b.flow.dep[i] > 0, `no deploy at power-limited point ${i}`);
  });
  test(`regen from the braking force (step ${kernelStep}): never above the kinetic-energy formula; the identity holds per zone`, () => {
    const c = withErsLaw(car26), b = K.simulateLap(track, c, {}, o), base = K.simulateLap(track, car26, {}, o);
    assert.ok(b.energy.regenJ - b.energy.throttleHarvestJ < base.energy.regenJ - base.energy.throttleHarvestJ);
    assert.ok(b.energy.deployJ <= b.energy.budgetJ + 1.5e3);
    if (kernelStep === 1) { const Z = regenIdentity(b, c, {}, track.ds); assert.ok(Z.length > 10); for (const z of Z) assert.ok(z.ok, JSON.stringify(z)); }
  });
}
