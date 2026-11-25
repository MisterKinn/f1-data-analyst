// Step 35 FE residual audit (central 17:36, report only; no fit enters the model, measured data read-only).
// Splits the event-hidden FE lap error (fe-fit.json rows) into where the model spends its lap: corners by speed bin, traction,
// power-limited straights, braking, and energy/lift-off; plus per-track sign patterns. Same idea as the step 32 F1 audit, but FE has
// no telemetry: the only measured split is the three sector times.
//   node scripts/sim/learn/fe-residual-audit.mjs <fe-sector-lines.json> [fe-duel-rows.json] [outDir]
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
import {lapsimFeTracks} from '../../../worker/lapsim/fe-tracks-data.js';
import {feCarFor} from '../../../worker/lapsim/fe-cars.js';
import {parseCsv} from './build-endurance.mjs';

const [SLF, DUELF, OUT = 'out/fe-audit'] = process.argv.slice(2), D = 'scripts/sim/data/learn/'; mkdirSync(OUT, {recursive: true});
const K = lapsimKernel(), ALL = {...lapsimTracks, ...lapsimExtraTracks, ...lapsimFeTracks}, FIT = JSON.parse(readFileSync(D + 'fe-fit.json', 'utf8'));
const SL = JSON.parse(readFileSync(SLF, 'utf8')).tracks, DUEL = DUELF ? JSON.parse(readFileSync(DUELF, 'utf8')).files.flatMap(f => f.rows) : [];
const r = (x, d = 2) => Number.isFinite(x) ? +x.toFixed(d) : null, mean = a => a.reduce((s, v) => s + v, 0) / a.length, rms = a => Math.sqrt(mean(a.map(v => v * v)));
const ENV = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}); // shares only
const NAME = {'são paolo': 'São Paulo', 'mexico city': 'Mexico', madrid: 'Jarama'};
const venueOf = s => { const v = s.replace(/^R\d+\s+/, '').trim(); return NAME[v.toLowerCase()] || v; };
const sectorOk = l => SL[l] && (SL[l].labelVsPrintedM == null || SL[l].labelVsPrintedM <= 150); // A2 rule
// model phase per point (kernel limit: 0 lateral, 1 traction, 2 power, 3 braking). A corner = one run of non-power points (braking,
// apex, traction exit), binned by its minimum speed (as step 32 bins corners by v_min); a straight = power-limited points.
const BINS = ['corner<80', 'corner80-120', 'corner120-160', 'corner>=160', 'straight'], VB = kph => kph < 80 ? 0 : kph < 120 ? 1 : kph < 160 ? 2 : 3;
function binsOf(res) { const n = res.v.length, lim = res.limit, b = new Array(n).fill(4); let i0 = lim.findIndex(l => l === 2); if (i0 < 0) i0 = 0;
  for (let k = 0; k < n;) { const i = (i0 + k) % n; if (lim[i] === 2) { k++; continue; } let j = k, vmin = Infinity; while (j < n && lim[(i0 + j) % n] !== 2) { vmin = Math.min(vmin, res.v[(i0 + j) % n]); j++; }
    for (let q = k; q < j; q++) b[(i0 + q) % n] = VB(vmin * 3.6); k = j; }
  return b; }
function shares(lay, car) { // model time per bin and sector, as a fraction of the model lap
  const res = K.simulateLap(K.trackFromData(ALL[lay]), car, ENV), n = res.v.length, sl = SL[lay] || {f1: 1 / 3, f2: 2 / 3}, proj = process.env.FE_SECTOR_MAP === 'proj' && sl.f1Proj != null; // step 35 G
  const cut = [Math.round((proj ? sl.f1Proj : sl.f1) * n), Math.round((proj ? sl.f2Proj : sl.f2) * n)], x = [0, 1, 2].map(() => new Array(BINS.length).fill(0)), bi = binsOf(res);
  let brake = 0; for (let i = 0; i < n; i++) { const dt = (i + 1 < n ? res.time[i + 1] : res.lapTime) - res.time[i], s = i < cut[0] ? 0 : i < cut[1] ? 1 : 2;
    x[s][bi[i]] += dt / res.lapTime; if (res.limit[i] === 3) brake += dt / res.lapTime; }
  return {x, brake, energy: res.energy, vmax: res.vMaxKph, vCut: cut.map(i => res.v[Math.min(n - 1, i)] * 3.6)}; }

