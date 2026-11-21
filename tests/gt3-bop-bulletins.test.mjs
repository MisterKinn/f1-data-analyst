import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rows = f => { const [h, ...r] = readFileSync(`scripts/sim/data/learn/gt3-bop/${f}`, 'utf8').trim().split('\n'); return r.length; };

test('W13 GT3 BoP bulletins: 296 signed rows with their scope, press-only rows kept apart', () => {
  assert.equal(rows('igtc-weights.csv') + rows('nls-weights.csv'), 296);
  const nls = readFileSync('scripts/sim/data/learn/gt3-bop/nls-weights.csv', 'utf8');
  assert.match(nls, /2023-04-01,Lamborghini Huracan GT3 EVO2,2023,[^,]*,1320,/); // organiser PDF NLS2 Rev 1
  assert.match(readFileSync('scripts/sim/data/learn/gt3-bop/press-only-not-official.csv', 'utf8'), /exclude from official lookup/);
});
