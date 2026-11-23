// I4 phase 1 test (Project claude/gate-i4-covariates-prereg-2026-11-23.md, attempt 1): can four track covariates predict a hidden
// track's F1 grip factor better than level C (season mean grip of the other tracks)? Test A leave one track out, test B forward chaining.
// Model: ln grip = b0 + Σ b_k z_k + u, u ~ N(0, τ²), b_k ~ N(0, 0.03²), b0 flat, τ by marginal likelihood. No production change.
// Re-run after I3 changes the factors (same pre-registration):  node scripts/sim/i4-test.mjs
import {writeFileSync} from 'node:fs';
import {lapsimCalibration as CAL} from '../../worker/lapsim/calibration-data.js';
import {predict, gmean, stats} from './holdout-track.mjs';
import {signFlip} from './gate.mjs';
import {isLockedF1} from './locked-set.mjs';
import {buildTable} from './i4-covariates.mjs';

export const KEYS = ['surfaceAge', 'street', 'softness', 'evolution60'], S_PRIOR = 0.03, MIN_TRAIN = 8;
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
// solve A x = b (A symmetric positive definite, small): Cholesky
function chol(A) { const n = A.length, L = A.map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j]; } return L; }
const cholSolve = (L, b) => { const n = L.length, y = Array(n), x = Array(n);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; } return x; };

// one row per track: covariates averaged over its known seasons (rows = table rows of that track)
export const trackRows = rows => { const by = {}; for (const r of rows) (by[r.track] ||= []).push(r);
  return Object.entries(by).map(([track, rs]) => ({track, y: Math.log(rs[0].grip), drag: rs[0].drag,
    x: Object.fromEntries(KEYS.map(k => { const v = rs.map(r => r[k]).filter(v => v != null); return [k, v.length ? mean(v) : null]; }))})); };

// fit on training track rows; returns predictor for a covariate object, plus τ and β with 90 % intervals
export function fit(train) {
  const n = train.length, ybar = mean(train.map(t => t.y)), r = train.map(t => t.y - ybar);
  const mu = {}, sd = {};
  for (const k of KEYS) { const v = train.map(t => t.x[k]).filter(v => v != null); mu[k] = mean(v);
    sd[k] = Math.sqrt(mean(v.map(x => (x - mu[k]) ** 2))) || 1; }
  const z = x => KEYS.map(k => x[k] == null ? 0 : (x[k] - mu[k]) / sd[k]); // unknown → training mean
  const Z = train.map(t => z(t.x)), s2 = S_PRIOR ** 2;
  const ZZ = Z.map(a => Z.map(b => a.reduce((s, v, i) => s + v * b[i], 0)));
  let best = null;
  for (let tau = 0.005; tau <= 0.2501; tau += 0.0025) {
    const C = ZZ.map((row, i) => row.map((v, j) => s2 * v + (i === j ? tau * tau : 0))), L = chol(C);
    const a = cholSolve(L, r), logdet = 2 * L.reduce((s, row, i) => s + Math.log(row[i]), 0);
    const ll = -0.5 * (logdet + r.reduce((s, v, i) => s + v * a[i], 0));
    if (!best || ll > best.ll) best = {ll, tau, L, a};
  }
  const beta = KEYS.map((_, k) => s2 * Z.reduce((s, row, i) => s + row[k] * best.a[i], 0));
  const sdB = KEYS.map((_, k) => { const col = Z.map(row => row[k]), w = cholSolve(best.L, col);
    return Math.sqrt(Math.max(0, s2 - s2 * s2 * col.reduce((s, v, i) => s + v * w[i], 0))); });
  return {n, tau: best.tau, ybar, mu, sd, beta: Object.fromEntries(KEYS.map((k, i) => [k, {per1sd: beta[i], lo90: beta[i] - 1.645 * sdB[i], hi90: beta[i] + 1.645 * sdB[i]}])),
    predict: x => Math.exp(ybar + z(x).reduce((s, v, i) => s + v * beta[i], 0))};
}

