// Step 26 gate, attempt 3 of "F1 throttle rise + pick-up timing" (m = 5, α 0.01). Pre-registration: Project
// claude/prereg-step26-f1-throttle-timing-2026-11-24.md (sha256 e8eb36a3…407a) + amendment 1 (sha256 01f4a4fb…cb14).
// Candidate: DRV.f1 + {rise: [slow, medium, fast] 10->90 % (s), pick: lead (s)}, fitted leave-one-track-out on the 2025 pole laps through
// the page; judged on the 2023-24 pole laps (scripts/sim/data/f1-pole-tel-2023-2024.json) against the production page, 2025 car.
// Usage: node scripts/sim/learn/f1-throttle-loto.mjs --count   (hold-out n and MDE only; reads no model throttle)
//        node scripts/sim/learn/f1-throttle-loto.mjs            (the one run; writes scripts/sim/data/f1-throttle-loto-result.json)
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {lapsimF1RealTel} from '../../../worker/lapsim/f1-real-telemetry-data.js';
import {lapsimF1WetQuali} from '../../../worker/lapsim/f1-wet-quali-data.js';
import {isLockedF1} from '../locked-set.mjs';
import {cleanTel} from '../../../worker/lapsim/real-tel-gaps.js';
import {signFlip} from '../gate.mjs';
import {page, kapOf, metrics, pairs, med, BIN} from './f1-pedal-metrics.mjs';

const HO = 'scripts/sim/data/f1-pole-tel-2023-2024.json', body = readFileSync(HO, 'utf8');
const sha = createHash('sha256').update(body).digest('hex');
if (!readFileSync(HO + '.sha256', 'utf8').startsWith(sha)) throw new Error('hold-out table does not match its sha256');
const HOLD = JSON.parse(body).laps, PROD = {off: -0.598, up: 0.771, down: 0.675};
const RISE = Array.from({length: 11}, (_, k) => +(0.4 + 0.2 * k).toFixed(1)), PICK = [0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6];
const cfg = (r, p) => ({...PROD, rise: r, ...(p ? {pick: p} : {})});
const mean = a => { const g = a.filter(Number.isFinite); return g.length ? g.reduce((s, x) => s + x, 0) / g.length : NaN; };
const meas = r => { const c = cleanTel(r); return c.share > 0.5 ? null : c; };
const mLap = (c, r, kap) => metrics(c.x, c.speed.map(s => s / 3.6), c.throttle.map(Number), c.brake.map(b => b > 0 ? 1 : 0), r.len, kap);

// per lap scores of one model page against one measured lap: rise |e| (mean over measured-apex bins), throttle-on |e|, partial |e|, gap |e|
function score(M, S, mc) {
  const pr = pairs(M.corners.filter(e => !mc.near(e.s * mc.len)), S.corners), bins = [[[], []], [[], []], [[], []]], on = [[], []], gap = [[], []];
  for (const [m, p] of pr) { if (Number.isFinite(m.rise) && Number.isFinite(p.rise)) { bins[BIN(m.kph)][0].push(m.rise); bins[BIN(m.kph)][1].push(p.rise); }
    if (Number.isFinite(m.onApex) && Number.isFinite(p.onApex)) { on[0].push(m.onApex); on[1].push(p.onApex); }
    if (Number.isFinite(m.gap) && Number.isFinite(p.gap)) { gap[0].push(m.gap); gap[1].push(p.gap); } }
  return {rise: mean(bins.map(([a, b]) => a.length ? Math.abs(med(b) - med(a)) : NaN)), on: on[0].length ? Math.abs(med(on[1]) - med(on[0])) : NaN,
    part: Math.abs(S.part - M.part), gap: gap[0].length ? Math.abs(med(gap[1]) - med(gap[0])) : NaN, nPairs: pr.length};
}

// hold-out laps (measured side only)
const hold = {};
for (const [tr, ys] of Object.entries(HOLD)) for (const [y, r] of Object.entries(ys)) {
  const c = meas(r); if (!c) { console.log('dropped (more than half broken):', y, tr); continue; }
  (hold[tr] ||= []).push({y, r, c: Object.assign(c, {len: r.len})});
}
// count (amendment §A5): tracks with a usable lap and >= 1 corner matched to the page's speed-trace corners with a measured rise or throttle-on
// value; the page lane used is speed only (corner positions), no model throttle value and no gain is computed here
const P0 = {}, count = [];
for (const tr of Object.keys(hold).sort()) {
  P0[tr] = page(tr, '2025'); if (!P0[tr]) continue; const kap = kapOf(P0[tr].kappa);
  const sc = metrics(P0[tr].x, P0[tr].v, P0[tr].x.map(() => 0), P0[tr].x.map(() => 0), P0[tr].L, kap).corners; // speed-trace corners only
  let ok = false; for (const h of hold[tr]) { h.M = mLap(h.c, h.r, kap); for (const [m] of pairs(h.M.corners.filter(e => !h.c.near(e.s * h.r.len)), sc)) if (Number.isFinite(m.rise) || Number.isFinite(m.onApex)) ok = true; }
  if (ok) count.push(tr);
}
const n = count.length, MDE = sd => (2.326 + 0.842) * sd / Math.sqrt(n), power = {n, tracks: count, mdePrimary: MDE(0.306), mdeCo: MDE(0.129)};
console.log('hold-out n', n, 'MDE primary', power.mdePrimary.toFixed(3), 's, co-primary', power.mdeCo.toFixed(3), 's');
if (process.argv.includes('--count')) process.exit(0);
if (power.mdePrimary > 0.26) { console.log('not judgeable at this n (MDE > 0.26 s): stop'); process.exit(0); }

