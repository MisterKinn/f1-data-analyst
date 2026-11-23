// Step 10a (ERS evidence, phase a): what the F1 ERS does on a qualifying lap, measured from open telemetry, next to the kernel's
// ERS model. Evidence only: no lap, kernel or calibration value changes. Pre-registration: Project doc
// claude/gate-ers-law-prereg-2026-11-23.md; ledger docs/gate-ledger.md "2026-11-23 | step 10a".
//   1. 2023–25 wheel power P(v) at full throttle: (a) kernel cut-off deploy, (b) flat, (c) taper; free step at the kernel cut-off.
//   2. 2026 clipping onset per straight (W17 detector output, scripts/sim/energy-clip/detect.py, unchanged) vs kernel and FIA docs.
//   3. Regen from brake force vs the kernel's share of the whole kinetic-energy drop, 8 tracks (kernel lap and measured laps).
// node scripts/sim/ers-evidence.mjs <TracingInsights dir with 2023..2026 sparse checkouts + fastest-lap *_tel.json> <detect.py out dir>
// Out: scripts/sim/data/learn/ers-evidence.json.gz (gzip, like the other learn files). Source: TracingInsights (FastF1 / Formula 1 timing), read-only.
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {tiTrack} from './ti-races.mjs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimAllTracks} from '../../worker/lapsim/tracks.js';
import {lapsimCalibration} from '../../worker/lapsim/calibration-data.js';
import {carsFor, realConditions} from '../../worker/lapsim/scenario.js';
import {withZones, puRampOf, PU_RAMP} from '../../worker/lapsim/zones.js';
import {rechargeLimitMJ} from '../../worker/lapsim/energy-limits.js';
import {lapsimPuDocs} from '../../worker/lapsim/pu-docs-data.js';
import {lapsimEnergyClip} from '../../worker/lapsim/energy-clip-data.js';

const G = 9.81, K = lapsimKernel();
// pre-registered constants (section 1)
export const PRE = {mass: 806, meFactor: 1.06, cRoll: 0.012, vLo: 180, vHi: 345, vRef: 270, win: 5, thr: 99,
  dPkernel: 120e3 * 0.95 * 0.96, minSlopeKW100: 20, boot: 2000, seed: 20261123,
  regenTracks: ['melbourne', 'shanghai', 'suzuka', 'miami', 'monte-carlo', 'silverstone', 'monza', 'singapore'], clipX: 100};
// I2 wet list (status-2026-11-23-I2.md): dropped whole
const WET = new Set(['2023 silverstone', '2023 montreal', '2023 zandvoort', '2023 catalunya', '2024 spa-francorchamps', '2024 hungaroring', '2024 interlagos', '2025 las-vegas', '2026 interlagos']);

// ---------- small numerics ----------
export function lstsq(X, y) { // least squares by normal equations on RMS-scaled columns (p ≤ 6), Gaussian elimination with pivoting
  const p = X[0].length, sc = Array.from({length: p}, (_, j) => Math.sqrt(X.reduce((s, r) => s + r[j] * r[j], 0) / X.length) || 1);
  const A = Array.from({length: p}, () => new Float64Array(p + 1));
  for (let r = 0; r < X.length; r++) for (let i = 0; i < p; i++) { const xi = X[r][i] / sc[i]; A[i][p] += xi * y[r]; for (let j = 0; j < p; j++) A[i][j] += xi * X[r][j] / sc[j]; }
  for (let c = 0; c < p; c++) { let m = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]];
    if (Math.abs(A[c][c]) < 1e-10 * X.length) return null; for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= p; j++) A[r][j] -= f * A[c][j]; } }
  return Array.from({length: p}, (_, i) => A[i][p] / A[i][i] / sc[i]);
}
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * q, l = Math.floor(h); return s[l] + (s[Math.min(l + 1, s.length - 1)] - s[l]) * (h - l); };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export function bootCI(vals, B = PRE.boot, seed = PRE.seed) { const r = rng(seed), n = vals.length, ms = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += vals[Math.floor(r() * n)]; ms.push(s / n); } return [quant(ms, 0.05), quant(ms, 0.95)]; }
export function jackSE(vals) { const n = vals.length, t = vals.reduce((a, b) => a + b, 0), loo = vals.map(x => (t - x) / (n - 1)), m = mean(loo);
  return Math.sqrt((n - 1) / n * loo.reduce((s, x) => s + (x - m) ** 2, 0)); }
