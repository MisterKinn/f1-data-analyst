// Engine power vs air density per class (step 13-prep; measurement, no model change).
// Pre-registration: Project doc claude/gate-ice-density-prereg-2026-11-23.md (part A).
// A1: Hypercar, WEC LMP2 (positive control) and WEC LMGT3 from wec-alkamel-cars.csv.gz trap speeds:
//     ln v = a_carweekend + b ln ρ, then b → β with the kernel's own trap response (amendment 2 of the trap-density run).
// A2: F1 per-track wheel power (car-measured-data.js) vs the pole session's ρ, season fixed effects.
// Also: the WEC held-out air-temperature slope with the per-class β (diagnostic preview of gate 13, no refit).
//   node scripts/sim/ice-density-classes.mjs → scripts/sim/data/learn/ice-density-classes.json
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {lapsimCalibration as C} from '../../worker/lapsim/calibration-data.js';
import {lapsimCarMeasured as M} from '../../worker/lapsim/car-measured-data.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {rowsOf, slope} from './condition-report.mjs';

const K = lapsimKernel(), r4 = x => Math.round(x * 1e4) / 1e4;
const median = a => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const rng = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const q90 = bs => { bs.sort((a, b) => a - b); return [bs[Math.floor(0.05 * bs.length)], bs[Math.floor(0.95 * bs.length) - 1]]; };

// ---------- A1: WEC trap speeds ----------
const csv = gunzipSync(readFileSync('scripts/sim/data/learn/wec-alkamel-cars.csv.gz')).toString().trim().split('\n');
const head = csv[0].split(','), num = x => (x === '' || x == null ? NaN : +x);
const LMH = /Toyota|Ferrari 499P|Peugeot|Glickenhaus|Valkyrie|Isotta|Vanwall/i, LMDH = /Porsche 963|Cadillac|BMW|Alpine A424|Lamborghini|Genesis/i;
const NA = /Cadillac|Valkyrie/i;
const TRACK = {'LOSAIL': 'lusail', 'IMOLA': 'imola', 'SPA FRANCORCHAMPS': 'spa-francorchamps', 'PROLOGUE SPA FRANCORCHAMPS': 'spa-francorchamps',
  'BAHRAIN INTERNATIONAL CIRCUIT': 'sakhir', 'BAHRAIN INTERNATIONAL CIRCUIT 8 HOURS': 'sakhir', 'SAO PAULO': 'interlagos', 'BARCELONA-CATALUNYA': 'catalunya',
  'AUTODROMO NAZIONALE DI MONZA': 'monza', 'CIRCUIT OF THE AMERICAS': 'austin'};
const groupOf = r => r.cls === 'HYPERCAR' ? 'HYPERCAR' : r.cls === 'LMP2' ? 'LMP2' : r.cls === 'LMGT3' ? 'LMGT3' : null;
const carOf = r => r.g === 'LMGT3' ? 'wec-lmgt3' : r.g === 'HYPERCAR' && LMH.test(r.vehicle) ? 'wec-lmh' : 'wec-lmdh';

const all = csv.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [head[i], v]))).map(r => ({...r, g: groupOf(r)}))
  .filter(r => r.g && num(r.rainShare) === 0 && num(r.trapKph) >= 150 && num(r.trapKph) <= 400 && num(r.airC) >= -20 && num(r.airC) <= 50 && num(r.hpa) >= 850 && num(r.hpa) <= 1050)
  .map(r => ({g: r.g, vehicle: r.vehicle, type: r.type, ev: `${r.season}|${r.event}`, cw: `${r.season}|${r.event}|${r.entry}`, track: TRACK[r.event] || null, car: carOf(r),
    lnv: Math.log(num(r.trapKph)), air: num(r.airC),
    lnrho: Math.log(K.airDensity({pressureHpa: num(r.hpa), tempC: num(r.airC), humidityPct: Number.isFinite(num(r.hum)) ? num(r.hum) : 50}))}));
const clean = R => { const out = []; for (const rs of Object.values(Object.groupBy(R, r => r.cw))) { const m = median(rs.map(r => r.lnv)), ok = rs.filter(r => Math.abs(r.lnv - m) <= 0.04); if (ok.length >= 2) out.push(...ok); } return out; };
const primary = clean(all.filter(r => r.type === 'P' || r.type === 'Q')), secondary = clean(all);

