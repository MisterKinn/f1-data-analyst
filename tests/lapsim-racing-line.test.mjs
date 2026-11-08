import test from 'node:test';
import assert from 'node:assert/strict';
import {minCurvatureLine} from '../worker/lapsim/racing-line.js';
import {lapsimRacingLines} from '../worker/lapsim/racing-lines-data.js';
import worker from '../worker/index.js';

test('min-curvature line stays in the corridor and cuts the corner of a square-ish loop', () => {
  // rounded square, 400 m side, ±6 m free
  const x = [], y = [], n = 400;
  for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a); x.push(200 * Math.sign(c) * Math.abs(c) ** 0.3); y.push(200 * Math.sign(s) * Math.abs(s) ** 0.3); }
  const half = Array(n).fill(6), r = minCurvatureLine(x, y, half, {iters: 800});
  assert.ok(r.offset.every(o => Math.abs(o) <= 6 + 1e-9));
  assert.ok(Math.max(...r.offset.map(Math.abs)) > 3, 'line uses the track width');
});

test('every stored line lies between its edges and TUM tracks stay close to the TUM optimal line', () => {
  for (const [id, t] of Object.entries(lapsimRacingLines.tracks)) {
    assert.equal(t.line.length, t.left.length, id);
    // sum of distances to both edges vs the width: at most a small excess on tight corners, where the
    // stored edge points and the line point are not on one exact normal
    let out = 0;
    for (let i = 0; i < t.line.length; i++) {
      const [lx, ly] = t.left[i], [rx, ry] = t.right[i], [px, py] = t.line[i];
      const ex = Math.hypot(px - lx, py - ly) + Math.hypot(px - rx, py - ry) - Math.hypot(lx - rx, ly - ry);
      assert.ok(ex < 1.5, `${id} point ${i} ${ex.toFixed(2)} m outside`); if (ex > 0.5) out++;
    }
    assert.ok(out / t.line.length < 0.02, `${id} ${out} points near the edge`);
    if (t.edges === 'TUM') assert.ok(t.check.vsTumMeanM < 3, `${id} ${t.check.vsTumMeanM} m from TUM`);
  }
});

test('simulation page shows the racing line panel with corner zoom', async () => {
  const html = await (await worker.fetch(new Request('https://example.com/simulation?track=monza'), {})).text();
  assert.match(html, /class="panel ls-panel ls-line-panel"/);
  assert.match(html, /data-line-zoom="0 0 \d+ \d+"/);
  assert.match(html, /class="ls-line-map"/);
});
