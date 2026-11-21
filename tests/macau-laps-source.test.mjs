import test from 'node:test';
import assert from 'node:assert/strict';
import {itsRows, overallBest, kindOf} from '../scripts/sim/learn/fetch-macau.mjs';

// lines in the pdftotext -layout shape of the ITS-events classifications (derived, shortened)
const practice = `      #          DRIVER                       TEAM                                   CAR                      LAPS       BEST LAP   On lap    GAP 1st   GAP Prev   Avg. SPD
1    8           Laurin HEINRICH              AO BY ABSOLUTE                         911 GT3 R (992) (Evo)     13    02:15.632       13          -         -        162.4
2    32          Raffaele MARCIELLO           TEAM WRT                               M4 GT3 (Evo)              11    02:15.811       11       00.179     00.179     162.2
                                                 Best time Overall : 02:15.632 (162.4 km/h), (No. 8) Laurin HEINRICH`;
const race = `      #        DRIVER                       Cat     Pos Cat COMPETITOR                     CAR                     LAPS   TOTAL TIME   GAP 1st   GAP Prev    BEST LAP    On lap   Avg. SPD
 7   31        Kelvin VAN DER LINDE Platinum 6             TEAM WRT                        M4 GT3 (Evo)             12    27:36.839    16.775     00.485     02:16.794    11       161.0
18   76        Adderly FONG                Silver     2    Craft-Bamboo Racing             AMG GT3 (Evo)            1     02:42.141    11 Lp.      5 Lp.                   0        0.0`;

test('Macau ITS classifications: practice row and overall best line', () => {
  const r = itsRows(practice);
  assert.deepEqual(r[0], {pos: 1, car: '8', driver: 'Laurin HEINRICH', team: 'AO BY ABSOLUTE', model: '911 GT3 R (992) (Evo)', laps: 13, best: 135.632, bestLap: 13});
  assert.deepEqual(overallBest(practice), {best: 135.632, car: '8'});
});

test('Macau ITS classifications: race rows with category columns, a driver cell merged with its category, no best lap', () => {
  const [a, b] = itsRows(race);
  assert.deepEqual(a, {pos: 7, car: '31', driver: 'Kelvin VAN DER LINDE', team: 'TEAM WRT', model: 'M4 GT3 (Evo)', laps: 12, best: 136.794, bestLap: 11});
  assert.equal(b.car, '76'); assert.equal(b.laps, 1); assert.equal(b.best, null);
  assert.deepEqual(['Qualification Race', 'Qualifying 1', 'Free Practice 1'].map(kindOf), ['race', 'qualifying', 'practice']);
});
