// Wall margin fit (owner 2026-11-18: "the walls must change the predicted lap time").
// Drivers keep a margin where a wall is close: they use less of the grip than in an open corner with run-off.
// Model: grip used at point i = 1 − c · w_i, w_i = closeness of the nearest barrier, max(0, 1 − gap / G) (gap from the edge, m),
// averaged over ±R m. c and G are fitted on real pole laps: per corner minimum, ln(v_real / v_sim) against w, with one free offset
// per lap (the per-track grip of the calibration already sets the lap's mean) and the sim corner speed as a control (B1 bias).
// Input: pole speed traces from OpenF1 (dir of <track>-<season>.json: {rows: [[t s, kph, throttle, brake]]}).
// Usage: node scripts/sim/wall-margin-fit.mjs <poles dir>  -> prints the fit; writes nothing.
import {readdirSync, readFileSync} from 'node:fs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {lapsimCalibration as CAL} from '../../worker/lapsim/calibration-data.js';
import {lapsimF1Zones} from '../../worker/lapsim/f1-zones-data.js';
import {lapsimWalls} from '../../worker/lapsim/walls-data.js';
import {traceOnTrack, bestShift, realExtremes, withGrip} from './calibrate-lib.mjs';

const K = lapsimKernel(), DIR = process.argv[2];
export function closeness(id, n, G, R, ds) {
  const w = lapsimWalls.tracks[id]; if (!w) return null;
  const m = w.left.length, raw = new Float64Array(n);
  for (let i = 0; i < n; i++) { const j = Math.min(m - 1, Math.floor(i / n * m)), g = Math.min(w.left[j] ?? 40, w.right[j] ?? 40); raw[i] = Math.max(0, 1 - g / G); }
  const h = Math.round(R / ds), out = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = -h; k <= h; k++) s += raw[(i + k + n) % n]; out[i] = s / (2 * h + 1); }
  return out;
}
const rows = [];
for (const f of readdirSync(DIR).filter(f => f.endsWith('.json'))) {
  const p = JSON.parse(readFileSync(DIR + '/' + f, 'utf8')), id = p.track, y = String(p.season), d = lapsimTracks[id], ct = CAL.seasons[y]?.tracks?.[id];
  if (!d || !ct || !lapsimWalls.tracks[id] || p.rows.length < 100) continue;
  const z = lapsimF1Zones.tracks?.[id]?.[+y >= 2026 ? '2026' : '2025'];
  const tr = K.trackFromData(z?.zones?.length ? {...d, aeroZones: z.zones.map(q => [q.from, q.to])} : d, z?.zones?.length ? {aero: 'fia'} : {});
  const car0 = CAL.seasons[y].car, dr = ct.drag ?? 1, car = dr !== 1 ? {...car0, cdA: car0.cdA * dr, cdALow: car0.cdALow * dr} : car0;
  const res = K.simulateLap(withGrip(tr, ct.grip), car, K.conditionsFromWeather(ct.weather || {}));
  let dist = 0; const samples = p.rows.map((r, k) => { if (k) dist += (r[1] + p.rows[k - 1][1]) / 7.2 * (r[0] - p.rows[k - 1][0]); return [r[0], dist, r[1]]; });
  const trace = {samples, distance_m: dist}, L = tr.kappa.length * tr.ds, sh = bestShift(res.v, tr.ds, trace, L).shift, obs = traceOnTrack(trace, L, sh);
  const n = res.v.length, h = Math.round(50 / tr.ds);
  for (const e of realExtremes(obs).filter(e => e.min)) {
    const i0 = Math.round(e.s / tr.ds); let x = Infinity, ix = i0;
    for (let j = -h; j <= h; j++) { const q = ((i0 + j) % n + n) % n; if (res.v[q] < x) { x = res.v[q]; ix = q; } }
    rows.push({lap: id + y, id, i: ix, n, ds: tr.ds, y: Math.log(e.v / x), lv: Math.log(x)});
  }
}
// least squares with lap offsets: demean y, lv and w within each lap, then y = b·lv − c·w
const fit = (G, R) => {
  const cache = new Map(), W = r => { const k = r.id + G + R; if (!cache.has(k)) cache.set(k, closeness(r.id, r.n, G, R, r.ds)); return cache.get(k)[r.i]; };
  const by = {}; for (const r of rows) (by[r.lap] ??= []).push({...r, w: W(r)});
  const X = []; for (const g of Object.values(by)) { if (g.length < 3) continue; const m = k => g.reduce((s, r) => s + r[k], 0) / g.length, my = m('y'), ml = m('lv'), mw = m('w'); for (const r of g) X.push([r.y - my, r.lv - ml, r.w - mw]); }
  let a = 0, b = 0, c = 0, d = 0, e = 0; for (const [yy, l, w] of X) { a += l * l; b += l * w; c += w * w; d += l * yy; e += w * yy; }
  const det = a * c - b * b, bl = (d * c - e * b) / det, bw = (a * e - b * d) / det;
  let sse = 0; for (const [yy, l, w] of X) sse += (yy - bl * l - bw * w) ** 2;
  const s2 = sse / (X.length - 2), se = Math.sqrt(s2 * a / det);
  return {G, R, n: X.length, laps: Object.keys(by).length, bSpeed: +bl.toFixed(4), cWall: +(-bw).toFixed(4), se: +se.toFixed(4), rmsPct: +(100 * Math.sqrt(sse / X.length)).toFixed(2)};
};
const res = []; for (const G of [2, 3, 5, 8, 12]) for (const R of [25, 50]) res.push(fit(G, R));
console.log(JSON.stringify({corners: rows.length, fits: res}, null, 1));
