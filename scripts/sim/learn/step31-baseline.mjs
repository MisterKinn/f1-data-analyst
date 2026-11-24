// Step 31 (report-only, before the pre-reg hash): A2 baseline speed traces on every step 28 event, for the power check and the drag check.
// Baseline = step 28 A2 (f1-envelope-fit.mjs --a2-baseline): shipped 2025 car, production path and weather, the held-out track's grip
// replaced by the geometric mean of the other fold tracks' shipped grip. No candidate, no fit. 2022 never read.
// Usage (repo root): node scripts/sim/learn/step31-baseline.mjs <out.json>
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../../worker/lapsim/tracks.js';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {carsFor, realConditions} from '../../../worker/lapsim/scenario.js';

const K = lapsimKernel(), EV = JSON.parse(readFileSync('scripts/sim/data/f1-envelope/traces.json', 'utf8')).events;
for (const e of Object.values(EV)) if (!(e.year >= 2023 && e.year <= 2025)) throw new Error('2022 is locked');
const FOLD = [...new Set(Object.values(EV).map(e => e.track))].sort(), grip = id => carsFor(id)['2025'].grip || 1;
const a2Grip = held => Math.exp(FOLD.filter(t => t !== held).reduce((a, t) => a + Math.log(grip(t)), 0) / (FOLD.length - 1));
const envOf = id => { const cs = realConditions(id), r = cs['2025'] || cs['2026'] || Object.values(cs)[0] || {}, p = (k, f) => Number.isFinite(r[k]) ? r[k] : f;
  return K.conditionsFromWeather({airTempC: p('airTempC', 25), trackTempC: p('trackTempC', 35), humidityPct: p('humidityPct', 50), pressureHpa: p('pressureHpa', 1013.25), windSpeed: p('windSpeed', 0), windFromDeg: p('windFromDeg', 0)}); };
const out = {rule: 'A2 baseline (step 28): held-out grip = geometric mean of the other fold tracks shipped grip', events: {}};
for (const [key, e] of Object.entries(EV)) {
  const d = T[e.track], car = carsFor(e.track)['2025'].car, env = envOf(e.track), g = a2Grip(e.track);
  let tr = K.trackFromData(d);
  tr = {...tr, aeroLow: e.zones.length ? K.trackFromData({...d, aeroZones: e.zones}, {aero: 'fia'}).aeroLow : new Uint8Array(d.kappa.length)};
  tr = {...tr, mu: Float64Array.from(tr.mu, m => m * g)};
  const r = K.simulateLap(tr, car, env);
  out.events[key] = {track: e.track, year: e.year, grip: g, lap: r.lapTime, rho: env.rho ?? 1.2, cdA: car.cdA, clA: car.clA, mass: car.mass,
    muX: car.muX, muY: car.muY, muXTrac: car.muXTrac, pIce: car.pIce, v: Array.from(r.v, x => Math.round(x * 3.6 * 100) / 100), kappa: Array.from(tr.kappa)};
}
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(Object.keys(out.events).length, 'events,', FOLD.length, 'tracks');
