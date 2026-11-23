// Engine power vs air density from trap speed (measurement + diagnostic, no model change).
// Pre-registration: Project doc claude/gate-trap-density-prereg-2026-11-23.md.
// In: scripts/sim/data/learn/alkamel-laps.json.gz (Al Kamel, one row per car and session: trap speed of the fastest
// clean lap, session air temperature). Within one car weekend: ln v = a + b ln ρ, ρ ∝ 1/(T + 273.15).
// Terminal speed: P ∝ ρ^β and P = ½ρCdA v³ → β = 1 + 3b (finite straight: β ≥ 3b).
// Amendment 1: air temperature outside −20…50 °C is a broken sensor value (e.g. −257.9 °C, COTA 2025 P1) and is dropped.
// Then the WEC held-out air-temperature slope with the kernel at the measured β (no refit).
//   node scripts/sim/trap-density.mjs → scripts/sim/data/learn/trap-density.json
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {lapsimCalibration as C} from '../../worker/lapsim/calibration-data.js';
import {rowsOf, slope} from './condition-report.mjs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {carsFor} from '../../worker/lapsim/scenario.js';

const r4 = x => Math.round(x * 1e4) / 1e4, median = a => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
// Amendment 2: Al Kamel events with a simulator track
const TRACK = {'CIRCUIT OF THE AMERICAS': 'austin', 'BARCELONA-CATALUNYA': 'catalunya', 'SPA FRANCORCHAMPS': 'spa-francorchamps', 'IMOLA': 'imola', 'SILVERSTONE': 'silverstone', 'YAS MARINA': 'yas-marina-circuit'};
const D = JSON.parse(gunzipSync(readFileSync('scripts/sim/data/learn/alkamel-laps.json.gz')));
const groupOf = r => /LMP2/.test(r.cls) ? 'LMP2' : /LMP3/.test(r.cls) ? 'LMP3' : /LMGTE/.test(r.cls) ? 'LMGTE'
  : /GT3|^GT$|Pro|Am|SRO3/.test(r.cls) && !/GT4|GT2|Cup/.test(r.cls) ? 'GT3' : null;

const raw = D.rows.filter(r => r.weather && r.weather.rain !== true && Number.isFinite(r.weather.airTempC) && r.weather.airTempC >= -20 && r.weather.airTempC <= 50 && r.clean?.topSpeedKph > 50 && groupOf(r))
  .map(r => ({g: groupOf(r), ev: `${r.season}|${r.site}|${r.event}`, cw: `${r.season}|${r.site}|${r.event}|${r.car}`, kind: r.kind, model: r.model,
    track: TRACK[String(r.event).toUpperCase().replace(/^OFFICIAL TEST - /, '')] || null, lnv: Math.log(r.clean.topSpeedKph), lnrho: -Math.log(r.weather.airTempC + 273.15), air: r.weather.airTempC}));
// outliers (tow, slow laps) and single-row car weekends
const byCW = Object.groupBy(raw, r => r.cw), rows = [];
for (const rs of Object.values(byCW)) { const m = median(rs.map(r => r.lnv)), ok = rs.filter(r => Math.abs(r.lnv - m) <= 0.04); if (ok.length >= 2) rows.push(...ok); }