function fitB(R, kinds = false) { // within car weekend; optionally also the mean offset of each session type
  let res = [];
  for (const rs of Object.values(Object.groupBy(R, r => r.cw))) { const mx = rs.reduce((s, r) => s + r.lnrho, 0) / rs.length, my = rs.reduce((s, r) => s + r.lnv, 0) / rs.length; for (const r of rs) res.push({...r, x: r.lnrho - mx, y: r.lnv - my}); }
  if (kinds) { const off = {}; for (const [k, rs] of Object.entries(Object.groupBy(res, r => r.type))) off[k] = [rs.reduce((s, r) => s + r.x, 0) / rs.length, rs.reduce((s, r) => s + r.y, 0) / rs.length]; res = res.map(r => ({...r, x: r.x - off[r.type][0], y: r.y - off[r.type][1]})); }
  let sxy = 0, sxx = 0; for (const r of res) { sxy += r.x * r.y; sxx += r.x * r.x; } return sxx > 0 ? sxy / sxx : NaN;
}
function bootB(R, kinds) {
  const evs = [...new Set(R.map(r => r.ev))], byEv = Object.groupBy(R, r => r.ev), rnd = rng(7), bs = [];
  for (let i = 0; i < 2000; i++) { const pick = []; evs.forEach((_, j) => { for (const r of byEv[evs[Math.floor(rnd() * evs.length)]]) pick.push({...r, cw: r.cw + '#' + j}); }); const b = fitB(pick, kinds); if (Number.isFinite(b)) bs.push(b); }
  return q90(bs);
}
// kernel trap response k(β) = d ln vMax / d ln ρ (15 vs 35 °C, 1013 hPa), per (track, car)
const kCache = {};
function kOf(track, carId) {
  const key = track + '|' + carId; if (key in kCache) return kCache[key];
  const c = carsFor(track)[carId]; if (!c) return (kCache[key] = null);
  const tr = K.trackFromData(lapsimTracks[track]); tr.mu.fill(c.grip);
  const env = (T, b) => K.conditionsFromWeather({airTempC: T, trackTempC: T + 10, pressureHpa: 1013.25, humidityPct: 50}, {ice: {beta: b}});
  const vmax = (T, b) => K.simulateLap(tr, c.car, env(T, b)).vMaxKph, lr = Math.log(env(15, 0).rho) - Math.log(env(35, 0).rho);
  if (vmax(15, 0) >= (c.car.vMax ?? 110) * 3.6 - 0.5) return (kCache[key] = 'cap');
  const k = b => (Math.log(vmax(15, b)) - Math.log(vmax(35, b))) / lr;
  return (kCache[key] = {k0: k(0), k1: k(1), k2: k(2)});
}
function measure(R, kinds = false) {
  const b = fitB(R, kinds), ci = bootB(R, kinds), per = {}, dropped = [];
  for (const [key, rs] of Object.entries(Object.groupBy(R.filter(r => r.track), r => r.track + '|' + r.car))) {
    const [t, c] = key.split('|'), k = kOf(t, c); if (!k || k === 'cap') { dropped.push(`${key} (${k ? 'at vMax cap' : 'no car'})`); continue; } per[key] = {n: rs.length, k0: r4(k.k0), k1: r4(k.k1), k2: r4(k.k2)};
  }
  const N = Object.values(per).reduce((s, x) => s + x.n, 0), avg = f => Object.values(per).reduce((s, x) => s + x.n * x[f], 0) / N;
  const k0 = avg('k0'), k1 = avg('k1'), toB = x => r4((x - k0) / (k1 - k0));
  return {rows: R.length, carWeekends: new Set(R.map(r => r.cw)).size, events: new Set(R.map(r => r.ev)).size, sdAirC: r4(Math.sqrt(R.reduce((s, r) => s + r.air ** 2, 0) / R.length - (R.reduce((s, r) => s + r.air, 0) / R.length) ** 2)),
    b: r4(b), bCi90: ci.map(r4), kernel: {perTrackCar: per, dropped, k0: r4(k0), k1: r4(k1), linearityGap: r4(avg('k2') - (2 * k1 - k0))}, beta: toB(b), betaCi90: ci.map(toB)};
}
const out = {generatedAt: new Date().toISOString().slice(0, 10), prereg: 'claude/gate-ice-density-prereg-2026-11-23.md', wec: {}, wecSecondary: {}, wecReport: {}};
for (const g of ['LMP2', 'HYPERCAR', 'LMGT3']) {
  out.wec[g] = measure(primary.filter(r => r.g === g));
  out.wecSecondary[g] = {allTypesWithTypeEffects: measure(secondary.filter(r => r.g === g), true), coveredTracksOnly: measure(primary.filter(r => r.g === g && r.track))};
}
const H = primary.filter(r => r.g === 'HYPERCAR');
for (const [name, f] of [['LMH', r => LMH.test(r.vehicle)], ['LMDh', r => LMDH.test(r.vehicle)], ['naturallyAspirated', r => NA.test(r.vehicle)], ['turbo', r => (LMH.test(r.vehicle) || LMDH.test(r.vehicle)) && !NA.test(r.vehicle)]]) {
  const R = H.filter(f); if (R.length >= 30) out.wecReport[name] = measure(R);
}
const p2 = out.wec.LMP2;
out.methodCheck = {lmp2BetaCi90: p2.betaCi90, includes1: p2.betaCi90[0] <= 1 && p2.betaCi90[1] >= 1, excludes015: p2.betaCi90[0] > 0.15 || p2.betaCi90[1] < 0.15};
out.methodCheck.trusted = out.methodCheck.includes1 && out.methodCheck.excludes015;
const hy = out.wec.HYPERCAR;
out.hypercar = out.methodCheck.trusted && hy.betaCi90[1] - hy.betaCi90[0] <= 0.8
  ? {value: hy.beta, ci90: hy.betaCi90, source: 'measured (WEC Al Kamel trap, P/Q rows, kernel conversion)'}
  : {value: 0.25, ci90: [0, 1], source: 'prior (not identified): torque-sensor power cap, mostly turbo fleet'};

