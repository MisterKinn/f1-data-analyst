import test from 'node:test';
import assert from 'node:assert/strict';
import {kForVariants} from '../scripts/sim/gate.mjs';

// Gate G v3 (AGENTS.md): k = t-quantile at one-sided 1 − 0.16 / m, n − 1 degrees of freedom (values from SciPy, 2026-11-22).
test('kForVariants: t-based k for small n, old table without n', () => {
  const want = {1: [1.13, 1.07, 1.05], 2: [1.72, 1.57, 1.53], 3: [2.07, 1.85, 1.79], 5: [2.54, 2.20, 2.11]};
  for (const [m, ks] of Object.entries(want)) [5, 8, 10].forEach((n, i) => assert.ok(Math.abs(kForVariants(+m, n) - ks[i]) < 0.011, `m ${m} n ${n}`));
  assert.deepEqual([1, 2, 3, 5].map(m => kForVariants(m)), [1, 1.45, 1.65, 1.9]);
  assert.ok(kForVariants(2, 8) > kForVariants(2, 67));
});
