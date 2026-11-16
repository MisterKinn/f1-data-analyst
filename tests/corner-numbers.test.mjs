import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimCornerNumbers} from '../worker/lapsim/corner-numbers-data.js';

const counts = JSON.parse(readFileSync(new URL('../scripts/sim/data/tracks/corner-counts.json', import.meta.url)));
const official = counts.tracks || counts;

test('map-placed corner numbers: official count, each number once, in lap order', () => {
  for (const [id, {corners}] of Object.entries(lapsimCornerNumbers)) {
    assert.equal(corners.length, official[id]?.turns, id);
    assert.deepEqual(new Set(corners.map(c => c.number)).size, corners.length, id);
    for (let i = 1; i < corners.length; i++) assert.ok(corners[i].s > corners[i - 1].s, `${id} s order`);
    const nums = corners.map(c => c.number), k = nums.indexOf(1), rot = [...nums.slice(k), ...nums.slice(0, k)];
    assert.deepEqual(rot, [...rot].sort((a, b) => a - b), `${id} numbers run round the lap`);
  }
});
