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

test('σ_meas v2: lap-in-stint and evolution are removed before the spread; laps past the 1.5 % window are not kept', async () => {
  const {withinDriverV2, checkAlkamel} = await import('../scripts/sim/noise-floor.mjs');
  // three drivers, one stint each: +0.3 s per lap in stint (fuel / tyre), −1 s/h track, ±0.05 s scatter, one slow lap at 101.8 %
  const L = ['A', 'B', 'C'].flatMap((who, j) => [1, 2, 3, 4, 5, 6].map(k => ({who, k, t: 600 + 120 * k, y: 100 + j * 0.5 + 0.3 * k - (600 + 120 * k) / 3600 + (k % 2 ? 0.05 : -0.05) * (k > 3 ? -1 : 1)})));
  L.push({who: 'A', k: 7, t: 1440, y: 100 + 0.3 * 7 - 0.4 + 1.8});
  const w = withinDriverV2(L);
  // inside one stint the clock and lap-in-stint are collinear: the joint linear trend is removed (here it lands on the clock term)
  assert.equal(w.groups, 3); assert.ok(Math.abs(w.slopeSPerH - (0.3 / 120 * 3600 - 1)) < 0.5, `trend ${w.slopeSPerH}`);
  assert.equal(w.laps, 18); // the slow lap is outside 101.5 % after the correction
  const s = robustSd(w.res); assert.ok(s > 0.03 && s < 0.1, `σ ${s}`);
  assert.equal(withinDriverV2(L.filter(l => l.who !== 'C')), null);
  assert.equal(checkAlkamel('/nonexistent', 'scripts/sim/data/learn/alkamel-full-laps-manifest.json').ok, 0);
});

test('per-lap files (NLS, Al Kamel USAC): qualifying first, pit and deleted laps out, SP9 only for NLS', async () => {
  const {lapFiles} = await import('../scripts/sim/noise-floor.mjs'), {gzipSync} = await import('node:zlib'), {writeFileSync} = await import('node:fs');
  const laps = ['1', '2', '3'].flatMap(car => [1, 2, 3, 4].map(k => ({who: car + '|A', cls: 'SP9 PRO', clock: 500 * k, stint: 1, k, y: 500 + (k % 2 ? 0.5 : -0.5) + (k === 3 ? 0.3 : 0)})));
  laps.push({who: '1|A', cls: 'SP9 PRO', clock: 2500, stint: 1, k: 5, y: 480, deleted: true}, {who: '9|B', cls: 'SP3T', clock: 500, stint: 1, k: 1, y: 600});
  const f = join(mkdtempSync(join(tmpdir(), 'nl-')), 'l.json.gz');
  writeFileSync(f, gzipSync(JSON.stringify({sessions: [{series: 'nls', season: 2026, event: 'X', session: 'Qualifying', kind: 'qualifying', laps}]})));
  const r = lapFiles([f]);
  assert.deepEqual(Object.keys(r).filter(k => k !== 'note'), ['nls gt3 v2']); assert.equal(r['nls gt3 v2'].source.qualifying, 1);
});
