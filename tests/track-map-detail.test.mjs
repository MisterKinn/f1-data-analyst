import test from 'node:test';
import assert from 'node:assert/strict';
import {lapsimTracks, lapsimExtraTracks} from '../worker/lapsim/tracks-data.js';

// owner 2026-11-16: a long lap drawn with 360 points lost its chicanes (Le Mans one point every 35 m, Nürburgring 24h every 65 m)
// owner 2026-11-16 (later): the shortest possible spacing = one map point per stored line point (5 m)
test('every track map has a point at every line point (about 5 m), so chicanes stay visible', () => {
  for (const [id, t] of Object.entries({...lapsimTracks, ...lapsimExtraTracks})) {
    const lap = t.kappa.length * t.ds;
    assert.ok(lap / t.map.x.length <= t.ds + 0.01 && t.map.x.length === t.kappa.length, `${id}: ${(lap / t.map.x.length).toFixed(1)} m per map point`);
  }
});

test('densify-maps keeps the old points and adds nothing on a map that is already dense', async () => {
  const {denseMap} = await import('../scripts/sim/densify-maps.mjs');
  const t = lapsimTracks.monza, n = t.kappa.length, old = {x: t.map.x.filter((_, i) => i % 3 === 0), y: t.map.y.filter((_, i) => i % 3 === 0)};
  const r = denseMap({...t, map: old});
  assert.equal(r.map.x.length, n);
  for (let j = 0; j < old.x.length; j++) assert.ok(Math.abs(r.map.x[j * 3] - old.x[j]) <= 1 && Math.abs(r.map.y[j * 3] - old.y[j]) <= 1);
});

// owner 2026-11-16: "Daytona T1 squashed, Barcelona T1 and T4 entry squashed" — the drawn line and track band have no zig-zags.
// A kink = within 30 m the line turns both ways by more than 0.25 rad in total while its net turn is small (|sum| ≪ sum |turn|).
const kinkCount = (P, W = 30, thr = 0.25) => { const n = P.length, h = [], L = [];
  for (let i = 0; i < n; i++) { const q = P[(i + 1) % n]; L.push(Math.hypot(q[0] - P[i][0], q[1] - P[i][1])); h.push(Math.atan2(q[1] - P[i][1], q[0] - P[i][0])); }
  const d = h.map((v, i) => { let x = h[(i + 1) % n] - v; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; });
  const w = Math.max(2, Math.round(W / ([...L].sort((a, b) => a - b)[n >> 1] || 1))), sc = d.map((_, i) => { let a = 0, b = 0; for (let k = 0; k < w; k++) { a += Math.abs(d[(i + k) % n]); b += d[(i + k) % n]; } return a - Math.abs(b); });
  return sc.filter((v, i) => v > thr && v >= sc[(i - 1 + n) % n] && v > sc[(i + 1) % n]).length; };
test('car lines drawn on the map are smooth (SPSA point noise removed): at most a few kinks per track, at real chicanes', async () => {
  const {lineData} = await import('../worker/simulation.js');
  let total = 0;
  for (const id of Object.keys(lapsimTracks)) { const L = lineData(id); for (const v of Object.values(L.cars)) for (const m of ['q', 'r']) if (v[m]) {
    const P = L.mid.map((p, i) => [p[0] + L.nrm[i][0] * v[m].off[i] / 10, p[1] + L.nrm[i][1] * v[m].off[i] / 10]); total += kinkCount(P); } }
  assert.ok(total < 150, `kinks on all car lines: ${total} (over 12 000 before the smoothing)`);
});
test('reviewed side steps in source lines (Daytona before T1 and others) are drawn as a smooth track', async () => {
  const {lineData, MAP_STEPS} = await import('../worker/simulation.js');
  const all = {...lapsimTracks, ...lapsimExtraTracks};
  for (const [id, steps] of Object.entries(MAP_STEPS)) { const L = lineData(id), n = L.mid.length, len = all[id].length;
    for (const s of steps) { const c = Math.round(s / len * n), seg = Array.from({length: 41}, (_, k) => L.mid[(c - 20 + k + n) % n]);
      const open = seg.slice(0, -1).map((p, i) => Math.atan2(seg[i + 1][1] - p[1], seg[i + 1][0] - p[0])), d = open.slice(1).map((v, i) => { let x = v - open[i]; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; });
      // both-way turning within any 30 m (6 points) of the ±100 m around the step: a straight or a plain bend scores 0
      const sc = Math.max(...d.slice(0, -6).map((_, i) => { const q = d.slice(i, i + 6); return q.reduce((a, x) => a + Math.abs(x), 0) - Math.abs(q.reduce((a, x) => a + x, 0)); }));
      assert.ok(sc < 0.25, `${id} at ${s} m: both-way turn ${sc.toFixed(3)} rad in 30 m`); } }
});
