import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateLap, erskLimitW} from '../worker/lapsim/engine.js';
import {airDensity, tailwind, pressureFromAltitude, conditionsFromWeather} from '../worker/lapsim/atmosphere.js';
import {parseTrackChanges, applyTrackChanges, classifyChange} from '../worker/lapsim/track-changes.js';
import {headingCurvature, resampleClosed, kernelSmooth, alignClosed} from '../worker/lapsim/geometry.js';
import {autoStraights, trackFromData} from '../worker/lapsim/tracks.js';
import {TUM_2019, PRIOR, applyRules, applyDevelopment} from '../worker/lapsim/cars.js';

// Stadium-shaped test track: two 600 m straights joined by two 60 m-radius hairpins.
function stadium(ds = 5) {
  const R = 60, straight = 600, L = 2 * straight + 2 * Math.PI * R, n = Math.round(L / ds), kappa = new Float64Array(n);
  const step = L / n;
  for (let i = 0; i < n; i++) {
    const s = i * step % L;
    const inBend = (s > straight && s < straight + Math.PI * R) || s > 2 * straight + Math.PI * R;
    kappa[i] = inBend ? 1 / R : 0;
  }
  return {ds: step, kappa, aeroLow: autoStraights(kappa, step)};
}

test('2026 ERS-K power limit follows the C5.2.8 speed taper', () => {
  const kW = kph => erskLimitW('f1-2026', kph / 3.6, 350e3) / 1000;
  assert.equal(kW(200), 350);
  assert.equal(Math.round(kW(290)), 350);
  assert.equal(Math.round(kW(300)), 300);
  assert.equal(Math.round(kW(342)), 60);
  assert.equal(kW(346), 0);
  assert.equal(erskLimitW('f1-2014', 90, 120e3), 120e3);
});

test('air density: sea level and Mexico City qualifying', () => {
  const sea = airDensity({pressureHpa: 1013.25, tempC: 15, humidityPct: 0});
  assert.ok(Math.abs(sea - 1.225) < 0.002, String(sea));
  const mexico = airDensity({pressureHpa: 782, tempC: 26.4, humidityPct: 29.7});
  assert.ok(mexico > 0.89 && mexico < 0.92, String(mexico));
  assert.ok(Math.abs(pressureFromAltitude(2240) - 772) < 8);
  const c = conditionsFromWeather({pressureHpa: 782, airTempC: 26.4, humidityPct: 30, trackTempC: 45});
  assert.ok(c.iceFactor < 1 && c.grip < 1);
});

test('tailwind sign: wind from the south pushes a car heading north', () => {
  assert.ok(tailwind(Math.PI / 2, 5, 180) > 4.99);   // heading north, wind from south
  assert.ok(tailwind(Math.PI / 2, 5, 0) < -4.99);    // heading north, wind from north = headwind
  assert.ok(Math.abs(tailwind(0, 5, 0)) < 1e-9);     // heading east, wind from north = crosswind
});

test('engine: stadium lap is sensible and responds to mass, power, grip and air', () => {
  const tr = stadium();
  const base = simulateLap(tr, TUM_2019, {rho: 1.18});
  assert.ok(base.lapTime > 20 && base.lapTime < 40, String(base.lapTime));
  assert.ok(base.vMinKph > 100 && base.vMinKph < 200);
  const heavier = simulateLap(tr, {...TUM_2019, mass: TUM_2019.mass + 20}, {rho: 1.18});
  const stronger = simulateLap(tr, {...TUM_2019, pIce: TUM_2019.pIce + 50e3}, {rho: 1.18});
  const thin = simulateLap(tr, TUM_2019, {rho: 0.9});
  const grippy = simulateLap({...tr, mu: new Float64Array(tr.kappa.length).fill(1.03)}, TUM_2019, {rho: 1.18});
  assert.ok(heavier.lapTime > base.lapTime);
  assert.ok(stronger.lapTime < base.lapTime);
  assert.ok(grippy.lapTime < base.lapTime);
  assert.ok(thin.vMinKph < base.vMinKph, 'less air means less downforce in the hairpins');
  assert.ok(base.energy.deployJ <= 4e6 + 1e3);
});

