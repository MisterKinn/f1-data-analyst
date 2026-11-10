import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyWecTiming, checkTiming, timingMapping, sectorTimes} from '../scripts/sim/wec-timing.mjs';
import {lapError, sampleAt, fitSeason, holdout} from '../scripts/sim/calibrate-lib.mjs';
import {simulateLap} from '../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../worker/lapsim/atmosphere.js';
import {SERIES} from '../worker/lapsim/series.js';
import {physicalDiagnostics, comparePhysical} from '../scripts/sim/exp-physics.mjs';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const mapping = {track: 'test', year: 2025, layoutLengthM: 1000, s1EndM: 200, s2EndM: 600,
  trapDistanceM: 250, sourceUrl: 'https://official.example/map.pdf', trapSourceUrl: 'https://official.example/map.pdf'};
const track = {ds: 10, kappa: Float64Array.from({length: 100}, (_, i) => i > 20 && i < 40 ? 0.025 : 0), sectors: [300, 700]};
const car = {...SERIES.wec.classes.lmgt3.prior};
const env = conditionsFromWeather({});
const measured = {sectors: [10, 20, 30], topSpeedKph: 150};
const lap = {name: 'test', track, lapSeconds: 60, trapKph: null, grip: 1};

test('both flags off preserve the original object and every output byte', () => {
  assert.equal(applyWecTiming(lap, measured, mapping), lap);
  const old = lapError(track, car, env, null, 60, {trapKph: 200});
  const sim = simulateLap(track, car, env), dt = sim.lapTime - 60, trapError = (sim.vMaxKph - 200) / 3.6;
  const expected = {score: 2 * dt * dt + 0.5 * trapError * trapError, rms: 0, dt, trap: trapError * 3.6, res: sim};
  assert.equal(JSON.stringify(old), JSON.stringify(expected));
});

test('mapping lookup requires exact series, year and track and rejects duplicates', () => {
  const table = {series: 'wec', rows: [mapping]};
  assert.equal(timingMapping(table, 'wec', 'test', 2025), mapping);
  for (const args of [['f1', 'test', 2025], ['wec', 'test', 2026], ['wec', 'other', 2025]])
    assert.equal(timingMapping(table, ...args), null);
  assert.throws(() => timingMapping({...table, rows: [mapping, mapping]}, 'wec', 'test', 2025), /Duplicate/);
});

test('2% length limit is inclusive; excess disables coordinates without changing geometry', () => {
  assert.ok(checkTiming(mapping, {...track, ds: 10.2}, 60, measured.sectors).sectorEnds);
  const c = checkTiming(mapping, {...track, ds: 10.20001}, 60, measured.sectors);
  assert.equal(c.sectorEnds, null); assert.equal(c.trapDistance, null);
  assert.match(c.sectorReason, /2%/);
});

test('sectors must be positive, finite and sum to the same lap within rounding tolerance', () => {
  for (const s of [null, [10, 20], [10, 20, null], [10, 20, NaN], [0, 20, 40], [10, 20, 30.003]])
    assert.equal(checkTiming(mapping, track, 60, s).sectorEnds, null);
  assert.ok(checkTiming(mapping, track, 60, [10, 20, 30.002]).sectorEnds);
});

test('unknown and invalid positions retain the original trap filter result', () => {
  for (const m of [null, {...mapping, trapDistanceM: null}, {...mapping, trapDistanceM: 1000}, {...mapping, trapSourceUrl: null}]) {
    const l = applyWecTiming(lap, measured, m, {trapPosition: true});
    assert.equal(l.trapKph, null); assert.equal(l.trapDistance, undefined);
    assert.equal(l.timing.trapPositionUsed, false);
  }
});

test('verified trap bypasses the 92% filter and uses interpolated point speed', () => {
  const l = applyWecTiming(lap, measured, mapping, {trapPosition: true});
  assert.equal(l.trapKph, 150); assert.equal(l.trapDistance, 250);
  const e = lapError(track, car, env, null, 60, l);
  close(e.simTrapKph, sampleAt(e.res.v, track.ds, 250) * 3.6);
  assert.ok(e.simTrapKph < e.res.vMaxKph);
  close(e.trap, e.simTrapKph - 150);
  close(e.score, 2 * e.dt ** 2 + 0.5 * ((e.simTrapKph - 150) / 3.6) ** 2);
});

