import test from 'node:test';
import assert from 'node:assert/strict';
import {feCarFor, FE_GENS} from '../worker/lapsim/fe-cars.js';
import {againstOneway} from '../scripts/sim/tracks/assemble.mjs';

test('Formula E qualifying power follows the session (groups below full power, duels and practice at full power)', () => {
  const kw = (s, se, t) => feCarFor(s >= 2025 ? 'fe-gen3evo' : s >= 2023 ? 'fe-gen3' : 'fe-gen2', s, se, t).pIce / 1e3;
  assert.equal(kw(2026, 'Qualifying Group A', 'Q'), 300);
  assert.equal(kw(2026, 'Qualifying Duel Final', 'Q'), 350);
  assert.equal(kw(2024, 'Free Practice 1', 'P'), 350);
  assert.equal(kw(2022, 'Qualifying Group B', 'Q'), 220);
  assert.equal(kw(2022, 'Qualifying Duel Semi-Final 1', 'Q'), 250);
  assert.equal(kw(2020, 'Qualifying Group 2', 'Q'), 250);
  assert.equal(feCarFor('fe-gen3evo', 2026, 'Qualifying Duel Final', 'Q'), FE_GENS['fe-gen3evo'].car); // full power: the page car itself
});

test('a loop that drives a one-way raceway backwards is counted against it', () => {
  const ring = [[0, 0], [0, 0.001], [0.001, 0.001], [0.001, 0], [0, 0]], way = {tags: {oneway: 'yes'}, geometry: ring.map(([lat, lon]) => ({lat, lon}))};
  assert.equal(againstOneway(ring, [way]), 0);                // as mapped
  assert.equal(againstOneway([...ring].reverse(), [way]), 0); // the other lap direction is also fine: the better direction counts
  const half = {tags: {oneway: 'yes'}, geometry: ring.slice(0, 3).map(([lat, lon]) => ({lat, lon}))}, back = {tags: {oneway: 'yes'}, geometry: ring.slice(2).reverse().map(([lat, lon]) => ({lat, lon}))};
  assert.ok(Math.abs(againstOneway(ring, [half, back]) - 0.5) < 1e-9); // half the one-way length against the other half
});

test('Hypercar/GTP class cars show the fastest lap of WEC and IMSA together (owner 2026-11-15, Sebring)', async () => {
  const {carsFor} = await import('../worker/lapsim/scenario.js'), {lapsimClassRecords} = await import('../worker/lapsim/class-records-data.js');
  const c = carsFor('sebring'), r = lapsimClassRecords.tracks.sebring.real;
  for (const k of ['wec-lmh', 'wec-lmdh']) assert.equal(c[k].fix.lap, r[k].lap, k);
  assert.equal(r['wec-lmdh'].series, 'imsa'); // IMSA GTP 2023 is faster than the WEC 2023 LMDh lap
});
