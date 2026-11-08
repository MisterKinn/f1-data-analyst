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
