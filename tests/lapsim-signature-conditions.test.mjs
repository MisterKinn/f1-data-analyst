import test from 'node:test';
import assert from 'node:assert/strict';
import {lapEvents, trackSignature} from '../scripts/sim/residual-signature.mjs';
import {rowsOf, slope} from '../scripts/sim/condition-report.mjs';
import {lapsimCalibration} from '../worker/lapsim/calibration-data.js';

// synthetic lap: two straights and two corners; the model copy is 10 % slower in corners and brakes 20 m later
const lap = (cf, shift) => { const L = 2000, x = [], v = [], b = [];
  for (let s = 0; s < L; s += 2) { const d = Math.min(Math.abs(s - 600), Math.abs(s - 1500)); const vc = 30 * cf, vt = 80;
    const sp = d < 40 ? vc : Math.min(vt, vc + (d - 40) * 0.25); x.push(s); v.push(sp);
    b.push(((s > 600 - 260 + shift && s < 600) || (s > 1500 - 260 + shift && s < 1500)) && sp > vc + 1 ? 1 : 0); }
  return {x, v, b, L}; };

test('residual signature: corner ratio and brake onset on a synthetic lap', () => {
  const M = lap(1, 0), P = lap(0.9, 20);
  const sig = trackSignature(lapEvents(M.x, M.v, M.b, M.L), lapEvents(P.x, P.v, P.b, P.L), M.L);
  assert.ok(sig.n >= 2);
  assert.ok(Math.abs(sig.corner[0] - 0.9) < 0.02, `corner ${sig.corner[0]}`);
  assert.ok(sig.brake > 0, `brake ${sig.brake}`);
});

test('condition report: rows joined to weather, slope with interval', () => {
  const rows = rowsOf(lapsimCalibration);
  assert.ok(rows.length >= 30 && rows.every(r => Number.isFinite(r.errPct)));
  const s = slope([1, 2, 3, 4, 5, 6], [2, 4, 6, 8, 10, 12]);
  assert.ok(Math.abs(s.b - 2) < 1e-9 && s.r2 > 0.99 && s.ci90[0] <= 2 && s.ci90[1] >= 2);
  assert.ok(Number.isNaN(slope([1, 2], [1, 2]).b));
});
