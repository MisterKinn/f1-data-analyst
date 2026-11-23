// Step 2a (2026-11-23, pre-registration claude/gate-cda-measured-prereg-2026-11-23.md): F1 wheel power P(v) and drag per track
// measured from qualifying telemetry, so the fit stops fitting what can be measured (physics rule 3.1). Power balance on every
// full-throttle sample:  v·(m_eff·a + c_roll·N + m·g·sinθ) = P_b(v) − ½ρ(v − w∥)²·v·(CdA_t + ΔCdA_t·DRS)
// P_b: wheel power per speed band, shared by the tracks of a season; CdA_t, ΔCdA_t: per track (the wing level each event gets).
// Errors: stat (leave-one-track-out jackknife; per-track CdA leave-one-driver-out) and sys (each assumption moved) in separate columns.
// 2026 is not measured (350 kW MGU-K taper, clipping, energy limits, no Straight Mode channel): declared before the run.
// In: TracingInsights season repos with Qualifying laptimes.json (sparse clone, LAPSIM_TI_DIR, default .cache/ti), lap telemetry from
// raw.githubusercontent (cached in LAPSIM_TI_TEL, default .cache/ti-tel). Measured data is only read.
// Out: worker/lapsim/car-measured-data.js. Run: node scripts/sim/measure-car.mjs [--json probe-out/measure-car.json]
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {trackFromData} from '../../worker/lapsim/tracks.js';
import {conditionsFromWeather, tailwind, icePowerFactor} from '../../worker/lapsim/atmosphere.js';
import {PRIOR} from '../../worker/lapsim/cars.js';
import {tiTrack} from './ti-races.mjs';

const G = 9.81, ROOT = process.env.LAPSIM_TI_DIR || '.cache/ti', CACHE = process.env.LAPSIM_TI_TEL || '.cache/ti-tel';
const YEARS = ['2023', '2024', '2025'];
const MIN_MASS = {2023: 798, 2024: 798, 2025: 800}, FUEL = 10; // FIA Technical Regulations C4.1 minimum mass + qualifying fuel
const BANDS = [[180, 240], [240, 270], [270, 300], [300, 340]];
const num = x => x === 'None' || x == null ? NaN : +x;
const sum = a => a.reduce((s, x) => s + x, 0), mean = a => sum(a) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / Math.max(1, a.length - 1)); };

// 1. laps: each driver's fastest timed dry Qualifying lap (not deleted, no pit in / out); a session with >= 10 % rain laps is dropped
export function picks(root = ROOT) {
  const out = [];
  for (const y of YEARS) {
    const dir = join(root, y); if (!existsSync(dir)) continue;
    for (const ev of readdirSync(dir).filter(e => /Grand Prix$/.test(e)).sort()) {
      const q = join(dir, ev, 'Qualifying'); if (!existsSync(q)) continue;
      const track = tiTrack(ev, +y); if (!lapsimTracks[track]) continue;
      let n = 0, wet = 0; const laps = [];
      for (const drv of readdirSync(q).filter(x => /^[A-Z]{3}$/.test(x))) {
        const f = join(q, drv, 'laptimes.json'); if (!existsSync(f)) continue;
        const L = JSON.parse(readFileSync(f, 'utf8')); let best = null;
        for (let i = 0; i < L.time.length; i++) {
          n++; if (L.wR?.[i] === true) wet++;
          const t = num(L.time[i]);
          if (!Number.isFinite(t) || L.del?.[i] === true || L.pin?.[i] !== 'None' || L.pout?.[i] !== 'None' || L.wR?.[i] === true) continue;
          if (!best || t < best.time) best = {year: y, ev, track, drv, lap: L.lap[i], time: t,
            w: {airTempC: num(L.wAT?.[i]), humidityPct: num(L.wH?.[i]), pressureHpa: num(L.wP?.[i]), windSpeed: num(L.wWS?.[i]), windFromDeg: num(L.wWD?.[i])}};
        }
        if (best) laps.push(best);
      }
      if (n && wet / n < 0.1) out.push(...laps);
    }
  }
  return out;
}
const telPath = p => join(CACHE, p.year, `${p.ev}_${p.drv}_${p.lap}.json`.replace(/ /g, '_'));
async function fetchAll(laps, par = 12) {
  const run = promisify(execFile), todo = laps.filter(p => !existsSync(telPath(p)));
  let k = 0;
  await Promise.all(Array.from({length: par}, async () => { while (k < todo.length) { const p = todo[k++];
    const url = `https://raw.githubusercontent.com/TracingInsights/${p.year}/main/${[p.ev, 'Qualifying', p.drv, p.lap + '_tel.json'].map(encodeURIComponent).join('/')}`;
    try { const {stdout} = await run('curl', ['-sSf', '--retry', '2', '--max-time', '60', url], {maxBuffer: 1 << 26}); mkdirSync(dirname(telPath(p)), {recursive: true}); writeFileSync(telPath(p), stdout); } catch { /* 404: no telemetry */ } } }));
}
const readTel = p => { if (!existsSync(telPath(p))) return null; try { const r = JSON.parse(readFileSync(telPath(p), 'utf8')); return r.tel || r; } catch { return null; } };

