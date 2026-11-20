import test from 'node:test';
import assert from 'node:assert/strict';
import {bopSensitivity as S, bopSensitivityMeta as M} from '../worker/lapsim/bop-sensitivity-data.js';
import {bopPage} from '../worker/bop-page.js';
import {W5_POINTS} from '../scripts/sim/bop-sensitivity.mjs';

test('BoP sensitivity: every class and venue swept, heavier is slower and more power is faster', () => {
  assert.equal(M.jobs, 72);
  for (const [t, cars] of Object.entries(S)) for (const [c, v] of Object.entries(cars)) {
    assert.ok(v.default.mass.a > 0 && v.default.power.a < 0, `${t} ${c}`);
    assert.ok(v.default.mass.monotonic && v.default.power.monotonic, `${t} ${c} monotonic`);
  }
});

test('BoP sensitivity reproduces the W5 default laps', () => {
  for (const [t, c, l0] of W5_POINTS) if (l0 != null) assert.ok(Math.abs(S[t][c].default.lap0 - l0) <= 0.001, `${t} ${c}`);
});

test('BoP page calculator uses the simulator sensitivity, labelled not measured, energy hidden', () => {
  for (const lang of ['ko', 'en']) {
    const h = bopPage({}, lang);
    assert.match(h, lang === 'en' ? /Simulator sensitivity, not measured/ : /시뮬레이터 민감도, 실측 아님/);
    assert.match(h, lang === 'en' ? /only on 2024 events/ : /2024 대회에서만/);
    assert.match(h, /x\.length>2\?x\[2\]\*m/);
    assert.doesNotMatch(h, /bop-dmj/);
  }
});
