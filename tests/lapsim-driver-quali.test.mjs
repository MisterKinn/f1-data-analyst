import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage, lapsimScript} from '../worker/simulation.js';
import {lapsimF1DriverQuali} from '../worker/lapsim/f1-driver-quali-data.js';

// owner 2026-11-22: picking an F1 driver shows that driver's real qualifying lap of the event, in that session's weather
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const d = JSON.parse(simulationPage({track: 'melbourne', car: '2026'}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
const view = driver => V.computeView(V.K, d, {carId: d.carId, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, driver, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, V.R);
const mmss = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;

test('Melbourne 2026: the page lap of a picked driver equals that driver\'s real qualifying lap', () => {
  const real = lapsimF1DriverQuali.melbourne['2026'];
  for (const drv of ['RUS', 'ANT', 'ALB']) {
    const v = view(drv);
    assert.match(v.poleHtml, new RegExp(`Real lap ${drv} <span data-no-translate>${mmss(real[drv].lap).replace('.', '\\.')}</span> · <span data-no-translate>\\+0\\.000 s`));
  }
  assert.match(view('').poleHtml, /Real pole <span data-no-translate>1:18\.518<\/span> · <span data-no-translate>\+0\.000 s/);
});

test('real driver laps are read-only data: sectors add up to the lap', () => {
  for (const ys of Object.values(lapsimF1DriverQuali)) for (const rows of Object.values(ys)) for (const r of Object.values(rows))
    assert.ok(Math.abs(r.sectors.reduce((a, b) => a + b, 0) - r.lap) <= 0.002, JSON.stringify(r));
});
