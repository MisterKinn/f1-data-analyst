// Step 35 E: car.brakeAxle (rear axle braked by regen only). Never binding = today's lap; binding = never faster, < 1 % slower.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimFeTracks} from '../worker/lapsim/fe-tracks-data.js';
import {FE_GENS} from '../worker/lapsim/fe-cars.js';

test('FE brakeAxle hook: unset/huge cap = today, 350 kW cap slightly slower', () => {
  const K = lapsimKernel(), car = FE_GENS['fe-gen3evo'].car;
  for (const id of ['fe-london', 'fe-jeddah']) { const tr = K.trackFromData(lapsimFeTracks[id]), base = K.simulateLap(tr, car, {}).lapTime;
    assert.equal(K.simulateLap(tr, {...car, brakeAxle: {rearMaxW: 1e12, eta: 0.95}}, {}).lapTime, base);
    const v = K.simulateLap(tr, {...car, brakeAxle: {rearMaxW: 350e3, eta: 0.95}}, {}).lapTime;
    assert.ok(v >= base && v < base * 1.01, `${id}: ${v} vs ${base}`); }
});
