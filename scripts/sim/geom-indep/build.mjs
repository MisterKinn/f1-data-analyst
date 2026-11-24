// Step 3 (claude/gate-independent-geometry-prereg-2026-11-23.md): track geometry that does not come from the cars, 4 tracks.
// OSM raceway centre line (local tangent plane) -> Gaussian σ 8 m -> least-curvature line inside W/2 − 1.2 m (racing-line.js
// defaults) -> lineTrack 5 m; grade, vertical curvature and banking from the best open elevation model. The production line is used
// only to choose the OSM branch, the direction and start line, and for the distance correspondence (s_old -> s_new) of measured data.
// Usage: node scripts/sim/geom-indep/build.mjs <raw dir: <id>-osm.json, <id>-dem.json> [--out scripts/sim/data/geom-indep]
// Writes tracks.json (one geometry per layout era) and report.json. Nothing in production reads them; apply.mjs uses them behind
// LAPSIM_GEOM_INDEP=1.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../../worker/lapsim/tracks-data.js';
import {lapsimTrackWidths} from '../../../worker/lapsim/track-widths.js';
import {minCurvatureLine, lineTrack} from '../../../worker/lapsim/racing-line.js';

const K = lapsimKernel();
export const IDS = ['jeddah', 'shanghai', 'imola', 'suzuka'];
export const SEEDS = {jeddah: [21.6319, 39.1044], shanghai: [31.3389, 121.2197], imola: [44.338, 11.708], suzuka: [34.8431, 136.541]};
// FIA list of licensed circuits (2025-12-01 / 2026-03-31, scripts/sim/data/tracks/fia-circuits.json): official length and width
export const FIA = {jeddah: {lengthM: 6176, widthM: 12}, shanghai: {lengthM: 5451, widthM: 13}, imola: {lengthM: 4909, widthM: 10}, suzuka: {lengthM: 5807, widthM: 10}};
export const SET = {sigmaM: 8, ds: 5, carM: 1.2, matchM: 30, matchDeg: 40}; // declared in the pre-registration, never tuned
// attempt 2 (claude/gate-independent-geometry-attempt2-prereg-2026-11-23.md): spline OSM, σ 3 m, TUM widths, 0.2 m kerb margin inside
// corners, line at 2.5 m, curvature per 5 m cell. --variant g2 rebuilds attempt 2 (rejected; scripts/sim/data/geom-indep/tracks-g2.json).
export const G2 = {sigmaM: 3, lineDs: 2.5, kerbM: 0.2, insideK: 1 / 150, tumM: 15};
export const TUM = {shanghai: 'Shanghai', suzuka: 'Suzuka'};
let VARIANT = 'g1'; export const setVariant = v => { VARIANT = v; }; // attempt 2 (g2) was rejected; tracks-g2.json keeps its output

// ---- coordinates -------------------------------------------------------------------------------------------------------
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F);
const ecef = (lat, lon, h = 0) => { const p = lat * Math.PI / 180, l = lon * Math.PI / 180, N = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
  return [(N + h) * Math.cos(p) * Math.cos(l), (N + h) * Math.cos(p) * Math.sin(l), (N * (1 - E2) + h) * Math.sin(p)]; };
// local tangent plane (ENU) at the seed: scale error < 1e-6 over ±3 km
export function enu([lat0, lon0]) {
  const o = ecef(lat0, lon0), p = lat0 * Math.PI / 180, l = lon0 * Math.PI / 180, sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
  const fwd = (lat, lon) => { const [x, y, z] = ecef(lat, lon), dx = x - o[0], dy = y - o[1], dz = z - o[2]; return [-sl * dx + cl * dy, -sp * cl * dx - sp * sl * dy + cp * dz]; };
  // inverse by two Newton steps on the local scale (exact enough: < 1 mm over the track)
  const inv = (e, n) => { let la = lat0 + n / 111320, lo = lon0 + e / (111320 * Math.cos(p));
    for (let k = 0; k < 3; k++) { const [e1, n1] = fwd(la, lo), [e2] = fwd(la, lo + 1e-5), [, n2] = fwd(la + 1e-5, lo); lo += (e - e1) / ((e2 - e1) / 1e-5); la += (n - n1) / ((n2 - n1) / 1e-5); }
    return [la, lo]; };
  return {fwd, inv};
}
// transverse Mercator (UTM) forward, Krüger series to n^3 (mm accuracy): for grids delivered in UTM (Imola EPSG:32632)
export function utm(lat, lon, zone) {
  const n = F / (2 - F), a = A / (1 + n) * (1 + n * n / 4 + n ** 4 / 64), al = [n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16, 13 * n * n / 48 - 3 * n ** 3 / 5, 61 * n ** 3 / 240];
  const p = lat * Math.PI / 180, l = (lon - (zone * 6 - 183)) * Math.PI / 180, e = Math.sqrt(E2);
  const t = Math.sinh(Math.atanh(Math.sin(p)) - e * Math.atanh(e * Math.sin(p))), xi = Math.atan2(t, Math.cos(l)), eta = Math.atanh(Math.sin(l) / Math.sqrt(1 + t * t));
  let x = eta, y = xi; for (let j = 1; j <= 3; j++) { x += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); y += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); }
  return [500000 + 0.9996 * a * x, 0.9996 * a * y];
}

