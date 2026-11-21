import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimEnergyDocs} from '../worker/lapsim/energy-docs-data.js';

// 2026 maximum recharge per lap (MJ) from each event's FIA "Power Unit Information" document, as read independently by the
// 2026-11-18 W7 review (qualifying, race overtake off, race overtake on). The stored table must match every event.
const W7 = {
  'melbourne': [7, 8, 8.5],
  'shanghai': [9, 8.5, 9],
  'suzuka': [8, 8.5, 9],
  'miami': [8, 8.5, 9],
  'montreal': [6, 8, 8.5],
  'monte-carlo': [9, 8.5, 9],
  'catalunya': [7, 8.5, 9],
  'spielberg': [6, 8, 8.5],
  'silverstone': [6.5, 8, 8.5],
  'spa-francorchamps': [7, 8.5, 9],
  'hungaroring': [9, 8.5, 9],
  'zandvoort': [7.5, 8.5, 9],
  'monza': [5, 7, 7.5],
  'madring': [7.5, 8.5, 9],
  'baku': [8.5, 8.5, 9],
  'kuala-lumpur': [7.5, 8.5, 9],
  'singapore': [9, 8.5, 9],
  'austin': [8.5, 8.5, 9],
  'mexico-city': [8.5, 8.5, 9],
  'interlagos': [6.5, 8, 8.5],
};

test('2026 energy limits: qualifying and race (overtake off/on) match the FIA PU documents for all 20 events', () => {
  const ev = lapsimEnergyDocs['2026'];
  for (const [id, [q, race, ot]] of Object.entries(W7)) {
    assert.ok(ev[id], `${id}: no PU document stored`);
    assert.deepEqual([ev[id].qualiMJ, ev[id].raceMJ, ev[id].raceOvertakeMJ], [q, race, ot], id);
  }
});
