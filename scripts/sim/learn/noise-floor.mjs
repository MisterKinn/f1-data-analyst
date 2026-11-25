// Measurement noise floor σ_meas of endurance lap and sector times, per class group and series (step 34, Project
// claude/prereg-step34-wec-imsa-2026-11-25.md §2; definition of 100 criterion 1). Measurement only: the tables are read, never changed.
//   node scripts/sim/learn/noise-floor.mjs [out.json]      (default out: probe-out/noise-floor.json)
// Estimators (fixed in the pre-registration before any number was read):
//  rep  repeat lap: one car, Qualifying then Hyperpole of the same event (WEC; ≥ 20 pairs over ≥ 3 events).
//       d = ln(best_b / best_a); the mean d of the other cars of its event × group × session pair (track evolution, tyres) is
//       removed (cells of ≥ 3 cars; one table per event, as both tables hold the same sessions under other names);
//       σ_rep = 1.4826 · MAD(residual) / √2 = the noise of ONE best lap, in % (and in s at the group's median lap).
//  ses  same session: g = ln(best / ideal) (ideal = sum of the car's best sectors); median per group, in %. One-sided, so it is a
//       scale of lap-to-lap execution, not a σ; reported next to rep and used only where rep has no pairs.
//  Sectors: the same rep estimator on s1, s2, s3 of the best lap (rows whose sectors add up to the lap within 0.06 s).
// Intervals: 90 % bootstrap over events (seed 20261125, 2000 draws).
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {dirname} from 'node:path';
import {SERIES} from '../../../worker/lapsim/series.js';

