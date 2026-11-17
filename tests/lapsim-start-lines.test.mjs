// Start/finish lines from coordinates (scripts/sim/data/tracks/sf-lines.json, owner 2026-11-17): the extra-track build uses them,
// and the pit lane of each of these tracks spans the line (a pit straight).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../worker/lapsim/tracks.js';
import {lapsimPitLanes} from '../worker/lapsim/pit-lane-data.js';

test('start lines from coordinates: used by the build, pit lane spans the line', () => {
  const sf = JSON.parse(readFileSync('scripts/sim/data/tracks/sf-lines.json', 'utf8')).tracks;
  assert.ok(Object.keys(sf).length >= 8);
  for (const id of Object.keys(sf)) {
    const t = T[id]; assert.ok(t, id);
    assert.equal(t.quality.startVerified, true, `${id}: start verified`);
    assert.ok(t.quality.start.startsWith(sf[id].source), `${id}: start from sf-lines.json`);
    const p = lapsimPitLanes.tracks[id]; if (!p) continue;
    assert.ok(p.entryS > p.exitS, `${id}: pit lane entry ${p.entryS} m and exit ${p.exitS} m should span the line`);
  }
});
