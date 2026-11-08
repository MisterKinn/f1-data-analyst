// Brakes checked against Brembo's published per-race figures (F1 2025 and 2026): for each race the
// hardest braking zone (speed before/after, distance, time, deceleration, pedal load) and per-lap
// totals (braking zones, braking time). The simulated zone is the one ending nearest the named corner.
// Fits: pedal load = k × deceleration (kg per g); deceleration scale (real / simulated peak g);
// braking-time scale. Each tested leave-one-race-out. Out: worker/lapsim/brake-data.js.
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {carsFor, realConditions} from '../../worker/lapsim/scenario.js';
import {brakeZones} from '../../worker/lapsim/brakes.js';
import {tiTrack} from './ti-races.mjs';

const K = lapsimKernel(), B = JSON.parse(readFileSync('scripts/sim/data/brembo.json', 'utf8'));
const ALIAS = {'barcelona-catalunya': 'catalunya'}, median = a => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const rows = [];
for (const year of ['2025', '2026']) for (const [ev, r] of Object.entries(B.f1[year] || {})) {
  const t = tiTrack(ev, +year), id = ALIAS[t] || t, td = lapsimTracks[id], h = r.hardest?.[0];
  if (!td || !h) continue;
  const c = carsFor(id)[year], tr = K.trackFromData(td), env = K.conditionsFromWeather(realConditions(id)?.[year] || {});
  tr.mu.fill(c.grip); const sim = K.simulateLap(tr, c.car, env), b = brakeZones(tr, c.car, env, sim.v, sim.limit, {minDropKph: 30});
  // the zone ending nearest the named corner (or the one closest in entry/exit speed when the corner is unknown)
  const corner = (td.corners || []).find(x => String(x.number) === String(h.turn)), n = sim.v.length;
  const near = z => corner ? Math.min(Math.abs(z.end * tr.ds - corner.s), td.length - Math.abs(z.end * tr.ds - corner.s)) : Math.abs(z.vFrom - h.vFrom) + Math.abs(z.vTo - h.vTo);
  const z = b.zones.slice().sort((a, b2) => near(a) - near(b2))[0]; if (!z) continue;
  rows.push({year, id, ev, turn: h.turn, real: h, sim: {vFrom: z.vFrom, vTo: z.vTo, distM: z.distM, timeS: z.timeS, peakG: z.peakG, meanG: z.meanG}, lap: {zones: r.zones, brakingTimeS: r.brakingTimeS, simZones: b.zones.length, simTime: b.brakingTime}});
}
const pairs = f => rows.map(f).filter(p => p.every(Number.isFinite));
// pedal load per g (real pairs), deceleration and braking-time scales (real / simulated)
const kPed = median(pairs(r => [r.real.pedalKg / r.real.decelG]).map(p => p[0]));
const gScale = median(pairs(r => [r.real.decelG / r.sim.meanG]).map(p => p[0]));
const tScale = median(pairs(r => [r.lap.brakingTimeS / r.lap.simTime]).map(p => p[0]));
const loo = (key, pred, real) => { const e = rows.map((r, i) => { const rest = rows.filter((_, j) => j !== i), v = pred(r, rest), y = real(r); return Number.isFinite(v) && Number.isFinite(y) ? (v - y) / y * 100 : NaN; }).filter(Number.isFinite); return {n: e.length, rmsPct: +Math.sqrt(e.reduce((s, x) => s + x * x, 0) / e.length).toFixed(1)}; };
const test = {
  decelG: loo('g', (r, rest) => r.sim.meanG * median(rest.map(x => x.real.decelG / x.sim.meanG).filter(Number.isFinite)), r => r.real.decelG),
  decelRawG: loo('g0', r => r.sim.meanG, r => r.real.decelG),
  pedalKg: loo('kg', (r, rest) => r.sim.meanG * median(rest.map(x => x.real.decelG / x.sim.meanG).filter(Number.isFinite)) * median(rest.map(x => x.real.pedalKg / x.real.decelG).filter(Number.isFinite)), r => r.real.pedalKg),
  vFrom: loo('v1', r => r.sim.vFrom, r => r.real.vFrom), vTo: loo('v2', r => r.sim.vTo, r => r.real.vTo),
  distM: loo('d', r => r.sim.distM, r => r.real.distM),
  brakingTimeS: loo('t', (r, rest) => r.lap.simTime * median(rest.map(x => x.lap.brakingTimeS / x.lap.simTime).filter(Number.isFinite)), r => r.lap.brakingTimeS),
};
// brake pressure build-up time t (s): a real brake takes t to reach full pressure, so the zone grows by
// about v0·t/2 in distance and t/2 in time. t is fitted (grid 0–0.8 s, least distance error) and tested
// leave-one-race-out together with the time it implies.
const withRamp = (r, t) => ({d: r.sim.distM + r.sim.vFrom / 3.6 * t / 2, s: r.sim.timeS + t / 2});
const errD = (rs, t) => rs.map(r => Math.abs(withRamp(r, t).d - r.real.distM) / r.real.distM).filter(Number.isFinite);
const fitRamp = rs => { let best = 0, e0 = Infinity; for (let t = 0; t <= 0.8 + 1e-9; t += 0.01) { const e = median(errD(rs, t)); if (e < e0) { e0 = e; best = t; } } return best; };
const ramp = fitRamp(rows.filter(r => Number.isFinite(r.real.distM)));
const rampLoo = (key, f) => { const e = rows.map((r, i) => { const t = fitRamp(rows.filter((_, j) => j !== i && Number.isFinite(rows[j].real.distM))), y = r.real[key], v = f(withRamp(r, t)); return Number.isFinite(y) ? (v - y) / y * 100 : NaN; }).filter(Number.isFinite); return {n: e.length, rmsPct: +Math.sqrt(e.reduce((a, x) => a + x * x, 0) / e.length).toFixed(1)}; };
test.distRampM = rampLoo('distM', w => w.d); test.timeRampS = rampLoo('timeS', w => w.s);
test.timeS = loo('ts', r => r.sim.timeS, r => r.real.timeS);
// per-lap braking time with the build-up (each zone + t/2), no extra scale
test.lapTimeRampS = loo('lt', r => r.lap.simTime + r.lap.simZones * ramp / 2, r => r.lap.brakingTimeS);
test.zoneCountMAE = +(rows.filter(r => r.lap.zones).reduce((a, r) => a + Math.abs(r.lap.simZones - r.lap.zones), 0) / rows.filter(r => r.lap.zones).length).toFixed(2);
test.lapTimeS = loo('lt0', r => r.lap.simTime, r => r.lap.brakingTimeS);
const races = {};
for (const r of rows) ((races[r.id] ||= {})[r.year] = {turn: r.turn, real: r.real, lap: {zones: r.lap.zones, brakingTimeS: r.lap.brakingTimeS}, source: B.f1[r.year][r.ev].source});
const out = {generatedAt: new Date().toISOString(), rampS: +ramp.toFixed(2), pedalKgPerG: +kPed.toFixed(2), gScale: +gScale.toFixed(3), timeScale: +tScale.toFixed(3), test, races, wec: B.wec || {}, imsa: B.imsa || {}};
writeFileSync('worker/lapsim/brake-data.js', '// Generated by scripts/sim/brake-fit.mjs from Brembo published figures (scripts/sim/data/brembo.json)\nexport const lapsimBrakes = ' + JSON.stringify(out) + ';\n');
console.log(rows.length, 'races; ramp', ramp.toFixed(2), 's; pedal', kPed.toFixed(1), 'kg/g; g scale', gScale.toFixed(3), '; time scale', tScale.toFixed(3));
console.log(JSON.stringify(test));
for (const r of rows.slice(0, 12)) console.log(r.year, r.id.padEnd(16), 'T' + r.turn, 'real', r.real.vFrom + '->' + r.real.vTo, r.real.distM + 'm', r.real.decelG + 'g', '| sim', r.sim.vFrom.toFixed(0) + '->' + r.sim.vTo.toFixed(0), r.sim.distM.toFixed(0) + 'm', r.sim.peakG.toFixed(2) + 'g peak ' + r.sim.meanG.toFixed(2) + 'g mean');
