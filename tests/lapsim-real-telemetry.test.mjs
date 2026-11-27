import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage, lapsimScript} from '../worker/simulation.js';

// owner 2026-11-22 (AGENTS.md "Measured telemetry is always shown"): a raced F1 lap shows the measured channels, never the model's
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const page = () => JSON.parse(simulationPage({track: 'melbourne', car: '2026'}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
const view = (d, extra = {}) => V.computeView(V.K, d, {carId: d.carId, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}, ...extra}, V.R);
// a measured lap: 4 samples at 0, 25, 50, 75 % of the lap
const REAL = {driver: 'RUS', lap: 78.518, f: [0, 2500, 5000, 7500], speed: [300, 100, 320, 120], throttle: [100, 0, 100, 40], brake: [0, 1, 0, 1], gear: [8, 2, 8, 3], rpm: [11000, 9000, 11500, 9500]};
const lane = (v, key) => v.tel.lanes.find(l => l.key === key);

test('measured speed and kernel speed remain separate, with identical physics and explicit provenance', () => {
  const d = page(); d.realTel = {2026: REAL};
  const measured = view(d), model = view({...d, realTel: null});
  assert.deepEqual(lane(measured, 'speedModel').ser, lane(model, 'speed').ser);
  assert.equal(lane(measured, 'speedModel').name, 'Model speed');
  assert.match(lane(measured, 'speedModel').title, /· model$/);
  assert.equal(lane(model, 'speedModel'), undefined, 'no duplicate when the primary speed is already model');
  assert.equal(measured.lap, model.lap);
  assert.deepEqual(measured.mapArgs, model.mapArgs);
  assert.match(measured.traceSvg, /Changing model options does not change the recorded lap/);
  assert.doesNotMatch(measured.traceSvg, /All channels are simulated, not measured/);
  assert.equal(lane(view(d, {mode: 'manual'}), 'speedModel'), undefined);
});

test('aero options change model speed without overwriting recorded speed, in both languages', () => {
  for (const lang of ['en', 'ko']) {
    const d = JSON.parse(simulationPage({track: 'monza', car: '2025'}, lang).match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
    assert.ok(d.realTel?.[2025], 'real recorded production input');
    const on = view(d), off = view(d, {drs: false});
    assert.deepEqual(lane(on, 'speed').ser, lane(off, 'speed').ser);
    assert.notDeepEqual(lane(on, 'speedModel').ser, lane(off, 'speedModel').ser);
    assert.equal(lane(on, 'speedModel').name, lang === 'en' ? 'Model speed' : '모델 속도');
    assert.match(lane(on, 'speedModel').title, lang === 'en' ? /· model$/ : /· 모델$/);
  }
});

test('raced F1 lap: speed, throttle, brake, gear and rpm are the measured lap, labelled measured; motor and battery stay model', () => {
  const d = page(); d.realTel = {2026: REAL};
  const v = view(d), sp = lane(v, 'speed'), n = sp.ser[0].v.length;
  assert.match(sp.title, /· measured$/); assert.equal(sp.ser[0].v[0], 300); assert.equal(sp.ser[0].v[Math.round(n / 2)], 320);
  assert.equal(sp.ser[0].v[Math.round(n / 8)], 200, 'between samples: linear');
  for (const k of ['throttle', 'brake', 'gear', 'rpm']) assert.match(lane(v, k).title, /· measured$/, k);
  const g = lane(v, 'gear').ser[0].v; assert.deepEqual([g[0], g[Math.round(n / 4) + 1], g[n - 1]], [8, 2, 3], 'gear is a step channel');
  assert.match(lane(v, 'gear').title, / 3 /, 'shift count from the measured gears');
  assert.deepEqual([...new Set(lane(v, 'brake').ser[0].v)].sort((a, b) => a - b), [0, 100]);
  for (const k of ['motor', 'soc', 'steer']) if (lane(v, k)) assert.match(lane(v, k).title, /· model$/, k);
});

test('no measured lap (or another driver picked, manual weather): the model channels, unlabelled', () => {
  const d = page(); assert.doesNotMatch(lane(view({...d, realTel: null}), 'speed').title, /measured/);
  d.realTel = {2026: REAL};
  assert.doesNotMatch(lane(view(d, {mode: 'manual'}), 'speed').title, /measured/);
  assert.doesNotMatch(lane(view(d, {driver: 'ANT'}), 'speed').title, /measured/);
});

test('a picked driver: the page asks for that lap\'s measured telemetry, then shows it as measured', () => {
  const d = page(); d.realTel = {2026: REAL};
  d.driverQuali = {2026: {ANT: {lap: 78.811, sectors: [27.556, 17.44, 33.815], lapNo: 17, ev: 'Australian Grand Prix'}}};
  const v0 = view(d, {driver: 'ANT'});
  assert.equal(v0.telNeed.url, 'https://raw.githubusercontent.com/TracingInsights/2026/main/Australian%20Grand%20Prix/Qualifying/ANT/17_tel.json');
  assert.doesNotMatch(lane(v0, 'speed').title, /measured/);
  const v1 = view(d, {driver: 'ANT', drvTel: {...REAL, driver: 'ANT', year: '2026', speed: [310, 90, 330, 110]}});
  assert.equal(v1.telNeed, null); assert.match(lane(v1, 'speed').title, /· measured$/); assert.equal(lane(v1, 'speed').ser[0].v[0], 310);
  assert.equal(view(d).telNeed, null, 'the pole lap is in the page data');
});

test('GT3 / Hypercar: lanes from iRacing-learned values say model (iRacing); speed stays unlabelled', () => {
  const d = JSON.parse(simulationPage({track: 'spa-francorchamps', car: 'hyper-ferrari'}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]), v = view(d);
  for (const k of ['brake', 'gear', 'rpm']) assert.match(lane(v, k).title, /· model \(iRacing\)$/, k);
  assert.match(lane(v, 'throttle').title, /· model \(iRacing\) · estimate \(provisional\)$/);
  const g = JSON.parse(simulationPage({track: 'spa-francorchamps', car: 'wec-lmgt3'}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]), w = view(g);
  assert.match(lane(w, 'throttle').title, /· model \(iRacing\)$/); for (const k of ['brake', 'gear', 'rpm']) assert.doesNotMatch(lane(w, k).title, /iRacing/, k);
  assert.doesNotMatch(lane(v, 'speed').title, /iRacing/);
});
