// F1 wet/intermediate gap (W2-F): rebuilds the 13,697 measured wet-tyre laps from TracingInsights, checks them
// against the 928 W2-F group means, then runs the paired gates on the same laps:
//   A (constant per compound, one Grand Prix left out) vs the site today; A vs A with the evolution curve on top.
// In:  .cache/gpt-2026-11-18/w2f-wet-gap.json (W2-F bundle, git-ignored); TracingInsights season repos (cloned to .cache).
// Out: scripts/sim/data/wet-gap-gate.json (gate numbers only, no lap data). Run: node scripts/sim/wet-gap-gate.mjs
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {evolutionCoeffs, evolutionDelta} from '../../worker/lapsim/evolution.js';

const W2F = process.env.W2F || '.cache/gpt-2026-11-18/w2f-wet-gap.json', CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const OUT = 'scripts/sim/data/wet-gap-gate.json';
const W = JSON.parse(readFileSync(W2F, 'utf8')), L = W.lookup;
const nul = v => v === 'None' || v == null ? null : v;
const evKey = r => `${r.year}|${r.event}`, grpKey = r => [r.year, r.event, r.session, r.car_model, r.compound].join('|');

// 1. TracingInsights session files (sparse: one laptimes file per session)
const need = new Map();
for (const r of L) (need.get(r.year) || need.set(r.year, new Set()).get(r.year)).add(`${r.event}/${r.session}`);
for (const [y, ses] of need) {
  const dir = join(CACHE, 'ti-wet', String(y)), env = {...process.env, GIT_LFS_SKIP_SMUDGE: '1'};
  if (!existsSync(join(dir, '.git'))) execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', `https://github.com/TracingInsights/${y}`, dir], {stdio: 'inherit', env});
  execFileSync('git', ['-C', dir, 'sparse-checkout', 'set', '--no-cone', ...[...ses].flatMap(s => ['session_laptimes.json', 'session_info.json'].map(f => `/${s}/${f}`))], {stdio: 'inherit'});
  execFileSync('git', ['-C', dir, 'checkout', '-q'], {stdio: 'inherit', env});
}

