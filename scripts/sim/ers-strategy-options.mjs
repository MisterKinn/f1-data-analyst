// Step 10b-prep: the 2026 energy-strategy decision as options with numbers (no kernel edit).
// Pre-registration claude/gate-ers-law-prereg-2026-11-23.md (§9). Step 1's exact accounting means the cut-off / super-clipping search
// never starts on causal 2026 laps (claude/status-2026-11-23-step1.md). Options for the search entry on causal 2026 laps:
//   A  never search (today with kernel step 2; step 1 enters only through its ~1 kJ rounding),
//   B  always search (cut-off, then the super-clipping plan; the faster legal plan is kept),
//   C  search only when the battery binds (the causal pass ran out of charge somewhere on the lap).
// Owner decision 2026-11-23 19:03: option B (C = B on all 21 events), now in kernel.js for cars with car.ers.law = 'b' (K = B there).
// Method: a copy of worker/lapsim/kernel.js is written to a temporary folder with only the search condition replaced (and a flag set
// where the battery limits deploy); the repository kernel is not touched. Each event: production 2026 car (carsFor), track grip, real
// session weather, FIA qualifying recharge limit and event PU ramp, with and without the ERS law hook (worker/lapsim/ers-law.js).
// Usage: node scripts/sim/ers-strategy-options.mjs [out.json]   (≈ 1–3 min)
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {lapsimAllTracks} from '../../worker/lapsim/tracks.js';
import {carsFor, realConditions} from '../../worker/lapsim/scenario.js';
import {withZones, puRampOf, PU_RAMP} from '../../worker/lapsim/zones.js';
import {rechargeLimitMJ} from '../../worker/lapsim/energy-limits.js';
import {lapsimPuDocs} from '../../worker/lapsim/pu-docs-data.js';
import {withErsLaw} from '../../worker/lapsim/ers-law.js';

const SRC = new URL('../../worker/lapsim/kernel.js', import.meta.url);
const ENTRY = 'if ((ers.pMax || ers.rule === \'hypercar\') && ((causal && lawB) || acc.eDeploy > budget(acc.eRegen) + (STEP === 2 ? 1 : 0))) {';
const BIND1 = 'if (use < ersUsed[i] * dt) ersUsed[i] = use / dt;', BIND2 = 'if (dep > Math.max(0, soc)) {';
const once = (s, a, b) => { const k = s.split(a).length - 1; if (k !== 1) throw new Error(`anchor found ${k}×: ${a}`); return s.replace(a, b); };

// a kernel copy whose search entry on causal 2026 laps follows `option`; every other rule set keeps the kernel's own condition
export async function kernelFor(option) {
  let s = readFileSync(SRC, 'utf8');
  s = once(s, BIND1, 'if (use < ersUsed[i] * dt) { ersUsed[i] = use / dt; globalThis.__ersBind = true; }');
  s = once(s, BIND2, 'if (dep > Math.max(0, soc)) { globalThis.__ersBind = true;');
  const over = 'acc.eDeploy > budget(acc.eRegen) + (STEP === 2 ? 1 : 0)';
  const cond = { A: `causal ? false : ${over}`, B: `causal ? true : ${over}`, C: `causal ? !!globalThis.__ersBind : ${over}`, K: `(causal && lawB) || ${over}` }[option];
  // the flag is set by the forward passes before the search decision (first forward at no cut-off); it is reset before that pass
  s = once(s, 'let vCut = vMaxCar + 1, vH = Infinity, v = forward(vCut), acc = account(v);', 'globalThis.__ersBind = false; let vCut = vMaxCar + 1, vH = Infinity, v = forward(vCut), acc = account(v);');
  s = once(s, ENTRY, `if ((ers.pMax || ers.rule === 'hypercar') && (globalThis.__ersBindAtEntry = !!globalThis.__ersBind, ${cond})) {`);
  const f = join(mkdtempSync(join(tmpdir(), 'ers-opt-')), `kernel-${option}.mjs`);
  writeFileSync(f, s);
  return (await import(pathToFileURL(f).href)).lapsimKernel();
}

