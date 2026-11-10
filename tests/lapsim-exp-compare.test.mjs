import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {compare} from '../scripts/sim/exp-compare.mjs';
import {physicalDiagnostics, comparePhysical, boundHits, F1_BOUNDS} from '../scripts/sim/exp-physics.mjs';

const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-6, `${a} != ${b}`);
const r3 = x => x == null ? null : +x.toFixed(3);
function fixture() {
  const tracks = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map(track => [track, {realLap: 100, errorSec: 2}]));
  const cal = {seasons: {2025: {car: {muY: 1.5, clA: 8, cdA: 1, cdALow: 1, pIce: 644000}, tracks,
    holdout: {rmsPct: 2, tracks: Object.keys(tracks).map(track => ({track, errorSec: 2}))}}},
    series: {wec: {lmh: {2025: {car: {muY: 1.75, clA: 7, cdA: 0.7}, tracks: {
      spa: {realLap: 120, errorSec: 2, trapKph: 280, simTopKph: 290},
      imola: {realLap: 100, errorSec: 2, trapKph: 270, simTopKph: 260}},
      holdout: {rmsPct: 2, tracks: [{track: 'spa', errorSec: 2}, {track: 'imola', errorSec: 2}]}}}}}};
  const rows = Object.keys(tracks).map((track, i) => ({series: 'f1', year: 2025, track,
    cornerKph: {n: [1, 3, 0, 0, 0][i], bias: [-4, 2, null, null, null][i], rms: [4, 2, null, null, null][i]},
    trapKph: [3, -4, 0, null, null][i]}));
  const validation = {rows, summary: {
    'f1/2025': {tracks: 5, cornerBiasKph: -1, trapBiasKph: r3(-1 / 3), trapRmsKph: r3(5 / Math.sqrt(3))},
    'wec-lmh/2025': {tracks: 2, trapBiasKph: 0, trapRmsKph: 10}}};
  return {cal, validation};
}
function freeze(o) { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(freeze); } return o; }

test('physical diagnostics use signed, equal-track corner bias and trap RMS without mutating inputs', () => {
  const {cal, validation} = fixture(), before = JSON.stringify({cal, validation});
  const p = physicalDiagnostics(freeze(cal), freeze(validation))['f1/2025'];
  assert.equal(p.corner.biasKph, -1); // not the corner-count-weighted +0.5
  assert.equal(p.corner.nTracks, 2); assert.equal(p.corner.nCorners, 4);
  close(p.corner.rmsKph, Math.sqrt(10));
  close(p.trap.biasKph, -1 / 3); close(p.trap.rmsKph, 5 / Math.sqrt(3));
  assert.equal(p.trap.nTracks, 3); // zero is valid, null is not zero
  assert.equal(p.heldOutRmsPct, 2); assert.equal(p.heldOutN, 5);
  assert.match(p.evidence, /in-sample, not held-out/);
  assert.equal(JSON.stringify({cal, validation}), before);
});

test('WEC reports traps from calibrated tracks, missing corners and the position caveat', () => {
  const {cal, validation} = fixture(), p = physicalDiagnostics(cal, validation)['wec-lmh/2025'];
  assert.equal(p.trap.rmsKph, 10); assert.equal(p.trap.biasKph, 0);
  assert.equal(p.corner.biasKph, null); assert.equal(p.corner.nTracks, 0);
  assert.match(p.trapDefinition, /NOT a trap-position comparison/);
  assert.deepEqual(p.bounds.hits.map(h => [h.parameter, h.side, h.limit]), [['clA', 'upper', 7], ['cdA', 'lower', 0.7]]);
});

