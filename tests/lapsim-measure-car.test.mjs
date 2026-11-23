import test from 'node:test';
import assert from 'node:assert/strict';
import {fitSeason, fitTrackDrag, accel, frozenMask} from '../scripts/sim/measure-car.mjs';
import {fitTrack, DEFAULTS} from '../scripts/sim/joint-bcd.mjs';
import {lapsimCarMeasured as M} from '../worker/lapsim/car-measured-data.js';
import {simulateLap} from '../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../worker/lapsim/atmosphere.js';
import {autoStraights} from '../worker/lapsim/tracks.js';
import {PRIOR} from '../worker/lapsim/cars.js';

test('measure-car: the power balance recovers wheel power per band and drag per track from exact samples', () => {
  const P = [600e3, 610e3, 620e3, 630e3], cd = {a: 1.3, b: 1.7}, low = {a: 1.0, b: 1.3}, S = [];
  for (const t of ['a', 'b']) for (let kph = 181; kph < 340; kph += 0.7) for (const drs of [0, 1]) {
    const v = kph / 3.6, x = 0.5 * 1.15 * v * v * v, b = kph < 240 ? 0 : kph < 270 ? 1 : kph < 300 ? 2 : 3;
    S.push({track: t, drv: 'X', v, x, drs, y: P[b] - x * (drs ? low[t] : cd[t])});
  }
  const f = fitSeason(S);
  P.forEach((p, i) => assert.ok(Math.abs(f.P[i] - p) < 1, `band ${i}: ${f.P[i]}`));
  for (const t of ['a', 'b']) { assert.ok(Math.abs(f.cdA[t].cdA - cd[t]) < 1e-6); assert.ok(Math.abs(f.cdA[t].cdALow - low[t]) < 1e-6); }
  const d = fitTrackDrag(S.filter(q => q.track === 'a' && q.v * 3.6 >= 300), 630e3);
  assert.ok(Math.abs(d.cdA - 1.3) < 1e-6 && Math.abs(d.cdALow - 1.0) < 1e-6);
});

test('measure-car: acceleration is the local slope; frozen telemetry is masked', () => {
  const t = Array.from({length: 20}, (_, i) => i * 0.25), v = t.map(x => 60 + 3 * x);
  assert.ok(Math.abs(accel(t, v, 10, 0.5, new Uint8Array(20)) - 3) < 1e-9);
  const T = {time: t, speed: t.map((_, i) => i >= 5 && i <= 12 ? 250 : 200 + i), rpm: t.map((_, i) => i >= 5 && i <= 12 ? 11000 : 10000 + i), gear: t.map(() => 7), throttle: t.map(() => 100), brake: t.map(() => 0)};
  const bad = frozenMask(T);
  assert.equal(bad[8], 1); assert.equal(bad[0], 0); assert.equal(bad[19], 0);
});

test('car-measured-data: 2023-25 measured with ± columns, 2026 not measured, drag ratios physical', () => {
  assert.deepEqual(Object.keys(M.seasons).sort(), ['2023', '2024', '2025']);
  for (const s of Object.values(M.seasons)) {
    for (const q of [s.pWheel, s.cdA, s.drsRatio]) { assert.ok(q.value > 0 && q.stat >= 0 && q.sysTotal >= 0, JSON.stringify(q)); assert.ok(Math.abs(q.total - Math.hypot(q.stat, q.sysTotal)) <= 1e-3 * q.total + 1e-9); }
    assert.ok(s.pWheel.value > 4e5 && s.pWheel.value < 8e5); assert.ok(s.cdA.value > 0.8 && s.cdA.value < 2.2);
    assert.ok(s.drsRatio.value > 0.6 && s.drsRatio.value < 0.95); assert.equal(s.pIce.identified, false);
  }
  for (const r of Object.values(M.dragRatio)) assert.ok(r.ratio > 0.6 && r.ratio < 1.4, String(r.ratio));
});

test('drag flag: fitTrack is unchanged unless its own track is fixed; a fixed track keeps the measured factor', () => {
  const car = {...structuredClone(PRIOR[2025]), linkMu: false};
  const L = 2 * 800 + 2 * Math.PI * 90, n = Math.round(L / 5), ds = L / n, kappa = new Float64Array(n);
  for (let i = 0; i < n; i++) { const s = i * ds; kappa[i] = (s > 800 && s < 800 + Math.PI * 90) || s > 1600 + Math.PI * 90 ? 1 / 90 : 0; }
  const track = {ds, kappa, mu: new Float64Array(n).fill(1), vScale: new Float64Array(n).fill(1), aeroLow: autoStraights(kappa, ds)};
  const env = conditionsFromWeather({pressureHpa: 1000, airTempC: 25, humidityPct: 50});
  const r = simulateLap(track, {...car, cdA: car.cdA * 1.05, cdALow: car.cdALow * 1.05}, env);
  const laps = [{name: 't', group: 2025, track, env, lapSeconds: r.lapTime, trapKph: r.vMaxKph, weight: 1}];
  const o = {...DEFAULTS, trackDrag: true, wTime: 2, wSector: 0, wPrior: 2};
  const a = fitTrack(laps, {2025: car}, null, o), b = fitTrack(laps, {2025: car}, null, {...o, fixedDrag: {other: 0.8}});
  assert.deepEqual(b, a);
  const c = fitTrack(laps, {2025: car}, null, {...o, fixedDrag: {t: 0.93}});
  assert.equal(c.drag, 0.93);
});
