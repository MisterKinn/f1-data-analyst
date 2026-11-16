// Drawn track shape from OpenStreetMap raceway ways, for tracks with no atlas midline (A3, owner 2026-11-16: "fix every distorted map").
//   node scripts/sim/tracks/map-shape-osm.mjs   -> adds the tracks of scripts/sim/data/tracks/osm-raceways-a3.json to worker/lapsim/map-shape-data.js
// Rigid fit (trimmed ICP, many starts) of our midline onto all raceway points near the circuit, then the sideways gap to the nearest
// raceway point along our normal. Gaps over GAP_MAX_M are another road (pit lane, other layout): no correction there, ±TAPER_M around.
// Smoothed (σ SMOOTH_M). Drawing only: the simulator geometry is unchanged. Checked on satellite images (docs/lapsim-track-shapes.md A3).
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {lineData} from '../../../worker/simulation.js';
import {corrProfile, shapeRms} from './shape-corr.mjs';
import {lapsimMapShape} from '../../../worker/lapsim/map-shape-data.js';

const GAP_MAX_M = 30, GAP_MAX_AUTO_M = 15 /* tracks not read by hand: other roads close by */, TAPER_M = 40, SMOOTH_M = 20, R = 6371008.8;
// A3 file first (checked by hand), then the all-track file (A5 probe, raceway ways only); a track with an atlas correction keeps it.
const src = {tracks: {...JSON.parse(readFileSync('scripts/sim/data/tracks/osm-raceways-all.json', 'utf8')).tracks, ...JSON.parse(readFileSync('scripts/sim/data/tracks/osm-raceways-a3.json', 'utf8')).tracks}};
const A3 = new Set(Object.keys(JSON.parse(readFileSync('scripts/sim/data/tracks/osm-raceways-a3.json', 'utf8')).tracks));
const START = existsSync('scripts/sim/data/tracks/osm-fit-start.json') ? JSON.parse(readFileSync('scripts/sim/data/tracks/osm-fit-start.json', 'utf8')) : {}; // whole-area search, osm-fit-start.py
const FIT_MEDIAN_MAX_M = 4, SKIP_MAX = 0.25; // a worse fit means OSM maps another layout or only part of the lap: not used
const cloud = ({seed: [la, lo], ways}) => { const c = Math.cos(la * Math.PI / 180), P = [];
  for (const w of ways) { const g = w.g.map(q => [(q[1] - lo) * Math.PI / 180 * R * c, (q[0] - la) * Math.PI / 180 * R]);
    for (let i = 1; i < g.length; i++) { const [a, b] = [g[i - 1], g[i]], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let j = 0; j < k; j++) P.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); } }
  return P; };
const grid = A => { const g = new Map(), C = 10; A.forEach((p, i) => { const k = Math.floor(p[0] / C) + ',' + Math.floor(p[1] / C); (g.get(k) || g.set(k, []).get(k)).push(i); });
  return p => { let best = -1, bd = Infinity; const i0 = Math.floor(p[0] / C), j0 = Math.floor(p[1] / C);
    for (let r = 0; r < 40 && !(best >= 0 && bd < (r - 1) * C); r++) for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) { if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
      for (const k of g.get(i + ',' + j) || []) { const d = Math.hypot(A[k][0] - p[0], A[k][1] - p[1]); if (d < bd) { bd = d; best = k; } } }
    return best < 0 ? [-1, 40 * C] : [best, bd]; }; }; // nothing within 400 m: no partner (a full scan of the cloud from a far start took minutes)
function fit(M, A, near, start) { // trimmed rigid ICP from 36 angles × 9 offsets; score = 90th percentile distance
  const cM = [0, 1].map(c => M.reduce((s, p) => s + p[c], 0) / M.length), cA = [0, 1].map(c => A.reduce((s, p) => s + p[c], 0) / A.length);
  const run = (th, o, X0, it) => { let R2 = [Math.cos(th), Math.sin(th)], T = [cA[0] + o[0], cA[1] + o[1]];
    const tf = p => [(p[0] - cM[0]) * R2[0] - (p[1] - cM[1]) * R2[1] + T[0], (p[0] - cM[0]) * R2[1] + (p[1] - cM[1]) * R2[0] + T[1]];
    for (let k = 0; k < it; k++) { const X = X0.map(tf), nn = X.map(near), Y = nn.map((q, i) => q[0] < 0 ? X[i] : A[q[0]]), d = nn.map(q => q[1]), lim = [...d].sort((a, b) => a - b)[Math.floor(d.length * 0.8)];
      const W = X0.map((_, i) => d[i] <= lim), n = W.filter(Boolean).length, mx = [0, 1].map(c => X0.reduce((s, p, i) => s + (W[i] ? p[c] - cM[c] : 0), 0) / n), my = [0, 1].map(c => Y.reduce((s, p, i) => s + (W[i] ? p[c] : 0), 0) / n);
      let sxx = 0, sxy = 0; X0.forEach((p, i) => { if (!W[i]) return; const a = [p[0] - cM[0] - mx[0], p[1] - cM[1] - mx[1]], b = [Y[i][0] - my[0], Y[i][1] - my[1]]; sxx += a[0] * b[0] + a[1] * b[1]; sxy += a[0] * b[1] - a[1] * b[0]; });
      const t2 = Math.atan2(sxy, sxx); R2 = [Math.cos(t2), Math.sin(t2)]; T = [my[0] - (mx[0] * R2[0] - mx[1] * R2[1]), my[1] - (mx[0] * R2[1] + mx[1] * R2[0])]; }
    const d = X0.map(tf).map(p => near(p)[1]).sort((a, b) => a - b); return {R2, tf, score: d[Math.floor(d.length * 0.9)]}; };
  if (start) return run(start.th, [start.T[0] - cA[0], start.T[1] - cA[1]], M.filter((_, i) => i % 2 === 0), 40); // pose from osm-fit-start.py
  const Xs = M.filter((_, i) => i % 4 === 0); let best = null;
  for (let a = 0; a < 36; a++) for (const ox of [-300, 0, 300]) for (const oy of [-300, 0, 300]) { const r = run(a * Math.PI / 18, [ox, oy], Xs, 10); if (!best || r.score < best.score) best = {...r, a, o: [ox, oy]}; }
  return run(best.a * Math.PI / 18, best.o, M.filter((_, i) => i % 2 === 0), 40); }