test('all F1 fit parameters use source bounds, including season-relative power', () => {
  const {cal} = fixture(), b = boundHits('f1/2025', cal.seasons[2025].car);
  assert.equal(b.checked, 5);
  assert.deepEqual(b.hits.map(h => [h.parameter, h.side]), [['muY', 'lower'], ['clA', 'upper'], ['pIce', 'upper']]);
  close(b.hits.find(h => h.parameter === 'pIce').limit, 644000);
  assert.equal(boundHits('f1/2026', {pIce: 340000}).hits[0].side, 'lower');
  assert.equal(boundHits('wec-lmgt3/2026', {clA: 3.5}).hits[0].limit, 3.5);
});

test('bound detection separates interior, near-bound, outside and unavailable values', () => {
  assert.equal(boundHits('f1/2025', {clA: 7.99}).hits.length, 0);
  assert.equal(boundHits('f1/2025', {clA: 8 - 1e-7}).hits[0].outside, false);
  assert.equal(boundHits('f1/2025', {clA: 8.01}).hits[0].outside, true);
  assert.equal(boundHits('f1/2025', {clA: 2}).hits[0].side, 'lower');
  assert.ok(boundHits('f1/2099', {pIce: 644000}).unchecked.includes('pIce'));
  assert.equal(boundHits('wec-unknown/2025', {}).checked, 0);
});

test('report-only F1 limits stay identical to calibrate.mjs without importing the fitter', () => {
  const source = readFileSync(new URL('../scripts/sim/calibrate.mjs', import.meta.url), 'utf8');
  const literal = source.match(/const BOUNDS = (\{[^;]+\});/)[1];
  assert.deepEqual(F1_BOUNDS, JSON.parse(JSON.stringify(vm.runInNewContext('(' + literal + ')'))));
});

test('missing validation is explicit and missing data never becomes zero or a pass', () => {
  const {cal} = fixture(), report = physicalDiagnostics(cal, {summary: {}, rows: []});
  const p = report['f1/2025'];
  assert.equal(p.status, 'missing validation');
  assert.equal(p.corner.biasKph, null); assert.equal(p.trap.rmsKph, null);
  assert.match(p.uncheckedTrackBounds, /not stored/);
  const compared = comparePhysical(report, report)['f1/2025'];
  assert.equal(compared.corner.n, 0); assert.equal(compared.corner.absBiasChangeKph, null);
  assert.equal(compared.trap.rmsChangeKph, null);
});

test('malformed, duplicate, mismatched and unknown validation inputs fail clearly', () => {
  const {cal, validation} = fixture();
  assert.throws(() => physicalDiagnostics(cal, {}), /summary and rows/);
  assert.throws(() => physicalDiagnostics(cal, {...validation, rows: [...validation.rows, validation.rows[0]]}), /Duplicate/);
  assert.throws(() => physicalDiagnostics(cal, {...validation, rows: [{series: 'f1', year: 2025, track: 'unknown'}]}), /absent/);
  const wrong = structuredClone(validation); wrong.summary['wec-lmh/2025'].trapRmsKph = 20;
  assert.throws(() => physicalDiagnostics(cal, wrong), /summary mismatch/);
  const count = structuredClone(validation); count.summary['f1/2025'].tracks = 4;
  assert.throws(() => physicalDiagnostics(cal, count), /count mismatch/);
});

test('paired physical comparison excludes unmatched or missing measurements per metric', () => {
  const {cal, validation} = fixture(), a = physicalDiagnostics(cal, validation), b = structuredClone(a);
  b['f1/2025'].rows = [
    {track: 'a', cornerN: 1, cornerBiasKph: -2, trapKph: 0},
    {track: 'b', cornerN: 3, cornerBiasKph: null, trapKph: -3},
    {track: 'extra', cornerN: 1, cornerBiasKph: 1000, trapKph: 1000}];
  const p = comparePhysical(a, b)['f1/2025'];
  assert.deepEqual(p.corner.tracks, ['a']); assert.equal(p.corner.absBiasChangeKph, -2);
  assert.deepEqual(p.trap.tracks, ['a', 'b']);
  close(p.trap.baseRmsKph, Math.sqrt(12.5)); close(p.trap.candRmsKph, Math.sqrt(4.5));
});

