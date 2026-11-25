import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {withinDriver, robustSd, pairSigma, summary, f1} from '../scripts/sim/noise-floor.mjs';

// invented laps: three drivers, a track getting 1 s/h faster, the same ±0.1 s scatter for each driver
const laps = ['A', 'B', 'C'].flatMap((who, k) => [0, 600, 1200, 1800].map((t, i) => ({who, t, y: 80 + k * 0.3 - t / 3600 + (i === 1 || i === 2 ? 0.1 : -0.1)})));

test('within-driver σ: the evolution slope is removed, the scatter is kept, slow laps are not push laps', () => {
  const w = withinDriver([...laps, {who: 'A', t: 2400, y: 95}]);
  assert.equal(w.drivers, 3); assert.equal(w.laps, 12);
  assert.ok(Math.abs(w.slopeSPerH + 1) < 0.2); // fitted within drivers, s per hour
  const s = robustSd(w.res) * 80 / 100; // back to seconds
  assert.ok(s > 0.08 && s < 0.2, `σ ${s}`);
  assert.equal(withinDriver(laps.filter(l => l.who === 'A')), null); // fewer than 3 drivers: no value
});

test('team-mate σ = √(mean Δ²/2) and the event bootstrap is seeded', () => {
  const p = pairSigma([[100, 101], [100, 100.5], [100]]);
  assert.equal(p.pairs, 2); assert.ok(Math.abs(p.sigma - Math.sqrt((1 + 0.25) / 2 / 2)) < 1e-12);
  assert.deepEqual(summary([1, 2, 3, 4, 5]), summary([1, 2, 3, 4, 5]));
  assert.equal(summary([]).n, 0);
});

test('F1 2022 (LOCKED) is never read', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nf-'));
  for (const y of [2022, 2023]) for (const d of ['AAA', 'BBB', 'CCC']) {
    mkdirSync(join(dir, String(y), 'Test GP', 'Qualifying', d), {recursive: true});
    writeFileSync(join(dir, String(y), 'Test GP', 'Qualifying', d, 'laptimes.json'), JSON.stringify({time: [80, 80.2, 80.1], sesT: [100, 700, 1300], iacc: [true, true, true], del: [false, false, false],
      wR: [false, false, false], compound: ['SOFT', 'SOFT', 'SOFT'], pout: ['None', 'None', 'None'], pin: ['None', 'None', 'None'], s1: [20, 20, 20], s2: [30, 30, 30], s3: [30, 30.2, 30.1], team: [d, d, d]}));
  }
  const r = f1(dir, [2022, 2023]);
  assert.equal(r.events, 1); assert.deepEqual(r.perEvent.map(e => e.event), ['2023 Test GP']);
});
