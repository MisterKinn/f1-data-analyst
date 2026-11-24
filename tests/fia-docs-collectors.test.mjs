import test from 'node:test';
import assert from 'node:assert/strict';
import {straightMode, drsLegend} from '../scripts/sim/fia-docs/low-drag-zones.mjs';
import {turnsIn, typeOf} from '../scripts/sim/fia-docs/circuit-changes.mjs';
import {latest} from '../scripts/sim/fia-docs/wec-bop.mjs';
import {diffRows} from '../scripts/sim/fia-docs/lib.mjs';

// positioned items in the shape unpdf gives (x from the left, y from the top); short derived lines, not stored documents
const page = rows => ({items: rows.flatMap(([y, ...cells]) => cells.map(([x, s]) => ({s, x, y, w: 10, h: 8})))});

test('Straight Mode table: normal left of the zone, low right; one-sided n/a kept, both n/a skipped', () => {
  const z = straightMode(page([[764, [391, '50m after T14'], [447, '-'], [453, 'ZONE A1'], [486, '-'], [498, '100m after T14']],
    [785, [395, '35m after T8'], [446, '-'], [453, 'ZONE A4'], [486, '-'], [498, 'n/a']], [792, [427, 'n/a'], [446, '-'], [453, 'ZONE A5'], [486, '-'], [498, 'n/a']]]));
  assert.deepEqual(z.map(r => [r.zone, r.grip, r.start]), [['A1', 'normal', '50 m after T14'], ['A1', 'low', '100 m after T14'], ['A4', 'normal', '35 m after T8'], ['A4', 'low', 'N/A']]);
  assert.equal(z[0].ref, 'Start: T14. Fixed end: not found in published circuit map.');
});

test('DRS legend: an activation without its own detector uses the previous one', () => {
  const z = drsLegend(page([[699, [27, 'DRS Detection 1'], [119, '(15m after Turn 5)']], [710, [27, 'DRS Activation 1'], [119, '(95m after Turn 7)']],
    [723, [27, 'DRS Detection 2'], [119, '(110m after Turn 9)']], [733, [27, 'DRS Activation 2'], [119, '(155m before Turn 12)']], [747, [27, 'DRS Activation 3 (70m after Turn 14)']]]));
  assert.deepEqual(z, [{zone: '1', det: '15 m after Turn 5', act: '95 m after Turn 7'}, {zone: '2', det: '110 m after Turn 9', act: '155 m before Turn 12'},
    {zone: '3', det: '110 m after Turn 9', act: '70 m after Turn 14'}]);
});

test('circuit notes: turn lists and work types', () => {
  assert.deepEqual([...turnsIn('Between Turn 4 and Turn 5; T10 – T11; turns 18 or 19')].sort((a, b) => a - b), [4, 5, 10, 11, 18, 19]);
  assert.deepEqual([...turnsIn('Blue line added at the turns: 3 apex, 5 apex and exit.')].sort(), [3, 5]);
  assert.equal(typeOf('The longitudinal deterrent at the exit of T5 has been removed.'), 'kerb');
  assert.equal(typeOf('New debris fence at Turn 15.'), 'barrier');
  assert.equal(typeOf('Removal of bump between Turn 5 and Turn 6.'), 'resurfacing');
});

test('WEC BoP: a later decision replaces an earlier one for the same race and class', () => {
  const r = (d, event) => ({year: '2023', event, class: 'Hypercar', source_url: `https://x/wec_2023_d00${d}_hypercar_bop.pdf`});
  assert.deepEqual(latest([r(31, 'Spa'), r(31, 'Le Mans'), r(49, 'Le Mans')]).map(x => x.event + x.source_url.match(/d00(\d+)/)[1]), ['Spa31', 'Le Mans49']);
});

test('diffRows keeps duplicate keys apart and reports changed fields', () => {
  const d = diffRows([{k: 'a', v: '1'}, {k: 'a', v: '2'}], [{k: 'a', v: '1'}, {k: 'a', v: '3'}], r => r.k, ['v']);
  assert.deepEqual(d, [{kind: 'changed', key: 'a#2', fields: {v: ['2', '3']}}]);
});
