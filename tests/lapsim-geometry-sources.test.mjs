import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chooseGeometrySources, zeroRain, DEFERRED_SOURCES} from '../scripts/sim/geometry-sources.mjs';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';

const session = (key, year, rainfall, circuit = 'Test Track') => ({session_key: key, year, circuit,
  weather: rainfall.map(rainfall => ({rainfall}))});

test('latest zero-rain source wins even when the newest session is wet', () => {
  const rows = [session(1, 2023, [0]), session(2, 2025, [0, 0]), session(3, 2026, [0, 1])];
  const c = chooseGeometrySources(rows)['test-track'];
  assert.equal(c.source.session_key, 2); assert.equal(c.keep, false);
});
test('only wet sessions retain existing geometry and warn with track and source', () => {
  const old = {'test-track': {sessionKey: 1}};
  const c = chooseGeometrySources([session(2, 2026, [1])], old)['test-track'];
  assert.equal(c.keep, true); assert.equal(c.source, undefined);
  assert.match(c.warning, /test-track.*no zero-rain.*source session 1/);
  assert.equal(chooseGeometrySources([session(2, 2026, [1])])['test-track'].source, undefined);
});
test('existing dry geometry is retained against a newer rain-marked session', () => {
  const rows = [session(9865, 2025, [0, 0], 'Interlagos'), session(11408, 2026, [0, 1], 'Interlagos')];
  const c = chooseGeometrySources(rows, {interlagos: {sessionKey: 9865}}).interlagos;
  assert.equal(c.source.session_key, 9865); assert.equal(c.keep, true);
});
test('unknown weather is not zero rain; explicit F1 exclusions veto a source', () => {
  for (const weather of [[], [null], [undefined], [false], [1]])
    assert.equal(zeroRain(session(1, 2025, weather)), false);
  const s = session(1, 2025, [0]);
  assert.equal(zeroRain({...s, weather: [null]}), false);
  assert.equal(zeroRain(s, {f1: {'1': {reason: 'wet'}}}), false);
  assert.equal(zeroRain(s, {f1: {'2025 test-track': {reason: 'wet'}}}), false);
  assert.equal(zeroRain(s, {wec: {'2025 test-track': {reason: 'wet'}}}), true);
  assert.equal(zeroRain({...s, weather: [['time', 20, 30, 40, 1000, 0]]}), true);
});
test('the three owner-deferred sources stay fixed, with dry candidates reported', () => {
  for (const [id, key] of Object.entries(DEFERRED_SOURCES)) {
    const c = chooseGeometrySources([session(key, 2026, [1], id), session(1, 2025, [0], id)],
      {[id]: {sessionKey: key}})[id];
    assert.equal(c.keep, true); assert.equal(c.source.session_key, key);
    assert.equal(c.dryCandidate.session_key, 1); assert.match(c.warning, /deferred by owner/);
  }
});
test('builder retains all 26 current geometry records byte-for-byte, including an alternate output path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lapsim-geometry-guard-'));
  try {
    await mkdir(join(dir, 'worker/lapsim'), {recursive: true});
    await mkdir(join(dir, 'cache/sessions'), {recursive: true});
    const original = await readFile(new URL('../worker/lapsim/tracks-data.js', import.meta.url));
    await writeFile(join(dir, 'worker/lapsim/tracks-data.js'), original);
    await writeFile(join(dir, 'package.json'), '{"type":"module"}');
    // Source-selection fixture: real current source IDs, with observed rain vetoes.
    const rows = Object.values(lapsimTracks).map(t => ({...session(t.sessionKey, t.year,
      DEFERRED_SOURCES[t.id] ? [1] : [0], t.circuit), circuit_key: t.circuitKey}));
    rows.push(session(11408, 2026, [1], 'Interlagos'), session(9640, 2024, [0], 'Las Vegas'),
      session(9959, 2025, [0], 'Montreal'), session(9916, 2025, [0], 'Zandvoort'));
    const index = [];
    for (const r of rows) {
      const file = `${r.session_key}.json`;
      await writeFile(join(dir, 'cache/sessions', file), JSON.stringify({...r, laps: []}));
      index.push({...r, file});
    }
    await writeFile(join(dir, 'cache/index.json'), JSON.stringify(index));
    const env = {...process.env, LAPSIM_CACHE: 'cache', LAPSIM_TRACKS_OUT: 'candidate.mjs'};
    const output = execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/sim/build-geometry.mjs', import.meta.url))],
      {cwd: dir, env, encoding: 'utf8'});
    assert.match(output, /tracks 26/);
    assert.deepEqual(await readFile(join(dir, 'candidate.mjs')), original);
    assert.deepEqual(await readFile(join(dir, 'worker/lapsim/tracks-data.js')), original);
    assert.equal(lapsimTracks.interlagos.sessionKey, 9865);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
