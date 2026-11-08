import test from 'node:test';
import assert from 'node:assert/strict';
import {brakeZones} from '../worker/lapsim/brakes.js';
import {lapsimBrakes} from '../worker/lapsim/brake-data.js';
import worker from '../worker/index.js';

const car = (axle, extra = {}) => ({mass: 1000, wheelbase: 3, cogHeight: 0.3, rearWeight: 0.5, rearAero: 0.5, cdA: 1, clA: 3, ers: axle ? {axle, regenMax: 200e3, regenShare: 0.6} : {}, ...extra});
// one straight-line stop from 300 to 100 km/h at about 4 g, then a slow stretch
const v = [...Array(40).fill(83.3), ...Array.from({length: 20}, (_, i) => 83.3 - i * 2.8), ...Array(40).fill(27.8)], limit = v.map((x, i) => i >= 40 && i < 59 ? 3 : 2);
const track = {ds: 5, aeroLow: null};

test('one braking zone: speeds, deceleration, and regen taken on its own axle', () => {
  const none = brakeZones(track, car(null), {rho: 1.2}, v, limit), front = brakeZones(track, car('front'), {rho: 1.2}, v, limit), rear = brakeZones(track, car('rear'), {rho: 1.2}, v, limit);
  assert.equal(none.zones.length, 1);
  assert.ok(none.zones[0].vFrom > 290 && none.zones[0].vTo < 110);
  assert.ok(front.energy.frontPct < none.energy.frontPct && rear.energy.frontPct > none.energy.frontPct, 'front regen unloads the front brakes, rear regen the rear');
  assert.ok(front.energy.regenKWh > 0 && none.energy.regenKWh === 0);
});

test('fit on Brembo figures: pedal load per g and held-out errors are reported', () => {
  assert.ok(lapsimBrakes.pedalKgPerG > 20 && lapsimBrakes.pedalKgPerG < 45);
  assert.ok(lapsimBrakes.test.decelG.n >= 30 && lapsimBrakes.test.decelG.rmsPct < 30);
});

test('brake panel shows Brembo real figures next to the model for F1', async () => {
  const h = await (await worker.fetch(new Request('https://example.com/simulation?track=monza&car=2026'), {})).text();
  assert.match(h, /data-ls="brakes"/);
  assert.match(h, /Brembo 실측/);
  assert.match(h, /앞 브레이크 압력 \(추정\)/);
});
