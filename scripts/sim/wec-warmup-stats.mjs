// Step 15-prep: WEC first push lap after a pit-out — coefficient table per class (rules: Project doc
// claude/gate-wec-warmup-evolution-prereg-2026-11-23.md, part A) and the leave-one-event-out power check (part B).
//   node scripts/sim/wec-warmup-stats.mjs [runs.json.gz]
// Writes scripts/sim/data/learn/wec-warmup-coef-2023-2025.json, worker/lapsim/evolution-warmup-data.js (flag kept off)
// and docs/lapsim-evolution-warmup.md.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {evolutionCoeffs, evolutionDelta} from '../../worker/lapsim/evolution.js';

const SRC = process.argv[2] || 'scripts/sim/data/learn/wec-warmup-runs-2023-2025.json.gz', OLD = 'scripts/sim/data/learn/wec-warmup-coef-2023-2025-v1-own-fetch.json';
const buf = readFileSync(SRC), D = JSON.parse((buf[0] === 0x1f ? gunzipSync(buf) : buf).toString('utf8'));
const CLASSES = ['hypercar', 'lmp2', 'lmgt3', 'lmgte'], USED = ['hypercar', 'lmp2', 'lmgt3'], TYPES = ['practice', 'qualifying', 'race'];
const r3 = x => x == null || !Number.isFinite(x) ? null : Math.round(x * 1e3) / 1e3;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return NaN; const h = (s.length - 1) * p, i = Math.floor(h); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (h - i); };
const med = a => q(a, 0.5), mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
let seed = 1; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// push filters and traffic guard (part A)
const rows = D.runs.map(r => Object.fromEntries(D.columns.map((k, i) => [k, r[i]]))).filter(r => {
  const f = r.type === 'race' ? 1.03 : 1.02, ref = (r.k2 + r.k3) / 2;
  return r.k2 <= f * r.best && r.k3 <= f * r.best && r.k1 <= (f + 0.04) * r.best && Math.abs(r.k2 - r.k3) / ref <= 0.01;
}).map(r => ({...r, event: `${r.year}|${r.track}`, ref: (r.k2 + r.k3) / 2, raw: 100 * (r.k1 - (r.k2 + r.k3) / 2) / ((r.k2 + r.k3) / 2)}));

// in-stint trend s (% per lap): median least-squares slope of k2..k6 (fuel + rubber + wear, linear in laps)
const slope = r => { const y = [r.k2, r.k3, r.k4, r.k5, r.k6]; if (y.some(v => v == null)) return null; const m = mean(y);
  return 100 * y.reduce((s, v, i) => s + (i - 2) * (v - m), 0) / 10 / r.ref; };
const trend = {};
for (const cls of CLASSES) {
  const all = rows.filter(r => r.cls === cls).map(slope).filter(v => v != null);
  trend[cls] = {all: {s: all.length ? med(all) : 0, n: all.length}};
  for (const t of TYPES) { const v = rows.filter(r => r.cls === cls && r.type === t).map(slope).filter(v => v != null); trend[cls][t] = v.length >= 30 ? {s: med(v), n: v.length} : {...trend[cls].all, pooled: true}; }
}
for (const r of rows) { r.s = trend[r.cls][r.type].s; r.y = r.raw + 1.5 * r.s; }