// ---- elevation grid sampler (bilinear; NaN outside or on no-data) ---------------------------------------------------------
export function demSampler(g) {
  const b = Buffer.from(g.cm, 'base64'), v = new Float64Array(g.nx * g.ny);
  for (let i = 0; i < v.length; i++) { const c = b.readInt32LE(i * 4); v[i] = c === -(2 ** 31) ? NaN : c / 100; }
  const at = (fx, fy) => { const x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, w = fy - y0; if (x0 < 0 || y0 < 0 || x0 + 1 >= g.nx || y0 + 1 >= g.ny) return NaN;
    const q = (x, y) => v[y * g.nx + x]; return q(x0, y0) * (1 - u) * (1 - w) + q(x0 + 1, y0) * u * (1 - w) + q(x0, y0 + 1) * (1 - u) * w + q(x0 + 1, y0 + 1) * u * w; };
  if (g.crs === 'webmercator-xyz') return (lat, lon) => { const s = 2 ** g.z * 256, r = lat * Math.PI / 180;
    return at((lon + 180) / 360 * s - g.x0 * 256 - 0.5, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s - g.y0 * 256 - 0.5); };
  const zone = /326(\d\d)/.exec(g.crs)?.[1];
  if (zone) return (lat, lon) => { const [x, y] = utm(lat, lon, +zone); return at((x - g.x0) / g.dx - 0.5, (y - g.y0) / g.dy - 0.5); };
  return (lat, lon) => at((lon - g.x0) / g.dx - 0.5, (lat - g.y0) / g.dy - 0.5); // EPSG:4326
}

// ---- small helpers -----------------------------------------------------------------------------------------------------
const wrap = (i, n) => ((i % n) + n) % n;
export function resampleClosed(x, y, step) {
  const n = x.length, s = [0]; for (let i = 1; i <= n; i++) s.push(s[i - 1] + Math.hypot(x[i % n] - x[i - 1], y[i % n] - y[i - 1]));
  const L = s[n], m = Math.round(L / step), d = L / m, ox = new Float64Array(m), oy = new Float64Array(m);
  for (let j = 0, i = 0; j < m; j++) { const t = j * d; while (s[i + 1] < t) i++; const f = (t - s[i]) / (s[i + 1] - s[i] || 1); ox[j] = x[i] + f * (x[(i + 1) % n] - x[i]); oy[j] = y[i] + f * (y[(i + 1) % n] - y[i]); }
  return {x: ox, y: oy, step: d, length: L};
}
export function gaussClosed(a, sigmaPts) {
  const n = a.length, h = Math.ceil(4 * sigmaPts), w = Array.from({length: 2 * h + 1}, (_, k) => Math.exp(-((k - h) ** 2) / (2 * sigmaPts * sigmaPts))), ws = w.reduce((p, q) => p + q, 0);
  return Float64Array.from(a, (_, i) => { let s = 0; for (let k = -h; k <= h; k++) s += w[k + h] * a[wrap(i + k, n)]; return s / ws; });
}
const medianClosed = (a, half) => Float64Array.from(a, (_, i) => { const v = []; for (let k = -half; k <= half; k++) { const q = a[wrap(i + k, a.length)]; if (Number.isFinite(q)) v.push(q); } v.sort((p, q) => p - q); return v.length ? v[v.length >> 1] : NaN; });
const fillNaN = a => { const n = a.length, idx = [...a.keys()].filter(i => Number.isFinite(a[i])); if (!idx.length) return a;
  return Float64Array.from(a, (v, i) => { if (Number.isFinite(v)) return v; let lo = idx.findLast(j => j < i) ?? idx.at(-1) - n, hi = idx.find(j => j > i) ?? idx[0] + n; const f = (i - lo) / (hi - lo); return a[wrap(lo, n)] * (1 - f) + a[wrap(hi, n)] * f; }); };
function grid2(pts, cell = 10) { const m = new Map(); pts.forEach((p, i) => { const k = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell); (m.get(k) || m.set(k, []).get(k)).push(i); });
  return (x, y, r) => { const out = [], c = Math.ceil(r / cell), cx = Math.floor(x / cell), cy = Math.floor(y / cell); for (let a = -c; a <= c; a++) for (let b = -c; b <= c; b++) for (const i of m.get((cx + a) + ',' + (cy + b)) || []) out.push(i); return out; }; }

