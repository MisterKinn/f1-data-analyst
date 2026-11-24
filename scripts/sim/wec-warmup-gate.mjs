// Step 15: the evolution fit's own gate for the measured WEC warm-up (Project doc
// claude/gate-wec-warmup-evolution-prereg-2026-11-23.md part B + amendment 1). Hold-out: 2026 WEC practice and qualifying.
//   node scripts/sim/wec-warmup-gate.mjs <runs-2026.json[.gz]>   (run table from wec-warmup-measure.mjs 2026, same Part A rule)
// Primary: per unit (event × class × session type) e = measured mean y − predicted lap-1 gap; gain per event =
// mean e_today² − mean e_cand²; signFlip m = 1, p < 0.16, n ≥ 5. Co-primary: best laps (lap ≥ 2) unchanged by the flag.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {evolutionCoeffs, evolutionDelta} from '../../worker/lapsim/evolution.js';
import {lapsimEvolution} from '../../worker/lapsim/evolution-data.js';
import {signFlip} from './gate.mjs';

const buf = readFileSync(process.argv[2]), D = JSON.parse((buf[0] === 0x1f ? gunzipSync(buf) : buf).toString('utf8'));
const T = JSON.parse(readFileSync('scripts/sim/data/learn/wec-warmup-coef-2023-2025.json', 'utf8')).trend;   // frozen tuning trend s
const USED = ['hypercar', 'lmp2', 'lmgt3'], mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (s[(n - 1) >> 1] + s[n >> 1]) / 2 : NaN; };
const r4 = x => Math.round(x * 1e4) / 1e4;

// Part A rule, unchanged: push filters, traffic guard, y = raw + 1.5 s with the tuning trend
const rows = D.runs.map(r => Object.fromEntries(D.columns.map((k, i) => [k, r[i]])))
  .filter(r => r.year === 2026 && r.type !== 'race' && USED.includes(r.cls))
  .filter(r => { const ref = (r.k2 + r.k3) / 2; return r.k2 <= 1.02 * r.best && r.k3 <= 1.02 * r.best && r.k1 <= 1.06 * r.best && Math.abs(r.k2 - r.k3) / ref <= 0.01; })
  .map(r => { const ref = (r.k2 + r.k3) / 2; return {...r, y: 100 * (r.k1 - ref) / ref + 1.5 * T[r.cls][r.type].s}; });

// predicted lap-1 gap against mean(lap 2, lap 3) from the warm-up term alone (rubber is in y's trend term)
const gap = c => { const P = {...c, gainPct: 0, curve: null, useCurve: false}; return 100 * (evolutionDelta(P, 0, 1) - (evolutionDelta(P, 0, 2) + evolutionDelta(P, 0, 3)) / 2); };
const units = {};
for (const r of rows) (units[`${r.track}|${r.cls}|${r.type}`] ||= []).push(r);
const byEvent = {}, table = [];
for (const [k, U] of Object.entries(units)) {
  const [track, cls, type] = k.split('|');
  const today = gap({...evolutionCoeffs('wec', track, type), session: type});
  const cand = gap({...evolutionCoeffs('wec', track, type, {cls, measuredWarmup: true}), session: type});
  const y = mean(U.map(r => r.y)), e0 = y - today, e1 = y - cand;
  table.push({track, cls, type, n: U.length, measuredMean: r4(y), measuredMedian: r4(med(U.map(r => r.y))), today: r4(today), cand: r4(cand), e0: r4(e0), e1: r4(e1)});
  (byEvent[track] ||= []).push([e0, e1]);
}
const gains = Object.values(byEvent).map(E => mean(E.map(([a]) => a * a)) - mean(E.map(([, b]) => b * b)));
const verdict = signFlip(gains, {m: 1, minRows: 5});

// co-primary: the flag must not change the best lap (k = 3, 5, ∞) on any WEC track, session, class, minute.
// Lap 2 does change (today warmupLaps 2 puts half the term on lap 2; the candidate puts it on lap 1 only): reported.
let maxBest = 0, maxLap2 = 0, checked = 0;
for (const track of [null, ...Object.keys(lapsimEvolution.series.wec?.tracks || {})]) for (const type of ['practice', 'qualifying'])
  for (const cls of USED) {
    const off = {...evolutionCoeffs('wec', track, type), session: type}, on = {...evolutionCoeffs('wec', track, type, {cls, measuredWarmup: true}), session: type};
    const d = (m, k) => Math.abs(evolutionDelta({...off, useCurve: !!off.curve}, m, k) - evolutionDelta({...on, useCurve: !!on.curve}, m, k));
    for (const m of [0, 10, 30, 60, 90]) { maxLap2 = Math.max(maxLap2, d(m, 2)); for (const k of [3, 5, Infinity]) { maxBest = Math.max(maxBest, d(m, k)); checked++; } }
  }
const rms = a => Math.sqrt(mean(a.map(x => x * x)));
console.log(JSON.stringify({heldOut: {runs: rows.length, units: table.length, events: gains.length},
  primary: {rmsToday: r4(rms(table.map(u => u.e0))), rmsCand: r4(rms(table.map(u => u.e1))),
    medianAbsToday: r4(med(table.map(u => Math.abs(u.e0)))), medianAbsCand: r4(med(table.map(u => Math.abs(u.e1)))),
    gainsPerEvent: Object.fromEntries(Object.keys(byEvent).map((e, i) => [e, r4(gains[i])])), signFlip: verdict},
  bestLap: {checked, maxAbsDeltaFraction: maxBest, unchanged: maxBest === 0, lap2MaxAbsDeltaPct: r4(100 * maxLap2)}, boundHits: 'none (no fitted parameter; coefficients are medians)', table}, null, 1));