// within-car-weekend slope (demeaned), optionally also demeaned by session kind within the group
function fitB(R, kinds = false) {
  const cw = Object.groupBy(R, r => r.cw); let sxy = 0, sxx = 0;
  const res = [];
  for (const rs of Object.values(cw)) { const mx = rs.reduce((s, r) => s + r.lnrho, 0) / rs.length, my = rs.reduce((s, r) => s + r.lnv, 0) / rs.length; for (const r of rs) res.push({...r, x: r.lnrho - mx, y: r.lnv - my}); }
  let use = res;
  if (kinds) { // remove the mean within-weekend offset of each session kind (fuel, tow, run plan)
    const k = Object.groupBy(res, r => r.kind), off = {};
    for (const [kk, rs] of Object.entries(k)) off[kk] = {x: rs.reduce((s, r) => s + r.x, 0) / rs.length, y: rs.reduce((s, r) => s + r.y, 0) / rs.length};
    use = res.map(r => ({...r, x: r.x - off[r.kind].x, y: r.y - off[r.kind].y}));
  }
  for (const r of use) { sxy += r.x * r.y; sxx += r.x * r.x; }
  return sxx > 0 ? sxy / sxx : NaN;
}
function boot(R, kinds, iters = 2000, seed = 7) {
  const evs = [...new Set(R.map(r => r.ev))], byEv = Object.groupBy(R, r => r.ev); let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), bs = [];
  for (let i = 0; i < iters; i++) { const pick = []; evs.forEach((_, j) => { const e = evs[Math.floor(rnd() * evs.length)]; for (const r of byEv[e]) pick.push({...r, cw: r.cw + '#' + j}); }); const b = fitB(pick, kinds); if (Number.isFinite(b)) bs.push(b); }
  bs.sort((a, b) => a - b); return [bs[Math.floor(0.05 * bs.length)], bs[Math.floor(0.95 * bs.length) - 1]];
}
const summary = (R, kinds) => {
  const b = fitB(R, kinds), ci = boot(R, kinds), sdAir = Math.sqrt(R.reduce((s, r) => s + r.air ** 2, 0) / R.length - (R.reduce((s, r) => s + r.air, 0) / R.length) ** 2);
  return {rows: R.length, carWeekends: new Set(R.map(r => r.cw)).size, events: new Set(R.map(r => r.ev)).size, b: r4(b), ci90: ci.map(r4),
    betaUpper: r4(1 + 3 * b), betaUpperCi: ci.map(x => r4(1 + 3 * x)), betaLower: r4(3 * b), betaLowerCi: ci.map(x => r4(3 * x)), sdAirC: r4(sdAir)};
};

const out = {generatedAt: new Date().toISOString().slice(0, 10), prereg: 'claude/gate-trap-density-prereg-2026-11-23.md', groups: {}, gt3Models: {}};
for (const g of ['LMP2', 'LMP3', 'GT3', 'LMGTE']) {
  const R = rows.filter(r => r.g === g); if (R.length < 30) continue;
  out.groups[g] = {plain: summary(R, false), withSessionKind: summary(R, true)};
}
for (const [m, R] of Object.entries(Object.groupBy(rows.filter(r => r.g === 'GT3'), r => r.model || '?'))) if (R.length >= 30 && new Set(R.map(r => r.cw)).size >= 5) out.gt3Models[m] = summary(R, false);
const p2 = out.groups.LMP2?.plain;
out.methodCheck = p2 ? {lmp2BetaUpperCi: p2.betaUpperCi, includes1: p2.betaUpperCi[0] <= 1 && p2.betaUpperCi[1] >= 1, excludes015: p2.betaUpperCi[0] > 0.15 || p2.betaUpperCi[1] < 0.15} : null;
out.methodCheck.trusted = !!(out.methodCheck?.includes1 && out.methodCheck?.excludes015);

// WEC held-out slope with the measured β (no refit)
const K = lapsimKernel(), REFW = {airTempC: 25, trackTempC: 35};
function wecSlope(betaOf) {
  const R = [];
  for (const r of rowsOf(C)) {
    const cls = r.group.split(' ')[0]; if (cls === 'f1' || !r.w || !lapsimTracks[r.track]) continue;
    const c = carsFor(r.track)['wec-' + cls]; if (!c) continue;
    const tr = K.trackFromData(lapsimTracks[r.track]); tr.mu.fill(c.grip);
    const lap = b => { const e = K.conditionsFromWeather(r.w, {ice: {beta: b}}); return K.simulateLap(tr, c.car, e).lapTime; };
    // the held-out error was made at β 0.15: change of the lap with the new β, relative to the reference air (where both agree)
    const lapRef = b => { const e = K.conditionsFromWeather({...r.w, ...REFW}, {ice: {beta: b}}); return K.simulateLap(tr, c.car, e).lapTime; };
    const b = betaOf(cls), d = 100 * ((lap(b) / lapRef(b)) - (lap(0.15) / lapRef(0.15)));
    R.push({cls, air: r.w.airTempC, err: r.errPct + d});
  }
  const f = s => ({n: s.n, slope: r4(s.b), ci90: s.ci90.map(r4), includes0: s.ci90[0] <= 0 && s.ci90[1] >= 0});
  return {wec: f(slope(R.map(r => r.air), R.map(r => r.err))), lmgt3: f(slope(R.filter(r => r.cls === 'lmgt3').map(r => r.air), R.filter(r => r.cls === 'lmgt3').map(r => r.err))),
    hypercar: f(slope(R.filter(r => r.cls !== 'lmgt3').map(r => r.air), R.filter(r => r.cls !== 'lmgt3').map(r => r.err)))};
}
const bG = out.groups.GT3?.plain.betaUpper, bP = out.groups.LMP2?.plain.betaUpper;
out.wecSlope = {production: wecSlope(() => 0.15)};
if (Number.isFinite(bG)) out.wecSlope.gt3BetaAll = wecSlope(() => bG);
if (Number.isFinite(bG) && Number.isFinite(bP)) out.wecSlope.gt3ForGt3_lmp2ForHypercar = wecSlope(c => c === 'lmgt3' ? bG : bP);
out.wecSlope.betaUsed = {gt3: bG, lmp2: bP};

