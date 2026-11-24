// car.lateralCap hook (kernel slot 1, spec claude/handoff-14a-to-10b-lateralcap-hook-2026-11-23.md): measured a_y(v) as the lateral
// limit. Unset = the kernel without it (laps of production cars do not carry the field). Limits checked on a 100 m circle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {lapsimCalibration as C} from '../worker/lapsim/calibration-data.js';

const K = lapsimKernel(), car25 = C.seasons['2025'].car, R0 = 100, n = 400;
const circle = {ds: 2 * Math.PI * R0 / n, kappa: new Float64Array(n).fill(1 / R0), mu: null, vScale: null, aeroLow: null, grade: null, heading: null};
const flat = {...car25, cdA: 0, cdALow: 0, vSubtractCorner: 0, cRoll: 0};
const speedOn = (car, step) => 2 * Math.PI * R0 / K.simulateLap(circle, car, {rho: 1.2}, {kernelStep: step}).lapTime;

for (const step of [1, 2]) {
  test(`lateralCap quad: on a 100 m circle v²/R = a0 + k·v² within 1e-4 (kernel step ${step})`, () => {
    const a0 = 14, k = 0.0042, exact = Math.sqrt(a0 / (1 / R0 - k));
    const v = speedOn({...flat, lateralCap: {kind: 'quad', a0, k, rhoRef: 1.2, braking: true}}, step);
    assert.ok(Math.abs(v / exact - 1) < 1e-4, `${v} vs ${exact}`);
  });
  test(`lateralCap table: PCHIP through two knots is the straight line, flat outside (kernel step ${step})`, () => {
    // a_y = 10 + 0.1·(v − 10) m/s² between 36 and 180 km/h: v²/R = 9 + 0.1·v → v = (0.1 + √(0.01 + 36/R))/(2/R)
    const table = {kind: 'table', kph: [36, 180], ay: [10, 14], rhoRef: 1.2, braking: false}, exact = (0.1 + Math.sqrt(0.01 + 36 / R0)) / (2 / R0);
    assert.ok(Math.abs(speedOn({...flat, lateralCap: table}, step) / exact - 1) < 1e-4);
    const low = {kind: 'table', kph: [200, 300], ay: [12, 20], rhoRef: 1.2}; // below the first knot: flat 12 m/s²
    assert.ok(Math.abs(speedOn({...flat, lateralCap: low}, step) / Math.sqrt(12 * R0) - 1) < 1e-4);
  });
  test(`lateralCap: density scales the speed as √(ρ/ρref); unset leaves a real lap unchanged (kernel step ${step})`, () => {
    const tr = K.trackFromData(lapsimTracks.suzuka), c = {...car25, lateralCap: {kind: 'quad', a0: 12, k: 0.006, rhoRef: 1.2}};
    assert.ok(K.simulateLap(tr, c, {rho: 1.0}, {kernelStep: step}).lapTime > K.simulateLap(tr, c, {rho: 1.2}, {kernelStep: step}).lapTime);
    assert.equal(JSON.stringify(K.simulateLap(tr, {...car25, lateralCap: null}, {}, {kernelStep: step})), JSON.stringify(K.simulateLap(tr, car25, {}, {kernelStep: step})));
  });
}
