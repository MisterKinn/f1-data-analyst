import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimTracks, lapsimExtraTracks} from '../worker/lapsim/tracks-data.js';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimCalibration} from '../worker/lapsim/calibration-data.js';

const spec = JSON.parse(readFileSync('scripts/sim/data/track-extra.json', 'utf8')), extra = Object.values(lapsimExtraTracks);

test('extra tracks do not replace or shadow a production track', () => {
  assert.deepEqual(Object.keys(lapsimExtraTracks).sort(), Object.keys(spec.tracks).sort());
  for (const id of Object.keys(lapsimExtraTracks)) assert.equal(lapsimTracks[id], undefined, id);
});

test('every extra track has a source line, an evidence layer per value and a check result', () => {
  for (const e of extra) {
    assert.ok(e.sources.length >= 1 && e.sources.every(s => typeof s === 'string' && s.length > 5), e.id);
    assert.deepEqual(Object.keys(e.quality.evidence), ['lapLength', 'planShape', 'drivenLine', 'width', 'height', 'trackGrip'], e.id);
    const c = e.quality.check; assert.ok(['pass', 'warn'].includes(c.status), e.id);
    assert.equal(e.fit, c.status === 'pass', e.id);
    if (e.fit) assert.ok(c.n >= 1 && c.rmsPct <= spec.passRmsPct, e.id); else assert.match(e.warn, /^⚠️ \S/, e.id);
  }
});

test('extra track geometry is a closed lap close to the official length', () => {
  for (const e of extra) {
    assert.ok(e.kappa.every(Number.isInteger) && (!e.grade || e.grade.length === e.kappa.length), e.id);
    const turn = e.kappa.reduce((a, k) => a + k / 1e5 * e.ds, 0) * 180 / Math.PI;
    assert.ok([0, 360].some(t => Math.abs(Math.abs(turn) - t) < 15), `${e.id}: total turn ${turn.toFixed(1)}°`); // 0° = a lap that crosses over itself (Yongin)
    const r = e.length / e.officialLengthM; assert.ok(r > 0.96 && r <= 1.001, `${e.id}: length ratio ${r.toFixed(3)}`); // the driven line is a little shorter than the centre line
  }
});

test('an extra track runs in the lap kernel', () => {
  const K = lapsimKernel(), car = lapsimCalibration.series.wec.lmgt3['2026'].car;
  const lap = K.simulateLap(K.trackFromData(extra[0]), car, K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0})).lapTime;
  assert.ok(lap > 40 && lap < 700, String(lap));
});
