import test from 'node:test';
import assert from 'node:assert/strict';
import {setupPlan, setupTracks, GT3_MODELS, LMP2, SPLIT} from '../worker/lapsim/setup-plan.js';
import {setupPage} from '../worker/setup-page.js';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';

const strip = h => h.replace(/<script[\s\S]*?<\/script>/g, '');

test('SetupSim lists every simulator circuit, not only raced ones (owner 2026-11-16)', () => {
  for (const kind of ['f1', 'hypercar', 'gt3', 'lmp2']) assert.equal(Object.keys(setupTracks(kind)).length, Object.keys(lapsimAllTracks).length, kind);
});

test('GT3 per car model and LMP2 Oreca 07 Gibson only', () => {
  assert.ok(GT3_MODELS.length > 20 && GT3_MODELS.every(m => m.car.startsWith('gt3-') && !/^gt3-(imsa|aco|dtm)-/.test(m.car)));
  assert.equal(LMP2.name, 'Oreca 07 Gibson');
  const g = setupPlan('spa-francorchamps', 'gt3:ferrari-296-gt3'), p = setupPlan('spa-francorchamps', 'lmp2:oreca-07');
  assert.ok(g.knobs.tc && !p.knobs.tc, 'LMGT3 has traction control (TR 8.1); LMP2 has no TC knob');
  assert.ok(p.aero.lap > 0 && g.aero.lap > p.aero.lap, 'GT3 slower than LMP2');
});

test('race set-up differs from qualifying (more fuel, worn tyres); F1 has one set-up (parc fermé)', () => {
  const q = setupPlan('lusail', 'hyper:toyota', {phase: 'quali'}), r = setupPlan('lusail', 'hyper:toyota', {phase: 'race'});
  assert.ok(r.aero.lap > q.aero.lap && r.knobs.camber.p < q.knobs.camber.p && r.knobs.brakeCooling.p > q.knobs.brakeCooling.p);
  assert.equal(setupPlan('monza', 'f1-2026:mclaren', {phase: 'race'}).phase, 'quali');
  assert.ok(SPLIT.wec && SPLIT.imsa && !SPLIT.gtwc && !SPLIT.dtm && !SPLIT.f1);
});

test('the latest session of an event replaces the history weather', () => {
  const live = {session: 'Free Practice 2', at: '2026-11-14T10:00:00Z', weather: {airTempC: 12, trackTempC: 15, humidityPct: 80}};
  const p = setupPlan('lusail', 'hyper:toyota', {live});
  assert.equal(p.source.src, 'live'); assert.equal(p.weather.trackTempC, 15);
  assert.match(strip(setupPage({series: 'hypercar', track: 'lusail'}, 'en', live)), /Event in progress/);
});

test('pages render for every new series without undefined or NaN', () => {
  for (const q of [{series: 'gt3', car: 'bmw-m4-gt3', track: 'nurburgring-24h'}, {series: 'gt3', car: 'porsche-911-gt3-r-992', track: 'macau', phase: 'race'},
    {series: 'lmp2', track: 'le-mans', phase: 'race'}, {series: 'lmp2', track: 'yeongam'}, {series: 'hypercar', track: 'monza', phase: 'race'}]) {
    const h = strip(setupPage(q, 'en'));
    assert.ok(!/undefined|NaN/.test(h) && !/cannot be computed/.test(h), JSON.stringify(q));
  }
});

test('F1 live weather: the latest session of this circuit within 4 days (OpenF1)', async () => {
  const {f1Live} = await import('../worker/setup-live.js');
  const ck = lapsimAllTracks.monza.circuitKey, now = Date.parse('2026-09-05T16:00:00Z');
  const data = {'/sessions': [{session_key: 1, circuit_key: ck, session_name: 'Practice 1', date_start: '2026-09-04T11:30:00Z'}, {session_key: 2, circuit_key: ck, session_name: 'Practice 3', date_start: '2026-09-05T10:30:00Z'},
    {session_key: 3, circuit_key: ck, session_name: 'Qualifying', date_start: '2026-09-05T18:00:00Z'}, {session_key: 9, circuit_key: ck + 1, session_name: 'Race', date_start: '2026-09-05T12:00:00Z'}],
    '/weather': [{air_temperature: 27, track_temperature: 44, humidity: 40, pressure: 1005, wind_speed: 2, rainfall: 0}]};
  const fetchImpl = async url => ({ok: true, status: 200, headers: new Headers(), json: async () => data[new URL(url).pathname.replace('/v1', '')], text: async () => JSON.stringify(data[new URL(url).pathname.replace('/v1', '')])});
  const r = await f1Live('monza', now, {fetchImpl, now});
  assert.equal(r.session, 'Practice 3'); assert.equal(r.weather.trackTempC, 44);
});
