import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimPitSpeed, pitSpeedKph} from '../worker/lapsim/pit-speed-data.js';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';

test('pit speed: every event value is a known track with a source per season (A2, RD event notes)', () => {
  for (const [id, t] of Object.entries(lapsimPitSpeed.tracks)) {
    assert.ok(lapsimAllTracks[id], id);
    const e = t.f1; assert.ok(e.kph > 0 && e.kph < 80, id);
    for (const y of e.years) assert.match(e.src[y], /^https:\/\/www\.fia\.com\/.+\.pdf$/, `${id} ${y}`);
    assert.deepEqual(Object.keys(e.src).map(Number).sort(), [...e.years].sort(), id);
    for (const [y, ss] of Object.entries(e.sessions || {})) { assert.ok(e.years.includes(Number(y)), id + ' ' + y); for (const k of Object.values(ss)) assert.ok(k > 0, id); }
  }
});

// G2 (2026-11-18): the 12 races 2022–2026 at 60 km/h replay exactly; every other held race is 80 by rule
test('pit speed: G2 race limits replay exactly', () => {
  const at60 = {'monte-carlo': [2022, 2023, 2024, 2025, 2026], 'paul-ricard-f1': [2022], singapore: [2022, 2023, 2024], zandvoort: [2022, 2023, 2024]};
  for (const [id, ys] of Object.entries(at60)) for (let y = 2022; y <= 2026; y++) assert.equal(pitSpeedKph('f1', id, y), ys.includes(y) ? 60 : 80, `${id} ${y}`);
  assert.equal(Object.values(at60).flat().length, 12);
  assert.equal(pitSpeedKph('f1', 'monte-carlo', 2023, 'FP1'), 80, 'Monaco 2023 V3 came after FP1');
  assert.equal(pitSpeedKph('f1', 'monte-carlo', 2023, 'Q'), 60);
  assert.equal(pitSpeedKph('f1', 'melbourne', 2024), 80);
  assert.equal(pitSpeedKph('f1', 'zandvoort'), 80, 'no season: series rule');
  assert.equal(pitSpeedKph('wec', 'zandvoort', 2024), 60);
});
