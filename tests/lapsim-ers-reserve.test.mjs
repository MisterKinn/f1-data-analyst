import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';

const K = lapsimKernel(), q = 100e3;
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test('positive reserve arithmetic stays bit-identical to the previous kernel expression', () => {
  for (const rate of [50e3, 100e3]) for (const power of [1, 50e3, q - 1, q, q + 1, 150e3, 200e3, 350e3]) {
    const lo = Math.min(power, q);
    assert.equal(K.ersRampEnergyJ(power, rate), power + 0.5 * (power - lo) * (power + lo) / rate);
  }
});

test('ERS reserve counts the hold below 100 kW, and never reserves negative energy', () => {
  for (const rate of [50e3, 100e3]) {
    assert.equal(K.ersRampEnergyJ(-50e3, rate), 0);
    assert.equal(K.ersRampEnergyJ(0, rate), 0);
    assert.equal(K.ersRampEnergyJ(50e3, rate), 50e3);
    assert.equal(K.ersRampEnergyJ(q, rate), q);
    assert.equal(K.ersRampEnergyJ(200e3, rate), 200e3 + 15e9 / rate);
  }
});

test('ERS inverse uses the low-energy branch instead of forcing a 100 kW floor', () => {
  for (const rate of [50e3, 100e3]) {
    assert.equal(K.ersRampPostCutLimitW(0, rate), 0);
    assert.equal(K.ersRampPostCutLimitW(50e3, rate), 50e3);
    assert.equal(K.ersRampPostCutLimitW(q, rate), q);
    // For a 150 kW initial step, 50 kJ permits 200 kW before the step, not 250 kW.
    assert.equal(150e3 + K.ersRampPostCutLimitW(50e3, rate), 200e3);
  }
  close(K.ersRampPostCutLimitW(200e3, 50e3), 130277.56377319945);
  close(K.ersRampPostCutLimitW(200e3, 100e3), 144948.97427831782);
});

test('ERS reserve and inverse round-trip, including non-unit hold times', () => {
  for (const rate of [50e3, 100e3]) for (const hold of [0.5, 1, 2]) {
    for (const power of [0, 1, 50e3, q - 1, q, q + 1, 200e3, 350e3]) {
      const energy = K.ersRampEnergyJ(power, rate, hold);
      close(K.ersRampPostCutLimitW(energy, rate, hold), power);
    }
    for (const energy of [0, 1, 50e3, hold * q - 1, hold * q, hold * q + 1, 4e6]) {
      close(K.ersRampEnergyJ(K.ersRampPostCutLimitW(energy, rate, hold), rate, hold), energy);
    }
  }
});

test('ERS reserve matches independent midpoint integration of hold and ramp', () => {
  for (const rate of [50e3, 100e3]) for (const power of [50e3, q, 200e3, 350e3]) {
    const n = 1000, rampDuration = Math.max(0, power - q) / rate;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      energy += power / n;
      energy += (power - rate * rampDuration * (i + 0.5) / n) * rampDuration / n;
    }
    close(K.ersRampEnergyJ(power, rate), energy, 1e-6);
  }
});

test('ERS reserve rejects non-numeric or invalid parameters rather than propagating NaN', () => {
  for (const fn of [K.ersRampEnergyJ, K.ersRampPostCutLimitW]) {
    for (const bad of [NaN, Infinity, -Infinity, '100000', null, undefined]) {
      assert.throws(() => fn(bad, 100e3), /finite/);
      assert.throws(() => fn(100e3, bad), /positive/);
      if (bad !== undefined) assert.throws(() => fn(100e3, 100e3, bad), /positive/);
    }
    assert.throws(() => fn(100e3, 0), /positive/);
    assert.throws(() => fn(100e3, -50e3), /positive/);
    assert.throws(() => fn(100e3, 100e3, 0), /positive/);
  }
  assert.throws(() => K.ersRampPostCutLimitW(-1, 100e3), /non-negative/);
});

test('ERS reserve helpers survive the browser self-contained kernel serialization', () => {
  const B = new Function(`return (${lapsimKernel.toString()})()`)();
  for (const rate of [50e3, 100e3]) for (const energy of [0, 50e3, 100e3, 200e3, 4e6]) {
    assert.equal(B.ersRampPostCutLimitW(energy, rate), K.ersRampPostCutLimitW(energy, rate));
    assert.equal(B.ersRampEnergyJ(energy, rate), K.ersRampEnergyJ(energy, rate));
  }
});
