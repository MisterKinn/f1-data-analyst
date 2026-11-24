import test from 'node:test';
import assert from 'node:assert/strict';
import {officialBests, lapCheck, trackOf} from '../scripts/sim/learn/wec-lap-sanity.mjs';

// invented laps
const bests = officialBests({
  realLaps: {laps: [{series: 'wec', season: 2024, track: 'le-mans', type: 'lmh', lap: 204.7}, {series: 'wec', season: 2024, track: 'le-mans', type: 'lmdh', lap: 204.4},
    {series: 'imsa', season: 2024, track: 'sebring', type: 'lmdh', lap: 100}]},
  calibration: {series: {wec: {lmgt3: {2025: {tracks: {lusail: {realLap: 113.9}}}}}}},
});

test('official best: Hypercar takes the faster of lmh / lmdh; IMSA rows ignored', () => {
  assert.equal(bests['2024|le-mans|HYPERCAR'], 204.4);
  assert.equal(bests['2025|lusail|LMGT3'], 113.9);
  assert.equal(bests['2024|sebring|HYPERCAR'], undefined);
});

test('lap check: 3 % band both ways, event names mapped to track ids', () => {
  assert.equal(trackOf('LOSAIL'), 'lusail'); assert.equal(trackOf('24 Hours of Le Mans'), 'le-mans'); assert.equal(trackOf('SAO PAULO'), 'interlagos'); assert.equal(trackOf('Lone Star Le Mans'), 'austin');
  assert.equal(lapCheck({event: 'LOSAIL', season: '2025', cls: 'LMGT3', best: 115}, bests), 'ok');
  assert.equal(lapCheck({event: 'LOSAIL', season: '2025', cls: 'LMGT3', best: 95.3}, bests), 'off -16.3 %'); // the merged-events bug
  assert.equal(lapCheck({event: 'LE MANS', season: '2024', cls: 'HYPERCAR', best: 212}, bests), 'off +3.7 %');
  assert.equal(lapCheck({event: 'IMOLA', season: '2025', cls: 'HYPERCAR', best: 90}, bests), 'no reference');
});

test('WEC event ids: short track ids, raw name kept when two events of a season would share one', async () => {
  const {wecEventIds} = await import('../scripts/sim/learn/wec-lap-sanity.mjs');
  assert.deepEqual(wecEventIds([
    {season: '2026', event: 'AUTODROMO NAZIONALE DI MONZA', venue: 'monza'}, {season: '2026', event: 'FUJI SPEEDWAY', venue: ''},
    {season: '2021', event: 'BAHRAIN INTERNATIONAL CIRCUIT 6 HOURS', venue: ''}, {season: '2021', event: 'BAHRAIN INTERNATIONAL CIRCUIT 8 HOURS', venue: ''},
  ]), ['monza', 'fuji', 'BAHRAIN INTERNATIONAL CIRCUIT 6 HOURS', 'BAHRAIN INTERNATIONAL CIRCUIT 8 HOURS']);
});
