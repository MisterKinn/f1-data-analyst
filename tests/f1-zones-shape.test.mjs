import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimF1Zones} from '../worker/lapsim/f1-zones-data.js';
import {lapsimAllTracks as T} from '../worker/lapsim/tracks.js';

// owner 2026-11-15: zones were cut at flat kinks (Montreal T12, Interlagos T15) and drawn in the wrong place; a DRS/SM zone runs
// from its activation point to a braking point, so it is at least 150 m long
test('every DRS and Straight Mode zone is at least 150 m long', () => {
  for (const [id, ys] of Object.entries(lapsimF1Zones.tracks || lapsimF1Zones)) for (const [y, e] of Object.entries(ys)) for (const z of e.zones || []) {
    const L = T[id].kappa.length * T[id].ds, len = ((z.to - z.from) % L + L) % L;
    assert.ok(len >= 150, `${id} ${y} ${e.kind} ${z.n}: ${Math.round(len)} m`);
  }
});
