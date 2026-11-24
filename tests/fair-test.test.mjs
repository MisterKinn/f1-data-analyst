import test from 'node:test';
import assert from 'node:assert/strict';
import {eventErrors, score, rng} from '../scripts/sim/learn/fair-test.mjs';

test('fair test: class-best per event, RMS and paired bootstrap ratio', () => {
  // invented: two events, two cars each; refit error twice the shipped error on every event
  const rows = [{eventKey: 'e1', group: 'lmh', real: 100}, {eventKey: 'e1', group: 'lmh', real: 101}, {eventKey: 'e2', group: 'lmh', real: 90}, {eventKey: 'e2', group: 'lmh', real: 92}];
  const ev = eventErrors(rows, [101, 103, 90.9, 95], [102, 105, 91.8, 99]);
  assert.deepEqual(ev.map(e => [e.event, e.real, e.a, e.b]), [['e1', 100, 101, 102], ['e2', 90, 90.9, 91.8]]);
  const s = score(ev, 1, 200);
  assert.equal(s.shipped, 1); assert.equal(s.refit, 2); assert.equal(s.ratio, 2); assert.deepEqual(s.ratioPI90, [2, 2]);
  const a = rng(7), b = rng(7); assert.equal(a(), b());
});
