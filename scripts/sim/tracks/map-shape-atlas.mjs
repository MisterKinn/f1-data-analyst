// Drawn track shape from the checked atlas midlines (owner 2026-11-16: "Barcelona T1 goes straight, then right; check every map").
//   node scripts/sim/tracks/map-shape-atlas.mjs <track-atlas checkout>   -> worker/lapsim/map-shape-data.js
// For each F1 track with a TUM outline: rigid fit (ICP) of our midline onto the atlas midline (tobi/track-atlas, MIT; geometry
// OpenStreetMap, ODbL), then the sideways gap at every point. Gaps over GAP_MAX_M are a different layout in one of the two lines
// (Barcelona's old final chicane in the atlas): no correction there, ±TAPER_M around it. Smoothed (σ SMOOTH_M). Drawing only:
// the simulator geometry is unchanged.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {lineData} from '../../../worker/simulation.js';

const ATLAS = {sakhir: 'bahrain', jeddah: 'jeddah', imola: 'imola', interlagos: 'interlagos', 'las-vegas': 'las-vegas', lusail: 'losail',
  'yas-marina-circuit': 'yas-marina', melbourne: 'melbourne', shanghai: 'shanghai', suzuka: 'suzuka', miami: 'miami', montreal: 'montreal',
  'monte-carlo': 'monaco', catalunya: 'barcelona', spielberg: 'red-bull-ring', silverstone: 'silverstone', 'spa-francorchamps': 'spa-francorchamps',
  hungaroring: 'hungaroring', zandvoort: 'zandvoort', monza: 'monza', baku: 'baku', singapore: 'singapore', austin: 'circuit-of-the-americas', 'mexico-city': 'mexico-city',
  // endurance tracks (owner 2026-11-16, task A1); a track whose line is built from the atlas already gets a near-zero correction
  daytona: 'daytona', fuji: 'fuji', indianapolis: 'indianapolis', 'laguna-seca': 'laguna-seca', 'lime-rock': 'lime-rock', 'long-beach': 'long-beach',
  mosport: 'mosport', mugello: 'mugello', 'paul-ricard-f1': 'paul-ricard', portimao: 'portimao', 'road-america': 'road-america', 'road-atlanta': 'road-atlanta',
  sebring: 'sebring', vir: 'virginia-international-raceway', 'watkins-glen': 'watkins-glen', 'le-mans': 'circuit-de-la-sarthe'};
const SKIP_MAX = 0.25; // more than a quarter of the lap over GAP_MAX_M: another layout, no correction at all
const GAP_MAX_M = 12, TAPER_M = 60, SMOOTH_M = 20;
const dir = process.argv[2]; if (!dir) throw new Error('usage: map-shape-atlas.mjs <track-atlas dir>');

const atlasLine = slug => { const f = [`${dir}/tracks/${slug}/raw/layers/gp.geojson`, `${dir}/tracks/${slug}/raw/layers/24h.geojson`, `${dir}/tracks/${slug}/raw/layers/imsa.geojson`].find(existsSync); if (!f) return null;
  const ll = JSON.parse(readFileSync(f, 'utf8')).features.find(x => x.geometry.type === 'LineString')?.geometry.coordinates; if (!ll) return null;
  const lon0 = ll.reduce((s, p) => s + p[0], 0) / ll.length, lat0 = ll.reduce((s, p) => s + p[1], 0) / ll.length, k = Math.PI / 180 * 6371000;
  const P = ll.map(p => [(p[0] - lon0) * k * Math.cos(lat0 * Math.PI / 180), (p[1] - lat0) * k]), out = [];
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1)); for (let j = 0; j < n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
  return out; };
// nearest atlas point: a coarse grid keeps it fast enough without a dependency
const grid = A => { const g = new Map(), key = (x, y) => Math.floor(x / 20) + ',' + Math.floor(y / 20); A.forEach((p, i) => { const k = key(...p); if (!g.has(k)) g.set(k, []); g.get(k).push(i); });
  return p => { let best = -1, bd = Infinity; for (let r = 0; r < 6 && (best < 0 || r < 2); r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; for (const i of g.get((Math.floor(p[0] / 20) + dx) + ',' + (Math.floor(p[1] / 20) + dy)) || []) { const d = Math.hypot(A[i][0] - p[0], A[i][1] - p[1]); if (d < bd) { bd = d; best = i; } } }
    if (best < 0) for (let i = 0; i < A.length; i++) { const d = Math.hypot(A[i][0] - p[0], A[i][1] - p[1]); if (d < bd) { bd = d; best = i; } } return [best, bd]; }; };