const out = {...lapsimMapShape.tracks}, report = [];
const ONLY = process.env.SHAPE_IDS?.split(','); // optional: refit only these tracks, keep the rest of the file
for (const [id, o] of Object.entries(src.tracks)) {
  if (ONLY && !ONLY.includes(id)) continue;
  if (lapsimMapShape.tracks[id] && lapsimMapShape.tracks[id].atlas !== 'osm') continue; // atlas midline already used
  if (!lineData(id, {shape: false})?.mid) { report.push(`${id}: not a simulator track`); continue; }
  const A = cloud(o), near = grid(A), L = lineData(id, {shape: false}), n = L.mid.length;
  const st = L.mid.reduce((s, p, i) => s + Math.hypot(p[0] - L.mid[(i + 1) % n][0], p[1] - L.mid[(i + 1) % n][1]), 0) / n;
  const {R2, tf} = fit(L.mid, A, near, START[id]), X = L.mid.map(tf);
  const gap = X.map((p, i) => { const k = near(p)[0]; if (k < 0) return 0; const q = A[k], nr = [L.nrm[i][0] * R2[0] - L.nrm[i][1] * R2[1], L.nrm[i][0] * R2[1] + L.nrm[i][1] * R2[0]]; return (q[0] - p[0]) * nr[0] + (q[1] - p[1]) * nr[1]; });
  const dist = X.map(p => near(p)[1]), gmax = A3.has(id) ? GAP_MAX_M : GAP_MAX_AUTO_M, bad = dist.map(d => d > gmax), tap = Math.round(TAPER_M / st), keep = bad.map((_, i) => { for (let k = -tap; k <= tap; k++) if (bad[(i + k + n) % n]) return 0; return 1; });
  const med = [...dist].sort((a, b) => a - b)[Math.floor(n / 2)], skip = 1 - keep.reduce((s, x) => s + x, 0) / n;
  if (!A3.has(id) && (med > FIT_MEDIAN_MAX_M || skip > SKIP_MAX)) { delete out[id]; report.push(`${id} (OSM): not used, fit median ${med.toFixed(1)} m, ${(skip * 100).toFixed(0)} % over ${gmax} m`); continue; }
  const corr = corrProfile(gap, keep, st, SMOOTH_M); // shape only, see shape-corr.mjs
  const [rmsB, rmsA] = shapeRms(gap, keep, st, corr); // shape gap (slow drift removed), kept points
  out[id] = {atlas: 'osm', corr, rmsBeforeM: +rmsB.toFixed(2), rmsAfterM: +rmsA.toFixed(2), maxCorrM: +(Math.max(...corr.map(Math.abs)) / 10).toFixed(1), skippedShare: +(1 - keep.reduce((s, x) => s + x, 0) / n).toFixed(3)};
  report.push(`${id} (OSM): shape gap rms ${rmsB.toFixed(2)} -> ${rmsA.toFixed(2)} m, max correction ${out[id].maxCorrM} m, skipped ${(out[id].skippedShare * 100).toFixed(1)} %`);
}
const f = 'worker/lapsim/map-shape-data.js', head = readFileSync(f, 'utf8').split('\nexport const')[0];
writeFileSync(f, head + (head.includes('map-shape-osm') ? '' : '\n// Tracks marked atlas "osm": scripts/sim/tracks/map-shape-osm.mjs from OpenStreetMap raceway ways (© OpenStreetMap contributors, ODbL).') + '\nexport const lapsimMapShape = ' + JSON.stringify({...lapsimMapShape, tracks: out}) + ';\n');
console.log(report.join('\n'));
