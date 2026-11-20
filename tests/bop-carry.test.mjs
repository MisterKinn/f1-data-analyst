import test from 'node:test';
import assert from 'node:assert/strict';
import {bopEstimate2026 as D} from '../worker/lapsim/bop-estimate-data.js';
import {lapsimWecBop} from '../worker/lapsim/wec-bop-data.js';
import {bopPage} from '../worker/bop-page.js';

// W6-F Gate G (2026-11-18): carry-forward wins peak power only; weight no winner; energy a tie (kept on the model)
test('generator reproduces the W6-F 48-row carry gate', () => {
  const G = D.carryTest;
  for (const k of ['kg', 'peakKW', 'MJ']) { assert.equal(G[k].rows, 48); assert.equal(G[k].events, 6); }
  assert.equal(G.peakKW.carry.mae, 3.999); assert.equal(G.kg.carry.mae, 6.1458); assert.equal(G.MJ.site.mae, 5.3958); assert.equal(G.MJ.carry.mae, 4.7083);
  assert.equal(G.peakKW.winner, 'carry'); assert.equal(G.kg.winner, 'none');
  assert.deepEqual(D.carryLevers, {kg: false, peakKW: true, MJ: false});
  assert.deepEqual([D.holdout2025.cases, D.holdout2025.model.kg, D.holdout2025.model.MJ], [48, 6.5, 5.4]);
});

test('64/64 2026 model-event rows carry a method tag; 8 carry peak power from Bahrain 2025', () => {
  const all = D.events.flatMap(e => Object.entries(e.cars).map(([m, x]) => ({ev: e.event, m, x})));
  assert.equal(all.length, 64);
  for (const {x} of all) { assert.equal(x.method.kg, 'site'); assert.equal(x.method.MJ, 'site'); assert.ok(['site', 'carry'].includes(x.method.kW)); }
  const c = all.filter(r => r.x.method.kW === 'carry'), pub = lapsimWecBop.sakhir['2025'].cars['Aston Martin Valkyrie'];
  assert.equal(c.length, 8); assert.ok(c.every(r => r.m === 'Aston Martin Valkyrie' && r.x.kW === pub.kW && r.x.above250 === pub.above250 && r.x.model));
});

test('BoP page shows the method per cell, the KO/EN label and the carry gate', () => {
  const en = bopPage({sc: 'wec.hypercar', year: '2026', event: 'imola'}, 'en'), ko = bopPage({sc: 'wec.hypercar', year: '2026', event: 'imola'}, 'ko');
  assert.match(en, /carried: Bahrain 2025 published/); assert.match(en, /Peak power uses the last published setting/); assert.match(en, /Carry gain ± SE/);
  assert.match(ko, /공개값 이월: 2025 바레인/); assert.match(ko, /최고출력은 같은 사양의 마지막 공개값/);
});
