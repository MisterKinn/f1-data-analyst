// Learning step (docs/lapsim-learn.md): track identity, car-model identity, the car table builder and what the page reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTrack, registry} from '../scripts/sim/learn/track-registry.mjs';
import {modelOf} from '../scripts/sim/learn/models.mjs';
import {parseCsv, sessionCars, wx} from '../scripts/sim/learn/build-endurance.mjs';
import {fit} from '../scripts/sim/learn/fit-endurance.mjs';
import {lapsimLearned} from '../worker/lapsim/learned-data.js';
import {lapsimTracks, lapsimExtraTracks} from '../worker/lapsim/tracks-data.js';
import {carsFor, CAR_ORDER, raceRecords} from '../worker/lapsim/scenario.js';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';
import {simulationPage} from '../worker/simulation.js';
import {simulate} from '../worker/lapsim/tool.js';
import {evoPairs} from '../worker/simulator-controls.js';

test('track identity: one id per layout, and the cases that once went wrong', () => {
  const r = q => resolveTrack(q);
  assert.equal(r({name: 'Formula 1 Aramco Grosser Preis der Eifel 2020', lengthKm: 5.148, season: 2020}).sim, 'nurburgring-gp'); // F1 raced the Nürburgring
  assert.equal(r({name: 'Hockenheimring', lengthKm: 4.574, season: 2019}).sim, 'hockenheim');                                    // and Hockenheim
  assert.equal(r({name: 'Sakhir Grand Prix', lengthKm: 3.543, season: 2020}).sim, 'sakhir-outer');                               // Outer layout is not the Grand Prix layout
  assert.equal(r({name: 'Bahrain Grand Prix', season: 2025}).sim, 'sakhir');
  assert.equal(r({name: 'Grand Prix de France', lengthKm: 5.842}).sim, 'paul-ricard-f1');
  const elms = r({name: 'paul-ricard', lengthKm: 5.771, season: 2023});                                                           // ELMS layout: its own id, F1 geometry only as a neighbour
  assert.equal(elms.layout, 'paul-ricard-5771'); assert.equal(elms.sim, null); assert.equal(elms.near, 'paul-ricard-f1');
  assert.equal(r({name: 'barcelona-catalunya', lengthKm: 4.675, season: 2022}).sim, null);                                        // with the chicane: not the 2023+ track
  assert.equal(r({name: 'LE MANS', lengthKm: 13.626}).sim, 'le-mans');
  assert.equal(r({name: 'Nürburgring 24h', lengthKm: 25.378}).sim, 'nurburgring-24h');
  assert.equal(r({name: '24H Dubai'}).venue, 'dubai');                                                                             // "24h" alone is not the Nordschleife
  assert.equal(r({name: 'Some New Autodrome'}).venue, null);
  assert.match(r({name: 'Silverstone', lengthKm: 2.9}).how, /new layout/);                                                         // an unknown layout is reported, never mapped to the Grand Prix track
});

test('every simulator track is exactly one layout of the registry', () => {
  const sims = registry().layouts.filter(l => l.sim).map(l => l.sim);
  assert.deepEqual([...sims].sort(), Object.keys({...lapsimTracks, ...lapsimExtraTracks}).sort());
  assert.equal(new Set(sims).size, sims.length);
});

test('map outline of every extra track is a closed loop (Sakhir Outer, Paul Ricard, Nürburgring GP were drawn open)', () => {
  for (const [id, t] of Object.entries(lapsimExtraTracks)) { const n = t.map.x.length, step = t.length / n, gap = Math.hypot(t.map.x[0] - t.map.x[n - 1], t.map.y[0] - t.map.y[n - 1]);
    assert.ok(gap < 2.5 * step + 5, `${id}: outline ends ${gap.toFixed(0)} m from its start`); }
});

