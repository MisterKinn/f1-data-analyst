import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPEED_SOURCES, sampleSdKph, raceDataEvidence} from '../scripts/sim/race-data-evidence.mjs';
import {SERIES} from '../worker/lapsim/series.js';

test('source audit: sample SD uses n−1, not population variance (synthetic fixture)', () => {
  assert.equal(sampleSdKph([1, 2, 3]), 1);
  assert.equal(sampleSdKph([3, 3, 3]), 0);
  assert.equal(sampleSdKph([]), null);
  assert.equal(sampleSdKph([100]), null);
});

test('source audit: malformed/missing speeds cannot silently become zero or be dropped', () => {
  for (const values of [null, '100', [0, 100], [-1, 100], ['100', 101], [NaN], [Infinity], new Array(2)]) {
    assert.throws(() => sampleSdKph(values), TypeError);
  }
});

test('source audit: complete, immutable published entrant sets have unique car ids', () => {
  assert.deepEqual(SPEED_SOURCES.map(s => s.observations.length), [20, 10]);
  for (const source of SPEED_SOURCES) {
    assert.ok(source.url.startsWith('https://'));
    assert.equal(new Set(source.observations.map(([car]) => car)).size, source.observations.length);
    assert.ok(Object.isFrozen(source.observations));
    assert.ok(Object.isFrozen(source.observations[0]));
    const speeds = source.observations.map(([, speed]) => speed);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const independent = Math.sqrt(speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / (speeds.length - 1));
    assert.ok(Math.abs(sampleSdKph(speeds) - independent) < 1e-10);
  }
});

test('source audit: cross-sectional maxima never claim unmeasured repeatability or apex SD', () => {
  for (const result of raceDataEvidence()) {
    assert.ok(result.straightProxySdKph > 0);
    assert.equal(result.apexSdKph, null);
    assert.equal(result.withinDriverLapSdKph, null);
    assert.match(result.limitation, /not pure driver noise/);
    assert.equal(result.straightSdKph, undefined);
  }
});

test('source audit never mutates the runtime series or imports model inputs', () => {
  const before = structuredClone(SERIES);
  raceDataEvidence();
  assert.deepEqual(SERIES, before);
  const code = readFileSync(new URL('../scripts/sim/race-data-evidence.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /worker\/lapsim|calibration-data|writeFile/);
});
