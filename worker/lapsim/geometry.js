// Closed-curve geometry for track building: arc length, projection, kernel smoothing,
// curvature and shape alignment. Pure functions on plain arrays.

export function cumulative(x, y, closed = true) {
  const n = x.length, s = new Float64Array(n + (closed ? 1 : 0));
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  if (closed) s[n] = s[n - 1] + Math.hypot(x[0] - x[n - 1], y[0] - y[n - 1]);
  return s;
}

// Uniform arc-length resampling of a closed polyline (linear between vertices).
export function resampleClosed(x, y, ds, z = null) {
  const s = cumulative(x, y, true), L = s[s.length - 1], n = Math.max(8, Math.round(L / ds)), step = L / n;
  const ox = new Float64Array(n), oy = new Float64Array(n), oz = z ? new Float64Array(n) : null;
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = k * step;
    while (j < x.length - 1 && s[j + 1] < t) j++;
    const a = j, b = (j + 1) % x.length, seg = s[j + 1] - s[j] || 1, f = (t - s[j]) / seg;
    ox[k] = x[a] + (x[b] - x[a]) * f; oy[k] = y[a] + (y[b] - y[a]) * f;
    if (oz) oz[k] = z[a] + (z[b] - z[a]) * f;
  }
  return {x: ox, y: oy, z: oz, ds: step, length: L};
}

// Project points (in driving order) onto a closed reference polyline with uniform spacing.
// Returns arc-length position s and signed lateral offset for each point.
export function projectOnto(ref, px, py) {
  const n = ref.x.length, ds = ref.ds, out = new Float64Array(px.length), lat = new Float64Array(px.length);
  const segProj = (i, x, y) => {
    const a = i, b = (i + 1) % n, ex = ref.x[b] - ref.x[a], ey = ref.y[b] - ref.y[a], len2 = ex * ex + ey * ey || 1;
    let f = ((x - ref.x[a]) * ex + (y - ref.y[a]) * ey) / len2; f = Math.max(0, Math.min(1, f));
    const qx = ref.x[a] + ex * f, qy = ref.y[a] + ey * f, d2 = (x - qx) ** 2 + (y - qy) ** 2;
    const side = Math.sign(ex * (y - ref.y[a]) - ey * (x - ref.x[a])) || 1;
    return {d2, s: (i + f) * ds, lat: side * Math.sqrt(d2)};
  };
  let prev = -1;
  for (let k = 0; k < px.length; k++) {
    let best = null;
    const lo = prev < 0 ? 0 : prev - 40, hi = prev < 0 ? n : prev + 120;
    for (let c = lo; c < hi; c++) {
      const i = ((c % n) + n) % n, r = segProj(i, px[k], py[k]);
      if (!best || r.d2 < best.d2) best = {...r, i};
    }
    if (best.d2 > 900 && prev >= 0) { // lost the window (gap in data): global search
      for (let i = 0; i < n; i++) { const r = segProj(i, px[k], py[k]); if (r.d2 < best.d2) best = {...r, i}; }
    }
    out[k] = best.s; lat[k] = best.lat; prev = best.i;
  }
  return {s: out, lat};
}

// Periodic local-linear kernel regression of values at positions s onto a uniform grid.
// sigmaAt(s) (optional) gives a local bandwidth no larger than sigma: tight corners, where samples
// are dense, keep their shape; sparse fast sections use the full sigma.
export function kernelSmooth(s, vals, L, sigma, gridDs, {sigmaAt = null} = {}) {
  const order = Array.from(s.keys()).sort((a, b) => s[a] - s[b]);
  const S = order.map(i => s[i]), V = order.map(i => vals[i]);
  const ext = 4 * sigma, xs = [], ys = [];
  for (let i = 0; i < S.length; i++) if (S[i] > L - ext) { xs.push(S[i] - L); ys.push(V[i]); }
  for (let i = 0; i < S.length; i++) { xs.push(S[i]); ys.push(V[i]); }
  for (let i = 0; i < S.length; i++) if (S[i] < ext) { xs.push(S[i] + L); ys.push(V[i]); }
  const n = Math.round(L / gridDs), step = L / n, out = new Float64Array(n);
  let lo = 0;
  for (let k = 0; k < n; k++) {
    const c = k * step;
    while (lo < xs.length && xs[lo] < c - ext) lo++;
    let sw = 0, swx = 0, swxx = 0, swy = 0, swxy = 0;
    const sg = sigmaAt ? Math.min(sigma, sigmaAt(c)) : sigma;
    for (let i = lo; i < xs.length && xs[i] <= c + ext; i++) {
      const d = xs[i] - c, w = Math.exp(-0.5 * (d / sg) ** 2);
      sw += w; swx += w * d; swxx += w * d * d; swy += w * ys[i]; swxy += w * d * ys[i];
    }
    const det = sw * swxx - swx * swx;
    out[k] = det > 1e-9 ? (swxx * swy - swx * swxy) / det : (sw ? swy / sw : NaN);
  }
  // fill rare gaps by linear interpolation
  for (let k = 0; k < n; k++) if (!Number.isFinite(out[k])) {
    let a = k - 1, b = k + 1; while (!Number.isFinite(out[(a + n) % n])) a--; while (!Number.isFinite(out[b % n])) b++;
    const va = out[(a + n) % n], vb = out[b % n]; out[k] = va + (vb - va) * (k - a) / (b - a);
  }
  return {values: out, ds: step};
}

