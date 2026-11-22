// Gate for every fit: keep a new model only if it beats the current one on held-out rows.
// errCur / errNew are held-out errors (e.g. % lap error from leave-one-track-out) on the SAME rows.
// Paired test on squared error: accept when the mean gain is larger than `k` standard errors.
export function gate(errCur, errNew, {k = 1, minRows = 5} = {}) {
  const n = Math.min(errCur.length, errNew.length);
  const rms = e => Math.sqrt(e.reduce((a, x) => a + x * x, 0) / (e.length || 1));
  const d = Array.from({length: n}, (_, i) => errCur[i] ** 2 - errNew[i] ** 2);
  const mean = d.reduce((a, x) => a + x, 0) / (n || 1);
  const se = n > 1 ? Math.sqrt(d.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1) / n) : Infinity;
  const accept = n >= minRows && mean > k * se;
  const reason = n < minRows ? `rejected: only ${n} held-out rows` : accept ? 'accepted: held-out error lower beyond noise'
    : mean <= 0 ? 'rejected: worse on held-out rows' : 'rejected: gain within noise';
  return {accept, n, rmsCur: rms(errCur.slice(0, n)), rmsNew: rms(errNew.slice(0, n)), gain: mean, se, reason};
}

// Same test per group (series, class, track…): the new model is used only in groups where it passes.
export function gateByGroup(rows, group, errCur, errNew, opts) {
  const by = {};
  rows.forEach((r, i) => (by[group(r)] ??= []).push(i));
  return Object.fromEntries(Object.entries(by).map(([g, ix]) => [g, gate(ix.map(i => errCur[i]), ix.map(i => errNew[i]), opts)]));
}

// Non-inferiority (rule or physics correctness, CLAUDE.md "Model changes"): accept when the upper bound of the RMS loss is within
// `margin` (percentage points of lap error; default 5 % of the baseline RMS): the paired loss on squared error plus `k` standard errors, turned into RMS units
// (delta method: d(RMS) = d(mean square) / (2 RMS)).
export function nonInferior(errCur, errNew, {margin = null, rel = 0.05, k = 1, minRows = 5} = {}) {
  const g0 = gate(errCur, errNew, {k: 0, minRows}); margin ??= rel * g0.rmsCur; const g = g0, upper = (-g.gain + k * g.se) / (2 * (g.rmsCur || 1e-9));
  const accept = g.n >= minRows && upper <= margin;
  const reason = g.n < minRows ? `not enough data: ${g.n} held-out rows` : accept ? `accepted: RMS loss at most ${upper.toFixed(3)} <= ${margin.toFixed(3)}`
    : `rejected: RMS loss up to ${upper.toFixed(3)} > ${margin.toFixed(3)}`;
  return {...g, accept, upper, reason};
}

// k for an accuracy claim when a run compares m variants with the same baseline (AGENTS.md "Model changes"; t quantile at
// one-sided 0.16 / m, about 67 rows; checked with Wolfram 2026-11-21)
// Gate G v3 (2026-11-22): with the number of held-out units n, k is the t-quantile at one-sided 1 − 0.16 / m with n − 1 degrees of
// freedom (Cornish-Fisher expansion of the normal quantile; within 0.01 of SciPy for m 1–5, n 5–67). Without n: the table above.
export function kForVariants(m, n) {
  if (!(n >= 2)) return m <= 1 ? 1 : m === 2 ? 1.45 : m === 3 ? 1.65 : 1.9;
  const z = normInv(1 - 0.16 / Math.max(1, m)), v = n - 1;
  return z + (z ** 3 + z) / (4 * v) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * v ** 2)
    + (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / (384 * v ** 3);
}

// Inverse standard normal CDF (Acklam's rational approximation, relative error < 1.2e-9).
export function normInv(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425, q = p < lo ? Math.sqrt(-2 * Math.log(p)) : p > 1 - lo ? Math.sqrt(-2 * Math.log(1 - p)) : 0;
  if (p < lo) return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  if (p > 1 - lo) return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  const r = (p - 0.5), t = r * r;
  return (((((a[0] * t + a[1]) * t + a[2]) * t + a[3]) * t + a[4]) * t + a[5]) * r / (((((b[0] * t + b[1]) * t + b[2]) * t + b[3]) * t + b[4]) * t + 1);
}

