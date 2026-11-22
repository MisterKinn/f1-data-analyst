// Broken stretches in the measured pole telemetry (owner 2026-11-22: "telemetry that is broken is filled by prediction"; rule A+ in
// claude/gate-ti-gaps-siteC-prereg-2026-11-22.md). A stretch is broken when
//  1. the TracingInsights file holds one sample: speed, rpm, gear, throttle and brake all unchanged for 1.5 s or more at 5 km/h or more
//     (Session D detector D; Suzuka 2026 from 4.1 km to the line, Monza 2026 Curva Grande), or a sample carries the invalid throttle
//     value above 100 % (104 % with the brake flag stuck on);
//  2. or a short hold (speed and rpm unchanged for 4+ samples) ends in a step no car can make: more than 1.5 × P/(m·v) of acceleration
//     (P 800 kW, m 798 kg; 2026 Suzuka 272 → 280 km/h in 8 m = 2.2 g against 0.67 g possible, Wolfram) or, brake off, more than
//     1.5 × (drag + rolling) of deceleration (2026 Melbourne 309 → 293 km/h in 13 m = −2.9 g against 0.70 g). A hold that ends without
//     such a step can be a real plateau and stays measured.
// Time comes from the samples' positions and speeds (the site file has no time column). Returns ranges in the file's position units
// (f, share of the lap × 1e4), from the first repeated sample to the next good one. Measured values are never changed; the page shows
// the model inside these ranges and learning scripts skip them.
const CH = ['speed', 'rpm', 'gear', 'throttle', 'brake'], G = 9.81, P = 800e3, M = 798, RHO = 1.2, CDA = 1.5, CR = 0.012;
export function telGaps(r, {minS = 1.5, minKph = 5, minRun = 4, k = 1.5} = {}) {
  if (!r || !r.f || !r.speed) return [];
  const n = r.f.length, L = r.len || 1e4, x = r.f.map(f => f / 1e4 * L), t = [0], bad = new Uint8Array(n);
  for (let i = 1; i < n; i++) t.push(t[i - 1] + Math.max(0, x[i] - x[i - 1]) / Math.max(1, (r.speed[i] + r.speed[i - 1]) / 7.2));
  const all5 = (a, b) => CH.every(c => !r[c] || r[c][a] === r[c][b]);
  for (let i = 0; i < n;) { // 1. long full freeze
    let j = i; while (j + 1 < n && all5(j + 1, i)) j++;
    if (j > i && t[j] - t[i] >= minS && r.speed[i] >= minKph) for (let q = i + 1; q <= j; q++) bad[q] = 1;
    i = j + 1;
  }
  for (let i = 0; i < n;) { // 2. short hold that ends in an impossible step
    let j = i; while (j + 1 < n && r.speed[j + 1] === r.speed[i] && r.rpm?.[j + 1] === r.rpm?.[i]) j++;
    if (j - i + 1 >= minRun && j + 1 < n) {
      const v1 = r.speed[j] / 3.6, v2 = r.speed[j + 1] / 3.6, dx = x[j + 1] - x[j], v = Math.max(v1, v2, 1);
      const a = dx > 0 ? (v2 * v2 - v1 * v1) / (2 * dx) : 0, up = k * P / (M * v), down = k * (0.5 * RHO * CDA * v * v / M + CR * G);
      if (a > up || (!(r.brake?.[j + 1] > 0) && -a > down)) for (let q = i + 1; q <= j; q++) bad[q] = 1;
    }
    i = j + 1;
  }
  for (let i = 0; i < n; i++) if (r.throttle?.[i] > 100) bad[i] = 1;
  const out = [];
  for (let i = 0; i < n; i++) if (bad[i]) { let j = i; while (j + 1 < n && bad[j + 1]) j++; out.push([r.f[i], j + 1 < n ? r.f[j + 1] : 1e4]); i = j; }
  return out;
}
export const inGaps = (gaps, f) => { for (const g of gaps) if (f >= g[0] && f < g[1]) return true; return false; };
// For learning and diagnostics: the samples outside the broken stretches (positions in metres) and a test that tells whether a
// position lies within `margin` metres of a broken stretch (an event detected there may be an artefact of the missing part).
export function cleanTel(r, margin = 150) {
  const L = r.len, gaps = telGaps(r).map(([a, b]) => [a / 1e4 * L, b / 1e4 * L]), x = r.f.map(f => f / 1e4 * L), keep = [];
  for (let i = 0; i < x.length; i++) if (!gaps.some(([a, b]) => x[i] >= a && x[i] < b)) keep.push(i);
  const pick = k => r[k] ? keep.map(i => r[k][i]) : null;
  // share: broken part of the lap by distance (AGENTS.md: a lap more than half broken is dropped and counted)
  return {x: keep.map(i => x[i]), speed: pick('speed'), throttle: pick('throttle'), brake: pick('brake'), gear: pick('gear'), rpm: pick('rpm'), gaps,
    share: gaps.reduce((s, [a, b]) => s + b - a, 0) / L,
    near: s => gaps.some(([a, b]) => s >= a - margin && s < b + margin)};
}
