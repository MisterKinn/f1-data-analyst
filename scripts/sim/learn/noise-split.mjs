// Split-half repeat noise floor from lap-by-lap Al Kamel files (step 34 A2 §3; Project claude/prereg-step34-A1-2026-11-25.md + repo
// docs/prereg/step34-A2-2026-11-25.md). Measurement only: the archive is read, nothing is changed.
//   node scripts/sim/learn/noise-split.mjs <imsa_data root at commit 1d7cee75…> [out.json.gz]
// Per qualifying session, car and driver: push laps = green flag, not into the pit, not the first lap of the session or after a pit
// stop, ≤ 102 % of that car-driver best; ≥ 4 laps; split odd / even in time order; d = ln(best_odd / best_even) (lap and S1/S2/S3).
// σ_split = 1.4826 · MAD(d) / √2. Writes the per-car table (scripts/sim/data/learn/noise-split.json.gz) that noise-floor.mjs reads.
import {readFileSync, readdirSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {SERIES} from '../../../worker/lapsim/series.js';

export const OUT = 'scripts/sim/data/learn/noise-split.json.gz', ARCHIVE_COMMIT = '1d7cee75654db2e22d7abf46fbb66ddfb1ae7439';
const LMH = SERIES.wec.classes.lmh.manufacturers;
// same helpers as noise-floor.mjs (kept here: noise-floor imports this module)
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (s[(n - 1) >> 1] + s[n >> 1]) / 2 : NaN; };
const madSigma = a => { const m = med(a); return 1.4826 * med(a.map(x => Math.abs(x - m))); };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function groupOf(cls, maker, season) {
  const c = cls.toUpperCase().replace(/\s+/g, '');
  if ((c === 'HYPERCAR' || c === 'GTP') && season >= 2023) return LMH.test(maker) ? 'lmh' : 'lmdh';
  if (/^(LMGT3|GTD|GTDPRO)$/.test(c)) return 'gt3';
  if (/^LMP2/.test(c)) return 'lmp2';
  return null;
}
const secs = t => { const p = String(t || '').trim().split(':').map(Number); return p.length && p.every(Number.isFinite) ? p.reduce((a, x) => a * 60 + x, 0) : NaN; };
const split = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if ((ch === ';' || ch === ',') && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o.map(x => x.trim()); };
function readLaps(f) {
  const L = readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()), H = split(L[0]).map(h => h.toUpperCase());
  const ix = k => H.indexOf(k);
  return L.slice(1).map(l => { const c = split(l), g = k => c[ix(k)] ?? ''; return {car: g('NUMBER'), drv: g('DRIVER_NAME'), lapNo: +g('LAP_NUMBER'), t: secs(g('LAP_TIME')),
    pitIn: g('CROSSING_FINISH_LINE_IN_PIT') !== '', flag: g('FLAG_AT_FL'), s: ['S1', 'S2', 'S3'].map(k => secs(g(k))), cls: g('CLASS'), maker: g('MANUFACTURER')}; });
}
// one row per qualifying session × car × driver with ≥ 4 push laps: {d: [lap, s1, s2, s3]}
export function rowsOf(root) {
  const out = [];
  for (const series of ['imsa', 'wec', 'elms']) { const base = join(root, 'data', series); if (!existsSync(base)) continue;
    for (const season of readdirSync(base).filter(y => /^20\d\d$/.test(y))) for (const ev of readdirSync(join(base, season))) {
      const dir = join(base, season, ev); let fs; try { fs = readdirSync(dir); } catch { continue; }
      for (const f of fs.filter(f => /-laps\.csv$/.test(f) && /qualif|hyperpole/i.test(f) && !/race/i.test(f))) {
        let laps; try { laps = readLaps(join(dir, f)); } catch { continue; }
        for (const [key, L] of Object.entries(Object.groupBy(laps, l => l.car + '|' + l.drv))) {
          const g = groupOf(L[0].cls, L[0].maker, +season); if (!g) continue;
          const byNo = new Map(L.map(l => [l.lapNo, l]));
          const ok = L.filter(l => l.flag === 'GF' && !l.pitIn && l.lapNo > 1 && !byNo.get(l.lapNo - 1)?.pitIn && l.t > 0).sort((a, b) => a.lapNo - b.lapNo);
          const best = Math.min(...ok.map(l => l.t)), push = ok.filter(l => l.t <= 1.02 * best);
          if (push.length < 4) continue;
          const half = k => push.filter((_, i) => i % 2 === k), bestOf = (H, j) => Math.min(...H.map(l => j < 0 ? l.t : l.s[j]).filter(x => x > 0));
          const d = [-1, 0, 1, 2].map(j => Math.log(bestOf(half(1), j) / bestOf(half(0), j)));
          out.push({series, season: +season, event: ev.replace(/^\d+-/, ''), session: f.replace(/-laps\.csv$/, ''), car: key.split('|')[0], group: g, n: push.length, best: +best.toFixed(3), d: d.map(x => Number.isFinite(x) ? +x.toFixed(6) : null)});
        } } } }
  return out;
}
export function summary(rows, seed = 20261125, B = 2000) {
  const res = {};
  for (const [k, R] of Object.entries(Object.groupBy(rows, r => r.group + ' ' + r.series)).sort()) {
    const ev = new Set(R.map(r => r.season + r.event)).size, o = {cars: R.length, events: ev, medianLapS: +[...R.map(r => r.best)].sort((a, b) => a - b)[R.length >> 1].toFixed(3)};
    if (R.length < 20 || ev < 3) { res[k] = {...o, note: 'fewer than 20 cars or 3 events: no estimate'}; continue; }
    for (const [j, name] of [[0, 'lap'], [1, 's1'], [2, 's2'], [3, 's3']]) {
      const v = R.map(r => r.d[j]).filter(Number.isFinite), s = madSigma(v) / Math.SQRT2;
      const evs = Object.values(Object.groupBy(R.filter(r => Number.isFinite(r.d[j])), r => r.season + r.event)), rr = rng(seed), bs = [];
      for (let b = 0; b < B; b++) { const x = []; for (let i = 0; i < evs.length; i++) x.push(...evs[Math.floor(rr() * evs.length)].map(r => r.d[j])); bs.push(madSigma(x) / Math.SQRT2); }
      bs.sort((a, b) => a - b);
      o[name] = {sigmaPct: +(100 * s).toFixed(4), pi90Pct: [bs[Math.floor(0.05 * B)], bs[Math.floor(0.95 * B)]].map(x => +(100 * x).toFixed(4)), ...(name === 'lap' ? {sigmaS: +(s * o.medianLapS).toFixed(4)} : {})};
    }
    res[k] = o;
  }
  return res;
}
if (process.argv[1]?.endsWith('noise-split.mjs')) {
  const rows = rowsOf(process.argv[2]), out = process.argv[3] || OUT;
  writeFileSync(out, gzipSync(JSON.stringify({source: 'github.com/tobi/imsa_data (Al Kamel lap-by-lap files), commit ' + ARCHIVE_COMMIT, method: 'step 34 A2 §3 split-half', rows})));
  const S = summary(rows); for (const [k, o] of Object.entries(S)) console.log(k.padEnd(11), `${o.cars} cars ${o.events} ev`, o.lap ? `lap σ ${o.lap.sigmaPct} % [${o.lap.pi90Pct}] (${o.lap.sigmaS} s) | S1/S2/S3 ${o.s1.sigmaPct}/${o.s2.sigmaPct}/${o.s3.sigmaPct} %` : o.note);
}
