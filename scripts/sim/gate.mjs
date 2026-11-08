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
