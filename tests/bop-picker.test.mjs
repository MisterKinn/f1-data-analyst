import test from 'node:test';
import assert from 'node:assert/strict';
import {bopPage} from '../worker/bop-page.js';

const current = h => [...h.matchAll(/aria-current="page">([^<]*)/g)].map(m => m[1]);

test('BoP picker: Series → Class → Year → Event, with safe defaults', () => {
  assert.deepEqual(current(bopPage({}, 'en')), ['FIA WEC', 'Hypercar', '2026', '6 Hours of Imola']);
  assert.deepEqual(current(bopPage({series: 'nope', class: 'x', year: '1990', event: '<b>'}, 'en')), ['FIA WEC', 'Hypercar', '2026', '6 Hours of Imola']);
  assert.deepEqual(current(bopPage({event: 'spa'}, 'en')).at(-1), '6 Hours of Spa');
  const p = bopPage({year: '2027'}, 'en');
  assert.deepEqual(current(p).slice(2), ['2027 (projection)', 'Qatar 1812km']);
  assert.match(p, /2027 BoP projection/);
  assert.doesNotMatch(p, /id="bop-csv"/, '2027 shows the projection, not the 2026 table');
  // every chip link carries the full selection
  for (const m of p.matchAll(/href="(\/bop\?[^"]+)"/g)) assert.match(m[1].replace(/&amp;/g, '&'), /^\/bop\?series=\w+&class=\w+&year=\d{4}&event=[a-z]+$/);
});
