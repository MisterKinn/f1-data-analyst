import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage} from '../worker/simulation.js';
import {viewHash, canonJson, viewBuildKey, firstViewState, carStartOptions} from '../worker/lapsim/view-keys.js';

// first-view job (owner 2026-11-18): stored views are keyed by build (script version + page data without carId) and state
const dataText = (q, lang = 'en') => simulationPage(q, lang).match(/<script type="application\/json" id="lapsim-data">([\s\S]*?)<\/script>/)[1];

test('build key: the car in the URL does not change it, the language does', () => {
  const a = dataText({track: 'monza'}), b = dataText({track: 'monza', car: '2025'}), c = dataText({track: 'monza'}, 'ko');
  assert.equal(viewBuildKey('v1', a), viewBuildKey('v1', b));
  assert.notEqual(viewBuildKey('v1', a), viewBuildKey('v1', c));
  assert.notEqual(viewBuildKey('v1', a), viewBuildKey('v2', a));
});

test('state key: same state in any key order gives the same text; the start options follow the real qualifying', () => {
  const d = JSON.parse(dataText({track: 'interlagos'}));
  const s = firstViewState(d, '2026'), t = Object.fromEntries(Object.entries(s).reverse());
  assert.equal(canonJson(s), canonJson(t)); assert.equal(viewHash(canonJson(s)), viewHash(canonJson(t)));
  assert.deepEqual(Object.keys(carStartOptions(d, '2026')).sort(), ['drs', 'ot', 'sm']);
  assert.equal(s.optCar, '2026'); assert.equal(firstViewState(d, 'wec-lmh').sm, 'normal');
});
