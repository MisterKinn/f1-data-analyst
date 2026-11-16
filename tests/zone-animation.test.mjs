import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage} from '../worker/simulation.js';
import {readFileSync} from 'node:fs';

// owner 2026-11-16: zones grow/shrink and OT marks fade when the options change, so every zone and mark stays in the drawing with its state
test('map zones carry a stable key, a unit path and the shown part; OT marks carry a key and opacity', () => {
  const h = simulationPage({track: 'monza'}, 'en');
  const z = h.match(/<path class="ls-zone ls-zone-sm" data-zk="sm\d*" pathLength="1" style="stroke-dasharray:[\d.]+ 2;stroke-dashoffset:-?[\d.]+;opacity:[\d.]+"/g) || [];
  assert.ok(z.length >= 1, 'SM zone paths with key and dash state');
  assert.match(h, /class="ls-zone-m ls-zone-m-\w+" data-zk="m[^"]+" style="opacity:[01]"/);
  const src = readFileSync(new URL('../worker/simulation.js', import.meta.url), 'utf8'); // client script (served as /assets/lapsim.js)
  assert.match(src, /animZones\(prev\)/); assert.match(src, /prefers-reduced-motion/);
});
