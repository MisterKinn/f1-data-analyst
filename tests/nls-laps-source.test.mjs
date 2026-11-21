import test from 'node:test';
import assert from 'node:assert/strict';
import {lapByLap, results, carRows} from '../scripts/sim/learn/fetch-nls.mjs';

// short derived lines in the pdftotext -layout shape of the wige SOLUTIONS PDFs, not stored documents
const quali = ` Pl.   Nr.       Kl. Fahrzeug / Bewerber / Sponsor                                  Lizenznummer      Rd.     Bestzeit               Schnitt
  1     47   SP9 PRO
                          Mercedes-AMG GT3                                                                8   7:52.393             185.627
                          Kobayashi Kamui, Japan                                  MC-05980921100
             SP9 PRO-AM
  3     33                Audi R8 GT3 EVO II                                                              4   7:57.634
                           B:KKraemer Racing                                                 67960                        05.241`;
const race = `  5   75       AT 1      Audi R8 LMS GT3 EVO II                                                   28   4:09:55.611   1:47.295 163.734   8:06.060    22
                         B:Max Kruse Racing                                           42051                            21.620         180.407`;
const laps = `  No Entrant                                              Driver
   47 KCMG                                                Kobayashi(1) / 'Jesse Krohn'(2) / Liberati(3) / Pittard(4)
   7:59.167 1(4)     7:52.393   2(4)    8:28.095   3(3)    7:50.000 4(3)
   33 KKraemer Racing                                     Vazquez-Garcia(1) / Leib(2) / di Martino(3)
   8:10.337 1(3)  7:57.634      2(3)    8:52.674   3(2)    8:13.906 4(2)`;

test('NLS lap by lap: every lap with its driver', () => {
  const [a, b] = lapByLap(laps);
  assert.equal(a.car, '47'); assert.equal(a.team, 'KCMG'); assert.equal(a.laps.length, 4);
  assert.deepEqual(a.laps[1], {lap: 2, t: 472.393, driver: 'Pittard'});
  assert.equal(b.laps.length, 4); assert.equal(b.drivers['2'], 'Leib');
});

test('NLS results: class on its own line or before the car; the race fastest is the last m:ss.sss (not h:mm:ss)', () => {
  const q = results(quali);
  assert.deepEqual(q.get('47'), {pos: 1, cls: 'SP9 PRO', model: 'Mercedes-AMG GT3', best: 472.393});
  assert.deepEqual(q.get('33'), {pos: 3, cls: 'SP9 PRO-AM', model: 'Audi R8 GT3 EVO II', best: 477.634});
  assert.deepEqual(results(race).get('75'), {pos: 5, cls: 'AT 1', model: 'Audi R8 LMS GT3 EVO II', best: 486.06});
});

test('NLS rows: official best is the authority, quicker listed laps are deleted laps', () => {
  const rows = carRows(laps, quali), a = rows.find(r => r.car === '47'), b = rows.find(r => r.car === '33');
  assert.equal(a.best, 472.393); assert.equal(a.deleted, 1); assert.equal(a.lapBest, 472.393); assert.equal(a.cls, 'SP9 PRO');
  assert.equal(b.best, 477.634); assert.equal(b.deleted, 0); assert.equal(b.officialBest, b.lapBest);
});