// 2. broken telemetry (AGENTS.md; claude/ti-frozen-scan-2025-2026 detectors C and D) and impossible throttle, ± 1 sample
export function frozenMask(T) {
  const n = T.speed.length, bad = new Uint8Array(n), same = i => T.speed[i] === T.speed[i - 1] && T.rpm[i] === T.rpm[i - 1];
  const all5 = i => same(i) && T.gear[i] === T.gear[i - 1] && T.throttle[i] === T.throttle[i - 1] && T.brake[i] === T.brake[i - 1];
  const mark = (a, b) => { for (let k = Math.max(0, a - 1); k <= Math.min(n - 1, b + 1); k++) bad[k] = 1; };
  for (let i = 1; i < n;) { if (!same(i)) { i++; continue; } let j = i; while (j + 1 < n && same(j + 1)) j++; if (j - i + 2 >= 4) mark(i - 1, j); i = j + 1; }
  for (let i = 1; i < n;) { if (!all5(i)) { i++; continue; } let j = i; while (j + 1 < n && all5(j + 1)) j++; if (+T.time[j] - +T.time[i - 1] >= 1.5 && +T.speed[i - 1] >= 5) mark(i - 1, j); i = j + 1; }
  for (let i = 0; i < n; i++) if (+T.throttle[i] > 100) bad[i] = 1;
  return bad;
}
// slope of a local linear fit of speed on time over ± w s (unmasked samples): the acceleration
export function accel(t, v, i, w, bad) {
  let n = 0, st = 0, sv = 0, stt = 0, stv = 0;
  const add = k => { if (bad[k]) return; n++; st += t[k]; sv += v[k]; stt += t[k] * t[k]; stv += t[k] * v[k]; };
  for (let k = i; k >= 0 && t[i] - t[k] <= w; k--) add(k);
  for (let k = i + 1; k < t.length && t[k] - t[i] <= w; k++) add(k);
  const d = n * stt - st * st; return n >= 4 && d > 1e-9 ? (n * stv - st * sv) / d : NaN;
}
// linear least squares by normal equations (Gauss-Jordan with pivoting); null if singular
export function lsq(X, y) {
  const p = X[0].length, A = Array.from({length: p}, () => new Float64Array(p + 1));
  for (let r = 0; r < y.length; r++) { const x = X[r]; for (let a = 0; a < p; a++) { if (!x[a]) continue; A[a][p] += x[a] * y[r]; for (let b = 0; b < p; b++) A[a][b] += x[a] * x[b]; } }
  for (let c = 0; c < p; c++) { let m = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]];
    if (Math.abs(A[c][c]) < 1e-9) return null; for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c] / A[c][c]; if (f) for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k]; } }
  return A.map((row, i) => row[p] / row[i]);
}

