import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimWecBop} from '../worker/lapsim/wec-bop-data.js';

const json = JSON.parse(readFileSync(new URL('../scripts/sim/data/wec-bop.json', import.meta.url), 'utf8'));

test('wec-bop-data.js mirrors scripts/sim/data/wec-bop.json exactly', () => {
  assert.deepEqual(lapsimWecBop, json);
});

test('Le Mans 2025 BMW M Hybrid V8 matches FIA decision D29 (+2.0% above 250 km/h)', () => {
  const r = lapsimWecBop['le-mans']['2025'];
  assert.match(r.source, /WEC_2025_D29_Hypercar_BOP/);
  assert.deepEqual(r.cars['BMW M Hybrid V8'], {cls: 'lmdh', kg: 1039, kW: 510, MJ: 919, above250: 2, dock: null});
});
