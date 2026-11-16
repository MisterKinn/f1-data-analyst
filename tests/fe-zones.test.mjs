import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimFeZones as Z} from '../worker/lapsim/fe-zones-data.js';
import {lapsimFeTracks} from '../worker/lapsim/fe-tracks-data.js';
import {lapsimTracks} from '../worker/lapsim/tracks-data.js';
import {simulationPage} from '../worker/simulation.js';

test('Formula E Attack Zones: Gen3 Evo and Gen4 on every Formula E track, estimated elsewhere', () => {
  for (const [id, t] of Object.entries(lapsimFeTracks)) for (const g of ['gen3evo', 'gen4']) {
    const z = Z.tracks[id]?.[g]; assert.ok(z, `${id} ${g}`); assert.equal(z.kind, 'attack');
    const L = t.kappa.length * t.ds; for (const q of z.zones) assert.ok(q.from >= 0 && q.from < L && q.to >= 0 && q.to < L, `${id} inside the lap`);
  }
  assert.equal(Z.tracks['fe-london'].gen3evo.est, false, 'London: printed on the official circuit map');
  assert.equal(Z.tracks['fe-london'].gen4.est, true, 'Gen4: no Gen4 map yet');
  assert.equal(Z.tracks.monza.gen3evo.est, true, 'non-Formula E track: virtual zone');
  assert.ok(Object.keys(lapsimTracks).every(id => Z.tracks[id]), 'every simulator track has a zone');
});

test('Formula E car shows its Attack Zone on the map; an F1 car does not', () => {
  const fe = simulationPage({track: 'fe-london', car: 'fe-gen3evo'}, 'en'), f1 = simulationPage({track: 'fe-london', car: 'f1-2026'}, 'en');
  assert.match(fe, /class="ls-zone ls-zone-attack"/);
  assert.doesNotMatch(f1, /class="ls-zone ls-zone-attack"/);
});