export const SEED = 20261125, BOOT = 2000, TABLES = ['endurance-cars.csv.gz', 'wec-alkamel-cars.csv.gz'].map(f => 'scripts/sim/data/learn/' + f);
const LMH = SERIES.wec.classes.lmh.manufacturers;
export function groupOf(r) {
  if ((r.cls === 'HYPERCAR' || r.cls === 'GTP') && +r.season >= 2023) return LMH.test(r.manufacturer || r.vehicle || '') ? 'lmh' : 'lmdh';
  if (/^(LMGT3|GTD|GTDPRO)$/.test(r.cls)) return 'gt3';
  if (/^LMP2/.test(r.cls)) return 'lmp2';
  return null;
}
export function csv(text) { const [h, ...L] = text.trim().split('\n'), k = h.split(','); return L.map(l => { const v = l.split(','); return Object.fromEntries(k.map((x, i) => [x, v[i] ?? ''])); }); }
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (s[(n - 1) >> 1] + s[n >> 1]) / 2 : NaN; };
export const madSigma = a => { const m = med(a); return 1.4826 * med(a.map(x => Math.abs(x - m))); };
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function loadQ(tables = TABLES) {
  // one table per event (the first that has it): the same session appears in both tables under other names
  const owner = new Map(), all = [];
  tables.forEach((f, i) => { for (const r of csv(gunzipSync(readFileSync(f)).toString())) { const e = [r.series, r.season, r.event].join('|'); if (!owner.has(e)) owner.set(e, i); if (owner.get(e) === i) all.push(r); } });
  return all.filter(r => r.type === 'Q' && +r.best > 0 && !(+r.rainShare > 0) && groupOf(r)).map(r => ({...r, group: groupOf(r), best: +r.best, ideal: +r.ideal || null,
    sec: [+r.s1, +r.s2, +r.s3].every(x => x > 0) && Math.abs(+r.s1 + +r.s2 + +r.s3 - +r.best) <= 0.06 ? [+r.s1, +r.s2, +r.s3] : null}));
}
// residuals of the repeat estimator: [{event, v}] with v = ln ratio minus its event × group × session-pair median; key picks the quantity
// pairs: Qualifying → Hyperpole only (same car, same crew by the sport rules; split qualifying in IMSA/ELMS runs other drivers)
const HP = /hyperpole/i;
export function repResiduals(rows, key) {
  const car = Object.groupBy(rows, r => [r.series, r.season, r.event, r.entry, r.group].join('|')), pairs = [];
  for (const rs of Object.values(car)) { const s = [...rs].sort((a, b) => a.session.localeCompare(b.session)); for (let i = 1; i < s.length; i++) { const a = key(s[i - 1]), b = key(s[i]); if (a > 0 && b > 0 && HP.test(s[i].session) && !HP.test(s[i - 1].session)) pairs.push({event: `${s[i].series}|${s[i].season}|${s[i].event}`, cell: `${s[i].series}|${s[i].season}|${s[i].event}|${s[i].group}|${s[i - 1].session}|${s[i].session}`, d: Math.log(b / a)}); } }
  // centre on the mean of the OTHER cars of the cell (a median centre makes one residual exactly 0); × √((n−1)/n) restores σ_d
  const cs = Object.fromEntries(Object.entries(Object.groupBy(pairs, p => p.cell)).map(([c, ps]) => [c, {n: ps.length, sum: ps.reduce((a, p) => a + p.d, 0)}]));
  return pairs.filter(p => cs[p.cell].n >= 3).map(p => { const {n, sum} = cs[p.cell]; return {event: p.event, v: (p.d - (sum - p.d) / (n - 1)) * Math.sqrt((n - 1) / n)}; });
}
function boot(res, stat, seed = SEED) {
  const ev = Object.values(Object.groupBy(res, r => r.event)), r = rng(seed), out = [];
  for (let i = 0; i < BOOT; i++) { const s = []; for (let j = 0; j < ev.length; j++) s.push(...ev[Math.floor(r() * ev.length)]); out.push(stat(s)); }
  out.sort((a, b) => a - b); return [out[Math.floor(0.05 * BOOT)], out[Math.min(BOOT - 1, Math.floor(0.95 * BOOT))]];
}
const r4 = x => Number.isFinite(x) ? +x.toFixed(4) : null;
export function floors(rows) {
  const out = {};
  for (const [k, R] of Object.entries(Object.groupBy(rows, r => r.group + ' ' + r.series)).sort()) {
    const lapMed = med(R.map(r => r.best)), o = {rows: R.length, events: new Set(R.map(r => r.season + r.event)).size, medianLapS: r4(lapMed)};
    const one = (key, ref) => { const res = repResiduals(R, key); if (res.length < 20 || new Set(res.map(x => x.event)).size < 3) return {pairs: res.length, note: 'fewer than 20 pairs or 3 events: no estimate'};
      const s = madSigma(res.map(x => x.v)) / Math.SQRT2, ci = boot(res, x => madSigma(x.map(y => y.v)) / Math.SQRT2);
      return {pairs: res.length, events: new Set(res.map(x => x.event)).size, sigmaPct: r4(100 * s), pi90Pct: ci.map(x => r4(100 * x)), sigmaS: r4(s * ref)}; };
    o.rep = {lap: one(r => r.best, lapMed), ...Object.fromEntries([0, 1, 2].map(i => ['s' + (i + 1), one(r => r.sec?.[i], med(R.filter(r => r.sec).map(r => r.sec[i])))]))};
    const g = R.filter(r => r.ideal && r.ideal <= r.best + 1e-9).map(r => ({event: r.season + r.event, v: Math.log(r.best / r.ideal)}));
    o.ses = g.length >= 10 ? {cars: g.length, medianPct: r4(100 * med(g.map(x => x.v))), pi90Pct: boot(g, x => med(x.map(y => y.v))).map(x => r4(100 * x)), medianS: r4(med(g.map(x => x.v)) * lapMed)} : {cars: g.length, note: 'fewer than 10 cars'};
    out[k] = o;
  }
  return out;
}

if (process.argv[1]?.endsWith('noise-floor.mjs')) {
  const out = process.argv[2] || 'probe-out/noise-floor.json', rows = loadQ();
  const res = {note: 'σ_meas per class group and series: rep = one best qualifying lap (repeat-lap estimator), ses = median best − ideal. Measured tables read only.', seed: SEED, draws: BOOT, rows: rows.length, floors: floors(rows)};
  mkdirSync(dirname(out), {recursive: true}); writeFileSync(out, JSON.stringify(res, null, 1));
  for (const [k, o] of Object.entries(res.floors)) console.log(k.padEnd(12), 'lap rep', o.rep.lap.sigmaPct ?? '–', '%', o.rep.lap.pi90Pct ?? '', `(${o.rep.lap.pairs} pairs)`, '| s1/s2/s3', ['s1', 's2', 's3'].map(s => o.rep[s].sigmaS ?? '–').join(' / '), 's | ses', o.ses.medianPct ?? '–', '%');
}
