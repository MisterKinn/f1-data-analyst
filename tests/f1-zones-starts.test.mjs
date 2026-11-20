// The corrected official zone starts (G4 / W7-F drop-in) replay exactly in the generated zones (measured lookup: no rounding, no model).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimF1Zones} from '../worker/lapsim/f1-zones-data.js';

test('every corrected zone start replays at 0 m', () => {
  const D = JSON.parse(readFileSync(new URL('../scripts/sim/data/learn/f1-zones-raw-starts.json', import.meta.url), 'utf8')).zones;
  for (const d of D) {
    const slot = lapsimF1Zones.tracks[d.track]?.[d.year >= 2026 ? String(d.year) : '2025'];
    if (!slot || slot.year !== d.year) continue; // an older year shadowed by a newer document
    const z = slot.zones.find(q => q.n === d.n);
    assert.ok(z && !slot.est, `${d.track} ${d.year} zone ${d.n} missing`);
    assert.equal(z.from, d.from, `${d.track} ${d.year} zone ${d.n} start`);
    if (d.low !== undefined) assert.equal(z.low, d.low, `${d.track} ${d.year} zone ${d.n} low-grip start`);
  }
});
