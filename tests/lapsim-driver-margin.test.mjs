// Step 11a driver margin (scripts/sim/driver-margin.mjs): phase picker on two stored real laps, margins, frozen mask, cell stats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {frozenMask, lapFrom, pickPhases, margins, cellStats} from '../scripts/sim/driver-margin.mjs';

const FX = JSON.parse(readFileSync(new URL('./fixtures/driver-margin-laps.json', import.meta.url), 'utf8')).laps;

for (const [drv, T] of Object.entries(FX)) test(`phase picker on the stored Suzuka 2025 lap of ${drv} (hairpin T11)`, () => {
  const L = lapFrom(T), len = L.s.at(-1);
  assert.ok(Math.abs(L.s[1] - (T.speed[0] + T.speed[1]) / 7.2 * (T.time[1] - T.time[0])) < 1e-9, 'distance is integrated speed');
  const hairpin = L.v.indexOf(Math.min(...L.v)), [r] = pickPhases(L, [{key: '11', f: L.s[hairpin] / len}]);
  assert.equal(r.key, '11');
  assert.equal(r.apex, L.v[hairpin], 'apex = the lowest measured sample');
  assert.ok(r.apex * 3.6 > 60 && r.apex * 3.6 < 95, `hairpin apex ${r.apex * 3.6} km/h`);
  assert.ok(r.brake / 9.81 > 3 && r.brake / 9.81 < 7, `peak decel ${r.brake / 9.81} g`);
  // exit: linear in distance at apex + 60 m
  const x = r.apexS + 60, k = L.s.findIndex(s => s >= x), f = (x - L.s[k - 1]) / (L.s[k] - L.s[k - 1]);
  assert.ok(Math.abs(r.exit - (L.v[k - 1] + f * (L.v[k] - L.v[k - 1]))) < 1e-9);
  assert.ok(r.exit > r.apex);
});

test('a flat corner (no 10 km/h drop) has no phases', () => {
  const T = {time: [], speed: [], rpm: [], gear: [], throttle: [], brake: []};
  for (let i = 0; i < 100; i++) { T.time.push(i * 0.13); T.speed.push(250 - 4 * Math.exp(-(((i - 50) / 10) ** 2)) + (i % 3)); T.rpm.push(11000 + i); T.gear.push(7); T.throttle.push(100); T.brake.push(false); }
  assert.equal(pickPhases(lapFrom(T), [{key: '1', f: 0.5}]).length, 0);
});

test('margins: the envelope driver is 1, nobody above 1; fewer than 5 drivers gives nothing', () => {
  const rows = [3.1, 4.2, 5.0, 4.9, 3.3, 4.0].map((value, i) => ({drv: 'D' + i, value}));
  const m = margins(rows);
  assert.equal(Math.max(...m.map(x => x.m)), 1);
  assert.equal(m.find(x => x.drv === 'D2').m, 1);
  assert.ok(m.every(x => x.m <= 1 && x.m > 0));
  assert.equal(margins(rows.slice(0, 4)), null);
  // real laps: both stored drivers at the hairpin apex, plus three slower copies, stay <= 1
  const apex = Object.entries(FX).map(([drv, T]) => ({drv, value: Math.min(...T.speed)}));
  const m2 = margins([...apex, ...[0.97, 0.98, 0.99].map((s, i) => ({drv: 'X' + i, value: apex[0].value * s}))]);
  assert.ok(m2.every(x => x.m <= 1) && m2.some(x => x.m === 1));
});

test('frozen mask: rule D (all channels frozen 1.5 s) and rule C (speed and rpm repeat 4 samples), ± 1 sample', () => {
  const T = {time: [], speed: [], rpm: [], gear: [], throttle: [], brake: []};
  for (let i = 0; i < 60; i++) { T.time.push(i * 0.13); T.speed.push(200 + i); T.rpm.push(10000 + 10 * i); T.gear.push(7); T.throttle.push(100); T.brake.push(false); }
  for (let i = 20; i < 35; i++) { T.speed[i] = T.speed[19]; T.rpm[i] = T.rpm[19]; } // 16 equal samples, about 2 s
  const bad = frozenMask(T);
  assert.equal(bad[17], 0); assert.equal(bad[18], 1); assert.equal(bad[35], 1); assert.equal(bad[36], 0);
  const L = lapFrom(T, bad); assert.equal(L.bad.filter(Boolean).length, 18);
});

test('cell stats: equal weight per track, bootstrap interval contains the median', () => {
  const s = cellStats({a: [0.9, 0.95, 1], b: [0.8], c: [0.97, 0.99], d: [0.93], e: [0.96, 0.94]}, {B: 500});
  assert.equal(s.tracks, 5); assert.equal(s.n, 9);
  assert.ok(s.ci90[0] <= s.median && s.median <= s.ci90[1]);
  assert.ok(s.p10 <= s.median && s.median <= s.p90);
});
