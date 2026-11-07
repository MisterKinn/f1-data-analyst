import test from 'node:test';
import assert from 'node:assert/strict';
import {evolutionDelta, evolutionCurve, evolutionCoeffs, EVOLUTION_DEFAULTS} from '../worker/lapsim/evolution.js';

test('evolution: all inputs 0 leaves the lap unchanged', () => {
  for (const t of [0, 10, 60]) assert.equal(evolutionDelta({}, t, 3), 0);
  const c = evolutionCurve(80, {}, {to: 30});
  assert.ok(c.points.every(p => p.lap === 80));
});

test('evolution: rubber and drying make laps faster over the session, warm-up laps are slower', () => {
  const p = {...EVOLUTION_DEFAULTS.wec, session: 'qualifying', wetStart: 0.6, dryMin: 15, tyre: 'slick'};
  const c = evolutionCurve(100, p, {to: 60, step: 5});
  for (let i = 1; i < c.points.length; i++) assert.ok(c.points[i].lap < c.points[i - 1].lap);
  assert.ok(evolutionDelta(p, 30, 1) > evolutionDelta(p, 30, 3));
  // inters lose less than slicks on a wet track
  assert.ok(evolutionDelta({...p, tyre: 'inter'}, 0) < evolutionDelta(p, 0));
});

test('evolution: a measured curve replaces the formula', () => {
  const p = {curve: [[0, 0], [20, -0.5], [40, -0.8]]};
  assert.ok(Math.abs(evolutionDelta(p, 30) + 0.0065) < 1e-12);
  assert.equal(evolutionCoeffs('f1', 'no-such-track').basis !== 'track', true);
});

test('evolution: lapsim tool adds the block only when asked and keeps the lap result', async () => {
  const {simulate} = await import('../worker/lapsim/tool.js');
  const a = simulate({track: 'monza'});
  if (a.status !== 'ok') return; // track data not built in this checkout
  const b = simulate({track: 'monza', track_wetness_start: 0.6, drying_time_min: 15});
  assert.equal(a.evolution, undefined);
  assert.equal(b.result.lap_seconds, a.result.lap_seconds);
  assert.ok(b.evolution.curve[0].lap_s > b.evolution.curve.at(-1).lap_s);
});
