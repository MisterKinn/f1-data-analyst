// Plug-in hooks of the lap kernel (docs/lapsim-hooks.md): each hook set to its default reproduces the lap without it, and a
// non-default hook changes the lap the way its contract says. Both kernel steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {lapsimCalibration as C} from '../worker/lapsim/calibration-data.js';
import {minCurvatureLine} from '../worker/lapsim/racing-line.js';

// flag-off cars: a refit with LAPSIM_ERS_LAW=b stores law 'b' on the calibrated cars, and these tests start from the default
const off = c => ({...c, ers: {...c.ers, law: undefined}});
const K = lapsimKernel(), track = K.trackFromData(lapsimTracks.suzuka), car25 = off(C.seasons['2025'].car), car26 = off(C.seasons['2026'].car);
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

for (const kernelStep of [1, 2]) {
  const o = {kernelStep};
  test(`gripHook (step ${kernelStep}): 1 everywhere = no hook; a constant equals env.grip; state carries the previous run`, () => {
    same(K.simulateLap(track, car25, {gripHook: () => 1}, o), K.simulateLap(track, car25, {}, o));
    same(K.simulateLap(track, car25, {gripHook: () => 0.97}, o).lapTime, K.simulateLap(track, car25, {grip: 0.97}, o).lapTime);
    const seen = [];
    K.simulateLap(track, car25, {hookPasses: 2, gripHook: (i, s) => { if (i === 10) seen.push(s.v); assert.equal(s.s, i * track.ds); return 1; }}, o);
    assert.equal(seen[0], null); assert.ok(seen[1] > 0, 'second pass sees the first run');
  });
  test(`windAt (step ${kernelStep}): the session wind as a function = env wind; a stronger headwind is slower`, () => {
    const env = {windSpeed: 3, windFromDeg: 120};
    same(K.simulateLap(track, car25, {windAt: () => ({speed: 3, fromDeg: 120})}, o), K.simulateLap(track, car25, env, o));
    assert.ok(K.simulateLap(track, car25, {windAt: s => ({speed: s < 2000 ? 6 : 3, fromDeg: 120})}, o).lapTime !== K.simulateLap(track, car25, env, o).lapTime);
  });
  test(`ers.law (step ${kernelStep}): the default deploy and regen laws reproduce the lap; no deploy is slower`, () => {
    const law = {deploy: c => c.pErs, regen: c => Math.min(c.regenMax, c.share * c.pBrake * c.eta)};
    const base = K.simulateLap(track, car26, {}, o), withLaw = K.simulateLap(track, {...car26, ers: {...car26.ers, law}}, {}, o);
    assert.ok(Math.abs(withLaw.lapTime - base.lapTime) < 1e-6 * base.lapTime, `${withLaw.lapTime} vs ${base.lapTime}`);
    assert.ok(Math.abs(withLaw.energy.regenJ - base.energy.regenJ) < 1e-6 * base.energy.regenJ);
    const seen = new Set(); K.simulateLap(track, {...car26, ers: {...car26.ers, law: {regen: c => { seen.add(c.i); return law.regen(c); }}}}, {}, o);
    assert.ok(seen.size > 10 && Math.max(...seen) > 0, 'regen law sees the step\'s point');
    const none = K.simulateLap(track, {...car26, ers: {...car26.ers, law: {deploy: () => 0}}}, {}, o);
    assert.equal(none.energy.deployJ, 0); assert.ok(none.lapTime > base.lapTime);
  });
}
test('track.changeFactors: change.effect as a function = unset; null = the change has no effect', () => {
  const corners = [{number: 1, s: 400}, {number: 2, s: 900}];
  const changes = [{affectsLap: true, effect: {kind: 'grip', factor: 1.02}, range: {from: {turn: 1, part: 'apex'}, to: {turn: 2, part: 'apex'}}}];
  same(K.applyTrackChanges({...track, changeFactors: ch => ch.effect}, changes, corners).track.mu, K.applyTrackChanges(track, changes, corners).track.mu);
  same(K.applyTrackChanges({...track, changeFactors: () => null}, changes, corners).track.mu, track.mu);
  const half = K.applyTrackChanges({...track, changeFactors: () => ({kind: 'grip', factor: 1.01})}, changes, corners).track.mu;
  assert.ok(Math.abs(Math.max(...half) - 1.01) < 1e-12);
});
test('usableWidth: the given width = unset; a narrower usable width keeps the line inside it', () => {
  const n = 200, x = [], y = [], half = new Array(n).fill(6);
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; x.push(300 * Math.cos(a) + 80 * Math.cos(3 * a)); y.push(200 * Math.sin(a)); }
  same(minCurvatureLine(x, y, half, {iters: 300, usableWidth: (i, side, w) => w}), minCurvatureLine(x, y, half, {iters: 300}));
  const narrow = minCurvatureLine(x, y, half, {iters: 300, usableWidth: (i, side, w) => side === 'left' ? 2 : w});
  assert.ok(Math.max(...narrow.offset) <= 2 + 1e-9 && Math.min(...narrow.offset) >= -6 - 1e-9);
});
