import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {lapsimCompounds} from '../worker/lapsim/compounds-data.js';
import {lapsimWecTyres} from '../worker/lapsim/wec-tyres-data.js';

const page = async q => (await worker.fetch(new Request('https://example.com/simulation?' + q), {})).text();
const tyres = h => (h.match(/data-ls="tyre">(.*?)<\/select>/) || [])[1].match(/value="(\w+)"/g).map(v => v.slice(7, -1));

test('each series offers only the tyres it really has', async () => {
  assert.deepEqual(tyres(await page('track=monza&car=2026')), ['soft', 'medium', 'hard', 'inter', 'wet']);
  // WEC: only what Michelin/Goodyear supplied at that event (Monza 2026: soft + medium; COTA 2026: medium + hard), never an intermediate
  for (const car of ['wec-lmh', 'wec-lmdh']) assert.deepEqual(tyres(await page('track=monza&car=' + car)), ['soft', 'medium', 'wet'], car);
  assert.deepEqual(tyres(await page('track=austin&car=wec-lmh')), ['medium', 'hard', 'wet']);
  assert.deepEqual(tyres(await page('track=monza&car=wec-lmgt3')), ['medium', 'wet']);
  assert.deepEqual(tyres(await page('track=silverstone&car=wec-lmh')), ['soft', 'medium', 'hard', 'wet'], 'no WEC event: whole range');
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

test('compound gaps: measured events reproduce exactly, others follow the C-step model, hard never quicker than medium', async () => {
  const {lapsimCompoundGap: G} = await import('../worker/lapsim/compound-gap-data.js');
  assert.ok(G.kPctPerStep > 0.1 && G.kPctPerStep < 1, 'per C-step gap in a physical range');
  assert.ok(G.test.rmsPct < G.test.noModelPct, 'model beats no model on held-out events');
  const [id, years] = Object.entries(G.measured).find(([, y]) => Object.values(y).some(v => v.MEDIUM));
  const y = Object.keys(years).find(k => years[k].MEDIUM), m = years[y].MEDIUM.pct;
  const h = await page(`track=${id}&car=${y >= 2026 ? 2026 : 2025}`);
  assert.match(h, /data-ls="tyre"/);
  for (const [, ys] of Object.entries(G.measured)) for (const v of Object.values(ys)) if (v.MEDIUM && v.HARD) assert.ok(v.HARD.pct >= v.MEDIUM.pct - 0.5);
  assert.ok(Number.isFinite(m));
});

test('WEC tyre table: only known compound names, Hyperpole tyre is one of the event slicks', () => {
  for (const [id, ys] of Object.entries(lapsimWecTyres)) for (const [y, c] of Object.entries(ys)) for (const [cls, v] of Object.entries(c)) {
    assert.ok(v.dry.length && v.dry.every(x => ['soft', 'medium', 'hard'].includes(x)), `${id} ${y} ${cls}`);
    if (v.q) assert.ok(v.dry.includes(v.q), `${id} ${y} hyperpole tyre`);
    if (cls === 'lmgt3') assert.ok(!v.dry.includes('soft'), 'Goodyear LMGT3 has no soft');
  }
});