// event-cluster bootstrap of a statistic
function boot(list, stat, B = 2000) {
  const ev = [...new Set(list.map(r => r.event))], by = Object.fromEntries(ev.map(e => [e, list.filter(r => r.event === e)])), out = [];
  for (let b = 0; b < B; b++) { const s = []; for (let i = 0; i < ev.length; i++) s.push(...by[ev[Math.floor(rand() * ev.length)]]); const v = stat(s); if (Number.isFinite(v)) out.push(v); }
  return [q(out, 0.05), q(out, 0.95)];
}
const ols = L => { const x = L.map(r => r.trackC), y = L.map(r => r.y), mx = mean(x), my = mean(y), sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  return sxx > 0 ? x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / sxx : NaN; };
function summary(L) {
  if (!L.length) return null;
  const y = L.map(r => r.y), T = L.filter(r => Number.isFinite(r.trackC));
  return {n: L.length, events: new Set(L.map(r => r.event)).size, median: r3(med(y)), mean: r3(mean(y)), run90: [r3(q(y, 0.05)), r3(q(y, 0.95))],
    median90: boot(L, s => med(s.map(r => r.y))).map(r3), rawMedian: r3(med(L.map(r => r.raw))), trendPctPerLap: new Set(L.map(r => r.type)).size === 1 ? r3(L[0].s) : null,
    lap2MinusLap3Pct: r3(med(L.map(r => 100 * (r.k2 - r.k3) / r.ref))),
    tempSlopePctPerC: T.length >= 20 ? {slope: +ols(T).toFixed(4), ci90: boot(T, ols).map(v => +v.toFixed(4)), n: T.length,
      trackC: [r3(q(T.map(r => r.trackC), 0.05)), r3(q(T.map(r => r.trackC), 0.95))]} : null};
}
const table = {};
for (const cls of CLASSES) {
  const L = rows.filter(r => r.cls === cls); if (!L.length) continue;
  table[cls] = {all: summary(L), pq: summary(L.filter(r => r.type !== 'race'))};
  for (const t of TYPES) table[cls][t] = summary(L.filter(r => r.type === t));
  // race stops: tyre change unknown → split by pit time tertile (longer stop ≈ more work done, cooler tyres)
  const R = L.filter(r => r.type === 'race' && Number.isFinite(r.pitS));
  if (R.length >= 30) { const a = q(R.map(r => r.pitS), 1 / 3), b = q(R.map(r => r.pitS), 2 / 3);
    table[cls].racePitTertiles = [[0, a], [a, b], [b, Infinity]].map(([lo, hi]) => { const S = R.filter(r => r.pitS >= lo && r.pitS < hi); return {pitS: [r3(lo), hi === Infinity ? null : r3(hi)], n: S.length, median: r3(med(S.map(r => r.y)))}; }); }
}

// coefficient used by the flag (amendment 1): the median of practice runs per class, for practice and qualifying sessions
const coef = {wec: {}};
for (const cls of USED) { const p = table[cls]?.practice; if (p) { const v = {pct: p.median, n: p.n}; coef.wec[cls] = {all: v, practice: v, qualifying: v}; } }

// part B power check: leave one event out on 2023–25 practice/qualifying units (event × class × type), gain per event
const pq = rows.filter(r => r.type !== 'race' && USED.includes(r.cls));
const today = (r) => { const c = evolutionCoeffs('wec', r.track, r.type), P = {...c, session: r.type, gainPct: 0, curve: null, useCurve: false};
  return 100 * (evolutionDelta(P, 0, 1) - (evolutionDelta(P, 0, 2) + evolutionDelta(P, 0, 3)) / 2); };
const events = [...new Set(pq.map(r => r.event))], gains = [];
for (const e of events) {
  const train = pq.filter(r => r.event !== e), test = pq.filter(r => r.event === e), units = {};
  for (const r of test) (units[`${r.cls}|${r.type}`] ||= []).push(r);
  const e0 = [], e1 = [];
  for (const [k, U] of Object.entries(units)) {
    const [cls] = k.split('|'), cand = med(train.filter(r => r.cls === cls && r.type === 'practice').map(r => r.y));
    const y = mean(U.map(r => r.y)); e0.push(y - mean(U.map(today))); e1.push(y - cand);
  }
  if (e0.length) gains.push(mean(e0.map(v => v * v)) - mean(e1.map(v => v * v)));
}
const sd = Math.sqrt(gains.reduce((s, g) => s + (g - mean(gains)) ** 2, 0) / Math.max(1, gains.length - 1)), nHold = 6;
const power = {events: gains.length, meanGain: r3(mean(gains)), sdGain: r3(sd), nHold, mde: r3(1.84 * sd / Math.sqrt(nHold)), useful: 0.1,
  judgeable: 1.84 * sd / Math.sqrt(nHold) <= 0.1 || mean(gains) - 1.84 * sd / Math.sqrt(nHold) > 0.1};

