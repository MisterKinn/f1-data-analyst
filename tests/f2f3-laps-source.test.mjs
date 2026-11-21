import test from 'node:test';
import assert from 'node:assert/strict';
import {classificationRows, overallFastest, pickDocs, sessionOf, kindOf} from '../scripts/sim/learn/fetch-f2f3.mjs';

// a few rows in the layout the FIA reader returns for F2 classifications (derived test lines, not a stored document)
const race = `NO | DRIVER | NAT TEAM | LAPS | TIME | GAP | INT | KM/H | FASTEST | ON | PTS
1 | 1 | Rafael CAMARA | Invicta Racing | 29 | 59:57.958 | 174.074 | 1:56.056 | 17 | 25
17 | 11 | Sebastian MONTOYA | PREMA Racing | 29 | 1:01:15.126 | 77.168 | 32.195 | 170.419 | 1:55.494 | 29
NOT CLASSIFIED
23 | Rafael VILLAGOMEZ * | Van Amersfoort Racing | 16 | 35:55.572 | DNF | 160.223 | 1:56.887 | 13
25 | John BENNETT | TRIDENT | 0 | DNF
OVERALL FASTEST LAP
11 | Sebastian MONTOYA | PREMA Racing | 1:55.494 | on lap 29 | 187.116`;
const quali = `NO DRIVER | NAT TEAM | TIME | LAPS | % | GAP | INT | KM/H | TIME OF DAY
1 | 15 | Alexander DUNNE | Rodin Motorsport | 1:55.383 | 8 | 100.000 | 187.296 | 14:22:23
19 | 10 | Oliver GOETHE | MP Motorsport | 1:57.636 | 10 | 101.952 | 2.253 | 0.029 | 183.709 | 14:35:13`;

test('F2/F3 race classification: best lap, its lap, status; overall fastest matches', () => {
  const r = classificationRows(race, 'race');
  assert.equal(r.length, 4);
  assert.deepEqual(r[0], {pos: 1, car: '1', driver: 'Rafael CAMARA', team: 'Invicta Racing', laps: 29, best: 116.056, bestLap: 17, kph: 174.074, status: 'classified'});
  assert.equal(r[2].driver, 'Rafael VILLAGOMEZ'); assert.equal(r[2].status, 'DNF'); assert.equal(r[2].pos, null); assert.equal(r[2].best, 116.887);
  assert.equal(r[3].best, null); assert.equal(r[3].laps, 0);
  assert.equal(overallFastest(race), Math.min(...r.map(x => x.best).filter(Number.isFinite)));
});

test('F2/F3 qualifying classification: best lap, laps, speed (not the % column)', () => {
  const r = classificationRows(quali, 'qualifying');
  assert.deepEqual(r.map(x => [x.car, x.best, x.laps, x.kph]), [['15', 115.383, 8, 187.296], ['10', 117.636, 10, 183.709]]);
});

test('F2/F3 documents: newest version per session, no grids or championship tables', () => {
  assert.deepEqual(sessionOf('Doc 59 - F2 Qualifying 2 - final classification'), {session: 'Qualifying 2', version: 'final'});
  assert.equal(sessionOf('Doc 100 - F2 Driver Championship - Baku 2026'), null);
  assert.equal(sessionOf('Doc 91 - F2 Race 3 (Feature 2) - final grid'), null);
  const d = (n, title) => ({title, url: 'u' + n, document_number: String(n)});
  const picked = pickDocs([d(11, 'Doc 11 - F2 Practice - classification'), d(26, 'Doc 26 - F2 Practice - AMENDED classification'),
    d(28, 'Doc 28 - F2 Qualifying 2 - provisional classification'), d(59, 'Doc 59 - F2 Qualifying 2 - final classification')]);
  assert.deepEqual(picked.map(x => [x.session, x.url]), [['Practice', 'u26'], ['Qualifying 2', 'u59']]);
  assert.deepEqual(['Race 1 (Sprint)', 'Qualifying 1', 'Practice'].map(kindOf), ['race', 'qualifying', 'practice']);
});
