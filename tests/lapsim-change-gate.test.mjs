// Step 5b circuit-change gate (Project claude/gate-track-state-prereg-2026-11-23.md; docs/lapsim-change-gate.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimChangeGate as G} from '../worker/lapsim/change-gate-data.js';
import {gateChange, gatedChangeFactors, latestChanges} from '../worker/lapsim/scenario.js';
import {simulate} from '../worker/lapsim/tool.js';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimTrackChanges} from '../worker/lapsim/track-changes-data.js';
import {learnRule, powerCheck, perTrackGains} from '../scripts/sim/change-gate.mjs';

const K = lapsimKernel(), TYPES = ['resurfacing', 'bump_removal', 'kerb_lowered', 'kerb_raised', 'kerb_changed'];
const tracksWithLapChanges = Object.keys(lapsimTrackChanges).filter(id => (lapsimTrackChanges[id][Object.keys(lapsimTrackChanges[id]).sort().at(-1)].changes || []).some(c => c.effect));

test('gate data: every type has a strength; a non-zero strength needs n ≥ 10 and an interval excluding 0', () => {
  for (const t of TYPES) {
    const x = G.types[t]; assert.ok(x, t); assert.ok(x.strength === 0 || x.strength === 1, t);
    if (x.strength) { assert.ok(x.n >= 10, t); assert.ok(x.ci90SpeedPct[0] > 0 || x.ci90SpeedPct[1] < 0, t); assert.ok(!x.defaultSignContradicts, t); }
  }
  assert.equal(G.types.kerb_raised.strength, 0, 'wrong-sign default removed');
  assert.ok(G.power && typeof G.power.judgeable === 'boolean');
});

test('this run: power check says not judgeable, so every type is at strength 0', () => {
  assert.equal(G.power.judgeable, false);
  for (const t of TYPES) assert.equal(G.types[t].strength, 0, t);
  assert.equal(G.decision, null, 'no decision computed when not judgeable (no attempt spent)');
});

test('no unvalidated factor reaches a lap: gated changes are information only', () => {
  assert.ok(tracksWithLapChanges.length > 0);
  for (const id of tracksWithLapChanges) for (const c of latestChanges(id).changes) {
    if (G.types[c.type]?.strength) continue;
    assert.equal(c.affectsLap, false, `${id} ${c.text}`); assert.equal(c.effect, null);
    if (c.infoOnly) assert.equal(gatedChangeFactors({...c, effect: {kind: 'grip', factor: 1.02}}), null);
  }
});

test('gateChange keeps a change without an effect as it is and drops the default of a failed type', () => {
  const info = {text: 'Barrier moved', type: 'barrier', effect: null, affectsLap: false};
  assert.equal(gateChange(info), info);
  const g = gateChange({text: 'New kerb T3', type: 'kerb_raised', effect: {kind: 'cornerSpeed', factor: 0.995}, affectsLap: true});
  assert.deepEqual([g.affectsLap, g.effect, g.infoOnly], [false, null, true]);
});

test('change hook: a strength-0 factor leaves mu and vScale untouched', () => {
  const n = 400, track = {ds: 5, kappa: new Float64Array(n)}, corners = [{number: 1, s: 500}, {number: 2, s: 1200}];
  const ch = [{type: 'resurfacing', affectsLap: true, range: {from: {turn: 1, part: null}, to: {turn: 2, part: null}}, effect: {kind: 'grip', factor: 1.02}},
    {type: 'kerb_lowered', affectsLap: true, range: {list: [{turn: 2, part: 'apex'}]}, effect: {kind: 'cornerSpeed', factor: 1.005}}];
  const r = K.applyTrackChanges({...track, changeFactors: gatedChangeFactors}, ch, corners).track;
  assert.ok(r.mu.every(x => x === 1)); assert.ok(r.vScale.every(x => x === 1));
});

test('tool: lap with FIA changes on equals the lap with them off on every track with announced changes', () => {
  for (const id of tracksWithLapChanges) {
    const off = simulate({track: id}), on = simulate({track: id, apply_fia_changes: true, change_strength: 2});
    assert.equal(on.lap_time, off.lap_time, id);
    assert.ok(on.fia_changes.applied.every(a => !a.applied), id);
    assert.ok(['fia-documented', 'hand-entered', 'no-history'].includes(on.fia_changes.coverage), id);
  }
});

test('rule and power helpers on synthetic cases', () => {
  // 12 cases of a clear +3 % effect on 6 tracks enter; the same type with the sign split does not
  const strong = Array.from({length: 12}, (_, i) => ({id: 't' + (i % 6), type: 'kerb_lowered', lnr: Math.log(1.03) + (i % 3 - 1) * 1e-3}));
  const r = learnRule(strong).kerb_lowered; assert.equal(r.strength, 1); assert.ok(Math.abs(r.lnr - Math.log(1.03) * 12 / 15) < 1e-3);
  const noisy = strong.map((c, i) => ({...c, lnr: (i % 2 ? 1 : -1) * 0.02}));
  assert.equal(learnRule(noisy).kerb_lowered.strength, 0);
  const few = strong.slice(0, 9); assert.equal(learnRule(few).kerb_lowered.reason, 'strength 0 (n < 10)');
  // per-track gain: a perfect predictor of δ gains δ²
  const g = perTrackGains([{id: 'a', type: 'x', lnr: 0.01}], () => 0.01); assert.ok(Math.abs(g[0].gain - 1e-4) < 1e-12);
  assert.equal(powerCheck(noisy).judgeable, false);
});