// Moving average on a closed array, window in samples (odd)
export function movingAverageClosed(a, w) {
  const n = a.length, h = Math.floor(w / 2), out = new Float64Array(n);
  if (h < 1) return Float64Array.from(a);
  let sum = 0; for (let k = -h; k <= h; k++) sum += a[(k + n) % n];
  for (let i = 0; i < n; i++) { out[i] = sum / (2 * h + 1); sum += a[(i + h + 1) % n] - a[(i - h + n) % n]; }
  return out;
}

// Heading (rad, 0 = +x, counter-clockwise) and curvature (1/m) of a uniformly sampled closed curve.
export function headingCurvature(x, y, ds, smoothM = 10) {
  const n = x.length, heading = new Float64Array(n), kappa = new Float64Array(n);
  for (let i = 0; i < n; i++) { const a = (i - 1 + n) % n, b = (i + 1) % n; heading[i] = Math.atan2(y[b] - y[a], x[b] - x[a]); }
  for (let i = 0; i < n; i++) {
    let d = heading[(i + 1) % n] - heading[(i - 1 + n) % n];
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    kappa[i] = d / (2 * ds);
  }
  return {heading, kappa: movingAverageClosed(kappa, Math.max(1, Math.round(smoothM / ds) | 1))};
}

// Best rigid fit (rotation, optional mirror) of closed curve A onto closed curve B, unknown
// start point and direction. Both are resampled to m points by arc length.
export function alignClosed(ax, ay, bx, by, m = 360) {
  const A = resampleClosed(ax, ay, cumulative(ax, ay)[ax.length] / m), B = resampleClosed(bx, by, cumulative(bx, by)[bx.length] / m);
  const na = A.x.length, nb = B.x.length, N = Math.min(na, nb);
  const centre = (X, Y) => { let cx = 0, cy = 0; for (let i = 0; i < X.length; i++) { cx += X[i]; cy += Y[i]; } return [cx / X.length, cy / X.length]; };
  const [acx, acy] = centre(A.x, A.y), [bcx, bcy] = centre(B.x, B.y);
  const scale = (A.length && B.length) ? B.length / A.length : 1;
  let best = {rms: Infinity};
  for (const mirror of [false, true]) for (const dir of [1, -1]) for (let shift = 0; shift < N; shift += 2) {
    let sxx = 0, sxy = 0;
    for (let i = 0; i < N; i++) {
      const ia = Math.floor(i * na / N), ib = Math.floor(((shift + dir * i) % N + N) % N * nb / N);
      const pax = (A.x[ia] - acx) * scale * (mirror ? -1 : 1), pay = (A.y[ia] - acy) * scale;
      const pbx = B.x[ib] - bcx, pby = B.y[ib] - bcy;
      sxx += pax * pbx + pay * pby; sxy += pax * pby - pay * pbx;
    }
    const theta = Math.atan2(sxy, sxx), c = Math.cos(theta), s = Math.sin(theta);
    let se = 0;
    for (let i = 0; i < N; i++) {
      const ia = Math.floor(i * na / N), ib = Math.floor(((shift + dir * i) % N + N) % N * nb / N);
      const pax = (A.x[ia] - acx) * scale * (mirror ? -1 : 1), pay = (A.y[ia] - acy) * scale;
      const dx = c * pax - s * pay - (B.x[ib] - bcx), dy = s * pax + c * pay - (B.y[ib] - bcy);
      se += dx * dx + dy * dy;
    }
    const rms = Math.sqrt(se / N);
    if (rms < best.rms) best = {rms, theta, mirror, dir, shift, scale};
  }
  return {...best, acx, acy, bcx, bcy};
}

// Apply an alignClosed() result to points of curve A (returns them in B's frame)
export function applyAlignment(al, x, y) {
  const c = Math.cos(al.theta), s = Math.sin(al.theta), ox = [], oy = [];
  for (let i = 0; i < x.length; i++) {
    const px = (x[i] - al.acx) * al.scale * (al.mirror ? -1 : 1), py = (y[i] - al.acy) * al.scale;
    ox.push(c * px - s * py + al.bcx); oy.push(s * px + c * py + al.bcy);
  }
  return {x: ox, y: oy};
}

// Lon/lat (degrees) to local east/north metres around the first point's latitude.
export function lonLatToLocal(coords) {
  const R = 6371008.8, lat0 = coords.reduce((a, c) => a + c[1], 0) / coords.length * Math.PI / 180, lon0 = coords[0][0], la0 = coords[0][1];
  return {x: coords.map(c => R * Math.cos(lat0) * (c[0] - lon0) * Math.PI / 180), y: coords.map(c => R * (c[1] - la0) * Math.PI / 180)};
}