// 3. full-throttle samples of one lap: y = v·(m_eff·a + roll + grade) (W at the wheel), x = ½ρ·va²·v (W per m² of CdA)
const TRK = new Map(), trk = id => TRK.get(id) || TRK.set(id, trackFromData(lapsimTracks[id])).get(id);
export function samples(p, T, o) {
  const tr = trk(p.track), nK = tr.kappa.length, Lk = nK * tr.ds, car = PRIOR[p.year], bad = frozenMask(T);
  let n = T.speed.length; if (bad.reduce((a, b) => a + b, 0) > n / 2) return [];
  let t = T.time.map(Number), v = T.speed.map(x => +x / 3.6 * o.speedScale), ix = t.map((_, i) => i);
  if (o.thin) ix = ix.filter(i => i % 2 === 0); // sampling-rate row: every second sample dropped
  const pick = a => ix.map(i => a[i]); t = pick(t); v = pick(v);
  const thr = pick(T.throttle).map(Number), brk = pick(T.brake).map(x => +x > 0 || x === true), gear = pick(T.gear).map(Number), rpm = pick(T.rpm).map(Number), drs = pick(T.drs).map(Number), bd = pick(bad);
  n = t.length;
  const s = new Float64Array(n); for (let i = 1; i < n; i++) s[i] = s[i - 1] + 0.5 * (v[i] + v[i - 1]) * (t[i] - t[i - 1]); // distance from integrated speed
  const at = (arr, i) => arr ? arr[((Math.round(s[i] / s[n - 1] * Lk / tr.ds) % nK) + nK) % nK] : 0;
  const env = conditionsFromWeather(p.w), rho = env.rho, m = MIN_MASS[p.year] + FUEL + o.dMass, mEff = m * o.inertia;
  const wind = o.wind && Number.isFinite(p.w.windSpeed) && Number.isFinite(p.w.windFromDeg) && tr.heading;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (bd[i] || v[i] < 180 / 3.6 || v[i] > 340 / 3.6 || gear[i] < 6 || rpm[i] < 10000) continue;
    let ok = true;
    for (let k = i; k >= 0 && t[i] - t[k] <= 0.5 && ok; k--) if (thr[k] < 99 || brk[k] || bd[k]) ok = false;
    for (let k = i; k < n && t[k] - t[i] <= 0.5 && ok; k++) if (thr[k] < 99 || brk[k] || bd[k]) ok = false;
    if (!ok || v[i] ** 2 * Math.abs(at(tr.kappa, i)) > 6) continue;
    const a = accel(t, v, i, o.win, bd); if (!Number.isFinite(a)) continue;
    const va = Math.max(0, v[i] - (wind ? tailwind(at(tr.heading, i), p.w.windSpeed, p.w.windFromDeg) : 0));
    const N = m * G + 0.5 * rho * car.clA * va * va, sinG = o.grade && tr.grade ? Math.sin(at(tr.grade, i)) : 0;
    const y = v[i] * (mEff * a + car.cRoll * N + m * G * sinG), x = 0.5 * rho * va * va * v[i];
    if (Number.isFinite(y) && Number.isFinite(x)) out.push({track: p.track, drv: p.drv, v: v[i], y, x, drs: drs[i] === 1 || drs[i] >= 10 ? 1 : 0, iceF: icePowerFactor(rho)});
  }
  return out;
}