// one-sided sign-flip test on per-unit gains (exact for n ≤ 16, else 20 000 random flips), as gate.mjs signFlip
export function signFlipP(g) { const n = g.length, obs = mean(g); let hit = 0, tot = 0;
  if (n <= 16) { for (let m = 0; m < 1 << n; m++) { let s = 0; for (let i = 0; i < n; i++) s += m >> i & 1 ? -g[i] : g[i]; tot++; if (s / n >= obs - 1e-12) hit++; } }
  else { const r = rng(7); for (let b = 0; b < 20000; b++) { let s = 0; for (let i = 0; i < n; i++) s += r() < 0.5 ? -g[i] : g[i]; tot++; if (s / n >= obs - 1e-12) hit++; } }
  return hit / tot; }

// ---------- telemetry ----------
const readJ = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const isNone = v => v == null || v === 'None';
function fastestLaps(ti, year) {
  const yd = join(ti, String(year)), out = [];
  if (!existsSync(yd)) return out;
  for (const ev of readdirSync(yd).filter(e => e.endsWith('Grand Prix')).sort()) {
    const q = join(yd, ev, 'Qualifying'); if (!existsSync(q)) continue;
    const track = tiTrack(ev, year); if (WET.has(`${year} ${track}`)) continue;
    let laps = 0, rain = 0; const picks = [];
    for (const drv of readdirSync(q).sort()) {
      const L = readJ(join(q, drv, 'laptimes.json')); if (!L?.time) continue; let best = null;
      L.time.forEach((t, i) => { laps++; if (L.wR?.[i] === true) rain++; if (isNone(t) || L.del?.[i] === true || L.wR?.[i] === true) return; if (!best || +t < best.t) best = {t: +t, lap: L.lap[i]}; });
      if (best && existsSync(join(q, drv, `${best.lap}_tel.json`))) picks.push({drv, ...best, file: join(q, drv, `${best.lap}_tel.json`)});
    }
    if (laps && rain / laps >= 0.1) continue; // ≥ 10 % rain laps: wet session
    out.push({year, event: ev, track, picks});
  }
  return out;
}
const telOf = f => { const r = readJ(f); return r?.tel || r; };

