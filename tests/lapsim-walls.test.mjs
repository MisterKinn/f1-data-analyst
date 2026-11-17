import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimWalls} from '../worker/lapsim/walls-data.js';
import {lineData, simulationPage} from '../worker/simulation.js';

// owner 2026-11-18: "model the walls and barriers of every circuit, above all street circuits (Monaco, Singapore, Las Vegas, Long Beach)
// and close-wall tracks (Bathurst), and Daytona, Indianapolis, Watkins Glen" — from OpenStreetMap barrier ways.
const W = lapsimWalls.tracks;

test('walls: per-point gaps line up with the drawn line, kinds are known, map lines sit beside the track', () => {
  for (const [id, w] of Object.entries(W)) {
    const L = lineData(id); assert.ok(L, `${id}: no line`);
    const n = Math.ceil(L.mid.length / w.step);
    assert.equal(w.left.length, n, `${id} left`); assert.equal(w.right.length, n, `${id} right`);
    for (const k of [...w.kindLeft, ...w.kindRight]) assert.ok(k === null || ['wall', 'armco', 'tyres', 'fence', 'street'].includes(k), `${id}: ${k}`);
    for (const g of [...w.left, ...w.right]) assert.ok(g === null || (g >= 0 && g <= 40), `${id}: gap ${g}`);
    assert.ok(w.poseM <= 4, `${id}: pose ${w.poseM} m`);
  }
});

test('walls: street circuits have a barrier on both sides all lap; Bathurst, Indianapolis, Daytona, Watkins Glen have OSM barriers', () => {
  for (const id of ['monte-carlo', 'singapore', 'las-vegas', 'long-beach', 'baku', 'jeddah', 'macau']) {
    assert.ok(W[id], `${id} missing`);
    assert.ok(W[id].left.every(g => g !== null && g <= 15) && W[id].right.every(g => g !== null && g <= 15), `${id}: open side`);
  }
  for (const id of ['bathurst', 'indianapolis', 'daytona', 'watkins-glen']) {
    assert.ok(W[id]?.lines.length >= 10, `${id}: ${W[id]?.lines.length} lines`);
    assert.ok(W[id].left.filter(g => g !== null).length / W[id].left.length > 0.2, `${id}: left coverage`);
  }
  // Bathurst: the walls on the mountain (Skyline to the Dipper) are close, the barrier is within 3 m of the edge on a good part of the lap
  const near = W.bathurst.left.filter((g, i) => (g !== null && g < 3) || (W.bathurst.right[i] !== null && W.bathurst.right[i] < 3)).length;
  assert.ok(near / W.bathurst.left.length > 0.3, `bathurst near ${near}`);
});

test('walls are drawn on the track map (OSM lines and the street rule at the road edge)', () => {
  const mc = simulationPage({track: 'monte-carlo'}, 'en'), ba = simulationPage({track: 'bathurst'}, 'en');
  assert.match(mc, /ls-wall ls-wall-street/);
  assert.match(ba, /ls-wall ls-wall-(wall|armco)/);
  assert.match(simulationPage({track: 'monza'}, 'ko'), /class="ls-map/);
});