export function eventSetup(K, id) {
  const d = lapsimAllTracks[id], c = carsFor(id)['2026']; if (!d || !c) return null;
  const w = realConditions(id)?.['2026'] || {}, fw = Object.fromEntries(Object.entries(w).filter(([, v]) => Number.isFinite(v)));
  const env0 = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0, ...fw, rechargeMJ: rechargeLimitMJ(id, 2026) ?? undefined});
  const tr = withZones(K, d, K.trackFromData(d), c), track = {...tr, mu: Float64Array.from(tr.mu, m => m * (c.grip || 1))};
  const env = PU_RAMP ? {...env0, puRamp: puRampOf(d, id)} : env0;
  return {track, car: c.car, env};
}

const row = r => ({lap: +r.lapTime.toFixed(3), deployMJ: +(r.energy.deployJ / 1e6).toFixed(3), regenBrakeMJ: +((r.energy.regenJ - r.energy.throttleHarvestJ) / 1e6).toFixed(3),
  harvestMJ: +(r.energy.throttleHarvestJ / 1e6).toFixed(3), cutoffKph: r.energy.cutoffKph && +r.energy.cutoffKph.toFixed(1), clipFromKph: r.energy.clipFromKph && +r.energy.clipFromKph.toFixed(1),
  topKph: +r.vMaxKph.toFixed(1)});

export async function run({events = Object.keys(lapsimPuDocs.events), steps = [1, 2]} = {}) {
  const Ks = {}; for (const o of ['K', 'A', 'B', 'C']) Ks[o] = await kernelFor(o);
  const out = [];
  for (const id of events) for (const kernelStep of steps) for (const law of [false, true]) {
    const s = eventSetup(Ks.K, id); if (!s) { out.push({id, skipped: 'no 2026 car or track'}); continue; } // batteryBinds: option C's flag at the search decision
    const car = law ? withErsLaw(s.car, s.env) : s.car, r = {id, kernelStep, law};
    for (const o of ['K', 'A', 'B', 'C']) { const res = Ks[o].simulateLap(s.track, car, s.env, {kernelStep}); r[o] = row(res); if (o === 'C') r.batteryBinds = globalThis.__ersBindAtEntry; }
    out.push(r);
  }
  return out;
}

if (process.argv[1]?.endsWith('ers-strategy-options.mjs') && process.argv[2] !== '--checks') {
  const rows = await run(), f = process.argv[2] || 'ers-strategy-options.json';
  writeFileSync(f, JSON.stringify({generatedBy: 'scripts/sim/ers-strategy-options.mjs', prereg: 'claude/gate-ers-law-prereg-2026-11-23.md §9', rows}, null, 1) + '\n');
  for (const r of rows.filter(r => !r.skipped)) console.log([r.id, r.kernelStep, r.law ? 'law' : 'base', r.batteryBinds ? 'binds' : '-', ...['K', 'A', 'B', 'C'].map(o => `${o} ${r[o].lap.toFixed(3)}`)].join('  '));
}

// ---------- offline checks (step 10b-prep, prereg §9): energy ledger, clip onset vs telemetry, trap with 2a's measured CdA ----------
// Usage: node scripts/sim/ers-strategy-options.mjs --checks [out.json]
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;

// battery ledger of a 2026 lap from its per-point flow, replayed with the kernel's rules (start full, recharge limit, window cap):
// |Σ deploy − Σ accepted recovery + spill − ΔSOC| / Σ deploy; also the flow sums against the lap totals and the lowest charge
export function ledger(res) {
  const f = res.flow, n = f.dep.length, socMax = f.soc, recMax = f.recharge ?? Infinity;
  let soc = socMax, got = 0, spill = 0, minSoc = soc, dep = 0, recA = 0, brk = 0, thr = 0;
  for (let i = 0; i < n; i++) {
    const rec = Math.max(0, Math.min(f.thr[i] + f.brk[i], recMax - got)); got += rec; recA += rec; dep += f.dep[i]; brk += f.brk[i]; thr += f.thr[i];
    soc -= f.dep[i]; minSoc = Math.min(minSoc, soc); const s2 = soc + rec; spill += Math.max(0, s2 - socMax); soc = Math.min(socMax, s2);
  }
  return {deployMJ: dep / 1e6, recoveredMJ: recA / 1e6, spillMJ: spill / 1e6, minSocKJ: minSoc / 1e3, residualPct: 100 * Math.abs(dep - recA + spill - (socMax - soc)) / dep,
    flowVsTotalsJ: Math.max(Math.abs(dep - res.energy.deployJ), Math.abs(brk + thr - res.energy.regenJ)), overBudgetJ: res.energy.deployJ - res.energy.budgetJ};
}
// first point per power-limited run where the ERS-K gives < its limit − 50 kW or harvests at full throttle (10a's definition)
function kernelClips(K, res, car, ds) {
  const n = res.v.length, out = [];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, dt = (j ? res.time[j] : res.lapTime) - res.time[i];
    const pDep = res.flow.dep[i] / dt, lim = K.erskLimitW('f1-2026', res.v[i], car.ers.pMax, false);
    out.push({frac: i / n, clip: res.limit[i] === 2 && res.v[j] > res.v[i] && (pDep < lim - 50e3 || res.flow.thr[i] > 0)}); }
  return out;
}

