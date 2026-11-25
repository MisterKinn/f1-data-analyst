import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {brakeZones} from '../worker/lapsim/brakes.js';
import {driveEnergyJ} from '../worker/lapsim/stint-energy.js';

// ASSUMED synthetic fixtures: these are arithmetic checks, not measured car data.
const car = {mass: 1000, cdA: 1.6, clA: 4, cdALow: 0.8, clALow: 2,
  rearWeight: 0.5, rearAero: 0.6, cRoll: 0.012};
const speed = [80, 76, 72, 68, 64, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60];
const limit = speed.map((_, i) => i < 5 ? 3 : 2);
const env = {rho: 1.2};
const track = share => ({ds: 10, aeroLow: new Array(speed.length).fill(share)});
const effective = share => ({...car, cdA: 1.6 + share * (0.8 - 1.6), clA: 4 + share * (2 - 4)});
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('binary and absent aero preserve the pre-fix outputs exactly', () => {
  // Golden outputs captured from ce99c9ada5fdc42ef42ec6703cdb93cae0383710.
  const goldens = [
    ['d0b28b904ad0a44e0b617e3a808f14fb9df62b23321dcf87e8589fc6d86a7216', 1890916.4],
    ['d0b28b904ad0a44e0b617e3a808f14fb9df62b23321dcf87e8589fc6d86a7216', 1890916.4],
    ['e53181ae45985c8d3a4008b5c771e76fe6bfd1c231251f38855036386df2ca16', 1653110],
    ['9f85e9731c9003502c2a6ff85a9758c305d65d1c376fc585377bf918bec1ae53', 1759900.4]
  ];
  for (const [i, t] of [{ds: 10}, track(0), track(1), {ds: 10, aeroLow: speed.map((_, i) => i % 2)}].entries()) {
    assert.equal(createHash('sha256').update(JSON.stringify(brakeZones(t, car, env, speed, limit))).digest('hex'), goldens[i][0]);
    assert.equal(driveEnergyJ(t, car, env, speed), goldens[i][1]);
  }
});

for (const share of [0.25, 0.5, 0.75]) {
  test(`partial aero ${share}: braking agrees with effective coefficients`, () => {
    const t = track(share), before = structuredClone({t, car, speed, limit});
    const actual = brakeZones(t, car, env, speed, limit);
    const expected = brakeZones({ds: 10}, effective(share), env, speed, limit);
    close(actual.energy.dragKWh, expected.energy.dragKWh);
    close(actual.energy.frictionKWh, expected.energy.frictionKWh);
    close(actual.energy.frontPct, expected.energy.frontPct);
    assert.deepEqual(actual.zones, expected.zones);
    assert.deepEqual({t, car, speed, limit}, before);
    const browserFn = new Function(`return (${brakeZones.toString()})`)();
    assert.deepEqual(browserFn(t, car, env, speed, limit), actual);
  });
  test(`partial aero ${share}: drive energy agrees with analytic flat-loop work`, () => {
    const t = track(share), v = speed.map(() => 50), c = effective(share);
    const expected = (0.5 * env.rho * c.cdA * 50 ** 2
      + car.cRoll * (car.mass * 9.81 + 0.5 * env.rho * c.clA * 50 ** 2)) * t.ds * v.length;
    close(driveEnergyJ(t, car, env, v), expected);
  });
}

test('shares clamp to 0..1; missing values and missing low coefficients keep normal aero', () => {
  for (const [input, normalized] of [[-1, 0], [2, 1], [undefined, 0], [NaN, 0]]) {
    const t = track(input), expectedTrack = track(normalized);
    assert.deepEqual(brakeZones(t, car, env, speed, limit), brakeZones(expectedTrack, car, env, speed, limit));
    assert.equal(driveEnergyJ(t, car, env, speed), driveEnergyJ(expectedTrack, car, env, speed));
  }
  const {cdALow, clALow, ...normalCar} = car;
  for (const share of [0, 0.25, 1]) {
    assert.deepEqual(brakeZones(track(share), normalCar, env, speed, limit), brakeZones({ds: 10}, normalCar, env, speed, limit));
    assert.equal(driveEnergyJ(track(share), normalCar, env, speed), driveEnergyJ({ds: 10}, normalCar, env, speed));
  }
});
