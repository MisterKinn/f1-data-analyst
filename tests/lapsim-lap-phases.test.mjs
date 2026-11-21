import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimLapPhases} from '../worker/lapsim/lap-phases-data.js';
import {simulationPage} from '../worker/simulation.js';

test('lap phases: measured out-lap / in-lap / SC medians per track, warm-up pooled per compound', () => {
  const T = lapsimLapPhases.tracks;
  assert.ok(Object.keys(T).length >= 27 && T['kuala-lumpur'] && !T.sakhir?.years?.['2026'], 'Sepang 2026 under kuala-lumpur');
  for (const [id, t] of Object.entries(T)) for (const y of Object.values(t.years || {})) for (const k of ['qOutLap', 'qCoolDown', 'sc', 'vsc']) if (y[k]) assert.ok(y[k].median > 1 && y[k].median < 2.5 && y[k].n > 0, `${id} ${k}`);
  assert.ok(Object.keys(lapsimLapPhases.warmup).includes('C3'));
});

test('race panel shows the out-lap, in-lap and safety-car rows from the measured table (ratio × reference lap)', () => {
  const h = simulationPage({track: 'monza'}, 'en');
  assert.match(h, /Out-lap, in-lap and safety car/);
  assert.match(h, /Race out-lap: pit exit to line/);
  assert.match(h, /Measured median \(TracingInsights 2022–26/);
  const ko = simulationPage({track: 'monza'}, 'ko');
  assert.match(ko, /아웃랩·인랩·세이프티카/);
});
