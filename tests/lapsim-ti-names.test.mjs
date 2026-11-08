import test from 'node:test';
import assert from 'node:assert/strict';
import {tiTrack} from '../scripts/sim/ti-races.mjs';

test('TracingInsights event names map to the track ids (2026 Barcelona and Spanish GPs)', () => {
  assert.equal(tiTrack('Barcelona Grand Prix', 2026), 'catalunya');
  assert.equal(tiTrack('Barcelona-Catalunya Grand Prix', 2026), 'catalunya');
  assert.equal(tiTrack('Spanish Grand Prix', 2026), 'madring');
  assert.equal(tiTrack('Spanish Grand Prix', 2025), 'catalunya');
  assert.equal(tiTrack('São Paulo Grand Prix', 2026), 'interlagos');
});
