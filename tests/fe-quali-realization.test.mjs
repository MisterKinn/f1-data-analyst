import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FE_QUALI_REALIZATION as F} from '../worker/lapsim/fe-cars.js';
import {lapsimFe} from '../worker/lapsim/fe-data.js';

test('FE group laps use the W12 realised share of the simulated 300 → 350 kW gain', () => {
  assert.deepEqual(F, {'fe-gen3': 0.6925, 'fe-gen3evo': 0.7737});
  assert.match(readFileSync('scripts/sim/learn/build-fe.mjs', 'utf8'), /FE_QUALI_REALIZATION\[key\]/);
  // the learned fit does not get worse with it (event-hidden and layout-hidden error, %)
  assert.ok(lapsimFe.heldOutPct['fe-gen3evo'].event <= 2.49 && lapsimFe.heldOutPct['fe-gen3evo'].layoutOut <= 4.07);
});
