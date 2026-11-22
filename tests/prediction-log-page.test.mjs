import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage} from '../worker/simulation.js';
import {lapsimPredictionLog} from '../worker/lapsim/prediction-log-data.js';

test('the page carries the prediction-log summary and labels it in both languages', () => {
  for (const lang of ['en', 'ko']) {
    const d = JSON.parse(simulationPage({track: 'monza', car: '2026'}, lang).match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(d.fwdLog, lapsimPredictionLog.cars);
    assert.ok(d.t.fwdLog && d.t.fwdNone && d.t.fwdN && d.t.fwdWait);
  }
  for (const c of Object.values(lapsimPredictionLog.cars)) assert.ok(c.n === 0 ? c.rmsPct === null : c.rmsPct >= 0);
});
