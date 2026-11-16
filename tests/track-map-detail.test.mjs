import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimTracks, lapsimExtraTracks} from '../worker/lapsim/tracks-data.js';

// owner 2026-11-16: a long lap drawn with 360 points lost its chicanes (Le Mans one point every 35 m, Nürburgring 24h every 65 m)
test('every track map has a point at least every 16 m, so chicanes stay visible', () => {
  for (const [id, t] of Object.entries({...lapsimTracks, ...lapsimExtraTracks})) {
    const lap = t.kappa.length * t.ds;
    assert.ok(lap / t.map.x.length <= 16, `${id}: ${(lap / t.map.x.length).toFixed(1)} m per map point`);
  }
});
