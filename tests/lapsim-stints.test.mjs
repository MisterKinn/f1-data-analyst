import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimStints} from '../worker/lapsim/stint-data.js';
import {driveEnergyJ, stintFromEnergy} from '../worker/lapsim/stint-energy.js';
import worker from '../worker/index.js';

test('driveshaft energy: constant speed on a flat loop is drag + rolling resistance only', () => {
  const n = 100, ds = 10, track = {ds, aeroLow: null, grade: null}, car = {mass: 1000, cdA: 1, clA: 0, cRoll: 0.01};
  const e = driveEnergyJ(track, car, {rho: 1.2}, new Array(n).fill(50));
  assert.ok(Math.abs(e - (0.5 * 1.2 * 2500 + 0.01 * 1000 * 9.81) * n * ds) < 1);
  assert.deepEqual(stintFromEnergy(900, 30e6, 100), {laps: 30, minutes: 50, lapMJ: 30});
});

test('stint model: race factor in a physical range, held-out error reported, 2025 rows carry the real BoP', () => {
  assert.ok(lapsimStints.k > 0.6 && lapsimStints.k < 1.05);
  assert.ok(lapsimStints.test.rmsPct < 10 && lapsimStints.test.events >= 3);
  for (const ys of Object.values(lapsimStints.tracks)) for (const [y, by] of Object.entries(ys)) for (const r of Object.values(by)) {
    assert.ok(r.laps > 5 && r.MJ > 500 && r.MJ < 1200);
    if (r.basis === 'bop') assert.equal(+y, 2025, 'only 2025 BoP is published');
    if (r.basis === 'estimated') assert.ok(r.plusMinusMJ > 0 && ['low', 'normal'].includes(r.confidence), 'estimates carry an error and a confidence');
  }
});

test('simulation page shows the Hypercar stint energy panel on WEC tracks', async () => {
  const h = await (await worker.fetch(new Request('https://example.com/simulation?track=interlagos'), {})).text();
  assert.match(h, /하이퍼카 스틴트 에너지/);
  assert.match(h, /Aston Martin/);
});
