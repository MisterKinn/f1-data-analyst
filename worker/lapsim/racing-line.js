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