test('car models: Evo kit, generation and class are part of the identity', () => {
  assert.equal(modelOf('BMW M4 GT3 EVO', 2025, 'GTD').key, 'BMW M4 GT3 +EVO');
  assert.equal(modelOf('BMW M4 LMGT3', 2024, 'LMGT3').key, 'BMW M4 GT3');
  assert.equal(modelOf('Lamborghini Huracan GT3 EVO2', 2024, 'GTD').evo, 'evo2');
  assert.equal(modelOf('Porsche 911 GT3R', 2022, 'GTD').key, 'Porsche 911 GT3 R (991.2)');
  assert.equal(modelOf('Porsche 911 GT3 R LMGT3', 2024, 'LMGT3').key, 'Porsche 911 GT3 R (992)');
  assert.equal(modelOf('Cadillac V-LMDh', 2023, 'GTP').key, 'Cadillac V-Series.R');
  assert.equal(modelOf('Aston Martin Vantage AMR', 2022, 'LMGTE AM'), null); // a GTE car is not a GT3 car
  assert.equal(modelOf('', 2025, 'GTD'), null);                             // no text: nothing is guessed
});

test('car table: clean laps only, and weather units by plausibility', () => {
  const laps = parseCsv('NUMBER;LAP_TIME;CROSSING_FINISH_LINE_IN_PIT;S1;S2;S3;KPH;TOP_SPEED;PIT_TIME;CLASS;TEAM;MANUFACTURER;FLAG_AT_FL\n7;1:40.000;;30.000;40.000;30.000;180;;0:01:00;GTD;T;Porsche;GF\n7;1:30.000;;28.000;34.000;28.000;200;270;;GTD;T;Porsche;GF\n7;1:29.000;;28.000;33.000;28.000;202;271;;GTD;T;Porsche;FCY\n7;1:35.000;B;28.000;34.000;33.000;190;;;GTD;T;Porsche;GF\n');
  const [c] = sessionCars(laps, parseCsv('NUMBER,VEHICLE,TIRES\n7,"Porsche 911 GT3 R (992)",M\n'), [], 'imsa');
  assert.equal(c[2], 'Porsche 911 GT3 R (992)'); assert.equal(c[6], '90.000'); assert.equal(c[12], '5.000'); assert.equal(c[14], 1); // out lap, yellow lap and in lap are not clean
  const w = (air, trk, series) => wx([{AIR_TEMP: air, TRACK_TEMP: trk, PRESSURE: 1013}], series);
  assert.ok(Math.abs(w(67.1, 85.8, 'wec').airC - 19.5) < 0.1);   // °F
  assert.equal(w(19.5, 29.9, 'wec').airC, 19.5);                 // already °C
  assert.ok(Math.abs(w(152.8, 186.4, 'wec').airC - 19.5) < 0.1); // converted twice in the archive
  assert.ok(Math.abs(w(41, 50, 'imsa').airC - 5) < 0.1);         // IMSA is °F at the source, also on a cold day
});

test('fit: recovers a known track offset and car-model gap', () => {
  const rows = []; for (const [layout, t] of [['a', 0.03], ['b', -0.02], ['c', 0.01]]) for (const [model, m] of [['X', 0], ['Y', 0.01]]) for (const season of [2024, 2025, 2026])
    rows.push({group: 'gt3', series: 'imsa', season, layout, model, z: 0, eventKey: layout + season, sim0: 100, real: 100 * Math.exp(t + m), y: t + m});
  const f = fit(rows), p = (layout, model) => f.predict({group: 'gt3', series: 'imsa', season: 2026, layout, model, z: 0, sim0: 100});
  assert.ok(Math.abs(p('a', 'Y') / (100 * Math.exp(0.04)) - 1) < 0.002);
  assert.ok(Math.abs(p('b', 'Y') / p('b', 'X') - Math.exp(0.01)) < 0.003);
});

test('learned data: held-out error is lower than before, in every class', () => {
  for (const [g, h] of Object.entries(lapsimLearned.heldOutPct)) { assert.ok(h.n >= 5, g); assert.ok(h.event < h.before, `${g}: ${h.event} % against ${h.before} % before`); }
});

