import test from 'node:test';
import assert from 'node:assert/strict';
import {trackLabel, trackOrder, isCandidate, evoPairs, carEvent} from '../worker/simulator-controls.js';
import {simulationPage} from '../worker/simulation.js';
import {lapsimAllTracks as lapsimTracks} from '../worker/lapsim/tracks.js';
import {carsFor, realConditions, CAR_ORDER} from '../worker/lapsim/scenario.js';

const OWNER = {melbourne: 'AUS - Melbourne', 'spa-francorchamps': 'BEL - Spa', sakhir: 'BHA - Bahrain', 'sakhir-outer': 'BHA - Bahrain(Outer)',
  interlagos: 'BRA - Interlagos', montreal: 'CAN - Montreal', 'le-mans': 'FRA - Le Mans', silverstone: 'GBR - Silverstone', monza: 'ITA - Monza',
  mugello: 'ITA - Mugello', yeongam: 'KOR - Yeongam', 'mexico-city': 'MEX - Mexico City', rwanda: 'RWA - Rwanda⚠️', austin: 'USA - COTA',
  indianapolis: 'USA - Indianapolis', 'las-vegas': 'USA - Las Vegas', sebring: 'USA - Sebring', 'road-atlanta': 'USA - Road Atlanta'};

test('track labels use the owner format (no flag): 3-letter code, " - ", name', () => {
  for (const [id, label] of Object.entries(OWNER)) assert.equal(trackLabel(id), label);
});

test('every track in the simulator data has a label in that format', () => {
  for (const id of Object.keys(lapsimTracks)) assert.match(trackLabel(id, lapsimTracks[id]), /^[A-Z]{3} - \S.*$/u, id);
});

test('tracks are sorted by the 3-letter code, then by name', () => {
  const ids = trackOrder(Object.fromEntries(Object.keys(OWNER).reverse().map(id => [id, {}])));
  assert.deepEqual(ids.map(id => trackLabel(id)), ['AUS - Melbourne', 'BEL - Spa', 'BHA - Bahrain', 'BHA - Bahrain(Outer)', 'BRA - Interlagos',
    'CAN - Montreal', 'FRA - Le Mans', 'GBR - Silverstone', 'ITA - Monza', 'ITA - Mugello', 'KOR - Yeongam', 'MEX - Mexico City', 'RWA - Rwanda⚠️',
    'USA - COTA', 'USA - Indianapolis', 'USA - Las Vegas', 'USA - Road Atlanta', 'USA - Sebring']);
});

test('a map-built candidate track shows the warning mark, a surveyed one does not', () => {
  assert.equal(isCandidate(lapsimTracks.monza), false);
  assert.equal(trackLabel('monza', lapsimTracks.monza), 'ITA - Monza');
  assert.equal(trackLabel('mugello', {candidate: true}), 'ITA - Mugello⚠️');
  assert.equal(trackLabel('mugello', {sources: ['OpenStreetMap raceway centre line']}), 'ITA - Mugello⚠️');
  assert.equal(trackLabel('rwanda', {candidate: true}), 'RWA - Rwanda⚠️'); // never doubled
});

test('the page lists only tracks that exist in the data, with the new labels', () => {
  const html = simulationPage({track: 'monza'}, 'en');
  const opts = [...html.match(/<select name="track"[^>]*>(.*?)<\/select>/s)[1].matchAll(/<option value="([^"]+)"[^>]*>([^<]+)</g)].map(m => [m[1], m[2]]);
  assert.deepEqual(opts.map(o => o[0]), trackOrder(lapsimTracks));
  assert.equal(opts.length, Object.keys(lapsimTracks).length);
  assert.ok(opts.some(o => o[1] === 'ITA - Monza'));
  assert.ok(opts.some(o => o[1] === 'FRA - Le Mans') && opts.some(o => o[1] === 'RWA - Rwanda⚠️')); // extra circuits: passed the check / provisional
  assert.ok(opts.some(o => o[1] === 'USA - Las Vegas') && !opts.some(o => /[\u{1F1E6}-\u{1F1FF}]/u.test(o[1]))); // no flag in the track list
  for (const [id, label] of opts) assert.equal(label.endsWith('⚠️'), lapsimTracks[id].fit === false || id === 'rwanda', id); // ⚠️ only on a track that failed its check
});

test('Evo tick box: paired only with a real Evo entry of the same base car', () => {
  const cars = {
    a: {series: 'gtwc', cls: 'gt3', base: 'porsche 911 gt3 r', evo: null, label: '911 GT3 R'},
    b: {series: 'gtwc', cls: 'gt3', base: 'porsche 911 gt3 r', evo: 'evo', label: '911 GT3 R Evo'},
    c: {series: 'gtwc', cls: 'gt3', base: 'bmw m4 gt3', evo: null, label: 'M4 GT3'},
    d: {series: 'dtm', cls: 'gt3', base: 'bmw m4 gt3', evo: 'evo', label: 'M4 GT3 Evo'}, // other series: not a pair
  };
  assert.deepEqual(evoPairs(cars, ['a', 'b', 'c', 'd']), {a: 'b'});
});

test('Evo tick box is disabled with a hint when the data has no Evo entry (never invented)', () => {
  assert.deepEqual(evoPairs(carsFor('monza'), CAR_ORDER), {});
  const html = simulationPage({track: 'monza'}, 'en');
  assert.match(html, /<input type="checkbox" name="evo" value="1" data-ls="evo" disabled>/);
  assert.match(html, /data-ls="evoHint">No Evo data for this car</);
});

test('event defaults come from the calendar event of the car\'s own series at that track', () => {
  const at = (id, key) => carEvent(id, key, carsFor(id)[key], realConditions(id));
  assert.deepEqual(at('monza', '2026'), {name: '이탈리아 그랑프리', nameEn: 'Italian Grand Prix', start: '2026-09-04', end: '2026-09-06', weatherYear: 2026});
  assert.deepEqual(at('monza', 'wec-lmh'), {name: '몬자 6시간', nameEn: '6 Hours of Monza', start: '2026-11-06', end: '2026-11-08', weatherYear: 2026});
  // WEC at Bahrain: the 8 Hours of Bahrain, not a Grand Prix; the weather in the data is the 2025 session
  const b = at('sakhir', 'wec-lmh');
  assert.equal(b.nameEn, '8 Hours of Bahrain'); assert.equal(b.weatherYear, 2025);
});

test('no event or no own weather in the data: nothing new is shown', () => {
  const at = (id, key) => carEvent(id, key, carsFor(id)[key], realConditions(id));
  assert.equal(at('sakhir', '2025'), null); // no F1 event at Sakhir in the calendar data
  assert.equal(at('monza', '2027'), null); // projected car: no weather of its own
  assert.equal(at('monza', 'base2019'), null);
  const html = simulationPage({track: 'sakhir', car: '2025'}, 'en');
  assert.match(html, /data-ls="event" hidden>/);
});