// training: 2025 measured pole laps, every grid config through the page (amendment §A6)
const train = {};
for (const tr of Object.keys(lapsimF1RealTel).sort()) {
  const r = lapsimF1RealTel[tr]['2025']; if (!r || lapsimF1WetQuali[tr]?.['2025'] || isLockedF1(tr, '2025')) continue;
  const c = meas(r); if (!c) continue; const base = page(tr, '2025'); if (!base) continue;
  const kap = kapOf(base.kappa), M = mLap(c, r, kap), mc = Object.assign(c, {len: r.len}), corners = M.corners.filter(e => !c.near(e.s * r.len));
  const grid = {};
  for (const rv of RISE) for (const pv of PICK) {
    const P = page(tr, '2025', cfg([rv, rv, rv], pv)); if (P.guard !== base.guard) throw new Error(`speed/brake lane changed: ${tr} ${rv} ${pv}`);
    grid[rv + '|' + pv] = pairs(corners, metrics(P.x, P.v, P.th, P.brOn, P.L, kap).corners).map(([, p]) => p);
  }
  // the pair list is the same for every config (corners are matched on the speed trace, which the guard keeps identical)
  train[tr] = {M, mc, kap, grid}; train[tr].ms = pairs(corners, metrics(base.x, base.v, base.th, base.brOn, base.L, kap).corners).map(([m]) => m);
  console.log('train', tr, train[tr].ms.length, 'corners');
}
// objective pieces on assembled corners: corner k takes its values from config (rise of the model-apex bin, pick)
function assembled(tracks, r, p) {
  const riseE = [[], [], []], onE = [];
  for (const tr of tracks) { const T = train[tr], b = [[[], []], [[], []], [[], []]], on = [[], []];
    T.ms.forEach((m, k) => { const pb = T.grid[RISE[0] + '|' + p][k], pk = T.grid[r[BIN(pb.kph)] + '|' + p][k];
      if (Number.isFinite(m.rise) && Number.isFinite(pk.rise)) { b[BIN(m.kph)][0].push(m.rise); b[BIN(m.kph)][1].push(pk.rise); }
      if (Number.isFinite(m.onApex) && Number.isFinite(pk.onApex)) { on[0].push(m.onApex); on[1].push(pk.onApex); } });
    b.forEach(([a, c], i) => { if (a.length) riseE[i].push(Math.abs(med(c) - med(a))); }); if (on[0].length) onE.push(Math.abs(med(on[1]) - med(on[0]))); }
  return {rise: riseE.map(mean), on: mean(onE)};
}
function fit(tracks) {
  let r = [RISE[0], RISE[0], RISE[0]], p = 0;
  for (let round = 0; round < 2; round++) {
    for (let b = 0; b < 3; b++) { let best = Infinity; for (const rv of RISE) { const rr = r.slice(); rr[b] = rv; const e = assembled(tracks, rr, p).rise[b]; if (e < best - 1e-12) { best = e; r = rr; } } }
    let best = Infinity, bp = p; for (const pv of PICK) { const e = assembled(tracks, r, pv).on; if (e < best - 1e-12) { best = e; bp = pv; } } p = bp; // PICK runs 0 -> -0.6: ties keep the value closer to 0
  }
  return {r, p, score: assembled(tracks, r, p)};
}
// direct check of a fitted config on its training tracks (§A6)
function direct(tracks, F) {
  const riseE = [[], [], []], onE = [];
  for (const tr of tracks) { const T = train[tr], P = page(tr, '2025', cfg(F.r, F.p)), b = [[[], []], [[], []], [[], []]], on = [[], []];
    pairs(T.M.corners.filter(e => !T.mc.near(e.s * T.mc.len)), metrics(P.x, P.v, P.th, P.brOn, P.L, T.kap).corners).forEach(([m, pk]) => {
      if (Number.isFinite(m.rise) && Number.isFinite(pk.rise)) { b[BIN(m.kph)][0].push(m.rise); b[BIN(m.kph)][1].push(pk.rise); }
      if (Number.isFinite(m.onApex) && Number.isFinite(pk.onApex)) { on[0].push(m.onApex); on[1].push(pk.onApex); } });
    b.forEach(([a, c], i) => { if (a.length) riseE[i].push(Math.abs(med(c) - med(a))); }); if (on[0].length) onE.push(Math.abs(med(on[1]) - med(on[0]))); }
  return {rise: riseE.map(mean), on: mean(onE)};
}
const steps = (P) => { let c = 0; for (let k = 1; k < P.th.length; k++) { const dt = (P.x[k] - P.x[k - 1]) / Math.max(1, P.v[k]); if (Math.abs(P.th[k] - P.th[k - 1]) > 50 && dt < 0.05) c++; } return c; };

