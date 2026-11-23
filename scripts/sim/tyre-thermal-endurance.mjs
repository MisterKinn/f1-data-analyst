// Step 7a option B: reduced tyre thermal window on endurance-class best laps (cool vs hot within a weekend).
// Pre-registration: Project doc claude/gate-tyre-thermal-endurance-prereg-2026-11-23.md. Experiment only.
//   node scripts/sim/tyre-thermal-endurance.mjs [--holdout] → scripts/sim/data/learn/tyre-thermal-endurance.json
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {signFlip, mde} from './gate.mjs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {lapsimCalibration as C} from '../../worker/lapsim/calibration-data.js';
import {rowsOf, slope} from './condition-report.mjs';
import {TYRE_THERMAL_DEFAULTS, lapLoads, steadyLap, solveEta, windowGrip} from '../../worker/lapsim/tyre-thermal.js';

const OPEN = process.argv.includes('--holdout'), K = lapsimKernel();
const r4 = x => Math.round(x * 1e4) / 1e4, mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const rmsOf = a => Math.sqrt(mean(a.map(x => x * x)));
const BETA = {GT3: 0.91, LMP2: 1.05, LMP3: 1.05}; // trap-density.mjs (PR #464), kernel conversion; LMP3 uses LMP2's
const CAR = {GT3: 'elms-lmgt3', LMP2: 'wec-lmdh', LMP3: 'wec-lmdh'};
const COVERED = {'CIRCUIT OF THE AMERICAS': 'austin', 'BARCELONA-CATALUNYA': 'catalunya', 'SPA FRANCORCHAMPS': 'spa-francorchamps', 'IMOLA': 'imola', 'SILVERSTONE': 'silverstone', 'YAS MARINA': 'yas-marina-circuit'};
const trackKey = ev => String(ev).toUpperCase().replace(/^OFFICIAL TEST - /, '').trim();
const groupOf = r => /LMP2/.test(r.cls) ? 'LMP2' : /LMP3/.test(r.cls) ? 'LMP3' : /LMGTE|GT4|GT2|Cup/.test(r.cls) ? null : /GT3|^GT$|Pro|Am|SRO3/.test(r.cls) ? 'GT3' : null;

// ---------- rows ----------
const D = JSON.parse(gunzipSync(readFileSync('scripts/sim/data/learn/alkamel-laps.json.gz')));
const LOCK = '202611230000';
const raw = D.rows.filter(r => r.weather && r.weather.rain !== true && r.weather.airTempC >= -20 && r.weather.airTempC <= 50 && r.weather.trackTempC > 0 && r.weather.trackTempC <= 70
  && r.clean?.lap > 0 && ['practice', 'qualifying', 'test'].includes(r.kind) && groupOf(r) && String(r.start || '') < LOCK)
  .map(r => ({g: groupOf(r), season: r.season, track: trackKey(r.event), ev: `${r.season}|${r.site}|${trackKey(r.event)}`, cw: `${r.season}|${r.site}|${trackKey(r.event)}|${r.car}`,
    kind: r.kind, lnLap: Math.log(r.clean.lap), tt: r.weather.trackTempC, ta: r.weather.airTempC}));
const rows = [];
for (const rs of Object.values(Object.groupBy(raw, r => r.cw))) {
  const m = median(rs.map(r => r.lnLap)), ok = rs.filter(r => Math.abs(r.lnLap - m) <= 0.03);
  if (ok.length < 2) continue;
  const mu = mean(ok.map(r => r.lnLap));
  for (const r of ok) rows.push({...r, y: 100 * (r.lnLap - mu)});
}

