// Telemetry channels, car-dependent racing line on every track, browser script (owner 2026-11-15).
import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimKernel} from '../worker/lapsim/kernel.js';
import {lapsimAllTracks} from '../worker/lapsim/tracks.js';
import {carsFor} from '../worker/lapsim/scenario.js';
import {lapChannels} from '../worker/lapsim/channels.js';
import {minCurvatureLine, blendLine} from '../worker/lapsim/racing-line.js';
import {lapsimScript, lineData, simulationPage} from '../worker/simulation.js';

const K = lapsimKernel(), env = K.conditionsFromWeather({});
const lap = (id, key) => { const c = carsFor(id)[key], tr = K.trackFromData(lapsimAllTracks[id]); return {c, tr, r: K.simulateLap(tr, c.car, env)}; };

test('the browser script defines powertrain() for the kernel (it lives outside lapsimKernel)', () => {
  const js = lapsimScript();
  assert.match(js, /const powertrain=/);
  const src = js.slice(js.indexOf('const powertrain='), js.indexOf(';const lapChannels='));
  const K2 = new Function(src + ';return K;')();
  const {c, tr} = lap('monza', '2026');
  assert.ok(K2.simulateLap(tr, c.car, env).lapTime > 60);
});

test('brake pressure, gear, rpm and steering are physical and stable', () => {
  const {c, tr, r} = lap('monza', '2026'), ch = lapChannels(tr, c.car, env, r, {cls: 'f1', seed: 'monza|2026'});
  const peak = Math.max(...ch.brakeBar);
  assert.ok(peak > 60 && peak < 200, 'F1 front line pressure ' + peak);
  r.v.forEach((v, i) => { if (!(r.v[(i + 1) % r.v.length] < v)) assert.equal(ch.brakeBar[i], 0); }); // no pressure off the brakes
  assert.ok(ch.gear.every(g => g >= 1 && g <= c.car.gears.length) && Math.max(...ch.gear) === c.car.gears.length);
  assert.ok(ch.rpm.every(x => x <= c.car.engine.rpmMax) && ch.shifts.length > 10);
  assert.deepEqual(lapChannels(tr, c.car, env, r, {cls: 'f1', seed: 'monza|2026'}), ch, 'deterministic');
  assert.notDeepEqual(lapChannels(tr, c.car, env, r, {cls: 'f1', seed: 'other'}).steerDeg, ch.steerDeg, 'seeded');
  // the steering follows the curvature sign; corrections are larger in fast corners near the limit than on the straights
  const big = ch.steerMeanDeg.map((d, i) => [d, tr.kappa[i]]).filter(([d]) => Math.abs(d) > 20);
  assert.ok(big.every(([d, k]) => Math.sign(d) === Math.sign(k)));
  const dev = ch.steerDeg.map((d, i) => Math.abs(d - ch.steerMeanDeg[i])), straight = dev.filter((_, i) => Math.abs(tr.kappa[i]) < 1e-4 && r.v[i] > 70 && r.limit[i] !== 3), corner = dev.filter((_, i) => r.limit[i] === 0 && Math.abs(tr.kappa[i]) > 2e-3);
  assert.ok(Math.max(...straight) < 0.3 && Math.max(...corner) > 0.5, Math.max(...straight) + ' / ' + Math.max(...corner));
  // Monaco hairpin needs a large steering angle; Formula E has one gear and no rear friction brakes
  const mc = lap('monte-carlo', '2026'), m2 = lapChannels(mc.tr, mc.c.car, env, mc.r, {cls: 'f1'});
  assert.ok(Math.max(...m2.steerMeanDeg.map(Math.abs)) > 150);
  const fe = lap('fe-london', 'fe-gen3evo'), f2 = lapChannels(fe.tr, fe.c.car, env, fe.r, {cls: 'fe'});
  assert.ok(f2.gear.every(g => g === 1) && f2.shifts.length === 0 && Math.max(...f2.brakeBar) > 20);
});

