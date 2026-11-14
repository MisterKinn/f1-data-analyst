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
  assert.deepEqual(opts(wec, 'car').map(o => o.v), ['wec-lmh', 'wec-lmdh', 'wec-lmgt3']);
  assert.match(wec, /<option value="wec" selected/);
  assert.match(f1, /<optgroup label="WEC">/, 'compare lists every series');
});
