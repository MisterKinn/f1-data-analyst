import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const page = async q => (await worker.fetch(new Request('https://example.com/simulation?' + q), {})).text();
const opts = (h, ls) => [...(h.match(new RegExp(`data-ls="${ls}"[^>]*>([\\s\\S]*?)</select>`)) || [])[1].matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)/g)].map(m => ({v: m[1], off: /disabled/.test(m[2]), t: m[3]}));

test('simulator: one menu for series and class (owner 2026-11-17), GT3 then picks the car model', async () => {
  const f1 = await page('track=monza'), wec = await page('track=monza&car=wec-lmgt3'), fe = await page('track=monza&car=fe-gen4');
  // one Hypercar/GTP entry (owner 2026-11-22); inside it the makers (BoP-fastest entered maker first, marked model), then LMH / LMDh
  const so = opts(f1, 'series');
  assert.deepEqual(so.map(o => o.t), ['F1 2025', 'F1 2026', 'F1 2027 (예측)', 'F1 2028 (예측)', 'Hypercar/GTP', '포뮬러 E Gen3 Evo', '포뮬러 E Gen4', 'GT3']);
  const hy = await page('track=monza&car=hyper-ferrari'), mk = opts(hy, 'car');
  assert.match(hy, /<option value="hyper" selected>Hypercar\/GTP/); assert.doesNotMatch(hy, /data-ls="carWrap" hidden/);
  assert.ok(mk.length >= 10 && mk.at(-2).v === 'wec-lmh' && mk.at(-1).v === 'wec-lmdh' && mk.slice(0, -2).every(o => o.v.startsWith('hyper-')), mk.map(o => o.v).join());
  assert.match(mk[0].t, /^BoP 최속 예상 · 모델 · .+ — \d+ kg · \d+ kW \(/); assert.ok(mk.slice(1).every(o => !/최속/.test(o.t)));
  assert.match(await page('track=monza&car=wec-lmh'), /<option value="wec-lmh" selected>LMH \(클래스 기준\)/);
  assert.ok(opts(f1, 'series').every(o => !o.off));
  assert.deepEqual(opts(f1, 'car').map(o => o.v), ['2026']);
  assert.match(f1, /data-ls="carWrap" hidden/, 'the model menu is for GT3 and Hypercar/GTP only');
  assert.match(fe, /<option value="fe-gen4" selected/);
  assert.match(wec, /<option value="gt3" selected/, 'the WEC LMGT3 car sits under GT3');
  assert.match(f1, /<optgroup label="Hypercar\/GTP">/, 'compare lists every series');
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
