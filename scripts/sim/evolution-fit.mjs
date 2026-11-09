// Fits track evolution (worker/lapsim/evolution.js) on the lap-by-lap sessions from
// fetch-evolution.mjs. Per session: push laps only (green flag, no out/in-laps, within 2% of the
// car's best), lap = car + f(minute) + first-lap-after-out-lap term (+ compound and tyre age for F1),
// with f piecewise linear in session time and f(0) = 0. That measured curve is kept per track and
// session type (so a session that has run is reproduced). Per series and session type the curves are
// pooled into gain and time constant, and tested leaving each track out.
// Writes worker/lapsim/evolution-data.js and docs/lapsim-evolution.md.
import {readFile, writeFile} from 'node:fs/promises';
import {readdirSync} from 'node:fs';
import {gate} from './gate.mjs';
import {sessionKey} from './t71-collect.mjs';
import {join} from 'node:path';
import {ridge} from '../../worker/lapsim/race-pace.js';
import {SESSION_SCALE} from '../../worker/lapsim/evolution.js';

const DIR = join(process.env.LAPSIM_CACHE || '.cache/lapsim', 'evolution');
const index = JSON.parse(await readFile(join(DIR, 'index.json'), 'utf8')).map(e => ({...e, dir: DIR}));
// Timing71 WEC sessions of seasons with no Al Kamel files (t71-collect.mjs T71_EVO=1), gated per session type
const T71 = process.env.LAPSIM_T71_EVO;
if (T71) for (const f of readdirSync(T71).filter(f => /^t71-wec-.*\.json$/.test(f))) { const S = JSON.parse(await readFile(join(T71, f), 'utf8')); index.push({file: f, dir: T71, series: 'wec', year: S.year, track: S.track, type: S.type, session: S.session, t71: true}); }
// session names differ between sources: compare a normalised key (practice N, qualifying/Hyperpole + class)
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const rms = a => a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : null;
const r4 = x => Math.round(x * 1e4) / 1e4;

function fitSession(S) {
  const c = Object.fromEntries(S.columns.map((k, i) => [k, i]));
  // any real rain in the session mixes wet and dry laps: kept out (drying is fitted on its own)
  if (S.weather?.length && S.weather.filter(w => w[2] > 0).length / S.weather.length > 0.1) return {skip: 'rain'};
  // laps since the out-lap and in-laps per car
  const byCar = {};
  for (const r of S.rows) (byCar[r[c.car]] ||= []).push(r);
  const laps = [];
  for (const rs of Object.values(byCar)) {
    rs.sort((a, b) => a[c.lap] - b[c.lap]);
    let k = 0;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i], next = rs[i + 1];
      if (r[c.outLap]) { k = 0; continue; }
      k++;
      if (next?.[c.outLap] && next[c.lap] === r[c.lap] + 1 && S.series === 'f1') continue; // in-lap
      if (r[c.neutral]) continue;
      if (S.series === 'f1' && !['SOFT', 'MEDIUM', 'HARD'].includes(r[c.compound])) continue; // slicks only
      laps.push({car: String(r[c.car]), t: r[c.minute], y: r[c.time], k, compound: c.compound != null ? r[c.compound] : null, age: c.tyreAge != null ? r[c.tyreAge] : null});
    }
  }
  const best = {};
  for (const l of laps) best[l.car] = Math.min(best[l.car] ?? Infinity, l.y);
  const push = laps.filter(l => l.y <= best[l.car] * 1.02 && l.t >= 0);
  const cars = [...new Set(push.map(l => l.car))].filter(k => push.filter(l => l.car === k).length >= 2);
  const P = push.filter(l => cars.includes(l.car));
  if (cars.length < 4 || P.length < 25) return {skip: 'few laps'};
  // curve starts at the first push lap (no extrapolation back to minute 0)
  const t0 = Math.floor(Math.min(...P.map(l => l.t))), T = Math.max(...P.map(l => l.t)), step = Math.max(5, Math.ceil((T - t0) / 6 / 5) * 5);
  const knots = []; for (let x = t0; x < T + step; x += step) knots.push(x);
  const hat = (t, j) => { if (t < knots[0]) t = knots[0]; const a = knots[j - 1], b = knots[j], d = knots[j + 1]; return t <= a || (d != null && t >= d) ? 0 : t <= b ? (t - a) / (b - a) : d == null ? 1 : (d - t) / (d - b); };
  const comps = S.series === 'f1' ? ['MEDIUM', 'HARD'] : [];
  const nC = cars.length, nK = knots.length - 1, iW = nC + nK, iC = iW + 1, iA = iC + comps.length, p = iA + 1;
  const rows = P.map(l => {
    const x = Array(p).fill(0);
    x[cars.indexOf(l.car)] = 1;
    for (let j = 1; j <= nK; j++) x[nC + j - 1] = hat(l.t, j);
    x[iW] = l.k === 1 ? 1 : 0;
    comps.forEach((m, i) => { if (l.compound === m) x[iC + i] = 1; });
    x[iA] = Number.isFinite(l.age) ? l.age : 0;
    return {x, y: l.y};
  });
  const lam = [...Array(nC).fill(0), ...Array(nK).fill(1e-6), 2, ...comps.map(() => 2), 20];
  const sol = ridge(rows, lam);
  if (!sol) return {skip: 'singular'};
  const ref = median(P.map(l => l.y));
  const resid = rows.map(r => r.y - r.x.reduce((s, v, i) => s + v * sol[i], 0));
  return {T, ref, curve: knots.map((x, j) => [x, j ? r4(sol[nC + j - 1] / ref * 100) : 0]), warmupPct: r4(sol[iW] / ref * 100), n: P.length, cars: nC, rmsPct: r4(rms(resid) / ref * 100)};
}

