import test from 'node:test';
import assert from 'node:assert/strict';
import {carType, bestPerType, toMetric} from '../scripts/sim/fetch-track-laps.mjs';

test('an LMH in IMSA GTP is an LMH lap; the best lap is kept per car type, not per class', () => {
  assert.equal(carType('imsa', 'GTP', 'Aston Martin'), 'lmh');
  assert.equal(carType('imsa', 'GTP', 'Cadillac'), 'lmdh');
  assert.equal(carType('wec', 'HYPERCAR', 'Ferrari'), 'lmh');
  assert.equal(carType('wec', 'HYPERCAR', 'Porsche'), 'lmdh');
  assert.equal(carType('imsa', 'GTD PRO', 'BMW'), 'gtdpro');
  const row = (n, m, t, x = {}) => ({NUMBER: n, CLASS: 'GTP', MANUFACTURER: m, LAP_TIME: t, FLAG_AT_FL: 'GF', CROSSING_FINISH_LINE_IN_PIT: '', S1: '22.951', S2: '44.192', S3: '27.370', TOP_SPEED: '324.3', ...x});
  const b = bestPerType('imsa', [row('10', 'Cadillac', '1:34.513'), row('23', 'Aston Martin', '1:35.857'), row('23', 'Aston Martin', '1:35.100', {CROSSING_FINISH_LINE_IN_PIT: 'B'}), row('23', 'Aston Martin', '1:34.000', {FLAG_AT_FL: 'FCY'})]);
  assert.equal(b.lmdh.lap, 94.513); assert.equal(b.lmdh.car, '10');
  assert.equal(b.lmh.lap, 95.857); assert.deepEqual(b.lmh.sectors, [22.951, 44.192, 27.37]); // pit lap and yellow lap are not clean laps
});

test('IMSA weather (°F, inHg) is converted; WEC weather (°C, hPa) is left alone', () => {
  const us = toMetric({airTempC: 70.02, trackTempC: 84.96, humidityPct: 72.3, pressureHpa: 30.04, rain: false});
  assert.ok(Math.abs(us.airTempC - 21.12) < 0.01 && Math.abs(us.trackTempC - 29.42) < 0.01 && Math.abs(us.pressureHpa - 1017.3) < 0.1);
  const eu = {airTempC: 19.04, trackTempC: 29.94, humidityPct: 45.62, pressureHpa: 1015.91, rain: false};
  assert.deepEqual(toMetric(eu), eu);
});
