import test from 'node:test';
import assert from 'node:assert/strict';
import {diff} from '../scripts/sim/pipeline-report.mjs';
import {lapsimCalibration as cal} from '../worker/lapsim/calibration-data.js';

test('pipeline report: the shipped calibration reproduces itself', () => {
  const d = diff(cal, structuredClone(cal));
  assert.equal(d.identical, true);
  assert.ok(d.heldOut.all.n > 0);
});

test('pipeline report: a moved car parameter and held-out row are listed', () => {
  const c = structuredClone(cal), y = Object.keys(c.seasons).find(k => c.seasons[k].holdout?.tracks?.length);
  c.seasons[y].car.cdA += 0.01; c.seasons[y].holdout.tracks[0].errorSec += 0.1;
  const d = diff(cal, c);
  assert.equal(d.identical, false);
  assert.deepEqual(d.changedCarParams.map(x => x.where + ' ' + x.param), [`f1 ${y} cdA`]);
  assert.equal(d.changedRows.length, 1);
});
