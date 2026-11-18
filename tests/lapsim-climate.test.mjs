import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimClimate as C, lapsimClimateMeta as M} from '../worker/lapsim/climate-data.js';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';
import {carsFor, realConditions} from '../worker/lapsim/scenario.js';
import {simulationPage, lapsimScript} from '../worker/simulation.js';

const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const view = (track, car, lang = 'en') => { const d = JSON.parse(simulationPage({track, car}, lang).match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
  return {d, v: V.computeView(V.K, d, {carId: d.carId, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, V.R)}; };

test('Bahrain: the F1 GP slot (March evening) and the WEC 8h slot (November afternoon) differ', () => {
  const f = C.sakhir.presets.f1, w = C.sakhir.presets.wec;
  assert.deepEqual([f.basis, f.m, f.h], ['slot', 3, 18]); assert.deepEqual([w.basis, w.m], ['slot', 11]); assert.ok(w.h >= 12 && w.h <= 15, String(w.h));
  assert.ok(w.air[1] - f.air[1] > 3, 'November afternoon is warmer than a March evening');
  const {v} = view('sakhir', '2026');
  assert.match(v.airHtml, /typical 3\/18:00 \(ERA5 2016–25 median; air 19\.1–24 °C, rain probability 2\.9%\)/);
  assert.match(v.airHtml, /Air temperature<\/dt><dd data-no-translate>20\.9 °C/);
});

test('every track × car on the menu gets a weather source: its real session, else a typical preset (Rwanda: none, said so)', () => {
  let real = 0, typical = 0;
  for (const id of Object.keys(lapsimAllTracks)) {
    const conds = realConditions(id);
    for (const [k, c] of Object.entries(carsFor(id, 'en'))) {
      if (conds[c.series ? k : String(c.year)]) { real++; continue; }
      if (id === 'rwanda') { assert.equal(C[id], null); continue; }
      assert.ok(C[id].presets[C[id].main], `${id} ${k}`); typical++;
    }
  }
  assert.ok(real > 1000 && typical > 1000, `${real} ${typical}`);
  assert.match(view('rwanda', '2026').v.airHtml, /climate not available/);
});

test('no archive weather for a future, postponed or cancelled session: presets hold only percentiles, never a dated value', () => {
  for (const [id, c] of Object.entries(C)) if (c) for (const p of Object.values(c.presets)) {
    assert.deepEqual(Object.keys(p).filter(k => /year|date|day|session/i.test(k)), [], id);
    assert.ok(p.air.length === 3 && Number.isFinite(p.air[1]));
  }
  // F1 2026 at a track whose 2026 race has not run: typical weather, not the 2025 real session
  const lv = view('las-vegas', '2026');
  assert.equal(lv.d.conds['2026'], undefined); assert.match(lv.v.airHtml, /typical 11\//); assert.doesNotMatch(lv.v.airHtml, /real session/);
});

test('past sessions keep the real session weather; KO/EN labels and the ERA5 error are shown', () => {
  assert.match(view('sakhir', '2025').v.airHtml, /real session 2025/);
  const ko = view('sakhir', '2026', 'ko').v.airHtml;
  assert.match(ko, /평년 3월 18시/); assert.match(ko, /기온 -1\.02 °C, RMS 2\.25 °C; 노면 온도 추정 ±3\.97 °C/);
  assert.equal(M.credit, 'Contains modified Copernicus Climate Change Service information (ERA5), via Open-Meteo, CC BY 4.0');
  assert.match(simulationPage({track: 'sakhir'}, 'en'), /Copernicus Climate Change Service/);
});

test('lapsim_simulate uses the same typical weather and says so', async () => {
  const {simulate} = await import('../worker/lapsim/tool.js');
  const o = simulate({track: 'sakhir', car: '2026'});
  assert.equal(o.conditions.air_temp_c, C.sakhir.presets.f1.air[1]); assert.match(o.conditions.sources.air_temp, /^typical 3\/18:00 local: ERA5 2016-2025 median via Open-Meteo/);
  assert.match(simulate({track: 'sakhir', car: '2025'}).conditions.sources.air_temp, /^real 2025/);
  assert.equal(simulate({track: 'sakhir', car: '2026', air_temp_c: 30}).conditions.sources.air_temp, 'given');
});
