import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimTracks, lapsimExtraTracks} from '../worker/lapsim/tracks-data.js';

// owner 2026-11-16: a long lap drawn with 360 points lost its chicanes (Le Mans one point every 35 m, Nürburgring 24h every 65 m)
// owner 2026-11-16 (later): the shortest possible spacing = one map point per stored line point (5 m)
test('every track map has a point at every line point (about 5 m), so chicanes stay visible', () => {
  for (const [id, t] of Object.entries({...lapsimTracks, ...lapsimExtraTracks})) {
    const lap = t.kappa.length * t.ds;
    assert.ok(lap / t.map.x.length <= t.ds + 0.01 && t.map.x.length === t.kappa.length, `${id}: ${(lap / t.map.x.length).toFixed(1)} m per map point`);
  }
});

test('densify-maps keeps the old points and adds nothing on a map that is already dense', async () => {
  const {denseMap} = await import('../scripts/sim/densify-maps.mjs');
  const t = lapsimTracks.monza, n = t.kappa.length, old = {x: t.map.x.filter((_, i) => i % 3 === 0), y: t.map.y.filter((_, i) => i % 3 === 0)};
  const r = denseMap({...t, map: old});
  assert.equal(r.map.x.length, n);
  for (let j = 0; j < old.x.length; j++) assert.ok(Math.abs(r.map.x[j * 3] - old.x[j]) <= 1 && Math.abs(r.map.y[j * 3] - old.y[j]) <= 1);
});