// parametric curve (pct): −a(1 − e^(−t/τ))
const para = (a, tau, t) => -a * (1 - Math.exp(-t / tau));
function pool(list) {
  let best = null;
  for (let tau = 5; tau <= 150; tau += 2.5) {
    // least squares for a at this τ
    let num = 0, den = 0;
    for (const s of list) for (const [t, v] of s.curve) { const g = Math.exp(-s.curve[0][0] / tau) - Math.exp(-t / tau); num += -v * g; den += g * g; }
    const a = den ? num / den : 0;
    let e = 0; for (const s of list) for (const [t, v] of s.curve) e += (para(a, tau, t) - para(a, tau, s.curve[0][0]) - v) ** 2;
    if (!best || e < best.e) best = {a, tau, e};
  }
  return {gainPct: r4(best.a), tauMin: best.tau, warmupPct: r4(median(list.map(s => s.warmupPct)))};
}

const sessions = [];
const log = [];
for (const e of index) {
  const S = JSON.parse(await readFile(join(e.dir, e.file), 'utf8'));
  const f = fitSession(S);
  if (f.skip) { log.push(`${e.file}: ${f.skip}`); continue; }
  sessions.push({...e, ...f});
  log.push(`${e.file}: ${f.n} push laps, ${f.cars} cars, end ${f.curve.at(-1)[1]}%, fit RMS ${f.rmsPct}%`);
}

const out = {generatedAt: new Date().toISOString(), series: {}};
const report = ['# Track evolution', '', `Generated ${out.generatedAt}.`, '',
  'Holdout: each session curve predicted without itself — from the same track in other seasons when available, else from the other tracks of the same series and session type. Curve error = RMS gap between predicted and measured lap-time change over the session; end error = gap at the last minute. "No model" = assuming the track does not change.', '',
  '| Series | Session | Sessions | Gain % | τ min | Curve error % | End error % | No model, end % |', '|---|---|---|---|---|---|---|---|'];
