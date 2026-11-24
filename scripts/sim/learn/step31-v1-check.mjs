// Step 31 close (report only, no fit): replay V1's held-out laps from run 45505621905's final fold parameters (fold logs, round 2) and
// report signed lap error and straight-end speed residuals (model − measured), V1 vs the A2 baseline. Model code copied from
// step31-fit.mjs @ 165b87b (car, corridor κ, A2 grip); needs the kernel hook car.decoupled (fork branch step31-k2, not merged).
// Usage (repo root): node scripts/sim/learn/step31-v1-check.mjs <fold params json> <f_kerb> <out.json>
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../../worker/lapsim/tracks.js';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {carsFor, realConditions} from '../../../worker/lapsim/scenario.js';

const K = lapsimKernel(), G = 9.81, here = new URL('../data/', import.meta.url);
const EV = Object.values(JSON.parse(readFileSync(new URL('f1-envelope/traces.json', here))).events);
const COR = JSON.parse(readFileSync(new URL('step31/corridor.json', here)));
for (const e of EV) if (!(e.year >= 2023 && e.year <= 2025)) throw new Error('2022 is locked');
const [PF, FKS, OUT] = process.argv.slice(2), PAR = JSON.parse(readFileSync(PF, 'utf8')), FK = +FKS;
const FOLD = [...new Set(EV.map(e => e.track))].sort(), shippedGrip = id => carsFor(id)['2025'].grip || 1;
const a2Grip = held => Math.exp(FOLD.filter(t => t !== held).reduce((a, t) => a + Math.log(shippedGrip(t)), 0) / (FOLD.length - 1));
const envOf = id => { const cs = realConditions(id), r = cs['2025'] || cs['2026'] || Object.values(cs)[0] || {}, p = (k, f) => Number.isFinite(r[k]) ? r[k] : f;
  return K.conditionsFromWeather({airTempC: p('airTempC', 25), trackTempC: p('trackTempC', 35), humidityPct: p('humidityPct', 50), pressureHpa: p('pressureHpa', 1013.25), windSpeed: p('windSpeed', 0), windFromDeg: p('windFromDeg', 0)}); };
function corridorMult(id, fk) { // copied from step31-fit.mjs
  const c = COR.tracks[id]; if (!c) return null;
  const n = T[id].kappa.length, ds = T[id].ds, fs = COR.fs, m = new Float64Array(n).fill(1);
  for (const r of c.corners) {
    const sc = r.scale.map((x, i) => Math.min(...r.scale.slice(0, i + 1)));
    const j = Math.min(fs.length - 2, Math.floor(fk / (fs[1] - fs[0]))), w = (fk - fs[j]) / (fs[j + 1] - fs[j]), s = sc[j] + w * (sc[j + 1] - sc[j]);
    for (let k = 0; k < n; k++) {
      const d = Math.min(Math.abs(k - r.ia), n - Math.abs(k - r.ia)) * ds;
      const mk = d <= COR.core_m ? s : d <= COR.taper_m ? s + (1 - s) * (d - COR.core_m) / (COR.taper_m - COR.core_m) : 1;
      if (mk < m[k]) m[k] = mk;
    }
  }
  return m;
}
function run(e, p, grip, fk) {
  const d = T[e.track]; let tr = K.trackFromData(d);
  tr = {...tr, aeroLow: e.zones.length ? K.trackFromData({...d, aeroZones: e.zones}, {aero: 'fia'}).aeroLow : new Uint8Array(d.kappa.length)};
  const m = p ? corridorMult(e.track, fk) : null; if (m) tr = {...tr, kappa: Float64Array.from(tr.kappa, (x, i) => x * m[i])};
  tr = {...tr, mu: Float64Array.from(tr.mu, x => x * grip)};
  const c = carsFor(e.track)['2025'].car, car = p ? {...c, pIce: 540000, lateralCap: {kind: 'quad', a0: p.mu0 * G, k: p.ka, rhoRef: 1.2}, decoupled: {b0: p.b0 * G, b2: p.b2, aTr: p.aTr * G}} : c;
  const r = K.simulateLap(tr, car, envOf(e.track)); return {v: Array.from(r.v, x => x * 3.6), lap: r.lapTime, cdA: car.cdA, pIce: car.pIce};
}
function score(e, r) {
  const n = e.n, w = e.w, ds = e.ds, meas = e.a.map(x => x == null ? NaN : x), vm = k => r.v[(((k - e.shift) % n) + n) % n], wa = Math.trunc(40 / ds);
  const se = e.straights.map(c => { let mm = -Infinity, mo = -Infinity; for (let q = -w; q <= w; q++) { const k = ((c + q) % n + n) % n; if (Number.isFinite(meas[k])) mm = Math.max(mm, meas[k]); mo = Math.max(mo, vm(k)); }
    return Number.isFinite(mm) ? {meas: mm, res: mo - mm} : null; }).filter(Boolean);
  const ap = e.corners.map(([i]) => { let v = Infinity; for (let q = -wa; q <= wa; q++) v = Math.min(v, vm(i + q)); return {meas: meas[i], err: v - meas[i]}; }).filter(c => c.meas >= 120 && c.meas < 240);
  const rms = xs => xs.length ? Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length) : null;
  const ph = {entry: 0, apex: 0, exit: 0}, st = e.straights; // signed time per phase over the lap (s, + = model slower), 30c phases
  e.corners.forEach(([i], j) => {
    if (st.length < 2) return;
    const a0 = st[j], a1 = st[(j + 1) % st.length], seg = []; for (let q = a0; q <= a1 + (a1 <= a0 ? n : 0); q++) seg.push(q % n);
    const k0 = seg.indexOf(i); if (k0 < 0) return;
    const vv = seg.map(q => meas[q]), dt = seg.map((q, z) => Number.isFinite(vv[z]) ? ds / (vm(q) / 3.6) - ds / (vv[z] / 3.6) : 0);
    let lo = k0, hi = k0; const lim = 1.05 * meas[i];
    while (lo > 0 && Number.isFinite(vv[lo - 1]) && vv[lo - 1] <= lim) lo--;
    while (hi < seg.length - 1 && Number.isFinite(vv[hi + 1]) && vv[hi + 1] <= lim) hi++;
    dt.forEach((x, z) => { ph[z < lo ? 'entry' : z <= hi ? 'apex' : 'exit'] += x; });
  });
  return {phases: ph, lapErrPct: 100 * (r.lap - e.lap_meas_s) / e.lap_meas_s, lapErrS: r.lap - e.lap_meas_s, straightRes: se.length ? se.reduce((a, s) => a + s.res, 0) / se.length : null,
    straights: se, apex120_240: rms(ap.map(c => c.err))};
}
const rows = [];
for (const e of EV) {
  const p = PAR[e.track]?.[e.year]; if (!p) throw new Error('no params for ' + e.track + ' ' + e.year);
  const rc = run(e, p, 1, FK), rb = run(e, null, a2Grip(e.track), null);
  rows.push({key: e.year + '|' + e.event, track: e.track, year: e.year, corridor: !!COR.tracks[e.track], cdA: rc.cdA, cand: score(e, rc), base: score(e, rb)});
}
writeFileSync(OUT, JSON.stringify({fk: FK, rows}));
console.log(rows.length, 'held-out laps replayed');
