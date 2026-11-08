// Minimum-curvature racing line inside a corridor: the predicted line for tracks without telemetry.
// Input: a closed reference path (x, y in metres, evenly spaced) and the free half-width on each side
// (half[i], metres). Output: sideways offset from the reference (+ = left normal) and the line points.
// Method: iterative relaxation of the offsets toward the position that straightens the path
// (each point toward the position of zero curvature change from its neighbours), clamped to the corridor;
// this converges to the least-curvature path the corridor allows (the classic geometric racing line).
export function minCurvatureLine(x, y, half, {iters = 4000, rate = 0.5, init = null} = {}) {
  const n = x.length, nx = new Float64Array(n), ny = new Float64Array(n), o = new Float64Array(n);
  // coarse to fine: the curvature smoothing travels one point per step, so solve on every 4th point
  // first (global shape), then refine from there
  if (!init && n > 240) {
    const k = 4, sub = Array.from({length: Math.floor(n / k)}, (_, j) => j * k);
    const c = minCurvatureLine(sub.map(i => x[i]), sub.map(i => y[i]), sub.map(i => half[i]), {iters, rate});
    init = Array.from({length: n}, (_, i) => { const j = Math.floor(i / k) % sub.length, j2 = (j + 1) % sub.length, f = (i - j * k) / k; return c.offset[j] * (1 - f) + c.offset[j2] * f; });
  }
  if (init) for (let i = 0; i < n; i++) o[i] = Math.max(-half[i], Math.min(half[i], init[i]));
  for (let i = 0; i < n; i++) {
    const dx = x[(i + 1) % n] - x[(i - 1 + n) % n], dy = y[(i + 1) % n] - y[(i - 1 + n) % n], l = Math.hypot(dx, dy) || 1;
    nx[i] = -dy / l; ny[i] = dx / l;
  }
  const px = i => x[i] + nx[i] * o[i], py = i => y[i] + ny[i] * o[i];
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n, a2 = (i - 2 + n) % n, b2 = (i + 2) % n;
      // where the point should be for zero change of curvature (biharmonic: minimises the summed squared
      // curvature, not the length), projected on its normal
      const tx = (4 * (px(a) + px(b)) - px(a2) - px(b2)) / 6 - x[i], ty = (4 * (py(a) + py(b)) - py(a2) - py(b2)) / 6 - y[i];
      const target = tx * nx[i] + ty * ny[i];
      o[i] = Math.max(-half[i], Math.min(half[i], o[i] + rate * (target - o[i])));
    }
  }
  return {offset: Array.from(o), x: Array.from(o, (v, i) => x[i] + nx[i] * v), y: Array.from(o, (v, i) => y[i] + ny[i] * v)};
}

// Closed polyline -> uniform-spacing track for the lap kernel K (curvature from three points about
// 20 m apart, lightly smoothed). Self-contained: the /simulation page sends its source to the browser.
export function lineTrack(K, px, py, ds = 10) {
  const n = px.length, s = [0];
  for (let i = 1; i <= n; i++) s.push(s[i - 1] + Math.hypot(px[i % n] - px[i - 1], py[i % n] - py[i - 1]));
  const L = s[n], m = Math.round(L / ds), d = L / m, x = new Float64Array(m), y = new Float64Array(m);
  for (let j = 0, i = 0; j < m; j++) { const t = j * d; while (s[i + 1] < t) i++; const f = (t - s[i]) / (s[i + 1] - s[i]); x[j] = px[i] + f * (px[(i + 1) % n] - px[i]); y[j] = py[i] + f * (py[(i + 1) % n] - py[i]); }
  const k = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    // three points 2 samples apart (about 20 m): curvature of the line, not of the sampling noise
    const a = (j - 2 + m) % m, b = (j + 2) % m, ax = x[j] - x[a], ay = y[j] - y[a], bx = x[b] - x[j], by = y[b] - y[j];
    k[j] = 2 * (ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(x[b] - x[a], y[b] - y[a]) || 1);
  }
  const kappa = k.map((v, j) => (k[(j - 1 + m) % m] + 2 * v + k[(j + 1) % m]) / 4);
  return {ds: d, kappa, grade: null, heading: null, mu: new Float64Array(m).fill(1), vScale: new Float64Array(m).fill(1), aeroLow: K.autoStraights(kappa, d), corners: [], length: L, x, y};
}
