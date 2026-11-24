// WEC season level, candidate A: per-event BoP as physical inputs (flag LAPSIM_WEC_BOP, off by default).
// Values checked against scripts/sim/data/fia-docs/wec-bop-2023-2026.csv (spot-checked against the PDFs in step 22).
import test from 'node:test';
import assert from 'node:assert/strict';
import {bopTable, bopFor, bopModel} from '../scripts/sim/learn/wec-bop-input.mjs';
import {simLap} from '../scripts/sim/learn/fit-endurance.mjs';

const T = bopTable();

test('BoP car name -> our model key', () => {
  for (const [name, season, cls, key] of [['TOYOTA GR010 - Hybrid', 2023, 'Hypercar', 'Toyota GR010 Hybrid'], ['Toyota TR010 Hybrid', 2025, 'Hypercar', 'Toyota GR010 Hybrid'],
    ['FERRARI 499P', 2023, 'Hypercar', 'Ferrari 499P'], ['PORSCHE 963', 2024, 'Hypercar', 'Porsche 963'], ['CADILLAC V-Series.R', 2024, 'Hypercar', 'Cadillac V-Series.R'],
    ['BMW M4 LMGT3', 2024, 'LMGT3', 'BMW M4 GT3'], ['Porsche 911 GT3 R LMGT3', 2024, 'LMGT3', 'Porsche 911 GT3 R (992)']])
    assert.equal(bopModel(name, season, cls), key, name);
});

test('reference = class median of the latest published season', () => {
  assert.equal(T.ref.Hypercar.season, 2025); assert.equal(T.ref.LMGT3.season, 2025);
  assert.ok(T.ref.Hypercar.mass > 1000 && T.ref.Hypercar.power > 450); assert.equal(T.ref.LMGT3.power, null); // LMGT3: curve ids, no kW
});

test('one event per class', () => {
  // LMH: 2023 Monza Toyota, 1080 kg / 507 kW (D0054)
  const lmh = bopFor(T, {series: 'wec', season: 2023, event: 'autodromo-nazionale-di-monza', group: 'lmh', model: 'Toyota GR010 Hybrid'});
  assert.deepEqual([lmh.mass, lmh.power, lmh.unknown], [1080, 507, false]);
  assert.equal(lmh.dMass, 1080 - T.ref.Hypercar.mass); assert.equal(lmh.pScale, 507 / T.ref.Hypercar.power);
  // LMDh: 2024 Lone Star Le Mans (COTA) Porsche 963, 1053 kg / 509 kW
  const lmdh = bopFor(T, {series: 'wec', season: 2024, event: 'circuit-of-the-americas', group: 'lmdh', model: 'Porsche 963'});
  assert.deepEqual([lmdh.mass, lmdh.power, lmdh.unknown], [1053, 509, false]);
  // LMGT3: mass only
  const gt3 = bopFor(T, {series: 'wec', season: 2024, event: 'austin', group: 'gt3', model: 'BMW M4 GT3'});
  assert.equal(gt3.unknown, false); assert.ok(gt3.mass > 1200); assert.equal(gt3.pScale, 1);
});

test('2026 (no public BoP): class median of the latest published season, marked unknown; other series untouched', () => {
  const r = bopFor(T, {series: 'wec', season: 2026, event: 'monza', group: 'lmh', model: 'Toyota GR010 Hybrid'});
  assert.equal(r.unknown, true); assert.equal(r.dMass, 0); assert.equal(r.pScale, 1);
  assert.equal(bopFor(T, {series: 'imsa', season: 2024, event: 'sebring', group: 'lmdh', model: 'Porsche 963'}), null);
  assert.equal(bopFor(T, {series: 'wec', season: 2024, event: 'imola', group: 'lmp2', model: 'Oreca 07'}), null);
});

test('flag inputs reach the car: heavier and weaker is slower; a zero offset is the plain car', () => {
  const w = {airC: 25, trackC: 35, hpa: 1013, hum: 50}, base = simLap('monza', 'lmh', 2023, w);
  assert.equal(simLap('monza', 'lmh', 2023, w, 1, false, {dMass: 0, pScale: 1}), base);
  assert.ok(simLap('monza', 'lmh', 2023, w, 1, false, {dMass: 40, pScale: 0.97}) > base);
});
