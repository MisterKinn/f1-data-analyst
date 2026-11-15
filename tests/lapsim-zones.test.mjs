import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {lapsimF1Zones} from '../worker/lapsim/f1-zones-data.js';
import {withZones, ZONES_ON} from '../worker/lapsim/zones.js';

const K = lapsimKernel();
test('zones: off unless the F1 fit used them; other series never change', () => {
  const d = lapsimTracks.monza, base = K.trackFromData(d);
  assert.equal(withZones(K, d, base, {series: 'wec', year: 2026}), base);
  if (!ZONES_ON) assert.equal(withZones(K, d, base, {year: 2026}), base);
});
test('zones: Hungaroring 2026 zone 3 ends before T4 (F1 lifts there), Miami zone 1 starts after T19', () => {
  const h = lapsimF1Zones.tracks.hungaroring['2026'].zones.find(z => z.n === 3), t4 = lapsimTracks.hungaroring.corners.find(c => c.number === 4);
  assert.ok(h.to < t4.s, `zone 3 ends at ${h.to}, T4 at ${t4.s}`);
  const m = lapsimF1Zones.tracks.miami['2026'].zones.find(z => z.n === 1), t19 = lapsimTracks.miami.corners.find(c => c.number === 19);
  assert.ok(m.from > t19.s, `zone 1 starts at ${m.from}, T19 at ${t19.s}`);
});
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';
test('zones: no estimated zone runs through a bend tighter than 300 m', () => {
  for (const [id, o] of Object.entries(lapsimF1Zones.tracks)) for (const y of ['2025', '2026']) { const z = o[y], t = lapsimAllTracks[id]; if (!z?.est || !t) continue;
    const n = t.kappa.length, L = n * t.ds, w = Math.max(1, Math.round(25 / t.ds));
    for (const q of z.zones) { const len = ((q.to - q.from) % L + L) % L;
      for (let d = 0; d < len; d += t.ds) { const i = Math.round(((q.from + d) % L) / t.ds) % n; let m = 0; for (let j = -w; j <= w; j++) m += t.kappa[(i + j + n) % n] / 1e5;
        assert.ok(Math.abs(m / (2 * w + 1)) <= 1 / 300 + 1e-9, `${id} ${y} zone ${q.n} bends at ${Math.round(q.from + d)} m`); } } }
});
