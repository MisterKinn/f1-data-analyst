import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage, lapsimScript} from '../worker/simulation.js';

// owner 2026-11-22 (Las Vegas screenshot): super-clipping at the store floor drew a solid band in the motor lane; the lane shows net power
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
test('Las Vegas 2026: the motor lane has no step-to-step deploy / recovery flipping, the lap is unchanged', () => {
  const d = JSON.parse(simulationPage({track: 'las-vegas', car: '2026'}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
  const v = V.computeView(V.K, d, {carId: d.carId, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, V.R);
  const m = v.tel.lanes.find(l => l.key === 'motor').ser[0].v; let flips = 0;
  for (let i = 1; i < m.length; i++) if (Math.sign(m[i]) * Math.sign(m[i - 1]) < 0) flips++;
  assert.ok(flips < 40, String(flips)); assert.equal(v.lap, '1:33.893');
});
