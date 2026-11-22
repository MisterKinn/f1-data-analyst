// Broken stretches in the measured pole telemetry (owner 2026-11-22: "telemetry that is broken is filled by prediction").
// The TracingInsights files sometimes repeat the last sample instead of new data: speed and rpm exactly identical for 4+ samples
// (a real car's rpm changes every sample, even on a speed plateau: Baku 2025 main straight, 18 rpm values in 19 samples), or the
// invalid throttle value 104 % with the brake flag stuck on (Suzuka 2026 from 4.1 km to the line, Monza 2026 Curva Grande).
// Returns ranges in the file's own position units (f, share of the lap × 1e4): from the first repeated sample to the next good one.
// The measured values are never changed; the page shows the model inside these ranges and learning scripts skip them.
export function telGaps(r, minRun = 4) {
  if (!r || !r.f || !r.speed) return [];
  const n = r.f.length, bad = new Uint8Array(n);
  for (let i = 0; i < n;) {
    let j = i; while (j + 1 < n && r.speed[j + 1] === r.speed[i] && r.rpm?.[j + 1] === r.rpm?.[i]) j++;
    if (j - i + 1 >= minRun) for (let k = i + 1; k <= j; k++) bad[k] = 1;
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
  return {x: keep.map(i => x[i]), speed: pick('speed'), throttle: pick('throttle'), brake: pick('brake'), gear: pick('gear'), rpm: pick('rpm'), gaps,
    near: s => gaps.some(([a, b]) => s >= a - margin && s < b + margin)};
}
