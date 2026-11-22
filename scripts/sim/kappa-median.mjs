// Rolling median of a closed-lap curvature array over w metres (odd window, wraps over the line). Removes narrow spikes of the
// line's curvature without lowering it in general (corner-speed attempt 3, claude/gate-kappa-median-prereg-2026-11-23.md).
export function medianKappa(kappa, ds, w) {
  const h = Math.max(1, Math.round(w / 2 / ds)), n = kappa.length, out = new Array(n), win = new Array(2 * h + 1);
  for (let i = 0; i < n; i++) { for (let o = -h; o <= h; o++) win[o + h] = kappa[((i + o) % n + n) % n]; out[i] = [...win].sort((a, b) => a - b)[h]; }
  return out;
}
