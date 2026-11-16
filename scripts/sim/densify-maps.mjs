// Drawn track maps at the line's own spacing (owner 2026-11-16: "every track, a point at the shortest possible spacing").
// The simulator line is stored every 5 m (ds); the drawn map kept only one point in N. This rebuilds each map from the stored
// line at every ds: x += ds·cos(heading), y += ds·sin(heading) (heading = true heading in the map frame, mrad), or from the
// curvature when a track stores no heading. The closing gap is spread linearly over the lap, and the result is fitted to the
// old map (rotation + translation, matched by index) so the drawn position does not move. Nothing the simulator reads changes.
// The source lines themselves are 5-15 m between points, so 5 m is the finest spacing that adds real detail.
// Run after scripts/sim/build-geometry.mjs and build-geometry-extra.mjs:  node scripts/sim/densify-maps.mjs
import {readFileSync, writeFileSync} from 'node:fs';

const OUT = 'worker/lapsim/tracks-data.js';

export function denseMap(t) {
  const n = t.kappa.length, ds = t.ds;
  const H = t.heading?.length === n ? t.heading.map(v => v / 1e3)
    : (() => { const h = [0]; for (let i = 1; i < n; i++) h.push(h[i - 1] + t.kappa[i - 1] / 1e5 * ds); return h; })();
  const x = [0], y = [0];
  for (let i = 1; i <= n; i++) { x.push(x[i - 1] + ds * Math.cos(H[i - 1])); y.push(y[i - 1] + ds * Math.sin(H[i - 1])); }
  const gx = x[n], gy = y[n]; // closing gap, spread over the lap
  const P = Array.from({length: n}, (_, i) => [x[i] - gx * i / n, y[i] - gy * i / n]);
  // match the old map by index: old point j was line index j·step
  const m = t.map.x.length, k = Array.from({length: n}, (_, s) => s + 1).find(s => Math.ceil(n / s) === m) || Math.round(n / m), step = k, Q = t.map.x.map((v, j) => [v, t.map.y[j]]), S = Q.map((_, j) => P[Math.min(n - 1, Math.round(j * step))]);
  let best = null;
  for (const mir of [1, -1]) {
    const Sm = S.map(([a, b]) => [mir * a, b]), cs = mean(Sm), cq = mean(Q);
    let sxx = 0, sxy = 0; Sm.forEach((s, i) => { const a = [s[0] - cs[0], s[1] - cs[1]], b = [Q[i][0] - cq[0], Q[i][1] - cq[1]]; sxx += a[0] * b[0] + a[1] * b[1]; sxy += a[0] * b[1] - a[1] * b[0]; });
    const th = Math.atan2(sxy, sxx), c = Math.cos(th), s = Math.sin(th);
    const tf = ([a, b]) => { const u = mir * a - cs[0], v = b - cs[1]; return [c * u - s * v + cq[0], s * u + c * v + cq[1]]; };
    const rms = Math.sqrt(S.reduce((acc, p, i) => { const q = tf(p); return acc + (q[0] - Q[i][0]) ** 2 + (q[1] - Q[i][1]) ** 2; }, 0) / m);
    if (!best || rms < best.rms) best = {rms, tf};
  }
  // keep every old map point exactly (it is the measured line); the points between two old points follow the stored line,
  // shifted by the linear blend of the two end corrections, so only the in-between detail is new
  const D = P.map(best.tf), at = j => Math.min(n, j * k);
  for (let j = 0; j < m; j++) { const a = at(j), b = at(j + 1), ea = [Q[j][0] - D[a][0], Q[j][1] - D[a][1]], q2 = Q[(j + 1) % m], d2 = D[b % n], eb = [q2[0] - d2[0], q2[1] - d2[1]];
    for (let i = a; i < b; i++) { const f = (i - a) / (b - a); D[i] = [D[i][0] + ea[0] + (eb[0] - ea[0]) * f, D[i][1] + ea[1] + (eb[1] - ea[1]) * f]; } }
  return {map: {x: D.map(p => Math.round(p[0])), y: D.map(p => Math.round(p[1]))}, rms: best.rms, gap: Math.hypot(gx, gy)};
}
const mean = X => [X.reduce((a, p) => a + p[0], 0) / X.length, X.reduce((a, p) => a + p[1], 0) / X.length];

if (process.argv[1]?.endsWith('densify-maps.mjs')) {
  const mod = await import('../../' + OUT + '?' + Date.now()), text = readFileSync(OUT, 'utf8');
  let out = text, worst = 0;
  for (const T of [mod.lapsimTracks, mod.lapsimExtraTracks]) for (const [id, t] of Object.entries(T || {})) {
    if (!t?.map?.x?.length || !t.kappa?.length || t.map.x.length >= t.kappa.length) continue;
    const r = denseMap(t); worst = Math.max(worst, r.rms);
    if (r.rms > 8) { console.log(`${id}: kept (fit ${r.rms.toFixed(1)} m to the old map)`); continue; }
    const old = JSON.stringify(t.map), i = out.indexOf(old);
    if (i < 0 || out.indexOf(old, i + 1) >= 0) { console.log(`${id}: kept (map text not unique)`); continue; }
    out = out.slice(0, i) + JSON.stringify(r.map) + out.slice(i + old.length);
    console.log(`${id}: ${t.map.x.length} -> ${r.map.x.length} points, fit ${r.rms.toFixed(1)} m, closing gap ${r.gap.toFixed(0)} m`);
  }
  writeFileSync(OUT, out); console.log('worst fit', worst.toFixed(1), 'm');
}
