// Wave 3 (b): track-factor centring (claude/gate-wave3-fit-restructure-prereg-2026-11-24.md). Centring moves the mean ln grip and
// ln drag of the track factors into the cars' μy and CdA / CdA-low; every lap's score must stay the same and the sums become 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {trackFromData} from '../worker/lapsim/tracks.js';
import {PRIOR} from '../worker/lapsim/cars.js';
import {simulateLap} from '../worker/lapsim/engine.js';
import {centreFactors, buildCar, lapScore} from '../scripts/sim/joint-bcd.mjs';

test('centring keeps lap scores and zeroes Σ ln G and Σ ln D', () => {
  const base = {...structuredClone(PRIOR[2025]), linkMu: true};
  const params = ['muY', 'clA', 'cdA', 'cdALow'].map(k => ({key: k, path: k, base: base[k]}));
  const ids = ['monza', 'suzuka'], laps = ids.map(id => {
    const track = trackFromData(lapsimTracks[id]), r = simulateLap(track, base, {});
    return {name: id, track, env: {}, lapSeconds: r.lapTime * 1.01, obs: null, sectors: null};
  });
  const g = {key: 2025, base, params, laps};
  const factors = {monza: {grip: 1.08, drag: 0.93}, suzuka: {grip: 1.02, drag: 1.11}}, xs = {2025: [0.01, 0, 0.02, 0]};
  const o = {wTime: 20, wSector: 0};
  const lap = () => laps.map(l => lapScore(l, buildCar(g, xs[2025]).car, factors[l.name], o).res.lapTime);
  const before = lap();
  const {lg, ld} = centreFactors([g], ids, factors, xs, o);
  assert.ok(Math.abs(lg) > 0.01 && Math.abs(ld) > 0.005);
  assert.ok(Math.abs(ids.reduce((a, n) => a + Math.log(factors[n].grip), 0)) < 1e-12);
  assert.ok(Math.abs(ids.reduce((a, n) => a + Math.log(factors[n].drag), 0)) < 1e-12);
  // drag folds exactly; grip folds up to the kernel's load term (dmuDfz acts on the car μ only): at most about 1 % of the shift (0.04 % of the lap for 4.8 %)
  const after = lap();
  for (let k = 0; k < laps.length; k++) assert.ok(Math.abs(after[k] / before[k] - 1) < 0.01 * Math.abs(lg), `${ids[k]} ${before[k]} → ${after[k]}`);
});

test('a measured (fixed) drag factor is not centred', () => {
  const g = {key: 2025, params: [{key: 'cdA'}], laps: []}, factors = {a: {grip: 1.1, drag: 1.1}, b: {grip: 1, drag: 1}}, xs = {2025: [0]};
  const {ld} = centreFactors([g], ['a', 'b'], factors, xs, {fixedDrag: {a: 1.1}});
  assert.equal(ld, 0); assert.equal(factors.a.drag, 1.1); assert.equal(xs[2025][0], 0);
});