test('human pedals: stab, overshoot, ripple and trail-off; throttle; grip-loss zones', () => {
  const {c, tr, r} = lap('monza', '2026'), ch = lapChannels(tr, c.car, env, r, {cls: 'f1', seed: 'monza|2026'}), n = r.v.length;
  assert.equal(ch.brakeHuman.length, 2 * n); assert.equal(ch.throttleHuman.length, 2 * n);
  // same brake impulse as the physics (the trail-off tail adds a little), more peak than the physics (overshoot), not monotonic (ripple)
  const sumP = ch.brakeBar.reduce((a, x) => a + x, 0) * 2, sumH = ch.brakeHuman.reduce((a, x) => a + x, 0);
  assert.ok(sumH >= sumP * 0.98 && sumH < sumP * 1.15, sumH / sumP);
  assert.ok(Math.max(...ch.brakeHuman) > Math.max(...ch.brakeBar));
  let turns = 0; for (let k = 2; k < 2 * n; k++) if (ch.brakeHuman[k - 1] > 20 && (ch.brakeHuman[k] - ch.brakeHuman[k - 1]) * (ch.brakeHuman[k - 1] - ch.brakeHuman[k - 2]) < 0) turns++;
  assert.ok(turns > 20, 'ripple ' + turns);
  // brake only in braking zones and their short tails; no throttle while braking; flat out on the straights
  ch.brakeHuman.forEach((b, k) => { if (b > 0) { const i = k >> 1; assert.ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].some(o => ch.brakeBar[(i - o + n) % n] > 0), 'brake at ' + k); } });
  ch.throttleHuman.forEach((x, k) => { if (ch.brakeHuman[k] > 2) assert.equal(x, 0); });
  assert.ok(ch.throttleHuman.filter(x => x === 100).length > n * 0.6 && ch.throttle.every(x => x >= 0 && x <= 1));
  assert.deepEqual(lapChannels(tr, c.car, env, r, {cls: 'f1', seed: 'monza|2026'}).brakeHuman, ch.brakeHuman);
  // Spa: the riskiest place is the Raidillon crest (T4), where the car goes light
  const spa = lap('spa-francorchamps', '2026'), sc = lapChannels(spa.tr, spa.c.car, env, spa.r, {cls: 'f1'}), T4 = lapsimAllTracks['spa-francorchamps'].corners.find(x => x.number === 4).s;
  const iMax = sc.risk.indexOf(Math.max(...sc.risk)); assert.ok(Math.abs(iMax * spa.tr.ds - T4) < 80, iMax * spa.tr.ds + ' vs ' + T4);
  // rain raises the risk everywhere
  assert.ok(lapChannels(spa.tr, spa.c.car, env, spa.r, {cls: 'f1', wet: true}).risk.every((x, i) => x >= sc.risk[i]));
});

test('least-curvature and shortest lines stay in the corridor and do what they say', () => {
  const n = 200, x = [], y = [];
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, r = 300 + 60 * Math.sin(3 * a); x.push(r * Math.cos(a)); y.push(r * Math.sin(a)); }
  const half = new Array(n).fill(8), mc = minCurvatureLine(x, y, half), sp = minCurvatureLine(x, y, half, {order: 2});
  const len = (X, Y) => X.reduce((s, _, i) => s + Math.hypot(X[(i + 1) % n] - X[i], Y[(i + 1) % n] - Y[i]), 0);
  const k2 = (X, Y) => X.reduce((s, _, i) => { const a = (i - 1 + n) % n, b = (i + 1) % n, cr = (X[i] - X[a]) * (Y[b] - Y[i]) - (Y[i] - Y[a]) * (X[b] - X[i]); return s + cr * cr; }, 0);
  assert.ok(mc.offset.every(o => Math.abs(o) <= 8 + 1e-9) && sp.offset.every(o => Math.abs(o) <= 8 + 1e-9));
  assert.ok(k2(mc.x, mc.y) < k2(x, y) * 0.95 && len(sp.x, sp.y) < len(x, y) && len(sp.x, sp.y) < len(mc.x, mc.y));
});

test('every track has a racing line, and the line depends on the car', () => {
  for (const id of Object.keys(lapsimAllTracks)) {
    const L = lineData(id);
    assert.ok(L && L.base.length === L.mid.length && L.sp.length === L.mid.length && L.left.length === L.mid.length, id);
  }
  const L = lineData('monte-carlo'), ref = [L.mid.map(p => p[0]), L.mid.map(p => p[1])], cars = carsFor('monte-carlo');
  const w = ['2026', 'fe-gen3evo'].map(k => blendLine(K, ref, L.nrm, L.base.map(x => x / 10), L.sp.map(x => x / 10), cars[k].car, env, cars[k].grip || 1).w.join());
  assert.notEqual(w[0], w[1]);
});

test('hybrid cars get a battery (SoC) lane; cars without a battery model do not', () => {
  assert.match(simulationPage({track: 'monza', car: '2026'}, 'en'), /class="ls-ch-h">Battery energy \(SoC/);
  assert.match(simulationPage({track: 'le-mans', car: 'wec-lmh'}, 'en'), /class="ls-ch-h">Battery energy \(SoC/);
  assert.doesNotMatch(simulationPage({track: 'monza', car: 'gt3-audi-r8-lms-gt3'}, 'en'), /class="ls-ch-h">Battery energy \(SoC/);
});
