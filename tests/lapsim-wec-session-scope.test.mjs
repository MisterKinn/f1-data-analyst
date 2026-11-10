import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, cp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {splitWecSessions} from '../scripts/sim/wec-session-scope.mjs';
import {lapsimCalibration} from '../worker/lapsim/calibration-data.js';
import {lapsimWecPoles} from '../worker/lapsim/wec-poles-data.js';

test('manual wet exclusions and rain-marked rows share one scope without changing observations', () => {
  const rows = [
    {year: 2025, track: 'austin', weather: {rain: false}},
    {year: 2025, track: 'austin', weather: null},
    {year: 2026, track: 'imola', weather: {rain: true}},
    {year: 2026, track: 'austin', weather: {rain: false}},
  ];
  const before = structuredClone(rows), scope = splitWecSessions(rows);
  assert.deepEqual(scope.dry, [rows[3]]);
  assert.deepEqual(scope.excluded.map(e => e.reason), ['wet-sessions.json', 'wet-sessions.json', 'rain-marked row']);
  assert.deepEqual(rows, before);
});

test('real fit and historical audit follow both shared exclusion sources, including a changed list', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lapsim-scope-'));
  try {
    for (const folder of ['worker', 'scripts/sim']) await cp(new URL('../' + folder, import.meta.url), join(dir, folder),
      {recursive: true, filter: p => !p.includes('/scripts/sim/results')});
    await mkdir(join(dir, '.cache/lapsim'), {recursive: true});
    await mkdir(join(dir, 'docs'));
    await writeFile(join(dir, 'package.json'), '{"type":"module"}');
    const c = structuredClone(lapsimCalibration);
    c.series.wec = {lmh: {2025: c.series.wec.lmh[2025]}};
    const poles = {}, input = [];
    for (const track of ['lusail', 'imola', 'austin', 'spa-francorchamps']) {
      const p = structuredClone(lapsimWecPoles[track][2025].lmh);
      poles[track] = {2025: {lmh: p}};
      // Deliberately stale pole-table weather: only the real fit input marks rain.
      const weather = {...p.weather, rain: track === 'spa-francorchamps'};
      input.push({year: 2025, track, cls: 'lmh', weather, laps: [{...p, topSpeedKph: 280}]});
    }
    await writeFile(join(dir, 'worker/lapsim/wec-poles-data.js'), `export const lapsimWecPoles=${JSON.stringify(poles)};`);
    await writeFile(join(dir, '.cache/lapsim/wec.json'), JSON.stringify(input));
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('LAPSIM_')));
    for (const addManual of [false, true]) {
      if (addManual) {
        const path = join(dir, 'scripts/sim/data/wet-sessions.json');
        const wet = JSON.parse(await readFile(path, 'utf8'));
        wet.wec['2025 imola'] = {reason: 'test-only manual exclusion'};
        await writeFile(path, JSON.stringify(wet));
      }
      const seed = `export const lapsimCalibration=${JSON.stringify(c)};`;
      await writeFile(join(dir, 'worker/lapsim/calibration-data.js'), seed);
      const log = execFileSync(process.execPath, ['scripts/sim/calibrate.mjs'], {cwd: dir,
        env: {...env, LAPSIM_ONLY: 'wec'}, encoding: 'utf8'});
      // Fewer than three dry tracks: the real calibration path reports its scope without fitting.
      assert.match(log, new RegExp(`WEC lmh 2025: not enough tracks \\(${addManual ? 1 : 2}\\)`));
      await writeFile(join(dir, 'worker/lapsim/calibration-data.js'), seed);
      execFileSync(process.execPath, ['scripts/sim/verify-wec-reproduction.mjs', '.', '.cache/audit.json'], {cwd: dir, env});
      const report = JSON.parse(await readFile(join(dir, '.cache/audit.json'), 'utf8'));
      assert.equal(report.n, addManual ? 1 : 2);
      assert.equal(report.maxAbsErrorSec, 0);
      assert.deepEqual(report.rows[0].errors.map(e => e.track), addManual ? ['lusail'] : ['lusail', 'imola']);
      assert.deepEqual(report.excluded.map(e => e.track).sort(),
        (addManual ? ['austin', 'imola', 'spa-francorchamps'] : ['austin', 'spa-francorchamps']).sort());
    }
    delete poles.lusail;
    await writeFile(join(dir, 'worker/lapsim/wec-poles-data.js'), `export const lapsimWecPoles=${JSON.stringify(poles)};`);
    assert.throws(() => execFileSync(process.execPath, ['scripts/sim/verify-wec-reproduction.mjs', '.', '.cache/missing.json'],
      {cwd: dir, env, stdio: 'pipe'}), /audit and fit session inventories differ/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
