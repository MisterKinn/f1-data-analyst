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
  const events = [{id: 'f1-x', series: 'f1'}, {id: 'wrc-x', series: 'wrc', raceStart: '2026-01-01T10:00:00Z'}];
  const schedule = {'f1-x': [{nameEn: 'FP1', start: '2026-01-01T10:00:00Z'}, {nameEn: 'Qualifying', start: '2026-01-01T10:00:00Z'}]};
  const at = min => plan(new Date(Date.parse('2026-01-01T11:00:00Z') + min * 60e3), events, schedule);
  assert.deepEqual(at(60).run, ['f1-zones-refresh.yml', 'f2f3-laps.yml']);  // qualifying ended 1 h ago
  assert.deepEqual(at(30).run, []);
  assert.deepEqual(at(180).run, ['f1-zones-refresh.yml', 'f2f3-laps.yml']);
  assert.deepEqual(at(360).run, ['f1-zones-refresh.yml', 'f2f3-laps.yml']);
  assert.deepEqual(at(400).run, []);
  assert.deepEqual(plan(new Date('2026-01-01T17:00:00Z'), events, schedule).unwired, ['wrc']);  // ended 7 h after its start, 1 h ago; no source (not for the simulator)
});

test('refresh-changed: a .gz output whose only change is its date is not a change', async () => {
  const {mkdtempSync, writeFileSync} = await import('node:fs'), {join} = await import('node:path'), {tmpdir} = await import('node:os');
  const {gzipSync} = await import('node:zlib'), {execFileSync, spawnSync} = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'rc-')), git = (...a) => execFileSync('git', a, {cwd: dir});
  const put = (fetched, rows) => writeFileSync(join(dir, 'x.json.gz'), gzipSync(JSON.stringify({fetched, rows})));
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  put('2026-11-20', [1, 2]); git('add', '.'); git('commit', '-qm', 'a');
  const changed = () => spawnSync(process.execPath, [new URL('../scripts/refresh-changed.mjs', import.meta.url).pathname, 'x.json.gz'], {cwd: dir}).status;
  put('2026-11-21', [1, 2]); assert.equal(changed(), 1);   // only the date moved
  put('2026-11-21', [1, 2, 3]); assert.equal(changed(), 0);  // a new row
});


test('Gate G: publish-refresh never publishes a model setting; data commits carry the held-out line', async () => {
  const {mkdtempSync, writeFileSync, mkdirSync} = await import('node:fs'), {join} = await import('node:path'), {tmpdir} = await import('node:os');
  const {execFileSync, spawnSync} = await import('node:child_process');
  const root = mkdtempSync(join(tmpdir(), 'pr-')), origin = join(root, 'origin.git'), work = join(root, 'work');
  const git = (cwd, ...a) => execFileSync('git', a, {cwd, encoding: 'utf8'}).trim();
  git(root, 'init', '-q', '--bare', '-b', 'main', origin); git(root, 'clone', '-q', origin, work);
  git(work, 'config', 'user.email', 't@t'); git(work, 'config', 'user.name', 't');
  mkdirSync(join(work, 'worker/lapsim'), {recursive: true}); writeFileSync(join(work, 'worker/lapsim/kernel.js'), 'a'); writeFileSync(join(work, 'data.json'), '1');
  git(work, 'add', '.'); git(work, 'commit', '-qm', 'init'); git(work, 'push', '-q', 'origin', 'HEAD:main');
  const run = (...paths) => spawnSync('bash', [new URL('../scripts/publish-refresh.sh', import.meta.url).pathname, '-m', 'refresh', '-g', 'true', '--', ...paths],
    {cwd: work, env: {...process.env, PUBLISH_CHECKS: 'true', GITHUB_STEP_SUMMARY: '/dev/null', GH_TOKEN: ''}, encoding: 'utf8'});
  const head = () => git(work, 'ls-remote', origin, 'refs/heads/main').split('\t')[0];
  const before = head();
  writeFileSync(join(work, 'worker/lapsim/kernel.js'), 'b');
  const r = run('worker/lapsim/kernel.js');
  assert.equal(r.status, 3); assert.match(r.stdout, /Model change, not published/); assert.equal(head(), before);
  assert.match(git(work, 'ls-remote', origin), /refs\/heads\/lapsim-learn\/refresh-model-/);
  git(work, 'reset', '-q', '--hard', before); writeFileSync(join(work, 'data.json'), '2');
  assert.equal(run('data.json').status, 0); assert.notEqual(head(), before);
  const {line} = await import('../scripts/heldout-line.mjs');
  assert.equal(line({all: {n: 67, base: 1.113, cand: 1.12}, f1: {n: 34, base: 0.865, cand: 0.865}}),
    'Held-out RMS % before → after (same rows, calibration-data.js): all 1.113 → 1.12 (n 67), f1 0.865 → 0.865 (n 34)');
});
