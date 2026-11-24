// Step 27 guards of scripts/sim/track-state.mjs: no build without the TI cache, no TI fetch without a pinned commit
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const OUT = ['worker/lapsim/track-state-data.js', 'scripts/sim/data/track-covariates.json', 'docs/lapsim-track-state.md'];
const hashes = () => OUT.map(f => createHash('sha256').update(readFileSync(f)).digest('hex'));
const run = (args, env) => spawnSync(process.execPath, ['scripts/sim/track-state.mjs', ...args], {encoding: 'utf8', env: {...process.env, ...env}});

for (const [name, corners] of [['missing', null], ['empty', '{}'], ['tracks without years', '{"monza":{}}']]) {
  test(`track-state build refuses when corners.json is ${name}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ts-')); if (corners != null) writeFileSync(join(dir, 'corners.json'), corners);
    const before = hashes(), r = run(['build'], {TRACK_STATE_CACHE: dir});
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /corners\.json is missing or empty/);
    assert.deepEqual(hashes(), before);
  });
}

test('track-state ti refuses a season without a pinned TracingInsights commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts-')), refs = join(dir, 'refs.json');
  writeFileSync(refs, JSON.stringify({2024: 'main'}));
  const r = run(['ti', '2024'], {TRACK_STATE_CACHE: dir, TRACK_STATE_TI_REFS: refs});
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no pinned TracingInsights commit for 2024/);
});

test('track-state diff lists every changed effects field', async () => {
  const {effectsDiff} = await import('../scripts/sim/track-state-diff.mjs');
  const {lapsimTrackState: S} = await import('../worker/lapsim/track-state-data.js');
  assert.deepEqual(effectsDiff(S.effects, structuredClone(S.effects)), []);
  const b = structuredClone(S.effects); b.resurfacing.n += 1;
  assert.deepEqual(effectsDiff(S.effects, b), [{type: 'resurfacing', field: 'n', shipped: S.effects.resurfacing.n, new: S.effects.resurfacing.n + 1}]);
});
