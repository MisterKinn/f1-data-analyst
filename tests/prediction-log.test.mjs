import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// AGENTS.md Gate G v3.1: predictions are stored before the event and never changed; the real result is added after it
test('prediction log: written before the event, result added after, stored prediction unchanged', () => {
  const f = join(tmpdir(), 'plog-' + process.pid + '.json'), run = now => execFileSync('node', ['scripts/sim/prediction-log.mjs', '--file', f, '--now', now, '--days', '3']);
  try {
    run('2026-11-17T00:00:00Z'); // Las Vegas 2026 starts 2026-11-19
    const a = JSON.parse(readFileSync(f, 'utf8')).entries.find(e => e.key === 'f1-2026-11-19-las-vegas|2026');
    assert.ok(a && Number.isFinite(a.prediction.lap) && a.result === null && a.model.calibrationHash);
    run('2026-11-23T00:00:00Z');
    const b = JSON.parse(readFileSync(f, 'utf8')).entries.find(e => e.key === a.key);
    assert.deepEqual(b.prediction, a.prediction); assert.equal(b.predictedAt, a.predictedAt);
    assert.equal(b.result.lap, 93.893); assert.match(b.result.source, /f1-poles-data/);
  } finally { rmSync(f, {force: true}); }
});
