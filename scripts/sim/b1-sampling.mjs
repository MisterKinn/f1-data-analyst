// B1 step a+b: OpenF1 ~4 Hz sampling artefact on corner minima, and the bias by corner speed. Model laps on the committed
// Run: node scripts/sim/b1-sampling.mjs (needs .cache/lapsim/traces.json from the data workflow's lapsim-derived artifact).
// calibration; the simulated lap is sampled at the real trace's sample distances (linear, as the trace is read).
import {readFileSync} from 'node:fs';
const R = new URL('../../', import.meta.url).href;
const {lapsimTracks} = await import(R + 'worker/lapsim/tracks-data.js'), {trackFromData} = await import(R + 'worker/lapsim/tracks.js');
const {simulateLap} = await import(R + 'worker/lapsim/engine.js'), {conditionsFromWeather} = await import(R + 'worker/lapsim/atmosphere.js');
const {rechargeLimitMJ} = await import(R + 'worker/lapsim/energy-limits.js'), {withGrip, realExtremes} = await import(R + 'scripts/sim/calibrate-lib.mjs');
const {lapsimCalibration: cal} = await import(R + 'worker/lapsim/calibration-data.js');
const traces = JSON.parse(readFileSync(new URL('.cache/lapsim/traces.json', R), 'utf8'));
const rows = [], dsReal = [];
for (const [year, season] of Object.entries(cal.seasons)) for (const [id, r] of Object.entries(season.tracks)) {
  const t = traces.find(x => String(x.year) === year && x.track === id && x.session_key === r.sessionKey && x.position === r.position);
  if (!t || !lapsimTracks[id]) continue;
  const tr = trackFromData(lapsimTracks[id]), car = r.drag ? {...season.car, cdA: season.car.cdA * r.drag, cdALow: season.car.cdALow * r.drag} : season.car;
  const mj = +year >= 2026 ? rechargeLimitMJ(id, +year) : null;
  const res = simulateLap(withGrip(tr, r.grip), car, conditionsFromWeather(mj ? {...r.weather, rechargeMJ: mj} : r.weather || {}));
  const n = res.v.length, ds = tr.ds, vAt = s => { const x = ((s / ds) % n + n) % n, i = Math.floor(x), f = x - i; return res.v[i] * (1 - f) + res.v[(i + 1) % n] * f; };
  const obs = {s: t.s, v: t.v.map(x => x / 3.6)};
  for (let k = 1; k < t.s.length; k++) dsReal.push(t.s[k] - t.s[k - 1]);
  for (const e of realExtremes(obs, 15 / 3.6).filter(e => e.min)) {
    let sim = Infinity; for (let j = -50; j <= 50; j += 0.5) sim = Math.min(sim, vAt(e.s + j));
    let smp = Infinity; for (let k = 0; k < t.s.length; k++) if (Math.abs(t.s[k] - e.s) <= 50) smp = Math.min(smp, vAt(t.s[k]));
    rows.push({year: +year, id, real: e.v * 3.6, sim: sim * 3.6, smp: smp * 3.6});
  }
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length, med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
console.log('real sample spacing median m', med(dsReal).toFixed(1));
for (const y of [2025, 2026, 'all']) {
  const R2 = rows.filter(r => y === 'all' || r.year === y);
  console.log(y, 'corners', R2.length, 'bias true', mean(R2.map(r => r.sim - r.real)).toFixed(1), 'bias as-sampled', mean(R2.map(r => r.smp - r.real)).toFixed(1), 'artefact', mean(R2.map(r => r.smp - r.sim)).toFixed(1));
}
for (const [lo, hi] of [[0, 120], [120, 180], [180, 240], [240, 400]]) {
  const R2 = rows.filter(r => r.real >= lo && r.real < hi);
  console.log(`${lo}-${hi} km/h`, R2.length, 'bias as-sampled', mean(R2.map(r => r.smp - r.real)).toFixed(1), 'artefact', mean(R2.map(r => r.smp - r.sim)).toFixed(1), 'ratio sim/real', mean(R2.map(r => r.smp / r.real)).toFixed(3));
}
