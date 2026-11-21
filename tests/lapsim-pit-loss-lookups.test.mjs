import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const L = JSON.parse(readFileSync(new URL('../scripts/sim/data/pit-loss-lookups.json', import.meta.url), 'utf8'));

test('pit-loss lookups (W3-F): 112 race-years, Sepang 2026 under kuala-lumpur, the reviewed outliers corrected', () => {
  assert.equal(Object.values(L.tracks).reduce((n, t) => n + Object.keys(t).length, 0), 112);
  assert.ok(L.tracks['kuala-lumpur']?.['2026'], 'Sepang 2026 race stored under kuala-lumpur');
  assert.ok(!L.tracks.sakhir?.['2026'], 'no 2026 race at Sakhir');
  for (const [k, s] of [['spa-francorchamps 2025', 22.1315], ['montreal 2026', 23.375], ['monte-carlo 2024', 21.3915], ['suzuka 2026', 22.5845]]) {
    const [id, y] = k.split(' '); assert.equal(L.tracks[id][y].s, s, k);
  }
  for (const t of Object.values(L.tracks)) for (const r of Object.values(t)) assert.ok(r.s > 10 && r.s < 100 && ['dry', 'wet'].includes(r.condition));
});

test('pit-loss lookups replay exactly where 10+ stops were measured, else the race fit keeps its own value', async () => {
  const {lapsimRace: R} = await import('../worker/lapsim/race-data.js');
  let used = 0;
  for (const [id, ys] of Object.entries(L.tracks)) for (const [y, v] of Object.entries(ys)) { const r = R.races?.[id]?.[y]; if (!r) continue;
    if (v.n >= 10) { assert.equal(r.pitLoss, v.s, `${id} ${y}`); used++; } else assert.notEqual(r.pitLoss, v.s, `${id} ${y} (n ${v.n}) must not be used`); }
  assert.ok(used > 60, String(used));
});
