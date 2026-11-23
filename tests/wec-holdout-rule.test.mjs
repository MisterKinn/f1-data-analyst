// WEC held-out rule (central decision 2026-11-23; AGENTS.md Gate G "WEC held-out"): converged fold fits, a second-start noise
// check and fold-car bound hits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nelderMead, fitSeason, holdout} from '../scripts/sim/calibrate-lib.mjs';
import {wecNoiseCheck, boundHitCount} from '../scripts/sim/gate.mjs';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {SERIES} from '../worker/lapsim/series.js';

test('stop rule: Nelder–Mead stops when the relative simplex spread is < 1e-6, well before 400 iterations, at the optimum', () => {
  const f = x => 3 + (x[0] - 1) ** 2 + 4 * (x[1] + 0.5) ** 2 + (x[2] - 0.2) ** 2;
  const r = nelderMead(f, [0, 0, 0], {step: 0.08, iters: 400, relTol: 1e-6});
  assert.ok(r.it < 400, `iterations ${r.it}`);
  assert.ok(Math.abs(r.value - 3) / 3 < 1e-5, `value ${r.value}`);
  const r2 = nelderMead(f, [0, 0, 0], {step: 0.05, iters: 400, relTol: 1e-6}); // second start lands on the same optimum
  assert.ok(Math.abs(r2.value - r.value) / 3 < 1e-5);
  // without relTol the old absolute stop and iteration count are unchanged
  const legacy = nelderMead(f, [0, 0, 0], {step: 0.08, iters: 25});
  assert.equal(legacy.it, 25);
});

test('same setting for base and candidate: every WEC held-out call in calibrate.mjs uses the one rule constant', () => {
  const src = readFileSync(new URL('../scripts/sim/calibrate.mjs', import.meta.url), 'utf8');
  assert.equal((src.match(/holdout\([^)]*\{iters: HOLDOUT_ITERS, folds: 99/g) || []).length, 0, 'no WEC held-out with its own iteration count');
  assert.ok((src.match(/\{\.\.\.WEC_HO, (step0: WEC_START2, )?folds: 99/g) || []).length >= 5);
  assert.match(src, /WEC_HO = WEC_RULE === 'legacy' \? \{iters: HOLDOUT_ITERS\} : \{iters: 400, nm: \{relTol: 1e-6\}, \.\.\.\(WEC_RULE === 'v1' \? \{\} : \{starts: WEC_STARTS\}\)\}/);
  assert.match(src, /WEC_STARTS = \[0\.08, 0\.05, 0\.12\]/);
  assert.match(src, /WEC_RULE = process\.env\.LAPSIM_WEC_HOLDOUT \|\| 'v2'/);
});

test('fold fits report the iterations used and the parameters on a bound', () => {
  const K = lapsimKernel(), def = SERIES.wec.classes.lmdh, base = {...structuredClone(def.prior), linkMu: true};
  const laps = ['monza', 'spa-francorchamps'].map(id => ({name: id, track: K.trackFromData(lapsimTracks[id]), lapSeconds: id === 'monza' ? 96 : 125, weight: 1, grip: 1, weather: {}}));
  const params = [{key: 'muY', path: 'muY', base: base.muY, step: 0.08, min: 1.3, max: 2.2}, {key: 'clA', path: 'clA', base: base.clA, step: 0.08, min: 2.5, max: 2.5}];
  const fit = fitSeason(laps, base, params, {iters: 400, nm: {relTol: 1e-6}});
  assert.ok(fit.iters > 0 && fit.iters <= 400);
  assert.ok(fit.bounds.some(b => b.key === 'clA' && b.value === 2.5), JSON.stringify(fit.bounds));
});

test('noise check: judgeable only when the WEC-group spread between the two starts is below δ/3; bound hits are counted', () => {
  const s = (e1, e2, hits = []) => ({tracks: {a: {realLap: 100}, b: {realLap: 100}}, holdout: {tracks: [{track: 'a', errorSec: e1[0]}, {track: 'b', errorSec: e1[1]}],
    boundHits: hits, noise: {tracks: [{track: 'a', errorSec: e2[0]}, {track: 'b', errorSec: e2[1]}]}}});
  const quiet = wecNoiseCheck({lmh: {2025: s([1, -1], [1.001, -1])}});
  assert.equal(quiet.judgeable, true, quiet.reason);
  const noisy = wecNoiseCheck({lmh: {2025: s([1, -1], [1.5, -0.2])}});
  assert.equal(noisy.judgeable, false, noisy.reason);
  const old = wecNoiseCheck({lmh: {2025: {tracks: {a: {realLap: 100}}, holdout: {tracks: [{track: 'a', errorSec: 1}]}}}});
  assert.equal(old.judgeable, false); assert.match(old.reason, /before the WEC held-out rule/);
  assert.equal(boundHitCount({lmdh: {2025: s([1, 1], [1, 1], [{key: 'clA', bound: 'max', folds: ['imola', 'lusail']}])}}), 2);
});

test('rule v2: each fold keeps the lowest-objective start of three; noise = best of the first two', () => {
  const K = lapsimKernel(), def = SERIES.wec.classes.lmdh, base = {...structuredClone(def.prior), linkMu: true};
  const ids = ['monza', 'spa-francorchamps', 'imola'];
  const laps = ids.map((id, i) => ({name: id, track: K.trackFromData(lapsimTracks[id]), lapSeconds: [96, 125, 92][i], weight: 1, grip: 1, weather: {}}));
  const params = [{key: 'muY', path: 'muY', base: base.muY, step: 0.08, min: 1.3, max: 2.2}];
  const h = holdout(laps, base, params, {iters: 30, nm: {relTol: 1e-6}, starts: [0.08, 0.05, 0.12], folds: 99, gripFor: l => l.grip});
  assert.equal(h.fits.length, 3);
  for (const f of h.fits) { assert.equal(f.scores.length, 3); assert.equal(Math.min(...f.scores), f.scores[[0.08, 0.05, 0.12].indexOf(f.step)]); }
  assert.deepEqual(h.noise.starts, [0.08, 0.05]);
  for (const f of h.noise.fits) assert.equal(Math.min(...f.scores.slice(0, 2)), f.scores[[0.08, 0.05].indexOf(f.step)]);
  assert.equal(h.noise.errors.length, h.errors.length);
  // no starts = one fit per fold, no noise field (v1 and F1-style callers unchanged)
  const h1 = holdout(laps, base, params, {iters: 30, folds: 99, gripFor: l => l.grip});
  assert.equal(h1.noise, undefined); assert.equal(h1.fits[0].scores, undefined);
});