test('engine: headwind on the main straight costs top speed, tailwind adds it', () => {
  const tr = stadium();
  const n = tr.kappa.length, heading = new Float64Array(n);
  // first straight heads north (pi/2); the rest heads south
  for (let i = 0; i < n; i++) heading[i] = i * tr.ds < 600 ? Math.PI / 2 : -Math.PI / 2;
  const t = {...tr, heading};
  const calm = simulateLap(t, TUM_2019, {rho: 1.18});
  const tail = simulateLap(t, TUM_2019, {rho: 1.18, windSpeed: 6, windFromDeg: 180});
  const head = simulateLap(t, TUM_2019, {rho: 1.18, windSpeed: 6, windFromDeg: 0});
  const vEnd = r => r.v[Math.round(590 / tr.ds)];
  assert.ok(vEnd(tail) > vEnd(calm) && vEnd(calm) > vEnd(head));
});

test('2026 car clips: no ERS-K above 345 km/h and the energy budget holds', () => {
  const tr = stadium();
  const res = simulateLap(tr, PRIOR[2026], {rho: 1.18});
  assert.ok(res.energy.deployJ <= res.energy.budgetJ + 1e3);
  assert.ok(res.vMaxKph < 380);
});

const NOTES = `19. | Changes to the circuit
- | Circuit resurfaced from entry to turn 9 until entry of turn 11.
- | Smoothing of track surface approaching turn 12 to remove bump.
- | Large digital display board at pit exit removed.
- | White paint (simulating a kerb) at exit of turn 11 removed.
- | Yellow kerb at turn 1 apex reduced in height.
- | New TecPro barrier installed at turn 6.
6
20. | Free Practice Collective Test Items.`;

test('FIA notes: circuit changes are read, classified and mapped to corners', () => {
  const {sectionFound, changes} = parseTrackChanges(NOTES);
  assert.equal(sectionFound, true);
  assert.deepEqual(changes.map(c => c.type), ['resurfacing', 'bump_removal', 'pit', 'track_limits', 'kerb_lowered', 'infrastructure']);
  const resurf = changes[0];
  assert.equal(resurf.range.from.turn, 9); assert.equal(resurf.range.to.turn, 11);
  assert.equal(resurf.range.from.part, 'entry');
  assert.equal(changes[4].range.from.part, 'apex');
  assert.equal(changes.filter(c => c.affectsLap).length, 3);
  const n = 1000, track = {ds: 5, kappa: new Float64Array(n)};
  const corners = Array.from({length: 20}, (_, i) => ({number: i + 1, letter: '', s: 200 + i * 230}));
  const {track: t2, applied} = applyTrackChanges(track, changes, corners);
  const r = applied.find(a => a.type === 'resurfacing');
  assert.ok(r.applied && r.sStart < corners[8].s && r.sEnd < corners[10].s && r.sEnd > corners[9].s);
  assert.ok(t2.mu[Math.round(corners[9].s / 5)] > 1.019);
  assert.equal(t2.mu[Math.round(corners[3].s / 5)], 1);
  assert.equal(classifyChange('Drainage improved at turn 4'), 'drainage');
  assert.equal(classifyChange('Track re-profiled at turns 3-4'), 'layout');
});

test('geometry: curvature of a smoothed noisy circle', () => {
  const R = 120, L = 2 * Math.PI * R, S = [], X = [], Y = [];
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let k = 0; k < 2500; k++) { const s = (k + 0.5) / 2500 * L, a = s / R; S.push(s); X.push(R * Math.cos(a) + rnd() * 0.4); Y.push(R * Math.sin(a) + rnd() * 0.4); }
  const sx = kernelSmooth(S, X, L, 7, 2), sy = kernelSmooth(S, Y, L, 7, 2);
  const c = resampleClosed(sx.values, sy.values, 5);
  const {kappa} = headingCurvature(c.x, c.y, c.ds, 12);
  const mean = Array.from(kappa).reduce((a, b) => a + b, 0) / kappa.length;
  assert.ok(Math.abs(1 / mean - R) < 6, String(1 / mean));
});

