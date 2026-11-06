// Track helpers: build a simulator track object from stored geometry and find straights.

// Mark long, nearly straight runs as active-aero (Straight Mode) or DRS zones when the FIA
// zone list is not available. kappaMax: maximum |curvature| (1/m) still counted as straight.
export function autoStraights(kappa, ds, {kappaMax = 1 / 700, minLength = 250, startOffset = 60} = {}) {
  const n = kappa.length, low = new Uint8Array(n);
  const straight = i => Math.abs(kappa[(i + n) % n]) < kappaMax;
  // find a corner to start from so runs that wrap around the start line are handled
  let s0 = 0; while (s0 < n && straight(s0)) s0++;
  if (s0 >= n) return low.fill(1);
  let i = 0;
  while (i < n) {
    const a = (s0 + i) % n;
    if (!straight(a)) { i++; continue; }
    let len = 0; while (len < n && straight(s0 + i + len)) len++;
    if (len * ds >= minLength) {
      const skip = Math.round(startOffset / ds);
      for (let k = skip; k < len; k++) low[(s0 + i + k) % n] = 1;
    }
    i += len;
  }
  return low;
}

// Decode a stored track (see scripts/sim/build-tracks.mjs) into typed arrays.
// Stored arrays are integers: kappa ×1e5 (1/m), grade ×1e4 (rad), heading ×1e3 (rad).
export function trackFromData(d, {aero = 'auto'} = {}) {
  const kappa = Float64Array.from(d.kappa, v => v / 1e5);
  const n = kappa.length;
  const track = {
    id: d.id, name: d.name, ds: d.ds, kappa,
    grade: d.grade ? Float64Array.from(d.grade, v => v / 1e4) : null,
    heading: d.heading ? Float64Array.from(d.heading, v => v / 1e3) : null,
    mu: new Float64Array(n).fill(1), vScale: new Float64Array(n).fill(1),
    sectors: d.sectors || null, corners: d.corners || [],
  };
  if (aero === 'auto' || !d.aeroZones?.length) track.aeroLow = autoStraights(kappa, d.ds);
  else {
    const low = new Uint8Array(n);
    for (const [a, b] of d.aeroZones) for (let s = a; ; s += d.ds) {
      const i = Math.round((((s % (n * d.ds)) + n * d.ds) % (n * d.ds)) / d.ds) % n;
      low[i] = 1;
      if (b >= a ? s >= b : s >= b + n * d.ds) break;
    }
    track.aeroLow = low;
  }
  return track;
}
