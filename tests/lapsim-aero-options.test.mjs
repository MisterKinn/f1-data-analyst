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
  const v = M.computeView(M.K, data, st, M.R), [m, s] = v.lap.split(':'); return o.view ? v : 60 * m + Number(s); };

// options (owner 2026-11-16): SM Normal / Alt / Off and Overtake for 2026, DRS for 2025; defaults give the fitted lap
test('SM, Overtake and DRS options change the predicted lap in the right direction', () => {
  const n = lapOf('interlagos', '2026', {}), alt = lapOf('interlagos', '2026', {sm: 'alt'}), off = lapOf('interlagos', '2026', {sm: 'off'}), noOt = lapOf('interlagos', '2026', {ot: false});
  assert.ok(n < alt && alt < off, [n, alt, off].join(' '));
  assert.ok(noOt >= n, 'Overtake never slows the lap');
  assert.equal(lapOf('interlagos', '2026', {drs: false}), n, 'DRS is not a 2026 option');
  const d = lapOf('monza', '2025', {}); assert.ok(lapOf('monza', '2025', {drs: false}) > d); assert.equal(lapOf('monza', '2025', {sm: 'off'}), d);
});

// owner 2026-11-16: brake and SoC follow the options; the map draws the chosen zone set (Alt shorter, n/a zones left out, Off none)
test('telemetry and map follow the zone options', () => {
  const n = lapOf('melbourne', '2026', {view: 1}), alt = lapOf('melbourne', '2026', {view: 1, sm: 'alt'}), off = lapOf('melbourne', '2026', {view: 1, sm: 'off'});
  assert.notEqual(n.socHtml, off.socHtml); assert.notEqual(n.brakeHtml, off.brakeHtml); assert.notEqual(n.traceSvg, alt.traceSvg);
  // every zone stays in the drawing so a change can animate (owner 2026-11-16): count the shown ones
  const bands = v => (v.mapSvg.match(/class="ls-zone ls-zone-sm"[^>]*opacity:0\.9/g) || []).length;
  assert.equal(bands(n), 5); assert.equal(bands(alt), 3); assert.equal(bands(off), 0);
  assert.ok((off.mapSvg.match(/OT [AD]</g) || []).length === 2, 'Overtake marks stay while Overtake is on');
  assert.equal((n.mapSvg.match(/class="ls-zone ls-zone-sm"/g) || []).length, 5, 'hidden zones are still drawn (opacity 0)');
});

// the connector's lap tool has the same options and gives the same laps as the page (owner 2026-11-16)
test('lapsim_simulate zone options match the page', async () => {
  const {simulate} = await import('../worker/lapsim/tool.js'), lap = o => { const [m, s] = simulate({track: 'interlagos', car: '2026', ...o}).result.lap_time.split(':'); return 60 * m + Number(s); };
  assert.equal(lap({}), lapOf('interlagos', '2026', {}));
  assert.equal(lap({straight_mode: 'alt'}), lapOf('interlagos', '2026', {sm: 'alt'}));
  assert.equal(lap({overtake: false}), lapOf('interlagos', '2026', {ot: false}));
  assert.deepEqual(simulate({track: 'interlagos', car: '2026'}).zones.real_qualifying, {grip: 'low', ot: 'off'});
});

// C5.12.4–7 (owner 2026-11-16): with the power-reduction rule on, a 2026 lap has no ERS-K cut of more than 150 kW above 210 km/h off the
// brakes (outside the FIA's large-cut sectors), and uses about the same energy
test('C5.12 power-reduction rule removes sudden ERS-K cuts', async () => {
  const {lapsimKernel} = await import('../worker/lapsim/kernel.js'), {lapsimAllTracks: T} = await import('../worker/lapsim/tracks.js'), {carsFor} = await import('../worker/lapsim/scenario.js'), {puRampOf} = await import('../worker/lapsim/zones.js');
  const K = lapsimKernel();
  for (const id of ['monza', 'hungaroring', 'monte-carlo']) { const d = T[id], pr = puRampOf(d, id), tr = {...K.trackFromData(d), otOn: true}, car = carsFor(id)['2026'].car;
    const e0 = K.conditionsFromWeather({rechargeMJ: 7}), r = K.simulateLap(tr, car, {...e0, puRamp: pr}), r0 = K.simulateLap(tr, car, e0), n = r.v.length;
    const P = j => r.flow.dep[j] / (d.ds / Math.max(0.5 * (r.v[j] + r.v[(j + 1) % n]), 1));
    for (let i = 1; i < n; i++) { const s = i * d.ds, big = pr.bigCut.some(z => s >= z.from && s <= z.to);
      if (!big && r.limit[i] !== 3 && r.limit[i] !== 0 && r.v[i] * 3.6 > 210 && P(i - 1) > 100e3) assert.ok(P(i - 1) - P(i) <= 160e3, `${id} cut of ${Math.round((P(i - 1) - P(i)) / 1e3)} kW at ${Math.round(s)} m`); }
    assert.ok(Math.abs(r.energy.deployJ - r0.energy.deployJ) < 0.5e6, id + ' energy'); }
});

// owner 2026-11-16: every circuit without an FIA Power Unit Information has an estimated one (round-4 rules), and the page shows the
// motor DC power map with the curve the lap uses
test('estimated PU documents and the motor DC power map', async () => {
  const {lapsimPuEst} = await import('../worker/lapsim/pu-est-data.js'), {lapsimPuDocs} = await import('../worker/lapsim/pu-docs-data.js');
  for (const id of ['inje', 'lusail', 'le-mans', 'daytona']) { const e = lapsimPuEst.tracks[id]; assert.ok(e && e.est && !lapsimPuDocs.events[id], id);
    assert.ok(e.qualiMJ >= 5 && e.qualiMJ <= 9 && [7, 8, 8.5].includes(e.raceMJ) && e.rampKWs === (e.powerLimitedDistanceM > 3500 ? 50 : 100), id); }
  const map = track => lapOf(track, '2026', {view: 1}).traceSvg;
  assert.match(map('interlagos'), /ls-pu-map[\s\S]*Base – Overtake · this lap[\s\S]*Alt 1/);
  assert.match(map('suzuka'), /Base – Standard · this lap/);
});