// ---------- A2: F1 per-track wheel power ----------
const f1 = [];
for (const [y, s] of Object.entries(M.seasons)) for (const [t, p] of Object.entries(s.perTrack || {})) {
  const w = C.seasons?.[y]?.tracks?.[t]?.weather; if (!Number.isFinite(p.pOwnKW) || !w || w.rain) continue;
  f1.push({y, t, lnp: Math.log(p.pOwnKW), lnrho: Math.log(K.conditionsFromWeather(w).rho), pWheel: s.pWheel.value});
}
const fitW = R => { let sxy = 0, sxx = 0; for (const rs of Object.values(Object.groupBy(R, r => r.y))) { const mx = rs.reduce((a, r) => a + r.lnrho, 0) / rs.length, my = rs.reduce((a, r) => a + r.lnp, 0) / rs.length; for (const r of rs) { sxy += (r.lnrho - mx) * (r.lnp - my); sxx += (r.lnrho - mx) ** 2; } } return sxx > 0 ? sxy / sxx : NaN; };
function f1Measure(R) {
  const ids = [...new Set(R.map(r => r.t))], by = Object.groupBy(R, r => r.t), rnd = rng(7), bs = [];
  for (let i = 0; i < 2000; i++) { const pick = []; ids.forEach(() => pick.push(...by[ids[Math.floor(rnd() * ids.length)]])); const b = fitW(pick); if (Number.isFinite(b)) bs.push(b); }
  const bw = fitW(R), ci = q90(bs), pw = R.reduce((a, r) => a + r.pWheel, 0) / R.length / 1e3;
  const sMid = pw / (pw - 109 / 2), sLo = 1, sHi = pw / (pw - 109); // ERS share at the wheels 0…109 kW
  const beta = bw * sMid, sys = Math.abs(bw) * (sHi - sLo) / 2, stat = ci.map(x => x * sMid);
  return {rows: R.length, tracks: ids.length, lnRhoRange: [r4(Math.min(...R.map(r => r.lnrho))), r4(Math.max(...R.map(r => r.lnrho)))], betaWheel: r4(bw), betaWheelCi90: ci.map(r4),
    wheelToIce: {pWheelKW: r4(pw), scaleMid: r4(sMid), scaleRange: [sLo, r4(sHi)]}, beta: r4(beta), ci90: [r4(Math.min(...stat) - sys), r4(Math.max(...stat) + sys)], sys: r4(sys)};
}
out.f1 = {all: f1Measure(f1), withoutMexico: f1Measure(f1.filter(r => r.t !== 'mexico-city'))};
const fw = out.f1.all.ci90[1] - out.f1.all.ci90[0];
out.f1.identified = fw <= 0.6;
out.f1.verdict = out.f1.identified ? 'measured' : 'not identified (F1 stays 0.15)';