// samples of the pre-registered filter; y = wheel power minus the modelled drag (left to the fit), in W
export function powerSamples(t, gradeAt, o = PRE) {
  const n = t.speed?.length || 0, idx = []; for (let i = 0; i < n; i++) if (Number.isInteger(+t.speed[i])) idx.push(i); // measured car samples only
  const drsMax = Math.max(...t.drs.map(Number)), open = x => drsMax <= 1 ? +x === 1 : +x >= 10;
  const out = [], h = o.win >> 1, m = o.mass, me = m * o.meFactor;
  for (let k = h; k < idx.length - h; k++) {
    const w = idx.slice(k - h, k + h + 1), i = idx[k];
    const kph = +t.speed[i]; if (kph < o.vLo || kph > o.vHi) continue;
    if (![idx[k - 1], i, idx[k + 1]].every(j => +t.throttle[j] >= o.thr && !(t.brake[j] === true || +t.brake[j] > 0))) continue;
    const g0 = +(t.gear ?? t.nGear)[w[0]]; if (!w.every(j => +(t.gear ?? t.nGear)[j] === g0)) continue;
    const tt = w.map(j => +t.time[j]), vv = w.map(j => +t.speed[j] / 3.6), tm = mean(tt), vm = mean(vv);
    let sxy = 0, sxx = 0; for (let q = 0; q < w.length; q++) { sxy += (tt[q] - tm) * (vv[q] - vm); sxx += (tt[q] - tm) ** 2; }
    if (!(sxx > 0)) continue; const a = sxy / sxx, v = kph / 3.6, rel = Number.isFinite(+t.rel_distance?.[i]) ? +t.rel_distance[i] : +t.distance[i] / +t.distance[n - 1];
    const sinT = gradeAt ? Math.sin(gradeAt(rel)) : 0;
    out.push({v, a, open: open(t.drs[i]), y: me * a * v + o.cRoll * m * G * v + m * G * sinT * v, rel});
  }
  return out;
}
// design rows per law; returns {X, y} with the law's fixed part moved to y
function design(S, law, vc) {
  const X = [], y = [];
  for (const s of S) {
    const c = s.open ? 0 : -(s.v ** 3) / 2, op = s.open ? -(s.v ** 3) / 2 : 0, step = s.v < vc ? 1 : 0;
    if (law === 'a') { X.push([1, c, op]); y.push(s.y - PRE.dPkernel * step); }
    else if (law === 'b') { X.push([1, c, op]); y.push(s.y); }
    else if (law === 'c') { X.push([1, c, op, s.v - PRE.vRef / 3.6]); y.push(s.y); }
    else { X.push([1, c, op, step]); y.push(s.y); } // 'step': free step at the kernel cut-off
  }
  return {X, y};
}
// coefficients for every column of the law; a column with no sample (a DRS state never seen) is null
export function fitLaw(S, law, vc) { const {X, y} = design(S, law, vc), used = X[0].map((_, j) => X.some(r => r[j] !== 0));
  const b = lstsq(X.map(r => r.filter((_, j) => used[j])), y); if (!b) return null; let q = 0; return used.map(u => u ? b[q++] : null); }
// out-of-sample RMS (N) of the residual force, leave one lap out (a test sample whose column was not fitted is left out)
function looRms(S, law, vc) { const laps = [...new Set(S.map(s => s.lap))]; let ss = 0, n = 0;
  for (const L of laps) { const tr = S.filter(s => s.lap !== L), te = S.filter(s => s.lap === L); if (tr.length < 30) continue;
    const b = fitLaw(tr, law, vc); if (!b) continue; const {X, y} = design(te, law, vc);
    for (let r = 0; r < X.length; r++) { if (X[r].some((x, j) => x !== 0 && b[j] == null)) continue;
      const pr = X[r].reduce((s, x, j) => s + x * (b[j] ?? 0), 0); ss += ((y[r] - pr) / te[r].v) ** 2; n++; } }
  return n ? Math.sqrt(ss / n) : null; }

// ---------- kernel side ----------
function seasonCar(id, year) {
  if (year >= 2025) { const c = carsFor(id)[String(year)]; return c && {car: c.car, grip: c.grip || 1, zc: c}; }
  const s = lapsimCalibration.seasons[String(year)], tr = s?.tracks?.[id]; if (!s || !tr) return null;
  const drag = tr.drag ?? 1, car = {...s.car, cdA: s.car.cdA * drag, cdALow: (s.car.cdALow ?? s.car.cdA) * drag};
  return {car, grip: tr.grip ?? 1, zc: {car, year, grip: tr.grip ?? 1}};
}
export function kernelLap(id, year) {
  const d = lapsimAllTracks[id], sc = d && seasonCar(id, year); if (!sc) return null;
  const w = realConditions(id)?.[String(year)] || {}, fw = Object.fromEntries(Object.entries(w).filter(([, v]) => Number.isFinite(v)));
  const env = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0, ...fw, rechargeMJ: year >= 2026 ? rechargeLimitMJ(id, 2026) ?? undefined : undefined});
  const tr = withZones(K, d, K.trackFromData(d), sc.zc), t2 = {...tr, mu: Float64Array.from(tr.mu, m => m * sc.grip)};
  const e2 = PU_RAMP && year >= 2026 ? {...env, puRamp: puRampOf(d, id)} : env;
  return {d, car: sc.car, env: e2, track: t2, res: K.simulateLap(t2, sc.car, e2)};
}
const gradeFn = d => d?.grade ? rel => d.grade[Math.min(d.grade.length - 1, Math.max(0, Math.round(rel * d.grade.length)))] / 1e4 : null;

