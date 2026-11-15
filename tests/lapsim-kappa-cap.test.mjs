import test from 'node:test';
import assert from 'node:assert/strict';
import {capCurvature} from '../worker/lapsim/geometry.js';

test('curvature cap: an impossible fast bend is cut to gMax/v², a slow corner is kept', () => {
  // 50 m radius taken at 250 km/h would need 9.8 g; the same radius at 80 km/h is a normal corner
  const kappa = Array(200).fill(2000), laps = [{s: Array.from({length: 100}, (_, i) => i * 10), v: Array.from({length: 100}, (_, i) => i < 50 ? 250 : 80)}];
  const r = capCurvature(kappa, 5, laps, 6.5), cap = Math.round(6.5 * 9.81 / (250 / 3.6) ** 2 * 1e5);
  assert.equal(r.kappa[20], cap);
  assert.equal(r.kappa[150], 2000);
  assert.ok(r.points > 90 && r.points < 110);
});

test('curvature cap: no laps, no change', () => {
  const kappa = [100, -300, 2000];
  assert.deepEqual(capCurvature(kappa, 5, []).kappa, kappa);
});
