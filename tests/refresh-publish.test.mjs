import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {stripDates} from '../scripts/refresh-changed.mjs';

test('a refresh that only stamps a new build date is not a change', () => {
  assert.equal(stripDates('{"generatedAt":"2026-11-21","a":1}'), stripDates('{"generatedAt":"2026-11-22","a":1}'));
  assert.notEqual(stripDates('{"generated":"2026-11-21","a":1}'), stripDates('{"generated":"2026-11-21","a":2}'));
});

test('publish script parses, and every scheduled job runs on the production repo only', () => {
  execFileSync('bash', ['-n', 'scripts/publish-refresh.sh']);
  for (const f of readdirSync('.github/workflows').filter(f => f !== 'sync-fork.yml')) {
    const y = readFileSync('.github/workflows/' + f, 'utf8');
    if (/^\s*schedule:/m.test(y)) assert.match(y, /github\.repository == 'MisterKinn\/f1-data-analyst'/, f);
    if (y.includes('publish-refresh.sh')) assert.match(y, /actions: write/, f + ' needs actions: write to start the stored-views rebuild');
  }
});

test('session dispatcher starts the F1 refresh about 1, 3 and 6 h after qualifying, once per window', async () => {
  const {plan} = await import('../scripts/session-refresh.mjs');
  const events = [{id: 'f1-x', series: 'f1'}, {id: 'nls-x', series: 'nls', raceStart: '2026-01-01T10:00:00Z'}];
  const schedule = {'f1-x': [{nameEn: 'FP1', start: '2026-01-01T10:00:00Z'}, {nameEn: 'Qualifying', start: '2026-01-01T10:00:00Z'}]};
  const at = min => plan(new Date(Date.parse('2026-01-01T11:00:00Z') + min * 60e3), events, schedule);
  assert.deepEqual(at(60).run, ['f1-zones-refresh.yml']);  // qualifying ended 1 h ago
  assert.deepEqual(at(30).run, []);
  assert.deepEqual(at(180).run, ['f1-zones-refresh.yml']);
  assert.deepEqual(at(360).run, ['f1-zones-refresh.yml']);
  assert.deepEqual(at(400).run, []);
  assert.deepEqual(plan(new Date('2026-01-01T17:00:00Z'), events, schedule).unwired, ['nls']);  // 6 h race ended 1 h ago, no source
});
