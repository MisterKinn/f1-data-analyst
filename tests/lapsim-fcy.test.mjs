import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimFcy as F, lapsimFcyMeta as M} from '../worker/lapsim/fcy-data.js';
import {simulationPage} from '../worker/simulation.js';

test('FCY rates: every W14 row replays its shrinkage formula; only IMSA uses the track rate (W14 Gate G by series)', () => {
  const [h, ...rows] = readFileSync('scripts/sim/data/learn/endurance/fcy-model-parameters-w14.csv', 'utf8').trim().split('\n').map(l => l.split(','));
  for (const c of rows) { const x = Object.fromEntries(h.map((k, i) => [k, +c[i] || c[i]]));
    assert.ok(Math.abs((x.count + x.series_rate_per_h * x.prior_exposure_h) / (x.hours + x.prior_exposure_h) - x.rate_per_h) < 1e-9, x.track); }
  assert.equal(F.sebring.imsa.basis, 'track'); assert.equal(F['le-mans'].wec.basis, 'series'); assert.equal(F['le-mans'].wec.perHour, M.series.WEC);
  const en = simulationPage({track: 'le-mans'}, 'en');
  assert.match(en, /Full-course yellows and safety cars \(model\)/); assert.match(en, /WEC \(-0\.163 ± 0\.104\)/);
  assert.match(simulationPage({track: 'le-mans'}, 'ko'), /풀코스 옐로·세이프티카 \(모델\)/);
});
