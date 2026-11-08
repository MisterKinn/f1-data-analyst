import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimCarLines} from '../worker/lapsim/car-lines-data.js';
import {lapsimRacingLines} from '../worker/lapsim/racing-lines-data.js';
import {lineTrack} from '../worker/lapsim/racing-line.js';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import worker from '../worker/index.js';

const K = lapsimKernel();

test('lineTrack turns a circle into constant curvature at even spacing', () => {
  const n = 360, r = 100, x = [], y = [];
  for (let i = 0; i < n; i++) { x.push(r * Math.cos(i / n * 2 * Math.PI)); y.push(r * Math.sin(i / n * 2 * Math.PI)); }
  const tr = lineTrack(K, x, y, 5);
  assert.ok(Math.abs(tr.length - 2 * Math.PI * r) < 1);
  assert.ok(Array.from(tr.kappa).every(k => Math.abs(Math.abs(k) - 1 / r) < 2e-4));
});

test('every car line stays inside the track width and is never slower than the least-curvature line', () => {
  for (const [id, cars] of Object.entries(lapsimCarLines.tracks)) {
    const L = lapsimRacingLines.tracks[id];
    const half = L.left.map((l, i) => Math.hypot(l[0] - L.right[i][0], l[1] - L.right[i][1]) / 2);
    for (const [key, c] of Object.entries(cars)) for (const m of ['q', 'r']) {
      assert.equal(c[m].off.length, L.line.length, `${id} ${key} ${m}`);
      assert.ok(c[m].off.every((o, i) => Math.abs(o) / 10 <= half[i] + 0.05), `${id} ${key} ${m} inside`);
      assert.ok(c[m].gain <= 1e-9, `${id} ${key} ${m} not slower`);
    }
    for (const c of Object.values(cars)) assert.ok(c.r.grip > 0.7 && c.r.grip <= 1.05 && c.r.fuelKg > 0);
  }
});

test('the racing line is drawn on the track map, with on/off, qualifying/race and zoom controls', async () => {
  const id = Object.keys(lapsimCarLines.tracks)[0];
  const h = await (await worker.fetch(new Request(`https://example.com/simulation?track=${id}&car=2026`), {})).text();
  assert.match(h, /data-line-mode="q"/);
  assert.match(h, /data-line-mode="r"/);
  assert.match(h, /data-line-toggle/);
  assert.match(h, /data-zoom="in"/);
  assert.match(h, /<svg class="ls-map"[^>]*><polygon class="ls-band"/);
  assert.match(h, /class="ls-line-seg"/);
  assert.doesNotMatch(h, /ls-line-panel/, 'no separate racing line panel');
});