test('new bound hits are per parameter and side; absent baseline does not mean no old hits', () => {
  const {cal, validation} = fixture(), a = physicalDiagnostics(cal, validation);
  const cand = structuredClone(cal); cand.seasons[2025].car.cdA = 1.9;
  const b = physicalDiagnostics(cand, validation);
  assert.deepEqual(comparePhysical(a, b)['f1/2025'].newBoundHits.map(h => h.parameter), ['cdA']);
  assert.equal(comparePhysical({}, b)['f1/2025'].newBoundHits, null);
});

const cli = fileURLToPath(new URL('../scripts/sim/exp-compare.mjs', import.meta.url));
function withFiles(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'lapsim-compare-'));
  try {
    const {cal, validation} = fixture(), candidate = structuredClone(cal);
    for (const r of candidate.seasons[2025].holdout.tracks) r.errorSec = 1;
    const paths = ['base.mjs', 'base.json', 'candidate.mjs', 'candidate.json'].map(f => join(dir, f));
    writeFileSync(paths[0], 'export const lapsimCalibration=' + JSON.stringify(cal));
    writeFileSync(paths[2], 'export const lapsimCalibration=' + JSON.stringify(candidate));
    writeFileSync(paths[1], JSON.stringify(validation)); writeFileSync(paths[3], JSON.stringify(validation));
    return fn(paths, cal, candidate);
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

test('default CLI output remains byte-identical to the original report format', () => withFiles(([base, , cand], a, b) => {
  const output = execFileSync(process.execPath, [cli, base, cand], {encoding: 'utf8'});
  const expected = '== ' + cand + '\n' + Object.entries(compare(a, b))
    .map(([g, r]) => g.padEnd(16) + ' ' + JSON.stringify(r) + '\n').join('');
  assert.equal(output, expected);
  assert.deepEqual(compare(a, b)['f1/2025'], {n: 5, base: 2, cand: 1, reason: 'accepted: held-out error lower beyond noise'});
}));

test('physics CLI emits parseable per-variant JSON, SHA-256 inputs and unchanged lap gate', () => withFiles((paths, a, b) => {
  const output = JSON.parse(execFileSync(process.execPath, [cli, '--physics', ...paths], {encoding: 'utf8'}));
  assert.equal(output.schemaVersion, 1); assert.equal(output.variants.length, 2);
  assert.equal(output.baseline, paths[0]);
  assert.match(output.variants[0].sha256.calibration, /^[a-f0-9]{64}$/);
  assert.match(output.variants[0].sha256.validation, /^[a-f0-9]{64}$/);
  assert.deepEqual(output.comparisons[0].heldOut, compare(a, b));
  assert.equal(output.variants[0].physical['f1/2025'].corner.biasKph, -1);
  assert.equal(output.comparisons[0].physical['f1/2025'].trap.rmsChangeKph, 0);
  // A second candidate must not replace the declared baseline.
  const multi = JSON.parse(execFileSync(process.execPath, [cli, '--physics', ...paths, ...paths.slice(2)], {encoding: 'utf8'}));
  assert.equal(multi.variants.length, 3); assert.equal(multi.comparisons.length, 2);
}));

test('physics CLI rejects incomplete pairs, missing files and invalid JSON without a partial report', () => withFiles(paths => {
  for (const args of [['--physics', paths[0]], ['--physics', ...paths.slice(0, 3), join(tmpdir(), 'missing-validation-lapsim.json')]]) {
    const r = spawnSync(process.execPath, [cli, ...args], {encoding: 'utf8'});
    assert.notEqual(r.status, 0); assert.equal(r.stdout, '');
  }
  writeFileSync(paths[3], '{invalid');
  const r = spawnSync(process.execPath, [cli, '--physics', ...paths], {encoding: 'utf8'});
  assert.notEqual(r.status, 0); assert.equal(r.stdout, '');
}));
