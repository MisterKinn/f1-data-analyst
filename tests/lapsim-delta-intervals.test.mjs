// Step 29b: ± range and check status on LapSim Δ answers (rule docs/prereg/step29b-delta-intervals-2026-11-25.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {quantile} from '../scripts/sim/delta-intervals.mjs';
import {lapsimDeltaIntervals as D} from '../worker/lapsim/delta-intervals-data.js';
import {lapsimCalibration} from '../worker/lapsim/calibration-data.js';
import {deltaCheck, deltaStale, DELTA_TYPES} from '../worker/lapsim/delta-intervals.js';
import {simulate} from '../worker/lapsim/tool.js';
import {simulationPage} from '../worker/simulation.js';

const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const withFlag = f => { process.env.LAPSIM_DELTA_PM = 'on'; try { return f(); } finally { delete process.env.LAPSIM_DELTA_PM; } };

test('quantile is type 7 (numpy default)', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6];
  assert.equal(quantile(x, 0.5), 3.5);
  assert.ok(Math.abs(quantile(x, 0.05) - 1) < 1e-12);
  assert.ok(Math.abs(quantile(x, 0.95) - 7.95) < 1e-12);
});

test('data file is rebuilt from the pinned inputs and never reads the 2022 LOCKED cases', t => {
  assert.equal(D.drs.source.sha256, sha('scripts/sim/data/f1-delta/baseline-pooled-2026-11-24.csv'));
  assert.equal(D.rule.sha256, sha(D.rule.path));
  assert.doesNotMatch(readFileSync('scripts/sim/delta-intervals.mjs', 'utf8'), /LOCKED/);
  if (sha('worker/lapsim/calibration-data.js') !== D.calibration.sha256) return t.skip('calibration refitted: ranges show as stale until rebuilt');
  const r = spawnSync(process.execPath, ['scripts/sim/delta-intervals.mjs', '--check'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(D.drs.n, 125); assert.equal(D.lap.f1.n, 35); assert.equal(D.lap.wec.n, 33);
});

test('flag off (default): connector and page unchanged', () => {
  delete process.env.LAPSIM_DELTA_PM;
  const a = simulate({track: 'monza', car: '2025', drs: false, compare_car: '2026'});
  for (const k of ['delta_checks', 'option_delta', 'sensitivity_check']) assert.ok(!(k in a), k);
  assert.ok(!('lap_check' in a.uncertainty) && !('delta_check' in a.compare));
  assert.ok(!String(simulationPage({track: 'monza', car: '2025'}, 'en')).includes('"deltaPm"'));
});

test('flag on: DRS Δ gets the measured range, other types their status', t => {
  if (deltaStale()) return t.skip('stale calibration');
  const a = withFlag(() => simulate({track: 'monza', car: '2025', drs: false, compare_car: '2026'}));
  const o = a.option_delta, c = o.check;
  assert.equal(c.status, 'checked');
  const lo = Math.min(o.delta_s * D.drs.q05, o.delta_s * D.drs.q95), hi = Math.max(o.delta_s * D.drs.q05, o.delta_s * D.drs.q95);
  assert.ok(Math.abs(c.range_s[0] - lo) <= 0.006 && Math.abs(c.range_s[1] - hi) <= 0.006, JSON.stringify(c));
  assert.equal(a.uncertainty.lap_check.status, 'checked');
  assert.ok(a.uncertainty.lap_check.range_s[0] < a.result.lap_seconds && a.result.lap_seconds < a.uncertainty.lap_check.range_s[1]);
  assert.equal(a.compare.delta_check.status, 'unchecked');
  assert.deepEqual(Object.fromEntries(Object.entries(a.sensitivity_check).map(([k, v]) => [k, v.status])),
    {mass: 'data limit', tyre_grip: 'unchecked', downforce_clA: 'unchecked', drag_cdA: 'unchecked', engine_power: 'data limit'});
  assert.deepEqual(Object.keys(a.delta_checks.types), Object.keys(DELTA_TYPES));
  for (const v of Object.values(a.delta_checks.types)) if (v.status !== 'checked') assert.ok(!('range_s' in v) && v.reason);
  // 2026 Straight Mode is not covered by the DRS check; a projected car has no lap check
  const b = withFlag(() => simulate({track: 'monza', car: '2026', straight_mode: 'off'}));
  assert.equal(b.option_delta.check.status, 'unchecked');
  assert.equal(withFlag(() => simulate({track: 'monza', car: '2027'})).uncertainty.lap_check.status, 'unchecked');
  assert.equal(withFlag(() => simulate({track: 'monza', car: 'wec-lmh'})).uncertainty.lap_check.status, 'checked');
  assert.match(String(withFlag(() => simulationPage({track: 'monza', car: '2025'}, 'en'))), /Lap range \(90 %, held-out\)<\/dt><dd[^>]*>1:\d\d\.\d{3} – 1:\d\d\.\d{3} · checked \(n 35\)/);
});

test('another calibration makes every checked range stale', () => {
  const c = structuredClone(lapsimCalibration); c.seasons['2025'].holdout.tracks[0].errorSec += 0.001;
  assert.equal(deltaStale(c), true);
  assert.equal(deltaStale(lapsimCalibration), sha('worker/lapsim/calibration-data.js') !== D.calibration.sha256);
});