export async function checks() {
  const {gunzipSync} = await import('node:zlib'), {lapsimF1RealTel} = await import('../../worker/lapsim/f1-real-telemetry-data.js');
  const {lapsimCarMeasured: CM} = await import('../../worker/lapsim/car-measured-data.js'), {lapsimCalibration: CAL} = await import('../../worker/lapsim/calibration-data.js');
  const ev = JSON.parse(gunzipSync(readFileSync(new URL('./data/learn/ers-evidence.json.gz', import.meta.url))));
  const Ks = {}; for (const o of ['K', 'A', 'B']) Ks[o] = await kernelFor(o);
  const cfg = [['production (kernel 1, no law)', 'K', 1, false], ['law, kernel 1, A', 'A', 1, true], ['law, kernel 1, B', 'B', 1, true],
    ['law, kernel 2, A', 'A', 2, true], ['law, kernel 2, B', 'B', 2, true]];
  const out = {ledger: {}, clip: {}, trap: {}};
  const laps = {}; // cfg × track → {res, car, ds}
  for (const id of Object.keys(lapsimPuDocs.events)) { const s = eventSetup(Ks.K, id); if (!s) continue;
    for (const [name, o, ks, law] of cfg) { const car = law ? withErsLaw(s.car, s.env) : s.car; (laps[name] ||= {})[id] = {res: Ks[o].simulateLap(s.track, car, s.env, {kernelStep: ks}), car, ds: s.track.ds}; } }
  // 1. ledger, 2026 (every event, every configuration)
  for (const [name] of cfg) { const L = Object.entries(laps[name]).map(([id, x]) => ({id, ...ledger(x.res)}));
    out.ledger[name] = {maxResidualPct: Math.max(...L.map(x => x.residualPct)), maxFlowVsTotalsJ: Math.max(...L.map(x => x.flowVsTotalsJ)), maxOverBudgetJ: Math.max(...L.map(x => x.overBudgetJ)),
      minSocKJ: Math.min(...L.map(x => x.minSocKJ)), spillMJmax: Math.max(...L.map(x => x.spillMJ)), rows: L}; }
  // 2. clip onset vs telemetry: 10a's rows (W17 detector medians per straight); positions in TI metres, lap length from the 2026 pole lap
  //    (TI lap length per track: the length that puts production's kernel onsets where 10a stored them, median over straights; else
  //    the pole lap's length)
  const clipsOf = x => kernelClips(Ks.K, x.res, x.car, x.ds), lenOf = {};
  for (const id of Object.keys(laps[cfg[0][0]])) { const L0 = lapsimF1RealTel[id]?.['2026']?.len; if (!L0) continue; const kc = clipsOf(laps[cfg[0][0]][id]), q = [];
    for (const r of ev.clipping.rows.filter(r => r.track === id && r.kernelOnsetM != null)) { const [a, b] = r.straight.replace(' m', '').split('-').map(Number), k = kc.find(p => p.clip && p.frac >= a / L0 && p.frac <= b / L0);
      if (k) q.push(r.kernelOnsetM / k.frac); }
    lenOf[id] = q.length ? median(q) : L0; }
  out.clipLapLengthM = lenOf;
  for (const [name] of cfg) { const per = {}, rows = [];
    for (const r of ev.clipping.rows) { if (r.onsetM == null) continue; const x = laps[name][r.track], Lm = lenOf[r.track]; if (!x || !Lm) continue;
      const [a, b] = r.straight.replace(' m', '').split('-').map(Number), kc = clipsOf(x).find(p => p.clip && p.frac >= a / Lm && p.frac <= b / Lm);
      const err = kc ? kc.frac * Lm - r.onsetM : null; rows.push({track: r.track, straight: r.straight, onsetM: r.onsetM, kernelM: kc ? Math.round(kc.frac * Lm) : null, errM: err == null ? null : Math.round(err)});
      if (err != null) (per[r.track] ||= []).push(Math.abs(err)); }
    const pt = Object.fromEntries(Object.entries(per).map(([k, a]) => [k, median(a)]));
    out.clip[name] = {medianOfTrackMediansM: median(Object.values(pt)), tracks: Object.keys(pt).length, straightsWithOnset: rows.filter(r => r.errM != null).length, straights: rows.length, perTrack: pt, rows}; }
  // 3. trap = lap top speed vs the real pole lap's top speed. 2025: production car vs law (b) with 2a's measured CdA per track and
  //    pIce 540 kW (prior 540 ± 24, prereg §8); 2026: production car, law on, options A and B
  const real = (id, y) => { const t = lapsimF1RealTel[id]?.[y]; return t ? Math.max(...t.speed) : null; };
  const K = Ks.K, tr25 = [];
  for (const [id, m] of Object.entries(CM.seasons['2025'].perTrack)) { const d = lapsimAllTracks[id], c = carsFor(id)['2025'], vr = real(id, '2025'); if (!d || !c || !vr) continue;
    const w = realConditions(id)?.['2025'] || {}, fw = Object.fromEntries(Object.entries(w).filter(([, v]) => Number.isFinite(v)));
    const env = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0, ...fw});
    const t0 = withZones(K, d, K.trackFromData(d), c), track = {...t0, mu: Float64Array.from(t0.mu, x => x * (c.grip || 1))};
    const meas = {...CAL.seasons['2025'].car, cdA: m.cdA.value, cdALow: m.cdALow.value, pIce: 540e3};
    const p = K.simulateLap(track, c.car, env), b = K.simulateLap(track, withErsLaw(meas, env), env), a = K.simulateLap(track, meas, env);
    tr25.push({id, realKph: vr, production: +(p.vMaxKph - vr).toFixed(1), measuredCdaCutoff: +(a.vMaxKph - vr).toFixed(1), measuredCdaLawB: +(b.vMaxKph - vr).toFixed(1)}); }
  const s25 = k => ({meanAbs: +mean(tr25.map(r => Math.abs(r[k]))).toFixed(2), bias: +mean(tr25.map(r => r[k])).toFixed(2)});
  out.trap['2025'] = {n: tr25.length, production: s25('production'), measuredCdaCutoff: s25('measuredCdaCutoff'), measuredCdaLawB: s25('measuredCdaLawB'), rows: tr25};
  for (const [name] of cfg) { const R = Object.entries(laps[name]).map(([id, x]) => { const vr = real(id, '2026'); return vr ? x.res.vMaxKph - vr : null; }).filter(x => x != null);
    out.trap['2026 ' + name] = {n: R.length, meanAbs: +mean(R.map(Math.abs)).toFixed(2), bias: +mean(R).toFixed(2)}; }
  return out;
}
if (process.argv[1]?.endsWith('ers-strategy-options.mjs') && process.argv[2] === '--checks') {
  const r = await checks(), f = process.argv[3] || 'ers-checks.json';
  writeFileSync(f, JSON.stringify(r, null, 1) + '\n');
  for (const [k, v] of Object.entries(r.ledger)) console.log('ledger', k, v.maxResidualPct.toExponential(2), '%  flow', v.maxFlowVsTotalsJ.toFixed(1), 'J  over', v.maxOverBudgetJ.toFixed(0), 'J  minSoc', v.minSocKJ.toFixed(1), 'kJ');
  for (const [k, v] of Object.entries(r.clip)) console.log('clip', k, v.medianOfTrackMediansM, 'm', v.tracks, 'tracks', v.straightsWithOnset + '/' + v.straights);
  for (const [k, v] of Object.entries(r.trap)) console.log('trap', k, JSON.stringify({n: v.n, ...(v.meanAbs != null ? {meanAbs: v.meanAbs, bias: v.bias} : {production: v.production, cut: v.measuredCdaCutoff, lawB: v.measuredCdaLawB})}));
}
