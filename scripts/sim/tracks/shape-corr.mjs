// Sideways correction profile for the drawn midline, shared by map-shape-atlas.mjs and map-shape-osm.mjs.
// Owner 2026-11-16 ("Las Vegas T5 is distorted; fix every track"): a plain smoothed gap shifted a whole straight sideways and then
// dropped to zero where the reference was skipped (another road), which bent the line into an S just before the corner (Las Vegas
// T5: 10 m over 80 m). The correction now fixes shape, not position: the slow part of the gap (normalised Gaussian over the kept
// points, σ LONG_M) is removed first, so only bends shorter than a few hundred metres are corrected and a skipped stretch joins
// without a step. Returns 0.1 m integers.
export const LONG_M = 150;
const gauss = (sig, st) => { const s = sig / st, r = Math.ceil(3 * s), w = []; for (let k = -r; k <= r; k++) w.push(Math.exp(-k * k / (2 * s * s))); return {w, r}; };
const at = (a, i) => a[((i % a.length) + a.length) % a.length];
// the shape part of the gap (slow sideways drift removed), 0 where the reference is skipped
export function shapeGap(gap, keep, st) {
  const L = gauss(LONG_M, st), low = gap.map((_, i) => { let a = 0, b = 0; L.w.forEach((x, k) => { const j = i + k - L.r; a += x * at(keep, j) * at(gap, j); b += x * at(keep, j); }); return b > 1e-9 ? a / b : 0; });
  return gap.map((g, i) => (g - low[i]) * keep[i]);
}
export function corrProfile(gap, keep, st, smoothM) {
  const res = shapeGap(gap, keep, st), S = gauss(smoothM, st), W = S.w.reduce((s, x) => s + x, 0);
  return res.map((_, i) => Math.round(S.w.reduce((s, x, k) => s + x * at(res, i + k - S.r), 0) / W * 10));
}
// rms of the shape gap over the kept points, before and after the correction (m)
export function shapeRms(gap, keep, st, corr) {
  const res = shapeGap(gap, keep, st), idx = res.map((_, i) => i).filter(i => keep[i]), r = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
  return [r(idx.map(i => res[i])), r(idx.map(i => res[i] - corr[i] / 10))];
}