// leave one track out
const units = [], folds = {};
for (const tr of count) {
  const F = fit(Object.keys(train).filter(t => t !== tr)), D = direct(Object.keys(train).filter(t => t !== tr), F);
  const diff = Math.max(...F.score.rise.map((x, i) => Math.abs(x - D.rise[i])).filter(Number.isFinite), Math.abs(F.score.on - D.on));
  folds[tr] = {rise: F.r, pick: F.p, assembled: F.score, direct: D, diff};
  const base = P0[tr], cand = page(tr, '2025', cfg(F.r, F.p)); if (cand.guard !== base.guard) throw new Error('speed/brake lane changed on hold-out ' + tr);
  const kap = kapOf(base.kappa), SB = metrics(base.x, base.v, base.th, base.brOn, base.L, kap), SC = metrics(cand.x, cand.v, cand.th, cand.brOn, cand.L, kap);
  const laps = hold[tr].map(h => ({y: h.y, base: score(h.M, SB, h.c), cand: score(h.M, SC, h.c)}));
  units.push({track: tr, laps, plaus: {base: steps(base), cand: steps(cand)}});
  console.log('fold', tr, JSON.stringify(folds[tr].rise), folds[tr].pick, 'diff', diff.toFixed(3));
}
// per track (seasons averaged), gains = baseline |e| − candidate |e|
const unitVal = (u, k, who, y) => mean(u.laps.filter(l => !y || l.y === y).map(l => l[who][k]));
let s = 26 >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const boot = g => { const v = g.filter(Number.isFinite), b = []; for (let i = 0; i < 10000; i++) { let t = 0; for (let j = 0; j < v.length; j++) t += v[Math.floor(rnd() * v.length)]; b.push(t / v.length); } b.sort((a, c) => a - c); return [b[249], b[9749]]; };
const report = y => Object.fromEntries(['rise', 'on', 'part', 'gap'].map(k => {
  const us = units.filter(u => u.laps.some(l => !y || l.y === y)), g = us.map(u => unitVal(u, k, 'base', y) - unitVal(u, k, 'cand', y)).filter(Number.isFinite);
  const sf = signFlip(g, {m: 5, iters: 100000, seed: 26});
  return [k, {n: g.length, gain: mean(g), ci95: boot(g), p: sf.p, baseMean: mean(us.map(u => unitVal(u, k, 'base', y))), candMean: mean(us.map(u => unitVal(u, k, 'cand', y))),
    baseMedian: med(us.map(u => unitVal(u, k, 'base', y))), candMedian: med(us.map(u => unitVal(u, k, 'cand', y)))}];
}));
const R = {pooled: report(null), y2023: report('2023'), y2024: report('2024')}, A = R.pooled;
const plaus = units.every(u => u.plaus.cand <= u.plaus.base);
const pass = {primary: A.rise.p < 0.01 && A.rise.gain > 0.26, co: A.on.p < 0.01 && A.on.gain > 0, coFloor: A.on.gain > 0.26, coCI: A.on.ci95[0] > -0.26,
  guardPart: A.part.ci95[0] > -0.02, plaus};
pass.all = pass.primary && pass.co && pass.guardPart && plaus;
const ship = pass.all ? fit(Object.keys(train)) : null;
// lap-time guard on every 2025 / 2026 page row with a measured pole lap: speed and brake lanes identical with the shipped table
let guardRows = 0;
if (ship) for (const y of ['2025', '2026']) for (const tr of Object.keys(lapsimF1RealTel)) { if (!lapsimF1RealTel[tr][y]) continue;
  const a = page(tr, y), b = page(tr, y, cfg(ship.r, ship.p)); if (!a) continue; if (a.guard !== b.guard) throw new Error('lap changed ' + tr + y); guardRows++; }
const out = {prereg: 'e8eb36a324b80e74295d1218486556dc546efb397d2ce0926b592d288658407a', amendment: '01f4a4fb1ea6ab06fdee18093def09c42398dbade089de2379ef62f5e9bfcb14',
  holdoutSha256: sha, power, folds, units, result: R, pass, ship: ship && {rise: ship.r, pick: ship.p}, guardRows};
writeFileSync('scripts/sim/data/f1-throttle-loto-result.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({result: R.pooled, pass, ship: out.ship, guardRows}, null, 1));
