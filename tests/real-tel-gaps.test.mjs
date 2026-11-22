import test from 'node:test';
import assert from 'node:assert/strict';
import {telGaps, cleanTel} from '../worker/lapsim/real-tel-gaps.js';
import {lapsimF1RealTel} from '../worker/lapsim/f1-real-telemetry-data.js';

test('repeated samples and the invalid 104 % throttle are broken stretches; a real speed plateau is not', () => {
  const r = {len: 1000, f: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000], speed: [100, 110, 120, 120, 120, 120, 130, 140, 150, 160],
    rpm: [9000, 9500, 10000, 10000, 10000, 10000, 10500, 11000, 11500, 12000], throttle: [100, 100, 100, 100, 100, 100, 100, 100, 104, 100]};
  assert.deepEqual(telGaps(r), [[3000, 6000], [8000, 9000]]);
  const plateau = {...r, rpm: r.rpm.map((x, i) => x + i), throttle: r.throttle.map(() => 100)};
  assert.deepEqual(telGaps(plateau), []);
  const c = cleanTel(r); assert.deepEqual(c.x, [0, 100, 200, 600, 700, 900]); assert.equal(c.near(450), true); assert.equal(c.near(50), false);
});
test('Suzuka 2026: the frozen end of the measured lap (4.0 km to the line) is found; Baku 2025 main straight is not', () => {
  const g = telGaps(lapsimF1RealTel.suzuka['2026']), L = lapsimF1RealTel.suzuka['2026'].len;
  assert.ok(g.some(([a, b]) => a / 1e4 * L < 4100 && b / 1e4 * L > 5300));
  const b = telGaps(lapsimF1RealTel.baku['2025']); assert.ok(!b.some(([a]) => a / 1e4 * lapsimF1RealTel.baku['2025'].len > 5500));
});
