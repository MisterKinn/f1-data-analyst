import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync} from "node:fs";
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

test('Timing71 σ_meas v2: per series × class, qualifying first, pit and wet laps dropped', async () => {
  const {t71} = await import('../scripts/sim/noise-floor.mjs');
  const d = mkdtempSync(join(tmpdir(), 't71-')), rows = [];
  for (const ev of ['A', 'B', 'C']) for (let c = 0; c < 5; c++) for (let l = 1; l <= 6; l++)
    rows.push({series: 'gtwce', cls: 'PRO', season: 2025, event: ev, sessionType: 'Q', rid: ev, entry: String(c), driver: 'd' + c, stint: 1, stintLap: l, tEnd: 100 * l + c, time: 100 + c * 0.3 + 0.1 * ((l * 7 + c) % 3 - 1), q: l === 6 ? ['pit_in'] : []});
  rows.push({series: 'gtwce', cls: 'PRO', season: 2025, event: 'A', sessionType: 'Q', rid: 'A', entry: '0', driver: 'd0', stint: 1, stintLap: 7, tEnd: 700, time: 100.001, q: ['wet_session']});
  writeFileSync(join(d, 'x.ndjson'), rows.map(r => JSON.stringify(r)).join('\n'));
  const r = t71(d)['gtwce PRO v2'];
  assert.equal(r.n, 3); assert.deepEqual(r.source, {qualifying: 3, practice: 0}); assert.ok(r.median > 0 && r.median < 0.2);
  assert.match(t71(join(d, 'none')).note, /not measured/);
});

test('content checks: a changed file is "bad" (job fails), a file a copy does not hold yet is "missing" (listed, not measured)', async () => {
  const {checkAlkamel, checkFiles} = await import('../scripts/sim/noise-floor.mjs'), {gzipSync} = await import('node:zlib'), {dirname} = await import('node:path');
  const M = JSON.parse(readFileSync('scripts/sim/data/learn/alkamel-full-laps-manifest.json', 'utf8')).files, store = mkdtempSync(join(tmpdir(), 'ak-'));
  mkdirSync(dirname(join(store, M[0].path)), {recursive: true}); writeFileSync(join(store, M[0].path), gzipSync('not the file'));
  const c = checkAlkamel(store); assert.deepEqual(c.bad, [M[0].path]); assert.equal(c.missing.length, M.length - 1); assert.equal(c.ok, 0);
  // all-laps copy: every file under the prefix must be there with its sha256
  const A = JSON.parse(readFileSync('scripts/sim/data/learn/all-laps-2026-11-11-manifest.json', 'utf8')), t71 = A.manifest.filter(f => f.path.startsWith('laps-t71-'));
  assert.ok(t71.length > 0 && A.tars.length === A.artifacts);
  const r = checkFiles(store, 'scripts/sim/data/learn/all-laps-2026-11-11-manifest.json', 'laps-t71-'); assert.equal(r.files, t71.length); assert.equal(r.ok, 0);
});

test('Timing71 rows: an event name with "|" does not break the session keys', async () => {
  const {t71} = await import('../scripts/sim/noise-floor.mjs'), dir = mkdtempSync(join(tmpdir(), 't71-'));
  const rows = ['1', '2', '3'].flatMap(entry => [1, 2, 3].map(i => ({series: 'alms', cls: 'GT', season: 2026, event: 'Asian Le Mans Series | 4 Hours of Dubai', sessionType: 'Q', rid: 'x',
    entry, driver: 'D' + entry, tEnd: 100 * i, time: 120 + (i === 2 ? 0.1 : -0.05), stint: 1, stintLap: i, q: []})));
  writeFileSync(join(dir, 'a.ndjson'), rows.map(r => JSON.stringify(r)).join('\n'));
  const r = t71(dir); assert.deepEqual(Object.keys(r).filter(k => k !== 'note'), ['alms GT v2']);
});
