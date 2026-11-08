import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {carsFor} from '../worker/lapsim/scenario.js';
import worker from '../worker/index.js';

const K = lapsimKernel();

test('energy flow per point adds up to the lap energy totals', () => {
  for (const key of ['2026', 'wec-lmh']) {
    const c = carsFor('monza')[key], tr = K.trackFromData(lapsimTracks.monza); tr.mu.fill(c.grip);
    const r = K.simulateLap(tr, c.car, K.conditionsFromWeather({})), F = r.flow, sum = a => a.reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(sum(F.dep) - r.energy.deployJ) < 1, key);
    assert.ok(Math.abs(sum(F.brk) + sum(F.thr) - r.energy.regenJ) < 1, key);
  }
});

test('battery panel: F1 2026 checks against the per-event limit, Hypercar shows the window it needs', async () => {
  const f1 = await (await worker.fetch(new Request('https://example.com/simulation?track=monza&car=2026'), {})).text();
  assert.match(f1, /data-ls="soc"><h3>배터리 에너지 \(추정\)/);
  assert.match(f1, /회생 ≤ 한도 ✓/);
  const wec = await (await worker.fetch(new Request('https://example.com/simulation?track=monza&car=wec-lmh'), {})).text();
  assert.match(wec, /필요한 배터리 사용 폭 \d/);
});