// ---------- Amendment 2: kernel conversion of b to β ----------
const CAR = {GT3: 'elms-lmgt3', LMP2: 'wec-lmdh'};
function kernelK(group) {
  const per = {}, dropped = [];
  for (const id of [...new Set(Object.values(TRACK))]) {
    const n = rows.filter(r => r.g === group && r.track === id).length; if (!n) continue;
    const c = carsFor(id)[CAR[group]]; if (!c) { dropped.push(id + ' (no car)'); continue; }
    const tr = K.trackFromData(lapsimTracks[id]); tr.mu.fill(c.grip);
    const vmax = (T, b) => K.simulateLap(tr, c.car, K.conditionsFromWeather({airTempC: T, trackTempC: T + 10, pressureHpa: 1013.25, humidityPct: 50}, {ice: {beta: b}})).vMaxKph;
    const lr = Math.log(1 / (15 + 273.15)) - Math.log(1 / (35 + 273.15)), k = b => (Math.log(vmax(15, b)) - Math.log(vmax(35, b))) / lr;
    if (vmax(15, 0) >= (c.car.vMax ?? 110) * 3.6 - 0.5) { dropped.push(id + ' (at vMax cap)'); continue; }
    per[id] = {n, k0: r4(k(0)), k1: r4(k(1)), k2: r4(k(2))};
  }
  const N = Object.values(per).reduce((s, x) => s + x.n, 0), avg = f => Object.values(per).reduce((s, x) => s + x.n * x[f], 0) / N;
  return {perTrack: per, dropped, k0: r4(avg('k0')), k1: r4(avg('k1')), k2: r4(avg('k2')), linearityGap: r4(avg('k2') - (2 * avg('k1') - avg('k0')))};
}
const toBeta = (b, kk) => (b - kk.k0) / (kk.k1 - kk.k0);
out.kernelConversion = {};
for (const g of ['GT3', 'LMP2']) {
  const kk = kernelK(g), all = out.groups[g].plain, Rc = rows.filter(r => r.g === g && r.track);
  const cov = Rc.length >= 30 ? summary(Rc, false) : null;
  out.kernelConversion[g] = {kernel: kk, beta: r4(toBeta(all.b, kk)), betaCi: all.ci90.map(b => r4(toBeta(b, kk))),
    coveredTracksOnly: cov && {rows: cov.rows, events: cov.events, b: cov.b, ci90: cov.ci90, beta: r4(toBeta(cov.b, kk)), betaCi: cov.ci90.map(b => r4(toBeta(b, kk)))}};
}
const c2 = out.kernelConversion.LMP2;
out.methodCheck2 = {lmp2BetaCi: c2.betaCi, includes1: c2.betaCi[0] <= 1 && c2.betaCi[1] >= 1, excludes015: c2.betaCi[0] > 0.15 || c2.betaCi[1] < 0.15};
out.methodCheck2.trusted = out.methodCheck2.includes1 && out.methodCheck2.excludes015;
const bG2 = out.kernelConversion.GT3.beta, bP2 = c2.beta;
out.wecSlope.kernelBeta = {betaUsed: {gt3: bG2, lmp2: bP2}, gt3ForGt3_lmp2ForHypercar: wecSlope(c => c === 'lmgt3' ? bG2 : bP2), gt3All: wecSlope(() => bG2),
  gt3LowerCi: wecSlope(() => out.kernelConversion.GT3.betaCi[0])};

writeFileSync('scripts/sim/data/learn/trap-density.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
