import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {acceptanceAudit, tCritical95} from '../scripts/sim/acceptance-audit.mjs';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const input = (harms, circuits = harms.map((_, i) => `c${i}`)) => ({
  group: 'synthetic-only', rows: harms.map((harm, i) => ({
    id: `r${i}`, circuit: circuits[i], oldErrorPp: 2, newErrorPp: 2 + harm,
  })),
});

test('one-sided t critical values agree with independently generated SciPy references', () => {
  for (const [df, value] of [[1, 6.313751514675037], [2, 2.9199855803537242],
    [5, 2.015048373333023], [10, 1.812461122811676], [17, 1.7396067260750727],
    [34, 1.6909242551868549], [100, 1.6602343260853392], [1000, 1.6463788172854639]]) {
    near(tCritical95(df), value);
  }
  for (const df of [0, -1, 1.5, Infinity, NaN, 10001]) assert.throws(() => tCritical95(df));
});

test('CR1 intercept-only hand fixture and equal-circuit estimand are distinct', () => {
  const report = acceptanceAudit(input([0, 0, .3], ['a', 'a', 'b']));
  near(report.rowWeightedCr1.meanPp, .1);
  near(report.rowWeightedCr1.sePp, 2 / 15);
  near(report.equalCircuit.meanPp, .15);
  near(report.equalCircuit.sePp, .15);
  near(report.rowWeightedCr1.upper95Pp, .1 + tCritical95(1) * 2 / 15);
  assert.equal(report.rowWeightedCr1.df, 1);
});

test('same row summaries can yield either side of margin after circuit clustering', () => {
  const harms = [.3, .3, .3, .3, .3, .3, -.3, -.3, -.3, -.3, -.3, -.3];
  const balanced = acceptanceAudit(input(harms, ['a', 'b', 'c', 'd', 'e', 'f', 'a', 'b', 'c', 'd', 'e', 'f']));
  const grouped = acceptanceAudit(input(harms, ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd', 'e', 'e', 'f', 'f']));
  assert.deepEqual(balanced.iidRows, grouped.iidRows);
  assert.ok(balanced.rowWeightedCr1.upper95Pp < .1);
  assert.ok(grouped.rowWeightedCr1.upper95Pp > .1);
});

test('one circuit cannot supply cluster uncertainty; one row cannot supply iid uncertainty', () => {
  const one = acceptanceAudit(input([0]));
  assert.equal(one.iidRows, null);
  assert.equal(one.rowWeightedCr1, null);
  assert.equal(one.equalCircuit, null);
  const repeated = acceptanceAudit(input([-.2, .2], ['a', 'a']));
  assert.ok(repeated.iidRows);
  assert.equal(repeated.rowWeightedCr1, null);
});

test('absolute signed errors and exact unrounded individual-row guard', () => {
  const value = input([0, 0]);
  value.rows[0].oldErrorPp = -2;
  value.rows[0].newErrorPp = -3;
  assert.equal(acceptanceAudit(value).rowGuard.withinLimit, true);
  value.rows[0].newErrorPp = -3.0000001;
  assert.equal(acceptanceAudit(value).rowGuard.withinLimit, false);
  value.rows[0].newErrorPp = -1;
  near(acceptanceAudit(value).iidRows.meanPp, -.5);
});

test('row safety guard survives favorable average; report never authorizes release', () => {
  const report = acceptanceAudit(input([1.01, -1.8, -1.8, -1.8, -1.8, -1.8]));
  assert.ok(report.iidRows.meanPp < 0);
  assert.equal(report.rowGuard.withinLimit, false);
  assert.equal(report.mode, 'report-only; not a release authorization');
  assert.equal('pass' in report, false);
});

test('all zero errors remain valid; permutation leaves estimates unchanged', () => {
  const zero = input([0, 0]);
  zero.rows.forEach(row => { row.oldErrorPp = 0; row.newErrorPp = 0; });
  near(acceptanceAudit(zero).rowWeightedCr1.upper95Pp, 0);
  const value = input([-.2, .1, .3, -.1], ['a', 'b', 'a', 'c']);
  const a = acceptanceAudit(value), b = acceptanceAudit({...value, rows: [...value.rows].reverse()});
  for (const key of ['iidRows', 'rowWeightedCr1', 'equalCircuit']) near(a[key].upper95Pp, b[key].upper95Pp);
});

test('incomplete, sparse, duplicate and nonnumeric pairs fail rather than silently dropping rows', () => {
  for (const bad of [null, {}, {group: '', rows: []}, {...input([0]), rows: new Array(2)}]) {
    assert.throws(() => acceptanceAudit(bad));
  }
  for (const [key, values] of [['oldErrorPp', [undefined, null, '0', Infinity, NaN]],
    ['newErrorPp', [undefined, null, '0', -Infinity]], ['id', ['', null]], ['circuit', ['', undefined]]]) {
    for (const value of values) {
      const bad = input([0, 0]); bad.rows[0][key] = value;
      assert.throws(() => acceptanceAudit(bad));
    }
  }
  const duplicate = input([0, 0]); duplicate.rows[1].id = duplicate.rows[0].id;
  assert.throws(() => acceptanceAudit(duplicate));
  const overflow = input([0, 0]); overflow.rows.forEach(row => { row.newErrorPp = 1e308; });
  assert.throws(() => acceptanceAudit(overflow), /overflow/);
});

test('CLI failure is visible and does not echo malformed input', () => {
  const result = spawnSync(process.execPath, ['scripts/sim/acceptance-audit.mjs'], {encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Acceptance audit failed/);
});
