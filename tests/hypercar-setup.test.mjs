import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {SERIES} from '../worker/lapsim/series.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {withSetup, optimalSetup, setupFromTiming, priorCar} from '../worker/lapsim/hypercar-setup.js';

const K = lapsimKernel(), car = SERIES.wec.classes.lmdh.prior;
const env = K.conditionsFromWeather({airTempC: 25, trackTempC: 35, humidityPct: 50, pressureHpa: 1010});

test('set-up read back from trap speed and sector split', () => {
  const id = Object.keys(lapsimTracks).includes('monza') ? 'monza' : Object.keys(lapsimTracks)[0];
  const tr = K.trackFromData(lapsimTracks[id]);
  const r = K.simulateLap(tr, withSetup(car, 0.3), env);
  const s = setupFromTiming(K, tr, car, env, {trapKph: r.vMaxKph, sectors: r.sectors});
  assert.ok(Math.abs(s - 0.3) < 0.05, String(s));
  const o = optimalSetup(K, tr, car, env);
  assert.ok(o.s >= 0 && o.s <= 1 && o.lapTime <= r.lapTime + 1e-6);
});

test('a new LMDh car starts from its chassis family, with the first-season step', () => {
  const mk = (cl, cls) => ({cls, car: {...car, clA: cl, cdA: 1}, teamBias: 0});
  const cars = {bmw: mk(3.0, 'lmdh'), cadillac: mk(3.4, 'lmdh'), porsche: mk(5, 'lmdh'), toyota: mk(9, 'lmh')};
  const p = priorCar(cars, {make: 'mclaren', cls: 'lmdh', firstSeason: true});
  assert.equal(p.basis, 'chassis:dallara');
  assert.ok(Math.abs(p.car.clA - 3.2) < 1e-9);
  assert.equal(p.pacePct, 0.5);
});
