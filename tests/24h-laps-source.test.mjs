import test from 'node:test';
import assert from 'node:assert/strict';
import {laps, lapTimes, resultRows, carRows, sessionKind} from '../scripts/sim/learn/fetch-24h.mjs';

// short derived lines in the pdftotext -layout shape of the Time Service PDFs (odd gaps included), not stored documents
const lapText = `   Nbr    Team name                                                Laps                 Car
               Driver               Lap          1            2       3
      11 H OFOR Racing                                           6 Laps              Merc edes-AMG GT3 EVO
        Alexander P rinz             1 - 3     1: 41.6 19   1: 36.1 47   1: 35.5 98

          Chantal P rinz             4 - 6     1: 38.5 24   1: 33.3 51   5: 42.1 49`;
const race = `                Cls   S.Cls                                                                                                                Fastest Laptime Race Time
Pos Nbr         PIC   PISC Team name / Official Entrant                    Car / Drivers                      Gap                Diff        Km/h     In     Km/h
  6    11     GT3       AM     HOFOR Rac ing                               Mercedes-AMG GT3 EVO           -- 41 0 laps --        54.690     1:33.3 51    56   12:01:13.148
               6         2     HOFOR Rac ing                               Kroll-P rinz-P rinz-P artl                                       162 .97              144 .14
  7 925       992              Van Berlo Motorsport by Bas Koeten Racing                            -- 40 4 laps --
                                                                           Por sche 9 11 GT3 Cup ( 992)                       10 :32.224    1:35.5 44   210   12:02:05.659`;

test('24H: lap times with stray spaces; race time is not a lap', () => {
  assert.deepEqual(laps('1: 36.1 47   1:33.5 09   10 :32.224   12:00:26.787'), [96.147, 93.509, 632.224]);
});

test('24H: every lap per driver from the lap-time file', () => {
  const [c] = lapTimes(lapText);
  assert.equal(c.car, '11'); assert.equal(c.lapsListed, 6); assert.equal(c.laps.length, 6);
  assert.deepEqual(c.laps.map(l => l.lap), [1, 2, 3, 4, 5, 6]);
  assert.equal(c.laps[4].driver, 'Chantal P rinz'); assert.equal(c.laps[4].t, 93.351);
});

test('24H: race result fastest lap is the time under the Fastest header, also when it wraps to the next line', () => {
  const r = resultRows(race, 'race');
  assert.equal(r.get('11').fastest, 93.351); assert.equal(r.get('11').cls, 'GT3');
  assert.equal(r.get('925').fastest, 95.544);
  const [row] = carRows(lapText, race, 'race');
  assert.equal(row.best, row.officialBest); assert.equal(row.lapBest, 93.351); assert.equal(row.deleted, 0); assert.equal(row.laps, 6); assert.equal(row.cleanLaps, 4);  // 101.6 and the 5:42 in-lap are over 107% of 93.351
  assert.deepEqual(['Race', 'Qualifying 1 - Classes GT3', 'Free Practice'].map(sessionKind), ['race', 'qualifying', 'practice']);
});

test('24H: laps quicker than the official fastest are deleted laps and dropped', () => {
  const quicker = lapText.replace('1: 36.1 47', '1: 30.0 00');
  const [row] = carRows(quicker, race, 'race');
  assert.equal(row.best, 93.351); assert.equal(row.deleted, 1); assert.equal(row.lapBest, 93.351); assert.equal(row.laps, 6);
});

test('24H: a column digit next to a time is not part of its minutes; misread official times are not used', () => {
  assert.deepEqual(laps('   2 2:02.7 88   '), [122.788]);
  const wrong = race.replace('1:33.3 51    56', '1:33.3 51    56').replace('54.690     1:33.3 51', '54.690     13:33.3 51');
  const [row] = carRows(lapText, wrong, 'race');
  assert.equal(row.officialBest, null); assert.equal(row.best, 93.351); assert.equal(row.deleted, 0);
});
