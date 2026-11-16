import test from 'node:test';
import assert from 'node:assert/strict';
import {bopPage} from '../worker/bop-page.js';
import {bopImsa} from '../worker/lapsim/bop-imsa-data.js';
import {bopVirtual} from '../worker/lapsim/bop-virtual-data.js';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';

const strip = h => h.replace(/<script[\s\S]*?<\/script>/g, '');

test('IMSA official BoP: 2024-2026 events, values from the bulletins', () => {
  const lag = bopImsa.events.find(e => e.year === 2026 && e.event === 'LAGUNA');
  assert.equal(lag.gtp['Porsche 963 (2026 spec)'].kg, 1084); assert.equal(lag.gtd['Ferrari 296 GT3'].kg, 1350); assert.equal(lag.gtd['McLaren 720S GT3 EVO'].wingMax, 11.3);
  assert.ok(bopImsa.events.filter(e => e.year === 2025).length >= 11);
  assert.match(strip(bopPage({series: 'imsa', class: 'gtp', year: '2026', event: 'laguna'}, 'en')), /Official BoP[\s\S]*1084/);
});

test('virtual BoP: every circuit for every class, error reported on held-out circuits', () => {
  const tracks = Object.keys(lapsimAllTracks).filter(k => !k.startsWith('fe-'));
  for (const [k, C] of Object.entries(bopVirtual.classes)) {
    for (const t of tracks) assert.ok(C.values.kg[t] && Object.keys(C.values.kg[t]).length, `${k} ${t}`);
    for (const f of C.fields) assert.ok(C.holdout[f].model != null && C.holdout[f].carMeanOnly != null, `${k} ${f}`);
  }
  const h = strip(bopPage({mode: 'virtual', class: 'imsa-gtd', track: 'yeongam'}, 'en'));
  assert.match(h, /Virtual BoP/); assert.ok(!/undefined|NaN/.test(h));
});

test('real and virtual tabs on every BoP page', () => {
  for (const q of [{}, {series: 'wec', class: 'lmgt3'}, {series: 'elms'}, {series: 'imsa'}, {mode: 'virtual'}]) {
    const h = strip(bopPage(q, 'en')); assert.match(h, /Real BoP[\s\S]*Virtual BoP/, JSON.stringify(q)); assert.ok(!/undefined|NaN/.test(h), JSON.stringify(q));
  }
});
