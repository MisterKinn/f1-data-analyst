// Step 35 G judge (docs/prereg/step35-fe-G-sector-proj-2026-11-26.md). Lane C (data-mapping fix) + FE sector report.
// Run order (one run): 1) cp fe-fit.json /tmp/G-fit-base.json  2) node scripts/sim/learn/fe-sector-lines-proj.mjs
// 3) LAPSIM_FE_AXLE=v1 LAPSIM_FE_BRAKE=on node scripts/sim/learn/build-fe.mjs  4) SAME_LAP=1 [FE_SECTOR_MAP=proj] fe-residual-audit.mjs ×2
// 5) node scripts/sim/learn/fe-sector-G-judge.mjs /tmp/G-fit-base.json out/fe-G-frac/fe-residual-audit.json out/fe-G-proj/fe-residual-audit.json
import {readFileSync, writeFileSync} from 'node:fs';
const [BF, AF, PF] = process.argv.slice(2), J = f => JSON.parse(readFileSync(f, 'utf8'));
const base = J(BF), cand = J('scripts/sim/data/learn/fe-fit.json'), A = J(AF).rows, P = J(PF).rows, SL = J('scripts/sim/data/learn/fe-sector-lines.json').tracks;
const mean = a => a.reduce((s, v) => s + v, 0) / a.length, rms = a => Math.sqrt(mean(a.map(v => v * v))), r = (x, d = 3) => +x.toFixed(d);
// lane C items 2–4 on the lap: paired |e| harm, layout bootstrap 2000, seed 35 (same LCG as fe-residual-audit), one-sided 95 % UB
const key = x => `${x.layout}|${x.season}|${x.key}|${x.session}`, C = Object.fromEntries(cand.rows.map(x => [key(x), x]));
const pr = base.rows.filter(x => x.key === 'fe-gen3evo').map(x => ({l: x.layout, d: Math.abs(C[key(x)].event) - Math.abs(x.event), w: C[key(x)].event - x.event}));
let seed = 35; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const boot = (items, stat) => { const lays = [...new Set(items.map(q => q.l))], out = [];
  for (let k = 0; k < 2000; k++) { const pick = lays.map(() => lays[Math.floor(rnd() * lays.length)]); out.push(stat(pick.flatMap(l => items.filter(q => q.l === l)))); }
  return out.sort((a, b) => a - b); };
const hb = boot(pr, a => mean(a.map(q => q.d))), harmUB = hb[Math.floor(0.95 * hb.length)];
const byTrack = {}; for (const q of pr) (byTrack[q.l] ||= []).push(q.w);
const worstTrack = Math.max(...Object.values(byTrack).map(mean));
const bound = (f, g) => JSON.stringify(f.boundHits ?? f.bounds ?? null) === JSON.stringify(g.boundHits ?? g.bounds ?? null);
const laneC = {fitByteIdentical: readFileSync(BF, 'utf8') === readFileSync('scripts/sim/data/learn/fe-fit.json', 'utf8'), harmMeanPp: r(mean(pr.map(q => q.d))), harmUB95Pp: r(harmUB),
  worstTrackPp: r(worstTrack), noNewBoundHit: bound(base, cand)};
laneC.pass = laneC.harmUB95Pp <= 0.10 && laneC.worstTrackPp <= 1.0 && laneC.noNewBoundHit; // item 1 (CI list) is checked outside
// sector report (not a pass criterion): duel-matched sector rows, % of lap, + = model too fast
const rowsOf = R => R.filter(x => x.sec).flatMap(x => x.sec.map((e, s) => ({l: x.layout, k: `${key(x)}|${s}`, s, e})));
const ra = rowsOf(A), rp = Object.fromEntries(rowsOf(P).map(q => [q.k, q.e])), paired = ra.map(q => ({...q, ep: rp[q.k]}));
const db = boot(paired, a => rms(a.map(q => q.ep)) - rms(a.map(q => q.e)));
const lays = [...new Set(paired.map(q => q.l))].map(l => { const a = paired.filter(q => q.l === l);
  return {layout: l, projected: SL[l]?.f1Proj != null, shiftM: SL[l]?.projShiftM ?? null, old: [0, 1, 2].map(s => r(mean(a.filter(q => q.s === s).map(q => q.e)), 2)), proj: [0, 1, 2].map(s => r(mean(a.filter(q => q.s === s).map(q => q.ep)), 2))}; });
const sectors = {nSectorRows: paired.length, nLayouts: lays.length, rmsOld: r(rms(paired.map(q => q.e))), rmsProj: r(rms(paired.map(q => q.ep))),
  dRms90: [r(db[Math.floor(0.05 * db.length)]), r(db[Math.floor(0.95 * db.length)])], lapSumUnchanged: A.every((x, i) => !x.sec || Math.abs(x.sec.reduce((a, v) => a + v, 0) - P[i].sec.reduce((a, v) => a + v, 0)) < 1e-9), layouts: lays};
// remainder ± into the FE sector floor: placement half-range u (label check where ≤ 150 m, else 30 m), standard uncertainty u/√3,
// time at the model speed of that line point (shares only); per sector the two bounding lines (finish = 0) in quadrature, % of lap
const floor = Object.fromEntries(lays.map(({layout: l}) => { const x = A.find(q => q.layout === l && q.sec), lab = SL[l]?.labelVsPrintedM;
  const u = lab != null && lab <= 150 ? lab : 30, t = x.vCut.map(v => u / Math.sqrt(3) / (v / 3.6)), pct = s => Math.sqrt([[0], [0, 1], [1]][s].reduce((a, i) => a + t[i] ** 2, 0)) / x.real * 100;
  return [l, {uM: u, vAtLinesKph: x.vCut.map(v => r(v, 0)), sectorPlacementPct: [0, 1, 2].map(s => r(pct(s), 2))}]; }));
const out = {prereg: 'docs/prereg/step35-fe-G-sector-proj-2026-11-26.md', laneC, sectors, placementFloor: floor};
writeFileSync('scripts/sim/data/learn/fe-sector-G-result.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify({laneC, sectors: {...sectors, layouts: undefined}}, null, 1));
