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

test('Bahrain: the F1 GP slot (April evening, W10 latest qualifying) and the WEC 8h slot (November afternoon) differ', () => {
  const f = C.sakhir.presets.f1, w = C.sakhir.presets.wec;
  assert.deepEqual([f.basis, f.m, f.h], ['slot', 4, 19]); assert.match(f.src, /TracingInsights\/2025\/.*Bahrain/); assert.deepEqual([w.basis, w.m], ['slot', 11]); assert.ok(w.h >= 12 && w.h <= 16, String(w.h));
  const {v} = view('sakhir', '2026');
  // W10 Gate G: the lap keeps the old fallback (preset made laps worse); the preset is shown for reference only
  assert.match(v.airHtml, /For reference, typical weather \(not used for the lap[^)]*\) typical 4\/19:00 \(ERA5 2016–25 median; air /);
  assert.doesNotMatch(v.airHtml, new RegExp(`Air temperature</dt><dd data-no-translate>${f.air[1].toFixed(1)} °C`));
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
  assert.equal(lv.d.conds['2026'], undefined); assert.match(lv.v.airHtml, /For reference, typical weather[^<]*typical 11\//); assert.doesNotMatch(lv.v.airHtml, /real session 20/);
});

test('past sessions keep the real session weather; KO/EN labels and the ERA5 error are shown', () => {
  assert.match(view('sakhir', '2025').v.airHtml, /real session 2025/);
  const ko = view('sakhir', '2026', 'ko').v.airHtml;
  assert.match(ko, /참고: 평년 날씨[^<]*평년 4월 19시/); assert.match(ko, /기온 -1\.02 °C, RMS 2\.25 °C; 노면 온도 추정 ±3\.97 °C/);
  assert.equal(M.credit, 'Contains modified Copernicus Climate Change Service information (ERA5), via Open-Meteo, CC BY 4.0');
  assert.match(simulationPage({track: 'sakhir'}, 'en'), /Copernicus Climate Change Service/);
});

test('lapsim_simulate keeps the old lap weather and reports the typical weather for reference', async () => {
  const {simulate} = await import('../worker/lapsim/tool.js');
  const o = simulate({track: 'sakhir', car: '2026'});
  assert.match(o.conditions.sources.air_temp, /^real /); assert.deepEqual([o.typical_weather.month, o.typical_weather.local_hour, o.typical_weather.air_temp_c], [4, 19, C.sakhir.presets.f1.air]);
  assert.match(o.typical_weather.note, /reference only/);
  assert.match(simulate({track: 'sakhir', car: '2025'}).conditions.sources.air_temp, /^real 2025/);
  assert.equal(simulate({track: 'sakhir', car: '2026', air_temp_c: 30}).conditions.sources.air_temp, 'given');
});
