// I4 covariate model: synthetic checks of fit() in scripts/sim/i4-test.mjs (signal recovered, noise shrunk to ~0).
import test from 'node:test';
import assert from 'node:assert/strict';
import {fit} from '../scripts/sim/i4-test.mjs';

let s = 3; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) - 0.5;
const mk = (b) => Array.from({length: 25}, (_, i) => { const x = {surfaceAge: i % 15, street: i % 3 ? 0 : 1, softness: 2 + (i % 4), evolution60: rnd() * 4};
  return {track: 't' + i, x, y: b * (x.surfaceAge - 7) / 4.3 + 0.01 * rnd()}; });
test('strong covariate is recovered with the right sign', () => {
  const m = fit(mk(0.05)); assert.ok(m.beta.surfaceAge.per1sd > 0.03, JSON.stringify(m.beta)); assert.ok(m.tau < 0.03);
});
test('pure noise gives small coefficients', () => {
  const m = fit(mk(0)); for (const v of Object.values(m.beta)) assert.ok(Math.abs(v.per1sd) < 0.01, JSON.stringify(m.beta));
});
