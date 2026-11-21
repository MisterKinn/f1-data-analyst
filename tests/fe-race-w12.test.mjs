import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimFeRace as R} from '../worker/lapsim/fe-race-data.js';
import {simulationPage} from '../worker/simulation.js';

test('FE race pace: measured Gen3 Evo lookups and the Gen4 Monaco estimate with its range (W12)', () => {
  assert.deepEqual(R['monte-carlo'].gen4, {ratio: [1.0425, 1.0986, 1.1553], amS: [-5.43, -0.17, 4.97]});
  assert.equal(R['monte-carlo'].ratio.events.length, 3);
  const en = simulationPage({track: 'monte-carlo'}, 'en');
  assert.match(en, /Gen4 estimate \(model, no Gen4 lap yet\): race ÷ pole <span data-no-translate>1\.099<\/span> \(range 1\.042–1\.155\)/);
  assert.match(simulationPage({track: 'monte-carlo'}, 'ko'), /포뮬러 E 레이스 페이스/);
  assert.doesNotMatch(simulationPage({track: 'monza'}, 'en'), /Formula E race pace/);
});
