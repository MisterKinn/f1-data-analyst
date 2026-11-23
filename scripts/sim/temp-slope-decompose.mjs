// Diagnostic (no model change): which model term carries the held-out air-temperature slope?
// Pre-registration: Project doc claude/gate-wec-temp-slope-prereg-2026-11-23.md (option A of
// claude/analysis-7a-failure-2026-11-23.md). Rows: production held-out rows of calibration-data.js (condition-report.mjs).
// For each row the model lap is run on the row's weather, then with one term at a time held at the reference
// (air 25 °C, track 35 °C, same pressure and humidity): density on drag/downforce, ICE factor, parabola grip, all three.
// The error without the model's own response to a term = errPct − Δ_term; its slope on air temperature is reported.
//   node scripts/sim/temp-slope-decompose.mjs → scripts/sim/data/learn/temp-slope-decompose.json (+ table on stdout)
import {writeFileSync, mkdirSync} from 'node:fs';
import {lapsimCalibration as C} from '../../worker/lapsim/calibration-data.js';
import {rowsOf, slope} from './condition-report.mjs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {lapsimWecBop} from '../../worker/lapsim/wec-bop-data.js';

const K = lapsimKernel(), r4 = x => Math.round(x * 1e4) / 1e4;
const REF = {airTempC: 25, trackTempC: 35};
const carKey = g => { const [cls, y] = g.split(' '); return cls === 'f1' ? (+y >= 2026 ? '2026' : '2025') : 'wec-' + cls; };

const rows = [];
for (const r of rowsOf(C)) {
  if (!r.w || !Number.isFinite(r.w.airTempC) || !lapsimTracks[r.track]) continue;
  const c = carsFor(r.track)[carKey(r.group)]; if (!c) continue;
  const tr = K.trackFromData(lapsimTracks[r.track]); tr.mu.fill(c.grip);
  const real = K.conditionsFromWeather(r.w), ref = K.conditionsFromWeather({...r.w, ...REF});
  const lap = env => K.simulateLap(tr, c.car, env).lapTime, L = lap(real);
  const d = env => 100 * (L - lap(env)) / L; // model lap change caused by the term being real instead of reference
  const terms = {density: d({...real, rho: ref.rho}), ice: d({...real, iceFactor: ref.iceFactor}), grip: d({...real, grip: ref.grip}),
    all: d({...real, rho: ref.rho, iceFactor: ref.iceFactor, grip: ref.grip})};
  const [cls, y] = r.group.split(' '), bop = cls === 'lmh' || cls === 'lmdh' ? Object.values(lapsimWecBop[r.track]?.[y]?.cars || {}).filter(x => x.cls === cls) : [];
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
  rows.push({group: r.group, series: cls === 'f1' ? 'f1' : 'wec', cls, track: r.track, air: r.w.airTempC, trackT: r.w.trackTempC, err: r.errPct, terms,
    kW: mean(bop.map(b => b.kW)), kg: mean(bop.map(b => b.kg))});
}

// ordinary least squares with bootstrap on the air coefficient (seeded, as slope())
function ols(X, y, {iters = 4000, seed = 7} = {}) {
  const solve = (Xs, ys) => {
    const p = Xs[0].length, A = Array.from({length: p}, () => Array(p + 1).fill(0));
    Xs.forEach((x, i) => { for (let a = 0; a < p; a++) { for (let b = 0; b < p; b++) A[a][b] += x[a] * x[b]; A[a][p] += x[a] * ys[i]; } });
    for (let c = 0; c < p; c++) { let m = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]];
      if (Math.abs(A[c][c]) < 1e-12) return null; for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k]; } }
    return A.map((row, i) => row[p] / row[i]);
  };
  const b = solve(X, y), n = y.length; let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), bs = [];
  for (let r = 0; r < iters; r++) { const idx = Array.from({length: n}, () => Math.floor(rnd() * n)), q = solve(idx.map(i => X[i]), idx.map(i => y[i])); if (q) bs.push(q[1]); }
  bs.sort((a, c) => a - c);
  return {n, air: r4(b[1]), ci90: [r4(bs[Math.floor(0.05 * bs.length)]), r4(bs[Math.floor(0.95 * bs.length) - 1])], coef: b.map(r4)};
}

const f = s => ({n: s.n, slope: r4(s.b), ci90: s.ci90.map(r4), r2: r4(s.r2), includes0: s.ci90[0] <= 0 && s.ci90[1] >= 0});
const groups = {all: rows, f1: rows.filter(r => r.series === 'f1'), wec: rows.filter(r => r.series === 'wec'),
  lmh: rows.filter(r => r.cls === 'lmh'), lmdh: rows.filter(r => r.cls === 'lmdh'), lmgt3: rows.filter(r => r.cls === 'lmgt3')};
const out = {generatedAt: new Date().toISOString().slice(0, 10), prereg: 'claude/gate-wec-temp-slope-prereg-2026-11-23.md', groups: {}};
for (const [g, R] of Object.entries(groups)) {
  const air = R.map(r => r.air), o = {production: f(slope(air, R.map(r => r.err)))};
  for (const t of ['density', 'ice', 'grip', 'all']) o['without_' + t] = f(slope(air, R.map(r => r.err - r.terms[t])));
  o.modelResponse = f(slope(air, R.map(r => r.terms.all)));                 // the model's own lap change per °C
  o.trackTemp = f(slope(R.map(r => r.trackT), R.map(r => r.err)));
  o.airGivenTrackTemp = ols(R.map(r => [1, r.air, r.trackT]), R.map(r => r.err));
  out.groups[g] = o;
}
const H = rows.filter(r => r.series === 'wec' && Number.isFinite(r.kW));
out.bop = {rows: H.length, note: 'Hypercar rows only (LMGT3 BoP is a power curve, no single kW)',
  airOnly: f(slope(H.map(r => r.air), H.map(r => r.err))), airPlusKW: ols(H.map(r => [1, r.air, r.kW]), H.map(r => r.err)),
  airPlusKWKg: ols(H.map(r => [1, r.air, r.kW, r.kg]), H.map(r => r.err))};
out.rows = rows.map(r => ({...r, terms: Object.fromEntries(Object.entries(r.terms).map(([k, v]) => [k, r4(v)])), err: r4(r.err)}));

mkdirSync('scripts/sim/data/learn', {recursive: true});
writeFileSync('scripts/sim/data/learn/temp-slope-decompose.json', JSON.stringify(out, null, 1));
for (const [g, o] of Object.entries(out.groups)) {
  console.log(`\n${g} (n ${o.production.n})`);
  for (const [k, v] of Object.entries(o)) console.log(`  ${k.padEnd(18)} ${v.slope ?? v.air}  [${v.ci90}]${v.r2 != null ? '  R² ' + v.r2 : ''}`);
}
console.log('\nbop', JSON.stringify(out.bop));
