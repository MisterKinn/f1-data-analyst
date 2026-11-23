// Step 12a (diagnostic, pre-registration claude/gate-wind-minute-prereg-2026-11-23.md): does the wind of the minute of each driver's
// best qualifying lap, through the current kernel, explain lap spread between drivers of the same session better than one session wind?
// No kernel or fit change. In: TracingInsights season repos (sparse clone with Qualifying laptimes.json + weather.json, LAPSIM_TI_DIR).
// Out: scripts/sim/data/learn/wind-minute.json (+ --md docs/lapsim-wind-minute.md). Usage: node scripts/sim/wind-minute.mjs [--md f] [--draws 2000]
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tiTrack} from './ti-races.mjs';
import {withGrip} from './calibrate-lib.mjs';
import {lapsimAllTracks} from '../../worker/lapsim/tracks.js';
import {trackFromData} from '../../worker/lapsim/tracks.js';
import {lapsimCalibration as C} from '../../worker/lapsim/calibration-data.js';
import {simulateLap} from '../../worker/lapsim/engine.js';
import {conditionsFromWeather} from '../../worker/lapsim/atmosphere.js';
import {rechargeLimitMJ} from '../../worker/lapsim/energy-limits.js';
import {simulate} from '../../worker/lapsim/tool.js';

const ROOT = process.env.LAPSIM_TI_DIR || '.cache/ti', YEARS = (process.env.LAPSIM_WIND_YEARS || '2023,2024,2025,2026').split(',').map(Number), HELD = new Set([2025, 2026]);
const arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null;
const num = v => v === 'None' || v == null || !Number.isFinite(+v) ? null : +v;
const rad = Math.PI / 180;

// seeded RNG (same LCG as condition-report.mjs)
export const rng = (seed = 7) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// vector mean of wind samples [speed, fromDeg] (as build-geometry.mjs): {speed, from}
export function vecMean(rows) {
  if (!rows.length) return null;
  let e = 0, n = 0; for (const [s, d] of rows) { e += s * Math.sin(d * rad); n += s * Math.cos(d * rad); }
  return {speed: Math.hypot(e, n) / rows.length, from: (Math.atan2(e, n) / rad + 360) % 360};
}

// Remove session, team×season, driver×season means and a per-session linear time term (alternating projections).
// rows: [{sess, team, drv, t}], values: Float64Array. Returns the residual.
export function residualise(rows, values, {iters = 200, tol = 1e-12} = {}) {
  const r = Float64Array.from(values), keys = ['sess', 'team', 'drv'];
  const idx = keys.map(k => { const m = new Map(); rows.forEach((x, i) => { const g = x[k]; if (!m.has(g)) m.set(g, []); m.get(g).push(i); }); return [...m.values()]; });
  const bySess = idx[0], tc = new Float64Array(rows.length);
  for (const g of bySess) { const mt = g.reduce((a, i) => a + rows[i].t, 0) / g.length; for (const i of g) tc[i] = rows[i].t - mt; }
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (const groups of idx) for (const g of groups) { let m = 0; for (const i of g) m += r[i]; m /= g.length; for (const i of g) r[i] -= m; moved += m * m; }
    for (const g of bySess) { let sxy = 0, sxx = 0; for (const i of g) { sxy += tc[i] * r[i]; sxx += tc[i] * tc[i]; } const b = sxx > 0 ? sxy / sxx : 0; for (const i of g) r[i] -= b * tc[i]; moved += b * b * sxx; }
    if (moved < tol) break;
  }
  return r;
}

export const slope = (e, d, use = null) => { let sxy = 0, sxx = 0; for (let i = 0; i < e.length; i++) if (!use || use[i]) { sxy += e[i] * d[i]; sxx += d[i] * d[i]; } return sxx > 0 ? sxy / sxx : NaN; };
const q = (a, p) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))]; };