const out = {source: D.source, rule: D.rule, runsKept: rows.length, runsFetched: D.runs.length, trend, table, coef, power};
writeFileSync('scripts/sim/data/learn/wec-warmup-coef-2023-2025.json', JSON.stringify(out) + '\n');
writeFileSync('worker/lapsim/evolution-warmup-data.js', `// Measured WEC warm-up: first push lap after a pit-out against laps 2–3 of the same run, per class and
// session type (% of the lap, fuel and rubber trend removed). Generated by scripts/sim/wec-warmup-stats.mjs
// from Al Kamel 2023–25 (scripts/sim/data/learn/wec-warmup-runs-2023-2025.json.gz). Do not edit by hand.
// Rules and gate: Project doc claude/gate-wec-warmup-evolution-prereg-2026-11-23.md.
// Flag: off until the evolution gate passes. Off → evolutionCoeffs / evolutionDelta are unchanged.
export const EVOLUTION_WARMUP_MEASURED = false;
export const lapsimEvolutionWarmup = ${JSON.stringify(coef)};
`);
const f = x => x == null ? '–' : String(x), iv = a => a ? `[${a.map(f).join(', ')}]` : '–', r4 = x => x == null ? null : +(+x).toFixed(4);
const md = ['# WEC warm-up after a pit-out (step 15-prep)', '', `Source: ${D.source}. Rule: Project doc ${D.rule}. Runs ${D.runs.length}, kept ${rows.length} (push filters, traffic guard). Generated by scripts/sim/wec-warmup-stats.mjs.`, '',
  'y = 100 (lap 1 − mean(lap 2, lap 3)) / mean + 1.5 s, s = in-stint trend (fuel + rubber + wear, median slope of laps 2–6). Intervals: 90 % of runs (p5–p95) and 90 % of the median (event-cluster bootstrap, 2000 draws).', '',
  '| Class | Sessions | Runs | Events | Median y % | Mean y % | 90 % runs | 90 % median | Raw median % | Trend s %/lap | Lap 2 − lap 3 % | Track-temp slope %/°C [90 %] |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const [cls, t] of Object.entries(table)) for (const k of TYPES) { const s = t[k]; if (!s) continue; const ts = s.tempSlopePctPerC;
  md.push(`| ${cls} | ${k} | ${s.n} | ${s.events} | ${f(s.median)} | ${f(s.mean)} | ${iv(s.run90)} | ${iv(s.median90)} | ${f(s.rawMedian)} | ${f(r4(trend[cls][k].s))} | ${f(s.lap2MinusLap3Pct)} | ${ts ? `${r4(ts.slope)} ${iv(ts.ci90.map(r4))}` : '–'} |`); }
if (existsSync(OLD)) { const O = JSON.parse(readFileSync(OLD, 'utf8'));
  md.push('', '## Old (own fetch, v1) vs new (this source), practice runs', '', '| Class | Old n / events | Old median [90 % median] | New n / events | New median [90 % median] |', '|---|---|---|---|---|');
  for (const cls of CLASSES) { const o = O.table[cls]?.practice, n = table[cls]?.practice; if (o || n) md.push(`| ${cls} | ${o ? `${o.n} / ${o.events}` : '–'} | ${o ? `${o.median} ${iv(o.median90)}` : '–'} | ${n ? `${n.n} / ${n.events}` : '–'} | ${n ? `${n.median} ${iv(n.median90)}` : '–'} |`); } }
md.push('', '## Race stops by pit time tertile (tyre change is not in the files; a longer stop is more often a tyre change)', '', '| Class | Pit time s | Runs | Median y % |', '|---|---|---|---|');
for (const [cls, t] of Object.entries(table)) for (const p of t.racePitTertiles || []) md.push(`| ${cls} | ${p.pitS[0]}–${p.pitS[1] ?? '∞'} | ${p.n} | ${f(p.median)} |`);
md.push('', '## Coefficient behind the flag (EVOLUTION_WARMUP_MEASURED, off): practice-run median, used for practice and qualifying', '', '| Class | % | Runs |', '|---|---|---|',
  ...Object.entries(coef.wec).map(([c, v]) => `| ${c} | ${v.practice.pct} | ${v.practice.n} |`), '',
  '## Power check (leave one event out, 2023–25 practice and qualifying units)', '', `Events ${power.events}, mean gain ${power.meanGain} pp², SD ${power.sdGain}, hold-out events ${nHold} (2026), MDE ${power.mde} against useful ${power.useful}: ${power.judgeable ? 'judgeable' : 'not judgeable'}.`, '',
  '## Error ledger and systematics', '',
  '- Statistical: the 90 % interval of the median (event-cluster bootstrap). Systematic, not corrected: (1) the trend term 1.5 s; laps 4–6 are not push-filtered, so the true value lies between the raw and the corrected median; (2) lap 2 is still slightly slower than lap 3 (small warm-up tail in the reference, gap slightly low); (3) race tyre changes are not in the files (pit-time tertiles).',
  '- Qualifying is a different run pattern (out-lap, preparation lap, push) and is reported only; the flag uses the practice median (amendment 1).',
  '- 2025 practice rows were already seen in step 7a (declared). 2026 is the closed hold-out.', '');
writeFileSync('docs/lapsim-evolution-warmup.md', md.join('\n'));
console.log(md.join('\n'));
