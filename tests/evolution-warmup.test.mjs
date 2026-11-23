import test from 'node:test';
import assert from 'node:assert/strict';
import {evolutionCoeffs, evolutionDelta} from '../worker/lapsim/evolution.js';
import {lapsimEvolution} from '../worker/lapsim/evolution-data.js';
import {EVOLUTION_WARMUP_MEASURED, lapsimEvolutionWarmup} from '../worker/lapsim/evolution-warmup-data.js';

const combos = () => {
  const out = [];
  for (const s of ['f1', 'wec']) for (const t of [null, ...Object.keys(lapsimEvolution.series[s]?.tracks || {})]) for (const ses of ['practice', 'qualifying', 'race'])
    for (const cls of ['hypercar', 'lmp2', 'lmgt3']) out.push([s, t, ses, cls]);
  return out;
};
const laps = c => { const P = {...c, session: c.session, useCurve: !!c.curve}; return [0, 15, 60].map(m => [1, 2, 3, Infinity].map(k => evolutionDelta(P, m, k))); };

test('evolution warm-up flag: off by default, and off leaves every coefficient and lap byte-identical', () => {
  assert.equal(EVOLUTION_WARMUP_MEASURED, false);
  for (const [s, t, ses, cls] of combos()) {
    const a = evolutionCoeffs(s, t, ses), b = evolutionCoeffs(s, t, ses, {cls});
    assert.equal(JSON.stringify(b), JSON.stringify(a));
    assert.equal(JSON.stringify(laps({...b, session: ses})), JSON.stringify(laps({...a, session: ses})));
  }
});

test('evolution warm-up flag on: WEC lap 1 carries the measured class gap, best laps (k ≥ 2) unchanged', () => {
  const table = {wec: {hypercar: {practice: {pct: 1.2}, all: {pct: 1.1}}}};
  for (const t of [null, ...Object.keys(lapsimEvolution.series.wec.tracks)]) for (const ses of ['practice', 'qualifying']) {
    const off = evolutionCoeffs('wec', t, ses), on = evolutionCoeffs('wec', t, ses, {cls: 'hypercar', measuredWarmup: true, table});
    assert.equal(on.warmupPct, ses === 'practice' ? 1.2 : 1.1);
    assert.equal(on.warmupLaps, 1);
    const P = c => ({...c, session: ses, useCurve: !!c.curve, warmupLaps: c.warmupLaps});
    for (const m of [0, 20, 60]) {
      assert.ok(Math.abs(evolutionDelta(P(on), m, 1) - evolutionDelta(P(on), m, Infinity) - on.warmupPct / 100) < 1e-12);
      assert.equal(evolutionDelta(P(on), m, 2), evolutionDelta(P(on), m, Infinity));
      assert.equal(evolutionDelta(P(on), m, Infinity), evolutionDelta(P(off), m, Infinity));
    }
  }
  // other series and classes without a measured value are untouched
  assert.deepEqual(evolutionCoeffs('f1', null, 'practice', {cls: 'hypercar', measuredWarmup: true, table}), evolutionCoeffs('f1', null, 'practice'));
  assert.deepEqual(evolutionCoeffs('wec', null, 'practice', {cls: 'lmgt3', measuredWarmup: true, table}), evolutionCoeffs('wec', null, 'practice'));
});

test('evolution warm-up data: measured WEC coefficients are present and plausible', () => {
  const w = lapsimEvolutionWarmup.wec;
  if (!w) return;
  for (const cls of Object.keys(w)) for (const v of Object.values(w[cls])) assert.ok(v.pct > 0 && v.pct < 5 && v.n >= 30, `${cls} ${JSON.stringify(v)}`);
});
