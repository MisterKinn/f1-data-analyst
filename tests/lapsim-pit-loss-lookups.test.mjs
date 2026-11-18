import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const L = JSON.parse(readFileSync(new URL('../scripts/sim/data/pit-loss-lookups.json', import.meta.url), 'utf8'));

test('pit-loss lookups (W3-F): 112 race-years, Sepang 2026 under kuala-lumpur, the reviewed outliers corrected', () => {
  assert.equal(Object.values(L.tracks).reduce((n, t) => n + Object.keys(t).length, 0), 112);
  assert.ok(L.tracks['kuala-lumpur']?.['2026'], 'Sepang 2026 race stored under kuala-lumpur');
  assert.ok(!L.tracks.sakhir?.['2026'], 'no 2026 race at Sakhir');
  for (const [k, s] of [['spa-francorchamps 2025', 22.131], ['montreal 2026', 23.375], ['monte-carlo 2024', 21.392], ['suzuka 2026', 22.584]]) {
    const [id, y] = k.split(' '); assert.equal(L.tracks[id][y].s, s, k);
  }
  for (const t of Object.values(L.tracks)) for (const r of Object.values(t)) assert.ok(r.s > 10 && r.s < 100 && ['dry', 'wet'].includes(r.condition));
});
