// Track geometry corrected to measured corner speeds (task A4, docs/lapsim-geometry-fit.md section 1; declared before running).
//   node scripts/sim/geometry-fit.mjs [maxPosition=5]  (needs .cache/lapsim/traces.json) -> probe-out/geometry-fit.json
// Measured data is never changed: the curvature of a corner is scaled so the simulated minimum speed agrees with the measured one.
// Factors are fitted on 2023-2024 laps and judged on 2025 and 2026 laps; the track grip of every lap is refitted so its lap time
// always matches, so a geometry change cannot win by moving the lap time. Experiment only: nothing in production reads the output.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {trackFromData} from '../../worker/lapsim/tracks.js';
import {simulateLap} from '../../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../../worker/lapsim/atmosphere.js';
import {rechargeLimitMJ} from '../../worker/lapsim/energy-limits.js';
import {lapsimCalibration as cal} from '../../worker/lapsim/calibration-data.js';
import {withGrip, realExtremes} from './calibrate-lib.mjs';

const MAXPOS = +(process.argv[2] || 5), FIT = new Set([2023, 2024]), TEST = [2025, 2026], LO = 0.75, HI = 1.33, WIN_M = 60, MATCH_M = 50, CLUSTER_M = 40;
const BANDS = [120, 220]; // km/h
const traces = JSON.parse(readFileSync('.cache/lapsim/traces.json', 'utf8')).filter(t => t.position <= MAXPOS && !t.weather?.rain && lapsimTracks[t.track] && cal.seasons[t.year]?.tracks?.[t.track]);
const rms = a => a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : null, mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const median = a => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : null; };
const r3 = x => x == null ? null : +x.toFixed(3);

function carFor(t) { const s = cal.seasons[t.year], r = s.tracks[t.track]; return r.drag ? {...s.car, cdA: s.car.cdA * r.drag, cdALow: s.car.cdALow * r.drag} : s.car; }
function envFor(t) { const mj = t.year >= 2026 ? rechargeLimitMJ(t.track, t.year) : null; return conditionsFromWeather(mj ? {...t.weather, rechargeMJ: mj} : t.weather || {}); }
// grip so the simulated lap equals the measured lap (lap time is measured data: it is matched, never moved)
function matched(tr, t) {
  const car = carFor(t), env = envFor(t); let lo = 0.6, hi = 1.8, res = null;
  for (let k = 0; k < 22; k++) { const g = (lo + hi) / 2; res = simulateLap(withGrip(tr, g), car, env); if (res.lapTime > t.lap_seconds) lo = g; else hi = g; }
  return res;
}
function corners(tr, t, res) {
  const obs = {s: t.s, v: t.v.map(x => x / 3.6)}, mins = realExtremes(obs, 15 / 3.6).filter(e => e.min), n = res.v.length, h = Math.round(MATCH_M / tr.ds);
  return mins.map(e => { const i0 = Math.round(e.s / tr.ds); let x = Infinity, at = i0; for (let j = -h; j <= h; j++) { const i = ((i0 + j) % n + n) % n; if (res.v[i] < x) { x = res.v[i]; at = i; } }
    return {s: e.s, real: e.v * 3.6, sim: x * 3.6, at}; });
}
function brakeErr(tr, t, res, cs) {
  const bp = (s, v, k) => { let j = k, vmax = v[k]; while (j > 0 && v[j - 1] >= v[j] - 0.05) { j--; vmax = Math.max(vmax, v[j]); if (k - j > 400) break; } let b = j; for (let i = j; i <= k; i++) if (v[i] >= vmax - 3 / 3.6) b = i; return s[b]; };
  const obsV = t.v.map(x => x / 3.6), simS = Array.from(res.v, (_, i) => i * tr.ds), L = res.v.length * tr.ds;
  return cs.map(c => { const k = t.s.findIndex(s => s >= c.s); if (k < 1) return null; const d = bp(simS, Array.from(res.v), c.at) - bp(t.s, obsV, k); return Math.abs(d) < L / 2 ? d : null; }).filter(x => x != null);
}
// scale curvature over a corner: the same-sign run around index i, at most ±WIN_M
function scaled(base, list) {
  const k = Float64Array.from(base.kappa), n = k.length, w = Math.round(WIN_M / base.ds);
  for (const {i, f} of list) { const sg = Math.sign(base.kappa[i]) || 1; let a = i, b = i;
    while (i - a < w && Math.sign(base.kappa[((a - 1) % n + n) % n]) === sg) a--; while (b - i < w && Math.sign(base.kappa[(b + 1) % n]) === sg) b++;
    for (let j = a; j <= b; j++) { const q = ((j % n) + n) % n, edge = Math.min(j - a, b - j, 3) / 3; k[q] = base.kappa[q] * (1 + (f - 1) * Math.max(edge, 0.34)); } }
  return {...base, kappa: k};
}