// ---------- 1. deploy law, 2023–25 ----------
function deployLaw(ti, sysPatch = null) {
  const o = {...PRE, ...(sysPatch || {})}, rows = [];
  for (const year of [2023, 2024, 2025]) for (const ev of fastestLaps(ti, year)) {
    const kl = kernelLap(ev.track, year); if (!kl) continue;
    const vcK = kl.res.energy.cutoffKph; const vc = vcK ? vcK / 3.6 : Infinity, gf = o.noGrade ? null : gradeFn(kl.d);
    const S = []; for (const p of ev.picks) { const t = telOf(p.file); if (!t?.speed) continue; for (const s of powerSamples(t, gf, o)) S.push({...s, lap: p.drv}); }
    if (S.length < 100 || !S.some(s => s.v < vc) || !S.some(s => s.v >= vc)) { rows.push({year, track: ev.track, n: S.length, skipped: 'too few samples on one side of the cut-off'}); continue; }
    const fb = fitLaw(S, 'b'), fc = fitLaw(S, 'c'), fs = fitLaw(S, 'step', vc), fa = fitLaw(S, 'a', vc);
    const row = {year, track: ev.track, laps: ev.picks.length, n: S.length, nBelowCut: S.filter(s => s.v < vc).length, cutoffKph: vcK ? Math.round(vcK) : null,
      P0kW: fb[0] / 1e3, slopeKWper100: fc[3] * (100 / 3.6) / 1e3, stepKW: fs[3] / 1e3, rhoCdA: fb[1], rhoCdAopen: fb[2], cdA: fb[1] / kl.env.rho, aP0kW: fa[0] / 1e3};
    if (!sysPatch) Object.assign(row, {rmsN: {a: looRms(S, 'a', vc), b: looRms(S, 'b'), c: looRms(S, 'c')},
      bins: [180, 220, 260, 300, 345].slice(0, -1).map((lo, i, A) => { const hi = [220, 260, 300, 345][i], B = S.filter(s => s.v * 3.6 >= lo && s.v * 3.6 < hi);
        // residual wheel power in the band from the flat fit's drag (P(v) reading per band, kW)
        return {kph: `${lo}-${hi}`, n: B.length, PkW: B.length ? mean(B.map(s => s.y + (s.open ? fb[2] ?? fb[1] : fb[1]) * s.v ** 3 / 2)) / 1e3 : null}; })});
    rows.push(row);
  }
  return rows;
}
function pooled(rows, key) { // one value per track (seasons averaged), then mean over tracks
  const by = {}; for (const r of rows) if (!r.skipped && Number.isFinite(r[key])) (by[r.track] ||= []).push(r[key]);
  const v = Object.values(by).map(mean); return {n: v.length, mean: mean(v), ci90: bootCI(v), jackSE: jackSE(v), perTrack: Object.fromEntries(Object.entries(by).map(([k, a]) => [k, +mean(a).toFixed(1)]))}; }

// ---------- 2. 2026 clipping ----------
function csvRows(f) { const [h, ...L] = readFileSync(f, 'utf8').trim().split('\n'), H = h.split(',');
  return L.map(l => { const c = l.split(','); return Object.fromEntries(H.map((k, i) => [k, c[i]])); }); }