// ---------- kernel sensitivities (row-weighted over the covered tracks) ----------
const sens = {};
for (const g of ['GT3', 'LMP2', 'LMP3']) {
  let W = 0; const acc = {a015: 0, aMeas: 0, Sg: 0};
  for (const [name, id] of Object.entries(COVERED)) {
    const w = rows.filter(r => r.g === g && r.track === name).length; if (!w) continue;
    const c = carsFor(id)[CAR[g]], tr = K.trackFromData(lapsimTracks[id]); tr.mu.fill(c.grip);
    const lap = (ta, b, grip) => { const e = K.conditionsFromWeather({airTempC: ta, trackTempC: 35, pressureHpa: 1013.25, humidityPct: 50}, {ice: {beta: b}}); return K.simulateLap(tr, c.car, grip == null ? e : {...e, grip}).lapTime; };
    const a = b => 100 * (Math.log(lap(35, b)) - Math.log(lap(15, b))) / 20;      // % lap per °C air
    const L = lap(25, 0.15, 1), Sg = 100 * (Math.log(lap(25, 0.15, 1.01)) - Math.log(L)) / 0.01; // % lap per unit grip
    acc.a015 += w * a(0.15); acc.aMeas += w * a(BETA[g]); acc.Sg += w * Sg; W += w;
  }
  sens[g] = {a015: acc.a015 / W, aMeas: acc.aMeas / W, Sg: acc.Sg / W};
}
// steady surface temperature, linear in track and air temperature (catalunya loads, group car)
const tsCoef = {};
for (const g of ['GT3', 'LMP2', 'LMP3']) {
  const c = carsFor('catalunya')[CAR[g]], tr = K.trackFromData(lapsimTracks.catalunya); tr.mu.fill(c.grip);
  const env = K.conditionsFromWeather({}), L = lapLoads(tr, c.car, K.simulateLap(tr, c.car, env), env), P = TYRE_THERMAL_DEFAULTS, eta = solveEta(L, P);
  const T = (tt, ta) => steadyLap(L, {trackC: tt, airC: ta, eta}, P).meanTs, t0 = T(35, 25);
  tsCoef[g] = {c0: t0, ct: (T(45, 25) - t0) / 10, ca: (T(35, 35) - t0) / 10};
}
const tsOf = r => { const k = tsCoef[r.g]; return k.c0 + k.ct * (r.tt - 35) + k.ca * (r.ta - 25); };

// ---------- predictions (demeaned within car weekend) ----------
const demean = (R, f) => { const out = new Map(); for (const rs of Object.values(Object.groupBy(R, r => r.cw))) { const v = rs.map(f), m = mean(v); rs.forEach((r, i) => out.set(r, v[i] - m)); } return out; };
const PRED = {
  constant: () => 0,
  production: r => sens[r.g].a015 * r.ta + sens[r.g].Sg * K.gripFromTrackTemp(r.tt),
  engine: r => sens[r.g].aMeas * r.ta + sens[r.g].Sg * K.gripFromTrackTemp(r.tt),
  thermal: tc => r => sens[r.g].aMeas * r.ta + sens[r.g].Sg * windowGrip(tsOf(r), 'S', {...TYRE_THERMAL_DEFAULTS, window: {S: {tc: tc[r.g], w: 35}}}),
};
function errors(R, f, fitR) {
  const p = demean(R, f), pf = fitR === R ? p : demean(fitR, f), off = {};
  for (const [k, rs] of Object.entries(Object.groupBy(fitR, r => r.g + '|' + r.kind))) off[k] = mean(rs.map(r => r.y - pf.get(r)));
  return R.map(r => r.y - p.get(r) - (off[r.g + '|' + r.kind] ?? 0));
}
function fitTc(fitR) {
  const tc = {GT3: 100, LMP2: 100, LMP3: 100};
  for (const g of Object.keys(tc)) {
    const Rg = fitR.filter(r => r.g === g); if (!Rg.length) continue; let best = Infinity;
    for (let x = 60; x <= 140; x += 2) { const e = errors(Rg, PRED.thermal({...tc, [g]: x}), Rg), s = mean(e.map(v => v * v)); if (s < best) { best = s; tc[g] = x; } }
  }
  return tc;
}
const perTrack = (R, eb, em) => Object.values(Object.groupBy(R.map((r, i) => ({t: r.track, b: eb[i] ** 2, m: em[i] ** 2})), x => x.t)).map(xs => mean(xs.map(x => x.b)) - mean(xs.map(x => x.m)));

const tune = rows.filter(r => r.season <= 2024), hold = rows.filter(r => r.season >= 2025);
const TC = fitTc(tune);
const errsOf = (R, fitR, tc) => ({constant: errors(R, PRED.constant, fitR), production: errors(R, PRED.production, fitR), engine: errors(R, PRED.engine, fitR), thermal: errors(R, PRED.thermal(tc), fitR)});
const report = (R, E) => ({rows: R.length, tracks: new Set(R.map(r => r.track)).size, rms: Object.fromEntries(Object.entries(E).map(([k, v]) => [k, r4(rmsOf(v))])), medAbs: Object.fromEntries(Object.entries(E).map(([k, v]) => [k, r4(median(v.map(Math.abs)))]))});

// power check: leave one track out on tuning
const tTracks = [...new Set(tune.map(r => r.track))], loo = {production: [], engine: [], constant: []};
for (const t of tTracks) {
  const fitR = tune.filter(r => r.track !== t), test = tune.filter(r => r.track === t), tc = fitTc(fitR), E = errsOf(test, fitR, tc);
  for (const b of Object.keys(loo)) loo[b].push(mean(E[b].map(x => x * x)) - mean(E.thermal.map(x => x * x)));
}
const Etune = errsOf(tune, tune, TC), nHold = new Set(hold.map(r => r.track)).size, useful = 2 * rmsOf(Etune.production) * 0.02;
const power = {nHoldTracks: nHold, usefulGainPp2: r4(useful), loo: Object.fromEntries(Object.entries(loo).map(([k, g]) => [k, {meanGain: r4(mean(g)), sd: r4(sd(g)), mde: r4(mde(sd(g), nHold)), n: g.length}]))};
power.judgeable = ['production', 'engine'].every(b => power.loo[b].mde <= useful);

