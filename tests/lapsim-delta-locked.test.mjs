// Step 27: the 2022 LOCKED Δ set is refused unless the pin names the approved step-28 final run; the frozen case CSVs match their pins
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, copyFileSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const pin = JSON.parse(readFileSync('.github/lapsim-snapshot.json', 'utf8')).delta;
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');

test('frozen Δ case CSVs match their pinned sha256', () => {
  for (const k of ['v1', 'v2pooled', 'locked2022']) assert.equal(sha(pin[k].path), pin[k].sha256, k);
});

test('the 2022 LOCKED set is not scored, even renamed and with a flag, while no run is approved', () => {
  assert.equal(pin.locked2022.approved_run, '');
  const dir = mkdtempSync(join(tmpdir(), 'dl-'));
  copyFileSync('scripts/sim/data/f1-delta/zone-mapping-table.csv', join(dir, 'zones.csv'));
  copyFileSync(pin.locked2022.path, join(dir, 'f1-delta-cases-2026-11-24.csv'));
  for (const env of [{}, {F1_DELTA_LOCKED_APPROVED: ''}, {F1_DELTA_LOCKED_APPROVED: 'some-run'}]) {
    const r = spawnSync(process.execPath, ['scripts/sim/f1-delta-bench.mjs', 'model', dir], {encoding: 'utf8', env: {...process.env, ...env}});
    assert.equal(r.status, 1, JSON.stringify(env));
    assert.match(r.stderr, /LOCKED set is not scored/);
  }
});
