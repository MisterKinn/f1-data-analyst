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