// 2. W2 filters: valid time, no pit in/out, no race/sprint lap 1, not deleted, not generated, accurate, track status all-clear (1),
// inter/wet only; race and sprint laps fuel-corrected by 0.055 s per remaining scheduled lap
function sessionLaps(y, e, s) {
  const dir = join(CACHE, 'ti-wet', String(y), e, s), T = JSON.parse(readFileSync(join(dir, 'session_laptimes.json'), 'utf8'));
  const info = JSON.parse(readFileSync(join(dir, 'session_info.json'), 'utf8')), race = s === 'Race' || s === 'Sprint';
  const total = race ? (info.total_laps || Math.max(...T.lap)) : 0, out = [];
  T.lap.forEach((lap, i) => {
    const t = nul(T.time[i]), lst = nul(T.lST[i]);
    if (!Number.isFinite(t) || !Number.isFinite(lst) || nul(T.pin[i]) != null || nul(T.pout[i]) != null || (race && lap === 1)) return;
    if (T.del[i] === true || T.ff1G[i] === true || T.iacc[i] !== true || String(T.status[i]) !== '1') return;
    if (T.compound[i] !== 'INTERMEDIATE' && T.compound[i] !== 'WET') return;
    out.push({team: T.team[i], comp: T.compound[i], tc: t - 0.055 * (race ? total - lap : 0), minute: Math.round((lst - info.session_start_time) / 0.6) / 100});
  });
  return out;
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const laps = [];
const bySes = new Map(); for (const g of L) (bySes.get(`${g.year}|${g.event}|${g.session}`) || bySes.set(`${g.year}|${g.event}|${g.session}`, []).get(`${g.year}|${g.event}|${g.session}`)).push(g);
let dropped = 0;
for (const [k, groups] of bySes) {
  const [y, e, s] = k.split('|'), X = sessionLaps(+y, e, s), byTeam = new Map();
  for (const x of X) (byTeam.get(x.team + '|' + x.comp) || byTeam.set(x.team + '|' + x.comp, []).get(x.team + '|' + x.comp)).push(x);
  for (const g of groups) {
    const ok = a => a.length === g.n_laps && Math.abs(mean(a.map(z => z.tc)) - g.measured_mean_corrected_lap_s) < 1e-3;
    const teams = [...byTeam].filter(([tk]) => tk.endsWith('|' + g.compound)).map(([, a]) => a);
    let set = teams.find(ok);
    // 2023 Hungarian GP FP1: the archive has one fragment of a pit lap as a green lap (W2 removed it with the FIA timing sheet)
    if (!set) for (const a of teams.filter(a => a.length === g.n_laps + 1)) for (let j = 0; j < a.length && !set; j++) { const b = a.filter((_, i) => i !== j); if (ok(b)) { set = b; dropped++; } }
    if (!set) throw Error(`group not rebuilt: ${grpKey(g)}`);
    for (const z of set) laps.push({ev: evKey(g), year: g.year, compound: g.compound, covered: g.site_status === 'covered', gap: (z.tc / g.dry_reference_s - 1) * 100,
      minute: z.minute, track: g.site_track_id, type: g.site_session_type, grp: grpKey(g)});
  }
}
// group check: every W2-F group mean rebuilt (dry reference is rounded to 4 decimals in the bundle)
const gm = new Map(); for (const l of laps) (gm.get(l.grp) || gm.set(l.grp, []).get(l.grp)).push(l.gap);
const groupMaxDiffPp = Math.max(...L.map(g => Math.abs(mean(gm.get(grpKey(g))) - g.mean_gap_pct)));

// 3. site prediction today (tool path at 9e37dee: wetness 0, grid sample at or before the minute) and the exact evolution shape
for (const l of laps) if (l.covered) {
  const c = evolutionCoeffs('f1', l.track, l.type), qc = evolutionCoeffs('f1', l.track, 'qualifying'), endOf = x => x.curve ? x.curve.at(-1)[0] : 60;
  const P = {...c, session: l.type, tyre: l.compound === 'WET' ? 'wet' : 'inter', useCurve: !!c.curve, wetStart: 0, dryMin: 20, warmupLaps: 0};
  const ref = 1 + evolutionDelta({...qc, session: 'qualifying', useCurve: !!qc.curve}, endOf(qc)), step = Math.max(1, Math.round(l.minute / 12));
  let tg = 0; for (let t = 0; t <= Math.max(l.minute, 1) + 1e-9; t += step) tg = t;
  l.site = ((1 + evolutionDelta(P, tg)) / ref - 1) * 100;
  l.shape = ((1 + evolutionDelta(P, l.minute)) / ref - 1) * 100;
}

// 4. constants (lap means): leave one Grand Prix out, or train through 2025
const fitter = (val, keep = () => true) => {
  const S = new Map(), T = {};
  for (const l of laps) if (keep(l)) { const k = l.ev + '|' + l.compound, s = S.get(k) || S.set(k, [0, 0]).get(k), t = T[l.compound] ||= [0, 0], v = val(l); s[0] += v; s[1]++; t[0] += v; t[1]++; }
  return {loo: l => { const s = S.get(l.ev + '|' + l.compound) || [0, 0], t = T[l.compound]; return (t[0] - s[0]) / (t[1] - s[1]); }, all: c => T[c][0] / T[c][1]};
};
const sd = a => Math.sqrt(a.reduce((x, y) => x + (y - mean(a)) ** 2, 0) / (a.length - 1));
const r4 = x => Math.round(x * 1e4) / 1e4;
function gate(cand, base, rows) {
  const E = new Map(); for (const l of rows) { const e = E.get(l.ev) || E.set(l.ev, [[], []]).get(l.ev); e[0].push(Math.abs(l.gap - cand(l))); e[1].push(Math.abs(l.gap - base(l))); }
  const a = [...E.values()].map(e => mean(e[0])), b = [...E.values()].map(e => mean(e[1])), d = b.map((x, i) => x - a[i]), n = a.length;
  const gain = mean(d), se = sd(d) / Math.sqrt(n);
  return {laps: rows.length, events: n, candMae: r4(mean(a)), candSe: r4(sd(a) / Math.sqrt(n)), baseMae: r4(mean(b)), baseSe: r4(sd(b) / Math.sqrt(n)), gain: r4(gain), gainSe: r4(se), pass: gain > se};
}
const A = fitter(l => l.gap), A25 = fitter(l => l.gap, l => l.year <= 2025);
const resid = l => ((1 + l.gap / 100) / (1 + l.shape / 100) - 1) * 100, onTop = (a, l) => ((1 + a / 100) * (1 + l.shape / 100) - 1) * 100;
const R = fitter(resid, l => l.covered), R25 = fitter(resid, l => l.covered && l.year <= 2025);
const cov = laps.filter(l => l.covered), c26 = cov.filter(l => l.year === 2026);
const out = {generatedAt: new Date().toISOString(), source: 'TracingInsights lap times 2018-2026 (W2-F lap selection), W2-F groups',
  laps: laps.length, coveredLaps: cov.length, groups: L.length, groupMaxDiffPp: +groupMaxDiffPp.toExponential(2), fragmentsDropped: dropped,
  constants: {INTERMEDIATE: r4(A.all('INTERMEDIATE')), WET: r4(A.all('WET'))}, through2025: {INTERMEDIATE: r4(A25.all('INTERMEDIATE')), WET: r4(A25.all('WET'))},
  gates: {
    aVsSite: gate(l => A.loo(l), l => l.site, cov),
    aVsSite2026: gate(l => A25.all(l.compound), l => l.site, c26),
    evolutionOnTopVsA: gate(l => onTop(A.loo(l), l), l => A.loo(l), cov),
    evolutionOnTopRefitVsA: gate(l => onTop(R.loo(l), l), l => A.loo(l), cov),
    evolutionOnTopRefitVsA2026: gate(l => onTop(R25.all(l.compound), l), l => A25.all(l.compound), c26)}};
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