function kernelClips(kl) { // first point per power-limited run where the kernel's ERS-K gives < its limit − 50 kW, or harvests at full throttle
  const {res, car} = kl, n = res.v.length, ds = kl.track.ds, out = [];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, dt = (j ? res.time[j] : res.lapTime) - res.time[i];
    const pDep = res.flow.dep[i] / dt, lim = K.erskLimitW('f1-2026', res.v[i], car.ers.pMax, false);
    out.push({s: i * ds, frac: i / n, lim: res.limit[i] === 2, clip: res.limit[i] === 2 && res.v[j] > res.v[i] && (pDep < lim - 50e3 || res.flow.thr[i] > 0)}); }
  return out; }
function clipping(ti, det) {
  const rows = [];
  for (const ev of readdirSync(det).filter(e => existsSync(join(det, e, 'straights.csv'))).sort()) {
    const track = tiTrack(ev, 2026); if (WET.has(`2026 ${track}`)) continue;
    const S = csvRows(join(det, ev, 'straights.csv')).filter(r => r.session === 'Qualifying');
    const fast = new Set(fastestLaps(ti, 2026).filter(e => e.event === ev).flatMap(e => e.picks.map(p => `${p.drv}|${p.lap}`)));
    const R = S.filter(r => fast.has(`${r.driver}|${r.lap}`)).map(r => ({...r, f0: +r.start_m / +r.lap_length_m, f1: +r.end_m / +r.lap_length_m, L: +r.lap_length_m}));
    if (!R.length) continue;
    // straights of different drivers are the same straight when their start fractions are within 0.03
    R.sort((a, b) => a.f0 - b.f0); const cl = []; for (const r of R) { const c = cl.at(-1); if (c && r.f0 - c.at(-1).f0 < 0.03) c.push(r); else cl.push([r]); }
    const kl = kernelLap(track, 2026), kc = kl && kernelClips(kl), Lm = median(R.map(r => r.L)), doc = lapsimPuDocs?.events?.[track], pm = lapsimEnergyClip?.events?.[track];
    const docScale = doc?.centrelineKm ? Lm / (doc.centrelineKm * 1000) : 1;
    for (const c of cl) { if (c.length < 5) continue;
      const det2 = c.filter(r => r.clip_status === 'detected' && r.clip_m !== ''), on = det2.map(r => (+r.start_m + +r.clip_m) / r.L * Lm);
      const f0 = median(c.map(r => r.f0)), f1 = median(c.map(r => r.f1));
      const k = kc?.find(p => p.frac >= f0 && p.frac <= f1 && p.clip), kOn = k ? k.frac * Lm : null;
      const inDoc = (z, x) => z.some(q => x >= q.from * docScale && x <= q.to * docScale);
      const pmS = pm ? Object.values(pm.teams).flat().filter(z => z.absolute_m != null && z.absolute_m / pm.refM >= f0 && z.absolute_m / pm.refM <= f1).map(z => z.absolute_m / pm.refM * Lm) : [];
      const med = on.length ? median(on) : null;
      rows.push({track, event: ev, straight: `${Math.round(f0 * Lm)}-${Math.round(f1 * Lm)} m`, laps: c.length, clipShare: +(det2.length / c.length).toFixed(2),
        onsetM: med != null ? Math.round(med) : null, iqrM: on.length >= 4 ? Math.round(quant(on, 0.75) - quant(on, 0.25)) : null,
        clipKph: det2.length ? Math.round(median(det2.map(r => +r.clip_speed_kmh))) : null,
        kernelOnsetM: kOn != null ? Math.round(kOn) : null, kernelErrM: med != null && kOn != null ? Math.round(kOn - med) : null,
        practiceMapM: pmS.length ? Math.round(median(pmS)) : null,
        fia: doc ? {qualiMJ: doc.qualiMJ, powerLimitedM: doc.powerLimitedDistanceM, inBigCut: med != null && inDoc(doc.bigCut || [], med), inSpeedSector: med != null && inDoc(doc.speed || [], med), rampKWs: doc.rampKWs} : null});
    }
  }
  return rows;
}

