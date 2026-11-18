import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {lapsimWetGap as W} from '../worker/lapsim/wet-gap-data.js';
import {wetGap, wetGapPage, wetType} from '../worker/lapsim/wet-gap.js';
import {simulate} from '../worker/lapsim/tool.js';
import {simulationPage, lapsimScript} from '../worker/simulation.js';

const rows = Object.entries(W.tracks).flatMap(([track, R]) => R.map(r => ({track, r})));

test('W2-F constants and held-out errors (Gate G pass; rejected alternatives kept)', () => {
  assert.deepEqual(W.constants, {inter: 17.7404, wet: 28.1898});
  assert.equal(W.test.loo.laps, 11050); assert.equal(W.test.loo.events, 49);
  assert.equal(W.test.loo.mae, 6.7182); assert.equal(W.test.loo.baseMae, 20.2985); assert.ok(W.test.loo.pass && W.test.loo.gain > W.test.loo.gainSe);
  assert.equal(W.test.unseen2026.mae, 3.7859); assert.ok(W.test.unseen2026.pass);
  for (const k of ['trackOffsets', 'evolutionOnTop', 'evolutionOnTop2026']) assert.equal(W.test[k].pass, false, k);
  assert.equal(rows.length, 928); assert.equal(W.notCovered.groups, 122);
});

test('928/928 measured groups replay exactly through the site path (car model and session given)', () => {
  for (const {track, r} of rows) {
    const g = wetGap({track, compound: r[4] === 'W' ? 'wet' : 'inter', year: r[0], carModel: r[3], session: r[2]});
    assert.deepEqual([g.basis, g.pct, g.laps], ['car', r[5], r[6]], `${track} ${r.join(' ')}`);
  }
});

test('replay matches the W2-F bundle at 0.000% when the bundle is present', {skip: !existsSync('.cache/gpt-2026-11-18/w2f-wet-gap.json')}, () => {
  const B = JSON.parse(readFileSync('.cache/gpt-2026-11-18/w2f-wet-gap.json', 'utf8')).lookup;
  const max = Math.max(...B.map(b => { const r = W.tracks[b.site_track_id].find(r => r[0] === b.year && b.event.startsWith(r[1]) && r[2] === b.session && r[3] === b.car_model && r[4] === b.compound[0]);
    return Math.abs((1 + r[5] / 100) * b.dry_reference_s / b.lookup_replay_mean_s - 1) * 100; }));
  assert.ok(max < 5e-4, `max replay error ${max}%`); // 0.000% at three decimals (gap stored to 4 decimals)
});

test('tool: F1 inter/wet lap = dry × (1 + gap), says which value it used; evolution not stacked; WEC unchanged and labelled', () => {
  const c = simulate({track: 'suzuka', car: '2025', tyre: 'inter'});
  assert.equal(c.wet.gap_to_dry_pct, 17.7404); assert.match(c.wet.value_used, /constant/);
  assert.ok(Math.abs(c.wet.lap_s - c.wet.dry_lap_s * 1.177404) < 0.002);
  assert.equal(c.evolution.change_from_start_s, 0); assert.equal(c.evolution.lap_at_minute_s, c.wet.lap_s);
  const m = simulate({track: 'monte-carlo', car: '2025', tyre: 'inter', session_type: 'race', wet_season: 2022, car_model: 'RB18'});
  assert.equal(m.wet.gap_to_dry_pct, W.tracks['monte-carlo'].find(r => r[0] === 2022 && r[2] === 'Race' && r[3] === 'RB18' && r[4] === 'I')[5]);
  assert.match(m.wet.value_used, /RB18, 2022 Monaco GP Race/);
  const w = simulate({track: 'le-mans', car: 'wec-lmh', tyre: 'wet'});
  assert.equal(w.wet, undefined); assert.match(w.evolution.wet_note, /not measured/);
  assert.equal(simulate({track: 'suzuka', car: '2025'}).wet, undefined, 'default output unchanged');
});

test('page embeds only the selected track and draws the wet lap flat with KO/EN labels', () => {
  const page = l => JSON.parse(simulationPage({track: 'spa-francorchamps', car: '2025'}, l).match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
  const d = page('en');
  assert.deepEqual(d.wetGap, JSON.parse(JSON.stringify(wetGapPage('spa-francorchamps'))));
  assert.ok(!JSON.stringify(d).includes('Monaco'), 'no other track rows');
  const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
  const M = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
  const st = tyre => ({carId: d.carId, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre, useCurve: true, over: {}}});
  const v = M.computeView(M.K, d, st('wet'), M.R);
  assert.match(v.evoFacts, /TracingInsights 2018–26, held-out error 6\.7 pp \(2026: 3\.8 pp\)/);
  assert.match(v.evoFacts, /\+28\.19% \(all-season constant\)/);
  const ko = page('ko'), vk = M.computeView(M.K, ko, {...st('inter'), carId: ko.carId}, M.R);
  assert.match(vk.evoFacts, /검증 오차 6\.7%p/);
});
