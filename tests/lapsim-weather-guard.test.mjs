// Weather guard (central 2026-11-25): empty cell = missing, never 0; an impossible pressure stops the caller; a strict fit stops on missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionsFromWeather} from '../worker/lapsim/atmosphere.js';

const std = conditionsFromWeather({}).rho;
test('missing or empty pressure takes the default (same as no weather)', () => {
  for (const w of [{pressureHpa: null}, {pressureHpa: undefined}, {pressureHpa: ''}, {pressureHpa: NaN}]) assert.equal(conditionsFromWeather(w).rho, std);
});
test('an empty CSV cell read as 0 hPa is an error, not a vacuum', () => {
  assert.throws(() => conditionsFromWeather({pressureHpa: +''}), /not a pressure/);
  assert.throws(() => conditionsFromWeather({pressureHpa: 29.9}), /not a pressure/); // inHg not converted
  assert.throws(() => conditionsFromWeather({pressureHpa: 1500}), /not a pressure/);
});
test('real pressures pass unchanged; strict fits stop on a missing pressure', () => {
  assert.ok(conditionsFromWeather({pressureHpa: 962.2, airTempC: 13.5}).rho > 1.1);
  assert.throws(() => conditionsFromWeather({}, {requirePressure: true}), /missing/);
  assert.doesNotThrow(() => conditionsFromWeather({pressureHpa: 1013}, {requirePressure: true}));
});