// ---- OSM ways -> dense points with way id, arc position and direction -------------------------------------------------
export function osmPoints(osm, P) {
  const ways = osm.elements ? osm.elements.filter(e => e.type === 'way' && e.geometry?.length > 1).map(e => ({id: e.id, tags: e.tags || {}, g: e.geometry.map(q => [q.lat, q.lon])}))
    : osm.ways.map((w, k) => ({id: k, tags: w.tags || {}, g: w.g}));
  const pts = [];
  ways.forEach((w, wi) => { const q = w.g.map(([la, lo]) => P.fwd(la, lo));
    if (VARIANT !== 'g1' && q.length > 2) { // centripetal Catmull-Rom through the nodes (G2 change 1)
      const closed = Math.hypot(q[0][0] - q.at(-1)[0], q[0][1] - q.at(-1)[1]) < 0.5, at = j => closed ? q[((j % (q.length - 1)) + q.length - 1) % (q.length - 1)] : q[Math.max(0, Math.min(q.length - 1, j))];
      for (let j = 0; j + 1 < q.length; j++) { const P0 = at(j - 1), P1 = q[j], P2 = q[j + 1], P3 = at(j + 2), d = (a, b) => Math.max(1e-3, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
        const t1 = d(P0, P1), t2 = t1 + d(P1, P2), t3 = t2 + d(P2, P3), L = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]), m = Math.max(1, Math.ceil(L / 0.5)), pt = [];
        for (let k = 0; k <= m; k++) { const t = t1 + (t2 - t1) * k / m, lerp = (A, B, ta, tb) => [0, 1].map(c => ((tb - t) * A[c] + (t - ta) * B[c]) / (tb - ta));
          const A1 = lerp(P0, P1, 0, t1), A2 = lerp(P1, P2, t1, t2), A3 = lerp(P2, P3, t2, t3), B1 = lerp(A1, A2, 0, t2), B2 = lerp(A2, A3, t1, t3); pt.push(lerp(B1, B2, t1, t2)); }
        for (let k = 0; k < m; k++) pts.push({x: pt[k][0], y: pt[k][1], h: Math.atan2(pt[k + 1][1] - pt[k][1], pt[k + 1][0] - pt[k][0]), w: wi, seg: j, k}); }
      return; }
    for (let j = 0; j + 1 < q.length; j++) { const [ax, ay] = q[j], [bx, by] = q[j + 1], L = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.ceil(L / 0.5)), h = Math.atan2(by - ay, bx - ax);
      for (let k = 0; k < m; k++) pts.push({x: ax + (bx - ax) * k / m, y: ay + (by - ay) * k / m, h, w: wi, seg: j, k}); } });
  return {ways, pts};
}

// ---- rigid trimmed ICP: production map line (own frame) onto the OSM points ---------------------------------------------
export function register(px, py, op, {byMatch = false, northDeg = null} = {}) {
  const near = grid2(op.map(p => [p.x, p.y]), 10);
  const nn = (x, y) => { let best = Infinity, bi = -1; for (const r of [10, 30, 80, 200, 500]) { for (const i of near(x, y, r)) { const d = (op[i].x - x) ** 2 + (op[i].y - y) ** 2; if (d < best) { best = d; bi = i; } } if (bi >= 0 && best <= r * r) break; } return [bi, Math.sqrt(best)]; };
  const n = px.length, mx = px.reduce((a, b) => a + b) / n, my = py.reduce((a, b) => a + b) / n, ox = op.reduce((a, p) => a + p.x, 0) / op.length, oy = op.reduce((a, p) => a + p.y, 0) / op.length;
  const sub = Array.from({length: Math.ceil(n / 4)}, (_, j) => j * 4);
  const run = (th, mir, iters, idx, trim = 0.8, t0 = null) => { let c = Math.cos(th), s = Math.sin(th), tx = t0 ? t0.tx : ox, ty = t0 ? t0.ty : oy, score = Infinity, sg = mir ? -1 : 1;
    for (let it = 0; it < iters; it++) {
      const pr = idx.map(i => { const u = px[i] - mx, v = sg * (py[i] - my), x = c * u - s * v + tx, y = s * u + c * v + ty, [j, d] = nn(x, y); return {u, v, j, d}; }).filter(q => q.j >= 0).sort((a, b) => a.d - b.d);
      if (pr.length < idx.length / 2) return {c, s, tx, ty, score: Infinity, mir};
      const keep = pr.slice(0, Math.floor(pr.length * trim)); score = keep.reduce((a, q) => a + q.d, 0) / keep.length;
      // 2-D Procrustes on the kept pairs
      let su = 0, sv = 0, sx = 0, sy = 0; for (const q of keep) { su += q.u; sv += q.v; sx += op[q.j].x; sy += op[q.j].y; } const k = keep.length; su /= k; sv /= k; sx /= k; sy /= k;
      let a = 0, b = 0; for (const q of keep) { const u = q.u - su, v = q.v - sv, x = op[q.j].x - sx, y = op[q.j].y - sy; a += u * x + v * y; b += u * y - v * x; }
      const t = Math.atan2(b, a); c = Math.cos(t); s = Math.sin(t); tx = sx - (c * su - s * sv); ty = sy - (s * su + c * sv);
    }
    return {c, s, tx, ty, score, mir}; };
  let best = null;
  // attempt 3 (amendment C1, byMatch): a map projection keeps handedness, so no mirror; candidates are ranked by the share of stations
  // with an OSM point within 30 m and heading within 40° (other layouts near the circuit win a trimmed-distance ranking), then distance
  const cosMax = Math.cos(40 * Math.PI / 180), share = r => { const sg = r.mir ? -1 : 1; let k = 0; for (const i of sub) { const u = px[i] - mx, v = sg * (py[i] - my), x = r.c * u - r.s * v + r.tx, y = r.s * u + r.c * v + r.ty;
    const j = (i + 1) % n, du = px[j] - px[i], dv = sg * (py[j] - py[i]), hx = r.c * du - r.s * dv, hy = r.s * du + r.c * dv, hl = Math.hypot(hx, hy) || 1;
    if (near(x, y, 30).some(q => (op[q].x - x) ** 2 + (op[q].y - y) ** 2 < 900 && Math.abs(Math.cos(op[q].h) * hx / hl + Math.sin(op[q].h) * hy / hl) >= cosMax)) k++; } return k / sub.length; };
  // with a checked north (track-north-data.js), its rotation is also tried from a grid of start shifts (±400 m), beside the sweep
  const starts = [...Array.from({length: 72}, (_, k) => [k * 5 * Math.PI / 180, null]),
    ...(northDeg != null ? [-4, 0, 4].flatMap(dd => [-400, -200, 0, 200, 400].flatMap(a => [-400, -200, 0, 200, 400].map(b => [(northDeg + dd) * Math.PI / 180, {tx: ox + a, ty: oy + b}]))) : [])];
  for (const mir of byMatch ? [false] : [false, true]) for (const [th, t0] of starts) { const r = run(th, mir, 6, sub, 0.8, t0); if (byMatch) r.share = share(r);
    if (!best || (byMatch ? r.share > best.share + 1e-9 || (Math.abs(r.share - best.share) <= 1e-9 && r.score < best.score) : r.score < best.score)) best = r; }
  // refine: 80 % trim, then 50 % (other ways near the circuit, such as Jeddah's karting and Formula E loops, pull an 80 % fit by 0.7°)
  const mid = run(Math.atan2(best.s, best.c), best.mir, 20, [...Array(n).keys()], 0.8, best), fin = run(Math.atan2(mid.s, mid.c), best.mir, 30, [...Array(n).keys()], 0.5, mid);
  const sg = fin.mir ? -1 : 1, x = new Float64Array(n), y = new Float64Array(n);
  for (let i = 0; i < n; i++) { const u = px[i] - mx, v = sg * (py[i] - my); x[i] = fin.c * u - fin.s * v + fin.tx; y[i] = fin.s * u + fin.c * v + fin.ty; }
  const apply = (u0, v0) => { const u = u0 - mx, v = sg * (v0 - my); return [fin.c * u - fin.s * v + fin.tx, fin.s * u + fin.c * v + fin.ty]; };
  return {x, y, rotDeg: +(Math.atan2(fin.s, fin.c) * 180 / Math.PI).toFixed(2), mirror: fin.mir, trimmedMeanM: +fin.score.toFixed(2), apply};
}

