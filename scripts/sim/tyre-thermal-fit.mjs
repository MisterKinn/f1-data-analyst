// Step 7a: fit and judge the two-node tyre thermal model (worker/lapsim/tyre-thermal.js) on open F1 lap data.
// Pre-registration: Project doc claude/gate-tyre-thermal-7a-prereg-2026-11-23.md (ledger line 2026-11-23, 7a).
// Data: TracingInsights season repos (laptimes.json per driver and session), cloned sparse into LAPSIM_TI_LAPS
// (default .cache/lapsim/ti-laps/<year>); raw files stay out of git. Tuning 2023–24, hold-out 2025–26, held-out unit =
// track. The hold-out of a target is opened only if its power check on tuning passes (AGENTS.md v3.3).
//   node scripts/sim/tyre-thermal-fit.mjs [--holdout] → worker/lapsim/tyre-thermal-data.js, scripts/sim/data/learn/tyre-thermal-fit.json
import {existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {tiTrack} from './ti-races.mjs';
import {signFlip, mde} from './gate.mjs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {evolutionCoeffs, evolutionDelta} from '../../worker/lapsim/evolution.js';
import {TYRE_THERMAL_DEFAULTS, lapLoads, runSequence, solveEta} from '../../worker/lapsim/tyre-thermal.js';

const ROOT = process.env.LAPSIM_TI_LAPS || '.cache/lapsim/ti-laps', TUNE = [2023, 2024], HOLD = [2025, 2026];
const OPEN_HOLDOUT = process.argv.includes('--holdout'), LOCK = Date.parse('2026-11-22T15:00:00Z');
const SES = ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying'], FAM = {SOFT: 'S', MEDIUM: 'M', HARD: 'H'};
const K = lapsimKernel(), val = v => v === 'None' || v == null ? null : v;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const rmsOf = a => Math.sqrt(mean(a.map(x => x * x)));
const r4 = x => Math.round(x * 1e4) / 1e4;

// ---------- data ----------
function clone(y) {
  const dir = join(ROOT, String(y));
  if (existsSync(join(dir, '.git'))) return dir;
  mkdirSync(ROOT, {recursive: true});
  execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', `https://github.com/TracingInsights/${y}`, dir], {stdio: 'inherit'});
  execFileSync('git', ['-C', dir, 'sparse-checkout', 'set', '--no-cone', '/*/Practice */*/laptimes.json', '/*/Qualifying/*/laptimes.json', '/*/*/session_info.json'], {stdio: 'inherit'});
  execFileSync('git', ['-C', dir, 'checkout', '-q'], {stdio: 'inherit'});
  return dir;
}
const readJ = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

function loadSessions(years) {
  const out = [];
  for (const y of years) {
    const dir = clone(y);
    for (const ev of readdirSync(dir).filter(e => /Grand Prix$/.test(e))) {
      const track = tiTrack(ev, y); if (!lapsimTracks[track]) continue;
      const sprint = readdirSync(join(dir, ev)).some(s => /Sprint/.test(s));
      for (const ses of SES) {
        const p = join(dir, ev, ses); if (!existsSync(p)) continue;
        const info = readJ(join(p, 'session_info.json')); if (!info) continue;
        if (Date.parse(info.t0_date + 'Z') >= LOCK) continue; // locked confirmation set
        const t0 = info.session_start_time ?? 0, drivers = {};
        let nLaps = 0, nRain = 0;
        for (const d of readdirSync(p).filter(d => /^[A-Z]{3}$/.test(d))) {
          const L = readJ(join(p, d, 'laptimes.json')); if (!L?.lap) continue;
          drivers[d] = L.lap.map((lap, i) => {
            nLaps++; if (L.wR?.[i] === true) nRain++;
            const time = val(L.time[i]), st = String(L.status?.[i] ?? '1');
            return {lap, time: Number.isFinite(time) ? time : null, stint: L.stint?.[i], fam: FAM[L.compound?.[i]] || null, life: val(L.life?.[i]),
              out: val(L.pout?.[i]) != null, inl: val(L.pin?.[i]) != null, ok: !/[24567]/.test(st) && L.del?.[i] !== true && L.wR?.[i] !== true,
              min: ((val(L.lST?.[i]) ?? NaN) - t0) / 60, tt: val(L.wTT?.[i]), ta: val(L.wAT?.[i]), p: val(L.wP?.[i]), h: val(L.wH?.[i])};
          });
        }
        if (!nLaps || nRain / nLaps > 0.1) continue;
        out.push({year: y, event: ev, track, ses, sprint, drivers});
      }
    }
  }
  return out;
}

// ---------- per-track kernel quantities ----------
// fit speed: blocks of b points (≈ 25 m) — time and energy kept exact per block, speed time-weighted
function coarsen(L, b) {
  const n = Math.ceil(L.dt.length / b), o = {dt: new Float64Array(n), v: new Float64Array(n), slide: new Float64Array(n), rollW: new Float64Array(n), rollA: new Float64Array(n)};
  for (let i = 0; i < L.dt.length; i++) { const j = Math.floor(i / b), d = L.dt[i]; o.dt[j] += d; o.v[j] += L.v[i] * d; o.slide[j] += L.slide[i] * d; o.rollW[j] += L.rollW[i] * d; o.rollA[j] += L.rollA[i] * d; }
  for (let j = 0; j < n; j++) { const d = o.dt[j]; o.v[j] /= d; o.slide[j] /= d; o.rollW[j] /= d; o.rollA[j] /= d; }
  return o;
}
const q = (x, s) => Math.round(x / s) * s;
const trackCache = {};
function trackInfo(id, year) {
  const key = id + (year >= 2026 ? '-26' : '-25');
  if (trackCache[key]) return trackCache[key];
  const c = carsFor(id)[year >= 2026 ? '2026' : '2025'], tr = K.trackFromData(lapsimTracks[id]); tr.mu.fill(c.grip);
  const env0 = K.conditionsFromWeather({trackTempC: 35, airTempC: 25}), envG = {...env0, grip: 1};
  const lap = K.simulateLap(tr, c.car, envG), L0 = lap.lapTime;
  const Sg = (K.simulateLap(tr, c.car, {...envG, grip: 1.01}).lapTime / L0 - 1) / 0.01; // d ln lap / d grip
  const perKg = (K.simulateLap(tr, {...c.car, mass: c.car.mass + 5}, envG).lapTime - L0) / 5; // s per kg
  const len = lapsimTracks[id].length || tr.kappa.length * tr.ds, raceLaps = Math.ceil(305e3 / len), burn = (year >= 2026 ? 70 : 110) / raceLaps;
  const loads = coarsen(lapLoads(tr, c.car, lap, envG), 5);
  const lapAt = (w, gripOverride) => { const e = K.conditionsFromWeather(w); return K.simulateLap(tr, c.car, gripOverride == null ? e : {...e, grip: gripOverride}).lapTime; };
  return trackCache[key] = {tr, car: c.car, L0, Sg, perKg, burn, loads, lapAt, etaCache: new Map()};
}
const rubber = (ses, min) => evolutionDelta({...evolutionCoeffs('f1', null, ses === 'Qualifying' ? 'qualifying' : 'practice'), session: ses === 'Qualifying' ? 'qualifying' : 'practice', useCurve: false}, min, Infinity);
const warmProd = ses => { const c = evolutionCoeffs('f1', null, ses === 'Qualifying' ? 'qualifying' : 'practice'); return evolutionDelta({...c, gainPct: 0, curve: null, useCurve: false}, 0, 1) - evolutionDelta({...c, gainPct: 0, curve: null, useCurve: false}, 0, 3); };

// ---------- targets ----------
function t1bUnits(sessions) {
  const units = {};
  for (const S of sessions) for (const laps of Object.values(S.drivers)) {
    const best = {};
    for (const l of laps) if (l.ok && l.time && l.fam && !l.out && !l.inl) best[l.fam] = Math.min(best[l.fam] ?? Infinity, l.time);
    for (let i = 0; i + 3 < laps.length; i++) {
      const [o, a, c, b] = laps.slice(i, i + 4);
      if (!o.out || !a.fam || [a, c, b].some(x => x.stint !== o.stint || x.fam !== a.fam) || b.lap !== o.lap + 3) continue;
      if (![a, c, b].every(x => x.ok && x.time) || a.inl || c.inl || c.out || b.out) continue;
      const bb = best[a.fam]; if (!(a.time <= 1.02 * bb && b.time <= 1.02 * bb && c.time > 1.07 * bb)) continue;
      if (![a.tt, a.ta].every(Number.isFinite)) continue;
      const T = trackInfo(S.track, S.year);
      let y = 100 * (a.time - b.time) / b.time;
      y -= 100 * 2 * T.burn * T.perKg / b.time;               // A carries two laps more fuel
      y -= 100 * (rubber(S.ses, a.min) - rubber(S.ses, b.min)); // less rubber on A
      const run = {y, rOut: o.time ? Math.min(0.9, Math.max(0.4, a.time / o.time)) : 0.6, rC: Math.min(0.95, a.time / c.time), tt: a.tt, ta: a.ta, ses: S.ses};
      const k = `${S.year}|${S.track}|${a.fam}`;
      (units[k] ||= {year: S.year, track: S.track, fam: a.fam, runs: []}).runs.push(run);
    }
  }
  return Object.values(units).filter(u => u.runs.length >= 3).map(u => ({...u, y: mean(u.runs.map(r => r.y)), prodVar: mean(u.runs.map(r => 100 * warmProd(r.ses)))}));
}

function t2Units(sessions) {
  const ev = {};
  for (const S of sessions.filter(s => !s.sprint)) (ev[`${S.year}|${S.track}`] ||= {})[S.ses] = S;
  const units = [];
  for (const [k, E] of Object.entries(ev)) {
    const Q = E.Qualifying; if (!Q) continue;
    const bestSoft = S => { const o = {}; for (const [d, laps] of Object.entries(S.drivers)) for (const l of laps) if (l.ok && l.time && l.fam === 'S' && !l.out && !l.inl && Number.isFinite(l.min)) {
      const t = l.time / (1 + rubber(S.ses, l.min)); if (!o[d] || t < o[d].t) o[d] = {t, l}; } return o; };
    const bq = bestSoft(Q);
    for (const s of ['Practice 1', 'Practice 2', 'Practice 3']) {
      if (!E[s]) continue;
      const bs = bestSoft(E[s]), common = Object.keys(bs).filter(d => bq[d]);
      if (common.length < 5) continue;
      const w = (B, ds) => ({trackTempC: median(ds.map(d => B[d].l.tt).filter(Number.isFinite)), airTempC: median(ds.map(d => B[d].l.ta).filter(Number.isFinite)),
        pressureHpa: median(ds.map(d => B[d].l.p).filter(Number.isFinite)), humidityPct: median(ds.map(d => B[d].l.h).filter(Number.isFinite))});
      const wS = w(bs, common), wQ = w(bq, common);
      if (![wS.trackTempC, wQ.trackTempC, wS.airTempC, wQ.airTempC].every(Number.isFinite)) continue;
      const T = trackInfo(Q.track, Q.year);
      const prodVar = 100 * (T.lapAt(wS) / T.lapAt(wQ) - 1), densVar = 100 * (T.lapAt(wS, 1) / T.lapAt(wQ, 1) - 1);
      const parVar = 100 * T.Sg * (K.gripFromTrackTemp(wS.trackTempC) - K.gripFromTrackTemp(wQ.trackTempC));
      units.push({year: Q.year, track: Q.track, type: s, y: median(common.map(d => 100 * (bs[d].t / bq[d].t - 1))), wS, wQ, prodVar, densVar, parVar,
        night: Math.abs(wS.trackTempC - wQ.trackTempC) >= 8});
    }
  }
  return units;
}

// ---------- thermal predictions ----------
function paramsOf(x) {
  return {...TYRE_THERMAL_DEFAULTS, tauS: x.tauS, tauB: x.tauB, window: {S: {tc: x.tcS, w: x.wS}, M: {tc: x.tcM, w: x.wM}, H: {tc: x.tcH, w: x.wH}}};
}
function etaFor(T, P) { const k = P.tauS + '|' + P.tauB; if (!T.etaCache.has(k)) T.etaCache.set(k, solveEta(T.loads, P)); return T.etaCache.get(k); }
function predT1b(u, P) {
  const T = trackInfo(u.track, u.year), eta = etaFor(T, P);
  const memo = P._memo ||= new Map();
  return mean(u.runs.map(r => {
    const rO = q(r.rOut, 0.05), rC = q(r.rC, 0.02), tt = q(r.tt, 1), ta = q(r.ta, 1), key = `${u.track}|${u.year >= 2026}|${u.fam}|${rO}|${rC}|${tt}|${ta}`;
    if (!memo.has(key)) { const s = runSequence(T.loads, [{r: rO}, {r: 1}, {r: rC}, {r: 1}], {trackC: tt, airC: ta, eta, fam: u.fam}, P); memo.set(key, 100 * T.Sg * (s[1].grip - s[3].grip)); }
    return memo.get(key);
  }));
}
function predT2(u, P) {
  const T = trackInfo(u.track, u.year), eta = etaFor(T, P);
  const g = w => runSequence(T.loads, [{r: 0.65}, {r: 1}], {trackC: w.trackTempC, airC: w.airTempC, eta, fam: 'S'}, P)[1].grip;
  return u.densVar + 100 * T.Sg * (g(u.wS) - g(u.wQ));
}

// offsets per group fitted on the given (tuning) units, then errors
function withOffsets(units, varOf, groupOf, fitUnits = units) {
  const off = {};
  for (const [g, us] of Object.entries(Object.groupBy(fitUnits, groupOf))) off[g] = mean(us.map(u => u.y - varOf(u)));
  const all = mean(fitUnits.map(u => u.y - varOf(u)));
  return units.map(u => u.y - (off[groupOf(u)] ?? all) - varOf(u));
}

const SPACE = {tauS: [5, 120], tauB: [60, 1200], tcS: [60, 140], tcM: [60, 140], tcH: [60, 140], wS: [10, 80], wM: [10, 80], wH: [10, 80]};
const START = {tauS: 30, tauB: 400, tcS: 100, tcM: 105, tcH: 110, wS: 35, wM: 35, wH: 35};

function loss(x, A, B) {
  const P = paramsOf(x);
  const e1 = withOffsets(A, u => predT1b(u, P), u => u.fam), e2 = withOffsets(B, u => predT2(u, P), u => u.type);
  return mean(e1.map(e => e * e)) + mean(e2.map(e => e * e));
}
function fit(A, B, x0 = START, sweeps = 3, grid = 7) {
  let x = {...x0}, f = loss(x, A, B);
  for (let s = 0; s < sweeps; s++) for (const k of Object.keys(SPACE)) {
    const [lo, hi] = SPACE[k], span = (hi - lo) / Math.pow(3, s);
    for (let g = 0; g < grid; g++) {
      const v = Math.min(hi, Math.max(lo, x[k] - span / 2 + span * g / (grid - 1))), y = {...x, [k]: v}, fy = loss(y, A, B);
      if (fy < f) { f = fy; x = y; }
    }
  }
  return {x, f};
}

// ---------- judging ----------
function perTrackGains(units, errBase, errModel) {
  const by = {};
  units.forEach((u, i) => { (by[u.track] ||= {b: [], m: []}); by[u.track].b.push(errBase[i] ** 2); by[u.track].m.push(errModel[i] ** 2); });
  return Object.entries(by).map(([track, o]) => ({track, gain: mean(o.b) - mean(o.m)}));
}
function judge(name, units, errs, m) {
  const out = {target: name, n: new Set(units.map(u => u.track)).size, rms: {}, medAbs: {}};
  for (const [k, e] of Object.entries(errs)) { out.rms[k] = r4(rmsOf(e)); out.medAbs[k] = r4(median(e.map(Math.abs))); }
  for (const base of ['production', 'constant']) {
    const g = perTrackGains(units, errs[base], errs.thermal).map(x => x.gain);
    const sf = signFlip(g, {m});
    out['vs_' + base] = {meanGain: r4(mean(g)), ci90: sf.ci90.map(r4), p: r4(sf.p), pass: sf.accept, reason: sf.reason, rmsGain: r4(rmsOf(errs[base]) - rmsOf(errs.thermal))};
  }
  out.pass = ['production', 'constant'].every(b => out['vs_' + b].pass && out['vs_' + b].rmsGain >= 0.02);
  return out;
}

// ---------- main ----------
const t0 = Date.now();
const tuneS = loadSessions(TUNE);
console.log(`loaded ${((Date.now() - t0) / 1e3).toFixed(0)} s`);
const A = t1bUnits(tuneS), B = t2Units(tuneS);
console.log(`tuning: ${tuneS.length} sessions, T1b ${A.length} units (${A.reduce((s, u) => s + u.runs.length, 0)} runs), T2 ${B.length} units`);
const F = fit(A, B), P = paramsOf(F.x);
console.log('fit', JSON.stringify(F.x), 'loss', r4(F.f), `${((Date.now() - t0) / 1e3).toFixed(0)} s`);

const errsT1 = (U, fitU, Pm) => ({constant: withOffsets(U, () => 0, u => u.fam, fitU), production: withOffsets(U, u => u.prodVar, u => u.fam, fitU),
  parabola: withOffsets(U, () => 0, u => u.fam, fitU), thermal: withOffsets(U, u => predT1b(u, Pm), u => u.fam, fitU)});
const errsT2 = (U, fitU, Pm) => ({constant: withOffsets(U, () => 0, u => u.type, fitU), production: withOffsets(U, u => u.prodVar, u => u.type, fitU),
  parabola: withOffsets(U, u => u.parVar, u => u.type, fitU), thermal: withOffsets(U, u => predT2(u, Pm), u => u.type, fitU)});

// power check: leave-one-track-out on tuning (stricter than leave-one-event-out: both seasons of a track are left out)
function looGains(U, Ucomp, which) {
  const tracks = [...new Set([...A, ...B].map(u => u.track))], gains = {production: [], constant: []};
  for (const t of tracks) {
    const Ain = A.filter(u => u.track !== t), Bin = B.filter(u => u.track !== t), test = U.filter(u => u.track === t);
    if (!test.length) continue;
    const Pm = paramsOf(fit(Ain, Bin, F.x, 1, 5).x), fitU = U.filter(u => u.track !== t);
    const e = which === 1 ? errsT1([...test], fitU, Pm) : errsT2([...test], fitU, Pm);
    for (const b of ['production', 'constant']) gains[b].push(mean(e[b].map(x => x * x)) - mean(e.thermal.map(x => x * x)));
  }
  return gains;
}
const holdTracks = new Set(Object.keys(lapsimTracks).length ? (() => { const s = new Set(); for (const y of HOLD) { const d = clone(y); for (const ev of readdirSync(d).filter(e => /Grand Prix$/.test(e))) if (lapsimTracks[tiTrack(ev, y)]) s.add(tiTrack(ev, y)); } return s; })() : []);
const nHold = holdTracks.size;
const power = {};
for (const [name, U, which, m] of [['T1b', A, 1, 2], ['T2', B, 2, 1]]) {
  const g = looGains(U, null, which), eT = which === 1 ? errsT1(U, U, P) : errsT2(U, U, P);
  const useful = 2 * rmsOf(eT.production) * 0.02;
  power[name] = {m, nHoldTracks: nHold, usefulGainPp2: r4(useful), loo: {}};
  for (const b of ['production', 'constant']) power[name].loo[b] = {meanGain: r4(mean(g[b])), sd: r4(sd(g[b])), mde: r4(mde(sd(g[b]), nHold)), n: g[b].length};
  power[name].judgeable = Math.max(power[name].loo.production.mde, power[name].loo.constant.mde) <= useful;
  console.log(name, JSON.stringify(power[name]));
}
const tuning = {T1b: judge('T1b', A, errsT1(A, A, P), 2), T2: judge('T2', B, errsT2(B, B, P), 1)};

// bootstrap intervals over tuning events (refit, one sweep from the full fit)
const evKey = u => u.year + '|' + u.track, evs = [...new Set([...A, ...B].map(evKey))], boots = [];
let seed = 11; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
for (let r = 0; r < (+process.env.LAPSIM_TT_BOOT || 30); r++) {
  const pick = Array.from({length: evs.length}, () => evs[Math.floor(rnd() * evs.length)]);
  const As = pick.flatMap(e => A.filter(u => evKey(u) === e)), Bs = pick.flatMap(e => B.filter(u => evKey(u) === e));
  if (As.length && Bs.length) boots.push(fit(As, Bs, F.x, 1, 5).x);
}
const intervals = {};
for (const k of Object.keys(SPACE)) {
  const v = boots.map(b => b[k]).sort((a, b) => a - b), lo = v[Math.floor(0.05 * v.length)], hi = v[Math.ceil(0.95 * v.length) - 1];
  const [a, b] = SPACE[k], eps = 1e-6 * (b - a), atBound = lo <= a + eps || hi >= b - eps || F.x[k] <= a + eps || F.x[k] >= b - eps;
  intervals[k] = {value: r4(F.x[k]), ci90: [r4(lo), r4(hi)], identified: !atBound && (hi - lo) < 0.8 * (b - a), note: atBound ? 'at a search bound' : undefined};
}


// ---------- reported targets (not deciding) ----------
// T3 stint drift: practice runs of >= 6 valid laps within 4 % of the run median after the out-lap; slope of laps 3..end
function t3Units(sessions) {
  const units = {};
  for (const S of sessions.filter(s => /Practice/.test(s.ses))) for (const laps of Object.values(S.drivers)) {
    for (let i = 0; i < laps.length; i++) {
      if (!laps[i].out) continue;
      const run = []; let j = i + 1;
      while (j < laps.length && laps[j].stint === laps[i].stint && !laps[j].out && laps[j].ok && laps[j].time && !laps[j].inl && laps[j].fam) run.push(laps[j++]);
      if (run.length < 6) continue;
      const med = median(run.map(l => l.time)); if (run.some(l => Math.abs(l.time / med - 1) > 0.04)) continue;
      const T = trackInfo(S.track, S.year), pts = run.slice(2).map((l, k) => [k, 100 * (l.time / med - 1) + 100 * (k * T.burn * T.perKg) / med - 100 * rubber(S.ses, l.min)]);
      const mx = mean(pts.map(p => p[0])), my = mean(pts.map(p => p[1]));
      const y = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
      const k = `${S.year}|${S.track}|${run[0].fam}`;
      (units[k] ||= {year: S.year, track: S.track, fam: run[0].fam, runs: []}).runs.push({y, n: run.length, rOut: laps[i].time ? Math.min(0.9, Math.max(0.4, med / laps[i].time)) : 0.6, rPush: Math.min(1, run.reduce((a, l) => Math.min(a, l.time), Infinity) / med), tt: run[0].tt, ta: run[0].ta});
    }
  }
  return Object.values(units).filter(u => u.runs.length >= 2 && u.runs.every(r => Number.isFinite(r.tt) && Number.isFinite(r.ta))).map(u => ({...u, y: mean(u.runs.map(r => r.y))}));
}
function predT3(u, P) {
  const T = trackInfo(u.track, u.year), eta = etaFor(T, P);
  return mean(u.runs.map(r => {
    const s = runSequence(T.loads, [{r: r.rOut}, ...Array(r.n).fill({r: q(r.rPush, 0.01)})], {trackC: q(r.tt, 1), airC: q(r.ta, 1), eta, fam: u.fam}, P).slice(3);
    const pts = s.map((o, k) => [k, 100 * T.Sg * (o.grip - s[0].grip)]), mx = mean(pts.map(p => p[0])), my = mean(pts.map(p => p[1]));
    return pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  }));
}
// T4 pole sensitivity: pole change between consecutive seasons at a track, minus that season pair's mean change
function poles(sessions) {
  const o = {};
  for (const S of sessions.filter(s => s.ses === 'Qualifying')) {
    let best = null;
    for (const laps of Object.values(S.drivers)) for (const l of laps) if (l.ok && l.time && !l.out && !l.inl && (!best || l.time < best.time)) best = l;
    if (best && Number.isFinite(best.tt) && Number.isFinite(best.ta)) o[`${S.year}|${S.track}`] = {year: S.year, track: S.track, time: best.time, w: {trackTempC: best.tt, airTempC: best.ta, pressureHpa: best.p, humidityPct: best.h}};
  }
  return o;
}
function t4(pol, pairs, P) {
  const rows = [];
  for (const [y1, y2] of pairs) for (const a of Object.values(pol).filter(p => p.year === y1)) {
    const b = pol[`${y2}|${a.track}`]; if (!b) continue;
    const T = trackInfo(a.track, 2025), eta = etaFor(T, P), g = w => runSequence(T.loads, [{r: 0.65}, {r: 1}], {trackC: w.trackTempC, airC: w.airTempC, eta, fam: 'S'}, P)[1].grip;
    rows.push({pair: `${y1}-${y2}`, track: a.track, y: 100 * (b.time / a.time - 1), prod: 100 * (T.lapAt(b.w) / T.lapAt(a.w) - 1),
      thermal: 100 * (T.lapAt(b.w, 1) / T.lapAt(a.w, 1) - 1) + 100 * T.Sg * (g(b.w) - g(a.w))});
  }
  const out = {};
  for (const [pair, rs] of Object.entries(Object.groupBy(rows, r => r.pair))) {
    const c = k => { const m = mean(rs.map(r => r[k])); return rs.map(r => r[k] - m); };
    const y = c('y'), e = {constant: y, production: y.map((v, i) => v - c('prod')[i]), thermal: y.map((v, i) => v - c('thermal')[i])};
    out[pair] = {n: rs.length, rms: Object.fromEntries(Object.entries(e).map(([k, v]) => [k, r4(rmsOf(v))]))};
  }
  return out;
}
// 7b check: F1 production held-out rows, error + (thermal − production) lap change under each row's weather; air-temperature slope
async function slopeCheck(P) {
  const {lapsimCalibration: C} = await import('../../worker/lapsim/calibration-data.js'), {rowsOf, slope} = await import('./condition-report.mjs');
  const rows = rowsOf(C).filter(r => r.group.startsWith('f1') && r.w && Number.isFinite(r.w.airTempC) && Number.isFinite(r.w.trackTempC));
  const ref = {trackTempC: P.ref.trackC, airTempC: P.ref.airC};
  const out = rows.map(r => {
    const T = trackInfo(r.track, +r.group.split(' ')[1]), eta = etaFor(T, P);
    const g = w => runSequence(T.loads, [{r: 0.65}, {r: 1}], {trackC: w.trackTempC, airC: w.airTempC, eta, fam: 'S'}, P)[1].grip;
    const d = 100 * T.Sg * (g(r.w) / g(ref) - K.gripFromTrackTemp(r.w.trackTempC));
    return {...r, errNew: r.errPct + d};
  });
  const b0 = slope(out.map(r => r.w.airTempC), out.map(r => r.errPct)), b1 = slope(out.map(r => r.w.airTempC), out.map(r => r.errNew));
  const f = s => ({n: s.n, slope: r4(s.b), ci90: s.ci90.map(r4), r2: r4(s.r2)});
  return {note: 'no refit (track factors fixed): indicative only; WEC rows not identified (no WEC tyre fit)', f1Production: f(b0), f1WithThermal: f(b1)};
}
const C3 = t3Units(tuneS), e3 = withOffsets(C3, u => predT3(u, P), u => u.fam), e3c = withOffsets(C3, () => 0, u => u.fam);
const reported = {T3tuning: {units: C3.length, rms: {constant: r4(rmsOf(e3c)), production: r4(rmsOf(e3c)), thermal: r4(rmsOf(e3))}, meanSlopeMeasured: r4(mean(C3.map(u => u.y))), meanSlopeThermal: r4(mean(C3.map(u => predT3(u, P))))},
  T4tuning: t4(poles(tuneS), [[2023, 2024]], P), slope7b: await slopeCheck(P)};
console.log('reported', JSON.stringify(reported));

// hold-out, only targets that passed the power check
const holdout = {};
if (OPEN_HOLDOUT) {
  const hS = loadSessions(HOLD), HA = t1bUnits(hS), HB = t2Units(hS);
  if (power.T1b.judgeable) holdout.T1b = judge('T1b', HA, errsT1(HA, A, P), 2); else holdout.T1b = 'not judgeable at this n: not opened';
  if (power.T2.judgeable) holdout.T2 = judge('T2', HB, errsT2(HB, B, P), 1); else holdout.T2 = 'not judgeable at this n: not opened';
  const H3 = t3Units(hS), h3 = withOffsets(H3, u => predT3(u, P), u => u.fam, C3), h3c = withOffsets(H3, () => 0, u => u.fam, C3);
  reported.T3holdout = {units: H3.length, rms: {constant: r4(rmsOf(h3c)), production: r4(rmsOf(h3c)), thermal: r4(rmsOf(h3))}};
  reported.T4holdout = t4({...poles(tuneS), ...poles(hS.filter(s => s.year === 2025))}, [[2024, 2025]], P);
}

const report = {generatedAt: new Date().toISOString().slice(0, 10), prereg: 'claude/gate-tyre-thermal-7a-prereg-2026-11-23.md',
  counts: {tuneSessions: tuneS.length, T1bUnits: A.length, T1bRuns: A.reduce((s, u) => s + u.runs.length, 0), T2Units: B.length, nightT2: B.filter(u => u.night).length},
  fit: F.x, intervals, power, tuning, holdout, reported};
mkdirSync('scripts/sim/data/learn', {recursive: true});
writeFileSync('scripts/sim/data/learn/tyre-thermal-fit.json', JSON.stringify(report, (k, v) => k === 'raw' ? undefined : v, 1));
writeFileSync('worker/lapsim/tyre-thermal-data.js', `// Generated by scripts/sim/tyre-thermal-fit.mjs (${report.generatedAt}). Experiment values (step 7a); not used by the kernel.\n` +
  `// Effective values on the model's own temperature scale (steady reference push lap = 100 °C). identified: false = the 90 % interval covers most of its range or touches a search bound.\n` +
  `export const lapsimTyreThermal = ${JSON.stringify({fit: F.x, intervals, source: 'TracingInsights F1 laptimes 2023–24 (tuning)'}, null, 1)};\n`);
console.log(JSON.stringify({intervals, tuning, holdout, reported}, (k, v) => k === 'raw' ? undefined : v, 1));
console.log(`done in ${((Date.now() - t0) / 1e3).toFixed(0)} s`);
