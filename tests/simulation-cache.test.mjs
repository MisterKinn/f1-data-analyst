import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage} from '../worker/simulation.js';
import {simulationPageCached} from '../worker/simulation-cache.js';

// speed job 2026-11-18: the /simulation page is cached per instance by its inputs; the cached page is the same text
test('cached /simulation page equals a fresh render, and a repeat view is served from memory', () => {
  for (const [q, lang] of [[{track: 'monza'}, 'ko'], [{track: 'monza', car: '2025'}, 'en'], [{track: 'spa-francorchamps', car: 'wec-lmh', evo: '0'}, 'en']]) {
    const a = simulationPageCached(q, lang, null);
    assert.equal(a, simulationPage(q, lang, null));
    const t0 = performance.now(), b = simulationPageCached(q, lang, null);
    assert.equal(b, a); assert.ok(performance.now() - t0 < 50);
  }
  assert.notEqual(simulationPageCached({track: 'monza'}, 'en', null), simulationPageCached({track: 'monza'}, 'ko', null));
});
