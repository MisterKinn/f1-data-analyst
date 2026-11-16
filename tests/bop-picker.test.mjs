import test from 'node:test';
import assert from 'node:assert/strict';
import {bopPage} from '../worker/bop-page.js';

// the real tab's picker (the page also holds the virtual tab, owner 2026-11-16)
const realOf = h => h.includes('id="bop-panel-virtual"') ? h.slice(0, h.indexOf('id="bop-panel-virtual"')) : h;
const chosen = h => [...realOf(h).matchAll(/<option value="([^"]*)" selected>/g)].map(m => m[1]);
const options = (h, name) => [...(realOf(h).match(new RegExp(`<select name="${name}"[^>]*>([\\s\\S]*?)</select>`)) || [, ''])[1].matchAll(/value="([^"]*)"/g)].map(m => m[1]);

test('BoP picker: Series → Class → Year → Event dropdowns, with safe defaults', () => {
  assert.deepEqual(chosen(bopPage({}, 'en')), ['wec', 'hypercar', '2026', 'imola']);
  assert.deepEqual(chosen(bopPage({series: 'nope', class: 'x', year: '1990', event: '<b>'}, 'en')), ['wec', 'hypercar', '2026', 'imola']);
  assert.equal(chosen(bopPage({event: 'spa'}, 'en')).at(-1), 'spa');
  assert.deepEqual(options(bopPage({}, 'en'), 'class'), ['hypercar', 'lmgt3']);
  assert.doesNotMatch(bopPage({}, 'en'), /font-style:italic/);
});

test('2027: all nine announced rounds, for Hypercar and LMGT3', () => {
  const rounds = ['losail', 'imola', 'silverstone', 'spa', 'lemans', 'saopaulo', 'cota', 'fuji', 'bahrain'];
  for (const cls of ['hypercar', 'lmgt3']) {
    const p = bopPage({class: cls, year: '2027'}, 'en');
    assert.deepEqual(options(p, 'event'), rounds, cls);
    assert.match(bopPage({class: cls, year: '2027', event: 'bahrain'}, 'en'), /8 Hours of Bahrain · 2027 BoP projection/);
  }
});

test('LMGT3 table: every 2026 car with weight, power curve and gain', () => {
  const p = bopPage({class: 'lmgt3', event: 'fuji'}, 'en');
  for (const car of ['Ferrari 296 LMGT3', 'Porsche 911 GT3 R LMGT3', 'Mercedes-AMG LMGT3']) assert.ok(p.includes(car), car);
  assert.match(p, />P\d+ </);
});

test('ELMS LMGT3: published tables are official, only the unpublished 2026 events are estimated', () => {
  assert.deepEqual(options(bopPage({series: 'elms'}, 'en'), 'class'), ['lmgt3'], 'no LMP2 / LMP3');
  assert.match(bopPage({series: 'elms', event: 'barcelona'}, 'en'), /Official BoP \(published decision\)/);
  const spa = bopPage({series: 'elms', event: 'spa'}, 'en');
  assert.match(spa, /2026 estimated BoP/); assert.match(spa, /±/);
  assert.deepEqual(options(bopPage({series: 'elms', year: '2027'}, 'en'), 'event'), ['barcelona', 'paulricard', 'imola', 'spa', 'silverstone', 'portimao']);
});