// measured sector shares: the duel lap itself (Season 11 duel rows), else the fastest dry group lap of that event (300 kW, rear drive)
const cars = parseCsv(gunzipSync(readFileSync(D + 'fe-cars.csv.gz')).toString()), grp = {};
for (const g of cars) { if (g.type !== 'Q' || !/Group/i.test(g.session) || +g.rainShare > 0.02 || ![g.best, g.s1, g.s2, g.s3].every(v => +v > 0)) continue;
  const lay = FIT.layouts.find(l => l.venue === venueOf(g.event) && Math.abs(+g.lenKm * 1000 / l.lengthM - 1) < 0.004)?.id; if (!lay) continue;
  const k = `${lay}|${g.season}`; if (!grp[k] || +g.best < +grp[k].best) grp[k] = g; }
const rows = FIT.rows.map(f => {
  const d = DUEL.find(q => Math.abs(q.time - f.real) < 0.0015), g0 = grp[`${f.layout}|${f.season}`], g = process.env.SAME_LAP && g0 && Math.abs(+g0.best - f.real) >= 0.0015 ? null : g0;
  const src = d ? 'duel lap' : g ? 'group best' : null, ss = d ? [d.s1, d.s2, d.s3] : g ? [+g.s1, +g.s2, +g.s3] : null;
  const S = shares(f.layout, feCarFor(f.key, f.season, f.session, 'Q'));
  const pred = f.real / (1 + f.event / 100); // event-hidden prediction (s)
  let sec = null;
  if (ss && sectorOk(f.layout)) { const sm = mean(ss) * 3, ms = S.x.map(b => b.reduce((a, v) => a + v, 0));
    sec = [0, 1, 2].map(s => (f.real * ss[s] / sm - pred * ms[s]) / f.real * 100); } // % of lap; + = model too fast; sums to the lap error
  return {layout: f.layout, season: f.season, key: f.key, kW: f.kW, session: f.session, real: f.real, eventPct: f.event, layoutOutPct: f.layoutOut, src, sec, x: S.x,
    lap: BINS.map((_, b) => S.x.reduce((a, s) => a + s[b], 0)), brakeShare: S.brake, regenJ: S.energy.regenJ, budgetJ: S.energy.budgetJ, vCut: S.vCut}; });

// least squares without intercept: sector error (% of lap) = Σ_b β_b · model time share in bin b; β = time error in that bin (%)
function ols(X, y) { const p = X[0].length, A = Array.from({length: p}, () => new Float64Array(p + 1));
  X.forEach((x, i) => { for (let a = 0; a < p; a++) { A[a][p] += x[a] * y[i]; for (let c = 0; c < p; c++) A[a][c] += x[a] * x[c]; } });
  for (let a = 0; a < p; a++) { A[a][a] += 1e-9; let m = a; for (let q = a + 1; q < p; q++) if (Math.abs(A[q][a]) > Math.abs(A[m][a])) m = q; [A[a], A[m]] = [A[m], A[a]];
    for (let q = 0; q < p; q++) if (q !== a) { const k = A[q][a] / A[a][a]; for (let c = a; c <= p; c++) A[q][c] -= k * A[a][c]; } }
  return A.map((row, a) => row[p] / row[a]); }
let seed = 35; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function decompose(sel, groups) { // groups: list of bin-index lists
  const SR = rows.filter(sel).filter(x => x.sec).flatMap(x => x.sec.map((e, s) => ({layout: x.layout, e, z: groups.map(g => g.reduce((a, b) => a + x.x[s][b], 0))})));
  const fitB = rs => ols(rs.map(q => q.z), rs.map(q => q.e)), beta = fitB(SR), lays = [...new Set(SR.map(q => q.layout))], draws = [];
  for (let k = 0; k < 2000; k++) { const pick = lays.map(() => lays[Math.floor(rnd() * lays.length)]), rs = pick.flatMap(l => SR.filter(q => q.layout === l)); const b = fitB(rs); if (b.every(Number.isFinite)) draws.push(b); }
  const ci = a => { const s = draws.map(b => b[a]).sort((p, q) => p - q); return [r(s[Math.floor(0.05 * s.length)]), r(s[Math.floor(0.95 * s.length)])]; };
  const fitted = SR.map(q => q.z.reduce((a, v, i) => a + v * beta[i], 0)), res = SR.map((q, i) => q.e - fitted[i]);
  return {nSectorRows: SR.length, nLayouts: lays.length, rmsSectorErr: r(rms(SR.map(q => q.e))), rmsAfterBins: r(rms(res)), beta: Object.fromEntries(groups.map((g, i) => [g.map(b => BINS[b]).join('+'), {betaPct: r(beta[i]), ci90: ci(i)}]))}; }
