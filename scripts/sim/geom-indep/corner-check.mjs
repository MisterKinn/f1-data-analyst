// Step 3 attempt 2 corner check with clean windows (claude/gate-independent-geometry-attempt2-prereg-2026-11-23.md).
// Corners = local minima of the MEASURED pole-lap speed (lapEvents of residual-signature.mjs: drop ≥ 5 m/s before the minimum),
// broken stretches and 150 m around them left out (cleanTel). Measured position = share of the lap × model line length, then one
// shift δ ∈ [−150, 150] m per lap that best correlates the measured speed with −|κ| (20 m mean) of the model line: the alignment
// does not use the model speed. Model minimum = minimum of the page's model speed within ±40 m of x + δ; the pair is rejected when
// that minimum sits on the window edge or the measured minimum is above √(6 g · 1.5 R), R = smallest model-line radius in the window.
// Ratio model / measured, by measured speed band. Measured data is only read. Run inside a working copy (its tracks and calibration).
// Usage: node scripts/sim/geom-indep/corner-check.mjs [--tracks a,b] [--json out]
import {writeFileSync} from 'node:fs';
import {lapsimF1RealTel} from '../../../worker/lapsim/f1-real-telemetry-data.js';
import {lapsimF1WetQuali} from '../../../worker/lapsim/f1-wet-quali-data.js';
import {lapsimTracks} from '../../../worker/lapsim/tracks-data.js';
import {cleanTel} from '../../../worker/lapsim/real-tel-gaps.js';
import {lapEvents, BANDS} from '../residual-signature.mjs';
import {isLockedF1} from '../locked-set.mjs';

const arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null;
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const band = x => { const e = BANDS.corner; for (let i = 0; i < e.length - 1; i++) if (x >= e[i] && x < e[i + 1]) return i; return -1; };
const {simulationPage, lapsimScript} = await import('../../../worker/simulation.js');
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const modelSpeed = (track, car) => {
  const d = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); if (d.carId !== car) return null; d.realTel = null;
  const v = V.computeView(V.K, d, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, V.R);
  const sp = v.tel.lanes.find(l => l.key === 'speed'); return {v: sp.ser[0].v, ds: sp.ds};
};
export function checkLap(td, model, r) {
  const n = td.kappa.length, ds = td.ds, L = n * ds, ak = Float64Array.from(td.kappa, (_, i) => { let t = 0; for (let k = -2; k <= 2; k++) t += Math.abs(td.kappa[((i + k) % n + n) % n]); return t / 5 / 1e5; });
  const c = cleanTel(r); if (c.share > 0.5) return null;
  const x = c.x.map(q => q / r.len * L), v = c.speed, at = (a, s) => a[(((Math.round(s / ds)) % n) + n) % n];
  let best = -Infinity, delta = 0; const mv = v.reduce((a, b) => a + b, 0) / v.length;
  for (let d = -150; d <= 150; d++) { let sxy = 0, sxx = 0, syy = 0; const ys = x.map(s => -at(ak, s + d)), my = ys.reduce((a, b) => a + b, 0) / ys.length;
    for (let i = 0; i < v.length; i++) { const a = v[i] - mv, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; } const cor = sxy / Math.sqrt(sxx * syy || 1); if (cor > best) { best = cor; delta = d; } }
  // amendment B3: a shift on the ±150 m search bound means the alignment failed (Suzuka 2026 pole file: δ −150 m, r 0.22): lap dropped
  if (Math.abs(delta) >= 150) return {delta, corr: +best.toFixed(3), corners: [], rejected: {edge: 0, radius: 0}, alignFailed: true};
  const ev = lapEvents(x, v.map(s => s / 3.6), (c.brake || v.map(() => 0)).map(Number), L).filter(e => !c.near(e.x / L * r.len));
  const out = [], rej = {edge: 0, radius: 0};
  const msc = model.ds, absK = Float64Array.from(td.kappa, k => Math.abs(k) / 1e5);
  for (const e of ev) { const s0 = e.x + delta, j0 = Math.round((s0 - 40) / msc), j1 = Math.round((s0 + 40) / msc), m = model.v.length; let mn = Infinity, jm = 0, rmin = Infinity;
    for (let j = j0; j <= j1; j++) { const q = model.v[((j % m) + m) % m]; if (q < mn) { mn = q; jm = j; } rmin = Math.min(rmin, 1 / Math.max(1e-6, at(absK, j * msc))); }
    if (jm === j0 || jm === j1) { rej.edge++; continue; }
    if (e.vmin / 3.6 > Math.sqrt(6 * 9.81 * 1.5 * rmin)) { rej.radius++; continue; }
    out.push({x: Math.round(e.x), vMeas: +e.vmin.toFixed(1), vModel: +mn.toFixed(1), rMin: Math.round(rmin), ratio: +(mn / e.vmin).toFixed(4)}); }
  return {delta, corr: +best.toFixed(3), corners: out, rejected: rej};
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const only = arg('--tracks')?.split(','), res = {};
  for (const tr of Object.keys(lapsimF1RealTel).filter(t => !only || only.includes(t))) {
    const per = [];
    for (const y of ['2025', '2026']) { const r = lapsimF1RealTel[tr][y]; if (!r || lapsimF1WetQuali[tr]?.[y] || isLockedF1(tr, y) || !lapsimTracks[tr]) continue;
      const m = modelSpeed(tr, y); if (!m) continue; const c = checkLap(lapsimTracks[tr], m, r); if (!c) continue; if (c.alignFailed) { console.log(tr, y, 'alignment failed (δ on the bound): lap dropped'); continue; }
      const bands = [0, 1, 2, 3].map(b => med(c.corners.filter(q => band(q.vMeas) === b).map(q => q.ratio)));
      per.push({year: y, ...c, bands}); }
    if (!per.length) continue;
    // one value per track and band: median over corners, then the mean of the seasons that have the band
    const bands = [0, 1, 2, 3].map(b => { const a = per.map(p => p.bands[b]).filter(Number.isFinite); return a.length ? a.reduce((s, q) => s + q, 0) / a.length : null; });
    res[tr] = {bands, seasons: per}; console.log(tr, bands.map(b => b == null ? '–' : b.toFixed(3)).join(' / '), '| rejected', per.map(p => `${p.year} edge ${p.rejected.edge} radius ${p.rejected.radius} of ${p.corners.length + p.rejected.edge + p.rejected.radius}, δ ${p.delta} m r ${p.corr}`).join('; '));
  }
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(res, null, 1));
}