function loadSessions() {
  const out = [], dropped = [];
  for (const y of YEARS) {
    const ydir = join(ROOT, String(y)); if (!existsSync(ydir)) { dropped.push(`${y}: no TI checkout`); continue; }
    for (const ev of readdirSync(ydir).filter(e => /Grand Prix$/.test(e)).sort()) {
      const dir = join(ydir, ev, 'Qualifying'), wf = join(dir, 'weather.json'); if (!existsSync(wf)) continue;
      const W = JSON.parse(readFileSync(wf, 'utf8')), track = tiTrack(ev, y), td = lapsimAllTracks[track];
      if (W.wR?.some(Boolean)) { dropped.push(`${y} ${ev}: rain`); continue; }
      if (!td?.heading) { dropped.push(`${y} ${ev}: no geometry/heading (${track})`); continue; }
      const laps = [];
      for (const drv of readdirSync(dir)) {
        const f = join(dir, drv, 'laptimes.json'); if (!existsSync(f)) continue;
        const d = JSON.parse(readFileSync(f, 'utf8')); let best = null;
        d.time.forEach((tt, i) => { const lap = num(tt), s = [num(d.s1[i]), num(d.s2[i]), num(d.s3[i])], st = num(d.lST?.[i]);
          if (lap == null || st == null || d.del?.[i] || s.some(x => x == null) || Math.abs(s[0] + s[1] + s[2] - lap) > 0.002) return;
          if (!best || lap < best.lap) best = {drv, team: d.team?.[i] || '?', lap, start: st, end: st + lap, mid: st + lap / 2}; });
        if (best) laps.push(best);
      }
      if (!laps.length) continue;
      const pole = Math.min(...laps.map(l => l.lap)), kept = laps.filter(l => l.lap <= 1.07 * pole);
      if (kept.length < 8) { dropped.push(`${y} ${ev}: < 8 drivers`); continue; }
      const t0 = Math.min(...kept.map(l => l.start)), t1 = Math.max(...kept.map(l => l.end));
      const wt = W.wT.map(num), samples = wt.map((t, i) => ({t, s: num(W.wWS[i]) ?? 0, d: num(W.wWD[i]) ?? 0, air: num(W.wAT[i]), tr: num(W.wTT[i]), h: num(W.wH[i]), p: num(W.wP[i])})).filter(x => x.t != null);
      const run = samples.map((x, i) => i).filter(i => samples[i].t >= t0 && samples[i].t <= t1);
      if (run.length < 3) { dropped.push(`${y} ${ev}: < 3 weather minutes`); continue; }
      const mean = k => { const v = run.map(i => samples[i][k]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
      const sessWind = vecMean(run.map(i => [samples[i].s, samples[i].d]));
      const lapsOut = [];
      for (const l of kept) {
        let k = -1, best = Infinity; samples.forEach((x, i) => { const dt = Math.abs(x.t - l.mid); if (dt < best) { best = dt; k = i; } });
        if (best > 90) continue;
        const win = samples.filter(x => x.t >= l.start - 30 && x.t <= l.end + 30);
        lapsOut.push({...l, k, win: vecMean(win.map(x => [x.s, x.d]))});
      }
      out.push({year: y, event: ev, track, samples, run, sessWind, weather: {airTempC: mean('air'), trackTempC: mean('tr'), humidityPct: mean('h'), pressureHpa: mean('p')}, laps: lapsOut});
    }
  }
  return {sessions: out, dropped};
}

// lap time with the season car and track factors; only the wind changes between calls. 2025–26: the page path (tool.js simulate,
// with the 2026 zone states and power ramp); 2023–24: the calibration path (amendment 1). Returns null when the tool cannot run it.
function lapper(year, track) {
  if (year >= 2025) {
    const cache = new Map(), page = (w, speed, from) => simulate({track, car: String(year), air_temp_c: w.airTempC, track_temp_c: w.trackTempC, humidity_pct: w.humidityPct,
      pressure_hpa: w.pressureHpa, wind_speed_ms: speed, wind_from_deg: from});
    const r0 = page({}, 0, 0); if (r0.status !== 'ok' || !Number.isFinite(r0.result?.lap_seconds)) return null;
    return (w, speed, from) => { const key = speed.toFixed(3) + '|' + from.toFixed(1); if (!cache.has(key)) cache.set(key, page(w, speed, from).result.lap_seconds); return cache.get(key); };
  }
  const s = C.seasons[year] || C.seasons[String(Math.min(2026, Math.max(2023, year)))], tf = s.tracks?.[track] ||
    Object.values(C.seasons).map(x => x.tracks?.[track]).find(Boolean) || {};
  const drag = tf.drag ?? 1, car = drag !== 1 ? {...s.car, cdA: s.car.cdA * drag, cdALow: s.car.cdALow * drag} : s.car;
  const tr = withGrip(trackFromData(lapsimAllTracks[track]), tf.grip ?? 1), rech = year >= 2026 ? rechargeLimitMJ(track, year) : undefined;
  const cache = new Map();
  return (w, speed, from) => { const key = speed.toFixed(3) + '|' + from.toFixed(1); if (!cache.has(key))
    cache.set(key, simulateLap(tr, car, conditionsFromWeather({...w, windSpeed: speed, windFromDeg: from, rechargeMJ: rech})).lapTime); return cache.get(key); };
}

export function analyse(rows, deltaOf, {draws = 2000, seed = 7, shuffle} = {}) {
  const y = residualise(rows, Float64Array.from(rows, r => r.y)), d = residualise(rows, Float64Array.from(rows, deltaOf));
  const b = slope(y, d); let see = 0, sdd = 0, syy = 0, sdd2 = 0;
  for (let i = 0; i < y.length; i++) { see += (y[i] - d[i]) ** 2; syy += y[i] ** 2; sdd += d[i] ** 2; }
  const sess = [...new Set(rows.map(r => r.sess))], bySess = new Map(sess.map(s => [s, []])); rows.forEach((r, i) => bySess.get(r.sess).push(i));
  const R = rng(seed), boot = [];
  for (let k = 0; k < draws; k++) { let sxy = 0, sxx = 0; for (let j = 0; j < sess.length; j++) for (const i of bySess.get(sess[Math.floor(R() * sess.length)])) { sxy += y[i] * d[i]; sxx += d[i] * d[i]; } boot.push(sxx > 0 ? sxy / sxx : NaN); }
  let ge = 0, perm = [];
  if (shuffle) { const R2 = rng(seed + 1); for (let k = 0; k < draws; k++) { const ds = residualise(rows, Float64Array.from(rows, r => shuffle(r, R2))); const bs = slope(y, ds); perm.push(bs); if (bs >= b) ge++; } }
  return {n: rows.length, sessions: sess.length, beta: b, ci90: [q(boot, 0.05), q(boot, 0.95)], r2phys: 1 - see / syy, r2beta: b * b * sdd / syy,
    sdResidPct: Math.sqrt(syy / rows.length), sdDeltaPct: Math.sqrt(sdd / rows.length), pRand: shuffle ? (ge + 1) / (draws + 1) : null, permCi90: perm.length ? [q(perm, 0.05), q(perm, 0.95)] : null};
}

function main() {
  const draws = +(arg('--draws') || 2000), {sessions, dropped} = loadSessions(), rows = [];
  for (const S of sessions) {
    const L = lapper(S.year, S.track); if (!L) { dropped.push(`${S.year} ${S.track}: page simulator cannot run it`); continue; }
    const base = L(S.weather, S.sessWind.speed, S.sessWind.from);
    const dPct = S.samples.map(x => 100 * (L(S.weather, x.s, x.d) - base) / base);
    S.dPct = dPct; S.baseLap = base; const baseF = L(S.weather, S.sessWind.speed, (S.sessWind.from + 180) % 360);
    for (const l of S.laps) rows.push({sess: `${S.year} ${S.track}`, year: S.year, track: S.track, team: `${S.year} ${l.team}`, drv: `${S.year} ${l.drv}`, t: l.mid / 60,
      y: 100 * Math.log(l.lap), dMin: dPct[l.k], dFlip: 100 * (L(S.weather, S.samples[l.k].s, (S.samples[l.k].d + 180) % 360) - baseF) / baseF, dWin: l.win ? 100 * (L(S.weather, l.win.speed, l.win.from) - base) / base : dPct[l.k], S, lapS: l.lap,
      wMin: [S.samples[l.k].s, S.samples[l.k].d]});
  }
  const shuffle = (r, R) => r.S.dPct[r.S.run[Math.floor(R() * r.S.run.length)]];
  const pick = f => rows.filter(f), groups = {held: pick(r => HELD.has(r.year)), explore: pick(r => !HELD.has(r.year)), all: rows};
  const seasons = Object.fromEntries(YEARS.map(y => [String(y), pick(r => r.year === y)]).filter(([, R]) => R.length));
  const res = {generatedAt: new Date().toISOString().slice(0, 10), prereg: 'claude/gate-wind-minute-prereg-2026-11-23.md', draws, dropped, groups: {}, sensitivity: {}, tracks: {}};
  for (const [g, R] of Object.entries(groups)) res.groups[g] = analyse(R, r => r.dMin, {draws, shuffle});
  for (const [g, R] of Object.entries(groups)) res.sensitivity[g] = analyse(R, r => r.dWin, {draws: 500});
  res.seasons = Object.fromEntries(Object.entries(seasons).map(([y, R]) => [y, analyse(R, r => r.dMin, {draws: 1000, shuffle})])); // reported only (amendment 1)
  // per track: within-session SD of Δ (ms); descriptive β from the season-wide residuals (a track has one session per season, so its
  // own driver×season terms would absorb every lap)
  const eAll = residualise(rows, Float64Array.from(rows, r => r.y)), dAll = residualise(rows, Float64Array.from(rows, r => r.dMin));
  for (const tk of [...new Set(rows.map(r => r.track))].sort()) {
    const I = rows.map((r, i) => i).filter(i => rows[i].track === tk), R = I.map(i => rows[i]), ms = [];
    for (const s of new Set(R.map(r => r.sess))) { const X = R.filter(r => r.sess === s), m = X.reduce((a, r) => a + r.dMin, 0) / X.length; for (const r of X) ms.push((r.dMin - m) / 100 * r.lapS * 1000); }
    const rr = rng(11), bs = []; for (let k = 0; k < 1000; k++) { let a = 0; for (let j = 0; j < ms.length; j++) a += ms[Math.floor(rr() * ms.length)] ** 2; bs.push(Math.sqrt(a / ms.length)); }
    const sessI = [...new Set(R.map(r => r.sess))], bb = [], r3 = rng(13); // lap bootstrap: 1–4 sessions per track are too few to resample
    const sl = J => { let sxy = 0, sxx = 0; for (const i of J) { sxy += eAll[i] * dAll[i]; sxx += dAll[i] ** 2; } return sxx > 0 ? sxy / sxx : NaN; };
    for (let k = 0; k < 1000; k++) bb.push(sl(I.map(() => I[Math.floor(r3() * I.length)])));
    res.tracks[tk] = {laps: R.length, sessions: sessI.length, sdDeltaMs: Math.sqrt(ms.reduce((x, v) => x + v * v, 0) / ms.length), sdDeltaMsCi90: [q(bs, 0.05), q(bs, 0.95)],
      meanWind: R.reduce((x, r) => x + r.wMin[0], 0) / R.length, beta: sl(I), betaCi90: [q(bb, 0.05), q(bb, 0.95)]};
  }
  // not pre-registered (reported only): sign check, every wind direction turned by 180° (sensor convention or track frame wrong?)
  res.flip180 = Object.fromEntries(Object.entries(groups).map(([g, R]) => [g, R.length ? analyse(R, r => r.dFlip, {draws: 500}) : null]));
  // not pre-registered (reported only): sessions with a steady wind (session vector-mean speed >= 2 m/s), less direction noise
  res.steady = Object.fromEntries(Object.entries(groups).map(([g, R]) => [g, (X => X.length >= 40 ? analyse(X, r => r.dMin, {draws: 500}) : null)(R.filter(r => r.S.sessWind.speed >= 2))]));
  const H = res.groups.held; res.decision = {go: H.ci90[0] > 0 && H.pRand < 0.05 && H.r2phys > 0, rule: 'held-out 2025–26: β 90 % CI excludes 0, randomization p < 0.05, R²phys > 0'};
  writeFileSync('scripts/sim/data/learn/wind-minute.json', JSON.stringify(res, (k, v) => typeof v === 'number' ? +v.toPrecision(5) : v, 1) + '\n');
  const md = report(res); if (arg('--md')) writeFileSync(arg('--md'), md); console.log(md);
}

function report(r) {
  const f = (v, d = 3) => Number.isFinite(v) ? v.toFixed(d) : '–', ci = c => c ? `${f(c[0], 2)} … ${f(c[1], 2)}` : '–';
  const g = Object.entries(r.groups).map(([k, x]) => `| ${k} | ${x.sessions} | ${x.n} | ${f(x.beta, 2)} | ${ci(x.ci90)} | ${f(x.pRand, 3)} | ${f(100 * x.r2phys, 2)} % | ${f(100 * x.r2beta, 2)} % | ${f(x.sdDeltaPct, 4)} | ${f(x.sdResidPct, 3)} | ${f(r.sensitivity[k].beta, 2)} (${ci(r.sensitivity[k].ci90)}) |`);
  const t = Object.entries(r.tracks).map(([k, x]) => `| ${k} | ${x.sessions} | ${x.laps} | ${f(x.meanWind, 1)} | ${f(x.sdDeltaMs, 1)} (${f(x.sdDeltaMsCi90[0], 1)} … ${f(x.sdDeltaMsCi90[1], 1)}) | ${x.beta == null ? '–' : `${f(x.beta, 1)} (${ci(x.betaCi90)})`} |`);
  return ['# Minute wind inside a qualifying session (step 12a)', '',
    `Built by \`scripts/sim/wind-minute.mjs\` on ${r.generatedAt}. Pre-registration: Project \`${r.prereg}\`. Diagnostic only: no kernel, fit or lap change.`, '',
    'Each F1 driver\'s best dry qualifying lap 2023–26 (TracingInsights, trackside sensor one sample per minute). Δ = lap-time change the',
    'current kernel predicts for the wind of that lap\'s minute against the vector-mean wind of the session (same car, track, air). Real lap',
    'times (100·ln) and Δ are both residualised on session, team×season, driver×season and a per-session linear time term. β = slope of the',
    'residual on Δ (the kernel says 1). Interval: 90 % session-cluster bootstrap. p: one-sided randomization test, each lap gets a random',
    `minute of its own session's running window (${r.draws} draws). R²phys = 1 − Σ(e − Δ)²/Σe² with β fixed at 1 (no fit).`, '',
    '| Group | Sessions | Laps | β | 90 % interval | p (shuffle) | R²phys | R²(β̂) | SD Δ (%) | SD residual (%) | β, lap-window wind (sensitivity) |',
    '|---|---|---|---|---|---|---|---|---|---|---|', ...g, '',
    'Per season (reported only): ' + Object.entries(r.seasons).map(([y, x]) => `${y} β ${f(x.beta, 2)} (${ci(x.ci90)}), p ${f(x.pRand, 3)}, R²phys ${f(100 * x.r2phys, 1)} %, SD Δ ${f(x.sdDeltaPct, 3)} %`).join('; ') + '.', '',
    `**Decision for step 12b: ${r.decision.go ? 'GO' : 'NO-GO'}** (${r.decision.rule}; held-out = 2025–26, explore = 2023–24).`, '',
    'Not pre-registered (reported only): sessions with steady wind (session vector-mean ≥ 2 m/s): ' + Object.entries(r.steady).map(([k, x]) => x ? `${k} β ${f(x.beta, 2)} (${ci(x.ci90)}), ${x.sessions} sessions, R²phys ${f(100 * x.r2phys, 1)} %` : `${k} –`).join('; ') + '.', '',
    'Not pre-registered (reported only): sign check with every wind direction turned by 180°: ' + Object.entries(r.flip180).map(([k, x]) => x ? `${k} β ${f(x.beta, 2)} (${ci(x.ci90)}), R²phys ${f(100 * x.r2phys, 1)} %` : `${k} –`).join('; ') + '.', '',
    '## Per track', '', 'SD Δ: within-session spread of the predicted wind effect between drivers, in ms (90 % bootstrap over laps). β per track is',
    'descriptive only (many tracks, wide intervals; no per-track decision).', '',
    '| Track | Sessions | Laps | Mean wind (m/s) | SD Δ ms (90 %) | β (90 %) |', '|---|---|---|---|---|---|', ...t, '',
    `Dropped: ${r.dropped.join('; ') || 'none'}.`, ''].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
