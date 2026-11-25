// Step 35 G (pre-reg docs/prereg/step35-fe-G-sector-proj-2026-11-26.md): FE sector lines by projection (measured-derived, method change).
// The printed "I1 @ … m / I2 @ … m" (official FIA/FE circuit map, distance from the finish line along the centre line) is placed on the
// track's centre line (t.map, scaled to the printed length) and projected to the nearest point of the driven line (the least-curvature
// line rebuilt from the same map points and half width, as build-geometry-extra.mjs). Search window: ±10 % of the lap around the old
// fraction, so a projection never jumps to a neighbouring leg. Writes NEW fields f1Proj / f2Proj (fraction of the driven line);
// the old f1 / f2 stay unchanged. No centre line (Monaco: F1 driven line) → f1Proj / f2Proj null (readers fall back to f1 / f2).
//   node scripts/sim/learn/fe-sector-lines-proj.mjs [--check]
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimFeTracks} from '../../../worker/lapsim/fe-tracks-data.js';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
import {minCurvatureLine} from '../../../worker/lapsim/racing-line.js';

const cum = (x, y) => { const c = [0]; for (let i = 1; i < x.length; i++) c.push(c[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]));
  return {c, tot: c.at(-1) + Math.hypot(x[0] - x.at(-1), y[0] - y.at(-1))}; };

export function projectSectorLines(t, sl) {
  if (!t?.map?.x || t.series !== 'fe') return null;
  const cx = t.map.x, cy = t.map.y, n = cx.length, rl = minCurvatureLine(cx, cy, new Array(n).fill(t.quality.halfWidthM));
  const L = cum(rl.x, rl.y), C = cum(cx, cy);
  if (Math.abs(L.tot / t.length - 1) > 0.03) throw new Error(`${t.id}: rebuilt line ${L.tot.toFixed(0)} m vs track ${t.length} m`); // fractions only; lengths differ by the resampling (≤ 3 %)
  const one = (d, f0) => { const s = d / sl.lengthM * C.tot, j = Math.max(0, C.c.findIndex(a => a >= s)), w = Math.ceil(0.1 * n);
    let b = 0, bd = Infinity; for (let k = -w; k <= w; k++) { const i = ((Math.round(f0 * n) + k) % n + n) % n, q = Math.hypot(rl.x[i] - cx[j], rl.y[i] - cy[j]); if (q < bd) { bd = q; b = i; } }
    return {f: L.c[b] / L.tot, offM: bd}; };
  const p1 = one(sl.i1M, sl.f1), p2 = one(sl.i2M, sl.f2);
  return {f1Proj: +p1.f.toFixed(4), f2Proj: +p2.f.toFixed(4), projShiftM: [Math.round((p1.f - sl.f1) * t.length), Math.round((p2.f - sl.f2) * t.length)],
    projOffM: [Math.round(p1.offM), Math.round(p2.offM)], lineRatio: +(L.tot / t.length).toFixed(4)};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const F = 'scripts/sim/data/learn/fe-sector-lines.json', J = JSON.parse(readFileSync(F, 'utf8')), A = {...lapsimTracks, ...lapsimExtraTracks, ...lapsimFeTracks};
  J.projMethod = 'printed I1/I2 on the map centre line (scaled to the printed length), nearest driven-line point within ±10 % of the lap (step 35 G); f1/f2 = old same-fraction method, kept';
  for (const [id, sl] of Object.entries(J.tracks)) { if (!sl) continue; const p = projectSectorLines(A[id], sl);
    Object.assign(sl, p || {f1Proj: null, f2Proj: null, projShiftM: null, projOffM: null});
    console.log(id.padEnd(16), p ? `I1 ${sl.f1} → ${p.f1Proj} (${p.projShiftM[0]} m)  I2 ${sl.f2} → ${p.f2Proj} (${p.projShiftM[1]} m)  off ${p.projOffM}` : 'no centre line: f1/f2 kept'); }
  if (!process.argv.includes('--check')) writeFileSync(F, JSON.stringify(J, null, 1));
}
