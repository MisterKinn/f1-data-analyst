import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTrackChanges} from '../worker/lapsim/track-changes.js';
import {lapsimTrackChanges} from '../worker/lapsim/track-changes-data.js';

test('the Race Director signature name is not read as a circuit change', () => {
  for (const name of ['Rui Marques', 'R ui Marques']) {
    const doc = `19. | Changes to the circuit\n- | Pit exit white line shortened (finish in the Safety Car line 2).\n${name}\nRace Director\n20. | Free Practice`;
    const {changes} = parseTrackChanges(doc);
    assert.deepEqual(changes.map(c => c.text), ['Pit exit white line shortened (finish in the Safety Car line 2).']);
  }
  const doc = '19. | Changes to the circuit\n- | New kerb at Turn 4 exit,\nextended by 10 m.\n20. | Free Practice';
  assert.equal(parseTrackChanges(doc).changes.length, 1, 'normal continuation lines still join the item');
  const names = Object.values(lapsimTrackChanges).flatMap(y => Object.values(y)).flatMap(e => e.changes || []).filter(c => /Marques/.test(c.text));
  assert.deepEqual(names, [], 'stored data has no signature lines');
});
