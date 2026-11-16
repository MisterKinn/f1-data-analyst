// Pit lanes on the track maps (task A5): generated data is sane and the map draws it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimPitLanes} from '../worker/lapsim/pit-lane-data.js';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';
import {lineData, simulationPage} from '../worker/simulation.js';

test('pit lanes: ends on the lap, length matches the path, plausible length', () => {
  const T = lapsimPitLanes.tracks; assert.ok(Object.keys(T).length >= 60);
  for (const [id, p] of Object.entries(T)) {
    const len = lapsimAllTracks[id]?.length; assert.ok(len, `${id}: not a simulator track`);
    assert.ok(p.entryS >= 0 && p.entryS < len && p.exitS >= 0 && p.exitS < len, `${id}: entry/exit off the lap`);
    assert.ok(p.lengthM >= 150 && p.lengthM <= 2500, `${id}: length ${p.lengthM}`);
    const path = p.pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p.pts[i][0], q[1] - p.pts[i][1]), 0);
    assert.ok(Math.abs(path - p.lengthM) / p.lengthM < 0.05, `${id}: path ${path.toFixed(0)} m vs ${p.lengthM} m`);
    const M = lineData(id).mid, near = q => Math.min(...M.map(m => Math.hypot(m[0] - q[0], m[1] - q[1])));
    assert.ok(near(p.pts[0]) <= 35 && near(p.pts.at(-1)) <= 35, `${id}: pit lane ends away from the track`);
  }
});

test('pit lanes: the map draws the pit lane under the track band', () => {
  const html = simulationPage({track: 'monza'}, 'en');
  assert.ok(html.includes('"pit":{"entryS"'), 'pit data embedded for the selected track');
  assert.ok(html.includes('.ls-pit{'), 'pit style present');
});
