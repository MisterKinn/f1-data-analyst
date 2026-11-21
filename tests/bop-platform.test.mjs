import test from 'node:test';
import assert from 'node:assert/strict';
import {bopPlatform as P} from '../worker/lapsim/bop-platform-data.js';
import {bopPage} from '../worker/bop-page.js';

test('BoPSim shows the W16 LMH vs LMDh diagnostic with its sign check (✗ shown)', () => {
  assert.deepEqual(P.wec['spa-francorchamps'].qualifying, {measured: 0.418, measuredBest: -0.222, sim: -0.629, events: 4, wrong: true});
  const en = bopPage({event: 'SPA'}, 'en');
  assert.match(en, /LMH vs LMDh: measured vs simulator \(diagnostic\)/); assert.match(en, /<td>✗<\/td>/);
  assert.match(bopPage({event: 'SPA'}, 'ko'), /LMH 대 LMDh: 실측과 시뮬레이터 \(진단\)/);
});