// 4. fits. Season model: P per band (shared) + CdA_t, ΔCdA_t per track. Constant-P model: one P + per-track drag.
const bandOf = v => BANDS.findIndex(([a, b]) => v * 3.6 >= a && v * 3.6 < b);
export function fitSeason(S, {bands = true} = {}) {
  const tracks = [...new Set(S.map(q => q.track))].sort(), nb = bands ? BANDS.length : 1, p = nb + 2 * tracks.length;
  const ti = Object.fromEntries(tracks.map((t, i) => [t, i]));
  const X = [], y = [];
  for (const q of S) { const r = new Array(p).fill(0), b = bands ? bandOf(q.v) : 0; if (b < 0) continue; r[b] = 1; r[nb + 2 * ti[q.track]] = -q.x; r[nb + 2 * ti[q.track] + 1] = -q.x * q.drs; X.push(r); y.push(q.y); }
  const c = lsq(X, y); if (!c) return null;
  const cdA = Object.fromEntries(tracks.map(t => [t, {cdA: c[nb + 2 * ti[t]], cdALow: c[nb + 2 * ti[t]] + c[nb + 2 * ti[t] + 1]}]));
  return {P: c.slice(0, nb), cdA};
}
// per-track drag with P fixed (W): y − P = −x·(CdA + ΔCdA·DRS)
export function fitTrackDrag(S, P) {
  const c = lsq(S.map(q => [-q.x, -q.x * q.drs]), S.map(q => q.y - P)); return c ? {cdA: c[0], cdALow: c[0] + c[1]} : null;
}
const jackknife = (units, f) => { const xs = units.map(f).filter(Number.isFinite), m = mean(xs); return xs.length > 1 ? Math.sqrt((xs.length - 1) / xs.length * sum(xs.map(x => (x - m) ** 2))) : NaN; };

// everything one option set gives, per season
export function measure(laps, telOf, o) {
  const res = {};
  for (const y of YEARS) {
    const S = laps.filter(p => p.year === y).flatMap(p => { const T = telOf(p); return T ? samples(p, T, o) : []; });
    if (S.length < 500) continue;
    const tracks = [...new Set(S.map(q => q.track))].sort(), car = PRIOR[y];
    const band = fitSeason(S), flat = fitSeason(S, {bands: false}), P0 = flat.P[0];
    const nBand = BANDS.map((_, b) => S.filter(q => bandOf(q.v) === b).length);
    const perTrack = {}, iceF = mean(S.map(q => q.iceF));
    for (const t of tracks) {
      const St = S.filter(q => q.track === t), d = fitTrackDrag(St, P0), drv = [...new Set(St.map(q => q.drv))];
      const own = fitSeason(St, {bands: false}); // track alone: P, CdA, ΔCdA (consistency of P across tracks)
      perTrack[t] = {n: St.length, drivers: drv.length, cdA: d.cdA, cdALow: d.cdALow, statDrv: jackknife(drv, x => fitTrackDrag(St.filter(q => q.drv !== x), P0)?.cdA),
        statDrvLow: jackknife(drv, x => fitTrackDrag(St.filter(q => q.drv !== x), P0)?.cdALow), pOwn: own?.P[0]};
    }
    const cds = tracks.map(t => perTrack[t].cdA), lows = tracks.map(t => perTrack[t].cdALow);
    res[y] = {n: S.length, nBand, tracks, P0, Pband: band.P, perTrack, iceF, car,
      cdAMean: mean(cds), cdASd: sd(cds), drsRatio: sum(lows) / sum(cds),
      // kernel pIce (W) under the two ERS assumptions of the split row: 120 kW deploying everywhere, or none (kernel above its cut-off)
      pIce120: P0 / car.etaDrive / iceF - car.ers.pMax * car.etaErs / iceF, pIce0: P0 / car.etaDrive / iceF,
      jackP: S, jackTracks: tracks};
  }
  return res;
}

const BASE = {speedScale: 1, dMass: 0, inertia: 1.06, win: 0.4, wind: true, grade: true, thin: false};
const SYS = {mass: [{dMass: -10}, {dMass: 10}], inertia: [{inertia: 1.04}, {inertia: 1.08}], window: [{win: 0.3}, {win: 0.5}], rate: [{thin: true}],
  speedBias: [{speedScale: 0.99}, {speedScale: 1.01}], wind: [{wind: false}], grade: [{grade: false}]};
const shift = (base, alts, get) => { const xs = alts.map(get); if (!xs.every(Number.isFinite)) return NaN; return alts.length === 2 ? Math.abs(xs[1] - xs[0]) / 2 : Math.abs(xs[0] - get(base)); };
const quad = o => Math.sqrt(sum(Object.values(o).filter(Number.isFinite).map(x => x * x)));
const r4 = x => Number.isFinite(x) ? +(+x).toPrecision(4) : null;

