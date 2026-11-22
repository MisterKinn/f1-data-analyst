// Gate G (v2): F1 throttle squeeze τ and pick-up lead calibrated on the measured real pole laps (owner 2026-11-22). Pre-registered in the
// Project (claude/gate-f1-throttle-prereg-2026-11-22.md). Usage: node scripts/sim/learn/f1-throttle-gate.mjs [--json out.json]
import {writeFileSync} from 'node:fs';
import {simulationPage, lapsimScript} from '../../../worker/simulation.js';
import {lapsimF1RealTel} from '../../../worker/lapsim/f1-real-telemetry-data.js';
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null, K = 1.45;
const BASE = {2025: {off: -0.598, up: 0.771, down: 0.675}, 2026: {off: -0.625, up: 0.778, down: 0.727}}; // as shipped (#399, #401)
const TAU = [0.10, 0.20, 0.35, 0.50, 0.70], LEAD = [0, -0.1, -0.2, -0.3];
const binOf = kph => kph < 90 ? 0 : kph < 160 ? 1 : 2, med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
function corners(x, vs, th, br) { // as scripts/sim/learn/f1-driver-gate.mjs
  const n = vs.length, t = [0]; for (let i = 1; i < n; i++) t.push(t[i - 1] + Math.max(0, x[i] - x[i - 1]) / Math.max(1, (vs[i] + vs[i - 1]) / 2));
  const idx = (i0, dtS) => { let j = i0; if (dtS > 0) while (j < n - 1 && t[j] - t[i0] < dtS) j++; else while (j > 0 && t[i0] - t[j] < -dtS) j--; return j; };
  const out = [];
  for (let i = 1; i < n - 1; i++) {
    const a = idx(i, -2), b = idx(i, 2); let mn = Infinity; for (let j = a; j <= b; j++) mn = Math.min(mn, vs[j]); if (vs[i] !== mn || vs[i - 1] === vs[i]) continue;
    const p0 = idx(i, -8); let vin = 0; for (let j = p0; j < i; j++) vin = Math.max(vin, vs[j]); if (vin - vs[i] < 5) continue;
    const c = {bin: binOf(vs[i] * 3.6), rise: NaN, pick: NaN, off: NaN};
    let pk = 0; for (let j = p0; j <= i; j++) pk = Math.max(pk, br[j]);
    if (pk > 0) { let j = i; while (j > p0 && !(br[j] > 0.05 * pk)) j--; if (br[j] > 0.05 * pk) c.off = t[j] - t[i]; }
    const w0 = idx(i, -3), w1 = idx(i, 1); let tm = Infinity; for (let j = w0; j <= w1; j++) tm = Math.min(tm, th[j]);
    if (tm <= 0.9) { let km = w0; for (let j = w0; j <= w1; j++) if (th[j] <= tm + 0.02) km = j; const end = idx(km, 6);
      const first = lv => { for (let j = km; j <= end; j++) if (th[j] >= lv) return j; return -1; }, k10 = first(tm + 0.1 * (1 - tm)), k90 = first(tm + 0.9 * (1 - tm));
      if (k10 >= 0) c.pick = t[k10] - t[i]; if (k10 >= 0 && k90 >= 0 && t[k90] - t[k10] < 4) c.rise = t[k90] - t[k10]; }
    out.push(c);
  }
  return out;
}
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const pageCorners = (track, car, drv) => {
  const d = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); if (d.carId !== car) return null; d.realTel = null;
  const R = {...V.R, lapChannels: (a, b, c, e, o) => V.R.lapChannels(a, b, c, e, {...o, drv})};
  const v = V.computeView(V.K, d, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, R);
  const L = k => v.tel.lanes.find(l => l.key === k), sp = L('speed'), n = sp.ser[0].v.length;
  return corners(Array.from({length: n}, (_, i) => i * sp.ds), sp.ser[0].v.map(x => x / 3.6), L('throttle').ser[0].v.filter((_, k) => k % 2 === 0).map(x => x / 100), L('brake').ser[0].v.filter((_, k) => k % 2 === 0));
};
const err = (O, P, q) => { const all = med(P.map(c => c[q])); return med(O.filter(o => Number.isFinite(o[q])).map(o => { const b = med(P.filter(c => c.bin === o.bin).map(c => c[q])); return Math.abs(o[q] - (Number.isFinite(b) ? b : all)); })); };
const stat = a => { const mu = a.reduce((s, x) => s + x, 0) / a.length, se = Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / (a.length - 1) / a.length); return {tracks: a.length, gain: +mu.toFixed(4), se: +se.toFixed(4), pass: a.length >= 5 && mu - K * se > 0}; };
const SHIPT = {2025: {tau: 0.35, pick: -0.3}, 2026: {pick: -0.3}}; // passed in the pre-registered run (2026-11-22)
if (process.env.CONFIRM) { // combined confirmatory run: shipped table vs base, all three quantities must not get worse
  const out = {};
  for (const year of ['2025', '2026']) { const g = {rise: [], pick: [], off: []};
    for (const tr of Object.keys(lapsimF1RealTel).filter(x => lapsimF1RealTel[x][year])) { const r = lapsimF1RealTel[tr][year], O = corners(r.f.map(f => f / 1e4 * r.len), r.speed.map(s => s / 3.6), r.throttle.map(x => x / 100), r.brake);
      const b = pageCorners(tr, year, BASE[year]); if (!b) continue; const c = pageCorners(tr, year, {...BASE[year], ...SHIPT[year]});
      for (const q of ['rise', 'pick', 'off']) { const d = err(O, b, q) - err(O, c, q); if (Number.isFinite(d)) g[q].push(d); } }
    out[year] = Object.fromEntries(Object.entries(g).map(([q, a]) => [q, stat(a)])); console.log(year, JSON.stringify(out[year])); }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 1)); process.exit(0);
}
const result = {};
for (const year of ['2025', '2026']) {
  const tracks = Object.keys(lapsimF1RealTel).filter(tr => lapsimF1RealTel[tr][year]);
  const M = Object.fromEntries(tracks.map(tr => { const r = lapsimF1RealTel[tr][year]; return [tr, corners(r.f.map(f => f / 1e4 * r.len), r.speed.map(s => s / 3.6), r.throttle.map(x => x / 100), r.brake)]; }));
  const E = {base: {}, tau: {}, lead: {}};
  for (const tr of tracks) {
    const b = pageCorners(tr, year, BASE[year]); if (!b) continue;
    E.base[tr] = {rise: err(M[tr], b, 'rise'), pick: err(M[tr], b, 'pick'), off: err(M[tr], b, 'off')};
    E.tau[tr] = TAU.map(x => err(M[tr], pageCorners(tr, year, {...BASE[year], tau: x}), 'rise'));
    E.lead[tr] = LEAD.map(x => err(M[tr], pageCorners(tr, year, {...BASE[year], pick: x}), 'pick'));
    console.log(year, tr, JSON.stringify(E.base[tr]), E.tau[tr].map(x => x.toFixed(3)).join(' '), '|', E.lead[tr].map(x => x.toFixed(3)).join(' '));
  }
  const T = Object.keys(E.base), pickBest = (key, grid) => { const gains = [], chosen = [];
    for (const tr of T) { const others = T.filter(x => x !== tr), mean = j => others.reduce((s, x) => s + (E[key][x][j] ?? 0), 0) / others.length;
      let bj = 0; for (let j = 1; j < grid.length; j++) if (mean(j) < mean(bj)) bj = j; chosen.push(grid[bj]);
      const q = key === 'tau' ? 'rise' : 'pick'; if (Number.isFinite(E.base[tr][q]) && Number.isFinite(E[key][tr][bj])) gains.push(E.base[tr][q] - E[key][tr][bj]); }
    const all = j => T.reduce((s, x) => s + (E[key][x][j] ?? 0), 0) / T.length; let bj = 0; for (let j = 1; j < grid.length; j++) if (all(j) < all(bj)) bj = j;
    return {...stat(gains), chosenOnAll: grid[bj], chosenPerFold: [...new Set(chosen)]}; };
  result[year] = {tau: pickBest('tau', TAU), lead: pickBest('lead', LEAD)}; console.log(year, JSON.stringify(result[year]));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 1));
