import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimEnergyClip as C} from '../worker/lapsim/energy-clip-data.js';
import {simulationPage} from '../worker/simulation.js';

// owner 2026-11-21: the 2026 clipping map from each weekend's dry practice (W17 practice plan), labelled as measured from practice
test('practice clipping maps: one per event, frozen before qualifying, values inside each straight', () => {
  assert.equal(C.label.ko, 'FP 기반 측정');
  assert.ok(Object.keys(C.events).length >= 20);
  for (const [id, e] of Object.entries(C.events)) {
    assert.equal(e.year, 2026, id);
    assert.ok(e.sessions.length && e.sessions.every(s => /^(Practice [123]|Sprint Qualifying)$/.test(s)), id + ' sessions');
    assert.ok(e.refM > 1500 && e.refM < 8000 && e.windows >= 35, id);
    assert.ok(e.teams['*'], id + ' field row');
    for (const rows of Object.values(e.teams)) for (const r of rows) {
      assert.ok(r.clip_probability >= 0 && r.clip_probability <= 1, id);
      if (r.sector >= 0) assert.ok(r.distance_m >= 0 && r.distance_m <= r.length_m + 1 && r.center_m < e.refM + 25, id + ' sector ' + r.sector);
    }
  }
});

test('the simulator shows practice clipping next to the model for the 2026 car only', () => {
  const html = String(simulationPage({track: 'miami', car: '2026'}, 'en'));
  assert.match(html, /<dt>Clipping \(measured from practice\)<\/dt><dd[^>]*>longest straight: \d+ m after full throttle \(\d+% of runs, FP1·SQ\) · model (\d+ m|no clip)</);
  assert.doesNotMatch(String(simulationPage({track: 'miami', car: '2025'}, 'en')), /<dt>Clipping \(measured from practice\)/);
});
