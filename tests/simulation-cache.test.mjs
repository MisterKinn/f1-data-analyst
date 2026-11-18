import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage, lapsimScript} from '../worker/simulation.js';
import {simulationPageCached, simulationFirstView} from '../worker/simulation-cache.js';
import {canonJson, firstViewState} from '../worker/lapsim/view-keys.js';

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

// first-view job, stage 4: the server draws the stored first view; a missing, wrong or slow view keeps today's page
test('stored first view: used only when build and state match, and the page arrives as the browser draws it', async () => {
  const q = {track: 'suzuka', car: '2025'}, lang = 'en', html = simulationPage(q, lang), data = JSON.parse(html.match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
  let posted = null; const was = globalThis.self; globalThis.self = {postMessage: m => { posted = structuredClone(m); }};
  try { (0, eval)(lapsimScript()); self.onmessage({data: {data}}); self.onmessage({data: {id: 1, state: firstViewState(data, data.carId)}}); } finally { globalThis.self = was; }
  const urls = [], serve = body => async u => { urls.push(u); return new Response(JSON.stringify(body(u))); };
  const good = await simulationFirstView(q, lang, null, {fetchImpl: serve(u => ({build: u.split('/').at(-2), state: canonJson(firstViewState(data, data.carId)), v: posted.v})), now: 1});
  assert.ok(good && good.v); assert.match(urls[0], /^https:\/\/misterkinn\.github\.io\/f1-data-analyst\/views\/[\w-]+\/\w+\.json$/);
  const drawn = simulationPageCached(q, lang, null, good);
  assert.match(drawn, /<output data-out="airTempC">\d+\.\d<\/output>/); assert.match(drawn, /<label class="ls-chan">/);
  assert.equal(await simulationFirstView({track: 'monza'}, lang, null, {fetchImpl: serve(() => ({build: 'other', state: '{}', v: {}})), now: 1}), null);
  assert.equal(await simulationFirstView({track: 'spa-francorchamps'}, lang, null, {fetchImpl: () => new Promise(() => {}), timeoutMs: 20, now: 1}).catch(() => 'threw'), null);
});
