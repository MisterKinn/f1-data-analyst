import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimFeTracks} from '../worker/lapsim/fe-tracks-data.js';
import {lapsimFeZones as Z} from '../worker/lapsim/fe-zones-data.js';

// 4 pi A / L^2 of the drawn map: a traced outline of one stroke encloses almost no area (FE Mexico before 2026-11-17: 0.04)
const compact = m => { let a = 0; const n = m.x.length, L = m.x.reduce((s, x, i) => s + Math.hypot(m.x[(i + 1) % n] - x, m.y[(i + 1) % n] - m.y[i]), 0);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += m.x[i] * m.y[j] - m.x[j] * m.y[i]; } return 2 * Math.PI * Math.abs(a) / L ** 2; };

test('Formula E tracks: every lap line encloses the circuit (no traced outline of a stroke)', () => {
  for (const [id, t] of Object.entries(lapsimFeTracks)) assert.ok(compact(t.map) >= 0.08, `${id} compactness ${compact(t.map).toFixed(3)}`);
});

test('Formula E Mexico: lap line from OpenStreetMap ways matched to the official map, near the printed length', () => {
  for (const id of ['fe-mexico', 'fe-mexico-2023']) {
    const t = lapsimFeTracks[id];
    assert.match(t.quality.evidence.planShape, /OpenStreetMap raceway ways matched to the official FIA Formula E circuit map/, id);
    assert.ok(Math.abs(t.quality.totalTurnDeg) > 355 && Math.abs(t.quality.totalTurnDeg) < 365, `${id} one closed lap`);
    assert.ok(t.length > 0.95 * t.officialLengthM && t.length <= t.officialLengthM, `${id} length ${t.length}`);
    assert.ok(Z.tracks[id].gen3evo.doc.includes('ATTACK ZONE') && !Z.tracks[id].gen3evo.est, `${id} Attack Zone label near the line`);
  }
});

test('Formula E tracks: race direction from the printed turn numbers, lap starts at the finish label', () => {
  for (const [id, t] of Object.entries(lapsimFeTracks)) {
    assert.match(t.quality.start, /label on the official circuit map/, `${id} start`);
    assert.notEqual(t.quality.startVerified, false, `${id} start placed`);
  }
});