// ---- centre line from OSM, in production order ----------------------------------------------------------------------------
export function centreFromOsm(rx, ry, op) {
  const n = rx.length, near = grid2(op.map(p => [p.x, p.y]), 10), cosMax = Math.cos(SET.matchDeg * Math.PI / 180), foot = new Array(n).fill(null);
  for (let i = 0; i < n; i++) { const hx = rx[wrap(i + 1, n)] - rx[wrap(i - 1, n)], hy = ry[wrap(i + 1, n)] - ry[wrap(i - 1, n)], hl = Math.hypot(hx, hy) || 1; let best = SET.matchM ** 2, bi = -1;
    for (const j of near(rx[i], ry[i], SET.matchM)) { const p = op[j], d = (p.x - rx[i]) ** 2 + (p.y - ry[i]) ** 2; if (d >= best) continue; if (Math.abs(Math.cos(p.h) * hx / hl + Math.sin(p.h) * hy / hl) < cosMax) continue; best = d; bi = j; }
    foot[i] = bi >= 0 ? bi : null; }
  const matched = foot.filter(f => f != null).length;
  // ordered loop: foot points, plus the OSM points between two feet on the same way (the polyline itself, 0.5 m apart)
  const X = [], Y = [], seq = [...Array(n).keys()].filter(i => foot[i] != null);
  let back = 0;
  for (let q = 0; q < seq.length; q++) { const a = op[foot[seq[q]]], b = op[foot[seq[(q + 1) % seq.length]]]; X.push(a.x); Y.push(a.y);
    const ia = foot[seq[q]], ib = foot[seq[(q + 1) % seq.length]];
    if (a.w === b.w && ia !== ib && Math.abs(ib - ia) < 400) { const st = ib > ia ? 1 : -1; for (let j = ia + st; j !== ib; j += st) if (op[j].w === a.w) { X.push(op[j].x); Y.push(op[j].y); } }
    const nx = rx[wrap(seq[q] + 1, n)] - rx[seq[q]], ny = ry[wrap(seq[q] + 1, n)] - ry[seq[q]]; if ((b.x - a.x) * nx + (b.y - a.y) * ny < -0.5) back++; }
  const ways = [...new Set(foot.filter(f => f != null).map(f => op[f].w))];
  return {x: X, y: Y, matchedShare: +(matched / n).toFixed(4), bridgedShare: +(1 - matched / n).toFixed(4), backSteps: back, ways};
}

// distance correspondence: production station i -> distance on the new line (nearest point, forced monotone), metres
export function distanceMap(rx, ry, lx, ly, dsNew, dsOld) {
  // nearest new station inside a window around the expected one (a global search jumps branch where the lap crosses itself)
  const n = rx.length, m = lx.length, out = new Float64Array(n), r = (m * dsNew) / (n * dsOld), W = Math.round(60 / dsNew);
  let prev = 0; { let b = Infinity; for (let j = 0; j < m; j++) { const q = (lx[j] - rx[0]) ** 2 + (ly[j] - ry[0]) ** 2; if (q < b) { b = q; prev = j; } } }
  for (let i = 0; i < n; i++) { const c = i === 0 ? prev : Math.round(out[i - 1] / dsNew + r * dsOld / dsNew); let best = Infinity, bj = c;
    for (let k = -W; k <= W; k++) { const j = wrap(c + k, m), q = (lx[j] - rx[i]) ** 2 + (ly[j] - ry[i]) ** 2; if (q < best) { best = q; bj = c + k; } }
    const j = wrap(bj, m), j2 = (j + 1) % m, ex = lx[j2] - lx[j], ey = ly[j2] - ly[j], t = Math.max(-0.5, Math.min(1, ((rx[i] - lx[j]) * ex + (ry[i] - ly[j]) * ey) / (ex * ex + ey * ey || 1)));
    out[i] = Math.max(i ? out[i - 1] : -Infinity, (bj + t) * dsNew); }
  return out;
}
export const mapDist = (sOld, dsOld, tbl, Lnew) => { const n = tbl.length, Lold = n * dsOld, s = wrap(sOld, Lold), f = s / dsOld, i = Math.floor(f), u = f - i, a = tbl[i % n], b = i + 1 < n ? tbl[i + 1] : tbl[0] + Lnew; return wrap(a + (b - a) * u, Lnew); };