// ---------- 3. regen ----------
// per braking run of a speed trace (time s, v m/s, braking flag): ΔKE, drag and roll work, and the two regen laws (J, after η and cap)
// zone.wBrake = Σ max(0, m_e·a − D − R)·v·dt (work done by the brakes and the MGU-K); zone.negSteps = steps where drag + roll alone
// exceed the deceleration (a lift, not braking). Identity: regenBF ≤ η·share·wBrake, and wBrake = ΔKE_e − drag − roll when negSteps = 0.
export function regenZones(t, v, brk, {m, me = m * PRE.meFactor, rhoCdA, cRoll = PRE.cRoll, share = 0.4, eta = 0.9, cap = 350e3, tag = null}) {
  const zones = []; let z = null;
  for (let i = 0; i + 1 < v.length; i++) {
    const dt = t[i + 1] - t[i]; if (!(dt > 0)) continue;
    if (brk[i] && v[i + 1] < v[i]) {
      z ||= {i0: i, dKE: 0, dKEe: 0, wDrag: 0, wRoll: 0, wBrake: 0, regenKE: 0, regenBF: 0, regenKEtagged: 0, capped: 0, steps: 0, negSteps: 0};
      const vm = (v[i] + v[i + 1]) / 2, a = (v[i] - v[i + 1]) / dt, D = rhoCdA * vm * vm / 2, R = cRoll * m * G;
      const pKE = share * m * a * vm * eta, pBF = share * Math.max(0, me * a - D - R) * vm * eta;
      z.dKE += m * (v[i] ** 2 - v[i + 1] ** 2) / 2; z.dKEe += me * (v[i] ** 2 - v[i + 1] ** 2) / 2; z.wDrag += D * vm * dt; z.wRoll += R * vm * dt;
      z.wBrake += Math.max(0, me * a - D - R) * vm * dt; if (me * a - D - R < 0) z.negSteps++;
      z.regenKE += Math.min(cap, pKE) * dt; if (tag && tag[i]) z.regenKEtagged += Math.min(cap, pKE) * dt; z.regenBF += Math.min(cap, pBF) * dt; z.capped += pBF >= cap ? dt : 0; z.steps++;
    } else if (z) { zones.push(z); z = null; }
  }
  if (z) zones.push(z);
  return zones;
}
const sumZ = (Z, k) => Z.reduce((s, z) => s + z[k], 0);
function regen(ti) {
  const out = [], laps2026 = fastestLaps(ti, 2026);
  for (const id of PRE.regenTracks) {
    const kl = kernelLap(id, 2026); if (!kl) { out.push({track: id, skipped: 'no kernel lap'}); continue; }
    const {res, car, env} = kl, n = res.v.length, rhoCdA = env.rho * car.cdA, ers = car.ers;
    const tt = Array.from({length: n + 1}, (_, i) => i < n ? res.time[i] : res.lapTime), vv = Array.from({length: n + 1}, (_, i) => res.v[i % n]);
    // tag: the kernel point is not braking-limited (limit ≠ 3): a lift or a power-limited slow-down the kernel still counts as regen
    const Z = regenZones(tt, vv, vv.map((x, i) => i < n && vv[i + 1] < x), {m: car.mass, me: car.mass * (car.inertiaFactor ?? 1.06), rhoCdA, share: ers.regenShare, eta: ers.etaRegen, cap: ers.regenMax,
      tag: Array.from({length: n}, (_, i) => res.limit[i] !== 3)});
    const limit = res.energy.rechargeMaxJ, harv = res.energy.throttleHarvestJ || 0, kE = sumZ(Z, 'regenKE'), bE = sumZ(Z, 'regenBF');
    const row = {track: id, rechargeLimitMJ: limit / 1e6, kernel: {zones: Z.length, dKEMJ: sumZ(Z, 'dKE') / 1e6, dragRollMJ: (sumZ(Z, 'wDrag') + sumZ(Z, 'wRoll')) / 1e6,
      regenKEMJ: kE / 1e6, regenBFMJ: bE / 1e6, diffMJ: (kE - bE) / 1e6, diffPct: 100 * (kE - bE) / bE, kernelReportedMJ: (res.energy.regenJ - harv) / 1e6,
      throttleHarvestMJ: harv / 1e6, regenKEnotBrakingMJ: sumZ(Z, 'regenKEtagged') / 1e6, cutoffKph: res.energy.cutoffKph, clipFromKph: res.energy.clipFromKph,
      limitBindsKE: kE + harv >= limit - 1e4, limitBindsBF: bE + harv >= limit - 1e4,
      identity: {regenLeBrakeWork: Z.every(z => z.regenBF <= ers.etaRegen * ers.regenShare * z.wBrake + 1e-6),
        brakeWorkLeDKE: Z.filter(z => !z.negSteps).every(z => z.wBrake <= z.dKEe - z.wDrag - z.wRoll + 1e-3), zonesWithLiftSteps: Z.filter(z => z.negSteps).length}}};
    row.kernel.zonesCapped = Z.filter(z => z.capped > 0).length;
    // measured laps: the same two laws on each driver's fastest dry lap (brake channel, car samples only)
    const ev = laps2026.find(e => e.track === id), M = [];
    for (const p of ev?.picks || []) { const t = telOf(p.file); if (!t?.speed) continue; const idx = [];
      for (let i = 0; i < t.speed.length; i++) if (Number.isInteger(+t.speed[i])) idx.push(i);
      const T = idx.map(i => +t.time[i]), V = idx.map(i => +t.speed[i] / 3.6), B = idx.map(i => t.brake[i] === true || +t.brake[i] > 0);
      const Zm = regenZones(T, V, B, {m: car.mass, me: car.mass * (car.inertiaFactor ?? 1.06), rhoCdA, share: ers.regenShare, eta: ers.etaRegen, cap: ers.regenMax});
      M.push({ke: sumZ(Zm, 'regenKE'), bf: sumZ(Zm, 'regenBF'), dKE: sumZ(Zm, 'dKE'), dr: sumZ(Zm, 'wDrag') + sumZ(Zm, 'wRoll')}); }
    if (M.length) row.measured = {laps: M.length, dKEMJ: median(M.map(x => x.dKE)) / 1e6, dragRollMJ: median(M.map(x => x.dr)) / 1e6,
      regenKEMJ: median(M.map(x => x.ke)) / 1e6, regenBFMJ: median(M.map(x => x.bf)) / 1e6, diffMJ: median(M.map(x => x.ke - x.bf)) / 1e6,
      diffMJiqr: [quant(M.map(x => x.ke - x.bf), 0.25) / 1e6, quant(M.map(x => x.ke - x.bf), 0.75) / 1e6]};
    out.push(row);
  }
  return out;
}