test('geometry: alignment recovers a known rotation', () => {
  const n = 400, ax = [], ay = [], bx = [], by = [], th = 0.7;
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, x = 300 * Math.cos(a) + 60 * Math.cos(2 * a) + 30 * Math.sin(3 * a), y = 200 * Math.sin(a) + 50 * Math.cos(2 * a); ax.push(x); ay.push(y); }
  for (let i = 0; i < n; i++) { const j = (i + 37) % n; bx.push(Math.cos(th) * ax[j] - Math.sin(th) * ay[j] + 1000); by.push(Math.sin(th) * ax[j] + Math.cos(th) * ay[j] - 50); }
  const al = alignClosed(ax, ay, bx, by);
  assert.ok(al.rms < 3, String(al.rms));
  assert.ok(Math.abs(((al.theta - th + Math.PI) % (2 * Math.PI)) - Math.PI) < 0.03);
});

test('cars: 2027 and 2028 apply the ratified power-unit changes', () => {
  const c27 = applyRules(PRIOR[2026], 2027), c28 = applyRules(PRIOR[2026], 2028);
  assert.equal(c27.ers.pMax, 300e3); assert.equal(c27.ers.regenMax, 375e3);
  assert.ok(Math.abs(c27.pIce / PRIOR[2026].pIce - 1.05) < 1e-9);
  assert.ok(Math.abs(c28.pIce / PRIOR[2026].pIce - 1.125) < 1e-9);
  const d = applyDevelopment(PRIOR[2026], 0.06);
  assert.ok(d.clA > PRIOR[2026].clA && d.muY > PRIOR[2026].muY);
});

test('stored tracks decode to typed arrays', () => {
  const t = trackFromData({id: 'x', ds: 5, kappa: [0, 100, -200, 0], grade: [10, 0, 0, 0], heading: [1571, 0, 0, 0]});
  assert.equal(t.kappa[1], 0.001); assert.equal(t.grade[0], 0.001); assert.ok(Math.abs(t.heading[0] - 1.571) < 1e-12);
});

test('lapsim_simulate tool answers from the stored tracks', async () => {
  const {simulate, lapsimCall} = await import('../worker/lapsim/tool.js');
  const {lapsimTracks} = await import('../worker/lapsim/tracks-data.js');
  const ids = Object.keys(lapsimTracks);
  if (!ids.length) { assert.equal(simulate({track: 'monza'}).status, 'unavailable'); return; }
  assert.equal(simulate({}).status, 'tracks');
  assert.equal(simulate({track: 'no such place'}).status, 'track_not_found');
  const r = simulate({track: ids[0], car: '2026', compare_car: '2027', altitude_m: 2240, air_temp_c: 20});
  assert.equal(r.status, 'ok');
  assert.ok(r.result.lap_seconds > 40 && r.result.lap_seconds < 150, String(r.result.lap_seconds));
  assert.ok(r.conditions.air_density_kg_m3 < 1.0);
  assert.match(r.conditions.sources.pressure, /altitude/);
  assert.equal(r.conditions.sources.air_temp, 'given');
  assert.ok(Number.isFinite(r.compare.delta_s));
  const shares = Object.values(r.result.limited_by_pct_of_lap).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(shares - 100) < 0.5, String(shares));
  const c = await lapsimCall('lapsim_simulate', {track: ids[0]});
  assert.equal(c.isError, false);
});

test('track names resolve from ids, names, Grand Prix names and aliases', async () => {
  const {resolveTrack, TRACK_NAMES} = await import('../worker/lapsim/names.js');
  const ids = Object.keys(TRACK_NAMES);
  assert.equal(resolveTrack('COTA', ids), 'austin');
  assert.equal(resolveTrack('Mexico City GP', ids), 'mexico-city');
  assert.equal(resolveTrack('멕시코시티', ids), 'mexico-city');
  assert.equal(resolveTrack('São Paulo Grand Prix', ids), 'interlagos');
  assert.equal(resolveTrack('Spanish Grand Prix', ids), 'madring');
  assert.equal(resolveTrack('nowhere', ids), null);
});
