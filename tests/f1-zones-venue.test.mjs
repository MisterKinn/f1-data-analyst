import test from 'node:test';
import assert from 'node:assert/strict';
import {movedVenue} from '../scripts/sim/zones-venue.mjs';
import {lapsimF1Zones} from '../worker/lapsim/f1-zones-data.js';

const doc = url => ({docs: [{url, title: ''}]});
// owner 2026-11-15: Sepang's zones were drawn on Sakhir ("2026 Bahrain Grand Prix in Malaysia")
test('FIA documents follow the venue where the event was held', () => {
  assert.equal(movedVenue({year: 2026, ...doc('https://www.fia.com/x/2026_bahrain_grand_prix_in_malaysia_-_competition_notes_-_circuit_map.pdf')}), null);
  assert.equal(movedVenue({year: 2026, ...doc('https://www.fia.com/x/2026_spanish_grand_prix_-_competition_notes.pdf')}), 'madring');
  assert.equal(movedVenue({year: 2026, ...doc('https://www.fia.com/x/2026_british_grand_prix_-_competition_notes.pdf')}), undefined);
  const Z = lapsimF1Zones.tracks || lapsimF1Zones;
  assert.ok(!Z.sakhir?.['2026'], 'Sakhir had no 2026 F1 race');
  assert.ok(!/in_malaysia|spanish/i.test(Z.catalunya?.['2026']?.url || ''), 'Catalunya 2026 is the Barcelona-Catalunya GP document');
});