// Tc bootstrap over tuning events
const evs = [...new Set(tune.map(r => r.ev))], byEv = Object.groupBy(tune, r => r.ev), boots = []; let s = 11;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
for (let i = 0; i < 100; i++) { const pick = []; evs.forEach((_, j) => { for (const r of byEv[evs[Math.floor(rnd() * evs.length)]]) pick.push({...r, cw: r.cw + '#' + j}); }); boots.push(fitTc(pick)); }
const ident = Object.fromEntries(Object.keys(TC).map(g => { const v = boots.map(b => b[g]).sort((a, b) => a - b), lo = v[5], hi = v[94];
  return [g, {tc: TC[g], ci90: [lo, hi], identified: lo > 60 && hi < 140 && TC[g] > 60 && TC[g] < 140 && hi - lo < 0.8 * 80}]; }));

const out = {generatedAt: new Date().toISOString().slice(0, 10), prereg: 'claude/gate-tyre-thermal-endurance-prereg-2026-11-23.md',
  sens: Object.fromEntries(Object.entries(sens).map(([g, v]) => [g, {a015: r4(v.a015), aMeas: r4(v.aMeas), Sg: r4(v.Sg)}])),
  tsCoef: Object.fromEntries(Object.entries(tsCoef).map(([g, v]) => [g, {c0: r4(v.c0), ct: r4(v.ct), ca: r4(v.ca)}])),
  tc: ident, power, tuning: report(tune, Etune)};

if (OPEN) {
  if (!power.judgeable) out.holdout = 'not judgeable at this n: not opened';
  else {
    const E = errsOf(hold, tune, TC); out.holdout = report(hold, E);
    for (const b of ['production', 'engine', 'constant']) { const g = perTrack(hold, E[b], E.thermal), sf = signFlip(g, {m: 1});
      out.holdout['vs_' + b] = {meanGain: r4(sf.gain), ci90: sf.ci90.map(r4), p: r4(sf.p), accept: sf.accept, reason: sf.reason, rmsGain: r4(rmsOf(E[b]) - rmsOf(E.thermal))}; }
    out.holdout.pass = ['production', 'engine', 'constant'].every(b => out.holdout['vs_' + b].accept && out.holdout['vs_' + b].rmsGain >= 0.02);
  }
}

// 7b diagnostic: WEC held-out slope with measured β and the thermal window (no refit)
{
  const REFW = {airTempC: 25, trackTempC: 35}, R = [];
  for (const r of rowsOf(C)) {
    const cls = r.group.split(' ')[0]; if (cls === 'f1' || !r.w || !lapsimTracks[r.track]) continue;
    const c = carsFor(r.track)['wec-' + cls]; if (!c) continue;
    const tr = K.trackFromData(lapsimTracks[r.track]); tr.mu.fill(c.grip);
    const g = cls === 'lmgt3' ? 'GT3' : 'LMP2', b = BETA[g];
    const lap = (w, beta, grip) => { const e = K.conditionsFromWeather(w, {ice: {beta}}); return K.simulateLap(tr, c.car, grip == null ? e : {...e, grip}).lapTime; };
    const P = {...TYRE_THERMAL_DEFAULTS, window: {S: {tc: TC[g], w: 35}}}, gw = w => windowGrip(tsOf({g, tt: w.trackTempC ?? 35, ta: w.airTempC}), 'S', P);
    const wRef = {...r.w, ...REFW};
    const prod = lap(r.w, 0.15) / lap(wRef, 0.15), eng = lap(r.w, b) / lap(wRef, b), th = lap(r.w, b, gw(r.w) / gw(wRef) * 1) / lap(wRef, b, 1);
    R.push({air: r.w.airTempC, errEngine: r.errPct + 100 * (eng - prod), errThermal: r.errPct + 100 * (th - prod)});
  }
  const f = x => ({n: x.n, slope: r4(x.b), ci90: x.ci90.map(r4), includes0: x.ci90[0] <= 0 && x.ci90[1] >= 0});
  out.slope7b = {engineOnly: f(slope(R.map(r => r.air), R.map(r => r.errEngine))), engineAndThermal: f(slope(R.map(r => r.air), R.map(r => r.errThermal))),
    note: 'no refit; the thermal grip replaces the parabola, normalised at the reference conditions'};
}
writeFileSync('scripts/sim/data/learn/tyre-thermal-endurance.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