// Gate G v3.1 (2026-11-22): decide accuracy gates on per-unit gains (one gain per held-out track or event, + = better) with a
// one-sided sign-flip randomization test (no normal assumption; exact for n ≤ 16, else 20 000 seeded flips) and report the mean gain
// with a 90 % bootstrap interval. Pass when p < 0.16 / m (same false-pass risk per run as k = 1 for m = 1) and n ≥ 5.
export function signFlip(gains, {m = 1, minRows = 5, iters = 20000, seed = 1} = {}) {
  const g = gains.filter(Number.isFinite), n = g.length, mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const obs = mean(g), abs = g.map(Math.abs);
  let rng = seed >>> 0 || 1; const rand = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296);
  let ge = 0, tot = 0;
  if (n <= 16) {
    for (let mask = 0; mask < 1 << n; mask++) { let s = 0; for (let i = 0; i < n; i++) s += mask >> i & 1 ? -abs[i] : abs[i]; ge += s / n >= obs - 1e-12; tot++; }
  } else {
    for (let r = 0; r < iters; r++) { let s = 0; for (let i = 0; i < n; i++) s += rand() < 0.5 ? -abs[i] : abs[i]; ge += s / n >= obs - 1e-12; tot++; }
  }
  const p = n ? ge / tot : 1, boots = [];
  for (let r = 0; r < 4000 && n; r++) { let s = 0; for (let i = 0; i < n; i++) s += g[Math.floor(rand() * n)]; boots.push(s / n); }
  boots.sort((a, b) => a - b);
  const ci = n ? [boots[Math.floor(0.05 * boots.length)], boots[Math.floor(0.95 * boots.length) - 1]] : [NaN, NaN];
  const alpha = 0.16 / Math.max(1, m), accept = n >= minRows && obs > 0 && p < alpha;
  const reason = n < minRows ? `not enough data: ${n} held-out units` : accept ? `accepted: p ${p.toFixed(3)} < ${alpha.toFixed(3)}`
    : obs <= 0 ? 'rejected: worse on held-out units' : `rejected: p ${p.toFixed(3)} ≥ ${alpha.toFixed(3)}`;
  return {accept, n, gain: obs, p, alpha, ci90: ci, reason};
}

// Coverage of a shown ± (Gate G v3.1): share of held-out or logged predictions whose real value is inside ±1σ and ±2σ.
export function coverage(rows) {
  const ok = rows.filter(r => Number.isFinite(r.err) && r.sigma > 0), n = ok.length;
  const in1 = ok.filter(r => Math.abs(r.err) <= r.sigma).length, in2 = ok.filter(r => Math.abs(r.err) <= 2 * r.sigma).length;
  return {n, c1: n ? in1 / n : NaN, c2: n ? in2 / n : NaN, target: {c1: 0.683, c2: 0.954}};
}

// Gate G v3.3 (AGENTS.md, 2026-11-23): tools for small public-data hold-outs.
// Power check before a run: minimum detectable effect at n units (one-sided 16 %, 80 % power: z 1.0 + 0.84), from the SD of per-unit gains
// seen on tuning units or an earlier attempt. Also the smallest p an exact sign-flip test can reach (1 / 2^n): with one losing unit it needs
// about n ≥ 9 to get below 0.05.
export function mde(sdGain, n) { return n > 0 ? (1.0 + 0.84) * sdGain / Math.sqrt(n) : Infinity; }
export const minSignFlipP = n => 1 / 2 ** n;
// Cluster bootstrap: units (zones, laps) grouped by circuit; resample circuits, then units inside each. Returns the mean gain and its 90 %
// interval; a pass needs the lower bound above 0.
export function clusterBootstrap(rows, {group = r => r.circuit, value = r => r.gain, iters = 4000, seed = 1} = {}) {
  const by = new Map(); for (const r of rows) { const v = value(r); if (!Number.isFinite(v)) continue; const g = group(r); if (!by.has(g)) by.set(g, []); by.get(g).push(v); }
  const G = [...by.values()], all = G.flat(), mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  let s = seed >>> 0 || 1; const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), b = [];
  for (let k = 0; k < iters && G.length; k++) { const pick = []; for (let i = 0; i < G.length; i++) { const g = G[Math.floor(rand() * G.length)]; for (let j = 0; j < g.length; j++) pick.push(g[Math.floor(rand() * g.length)]); } b.push(mean(pick)); }
  b.sort((x, y) => x - y);
  const ci90 = b.length ? [b[Math.floor(0.05 * b.length)], b[Math.floor(0.95 * b.length) - 1]] : [NaN, NaN];
  return {n: all.length, clusters: G.length, gain: mean(all), ci90, pass: G.length >= 5 && ci90[0] > 0};
}
// Skill score against a baseline the hold-out cannot fit by luck (production, previous-season value, simple physics): 1 − error / baseline error.
export function skill(errModel, errBase) { const m = errModel.reduce((s, x) => s + Math.abs(x), 0), b = errBase.reduce((s, x) => s + Math.abs(x), 0); return b > 0 ? 1 - m / b : NaN; }
