import test from 'node:test';
import assert from 'node:assert/strict';
import {gate, gateByGroup} from '../scripts/sim/gate.mjs';

const cur = [1.0, 0.8, 1.2, 0.9, 1.1, 1.0, 0.7, 1.3];

test('gate accepts a clearly better model', () => {
  const g = gate(cur, cur.map(x => x * 0.5));
  assert.equal(g.accept, true); assert.ok(g.rmsNew < g.rmsCur);
});

test('gate rejects a worse model', () => {
  const g = gate(cur, cur.map(x => x * 1.3));
  assert.equal(g.accept, false); assert.match(g.reason, /worse/);
});

test('gate rejects a gain inside the noise', () => {
  const g = gate(cur, cur.map((x, i) => i % 2 ? x * 0.7 : x * 1.25));
  assert.equal(g.accept, false);
});

test('gate rejects too few rows', () => {
  assert.equal(gate([1, 1], [0.1, 0.1]).accept, false);
});

test('gateByGroup keeps the new model only where it helps', () => {
  const rows = cur.map((_, i) => ({s: i < 4 ? 'wec' : 'imsa'}));
  const nw = cur.map((x, i) => i < 4 ? x * 0.4 : x * 1.4);
  const g = gateByGroup(rows, r => r.s, cur, nw, {minRows: 3});
  assert.equal(g.wec.accept, true); assert.equal(g.imsa.accept, false);
});

test('nonInferior: small loss inside the margin passes, a larger or noisy-beyond loss fails', async () => {
  const {nonInferior} = await import('../scripts/sim/gate.mjs');
  const cur = [1.0, 1.2, 0.8, 1.1, 0.9, 1.0];
  assert.equal(nonInferior(cur, cur.map(x => x + 0.01)).accept, true);
  assert.equal(nonInferior(cur, cur.map(x => x + 0.2)).accept, false);
  assert.match(nonInferior(cur.slice(0, 3), cur.slice(0, 3)).reason, /not enough data/);
});

test('exp-compare v2: k by variants, f1 scope, class-season block', async () => {
  const {decideV2} = await import('../scripts/sim/exp-compare.mjs');
  const season = errs => ({tracks: Object.fromEntries(errs.map((_, i) => ['t' + i, {realLap: 100}])), holdout: {tracks: errs.map((e, i) => ({track: 't' + i, errorSec: e}))}});
  const cal = (f1, wec) => ({seasons: {2026: season(f1)}, series: {wec: {lmh: {2026: season(wec)}}}});
  const f1 = [1, -1.2, 0.8, -1.1, 0.9, 1, -0.7, 1.3], wec = [1, 1.1, -0.9, 1.2, -1];
  const better = cal(f1.map(x => x * 0.5), wec), worseWec = cal(f1.map(x => x * 0.5), wec.map(x => x * 2));
  assert.equal(decideV2(cal(f1, wec), better, {type: 'accuracy', m: 1, scope: 'f1'}).pass, true);
  assert.equal(decideV2(cal(f1, wec), better, {type: 'accuracy', m: 1}).pass, false); // scope all: WEC did not improve
  const r = decideV2(cal(f1, wec), worseWec, {type: 'accuracy', m: 1, scope: 'f1'});
  assert.equal(r.pass, true); assert.deepEqual(r.blockedGroups, []);
  assert.deepEqual(decideV2(cal(f1, wec), worseWec, {type: 'accuracy', m: 1}).blockedGroups, ['wec-lmh/2026']);
  assert.equal(decideV2(cal(f1, wec), better, {m: 5}).k, 1.9);
});
