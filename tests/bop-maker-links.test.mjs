import test from 'node:test';
import assert from 'node:assert/strict';
import {bopPage} from '../worker/bop-page.js';

test('BoPSim car rows link to the maker car in LapSim and SetupSim and show its LapSim gap (owner 2026-11-21)', () => {
  const h = bopPage({event: 'SPA'}, 'en');
  assert.match(h, /<a href="\/simulation\?track=spa-francorchamps&amp;car=hyper-ferrari">LapSim<\/a> · <a href="\/setup\?series=hypercar&amp;car=ferrari&amp;track=spa-francorchamps">Setup<\/a>/);
  for (const tb of h.split('<table').slice(1).filter(x => /bop-links/.test(x))) assert.equal((tb.match(/LapSim fastest/g) || []).length, 1, 'one fastest car per table');
  assert.match(h, /LapSim \+\d\.\d{3} s/);
  const a480 = (h.match(/<td>Alpine A480.*?<\/td>/) || [''])[0]; assert.doesNotMatch(a480, /hyper-alpine/, 'the grandfathered A480 is not the Alpine maker car');
  assert.match(bopPage({event: 'SPA'}, 'ko'), /랩심 최속/);
});