test('page and tool: GT3 per car model with an Evo pair; raced sessions still reproduce', () => {
  const cars = carsFor('watkins-glen'), keys = CAR_ORDER.filter(k => k.startsWith('gt3-'));
  assert.ok(keys.length >= 10); for (const k of keys) { assert.equal(cars[k].series, 'gt3'); assert.ok(cars[k].timeScale > 0.8 && cars[k].timeScale < 1.2, k); }
  assert.equal(evoPairs(cars, CAR_ORDER)['gt3-bmw-m4-gt3'], 'gt3-bmw-m4-gt3-evo');
  assert.equal(carsFor('monza')['2026'].timeScale, undefined);                         // F1 is untouched
  assert.equal(carsFor('spa-francorchamps')['wec-lmgt3'].timeScale, undefined);        // a class fitted on this track keeps its own calibration
  assert.equal(simulate({track: 'le-mans', car: 'wec-lmh'}).result.lap_seconds, 202.982); // fastest real LMH lap at Le Mans (Ferrari 499P, 2023)
  const g = simulate({track: 'le-mans', car: 'gt3-ferrari-296-gt3'}); assert.equal(g.status, 'ok'); assert.ok(g.result.lap_seconds > 225 && g.result.lap_seconds < 245);
});

// Owner rule 2026-11-14 (docs/lapsim-learn.md rule 9): a car + track combination that really ran shows its FASTEST real lap,
// exactly, on the page and in the tool, in every category. Race laps: the fastest real race lap is shown too.
test('every car that raced on a track reproduces its fastest real lap exactly (page and tool)', () => {
  const fmt = s => { const m = Math.floor(s / 60); return (m ? m + ':' : '') + (s - m * 60).toFixed(3).padStart(m ? 6 : 5, '0'); };
  const keys = ['2025', '2026', 'wec-lmh', 'wec-lmdh', 'wec-lmgt3', ...CAR_ORDER.filter(k => k.startsWith('gt3-'))]; let n = 0;
  for (const id of Object.keys(lapsimAllTracks)) { const cars = carsFor(id), L = lapsimLearned.tracks[id];
    // a WEC pole stays unless WEC was faster; a lap of another series fills only an empty slot
    for (const k of keys) { const c = cars[k]; if (!c?.fix) continue; const want = c.fix.lap ?? c.fix.real.reduce((a, b) => a + b, 0); n++;
      const cr = L?.classReal?.[k], known = [k.startsWith('wec-') && cr?.series !== 'wec' && c.fix.series !== cr?.series ? NaN : cr?.lap, L?.real?.[k]?.lap, lapsimExtraTracks[id]?.realLaps?.[k]?.lap].filter(Number.isFinite);
      if (c.series) for (const v of known) assert.ok(want <= v + 5e-4, `${id} ${k}: shows ${want}, a faster real lap ${v} exists`);
      assert.ok(Math.abs(simulate({track: id, car: k}).result.lap_seconds - want) < 0.0015, `${id} ${k} tool`);
      assert.equal((simulationPage({track: id, car: k, evo: '0'}, 'en').match(/data-ls="lap"[^>]*>([^<]*)/) || [])[1], fmt(want), `${id} ${k} page`); } }
  assert.ok(n > 300, String(n));
  for (const [id, k] of [['road-atlanta', 'gt3-imsa-lamborghini-huracan-gt3'], ['daytona', 'wec-lmdh'], ['le-mans', 'wec-lmgt3']]) assert.ok(carsFor(id)[k].fix, `${id} ${k} raced there`);
});

test('fastest real race lap: F1 per season (f1db), endurance per car (Al Kamel), only on its own layout', () => {
  assert.equal(raceRecords('monza')['2025'].lap, 80.901);                       // Norris, Monza 2025
  assert.ok(raceRecords('road-atlanta')['gt3-imsa-lamborghini-huracan-gt3'].lap > 70);
  assert.ok(raceRecords('nurburgring-gp') && !raceRecords('nurburgring-gp')['2025']); // F1 raced there in 2020 only
  const sim = simulate({track: 'monza', car: '2025'}); assert.equal(sim.real_race_lap.lap_seconds, 80.901);
});
