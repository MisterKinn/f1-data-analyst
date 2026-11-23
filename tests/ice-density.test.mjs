// Step 13-prep: per-class engine density exponent behind LAPSIM_ICE_BETA (claude/gate-ice-density-prereg-2026-11-23.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {carsFor} from '../worker/lapsim/scenario.js';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {lapsimIceDensity as D} from '../worker/lapsim/ice-density-data.js';
import {iceClassOf} from '../worker/lapsim/ice-density.js';

const K = lapsimKernel(), ID = 'spa-francorchamps';
const withFlag = (v, f) => { const old = process.env.LAPSIM_ICE_BETA; if (v == null) delete process.env.LAPSIM_ICE_BETA; else process.env.LAPSIM_ICE_BETA = v; try { return f(); } finally { if (old == null) delete process.env.LAPSIM_ICE_BETA; else process.env.LAPSIM_ICE_BETA = old; } };
const lapOf = (cars, k) => { const c = cars[k], tr = K.trackFromData(lapsimTracks[ID]); tr.mu.fill(c.grip); return K.simulateLap(tr, c.car, K.conditionsFromWeather({airTempC: 32, pressureHpa: 990})).lapTime; };

test('flag off: no car carries iceDensityExp', () => withFlag(null, () => {
  for (const [k, e] of Object.entries(carsFor(ID))) assert.equal(e.car?.iceDensityExp, undefined, k);
}));

test('flag on: class values from the data file; unmeasured cars untouched', () => withFlag('measured', () => {
  const c = carsFor(ID);
  assert.equal(c['wec-lmgt3'].car.iceDensityExp, D.classes.gt3.beta);
  assert.equal(c['wec-lmh'].car.iceDensityExp, D.classes.hypercar.beta);
  assert.equal(c['wec-lmdh'].car.iceDensityExp, D.classes.hypercar.beta);
  assert.equal(c['elms-lmgt3'].car.iceDensityExp, D.classes.gt3.beta);
  assert.equal(c['2025'].car.iceDensityExp, D.classes.f1?.beta);
  for (const k of ['2026', '2027', '2028', 'base2019']) assert.equal(c[k].car.iceDensityExp, undefined, k);
  for (const k of Object.keys(c).filter(k => k.startsWith('fe-'))) assert.equal(c[k].car.iceDensityExp, undefined, k);
}));

test('flag on does not mutate shared car objects', () => {
  withFlag('measured', () => carsFor(ID));
  withFlag(null, () => { for (const [k, e] of Object.entries(carsFor(ID))) assert.equal(e.car?.iceDensityExp, undefined, k); });
});

test('laps unchanged with the flag on until the kernel reads the field (gate 13)', () => {
  const off = withFlag(null, () => carsFor(ID)), on = withFlag('measured', () => carsFor(ID));
  for (const k of ['2025', '2026', 'wec-lmh', 'wec-lmdh', 'wec-lmgt3']) assert.equal(lapOf(on, k), lapOf(off, k), k);
});

test('class mapping', () => {
  assert.equal(iceClassOf('imsa-gtp'), 'hypercar');
  assert.equal(iceClassOf('gt3-ferrari-296-gt3'), 'gt3');
  assert.equal(iceClassOf('gtwc-gt3', {proxyOf: 'wec-lmgt3'}), 'gt3');
  assert.equal(iceClassOf('2026'), null);
  assert.equal(iceClassOf('fe-gen3'), null);
});

test('data file matches the measurement output; values physical', () => {
  const o = JSON.parse(readFileSync('scripts/sim/data/learn/ice-density-classes.json'));
  assert.equal(D.classes.gt3.beta, o.table.GT3.value);
  assert.equal(D.classes.hypercar.beta, o.table.HYPERCAR.value);
  assert.equal(o.methodCheck.trusted, true); // WEC LMP2 positive control: interval includes 1, excludes 0.15
  for (const v of Object.values(D.classes)) { assert.ok(v.beta > -0.5 && v.beta < 1.5); assert.ok(v.ci90[0] <= v.beta && v.beta <= v.ci90[1]); }
});

test('kernel read used by the gate-13 patch: β 0.15 reproduces the env factor', () => {
  const e = K.conditionsFromWeather({airTempC: 35, pressureHpa: 780});
  assert.equal(K.icePowerFactor(e.rho, {beta: 0.15}), e.iceFactor);
});