const ids = [...new Set(traces.map(t => t.track))], out = {declared: 'docs/lapsim-geometry-fit.md section 1', maxPosition: MAXPOS, tracks: {}, variants: {}};
const base = Object.fromEntries(ids.map(id => [id, trackFromData(lapsimTracks[id])]));
// 1. production geometry on every lap: corner ratios
const A = traces.map(t => { const tr = base[t.track], res = matched(tr, t), cs = corners(tr, t, res); return {t, res, cs}; });
// corner identity per track: cluster measured minimum positions
const cid = {}; for (const id of ids) { const ss = A.filter(a => a.t.track === id).flatMap(a => a.cs.map(c => c.s)).sort((x, y) => x - y), cl = [];
  for (const s of ss) { const c = cl.at(-1); if (c && s - c.at(-1) < CLUSTER_M) c.push(s); else cl.push([s]); } cid[id] = cl.filter(c => c.length >= 3).map(c => median(c)); }
const near = (id, s) => { let b = -1, bd = CLUSTER_M; cid[id].forEach((x, k) => { if (Math.abs(x - s) < bd) { bd = Math.abs(x - s); b = k; } }); return b; };
const band = v => v < BANDS[0] ? 0 : v < BANDS[1] ? 1 : 2;
// car part per fit season and speed band (G2)
const carPart = {}; for (const y of FIT) for (let b = 0; b < 3; b++) carPart[y + '|' + b] = median(A.filter(a => a.t.year === y).flatMap(a => a.cs.filter(c => band(c.real) === b).map(c => (c.sim / c.real) ** 2))) ?? 1;
const factors = (g2) => { const f = {}; for (const id of ids) f[id] = cid[id].map((s, k) => { const r = A.filter(a => a.t.track === id && FIT.has(a.t.year)).flatMap(a => a.cs.filter(c => near(id, c.s) === k).map(c => (c.sim / c.real) ** 2 / (g2 ? carPart[a.t.year + '|' + band(c.real)] : 1)));
  const m = r.length >= 2 ? median(r) : null; return {s: Math.round(s), n: r.length, factor: m == null ? null : r3(m), applied: m != null && m >= LO && m <= HI}; }); return f; };
const F = {G1: factors(false), G2: factors(true)};
function evaluate(trackOf) { const rows = {}; for (const y of [...FIT, ...TEST]) { const L = A.filter(a => a.t.year === y), cr = [], bias = [], br = [];
  for (const a of L) { const tr = trackOf(a.t.track), res = tr === base[a.t.track] ? a.res : matched(tr, a.t), cs = tr === base[a.t.track] ? a.cs : corners(tr, a.t, res);
    cs.forEach(c => { cr.push(c.sim - c.real); bias.push(c.sim - c.real); }); br.push(...brakeErr(tr, a.t, res, cs)); }
  rows[y] = {laps: L.length, cornerRmsKph: r3(rms(cr)), cornerBiasKph: r3(mean(bias)), brakeRmsM: r3(rms(br)), held: !FIT.has(y)}; } return rows; }
// split-half noise of A in the held-out seasons (odd / even laps)
const half = (y, p) => { const e = A.filter((a, k) => a.t.year === y && k % 2 === p).flatMap(a => a.cs.map(c => c.sim - c.real)); return rms(e); };
out.noiseKph = Object.fromEntries(TEST.map(y => [y, r3(Math.abs(half(y, 0) - half(y, 1)))]));
out.variants.A = evaluate(id => base[id]);
for (const v of ['G1', 'G2']) { const tr = Object.fromEntries(ids.map(id => [id, scaled(base[id], F[v][id].filter(c => c.applied).map(c => ({i: Math.round(c.s / base[id].ds) % base[id].kappa.length, f: c.factor})))]));
  out.variants[v] = evaluate(id => tr[id]); }
out.carPartG2 = Object.fromEntries(Object.entries(carPart).map(([k, x]) => [k, r3(x)]));
out.factors = F;
mkdirSync('probe-out', {recursive: true}); writeFileSync('probe-out/geometry-fit.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({noiseKph: out.noiseKph, carPartG2: out.carPartG2, variants: out.variants}, null, 1));
for (const v of ['G1', 'G2']) { const all = Object.values(F[v]).flat(); console.log(v, 'corners', all.length, 'applied', all.filter(c => c.applied).length, 'out of bounds', all.filter(c => c.factor != null && !c.applied).length); }