for (const series of [...new Set(sessions.map(s => s.series))]) {
  const S = out.series[series] = {sessions: {}, tracks: {}};
  for (const type of [...new Set(sessions.filter(s => s.series === series).map(s => s.type))]) {
    // sessions with an implausible change (mixed conditions the filters missed) stay out of the pool
    let list = sessions.filter(s => s.series === series && s.type === type && Math.abs(s.curve.at(-1)[1]) <= 4);
    // Each session predicted without itself: from the same track's other seasons when there are any
    // (how a new season's session is predicted), else from the pooled curve of the other tracks.
    // Only sessions of the original sources are scored (Timing71 sessions only help predict them).
    const at = (c, t) => { if (t <= c[0][0]) return c[0][1]; for (let i = 1; i < c.length; i++) if (t <= c[i][0]) return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * (t - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c.at(-1)[1]; };
    const holdoutOf = L => { const errC = [], errE = [], base = [], keys = [];
      for (const s of L.filter(x => !x.t71)) {
        const same = L.filter(o => o.track === s.track && o !== s && sessionKey(o.session) === sessionKey(s.session) && o.year !== s.year);
        const others = L.filter(o => o.track !== s.track);
        if (!same.length && others.length < 2) continue;
        const q = same.length ? null : pool(others), t0 = s.curve[0][0];
        const pred = t => same.length ? same.reduce((a, o) => a + at(o.curve, t) - at(o.curve, t0), 0) / same.length : para(q.gainPct, q.tauMin, t) - para(q.gainPct, q.tauMin, t0);
        const d = s.curve.map(([t, v]) => pred(t) - v);
        errC.push(rms(d)); errE.push(d.at(-1)); base.push(s.curve.at(-1)[1]); keys.push(s.file);
      }
      return {errC, errE, base, keys}; };
    let h = holdoutOf(list.filter(x => !x.t71)), t71Gate = null;
    if (list.some(x => x.t71)) {
      const h2 = holdoutOf(list), k2 = Object.fromEntries(h2.keys.map((k, i) => [k, i])), both = h.keys.filter(k => k in k2);
      const g = gate(both.map(k => h.errE[h.keys.indexOf(k)]), both.map(k => h2.errE[k2[k]]));
      t71Gate = {sessions: list.filter(x => x.t71).length, previousEndPct: r4(g.rmsCur), candidateEndPct: r4(g.rmsNew), reason: g.reason, used: g.accept};
      log.push(`Timing71 ${series} ${type}: ${t71Gate.sessions} sessions, end error ${t71Gate.previousEndPct}% → ${t71Gate.candidateEndPct}%, ${g.reason}`);
      if (g.accept) h = h2; else list = list.filter(x => !x.t71);
    }
    const scale = SESSION_SCALE[type] ?? 1, all = pool(list);
    const {errC, errE, base} = h;
    S.sessions[type] = {coeffs: {gainPct: r4(all.gainPct / scale), tauMin: all.tauMin, warmupPct: all.warmupPct}, n: list.length,
      holdoutPct: errC.length ? r4(rms(errC)) : null, holdoutEndPct: errE.length ? r4(rms(errE)) : null, noModelEndPct: base.length ? r4(rms(base)) : null, ...(t71Gate ? {t71: t71Gate} : {})};
    report.push(`| ${series} | ${type} | ${list.length} | ${all.gainPct.toFixed(2)} | ${all.tauMin} | ${S.sessions[type].holdoutPct ?? '–'} | ${S.sessions[type].holdoutEndPct ?? '–'} | ${S.sessions[type].noModelEndPct ?? '–'} |`);
    // measured curve per track: latest season, main session of that type
    for (const s of list.sort((a, b) => a.year - b.year || /sprint/i.test(b.session) - /sprint/i.test(a.session))) {
      (S.tracks[s.track] ||= {})[type] = {curve: s.curve, year: s.year, session: s.session, rmsPct: s.rmsPct, coeffs: {warmupPct: s.warmupPct}};
    }
  }
}
await writeFile('worker/lapsim/evolution-data.js', `// Generated by scripts/sim/evolution-fit.mjs from official lap data. Do not edit by hand.\nexport const lapsimEvolution=${JSON.stringify(out)};\n`);
report.push('', '## Sessions', '', ...log.map(l => '- ' + l), '');
await writeFile('docs/lapsim-evolution.md', report.join('\n'));
console.log(report.slice(0, 8 + Object.values(out.series).reduce((n, s) => n + Object.keys(s.sessions).length, 0)).join('\n'));
