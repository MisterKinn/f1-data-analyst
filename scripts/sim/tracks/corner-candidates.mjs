// Corner candidates from our own track geometry (task A2, owner 2026-11-16: official corner numbers on every map).
//   node scripts/sim/tracks/corner-candidates.mjs [ids...]   -> JSON on stdout: per track, every bend with its lap distance (m),
//   direction (L/R), total turn (deg) and tightest radius (m).
// A bend = a run of the smoothed midline with radius under R_MAX_M; its position is the tightest point. Kinks (small turn) are kept
// and flagged, because some official numberings count them (e.g. Barcelona T13 kink); the numbering itself comes from the official
// map of the circuit or the series (docs/lapsim-track-shapes.md, "Corner numbers").
import {lineData} from '../../../worker/simulation.js';
import {lapsimAllTracks} from '../../../worker/lapsim/tracks.js';

const R_MAX_M = 450, SMOOTH_M = 12, MIN_TURN_DEG = 6;
export function candidates(id) {
  const L = lineData(id), t = lapsimAllTracks[id]; if (!L || !t) return null;
  const M = L.mid, n = M.length, len = t.length || 0, st = M.reduce((s, p, i) => s + Math.hypot(p[0] - M[(i + 1) % n][0], p[1] - M[(i + 1) % n][1]), 0) / n;
  const h = M.map((p, i) => Math.atan2(M[(i + 1) % n][1] - p[1], M[(i + 1) % n][0] - p[0]));
  const d = h.map((v, i) => { let x = h[(i + 1) % n] - v; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; });
  const sg = SMOOTH_M / st, r = Math.ceil(3 * sg), w = []; for (let k = -r; k <= r; k++) w.push(Math.exp(-k * k / (2 * sg * sg))); const W = w.reduce((s, x) => s + x, 0);
  const kap = d.map((_, i) => w.reduce((s, x, k) => s + x * d[(i + k - r + n * 4) % n], 0) / W / st); // 1/m, + = left
  const on = kap.map(k => Math.abs(k) > 1 / R_MAX_M), out = [];
  let i0 = on.findIndex(x => !x); if (i0 < 0) i0 = 0;
  for (let k = 0; k < n; k++) { const i = (i0 + k) % n; if (!on[i] || (k > 0 && on[(i - 1 + n) % n] && Math.sign(kap[i]) === Math.sign(kap[(i - 1 + n) % n]))) continue;
    // a run: same sign, radius under R_MAX_M
    let j = i, turn = 0, best = i; const sgn = Math.sign(kap[i]);
    while (on[j % n] && Math.sign(kap[j % n]) === sgn && j - i < n) { turn += kap[j % n] * st; if (Math.abs(kap[j % n]) > Math.abs(kap[best % n])) best = j % n; j++; }
    const deg = Math.abs(turn) * 180 / Math.PI;
    if (deg >= MIN_TURN_DEG) out.push({s: Math.round(best / n * len), dir: sgn > 0 ? 'L' : 'R', turnDeg: Math.round(deg), radiusM: Math.round(1 / Math.abs(kap[best])), kink: deg < 25}); }
  return {id, length: len, n, stepM: +st.toFixed(1), candidates: out.sort((a, b) => a.s - b.s)};
}
if (process.argv[1]?.endsWith('corner-candidates.mjs')) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(lapsimAllTracks);
  console.log(JSON.stringify(Object.fromEntries(ids.map(id => [id, candidates(id)]))));
}
