// Step 35 D: FE front-axle cap (car.frontMaxW). Unset = four-tyre traction as before; 0 = rear drive; 50 kW sits between.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimFeTracks} from '../worker/lapsim/fe-tracks-data.js';
import {FE_GENS, feCarFor} from '../worker/lapsim/fe-cars.js';

test('FE front-axle cap: unset = today, 0 = rear drive, 50 kW between; flag off leaves feCarFor unchanged', () => {
  const K = lapsimKernel(), t = K.trackFromData(lapsimFeTracks['fe-london']), env = K.conditionsFromWeather({pressureHpa: 1013, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0});
  const car = FE_GENS['fe-gen3evo'].car, lap = c => K.simulateLap(t, c, env).lapTime;
  const awd = lap(car), rear = lap({...car, awdAboveKph: null}), cap0 = lap({...car, frontMaxW: 0}), cap50 = lap({...car, frontMaxW: 50e3});
  assert.equal(cap0, rear);
  assert.ok(awd < cap50 && cap50 < rear, `${awd} < ${cap50} < ${rear}`);
  if (!process.env.LAPSIM_FE_AXLE) assert.equal(feCarFor('fe-gen3evo', 2025, 'Qualifying Group A', 'Q').awdAboveKph, 0);
});