// ---------- per-class table (prereg part A3) ----------
const TD = JSON.parse(readFileSync('scripts/sim/data/learn/trap-density.json')).kernelConversion;
out.table = {
  LMP2: {value: TD.LMP2.beta, ci90: TD.LMP2.betaCi, source: 'measured (ELMS/Asian LMS trap, trap-density.json)', wecCheck: {value: p2.beta, ci90: p2.betaCi90}},
  GT3: {value: TD.GT3.beta, ci90: TD.GT3.betaCi, source: 'measured (Al Kamel GT3 trap, trap-density.json)', wecLmgt3Check: {value: out.wec.LMGT3.beta, ci90: out.wec.LMGT3.betaCi90}},
  HYPERCAR: out.hypercar,
  F1: out.f1.identified ? {value: out.f1.all.beta, ci90: out.f1.all.ci90, source: 'measured (TI per-track wheel power vs ρ, 2023–25)', y2026: 0.15} : {value: 0.15, ci90: null, source: 'not identified; kernel value kept', measuredTry: {value: out.f1.all.beta, ci90: out.f1.all.ci90}},
};

// ---------- gate-13 preview: WEC held-out air-temperature slope with the per-class β (no refit) ----------
const REFW = {airTempC: 25, trackTempC: 35};
function wecSlope(betaOf) {
  const R = [];
  for (const r of rowsOf(C)) {
    const cls = r.group.split(' ')[0]; if (cls === 'f1' || !r.w || !lapsimTracks[r.track]) continue;
    const c = carsFor(r.track)['wec-' + cls]; if (!c) continue;
    const tr = K.trackFromData(lapsimTracks[r.track]); tr.mu.fill(c.grip);
    const lap = (w, b) => K.simulateLap(tr, c.car, K.conditionsFromWeather(w, {ice: {beta: b}})).lapTime;
    const b = betaOf(cls), d = 100 * (lap(r.w, b) / lap({...r.w, ...REFW}, b) - lap(r.w, 0.15) / lap({...r.w, ...REFW}, 0.15));
    R.push({cls, air: r.w.airTempC, err: r.errPct + d});
  }
  const f = rs => { const s = slope(rs.map(r => r.air), rs.map(r => r.err)); return {n: s.n, slope: r4(s.b), ci90: s.ci90.map(r4)}; };
  return {wec: f(R), lmgt3: f(R.filter(r => r.cls === 'lmgt3')), hypercar: f(R.filter(r => r.cls !== 'lmgt3'))};
}
out.wecSlopePreview = {production: wecSlope(() => 0.15), perClass: wecSlope(c => c === 'lmgt3' ? out.table.GT3.value : out.table.HYPERCAR.value),
  hypercarPriorEdges: {beta0: wecSlope(c => c === 'lmgt3' ? out.table.GT3.value : 0), beta1: wecSlope(c => c === 'lmgt3' ? out.table.GT3.value : 1)}};

writeFileSync('scripts/sim/data/learn/ice-density-classes.json', JSON.stringify(out, null, 1));
// car data (prereg A3 mapping): read by worker/lapsim/ice-density.js only with LAPSIM_ICE_BETA=measured
const T = out.table, cls = {gt3: T.GT3, hypercar: T.HYPERCAR, ...(out.f1.identified ? {f1: T.F1} : {})};
writeFileSync('worker/lapsim/ice-density-data.js', `// Generated by scripts/sim/ice-density-classes.mjs. Do not edit by hand.
export const lapsimIceDensity = ${JSON.stringify({note: 'ICE power ∝ (ρ/ρref)^β per class (step 13-prep, claude/gate-ice-density-prereg-2026-11-23.md). Used only with LAPSIM_ICE_BETA=measured, and only once the kernel reads car.iceDensityExp (gate 13, kernel slot 2). Unset classes keep the kernel β 0.15.',
  classes: Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, {beta: v.value, ci90: v.ci90, source: v.source}])), f1Seasons: [2023, 2024, 2025]})};
`);
console.log(JSON.stringify({table: out.table, methodCheck: out.methodCheck, wec: Object.fromEntries(Object.entries(out.wec).map(([g, x]) => [g, {rows: x.rows, events: x.events, b: x.b, bCi90: x.bCi90, beta: x.beta, betaCi90: x.betaCi90, dropped: x.kernel.dropped, lin: x.kernel.linearityGap}])),
  report: Object.fromEntries(Object.entries(out.wecReport).map(([g, x]) => [g, {rows: x.rows, beta: x.beta, ci: x.betaCi90}])),
  secondary: Object.fromEntries(Object.entries(out.wecSecondary).map(([g, x]) => [g, {allTypes: [x.allTypesWithTypeEffects.beta, x.allTypesWithTypeEffects.betaCi90], covered: [x.coveredTracksOnly.beta, x.coveredTracksOnly.betaCi90]}])),
  f1: out.f1, slope: out.wecSlopePreview}, null, 1));
