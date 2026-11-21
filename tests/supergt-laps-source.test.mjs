import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionRows, lapTime, kindOf} from '../scripts/sim/learn/fetch-supergt.mjs';

// table rows in the shape of supergt.net/en/result (derived, shortened)
const quali = `<table class="common races"> <tr> <th>Po</th> <th>No.</th> <th>Machine</th> <th>Driver</th> <th>Best Time</th> <th>Diff.</th> <th>Laps</th> <th>Tire</th> <th>SW</th> </tr>
<tr> <td>1</td> <td><span class="bib gt300">61</span></td> <td> <a href="#"> <dl class="team_machine"> <dt>Team</dt> <dd>R&#038;D SPORT</dd> <dt>Machine</dt> <dd>SUBARU BRZ R&amp;D SPORT</dd> <dd class="no_colon">(SUBARU BRZ GT300)</dd> </dl> </a> </td>
 <td> <p><a href="#">Takuto Iguchi</a></p> <p><a href="#">Hideki Yamauchi</a></p> </td> <td> 1'43.012<br> 1'42.677<br> </td> <td> </td> <td> 3/4<br> </td> <td> <img src="x.svg" alt="dunlop"> </td> <td>34</td> </tr></table>`;
const race = `<table class="common races"> <tr> <th>Po</th> <th>No.</th> <th>Machine</th> <th>Driver</th> <th>Laps</th> <th>Best Lap</th> <th>Diff.</th> <th>Tire</th> <th>SW</th> </tr>
<tr> <td>1</td> <td><span class="bib gt500">100</span></td> <td> <dl class="team_machine"> <dt>Team</dt> <dd>STANLEY TEAM KUNIMITSU</dd> <dt>Machine</dt> <dd>STANLEY HRC PRELUDE-GT</dd> </dl> </td>
 <td> <p><a href="#">Naoki Yamamoto</a></p> <p><a href="#">Tadasuke Makino</a></p> </td> <td>98</td> <td>1'37.763</td> <td></td> <td> <img src="x.svg" alt="bridgestone"> </td> <td>76</td> </tr></table>`;

test('SUPER GT: qualifying keeps the quicker driver time and both; columns found by header', () => {
  const [r] = sessionRows(quali);
  assert.equal(r.car, '61'); assert.equal(r.team, 'R&D SPORT'); assert.equal(r.model, 'SUBARU BRZ GT300');
  assert.equal(r.best, 102.677); assert.deepEqual(r.driverTimes, [103.012, 102.677]); assert.equal(r.laps, 3);
  assert.equal(r.tyre, 'dunlop'); assert.equal(r.successWeightKg, 34); assert.deepEqual(r.drivers, ['Takuto Iguchi', 'Hideki Yamauchi']);
});

test('SUPER GT: race row (laps before best lap)', () => {
  const [r] = sessionRows(race);
  assert.equal(r.best, 97.763); assert.equal(r.laps, 98); assert.equal(r.machine, 'STANLEY HRC PRELUDE-GT'); assert.equal(r.model, null); assert.equal(r.successWeightKg, 76);
  assert.equal(lapTime("1'42.677"), 102.677); assert.deepEqual(['Race', 'Qualifying（Q1）', 'Practice'].map(kindOf), ['race', 'qualifying', 'practice']);
});
