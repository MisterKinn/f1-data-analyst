// Step 3 (claude/gate-independent-geometry-prereg-2026-11-23.md): car-independent geometry for 4 tracks, behind LAPSIM_GEOM_INDEP.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {utm, enu, IDS, mapDist} from '../scripts/sim/geom-indep/build.mjs';

test('coordinates match PROJ (pyproj 3.7) to the millimetre', () => {
  const [e, n] = utm(44.338, 11.708, 32); // EPSG:32632
  assert.ok(Math.abs(e - 715877.12605) < 1e-3 && Math.abs(n - 4912981.64816) < 1e-3);
  const [x, y] = enu([34.8431, 136.541]).fwd(34.8531, 136.551); // +proj=topocentric at the Suzuka seed
  assert.ok(Math.abs(x - 914.51016) < 1e-3 && Math.abs(y - 1109.42355) < 1e-3);
  const [la, lo] = enu([34.8431, 136.541]).inv(x, y);
  assert.ok(Math.abs(la - 34.8531) < 1e-8 && Math.abs(lo - 136.551) < 1e-8);
});

test('flag off: apply.mjs changes nothing', () => {
  const before = readFileSync('worker/lapsim/tracks-data.js', 'utf8');
  const out = execFileSync('node', ['scripts/sim/geom-indep/apply.mjs'], {env: {...process.env, LAPSIM_GEOM_INDEP: ''}}).toString();
  assert.match(out, /nothing changed/);
  assert.equal(readFileSync('worker/lapsim/tracks-data.js', 'utf8'), before);
});

test('data file: one era per track, consistent arrays, positions inside the lap', () => {
  const G = JSON.parse(readFileSync('scripts/sim/data/geom-indep/tracks.json', 'utf8')).tracks;
  assert.deepEqual(Object.keys(G).sort(), [...IDS].sort());
  for (const id of IDS) {
    const e = G[id].eras[0], r = e.row, n = r.kappa.length, L = n * r.ds;
    assert.equal(r.grade.length, n); assert.equal(r.heading.length, n);
    assert.ok(Math.abs(r.length - L) <= 1);
    for (const c of r.corners) assert.ok(c.s >= 0 && c.s < L, `${id} T${c.number}`);
    // the lap closes: total turn is a whole number of turns (Suzuka is a figure eight: 0)
    const turn = r.kappa.reduce((a, k) => a + k, 0) / 1e5 * r.ds / (2 * Math.PI);
    assert.ok(Math.abs(turn - Math.round(turn)) < 0.01, `${id} turn ${turn}`);
    // distance correspondence is monotone and lands inside the new lap
    const d = e.extra.dist; for (let i = 1; i < d.length; i++) assert.ok(d[i] >= d[i - 1]);
    assert.ok(mapDist(0, 5, d, L) >= 0 && mapDist(1234, 5, d, L) < L);
  }
});