const G6 = [[0], [1], [2, 3], [4]], G3 = [[0, 1, 2, 3], [4]];
const evo = x => x.key === 'fe-gen3evo', any = () => true;
const decomp = {gen3evo6: decompose(evo, G6), all6: decompose(any, G6), all3: decompose(any, G3)};
// lap-level: how much of each lap error the sector-bin pattern explains (oracle: β fitted on the same rows)
const lapCheck = (sel, d, groups) => { const b = Object.values(d.beta).map(v => v.betaPct), L = rows.filter(sel).filter(x => x.sec);
  const comp = L.map(x => groups.map((g, i) => b[i] * g.reduce((a, k) => a + x.lap[k], 0)));
  return {nLaps: L.length, rmsLapErr: r(rms(L.map(x => x.eventPct))), rmsLapAfterBins: r(rms(L.map((x, i) => x.eventPct - comp[i].reduce((a, v) => a + v, 0)))),
    componentRms: Object.fromEntries(Object.keys(d.beta).map((k, i) => [k, r(rms(comp.map(c => c[i])))]))}; };
const lapLevel = {gen3evo6: lapCheck(evo, decomp.gen3evo6, G6), all6: lapCheck(any, decomp.all6, G6)};

// lap shares per bin vs the bare-model (layout-hidden) error across layouts: correlation, one point per layout (mean over rows)
const byLay = {}; for (const x of rows) (byLay[x.layout] ||= []).push(x);
const L = Object.entries(byLay).map(([l, a]) => ({layout: l, n: a.length, eventPct: a.map(x => r(x.eventPct)), signs: a.map(x => Math.sign(x.eventPct)).join(''),
  meanEvent: r(mean(a.map(x => x.eventPct))), meanLayoutOut: r(mean(a.map(x => x.layoutOutPct))), seasons: a.map(x => `${x.season}${x.key === 'fe-gen3' ? 'g3' : ''}`),
  sector: a.some(x => x.sec) ? [0, 1, 2].map(s => r(mean(a.filter(x => x.sec).map(x => x.sec[s])))) : null,
  share: Object.fromEntries(BINS.map((b, i) => [b, r(mean(a.map(x => x.lap[i])) * 100, 1)]))}));
const corr = (a, b) => { const ma = mean(a), mb = mean(b), sa = Math.sqrt(mean(a.map(v => (v - ma) ** 2))), sb = Math.sqrt(mean(b.map(v => (v - mb) ** 2))); return r(mean(a.map((v, i) => (v - ma) * (b[i] - mb))) / sa / sb); };
const crossLayout = Object.fromEntries(BINS.map(b => [b,
  {rWithLayoutOut: corr(L.map(x => x.share[b]), L.map(x => x.meanLayoutOut)), rWithEvent: corr(L.map(x => x.share[b]), L.map(x => x.meanEvent))}]));
// sign consistency: layouts with ≥ 2 rows whose event-hidden errors share one sign
const multi = L.filter(x => x.n >= 2), same = multi.filter(x => new Set(x.signs.replace(/0/g, '')).size === 1);
// oracle ceilings as step 32: one level per layout (in-sample mean) vs the sector-bin pattern
const ceil = {rmsEvent: r(rms(rows.map(x => x.eventPct))), oneLevelPerLayout: r(rms(rows.map(x => x.eventPct - mean(byLay[x.layout].map(q => q.eventPct)))))};
// energy / lift-off: qualifying laps run with no energy budget in the kernel (budgetJ 0) → lift-and-coast is 0 by construction
const energy = {qualiBudgetJ: [...new Set(rows.map(x => x.budgetJ))], liftOffShare: 0, regenKJmedian: r(rows.map(x => x.regenJ / 1e3).sort((a, b) => a - b)[rows.length >> 1], 0)};
const out = {note: 'report only; event-hidden FE lap error (fe-fit.json at upstream main); + = model too fast', bins: BINS, decomp, lapLevel, ceil, crossLayout,
  signs: {layoutsWith2plus: multi.length, sameSign: same.length, list: L.sort((a, b) => b.meanEvent - a.meanEvent)}, energy,
  sources: {duelLap: rows.filter(x => x.src === 'duel lap' && x.sec).length, groupBest: rows.filter(x => x.src === 'group best' && x.sec).length, noSectors: rows.filter(x => !x.sec).length}};
writeFileSync(OUT + '/fe-residual-audit.json', JSON.stringify({...out, rows}, null, 1));
console.log(JSON.stringify(out, null, 1));
