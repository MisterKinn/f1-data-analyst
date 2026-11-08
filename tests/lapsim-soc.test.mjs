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
  assert.match(f1, /배터리 사용 폭 4\.00 MJ ✓/, 'battery tracked point by point stays inside the 4 MJ window');
  const wec = await (await worker.fetch(new Request('https://example.com/simulation?track=monza&car=wec-lmh'), {})).text();
  assert.match(wec, /필요한 배터리 사용 폭 \d/);
});

test('2026 F1: the battery never goes outside its usable window on any track', async () => {
  const {lapsimTracks} = await import('../worker/lapsim/tracks-data.js');
  for (const id of Object.keys(lapsimTracks)) {
    const c = carsFor(id)['2026'], tr = K.trackFromData(lapsimTracks[id]); tr.mu.fill(c.grip);
    const F = K.simulateLap(tr, c.car, K.conditionsFromWeather({rechargeMJ: 5})).flow; let soc = F.soc, got = 0, lo = Infinity;
    for (let i = 0; i < F.dep.length; i++) { let r = F.brk[i] + F.thr[i]; r = Math.max(0, Math.min(r, F.recharge - got)); got += r; soc = Math.min(F.soc, soc - F.dep[i] + r); lo = Math.min(lo, soc); }
    assert.ok(lo >= -1e3, `${id} battery ${lo / 1e6} MJ`);
  }
});
