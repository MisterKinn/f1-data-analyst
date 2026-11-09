import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimCalibration as c} from '../worker/lapsim/calibration-data.js';
import {lapsimTransferGrip} from '../worker/lapsim/transfer-grip-data.js';

test('WEC uses transfer track factors only where the held-out error is not worse', () => {
  assert.ok(Object.keys(lapsimTransferGrip.grip).length >= 20);
  let n = 0;
  for (const ys of Object.values(c.series.wec)) for (const s of Object.values(ys)) {
    const g = s.gripSource; if (!g?.transferRmsPct) continue; n++;
    if (g.used === 'transfer') assert.ok(g.transferRmsPct <= g.f1RmsPct);
    else assert.ok(g.transferRmsPct > g.f1RmsPct);
    assert.ok(s.holdout.rmsPct <= g.f1RmsPct + 1e-9); // never worse than the F1-factor model
  }
  assert.ok(n >= 6);
});
