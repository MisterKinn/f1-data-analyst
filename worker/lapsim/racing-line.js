// Minimum-curvature racing line inside a corridor: the predicted line for tracks without telemetry.
// Input: a closed reference path (x, y in metres, evenly spaced) and the free half-width on each side
// (half[i], metres). Output: sideways offset from the reference (+ = left normal) and the line points.
// Method: iterative relaxation of the offsets toward the position that straightens the path
// (each point toward the position of zero curvature change from its neighbours), clamped to the corridor;
// this converges to the least-curvature path the corridor allows (the classic geometric racing line).
// order 2 instead of 4: each point toward the midpoint of its neighbours, i.e. the shortest path inside the corridor.
export function minCurvatureLine(x, y, half, {iters = 4000, rate = 0.5, init = null, order = 4} = {}) {
  const n = x.length, nx = new Float64Array(n), ny = new Float64Array(n), o = new Float64Array(n);
  // coarse to fine: the curvature smoothing travels one point per step, so solve on every 4th point
  // first (global shape), then refine from there
  if (!init && n > 240) {
    const k = 4, sub = Array.from({length: Math.floor(n / k)}, (_, j) => j * k);
    const c = minCurvatureLine(sub.map(i => x[i]), sub.map(i => y[i]), sub.map(i => half[i]), {iters, rate, order});
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
      const tx = (order === 2 ? (px(a) + px(b)) / 2 : (4 * (px(a) + px(b)) - px(a2) - px(b2)) / 6) - x[i], ty = (order === 2 ? (py(a) + py(b)) / 2 : (4 * (py(a) + py(b)) - py(a2) - py(b2)) / 6) - y[i];
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

// Car-dependent line (owner 2026-11-15): per part of the lap, the fastest blend (1 − e)·shortest + e·least-curvature for this car
// (Braghin et al. 2008, Vehicle System Dynamics 46), found by running the lap kernel: first one e for the whole lap (golden-section
// search), then each of up to 10 windows tries e ± 0.3 and keeps it when the lap is faster. Grip, downforce, power and mass move the
// optimum, so each car gets its own line. ref: [x[], y[]], nrm: unit normals, mc/sp: offsets (m). Self-contained (sent to the browser).
export function blendLine(K, ref, nrm, mc, sp, car, env, grip = 1) {
  const n = mc.length, W = Math.max(4, Math.min(10, Math.round(n / 40))), ds = 5; // 5 m: curvature over ±10 m chords; at 10–20 m the chord hides hairpins and every blend looks too fast
  const offOf = w => blendOff(mc, sp, w);
  const lapOf = w => { const off = offOf(w), tr = lineTrack(K, ref[0].map((x, i) => x + nrm[i][0] * off[i]), ref[1].map((y, i) => y + nrm[i][1] * off[i]), ds); tr.mu.fill(grip); return K.simulateLap(tr, car, env).lapTime; };
  const one = e => lapOf(new Array(W).fill(e)), g = 0.618;
  let a = 0, b = 1, c = b - g * (b - a), d = a + g * (b - a), fc = one(c), fd = one(d);
  for (let k = 0; k < 5; k++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = one(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = one(d); } }
  const w = new Array(W).fill(+(fc < fd ? c : d).toFixed(2));
  let lap = Math.min(fc, fd);
  for (let k = 0; k < W; k++) for (const dv of [-0.3, 0.3]) {
    const t = w.slice(); t[k] = Math.max(0, Math.min(1, t[k] + dv)); if (t[k] === w[k]) continue;
    const l = lapOf(t); if (l < lap - 1e-3) { lap = l; w[k] = t[k]; }
  }
  return {e: +(w.reduce((s, x) => s + x, 0) / W).toFixed(2), w: w.map(x => +x.toFixed(2)), off: offOf(w), lap};
}

// Offsets (m) of a blend with one least-curvature share per window (w), interpolated between window centres around the lap.
// Shared by blendLine, the per-driver lines (scripts/sim/driver-lines.mjs) and the page. Self-contained.
export function blendOff(mc, sp, w) {
  const n = mc.length, W = w.length;
  return mc.map((m, i) => { const f = i / n * W - 0.5, a = Math.floor(f), t = f - a, e = w[(a + W) % W] * (1 - t) + w[(a + 1) % W] * t; return e * m + (1 - e) * sp[i]; });
}
