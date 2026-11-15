import test from 'node:test';
import assert from 'node:assert/strict';
import {setupPlan, setupTracks, aeroWindow} from '../worker/lapsim/setup-plan.js';
import {PIRELLI_2026, SM_ZONES} from '../worker/lapsim/setup-evidence.js';
import {setupPage} from '../worker/setup-page.js';

test('setup tracks: F1 from the F1 calendar, hypercar from WEC and IMSA', () => {
  const f1 = setupTracks('f1'), hy = setupTracks('hypercar');
  assert.ok(f1.monza && f1['monte-carlo'] && !f1['le-mans']);
  assert.ok(hy['le-mans'] && hy.daytona && !hy['monte-carlo']);
});

test('aero sweep follows the circuit: Monza low, Monaco high (F1 2026)', () => {
  const monza = setupPlan('monza', 'f1-2026:ferrari'), monaco = setupPlan('monte-carlo', 'f1-2026:ferrari');
  assert.ok(monza.aero.s < 0.3, `monza ${monza.aero.s}`);
  assert.ok(monaco.aero.s > 0.7, `monaco ${monaco.aero.s}`);
  for (const k of Object.values(monza.knobs)) assert.ok(k.p >= 0 && k.p <= 1);
});

test('F1 plan carries the Pirelli prescription; F1 team names never pick a hypercar model', () => {
  const p = setupPlan('monza', 'f1-2026:alpine');
  assert.equal(p.model, null);
  assert.deepEqual(p.evidence.pirelli.p, PIRELLI_2026.monza.p);
  assert.equal(p.knobs.camber.why, 'pirelli');
  assert.equal(SM_ZONES['monte-carlo'], 0);
});

test('hypercar: Valkyrie runs without hybrid, LMDh model maps to its class', () => {
  const v = setupPlan('le-mans', 'hyper:aston'), c = setupPlan('le-mans', 'hyper:cadillac');
  assert.equal(v.cls, 'lmh'); assert.equal(c.cls, 'lmdh');
  assert.ok(v.knobs.tc && c.knobs.tc);
  assert.ok(aeroWindow({clA: 3.4, cdA: 1.05}, 'hypercar').cl < aeroWindow({clA: 3.4, cdA: 1.05}, 'f1').cl);
});

test('setup page renders in both languages and falls back to a valid track', () => {
  const ko = setupPage({series: 'f1', car: 'mclaren', track: 'nowhere'}, 'ko');
  assert.match(ko, /셋업 시뮬레이터/); assert.match(ko, /su-gauge/);
  const en = setupPage({series: 'hypercar', car: 'toyota', track: 'fuji'}, 'en');
  assert.match(en, /Setup simulator/); assert.match(en, /Michelin/);
});
