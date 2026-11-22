import test from 'node:test';
import assert from 'node:assert/strict';
import {telGaps, cleanTel} from '../worker/lapsim/real-tel-gaps.js';
import {lapsimF1RealTel} from '../worker/lapsim/f1-real-telemetry-data.js';

const lap = (speed, rpm, extra = {}) => ({len: 80, f: speed.map((_, i) => i * 1e4 / speed.length), speed, rpm, gear: speed.map(() => 8),
  throttle: speed.map(() => 100), brake: speed.map(() => 0), ...extra});

test('rule A+: a long full freeze and the invalid throttle are broken; a short plateau without a jump stays measured', () => {
  const plateau = lap([300, 305, 310, 310, 310, 310, 312, 314, 316, 318], [11000, 11100, 11200, 11200, 11200, 11200, 11250, 11300, 11350, 11400]);
  assert.deepEqual(telGaps(plateau), []);
  const bad = lap(plateau.speed, plateau.rpm, {throttle: [100, 100, 100, 100, 100, 100, 100, 100, 104, 100]});
  assert.deepEqual(telGaps(bad), [[8000, 9000]]);
});
test('rule A+: a short hold that ends in an impossible step is broken', () => {
  // 272 km/h held, then 280 km/h one sample (8 m) later: +2.2 g at full throttle
  const r = {len: 80, f: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000], speed: [268, 270, 272, 272, 272, 272, 280, 281, 282, 283],
    rpm: [10500, 10550, 10600, 10600, 10600, 10600, 10700, 10750, 10800, 10850], gear: Array(10).fill(7), throttle: Array(10).fill(100), brake: Array(10).fill(0)};
  assert.deepEqual(telGaps(r), [[3000, 6000]]);
  const c = cleanTel(r); assert.deepEqual(c.x, [0, 8, 16, 48, 56, 64, 72]); assert.equal(c.near(30), true);
});
test('site pole laps: Suzuka 2026 end of lap is broken; no 2025 pole lap is', () => {
  const r = lapsimF1RealTel.suzuka['2026'], g = telGaps(r);
  assert.ok(g.some(([a, b]) => a / 1e4 * r.len < 4100 && b / 1e4 * r.len > 5300));
  for (const [t, ys] of Object.entries(lapsimF1RealTel)) if (ys['2025']) assert.deepEqual(telGaps(ys['2025']), [], t);
});