if (import.meta.url === `file://${process.argv[1]}`) {
  const laps = picks();
  await fetchAll(laps);
  const cache = new Map(), telOf = p => cache.has(p) ? cache.get(p) : cache.set(p, readTel(p)).get(p);
  console.log(`${laps.length} laps picked, ${laps.filter(telOf).length} with telemetry`);
  const base = measure(laps, telOf, BASE), sys = {};
  for (const [k, alts] of Object.entries(SYS)) sys[k] = alts.map(a => measure(laps, telOf, {...BASE, ...a}));
  const out = {};
  for (const [y, b] of Object.entries(base)) {
    // stat of pooled quantities: leave one track out
    const S = b.jackP, loo = b.tracks.map(t => { const s = S.filter(q => q.track !== t), f = fitSeason(s), g = fitSeason(s, {bands: false}); return {f, g, tracksLeft: b.tracks.filter(x => x !== t)}; });
    const jk = get => { const xs = loo.map(get).filter(Number.isFinite), m = mean(xs); return Math.sqrt((xs.length - 1) / xs.length * sum(xs.map(x => (x - m) ** 2))); };
    const sysOf = get => Object.fromEntries(Object.entries(SYS).map(([k, alts]) => [k, shift(b, sys[k].map(r => r[y]), r => r ? get(r) : NaN)]));
    const entry = (value, stat, sy) => { const st = quad(sy); return {value: r4(value), stat: r4(stat), sys: Object.fromEntries(Object.entries(sy).map(([k, v]) => [k, r4(v)])), sysTotal: r4(st), total: r4(Math.hypot(stat, st))}; };
    const P = entry(b.P0, jk(l => l.g.P[0]), sysOf(r => r.P0));
    const bands = BANDS.map((bb, i) => ({kph: bb, n: b.nBand[i], enough: b.nBand[i] >= 300, ...entry(b.Pband[i], jk(l => l.f.P[i]), sysOf(r => r.Pband[i]))}));
    // flat P(v): every band with enough data inside the pooled P ± (band total ⊕ pooled total)
    const flat = bands.filter(x => x.enough).every(x => Math.abs(x.value - P.value) <= Math.hypot(x.total, P.total));
    const insideP = Object.values(b.perTrack).filter(t => Number.isFinite(t.pOwn)).map(t => Math.abs(t.pOwn - b.P0) <= P.total);
    const cdA = entry(b.cdAMean, jk(l => mean(l.tracksLeft.map(t => fitTrackDrag(S.filter(q => q.track === t), l.g.P[0]).cdA))), sysOf(r => r.cdAMean));
    const drs = entry(b.drsRatio, jk(l => { const c = l.tracksLeft.map(t => fitTrackDrag(S.filter(q => q.track === t), l.g.P[0])); return sum(c.map(x => x.cdALow)) / sum(c.map(x => x.cdA)); }), sysOf(r => r.drsRatio));
    const split = Math.abs(b.pIce120 - b.pIce0) / 2;
    const pIce = entry((b.pIce120 + b.pIce0) / 2, P.stat / b.car.etaDrive / b.iceF, {...Object.fromEntries(Object.entries(P.sys).map(([k, v]) => [k, v / b.car.etaDrive / b.iceF])), ersSplit: split});
    const tracks = {};
    for (const t of b.tracks) {
      const pt = b.perTrack[t], dP = P.stat, S_t = S.filter(q => q.track === t);
      const pStatCd = Math.abs(fitTrackDrag(S_t, b.P0 + dP).cdA - fitTrackDrag(S_t, b.P0 - dP).cdA) / 2, pStatLow = Math.abs(fitTrackDrag(S_t, b.P0 + dP).cdALow - fitTrackDrag(S_t, b.P0 - dP).cdALow) / 2;
      const c = entry(pt.cdA, Math.hypot(pt.statDrv || 0, pStatCd), sysOf(r => r.perTrack[t]?.cdA)), lo = entry(pt.cdALow, Math.hypot(pt.statDrvLow || 0, pStatLow), sysOf(r => r.perTrack[t]?.cdALow));
      tracks[t] = {n: pt.n, drivers: pt.drivers, cdA: c, cdALow: lo, pOwnKW: r4(pt.pOwn / 1e3)};
    }
    const insideCd = b.tracks.filter(t => Math.abs(b.perTrack[t].cdA - b.cdAMean) <= cdA.total).length / b.tracks.length;
    out[y] = {samples: b.n, tracks: b.tracks.length, pWheel: P, pWheelInsideShare: r4(mean(insideP.map(Number))), pBands: bands, flatPv: flat,
      pIce: {...pIce, identified: false, note: 'kernel pIce from P_wheel: midpoint of the two ERS assumptions (120 kW deploying at every full-throttle point, or 0 kW above the kernel cut-off); ersSplit row = half their difference. The ICE / ERS split is not identified by speed data.'},
      cdA: {...cdA, sdAcrossTracks: r4(b.cdASd), insideShare: r4(insideCd), perTrackOnly: insideCd < 0.68}, drsRatio: drs, perTrack: tracks};
  }
  // fit-flag inputs (LAPSIM_CDA_MEASURED): per-track drag ratio = mean over measured seasons of CdA_t,y / CdA_y, with its season spread
  const ids = [...new Set(Object.values(out).flatMap(s => Object.keys(s.perTrack)))].sort();
  const dragRatio = Object.fromEntries(ids.map(id => { const r = Object.values(out).filter(s => s.perTrack[id]).map(s => s.perTrack[id].cdA.value / s.cdA.value);
    return [id, {ratio: r4(mean(r)), seasons: r.length, spread: r.length > 1 ? r4(sd(r)) : null}]; }));
  const note = 'F1 wheel power and per-track drag measured from TracingInsights qualifying telemetry 2023-25 (each driver\'s best dry lap, broken samples masked), scripts/sim/measure-car.mjs; pre-registration claude/gate-cda-measured-prereg-2026-11-23.md. Evidence layer 3 (Newton on measured speed). value ± stat (track jackknife; per track: driver jackknife + pooled P) ± sys (columns). pWheel is power at the wheels (W). 2026 not measured. Used only with LAPSIM_CDA_MEASURED=on.';
  writeFileSync('worker/lapsim/car-measured-data.js', `// Generated by scripts/sim/measure-car.mjs. Do not edit by hand.\nexport const lapsimCarMeasured = ${JSON.stringify({note, seasons: out, dragRatio})};\n`);
  const jo = process.argv.indexOf('--json'); if (jo > 0) { mkdirSync(dirname(process.argv[jo + 1]), {recursive: true}); writeFileSync(process.argv[jo + 1], JSON.stringify({seasons: out, dragRatio}, null, 1)); }
  for (const [y, s] of Object.entries(out)) console.log(y, `n ${s.samples}, ${s.tracks} tracks | P_wheel ${(s.pWheel.value / 1e3).toFixed(1)} ± ${(s.pWheel.stat / 1e3).toFixed(1)} ± ${(s.pWheel.sysTotal / 1e3).toFixed(1)} kW, inside ${s.pWheelInsideShare}`,
    `| bands ${s.pBands.map(x => `${x.kph[0]}-${x.kph[1]}: ${(x.value / 1e3).toFixed(0)}±${(x.total / 1e3).toFixed(0)} (n ${x.n})`).join(', ')} flat ${s.flatPv}`,
    `| pIce ${(s.pIce.value / 1e3).toFixed(0)} ± ${(s.pIce.total / 1e3).toFixed(0)} kW | CdA ${s.cdA.value} ± ${s.cdA.total} (SD tracks ${s.cdA.sdAcrossTracks}, inside ${s.cdA.insideShare}) | DRS ratio ${s.drsRatio.value} ± ${s.drsRatio.total}`);
}
