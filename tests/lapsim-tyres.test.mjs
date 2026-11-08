import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {lapsimCompounds} from '../worker/lapsim/compounds-data.js';

const page = async q => (await worker.fetch(new Request('https://example.com/simulation?' + q), {})).text();
const tyres = h => (h.match(/data-ls="tyre">(.*?)<\/select>/) || [])[1].match(/value="(\w+)"/g).map(v => v.slice(7, -1));

test('each series offers only the tyres it really has', async () => {
  assert.deepEqual(tyres(await page('track=monza&car=2026')), ['soft', 'medium', 'hard', 'inter', 'wet']);
  for (const car of ['wec-lmh', 'wec-lmdh']) assert.deepEqual(tyres(await page('track=monza&car=' + car)), ['soft', 'medium', 'hard', 'wet'], car);
  assert.deepEqual(tyres(await page('track=monza&car=wec-lmgt3')), ['medium', 'wet']);
});

test('Pirelli nominations are C-numbers, hard to soft, and name the race strategies', async () => {
  for (const [id, years] of Object.entries(lapsimCompounds)) for (const [y, c] of Object.entries(years)) {
    assert.equal(c.length, 3, `${id} ${y}`);
    const n = c.map(x => +x.slice(1)); assert.ok(n[0] < n[1] && n[1] < n[2], `${id} ${y} ${c}`);
  }
  const [id, years] = Object.entries(lapsimCompounds).find(([, y]) => y[2026]) || [];
  if (!id) return;
  const h = await page('track=' + id + '&car=2026');
  for (const c of years[2026]) assert.match(h, new RegExp('>(소프트|미디엄|하드) ' + c + '<'));
});