function judge(rows) { // rows: {track, eBase, eModel, eOne?}; one gain per track (seasons averaged)
  const by = {}; for (const r of rows) (by[r.track] ||= []).push(r);
  const gains = Object.values(by).map(rs => mean(rs.map(r => r.eBase ** 2 - r.eModel ** 2)));
  const sf = signFlip(gains, {m: 1}), base = stats(rows.map(r => r.eBase)), model = stats(rows.map(r => r.eModel));
  const rmsGain = +(base.rmsPct - model.rmsPct).toFixed(3), ci = sf.ci90.map(v => +v.toFixed(3));
  const pass = sf.accept && rmsGain >= 0.02;
  return {nTracks: gains.length, nRows: rows.length, base, model, ...(rows[0]?.eOne != null ? {gripOne: stats(rows.map(r => r.eOne))} : {}),
    meanGainPct2: +mean(gains).toFixed(3), ci90: ci, p: sf.p, rmsGainPp: rmsGain, pass};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const table = buildTable(), rows = table.filter(r => !isLockedF1(r.track, r.season));
  writeFileSync(new URL('./data/i4-covariates.json', import.meta.url), JSON.stringify({generated: new Date().toISOString().slice(0, 10),
    prereg: 'Project claude/gate-i4-covariates-prereg-2026-11-23.md', rows: table}, null, 1));
  const tracks = trackRows(rows), lap = (r, grip, drag) => { const car = CAL.seasons[r.season].car;
    return predict(r.track, String(r.season), {grip, car: {...car, cdA: car.cdA * drag, cdALow: (car.cdALow ?? car.cdA) * drag}}); };
  // Test A: leave one track out (baseline = level C: season mean of the other tracks of that season)
  const A = [];
  for (const r of rows) {
    const T = CAL.seasons[r.season].tracks, o = Object.keys(T).filter(x => x !== r.track && T[x].grip != null);
    const gB = gmean(o.map(x => T[x].grip)), dr = gmean(o.map(x => T[x].drag ?? 1));
    const m = fit(tracks.filter(t => t.track !== r.track)), gM = m.predict(Object.fromEntries(KEYS.map(k => [k, r[k]])));
    const pB = lap(r, gB, dr), pM = lap(r, gM, dr), p1 = lap(r, 1, dr); if (!pB || !pM) continue;
    A.push({track: r.track, season: r.season, grip: r.grip, gripBase: +gB.toFixed(4), gripModel: +gM.toFixed(4), eBase: pB.errPct, eModel: pM.errPct, eOne: p1?.errPct});
    console.log('A', r.track, r.season, pB.errPct.toFixed(2), pM.errPct.toFixed(2));
  }
  // Test B: forward chaining over 2025–26 events in date order
  const B = [], ev = rows.filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date));
  for (const r of ev) {
    const earlier = ev.filter(e => e.date < r.date && e.track !== r.track), tr = trackRows(earlier);
    if (!tr.length) continue;
    const gB = Math.exp(mean(tr.map(t => t.y))), dr = gmean(tr.map(t => t.drag));
    const gM = tr.length >= MIN_TRAIN ? fit(tr).predict(Object.fromEntries(KEYS.map(k => [k, r[k]]))) : gB;
    const pB = lap(r, gB, dr), pM = gM === gB ? pB : lap(r, gM, dr); if (!pB || !pM) continue;
    B.push({track: r.track, season: r.season, date: r.date, nTrain: tr.length, grip: r.grip, gripBase: +gB.toFixed(4), gripModel: +gM.toFixed(4), eBase: pB.errPct, eModel: pM.errPct});
    console.log('B', r.date, r.track, tr.length, pB.errPct.toFixed(2), pM.errPct.toFixed(2));
  }
  const full = fit(tracks), resid = tracks.map(t => t.y - Math.log(full.predict(t.x)));
  const out = {prereg: 'Project claude/gate-i4-covariates-prereg-2026-11-23.md (attempt 1)', run: new Date().toISOString(),
    calibration: CAL.generatedAt ?? null, testA: judge(A), testB: judge(B),
    fullFit: {nTracks: full.n, tau: full.tau, sdLnGrip: +Math.sqrt(mean(tracks.map(t => (t.y - full.ybar) ** 2))).toFixed(4),
      residSd: +Math.sqrt(mean(resid.map(v => v * v))).toFixed(4), beta: full.beta},
    rowsA: A, rowsB: B};
  out.verdict = out.testA.pass && out.testB.pass ? 'covariates explain part of the grip factor (both tests pass)' : 'these covariates do not explain the grip factor beyond noise';
  writeFileSync(new URL('./data/learn/i4-test.json', import.meta.url), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({testA: out.testA, testB: out.testB, fullFit: out.fullFit, verdict: out.verdict}, null, 1));
}