function icp(Xall, A, starts = 12) {
  const X0 = Xall.filter((_, i) => i % 3 === 0); // fit on every third point; the result is applied to all
  const near = grid(A), cA = [0, 1].map(c => A.reduce((s, p) => s + p[c], 0) / A.length), cX = [0, 1].map(c => X0.reduce((s, p) => s + p[c], 0) / X0.length);
  let best = null;
  for (let t = 0; t < starts; t++) { const th = t * 2 * Math.PI / starts; let R = [Math.cos(th), Math.sin(th)], T = [cA[0] - (cX[0] * R[0] - cX[1] * R[1]), cA[1] - (cX[0] * R[1] + cX[1] * R[0])];
    const tf = p => [p[0] * R[0] - p[1] * R[1] + T[0], p[0] * R[1] + p[1] * R[0] + T[1]];
    for (let it = 0; it < 30; it++) { const X = X0.map(tf), Y = X.map(p => A[near(p)[0]]), w = X.map((p, i) => Math.hypot(p[0] - Y[i][0], p[1] - Y[i][1]) < 25 ? 1 : 0.05);
      const W = w.reduce((s, x) => s + x, 0), mx = [0, 1].map(c => X0.reduce((s, p, i) => s + w[i] * p[c], 0) / W), my = [0, 1].map(c => Y.reduce((s, p, i) => s + w[i] * p[c], 0) / W);
      let sxx = 0, sxy = 0; X0.forEach((p, i) => { const a = [p[0] - mx[0], p[1] - mx[1]], b = [Y[i][0] - my[0], Y[i][1] - my[1]]; sxx += w[i] * (a[0] * b[0] + a[1] * b[1]); sxy += w[i] * (a[0] * b[1] - a[1] * b[0]); });
      const th2 = Math.atan2(sxy, sxx); R = [Math.cos(th2), Math.sin(th2)]; T = [my[0] - (mx[0] * R[0] - mx[1] * R[1]), my[1] - (mx[0] * R[1] + mx[1] * R[0])]; }
    const X = X0.map(tf), d = X.map(p => near(p)[1]), rms = Math.sqrt(d.filter(x => x < 25).reduce((s, x) => s + x * x, 0) / Math.max(1, d.filter(x => x < 25).length)), share = d.filter(x => x < 25).length / d.length;
    if (!best || share - rms / 100 > best.share - best.rms / 100) best = {R, T, tf, rms, share}; }
  return {R: best.R, X: Xall.map(best.tf), near}; }

const out = {}, report = [];
for (const [id, slug] of Object.entries(ATLAS)) { const A = atlasLine(slug), L = lineData(id, {shape: false}); if (!A || !L || L.edges === undefined) { report.push(id + ': no atlas'); continue; }
  const n = L.mid.length, st = L.mid.reduce((s, p, i) => s + Math.hypot(p[0] - L.mid[(i + 1) % n][0], p[1] - L.mid[(i + 1) % n][1]), 0) / n;
  let fitR = icp(L.mid, A); { const f = fitR.X.filter(p => fitR.near(p)[1] > GAP_MAX_M).length / n; if (f > SKIP_MAX) fitR = icp(L.mid, A, 72); } // a poor start: try finer start angles
  const {R, X, near} = fitR;
  // sideways gap along our normal (rotated into the atlas frame), from the nearest atlas segment
  const gap = X.map((p, i) => { const [j] = near(p), a = A[j], b = A[(j + 1) % A.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, q = [a[0] + dx * t, a[1] + dy * t];
    const nr = [L.nrm[i][0] * R[0] - L.nrm[i][1] * R[1], L.nrm[i][0] * R[1] + L.nrm[i][1] * R[0]]; return (q[0] - p[0]) * nr[0] + (q[1] - p[1]) * nr[1]; });
  const dist = X.map(p => near(p)[1]), bad = dist.map(d => d > GAP_MAX_M), tap = Math.round(TAPER_M / st), keep = bad.map((_, i) => { for (let k = -tap; k <= tap; k++) if (bad[(i + k + n) % n]) return 0; return 1; });
  const sg = SMOOTH_M / st, r = Math.ceil(3 * sg), w = []; for (let k = -r; k <= r; k++) w.push(Math.exp(-k * k / (2 * sg * sg))); const W = w.reduce((s, x) => s + x, 0);
  const raw = gap.map((g, i) => g * keep[i]), corr = raw.map((_, i) => Math.round(w.reduce((s, x, k) => s + x * raw[(i + k - r + n * 4) % n], 0) / W * 10));
  const after = X.map((p, i) => Math.abs(gap[i] - corr[i] / 10)).filter((_, i) => keep[i]), rmsB = Math.sqrt(gap.filter((_, i) => keep[i]).reduce((s, x) => s + x * x, 0) / Math.max(1, after.length)), rmsA = Math.sqrt(after.reduce((s, x) => s + x * x, 0) / Math.max(1, after.length));
  if (1 - keep.reduce((s, x) => s + x, 0) / n > SKIP_MAX) { report.push(`${id} (${slug}): another layout (${((1 - keep.reduce((s, x) => s + x, 0) / n) * 100).toFixed(0)} % over ${GAP_MAX_M} m), not used`); continue; }
  out[id] = {atlas: slug, corr, rmsBeforeM: +rmsB.toFixed(2), rmsAfterM: +rmsA.toFixed(2), maxCorrM: +(Math.max(...corr.map(Math.abs)) / 10).toFixed(1), skippedShare: +(1 - keep.reduce((s, x) => s + x, 0) / n).toFixed(3)};
  console.error(id, rmsB.toFixed(2), rmsA.toFixed(2)); report.push(`${id} (${slug}): sideways gap rms ${rmsB.toFixed(2)} -> ${rmsA.toFixed(2)} m, max correction ${out[id].maxCorrM} m, skipped ${(out[id].skippedShare * 100).toFixed(1)} %`); }
writeFileSync('worker/lapsim/map-shape-data.js', '// Generated by scripts/sim/tracks/map-shape-atlas.mjs from tobi/track-atlas midlines (MIT; geometry © OpenStreetMap contributors, ODbL).\n// Sideways correction of the drawn midline (0.1 m, along its normal). Drawing only. Do not edit by hand.\nexport const lapsimMapShape = ' + JSON.stringify({generated: new Date().toISOString().slice(0, 10), gapMaxM: GAP_MAX_M, smoothM: SMOOTH_M, tracks: out}) + ';\n');
console.log(report.join('\n'));
