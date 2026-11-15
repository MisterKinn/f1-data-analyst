import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimScript, simulationPage} from '../worker/simulation.js';
import {lapsimF1Zones} from '../worker/lapsim/f1-zones-data.js';

// owner 2026-11-16: every 2026 FIA map has a low-grip (Alt) activation column; n/a switches the zone off (Low Grip Conditions, B1.5.11)
test('2026 zones carry the low-grip activation of the FIA map', () => {
  const mel = lapsimF1Zones.tracks.melbourne['2026'].zones, br = lapsimF1Zones.tracks.interlagos['2026'].zones;
  assert.deepEqual(mel.filter(z => z.low === null).map(z => z.n), [4, 5]);
  assert.ok(br.every(z => Number.isFinite(z.low)) && br[0].low !== br[0].from);
  for (const [id, t] of Object.entries(lapsimF1Zones.tracks)) for (const z of t['2026']?.est ? [] : t['2026']?.zones || []) assert.ok(z.low === undefined || z.low === null || Number.isFinite(z.low), id);
});

const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const M = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const lapOf = (track, car, o) => { const data = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
  const st = {carId: data.carId, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}, ...o};
  const [m, s] = M.computeView(M.K, data, st, M.R).lap.split(':'); return 60 * m + Number(s); };

// options (owner 2026-11-16): SM Normal / Alt / Off and Overtake for 2026, DRS for 2025; defaults give the fitted lap
test('SM, Overtake and DRS options change the predicted lap in the right direction', () => {
  const n = lapOf('interlagos', '2026', {}), alt = lapOf('interlagos', '2026', {sm: 'alt'}), off = lapOf('interlagos', '2026', {sm: 'off'}), noOt = lapOf('interlagos', '2026', {ot: false});
  assert.ok(n < alt && alt < off, [n, alt, off].join(' '));
  assert.ok(noOt >= n, 'Overtake never slows the lap');
  assert.equal(lapOf('interlagos', '2026', {drs: false}), n, 'DRS is not a 2026 option');
  const d = lapOf('monza', '2025', {}); assert.ok(lapOf('monza', '2025', {drs: false}) > d); assert.equal(lapOf('monza', '2025', {sm: 'off'}), d);
});
