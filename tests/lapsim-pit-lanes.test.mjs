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

test('pit data: documented limit per series and the measured F1 pit loss, never a simulated one (the note above the map is gone, owner 2026-11-17)', async () => {
  const {lapsimPitSpeed} = await import('../worker/lapsim/pit-speed-data.js');
  assert.equal(lapsimPitSpeed.series.f1.kph, 80); assert.equal(lapsimPitSpeed.series.wec.kph, 60); assert.equal(lapsimPitSpeed.series.imsa.kph, 60);
  for (const s of Object.values(lapsimPitSpeed.series)) assert.ok(s.src);
  const html = simulationPage({track: 'monza'}, 'en');
  assert.match(html, /"pitLossF1":25\.6875\b/); // W3-F measured stops 2022–25 (10+ stops each), pooled
});

test('two pit lanes (owner 2026-11-17): Spa F1 pits for F1/WEC, Endurance pits for GT3 too; Silverstone Wing for F1, National for others', () => {
  const T = lapsimPitLanes.tracks, spa = T['spa-francorchamps'], sil = T.silverstone, L = id => lapsimAllTracks[id].length;
  assert.ok(spa.entryS > L('spa-francorchamps') - 400 && spa.exitS < 700, 'Spa main lane: Bus Stop to La Source');
  assert.equal(spa.alt.name, 'Endurance pits'); assert.ok(spa.alt.entryS > 300 && spa.alt.entryS < 600);
  assert.deepEqual(spa.alt.use, {gt3: 'both'});
  assert.ok(sil.entryS > 4900 && sil.exitS < 900, 'Silverstone main lane: Wing');
  assert.equal(sil.alt.name, 'National pits'); assert.ok(sil.alt.entryS > 2100 && sil.alt.exitS < 3600);
  assert.deepEqual(sil.alt.use, {wec: 'alt', gt3: 'alt'});
  for (const id of ['spa-francorchamps', 'silverstone']) {
    const a = T[id].alt, M = lineData(id).mid, near = q => Math.min(...M.map(m => Math.hypot(m[0] - q[0], m[1] - q[1])));
    assert.ok(near(a.pts[0]) <= 35 && near(a.pts.at(-1)) <= 35, `${id}: second pit lane ends away from the track`);
  }
  const html = simulationPage({track: 'spa-francorchamps'}, 'en');
  assert.ok(html.includes('"alt":{"name":"Endurance pits"'), 'second lane embedded');
});