// ---------- main ----------
if (process.argv[1]?.endsWith('ers-evidence.mjs')) {
  const [ti, det] = process.argv.slice(2);
  if (!ti || !det) throw new Error('usage: node scripts/sim/ers-evidence.mjs <TracingInsights dir> <detect.py output dir>');
  const r4 = x => x == null || !Number.isFinite(x) ? x : Math.abs(x) >= 100 ? Math.round(x * 10) / 10 : Math.round(x * 1e3) / 1e3, round = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'number' ? r4(v) : v));
  const rows = deployLaw(ti);
  const P = {stepKW: pooled(rows, 'stepKW'), slopeKWper100: pooled(rows, 'slopeKWper100'), P0kW: pooled(rows, 'P0kW')};
  const SYS = {'mass +10 kg': {mass: PRE.mass + 10}, 'mass −10 kg': {mass: PRE.mass - 10}, 'C_rr 0.010': {cRoll: 0.010}, 'C_rr 0.015': {cRoll: 0.015},
    'm_e 1.03': {meFactor: 1.03}, 'm_e 1.09': {meFactor: 1.09}, 'grade off': {noGrade: true}};
  const sys = {}; for (const [k, p] of Object.entries(SYS)) { const r = deployLaw(ti, p); sys[k] = {stepKW: pooled(r, 'stepKW').mean - P.stepKW.mean, slopeKWper100: pooled(r, 'slopeKWper100').mean - P.slopeKWper100.mean, P0kW: pooled(r, 'P0kW').mean - P.P0kW.mean}; }
  const sysTot = q => Math.sqrt(['mass', 'C_rr', 'm_e'].reduce((s, g) => s + Math.max(...Object.entries(sys).filter(([k]) => k.startsWith(g)).map(([, v]) => Math.abs(v[q]))) ** 2, 0) + sys['grade off'][q] ** 2);
  // out-of-sample RMS gains per track (seasons pooled): b vs a, c vs b (+ = better)
  const gain = (x, y) => { const by = {}; for (const r of rows) if (r.rmsN?.[x] != null && r.rmsN?.[y] != null) (by[r.track] ||= []).push(r.rmsN[x] - r.rmsN[y]); return Object.values(by).map(mean); };
  const gBA = gain('a', 'b'), gCB = gain('b', 'c');
  const dec = {
    cutoffRejected: !(P.stepKW.ci90[0] <= PRE.dPkernel / 1e3 && PRE.dPkernel / 1e3 <= P.stepKW.ci90[1]),
    taperBeatsFlat: (P.slopeKWper100.ci90[0] > 0 || P.slopeKWper100.ci90[1] < 0) && Math.abs(P.slopeKWper100.mean) > PRE.minSlopeKW100,
    oos: {flatVsCutoff: {n: gBA.length, meanGainN: mean(gBA), ci90: bootCI(gBA), p: signFlipP(gBA), passAt: 0.16 / 2},
      taperVsFlat: {n: gCB.length, meanGainN: mean(gCB), ci90: bootCI(gCB), p: signFlipP(gCB), passAt: 0.16 / 2}}};
  dec.winner = dec.cutoffRejected ? (dec.taperBeatsFlat ? 'c taper' : 'b flat') : 'a kernel cut-off';
  const clips = clipping(ti, det), errs = {}; for (const c of clips) if (c.kernelErrM != null) (errs[c.track] ||= []).push(Math.abs(c.kernelErrM));
  const out = {generatedBy: 'scripts/sim/ers-evidence.mjs', prereg: 'claude/gate-ers-law-prereg-2026-11-23.md', source: 'TracingInsights 2023–2026 Qualifying, each driver\'s fastest dry lap (FastF1 / Formula 1 timing); kernel = production calibration',
    pre: PRE, deploy: {rows, pooled: P, sys, sysTotal: {stepKW: sysTot('stepKW'), slopeKWper100: sysTot('slopeKWper100'), P0kW: sysTot('P0kW')}, decision: dec},
    clipping: {cannotShow: ['Straight Mode state', 'Overtake use', 'battery state', 'MGU-K power or torque', 'ICE power', 'cause of the drop (clip, super-clip, C5.12 ramp)'],
      rows: clips, kernelMedianAbsErrPerTrackM: Object.fromEntries(Object.entries(errs).map(([k, a]) => [k, median(a)])), kernelMedianAbsErrM: median(Object.values(errs).map(median))},
    regen: regen(ti)};
  writeFileSync('scripts/sim/data/learn/ers-evidence.json.gz', gzipSync(JSON.stringify(round(out)) + '\n', {level: 9}));
  console.log('winner', dec.winner, 'step', P.stepKW.mean.toFixed(1), P.stepKW.ci90.map(x => x.toFixed(1)), 'slope', P.slopeKWper100.mean.toFixed(1), P.slopeKWper100.ci90.map(x => x.toFixed(1)));
}