test('sector flag copies WEC boundaries without mutating shared F1 points', () => {
  const before = JSON.stringify(track);
  const l = applyWecTiming(lap, measured, mapping, {eligibility: {eligible: true}, sectors: true});
  assert.notEqual(l.track, track); assert.deepEqual(l.track.sectors, [200, 600]);
  assert.equal(JSON.stringify(track), before); assert.equal(l.trapKph, null);
  assert.deepEqual(track.sectors, [300, 700]);
  assert.throws(() => applyWecTiming(lap, measured, mapping, {eligibility: {eligible: true}, sectors: true, sectorWeight: 3}), /weight/);
});

test('sector interpolation conserves the lap and handles fractional and final cells', () => {
  const s = sectorTimes({time: [0, 2, 5, 9], lapTime: 14}, {ds: 10, sectors: [15, 35]});
  assert.deepEqual(s, [3.5, 8, 2.5]); assert.equal(s.reduce((a, b) => a + b), 14);
});

test('approved weights 1, 2, 4 change only the sector squared-error term', () => {
  for (const weight of [1, 2, 4]) {
    const l = applyWecTiming(lap, measured, mapping, {eligibility: {eligible: true}, sectors: true, sectorWeight: weight});
    const e = lapError(l.track, car, env, null, 60, l);
    close(e.score, 2 * e.dt ** 2 + weight * e.simSectors.reduce((s, x, i) => s + (x - measured.sectors[i]) ** 2, 0));
  }
});

test('fitSeason and holdout pass WEC observations into training with fixed lap/trap weights', () => {
  const rows = ['a', 'b', 'c'].map(name => ({...applyWecTiming(lap, measured, mapping, {eligibility: {eligible: true}, sectors: true, trapPosition: true}), name}));
  const fit = fitSeason(rows, car, [], {iters: 1});
  const expected = lapError(rows[0].track, car, env, null, 60, rows[0]);
  close(fit.score, expected.score); assert.equal(fit.perTrack[0].simTrapKph, expected.simTrapKph);
  const h = holdout(rows, car, [], {iters: 1, folds: 99, gripFor: () => 1});
  assert.equal(h.n, 3); h.errors.forEach(e => close(e.dt, expected.dt));
});

test('positioned trap reports do not compare different definitions as matched residuals', () => {
  const cal = {series: {wec: {lmh: {2025: {car, tracks: {test: {realLap: 60, simTopKph: 300, trapKph: 200}}}}}}};
  const v = {rows: [], summary: {'wec-lmh/2025': {tracks: 1, trapBiasKph: 100, trapRmsKph: 100}}};
  const base = physicalDiagnostics(cal, v);
  Object.assign(cal.series.wec.lmh[2025].tracks.test, {simTrapKph: 210, trapDistance: 250, timing: {trapPositionUsed: true, trapSourceUrl: mapping.sourceUrl}});
  v.summary['wec-lmh/2025'].trapBiasKph = v.summary['wec-lmh/2025'].trapRmsKph = 10;
  const cand = physicalDiagnostics(cal, v);
  assert.equal(cand['wec-lmh/2025'].trap.biasKph, 10);
  assert.equal(comparePhysical(base, cand)['wec-lmh/2025'].trap.n, 0);
});

test('checked-in table has unique identities, valid official distances and source hashes', () => {
  const table = JSON.parse(readFileSync(new URL('../scripts/sim/data/wec-timing-positions.json', import.meta.url)));
  const ids = new Set();
  for (const r of table.rows) {
    const id = r.track + '/' + r.year; assert.ok(!ids.has(id)); ids.add(id);
    assert.ok(r.s1EndM > 0 && r.s2EndM > r.s1EndM && r.s2EndM < r.layoutLengthM);
    assert.match(r.sourceUrl, /^https:\/\/files\.alkamelcloud\.com\/wec\/results\//);
    assert.match(r.sourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(r.page, 1);
  }
});