// ---- one track ------------------------------------------------------------------------------------------------------------
// G2 change 4: curvature resolved on the 1 m line (see amendment B1 inside), one value per 5 m kernel station
export function circleKappa(lt) {
  // amendment B1 (before any lap number): the radius-scaled three-point circle over-counts the turn where the line bends sharply
  // (Shanghai T14: lap −388° instead of −360°). The 5 m value is now the exact change of the 1 m tangent angle across the cell (the lap
  // turn is kept to the degree), then 1-2-1 smoothed: no chord, so tight corners are not widened either.
  const l1 = resampleClosed(lt.x, lt.y, 1), n = l1.x.length, X = l1.x, Y = l1.y, m = lt.kappa.length, f = n / m;
  const th = new Float64Array(n + 1); for (let i = 0; i <= n; i++) { const a = Math.atan2(Y[(i + 1) % n] - Y[i % n], X[(i + 1) % n] - X[i % n]); th[i] = i ? th[i - 1] + Math.atan2(Math.sin(a - th[i - 1]), Math.cos(a - th[i - 1])) : a; }
  const k = Float64Array.from({length: m}, (_, j) => { const a = Math.round((j - 0.5) * f), b = Math.round((j + 0.5) * f), T = i => th[wrap(i, n)] + Math.floor(i / n) * (th[n] - th[0]); return (T(b) - T(a)) / ((b - a) * l1.step); });
  return Float64Array.from(k, (v, j) => (k[wrap(j - 1, m)] + 2 * v + k[(j + 1) % m]) / 4);
}
export const BAC = {jeddah: 'sa-2021', shanghai: 'cn-2004', imola: 'it-1953', suzuka: 'jp-1962'};
// amendment A1 (before any lap number): the production line is registered on the bacinger/f1-circuits loop (MIT, traced from imagery,
// one clean loop per circuit), not on all OSM ways: at Jeddah the karting, Formula E and pit-lane ways pulled the OSM fit 0.4–0.7° off
// (residual 4–13 m, OSM ↔ bacinger agree to 1–3 m). Only correspondence and branch choice use it; no curvature comes from it.
// opts (attempt 3, build-a3.mjs): {row, seed, fia: {lengthM, widthM}, bacFeature | null, widthM, widths(ctx) → {half, right, usableWidth,
// note}}; without opts the four attempt-1 tracks are built exactly as before
export function buildOne(id, osm, dem, dem30, bac, tum = null, opts = null) {
  const d = opts?.row ?? lapsimTracks[id], P = enu(opts?.seed ?? SEEDS[id]), {ways, pts} = osmPoints(osm, P), n0 = d.kappa.length, fia = opts?.fia ?? FIA[id];
  const bf = opts ? opts.bacFeature : bac.features.find(f => f.properties.id === BAC[id]), bp = bf ? osmPoints({ways: [{g: bf.geometry.coordinates.map(([lo, la]) => [la, lo])}]}, P).pts : pts;
  const reg = register(d.map.x, d.map.y, bp, {byMatch: !!opts, northDeg: opts?.northDeg ?? null});
  const c = centreFromOsm(reg.x, reg.y, pts);
  // centre line: 1 m, closed Gaussian σ 8 m, 5 m
  const g2 = VARIANT !== 'g1', sig = g2 ? G2.sigmaM : SET.sigmaM;
  const r1 = resampleClosed(c.x, c.y, 1), sx = gaussClosed(r1.x, sig / r1.step), sy = gaussClosed(r1.y, sig / r1.step), cl = resampleClosed(sx, sy, SET.ds);
  const W = opts?.widthM ?? lapsimTrackWidths[id]?.m ?? FIA[id]?.widthM ?? 12;
  let half = new Array(cl.x.length).fill(W / 2 - SET.carM), right = null, widthNote = {source: lapsimTrackWidths[id] ? 'track-widths.js' : 'FIA list', widthM: W}, usableWidth = null;
  if (opts?.widths) ({half, right, usableWidth, note: widthNote} = opts.widths({cl, P, reg, d, W}));
  if (g2) { // G2 changes 2 and 3: per-station widths (TUM where it exists) and the kerb margin inside corners, on a 2.5 m centre line
    const c2 = resampleClosed(sx, sy, G2.lineDs), n2 = c2.x.length, wl = new Array(n2).fill(W / 2), wr = new Array(n2).fill(W / 2);
    if (tum) { const tr = register(tum.x, tum.y, [...c2.x].map((x, i) => ({x, y: c2.y[i]}))), near = grid2([...tr.x].map((x, i) => [x, tr.y[i]]), 10); let hit = 0, flip = 0, cnt = 0;
      for (let i = 0; i < n2; i++) { let b = G2.tumM ** 2, bj = -1; for (const j of near(c2.x[i], c2.y[i], G2.tumM)) { const q = (tr.x[j] - c2.x[i]) ** 2 + (tr.y[j] - c2.y[i]) ** 2; if (q < b) { b = q; bj = j; } }
        if (bj < 0) continue; const nt = tum.x.length, tx = tr.x[(bj + 1) % nt] - tr.x[bj], ty = tr.y[(bj + 1) % nt] - tr.y[bj], cx = c2.x[(i + 1) % n2] - c2.x[i], cy = c2.y[(i + 1) % n2] - c2.y[i];
        // TUM columns are right / left of its own direction; a mirrored fit or a reversed direction swaps them
        const same = (tx * cx + ty * cy > 0) !== tr.mirror; cnt++; if (!same) flip++; wl[i] = same ? tum.wl[bj] : tum.wr[bj]; wr[i] = same ? tum.wr[bj] : tum.wl[bj]; hit++; }
      widthNote = {source: 'TUM racetrack-database (LGPL-3.0), per station', matched: +(hit / n2).toFixed(3), reversed: flip > cnt / 2, icpM: tr.trimmedMeanM, medianWidthM: +[...wl.map((v, i) => v + wr[i])].sort((a, b) => a - b)[n2 >> 1].toFixed(2)}; }
    const kc = Float64Array.from({length: n2}, (_, i) => { const a = wrap(i - 4, n2), b = (i + 4) % n2, ax = c2.x[i] - c2.x[a], ay = c2.y[i] - c2.y[a], bx = c2.x[b] - c2.x[i], by = c2.y[b] - c2.y[i];
      return 2 * (ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(c2.x[b] - c2.x[a], c2.y[b] - c2.y[a]) || 1); });
    const ks = Float64Array.from(kc, (_, i) => { let t = 0; for (let k = -8; k <= 8; k++) t += kc[wrap(i + k, n2)]; return t / 17; }); // ±20 m
    half = wl.map((v, i) => Math.max(0.5, v - (ks[i] > G2.insideK ? G2.kerbM : SET.carM))); right = wr.map((v, i) => Math.max(0.5, v - (ks[i] < -G2.insideK ? G2.kerbM : SET.carM)));
    // amendment B2 (before any lap number): an offset larger than the centre-line radius folds the line into a cusp (Shanghai T14,
    // lap turn −388°): the inside bound is kept under 0.8 × the local centre radius (±10 m curvature, not the ±20 m mean)
    for (let i = 0; i < n2; i++) { const R = 1 / Math.max(1e-6, Math.abs(kc[i])); if (kc[i] > 0) half[i] = Math.min(half[i], 0.8 * R); else right[i] = Math.min(right[i], 0.8 * R); }
    widthNote.kerbInsideShare = +(ks.filter(v => Math.abs(v) > G2.insideK).length / n2).toFixed(3);
    cl.x2 = c2.x; cl.y2 = c2.y; }
  const mc = g2 ? minCurvatureLine([...cl.x2], [...cl.y2], half, {right}) : opts?.widths ? minCurvatureLine([...cl.x], [...cl.y], half, {right, usableWidth}) : minCurvatureLine([...cl.x], [...cl.y], half);
  // attempt 3: the same corridor without the track-limit hook (WEC: no limits), kept as a second curvature when it differs
  const mcW = usableWidth ? minCurvatureLine([...cl.x], [...cl.y], half, {right}) : null;
  // start line: the production start (station 0) projected on the least-curvature line
  let j0 = 0, bd = Infinity; mc.x.forEach((x, j) => { const q = (x - reg.x[0]) ** 2 + (mc.y[j] - reg.y[0]) ** 2; if (q < bd) { bd = q; j0 = j; } });
  const rot = a => [...a.slice(j0), ...a.slice(0, j0)], lx0 = rot(mc.x), ly0 = rot(mc.y);
  const lt = lineTrack(K, lx0, ly0, SET.ds), m = lt.kappa.length;
  let wec = null; if (mcW) { let k0 = 0, b0 = Infinity; mcW.x.forEach((x, j) => { const q = (x - reg.x[0]) ** 2 + (mcW.y[j] - reg.y[0]) ** 2; if (q < b0) { b0 = q; k0 = j; } });
    const rw = a => [...a.slice(k0), ...a.slice(0, k0)], tw = lineTrack(K, rw(mcW.x), rw(mcW.y), SET.ds), sw = reg.mirror ? -1 : 1, kw = tw.kappa.map(v => Math.round(v * sw * 1e5));
    const same = kw.length === m && kw.every((v, i) => Math.abs(v - Math.round(lt.kappa[i] * sw * 1e5)) <= 1); if (!same) wec = {ds: tw.ds, length: Math.round(tw.kappa.length * tw.ds), kappa: kw}; }
  // the production frame may be mirrored relative to ENU: kappa sign follows the production convention (counter-clockwise +)
  const sgn = reg.mirror ? -1 : 1, kappa = Float64Array.from(g2 ? circleKappa(lt) : lt.kappa, v => v * sgn);
  // centre-line point and normal for every line station (for edges and the offset report)
  const cn = cl.x.length, cnear = grid2([...cl.x].map((x, j) => [x, cl.y[j]]), 10);
  const centreOf = (x, y) => { let best = Infinity, bj = 0; for (const j of cnear(x, y, 30)) { const q = (cl.x[j] - x) ** 2 + (cl.y[j] - y) ** 2; if (q < best) { best = q; bj = j; } } return bj; };
  // elevation: 1 m stations of the line and both edges; median over 3 grid cells, Gaussian σ = 2 grid, then 5 m
  const elev = g => { if (!g) return null; const zAt = demSampler(g), l1 = resampleClosed(lt.x, lt.y, 1), k1 = l1.x.length, z = new Float64Array(k1), zl = new Float64Array(k1), zr = new Float64Array(k1);
    for (let i = 0; i < k1; i++) { const j = centreOf(l1.x[i], l1.y[i]), a = wrap(j - 1, cn), b = wrap(j + 1, cn), tx = cl.x[b] - cl.x[a], ty = cl.y[b] - cl.y[a], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      const s = (x, y) => zAt(...P.inv(x, y)); z[i] = s(cl.x[j], cl.y[j]); /* A3: centre-line height (the line runs 1.2 m from the verge at apexes, where a 5 m cell mixes in the embankment) */ zl[i] = s(cl.x[j] + nx * W / 2, cl.y[j] + ny * W / 2); zr[i] = s(cl.x[j] - nx * W / 2, cl.y[j] - ny * W / 2); }
    // amendment A2 (before any lap number): a 2.5-D elevation model holds one surface where the lap crosses itself (Suzuka bridge):
    // stations within 12 m (plan) of a station more than 100 m away along the lap are blanked ± (2 grid + 40 m) and interpolated
    const cg = grid2([...l1.x].map((x, i) => [x, l1.y[i]]), 10), blank = new Uint8Array(k1), pad = Math.round(2 * g.gridM + 40); // A2: ± (2 grid + 40 m), the bridge ramps and cut slopes
    for (let i = 0; i < k1; i += 2) for (const j of cg(l1.x[i], l1.y[i], 12)) { const sep = Math.min(Math.abs(i - j), k1 - Math.abs(i - j)); if (sep > 100 && Math.hypot(l1.x[i] - l1.x[j], l1.y[i] - l1.y[j]) < 12) { for (let q = -pad; q <= pad; q++) blank[wrap(i + q, k1)] = 1; break; } }
    const crossM = blank.reduce((a, b) => a + b, 0); for (let i = 0; i < k1; i++) if (blank[i]) { z[i] = NaN; zl[i] = NaN; zr[i] = NaN; }
    // A4 (before any lap number): pits and humps narrower than half of 100 m that depart > 1.5 m from the 100 m running median are
    // surface artefacts (GSI DEM5A: a 5 m pit at Suzuka s ≈ 1945 m that neither GLO-30 nor the car heights show): blanked, interpolated
    { const zm = medianClosed(fillNaN(z), 50); let sp = 0; for (let i = 0; i < k1; i++) if (Math.abs(z[i] - zm[i]) > 1.5) { z[i] = NaN; zl[i] = NaN; zr[i] = NaN; sp++; } g.spikeM = sp; }
    const valid = [...z].filter(Number.isFinite).length / k1, filt = a => gaussClosed(medianClosed(fillNaN(a), Math.round(1.5 * g.gridM)), 2 * g.gridM);
    const zf = filt(z), lf = filt(zl), rf = filt(zr), at5 = a => Float64Array.from({length: m}, (_, i) => a[Math.min(k1 - 1, Math.round(i * lt.ds * k1 / (m * lt.ds)))]);
    const z5 = at5(zf), grade = Float64Array.from(z5, (_, i) => Math.atan((z5[(i + 1) % m] - z5[wrap(i - 1, m)]) / (2 * lt.ds)));
    const kv = Float64Array.from(grade, (_, i) => (grade[(i + 1) % m] - grade[wrap(i - 1, m)]) / (2 * lt.ds));
    // banking: + = outer edge higher (into the corner, the kernel's bank sign); left edge is left of the centre-line direction
    const bank = g.gridM <= W / 2 ? Float64Array.from(at5(Float64Array.from(lf, (v, i) => v - rf[i])), (dz, i) => Math.atan(dz / W) * (kappa[i] > 0 ? -1 : 1) * sgn) : null;
    return {source: g.source, url: g.url, licence: g.licence, gridM: g.gridM, validShare: +valid.toFixed(3), crossoverBlankM: crossM, spikeBlankM: g.spikeM, z5, grade, kv, bank, rangeM: +(Math.max(...z5) - Math.min(...z5)).toFixed(1)}; };
  const ev = elev(dem), ev30 = dem30 ? elev(dem30) : null;
  // heading (east = 0, counter-clockwise), true ENU frame
  const heading = Float64Array.from({length: m}, (_, i) => Math.atan2(lt.y[(i + 1) % m] - lt.y[wrap(i - 1, m)], lt.x[(i + 1) % m] - lt.x[wrap(i - 1, m)]));
  // distance correspondence of the measured-data positions
  const tbl = distanceMap(reg.x, reg.y, lt.x, lt.y, lt.ds, d.ds), Lnew = m * lt.ds, mp = s => Math.round(mapDist(s, d.ds, tbl, Lnew));
  const offs = [...lt.x].map((x, i) => { const j = centreOf(x, lt.y[i]); return Math.hypot(x - cl.x[j], lt.y[i] - cl.y[j]); });
  const row = {...d, ds: lt.ds, length: Math.round(Lnew), kappa: [...kappa].map(v => Math.round(v * 1e5)), grade: ev ? [...ev.grade].map(v => Math.round(v * 1e4)) : d.grade && Array.from({length: m}, (_, i) => d.grade[Math.min(n0 - 1, Math.round(i * n0 / m))]),
    heading: [...heading].map(v => Math.round(v * 1e3)), sectors: (d.sectors || []).map(mp), corners: (d.corners || []).map(q => ({...q, s: mp(q.s)})), map: d.map,
    quality: {...d.quality, geomIndep: {source: 'OSM highway=raceway centre line, least-curvature line (racing-line.js), elevation model', widthM: W}}};
  const report = {id, seed: SEEDS[id], osmWays: ways.length, waysUsed: c.ways.length, registration: {rotDeg: reg.rotDeg, mirror: reg.mirror, trimmedMeanM: reg.trimmedMeanM},
    matchedShare: c.matchedShare, bridgedShare: c.bridgedShare, sourceIncomplete: c.bridgedShare > 0.05, backSteps: c.backSteps,
    centreLengthM: +cl.length.toFixed(1), officialLengthM: fia?.lengthM ?? null, centreVsOfficialPct: fia?.lengthM ? +((cl.length / fia.lengthM - 1) * 100).toFixed(2) : null, suspect: fia?.lengthM ? Math.abs(cl.length / fia.lengthM - 1) > 0.015 : null,
    lineLengthM: +Lnew.toFixed(1), prodLengthM: +(n0 * d.ds).toFixed(1), widthM: W, widthSource: lapsimTrackWidths[id] ? 'track-widths.js' : 'FIA list', variant: VARIANT, width: widthNote,
    lineOffsetMaxM: +Math.max(...offs).toFixed(2), turnDeg: +(kappa.reduce((a, v) => a + v, 0) * lt.ds * 180 / Math.PI).toFixed(1),
    elevation: ev && {source: ev.source, url: ev.url, licence: ev.licence, gridM: ev.gridM, validShare: ev.validShare, crossoverBlankM: ev.crossoverBlankM, spikeBlankM: ev.spikeBlankM, rangeM: ev.rangeM, bankingFromSurface: !!ev.bank,
      gradeMaxPct: +(Math.max(...[...ev.grade].map(Math.abs)) * 100).toFixed(1), kvMax: +Math.max(...[...ev.kv].map(Math.abs)).toFixed(4), bankMaxDeg: ev.bank ? +(Math.max(...[...ev.bank].map(Math.abs)) * 180 / Math.PI).toFixed(1) : null},
    elevation30: ev30 && {source: ev30.source, gridM: 30, rangeM: ev30.rangeM, gradeRmsVsBestPct: ev ? +(Math.sqrt(ev.grade.reduce((a, v, i) => a + (v - ev30.grade[i]) ** 2, 0) / m) * 100).toFixed(2) : null},
    prodGradeRangeM: null};
  return {row, report, extra: {...(wec ? {wec} : {}), kv: ev && [...ev.kv].map(v => Math.round(v * 1e5)), bank: ev?.bank ? [...ev.bank].map(v => Math.round(v * 1e4)) : null, z: ev && [...ev.z5].map(v => Math.round(v * 10)),
    dist: [...tbl].map(v => Math.round(v * 10) / 10), line: {x: [...lt.x].map(v => Math.round(v * 10) / 10), y: [...lt.y].map(v => Math.round(v * 10) / 10)}}};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--variant')) setVariant(process.argv[process.argv.indexOf('--variant') + 1]);
  const raw = process.argv[2], outDir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'scripts/sim/data/geom-indep';
  const committed = JSON.parse(readFileSync('scripts/sim/data/tracks/osm-raceways-all.json', 'utf8'));
  const J = f => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null, tracks = {}, report = {};
  for (const id of IDS) {
    const tf = TUM[id] && `${raw}/tum-${TUM[id]}.csv`, tum = tf && existsSync(tf) ? (() => { const r = readFileSync(tf, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',').map(Number));
      return {x: r.map(q => q[0]), y: r.map(q => q[1]), wr: r.map(q => q[2]), wl: r.map(q => q[3])}; })() : null;
    const osm = J(`${raw}/${id}-osm.json`) || committed.tracks[id], b = buildOne(id, osm, J(`${raw}/${id}-dem.json`), J(`${raw}/${id}-dem30.json`), J(`${raw}/f1-circuits.geojson`), tum);
    b.report.osmSource = J(`${raw}/${id}-osm.json`)?._source || {licence: committed.source, note: 'committed fallback'};
    tracks[id] = {layout: lapsimTracks[id].name, eras: [{from: null, to: null, note: 'one era until the step 5a track-state registry lands', row: b.row, extra: b.extra}]};
    report[id] = b.report; console.log(JSON.stringify(b.report));
  }
  mkdirSync(outDir, {recursive: true});
  writeFileSync(`${outDir}/tracks.json`, JSON.stringify({generatedBy: 'scripts/sim/geom-indep/build.mjs', prereg: 'claude/gate-independent-geometry-prereg-2026-11-23.md', settings: SET, tracks}));
  writeFileSync(`${outDir}/build-report.json`, JSON.stringify(report, null, 1));
}
