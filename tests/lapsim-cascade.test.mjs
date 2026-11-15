import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const page = async q => (await worker.fetch(new Request('https://example.com/simulation?' + q), {})).text();
const opts = (h, ls) => [...(h.match(new RegExp(`data-ls="${ls}"[^>]*>([\\s\\S]*?)</select>`)) || [])[1].matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)/g)].map(m => ({v: m[1], off: /disabled/.test(m[2]), t: m[3]}));

test('simulator cascade: series first, then the rules/classes of that series only', async () => {
  const f1 = await page('track=monza'), wec = await page('track=monza&car=wec-lmgt3');
  assert.deepEqual(opts(f1, 'series').map(o => o.v), ['f1', 'wec', 'imsa', 'fe', 'gt3']);
  assert.ok(opts(f1, 'series').filter(o => o.off).every(o => /준비 중/.test(o.t)) && opts(f1, 'series').find(o => o.v === 'gt3').t === 'GT3 (차종별)' && !opts(f1, 'series').find(o => o.v === 'gt3').off); // GT3 is live: one car per model
  assert.ok(opts(f1, 'car').every(o => !o.v.startsWith('wec')));
  assert.deepEqual(opts(wec, 'car').map(o => o.v), ['wec-lmh', 'wec-lmdh']); // owner 2026-11-15: LMGT3 only under GT3 (model, then the WEC LMGT3 spec)
  assert.match(wec, /<option value="wec" selected/);
  assert.match(f1, /<optgroup label="WEC">/, 'compare lists every series');
});

test('GT3: car model first, then the series spec, and the tyre supplier of that series (owner 2026-11-15)', async () => {
  const h = await page('track=spa-francorchamps&car=gt3-lamborghini-huracan-gt3');
  assert.deepEqual(opts(h, 'spec').map(o => o.v), ['gt3-sro', 'gt3-imsa', 'gt3-aco', 'gt3-dtm']);
  assert.ok(opts(h, 'car').every(o => !/·/.test(o.t)), 'model list has no series suffix');
  assert.equal(new Set(opts(h, 'car').map(o => o.t)).size, opts(h, 'car').length, 'each model once');
  assert.match(h, /Pirelli|피렐리/);
  assert.match(await page('track=daytona&car=gt3-imsa-porsche-911-gt3-r-992'), /data-ls="tyre">[^]*?(Michelin|미쉐린)/);
  assert.match(await page('track=le-mans&car=gt3-aco-porsche-911-gt3-r-992'), /data-ls="tyre">[^]*?(Goodyear|굿이어)/);
});
