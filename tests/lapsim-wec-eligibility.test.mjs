import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {buildEligibility, shareCheck, verifyEligibility, rowEligibility, eligibilityInputs, sha256} from '../scripts/sim/wec-eligibility.mjs';
import {applyWecTiming} from '../scripts/sim/wec-timing.mjs';

const track = {ds: 10, kappa: new Float64Array(100), sectors: [300, 700]};
const mapping = {track: 'test', year: 2025, sourceUrl: 'https://official.example', layoutLengthM: 1000, s1EndM: 200, s2EndM: 600};
const measured = {lap: 100, sectors: [20, 40, 40], car: 'one'};
const wec = ['lmh', 'lmdh'].map(cls => ({cls, year: 2025, track: 'test', event: 'test', laps: [measured]}));
const production = {seasons: {2025: {tracks: {test: {grip: 1}}}}, series: {wec: Object.fromEntries(wec.map(w => [w.cls,
  {2025: {car: {reference: w.cls}, tracks: {test: {grip: 1}}}}]))}};
const args = () => ({wec: structuredClone(wec), tracks: {test: track}, production: structuredClone(production),
  mappings: {series: 'wec', rows: [mapping]}, inputs: {production: 'fixed'}});
const sim = () => ({lapTime: 100, time: Array.from({length: 100}, (_, i) => i)});

test('input fingerprints support an absolute cache path outside the source root', () => {
  const root = mkdtempSync(join(tmpdir(), 'wec-eligibility-')), cache = join(root, 'cache');
  const source = join(root, 'source');
  for (const f of [join(cache, 'wec.json'), ...['worker/lapsim/tracks-data.js', 'worker/lapsim/calibration-data.js',
    'worker/lapsim/transfer-grip-data.js', 'scripts/sim/data/t71-wec-extra.json', 'scripts/sim/data/wec-timing-positions.json'].map(f => join(source, f))]) {
    mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, 'fixture');
  }
  assert.ok(Object.values(eligibilityInputs(source, cache)).every(h => h === sha256('fixture')));
});

test('3 pp boundary is inclusive; excess and non-finite shares fail', () => {
  assert.equal(shareCheck([23, 37, 40], 100, [20, 40, 40], 100).pass, true);
  assert.equal(shareCheck([23.00001, 36.99999, 40], 100, [20, 40, 40], 100).pass, false);
  assert.equal(shareCheck([NaN, 40, 40], 100, [20, 40, 40], 100).pass, false);
});
test('production simulation runs once per class-track-year and candidates reuse the same decisions', () => {
  let calls = 0;
  const table = buildEligibility({...args(), simulate: (t, c) => { calls++; assert.ok(c.reference); return sim(); }});
  assert.equal(calls, 2); assert.equal(table.coverage[0].sectorTerms, 1);
  const lap = {track, lapSeconds: 100, trapKph: null};
  for (const weight of [1, 2, 4]) {
    const out = applyWecTiming(lap, measured, mapping, {sectors: true, sectorWeight: weight, eligibility: rowEligibility(table, wec[0], 0)});
    assert.equal(out.timing.sectorUsed, true);
  }
  assert.equal(calls, 2); assert.deepEqual(track.sectors, [300, 700]);
});
test('one failed production class or missing reference excludes every class on the track-year', () => {
  for (const missing of [false, true]) {
    const a = args(); if (missing) delete a.production.series.wec.lmdh[2025];
    const table = buildEligibility({...a, simulate: (t, c) => c.reference === 'lmdh' ? {...sim(), lapTime: 90} : sim()});
    assert.ok(table.excluded['test/2025']);
    assert.ok(Object.values(table.rows).every(r => !r.eligible));
  }
});
test('bad lower-ranked sector sum excludes that row; wet sessions are excluded before simulation', () => {
  const a = args(); a.wec[0].laps.push({...measured, car: 'two', sectors: [20, 40, 41]}); a.wec[1].weather = {rain: true};
  let calls = 0; const table = buildEligibility({...a, simulate: () => { calls++; return sim(); }});
  assert.equal(calls, 1); assert.equal(table.coverage[0].laps, 2); assert.equal(table.coverage[0].sectorTerms, 1);
  assert.equal(rowEligibility(table, a.wec[0], 1).eligible, false);
});
test('changed inputs or missing rows fail before fitting; no fixed decision fails closed', () => {
  const table = buildEligibility({...args(), simulate: sim});
  assert.equal(verifyEligibility(table, {production: 'fixed'}), table);
  assert.throws(() => verifyEligibility(table, {production: 'candidate'}), /input mismatch/);
  assert.throws(() => rowEligibility(table, {...wec[0], year: 2026}, 0), /Missing/);
  const lap = {track, lapSeconds: 100};
  assert.equal(applyWecTiming(lap, measured, mapping, {sectors: true}).timing.sectorUsed, false);
  assert.equal(applyWecTiming(lap, measured, mapping), lap);
});
