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

// attempt 3 (claude/gate-independent-geometry-attempt3-prereg-2026-11-23.md)
import {erasOf, limitRules, fiaRow, widthsFor, A3} from '../scripts/sim/geom-indep/build-a3.mjs';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';

test('a3: layout eras from the 5a registry, OSM dated inside each older era', () => {
  assert.deepEqual(erasOf('catalunya'), [{from: null, to: 2020, date: '2020-06-01'}, {from: 2021, to: 2022, date: '2022-06-01'}, {from: 2023, to: null, date: null}]);
  assert.deepEqual(erasOf('suzuka'), [{from: null, to: null, date: null}]);
});

test('a3: 4a rules are named F1 corners of the latest event in the era', () => {
  const r = limitRules('montreal', {from: null, to: null});
  assert.ok(r && r.year >= 2025 && r.corners.every(c => ['line', 'kerb', 'loop'].includes(c.rule)));
  assert.equal(limitRules('le-mans', {from: null, to: null}), null); // WEC: no source, no limits
});

test('a3: FIA list row by name and length', () => {
  assert.equal(fiaRow('suzuka', lapsimAllTracks.suzuka)?.lengthM, 5807);
});

test('a3: width from an OSM area polygon, fallback elsewhere, no kerb without a source', () => {
  // a straight 200 m centre line inside a 14 m wide raceway area on the first half only
  const P = {fwd: (la, lo) => [lo, la], inv: (x, y) => [y, x]}, x = Array.from({length: 80}, (_, i) => i * 5), y = x.map(() => 0);
  const poly = [[0, -7], [200, -7], [200, 7], [0, 7], [0, -7]].map(([e, n]) => ({lat: n, lon: e}));
  const osm = {elements: [{type: 'way', tags: {'area:highway': 'raceway'}, geometry: poly}]};
  const w = widthsFor('test-track', {from: null, to: null}, osm, {corners: []})({cl: {x, y}, P, reg: {x, y, apply: (a, b) => [a, b]}, W: 10});
  assert.ok(Math.abs(w.half[20] - (7 - 1.2)) < 1e-9 && Math.abs(w.right[20] - (7 - 1.2)) < 1e-9);
  assert.ok(Math.abs(w.half[60] - (10 / 2 - 1.2)) < 1e-9); // FIA-list fallback width 10 m
  assert.equal(w.usableWidth, null);
  assert.equal(w.note.kerb, 'none');
  assert.ok(w.note.sources['osm-area'] > 0.4 && w.note.sources['osm-area'] < 0.6);
  assert.equal(A3.kerbM, 1.0);
});

test('a3: a split build merges to the same bytes as one job (canonical order, any part order)', async () => {
  const {merge, canonicalIds, groupIds} = await import('../scripts/sim/geom-indep/build-a3.mjs');
  const {mkdtempSync, mkdirSync, writeFileSync, readFileSync} = await import('node:fs'), {tmpdir} = await import('node:os');
  const d = mkdtempSync(tmpdir() + '/a3-'), [a, b] = canonicalIds().slice(0, 2), part = id => ({id, eras: [{from: null, to: null, row: {id}}], report: [{status: 'ok'}]});
  for (const [dir, ids] of [['one', [a, b]], ['p1', [b]], ['p2', [a]]]) { mkdirSync(`${d}/${dir}`); ids.forEach(id => writeFileSync(`${d}/${dir}/${id}.json`, JSON.stringify(part(id)))); writeFileSync(`${d}/${dir}/ids.json`, JSON.stringify(ids)); }
  merge([`${d}/one`], `${d}/single`); merge([`${d}/p1`, `${d}/p2`], `${d}/split`);
  for (const f of ['tracks-a3.json', 'build-report-a3.json']) assert.equal(readFileSync(`${d}/split/${f}`, 'utf8'), readFileSync(`${d}/single/${f}`, 'utf8'));
  // the groups cover every track once
  const all = [1, 2, 3, 4, 5, 6].flatMap(k => groupIds(k, 6)); assert.equal(all.length, canonicalIds().length); assert.equal(new Set(all).size, all.length);
});
