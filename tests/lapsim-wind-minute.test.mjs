// Step 12a wind diagnostic: helpers behave as the pre-registration says (claude/gate-wind-minute-prereg-2026-11-23.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {vecMean, residualise, slope, analyse, rng} from '../scripts/sim/wind-minute.mjs';

test('vector mean: opposite winds cancel, equal winds keep speed and direction', () => {
  assert.ok(vecMean([[2, 0], [2, 180]]).speed < 1e-9);
  const m = vecMean([[3, 90], [3, 90]]);
  assert.ok(Math.abs(m.speed - 3) < 1e-9 && Math.abs(m.from - 90) < 1e-9);
  assert.equal(vecMean([]), null);
});

// synthetic sessions: y = session + team + driver + trend·t + β·Δ + noise
function synth(beta, {sessions = 30, drivers = 20, noise = 0.05, seed = 3} = {}) {
  const R = rng(seed), rows = [];
  const drvPace = Array.from({length: drivers}, () => R() * 0.5), sess = Array.from({length: sessions}, () => 80 + R() * 20);
  for (let s = 0; s < sessions; s++) for (let d = 0; d < drivers; d++) {
    const t = R() * 60, delta = (R() - 0.5) * 0.2;
    rows.push({sess: 's' + s, team: 't' + (d >> 1), drv: 'd' + d, t, delta, y: sess[s] + drvPace[d] + 0.002 * s * t + beta * delta + noise * (R() - 0.5)});
  }
  return rows;
}

test('residualise removes session, team, driver and per-session time terms', () => {
  const rows = synth(0, {noise: 0});
  const e = residualise(rows, Float64Array.from(rows, r => r.y));
  assert.ok(Math.max(...e.map(Math.abs)) < 1e-6);
});

test('analyse recovers β = 1 and β = 0 and the shuffle test separates them', () => {
  const shuffle = (r, R) => (R() - 0.5) * 0.2;
  const one = analyse(synth(1), r => r.delta, {draws: 200, shuffle}), zero = analyse(synth(0, {seed: 5}), r => r.delta, {draws: 200, shuffle});
  assert.ok(Math.abs(one.beta - 1) < 0.1 && one.ci90[0] > 0.8 && one.pRand < 0.05 && one.r2phys > 0.5);
  assert.ok(zero.ci90[0] < 0 && zero.ci90[1] > 0 && zero.pRand > 0.05 && zero.r2phys < 0);
  assert.ok(Math.abs(slope([1, 2, 3], [1, 2, 3]) - 1) < 1e-12);
});
