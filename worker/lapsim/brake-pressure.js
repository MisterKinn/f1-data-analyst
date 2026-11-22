// Brake pedal load from speed (model M-BP, claude/gate-brake-pressure-prereg-2026-11-22.md; gate BP-1 in
// scripts/sim/learn/f1-brake-pressure-gate.mjs). Brake on/off in the public data is measured only for its timing, so the amount comes
// from the speed trace: friction force = m|a| − drag − rolling − regen (fixed priors per season), pedal load = k × force / g0.
// Gate BP-1 failed twice (a constant per season matched Brembo's peak better: 7.5 % against 16 %; idea stopped after 3 attempts), so the
// page shows it only as "estimate (provisional)" with ± 16 % (AGENTS.md provisional values), attempt-2 settings: 1.0 s smoothing, k fitted
// on the tuning rounds to Brembo's zone figures. 2027 and 2028 use the 2026 car (the fitted 2026 car x rules x development).
const G0 = 9.81;
// M-BP on one lap: 10 Hz series of time, position (m), speed, a_x, friction force (N) and pedal load (kg). Self-contained: the page's
// browser script carries it as text.
export function mbpSeries(x, kph, year, w = {}, {win = 11} = {}) {
  const MBP = {2025: {m: 800, cda: 1.30, regenW: 120e3, k: 0.0728}, 2026: {m: 768, cda: 1.20, regenW: 350e3, k: 0.0712}}, G0 = 9.81;
  const P = MBP[year < 2026 ? 2025 : 2026], rho = w.pressureHpa && Number.isFinite(w.airTempC) ? w.pressureHpa * 100 / (287.05 * (w.airTempC + 273.15)) : 1.2;
  const t = [0]; for (let i = 1; i < x.length; i++) t.push(t[i - 1] + Math.max(0, x[i] - x[i - 1]) / Math.max(0.5, (kph[i] + kph[i - 1]) / 7.2));
  const T = [], X = [], V = []; let j = 0;
  for (let q = 0; q <= t.at(-1); q += 0.1) { while (j + 1 < t.length - 1 && t[j + 1] < q) j++; const u = t[j + 1] > t[j] ? (q - t[j]) / (t[j + 1] - t[j]) : 0;
    T.push(q); X.push(x[j] + u * (x[j + 1] - x[j])); V.push((kph[j] + u * (kph[j + 1] - kph[j])) / 3.6); }
  const n = V.length, A = new Array(n).fill(0), F = new Array(n).fill(0);
  const h = win >> 1, den = h * (h + 1) * (2 * h + 1) / 3 * 0.1; // Savitzky–Golay slope (order 2), win points at 10 Hz
  for (let i = h; i < n - h; i++) { let sm = 0; for (let q = 1; q <= h; q++) sm += q * (V[i + q] - V[i - q]); A[i] = sm / den; }
  for (let i = 0; i < n; i++) if (A[i] < 0) {
    const v = Math.max(V[i], 1), drag = 0.5 * rho * P.cda * v * v, roll = 0.015 * P.m * G0, rest = Math.max(0, P.m * -A[i] - drag - roll);
    F[i] = Math.max(0, rest - Math.min(P.regenW / v, rest));
  }
  // what the gate checked: one value per braking zone (a_x below −0.5 g for 0.3 s or more), the 80th percentile of the friction force
  const zoneKg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) if (A[i] < -0.5 * G0) { let j = i; while (j + 1 < n && A[j + 1] < -0.5 * G0) j++;
    if (T[j] - T[i] >= 0.3) { const fs = F.slice(i, j + 1).sort((a, b) => a - b), kg = +(P.k * fs[Math.floor(0.8 * (fs.length - 1))] / G0).toFixed(0); for (let q = i; q <= j; q++) zoneKg[q] = kg; }
    i = j; }
  return {T, X, V, A, F, zoneKg, rho, P, err: 0.16};
}
// braking zones: a_x below −0.5 g for at least 0.3 s
export function zones(s) {
  const out = []; for (let i = 0; i < s.A.length; i++) if (s.A[i] < -0.5 * G0) { let j = i; while (j + 1 < s.A.length && s.A[j + 1] < -0.5 * G0) j++;
    if (s.T[j] - s.T[i] >= 0.3) { let lo = i, pk = i; for (let q = i; q <= j; q++) { if (s.V[q] < s.V[lo]) lo = q; if (s.F[q] > s.F[pk]) pk = q; }
      const fs = s.F.slice(i, j + 1).sort((a, b) => a - b), p80F = fs[Math.floor(0.8 * (fs.length - 1))],
        as = s.A.slice(i, j + 1).map(a => -a).sort((a, b) => a - b), p80A = as[Math.floor(0.8 * (as.length - 1))];
      out.push({i, j, lo, pk, p80F, p80A, vFrom: s.V[i] * 3.6, vTo: s.V[lo] * 3.6, xMin: s.X[lo], x0: s.X[i], x1: s.X[j], peakF: s.F[pk], peakG: -Math.min(...s.A.slice(i, j + 1)) / G0}); }
    i = j; }
  return out;
}

