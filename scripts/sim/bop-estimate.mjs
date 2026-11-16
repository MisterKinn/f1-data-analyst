// WEC Hypercar 2026 BoP estimate (FIA/ACO stopped publishing it from Imola 2026).
// Learns from every Al Kamel lap 2024-2026 (scripts/sim/data/learn/wec-bop-pace.txt) and the published
// 2024-2025 BoP (worker/lapsim/wec-bop-data.js), then inverts the learned relation for each 2026 event.
//   pace   L = u(model, season) + a*dkg% + b*dP%                     (L: model's best lap vs field median, %)
//   speed  V = w(model, season) + c*dPhigh% + e*dkg%                  (V: model's top speed vs field median, %; dPhigh = power above 250 km/h)
//   energy dMJ% = f*dP% + g*dkg%                                      (stint energy follows power and weight)
// u, w: what the car does with an equal BoP (fixed effect per model and season); a..g: one set for the whole class.
// The 2026 BoP of each event is the MAP estimate: these two measurements plus a prior (previous event estimate,
// mixed with the 2025 BoP at the same track), inside the regulation limits (LMH/LMDh Art. 4.1 minimum weight 1030 kg;
// power never above 520 kW in any published table). Hold-out test: every 2025 event estimated the same way.
// Writes worker/lapsim/bop-estimate-data.js. Usage: node scripts/sim/bop-estimate.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimWecBop} from '../../worker/lapsim/wec-bop-data.js';

const TRACK = {LOSAIL: 'lusail', IMOLA: 'imola', SPA: 'spa-francorchamps', LEMANS: 'le-mans', SAOPAULO: 'interlagos', COTA: 'austin', FUJI: 'fuji', BAHRAIN: 'sakhir', BARCELONA: 'barcelona', MONZA: 'monza', SILVERSTONE: 'silverstone'};
const MODEL = {Alpine: 'Alpine A424', Aston: 'Aston Martin Valkyrie', BMW: 'BMW M Hybrid V8', Cadillac: 'Cadillac V-Series.R', Ferrari: 'Ferrari 499P', Peugeot: 'Peugeot 9X8', Porsche: 'Porsche 963', Toyota: 'Toyota GR010 Hybrid', Lamborghini: 'Lamborghini SC63', Isotta: 'Isotta Fraschini Tipo6-C', Genesis: 'Genesis GMR-001'};
const CLS = {'Alpine A424': 'lmdh', 'BMW M Hybrid V8': 'lmdh', 'Cadillac V-Series.R': 'lmdh', 'Porsche 963': 'lmdh', 'Lamborghini SC63': 'lmdh', 'Genesis GMR-001': 'lmdh', 'Aston Martin Valkyrie': 'lmh', 'Ferrari 499P': 'lmh', 'Peugeot 9X8': 'lmh', 'Toyota GR010 Hybrid': 'lmh', 'Isotta Fraschini Tipo6-C': 'lmh'};
const EVENTS_2026 = ['IMOLA', 'SPA', 'LEMANS', 'SAOPAULO', 'COTA', 'FUJI', 'BARCELONA', 'MONZA'];
// Evo jokers and re-homologations (owner 2026-11-16: updates enter the BoP learning, the 2026 table and the projection). A spec starts at
// [year, first event]; the car's fixed performance level belongs to model + season + spec. Sources: Autosport "who is introducing updates
// in 2026" (Dec 2025), The Race "who else can still upgrade" (2025), Sportscar365 "Ferrari reveals plans for major 499P overhaul in 2027",
// Motorsport.com "Aston Martin begins testing updated Valkyrie for 2027", Autosport "Ferrari and Peugeot start testing updated hypercars
// for WEC 2027". Porsche used two jokers since 2023 (dates not given) and left WEC after 2025: no break inside the data.
const ORDER = {LOSAIL: 0, QATAR: 0, IMOLA: 1, SILVERSTONE: 1.5, SPA: 2, LEMANS: 3, SAOPAULO: 4, COTA: 5, FUJI: 6, BAHRAIN: 7, BARCELONA: 7, MONZA: 8};
export const SPECS = {
  'Toyota GR010 Hybrid': [[2026, 'IMOLA', 'Evo 2026 (aero joker, TR010)']],
  'Cadillac V-Series.R': [[2025, 'LOSAIL', 'joker 2025 (electronics)'], [2026, 'IMOLA', 'Evo 2026 (aero)']],
  'BMW M Hybrid V8': [[2025, 'LOSAIL', 'joker 2025'], [2026, 'IMOLA', 'Evo 2026 (nose and splitter)']],
  'Alpine A424': [[2025, 'LOSAIL', 'joker 2025 (power unit)'], [2026, 'IMOLA', 'Evo 2026']],
  'Ferrari 499P': [[2024, 'SAOPAULO', 'joker 2024 (brake cooling)'], [2027, 'LOSAIL', 'Evo 2027 (three jokers, aero)']],
  'Peugeot 9X8': [[2024, 'IMOLA', '2024 car with rear wing (new homologation)'], [2025, 'LOSAIL', '2025 updates'], [2027, 'LOSAIL', 'Evo 2027 (planned)']],
  'Aston Martin Valkyrie': [[2027, 'LOSAIL', 'Evo 2027 (first jokers)']],
};
const specOf = (m, y, ev) => { let s = 'base'; for (const [yy, e, name] of SPECS[m] || []) if (y > yy || (y === yy && (ORDER[ev] ?? 0) >= (ORDER[e] ?? 0))) s = name; return s; };
const keyOf = (m, y, ev) => `${m} ${y} ${specOf(m, y, ev)}`;
const LIMITS = {kgMin: 1030, kWMax: 520, kWMin: 470};
const PRIOR_SD = {kg: 12, kW: 8, g: 2.5}; // spread of one event-to-event BoP change in 2024-2025 (checked below)

const num = s => s === '-' || s === undefined ? null : +s;
const med = a => { a = a.filter(x => x != null).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const r1 = x => Math.round(x * 10) / 10;

// ---- measurements per event and model
const rows = readFileSync(new URL('./data/learn/wec-bop-pace.txt', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => {
  const [y, ev, car, m, q, r, t, st] = l.split(' ');
  return {y: +y, ev, car, model: MODEL[m], q: num(q), r: num(r), t: num(t), st: num(st)};
});
const events = {};
for (const x of rows) ((events[`${x.y} ${x.ev}`] ||= {y: x.y, ev: x.ev, track: TRACK[x.ev], cars: []}).cars.push(x));
for (const e of Object.values(events)) {
  const mq = med(e.cars.map(c => c.q)), mr = med(e.cars.map(c => c.r)), mt = med(e.cars.map(c => c.t)), ms = med(e.cars.map(c => c.st));
  e.models = {};
  for (const model of new Set(e.cars.map(c => c.model))) {
    const cs = e.cars.filter(c => c.model === model);
    const lq = mq && cs.some(c => c.q) ? 100 * (Math.min(...cs.filter(c => c.q).map(c => c.q)) / mq - 1) : null;
    const lr = 100 * (Math.min(...cs.map(c => c.r)) / mr - 1);
    // qualifying laps can be wrecked by red flags/traffic: trust the race when the two disagree by > 0.6 %
    const L = lq == null || Math.abs(lq - lr) > 0.6 ? lr : 0.6 * lr + 0.4 * lq;
    const vs = cs.map(c => 100 * (c.t / mt - 1));
    const V = Math.max(...vs) - Math.min(...vs) > 3 ? null : mean(vs); // wet/mixed sessions give two cars of one model >3 % apart: unusable
    e.models[model] = {L, V, stint: Math.max(...cs.map(c => c.st ?? 0)) || null, stintField: ms, cars: cs.map(c => c.car)};
  }
}

// ---- published BoP relative to the event mean
const bopOf = (y, track) => lapsimWecBop[track]?.[String(y)]?.cars || null;
const gainOf = b => b.above250 ?? b.above210 ?? 0;
function rel(b) {
  const ms = Object.keys(b), kg = mean(ms.map(m => b[m].kg)), kW = mean(ms.map(m => b[m].kW)), MJ = mean(ms.map(m => b[m].MJ).filter(Boolean)), g = mean(ms.map(m => gainOf(b[m])));
  return Object.fromEntries(ms.map(m => [m, {dkg: 100 * (b[m].kg / kg - 1), dP: 100 * (b[m].kW / kW - 1), dPh: 100 * (b[m].kW * (1 + gainOf(b[m]) / 100) / (kW * (1 + g / 100)) - 1), dMJ: b[m].MJ ? 100 * (b[m].MJ / MJ - 1) : null}]));
}

// ---- learn the class-wide coefficients (within each model-season, so the fixed effects drop out)
function fitClass(skip) {
  const obs = [];
  for (const e of Object.values(events)) {
    if (e.y > 2025 || e.ev === skip?.ev && e.y === skip?.y) continue;
    const b = bopOf(e.y, e.track); if (!b) continue; const rb = rel(b);
    for (const [m, o] of Object.entries(e.models)) if (rb[m]) obs.push({key: keyOf(m, e.y, e.ev), ...o, ...rb[m]});
  }
  const groups = {}; for (const o of obs) (groups[o.key] ||= []).push(o);
  const dm = (list, f) => { const mu = mean(list.map(f)); return list.map(o => f(o) - mu); };
  const X = [], Y = [], XV = [], YV = [], XE = [], YE = [];
  const fe = {};
  for (const [k, list] of Object.entries(groups)) {
    if (list.length < 2) continue;
    const a = dm(list, o => o.dkg), p = dm(list, o => o.dP), l = dm(list, o => o.L);
    list.forEach((o, i) => { X.push([a[i], p[i]]); Y.push(l[i]); });
    const lv = list.filter(o => o.V != null);
    if (lv.length > 1) { const ph = dm(lv, o => o.dPh), av = dm(lv, o => o.dkg), v = dm(lv, o => o.V); lv.forEach((o, i) => { XV.push([ph[i], av[i]]); YV.push(v[i]); }); }
    fe[k] = list;
  }
  for (const o of obs) if (o.dMJ != null) { XE.push([o.dP, o.dkg]); YE.push(o.dMJ); }
  const [a, b] = ols(X, Y), [c, e] = ols(XV, YV), [f, g] = ols(XE, YE);
  const resid = (Xs, Ys, k) => Math.sqrt(mean(Xs.map((x, i) => (Ys[i] - x[0] * k[0] - x[1] * k[1]) ** 2)));
  const coef = {a, b, c, e, f, g, sdL: resid(X, Y, [a, b]), sdV: resid(XV, YV, [c, e]), sdE: resid(XE, YE, [f, g]), n: X.length};
  // fixed effects: mean of what is left after the BoP part, per model and season
  const u = {}, w = {};
  for (const [k, list] of Object.entries(groups)) {
    u[k] = mean(list.map(o => o.L - a * o.dkg - b * o.dP));
    const lv = list.filter(o => o.V != null); if (lv.length) w[k] = mean(lv.map(o => o.V - c * o.dPh - e * o.dkg));
  }
  return {coef, u, w, X, Y};
}
function ols(X, Y) { // two regressors, no intercept
  let s11 = 0, s12 = 0, s22 = 0, t1 = 0, t2 = 0;
  X.forEach((x, i) => { s11 += x[0] * x[0]; s12 += x[0] * x[1]; s22 += x[1] * x[1]; t1 += x[0] * Y[i]; t2 += x[1] * Y[i]; });
  const det = s11 * s22 - s12 * s12; return [(s22 * t1 - s12 * t2) / det, (s11 * t2 - s12 * t1) / det];
}
function solve3(A, y) { // Gaussian elimination
  const M = A.map((r, i) => [...r, y[i]]), n = 3;
  for (let i = 0; i < n; i++) { let p = i; for (let j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j; [M[i], M[p]] = [M[p], M[i]];
    for (let j = i + 1; j < n; j++) { const f = M[j][i] / M[i][i]; for (let k = i; k <= n; k++) M[j][k] -= f * M[i][k]; } }
  const x = [0, 0, 0]; for (let i = n - 1; i >= 0; i--) { x[i] = (M[i][n] - M[i].slice(i + 1, n).reduce((s, v, k) => s + v * x[i + 1 + k], 0)) / M[i][i]; } return x;
}

// ---- one event: MAP estimate of (kg, kW, gain) per model
function estimate(e, prior, fit, look) {
  const {coef} = fit, models = Object.keys(e.models).filter(m => prior[m]);
  const kg0 = mean(models.map(m => prior[m].kg)), kW0 = mean(models.map(m => prior[m].kW)), g0 = mean(models.map(m => prior[m].g));
  const out = {};
  for (const m of models) {
    const o = e.models[m], p = prior[m];
    const {u, w, known, spec} = look(m);
    // unknowns x = [dkg%, dP%, gain pts] relative to the event mean; prior in the same units
    const xp = [100 * (p.kg / kg0 - 1), 100 * (p.kW / kW0 - 1), p.g - g0];
    const sp = [100 * PRIOR_SD.kg / kg0, 100 * PRIOR_SD.kW / kW0, PRIOR_SD.g].map(s => s * (known ? 1 : 1.5));
    const A = [[1 / sp[0] ** 2, 0, 0], [0, 1 / sp[1] ** 2, 0], [0, 0, 1 / sp[2] ** 2]], y = xp.map((v, i) => v / sp[i] ** 2);
    const add = (h, val, sd) => { for (let i = 0; i < 3; i++) { y[i] += h[i] * val / sd ** 2; for (let j = 0; j < 3; j++) A[i][j] += h[i] * h[j] / sd ** 2; } };
    if (o.L != null) add([coef.a, coef.b, 0], o.L - u, coef.sdL * (known ? 1 : 2));
    // dPhigh% = dP% + gain pts (first order)
    if (o.V != null) add([coef.e, coef.c, coef.c], o.V - w, coef.sdV * (known ? 1 : 2));
    const x = solve3(A, y);
    let kg = kg0 * (1 + x[0] / 100), kW = kW0 * (1 + x[1] / 100), g = g0 + x[2];
    kg = Math.max(LIMITS.kgMin, kg); kW = Math.min(LIMITS.kWMax, Math.max(LIMITS.kWMin, kW));
    // posterior sd of each parameter (diagonal of A^-1, via unit solves)
    const sd = [0, 1, 2].map(i => Math.sqrt(solve3(A, [0, 1, 2].map(j => +(i === j)))[i]));
    const MJ = p.MJ * (1 + (coef.f * (100 * (kW / p.kW - 1)) + coef.g * (100 * (kg / p.kg - 1))) / 100);
    out[m] = {cls: CLS[m], kg: Math.round(kg), kW: Math.round(kW), above250: r1(g), MJ: Math.round(MJ),
      sd: {kg: Math.round(sd[0] * kg0 / 100), kW: Math.round(sd[1] * kW0 / 100), above250: r1(sd[2])},
      evidence: {pacePct: o.L == null ? null : +o.L.toFixed(2), speedPct: o.V == null ? null : +o.V.toFixed(2), longestGreenStint: o.stint, cars: o.cars},
      learned: known, spec, priorFrom: p.from};
  }
  return out;
}
const priorFromBop = (b, from) => Object.fromEntries(Object.entries(b).map(([m, v]) => [m, {kg: v.kg, kW: v.kW, g: gainOf(v), MJ: v.MJ, from}]));
function mix(a, b, wa = 0.5) { // per model; a model missing in one side keeps the other
  const out = {}; for (const m of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = a?.[m], y = b?.[m]; out[m] = x && y ? {kg: wa * x.kg + (1 - wa) * y.kg, kW: wa * x.kW + (1 - wa) * y.kW, g: wa * x.g + (1 - wa) * y.g, MJ: wa * x.MJ + (1 - wa) * y.MJ, from: `${x.from} + ${y.from}`} : {...(x || y)};
  } return out;
}
const classMean = pr => { const v = Object.values(pr); return {kg: mean(v.map(x => x.kg)), kW: mean(v.map(x => x.kW)), g: mean(v.map(x => x.g)), MJ: mean(v.map(x => x.MJ)), from: 'class mean (new car)'}; };

// ---- hold-out test on 2025: each event hidden from the fit, prior = previous 2025 event BoP + same track 2024
const order25 = ['LOSAIL', 'IMOLA', 'SPA', 'LEMANS', 'SAOPAULO', 'FUJI', 'BAHRAIN'];
const test = [];
for (let i = 1; i < order25.length; i++) {
  const ev = order25[i], e = events[`2025 ${ev}`], truth = bopOf(2025, e.track); if (!truth) continue;
  const fit = fitClass({y: 2025, ev});
  let prior = mix(priorFromBop(bopOf(2025, TRACK[order25[i - 1]]), 'previous event'), bopOf(2024, e.track) ? priorFromBop(bopOf(2024, e.track), 'same track 2024') : null);
  for (const m of Object.keys(e.models)) if (!prior[m] && truth[m]) prior[m] = classMean(prior);
  const est = estimate(e, prior, fit, m => { const k = keyOf(m, 2025, ev); return {u: fit.u[k] ?? 0, w: fit.w[k] ?? 0, known: k in fit.u, spec: specOf(m, 2025, ev)}; });
  for (const [m, x] of Object.entries(est)) if (truth[m]) test.push({ev, m, ekg: x.kg - truth[m].kg, ekW: x.kW - truth[m].kW, eg: x.above250 - gainOf(truth[m]), eMJ: x.MJ - truth[m].MJ,
    pkg: Math.round(prior[m].kg) - truth[m].kg, pkW: Math.round(prior[m].kW) - truth[m].kW, pg: prior[m].g - gainOf(truth[m]), pMJ: Math.round(prior[m].MJ) - truth[m].MJ});
}
const mae = k => +mean(test.map(t => Math.abs(t[k]))).toFixed(1);
const holdout = {cases: test.length, model: {kg: mae('ekg'), kW: mae('ekW'), above250: mae('eg'), MJ: mae('eMJ')}, priorOnly: {kg: mae('pkg'), kW: mae('pkW'), above250: mae('pg'), MJ: mae('pMJ')}};
// a learned part is used only where it beats the prior alone (learning must not make the estimate worse)
const use = {kg: holdout.model.kg <= holdout.priorOnly.kg, kW: holdout.model.kW <= holdout.priorOnly.kW, above250: holdout.model.above250 <= holdout.priorOnly.above250, MJ: holdout.model.MJ <= holdout.priorOnly.MJ};

// ---- 2026: fit on all of 2024-2025, chain the events
const fit = fitClass(null);
// Evo effect learned from 2024 → 2025: change of a model's level (pace vs field after BoP, %) with a new spec vs without one
const lastKey = (m, y) => { const ks = Object.keys(fit.u).filter(k => k.startsWith(m + ' ' + y + ' ')); return ks.find(k => k.endsWith(' ' + specOf(m, y, 'BAHRAIN'))) || ks.at(-1); };
const dU = Object.keys(SPECS).concat(['Porsche 963']).map(m => { const a = lastKey(m, 2024), b = Object.keys(fit.u).find(k => k.startsWith(m + ' 2025 ')); return a && b ? {m, d: fit.u[b] - fit.u[a], evo: specOf(m, 2025, 'LOSAIL') !== specOf(m, 2024, 'BAHRAIN')} : null; }).filter(Boolean);
const evoD = dU.filter(x => x.evo).map(x => x.d), sameD = dU.filter(x => !x.evo).map(x => x.d);
const EVO = {withEvo: evoD.length ? +mean(evoD).toFixed(3) : null, without: sameD.length ? +mean(sameD).toFixed(3) : null, n: [evoD.length, sameD.length], cases: dU.map(x => `${x.m} ${x.d >= 0 ? '+' : ''}${x.d.toFixed(2)}%${x.evo ? ' (new spec)' : ''}`)};
// shrunk to half (few cases), never a slower car from an Evo
EVO.shift = evoD.length && sameD.length ? +Math.min(0, 0.5 * (EVO.withEvo - EVO.without)).toFixed(3) : 0;
const look26 = (m, y = 2026, ev = 'IMOLA') => { const k25 = lastKey(m, 2025), spec = specOf(m, y, ev), same = spec === specOf(m, 2025, 'BAHRAIN');
  return {u: (fit.u[k25] ?? 0) + (same ? 0 : EVO.shift), w: fit.w[k25] ?? 0, known: !!k25 && same, spec}; };
let last = priorFromBop(bopOf(2025, 'sakhir'), 'Bahrain 2025 (last published)');
const out26 = [];
for (const ev of EVENTS_2026) {
  const e = events[`2026 ${ev}`];
  const same = bopOf(2025, e.track);
  let prior = same ? mix(last, priorFromBop(same, `${ev} 2025`)) : last;
  for (const m of Object.keys(e.models)) if (!prior[m]) prior[m] = classMean(prior);
  const est = estimate(e, prior, fit, m => look26(m, 2026, ev));
  for (const [m, x] of Object.entries(est)) { // keep the prior where the hold-out test says learning did not help
    if (!use.kg) x.kg = Math.round(prior[m].kg); if (!use.kW) x.kW = Math.round(prior[m].kW); if (!use.above250) x.above250 = r1(prior[m].g); if (!use.MJ) x.MJ = Math.round(prior[m].MJ);
  }
  out26.push({event: ev, track: e.track, cars: est});
  last = Object.fromEntries(Object.entries(est).map(([m, x]) => [m, {kg: x.kg, kW: x.kW, g: x.above250, MJ: x.MJ, from: `${ev} 2026 estimate`}]));
}

// ---- "for fun" cars (owner 2026-11-16): Porsche 963 (WEC to 2025), Lamborghini SC63 (WEC 2024), Acura ARX-06 (IMSA only, level carried over
// through the cars that race both series when scripts/sim/data/learn/imsa-gtp-pace.txt exists). Each gets, at every 2026 event, the BoP that
// makes its learned level equal to the field (u + a·dkg% + b·dP% = 0, half by weight, half by power) from the event's class average.
// Not part of any official table; their level is from their last season (the 2026 field's Evo kits are not in it).
const FUN = {'Porsche 963': lastKey('Porsche 963', 2025), 'Lamborghini SC63': lastKey('Lamborghini SC63', 2024), 'Isotta Fraschini Tipo6-C': lastKey('Isotta Fraschini Tipo6-C', 2024)};
const funLevel = Object.fromEntries(Object.entries(FUN).filter(([, k]) => k).map(([m, k]) => [m, {u: fit.u[k], from: k.replace(m + ' ', '')}]));
try { // Acura ARX-06: IMSA pace vs each shared car, added to that car's WEC level
  const im = readFileSync(new URL('./data/learn/imsa-gtp-pace.txt', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => { const [y, ev, car, mf, q, r] = l.split(' '); return {y: +y, ev, mf, r: num(r)}; });
  const IM = {Porsche: 'Porsche 963', Cadillac: 'Cadillac V-Series.R', BMW: 'BMW M Hybrid V8', Aston: 'Aston Martin Valkyrie'}, d = [];
  for (const key of new Set(im.map(x => x.y + ' ' + x.ev))) { const rows = im.filter(x => x.y + ' ' + x.ev === key && x.r), m = med(rows.map(x => x.r)), best = mf => { const v = rows.filter(x => x.mf === mf).map(x => x.r); return v.length ? 100 * (Math.min(...v) / m - 1) : null; };
    const ac = best('Acura'); if (ac == null) continue; const y = +key.split(' ')[0];
    for (const [mf, model] of Object.entries(IM)) { const o = best(mf), k = lastKey(model, Math.min(y, 2025)) || lastKey(model, 2025); if (o != null && k) d.push(fit.u[k] + ac - o); } }
  if (d.length >= 4) funLevel['Acura ARX-06'] = {u: med(d), from: `IMSA ${d.length} car-event pairs`, imsa: true};
} catch (e) { /* no IMSA file yet */ }
// cars raced only in 2021-2023 (owner 2026-11-16: every Hypercar at its latest spec): pace vs each car they raced that has a learned level
// (Toyota, Ferrari, Peugeot, Porsche, Cadillac), added to that level; the Alpine of 2021-2022 is the A480 (grandfathered LMP1)
try {
  const old = readFileSync(new URL('./data/learn/wec-old-pace.txt', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => { const [y, ev, car, mf, q, r] = l.split(' '); return {y: +y, ev, mf: mf === 'Alpine' && +y <= 2022 ? 'AlpineA480' : mf, r: num(r)}; });
  const COMMON = {Toyota: 'Toyota GR010 Hybrid', Ferrari: 'Ferrari 499P', Peugeot: 'Peugeot 9X8', Porsche: 'Porsche 963', Cadillac: 'Cadillac V-Series.R'}, OLD = {Glickenhaus: 'Glickenhaus SCG 007', Vanwall: 'Vanwall Vandervell 680', AlpineA480: 'Alpine A480'};
  for (const [mf, name] of Object.entries(OLD)) { const d = []; let last = 0;
    for (const key of new Set(old.map(x => x.y + ' ' + x.ev))) { const rows = old.filter(x => x.y + ' ' + x.ev === key && x.r), m = med(rows.map(x => x.r)), best = f => { const v = rows.filter(x => x.mf === f).map(x => x.r); return v.length ? 100 * (Math.min(...v) / m - 1) : null; };
      const me = best(mf); if (me == null) continue; last = Math.max(last, +key.split(' ')[0]);
      for (const [cf, model] of Object.entries(COMMON)) { const o = best(cf), k = lastKey(model, 2024) || lastKey(model, 2025); if (o != null && k) d.push(fit.u[k] + me - o); } }
    if (d.length >= 3) funLevel[name] = {u: med(d), from: `WEC ${last} via ${d.length} car-event pairs`}; }
} catch (e) { /* no 2021-2023 file yet */ }
const FUN_CLS = {'Glickenhaus SCG 007': 'lmh', 'Vanwall Vandervell 680': 'lmh', 'Alpine A480': 'lmp1', 'Isotta Fraschini Tipo6-C': 'lmh', 'Porsche 963': 'lmdh', 'Lamborghini SC63': 'lmdh', 'Acura ARX-06': 'lmdh'};
const fun26 = EVENTS_2026.map((ev, i) => { const base = out26[i].cars, ms = Object.values(base), kg0 = mean(ms.map(x => x.kg)), kW0 = mean(ms.map(x => x.kW)), g0 = mean(ms.map(x => x.above250)), MJ0 = mean(ms.map(x => x.MJ));
  return {event: ev, cars: Object.fromEntries(Object.entries(funLevel).map(([m, L]) => { const dkg = -L.u / (2 * fit.coef.a), dP = -L.u / (2 * fit.coef.b);
    const kg = Math.max(LIMITS.kgMin, Math.round(kg0 * (1 + dkg / 100))), kW = Math.min(LIMITS.kWMax, Math.max(LIMITS.kWMin, Math.round(kW0 * (1 + dP / 100))));
    // what is left at the regulation limits (a car too slow for any allowed BoP stays slower by this, % of a lap)
    const gap = L.u + fit.coef.a * 100 * (kg / kg0 - 1) + fit.coef.b * 100 * (kW / kW0 - 1);
    return [m, {cls: FUN_CLS[m] || 'lmh', kg, kW, above250: r1(g0), MJ: Math.round(MJ0), levelPct: +L.u.toFixed(2), gapPct: Math.abs(gap) > 0.05 ? +gap.toFixed(2) : 0, from: L.from}]; }))}; });
// ---- 2027 season-opener projection (owner 2026-11-16): the last 2026 estimate, plus for each car with a new 2027 spec (Ferrari, Aston
// Martin, Peugeot Evo) the BoP change that cancels the learned Evo gain (half by weight, half by power: L = u + a·dkg% + b·dP%)
const proj = {};
for (const [m, x] of Object.entries(last)) { const sp26 = specOf(m, 2026, 'MONZA'), sp27 = specOf(m, 2027, 'LOSAIL'), evo = sp27 !== sp26, d = evo ? EVO.shift : 0;
  const dkg = d ? -d / (2 * fit.coef.a) : 0, dP = d ? -d / (2 * fit.coef.b) : 0;
  proj[m] = {cls: CLS[m], kg: Math.max(LIMITS.kgMin, Math.round(x.kg * (1 + dkg / 100))), kW: Math.min(LIMITS.kWMax, Math.max(LIMITS.kWMin, Math.round(x.kW * (1 + dP / 100)))), above250: r1(x.g), MJ: Math.round(x.MJ), spec: sp27, evo}; }
// ---- 2027, every announced round (owner 2026-11-16): a round with Al Kamel laps is estimated like 2026 (refit after each race by the
// BoP refresh workflow); a round still to come is projected: the latest estimate, mixed with the newest value at the same track; the
// first round starts from the Evo-adjusted projection above.
export const ROUNDS_2027 = ['LOSAIL', 'IMOLA', 'SILVERSTONE', 'SPA', 'LEMANS', 'SAOPAULO', 'COTA', 'FUJI', 'BAHRAIN'];
const at = (track, list) => { for (const e of [...list].reverse()) if (e.track === track) return Object.fromEntries(Object.entries(e.cars).map(([m, x]) => [m, {kg: x.kg, kW: x.kW, g: x.above250, MJ: x.MJ, from: `${e.event} ${e.year || 2026}`}])); return null; };
let last27 = Object.fromEntries(Object.entries(proj).map(([m, x]) => [m, {kg: x.kg, kW: x.kW, g: x.above250, MJ: x.MJ, from: 'Evo-adjusted 2026 estimate'}]));
const rounds27 = [];
for (const [i, ev] of ROUNDS_2027.entries()) {
  const e = events[`2027 ${ev}`], track = TRACK[ev], same = at(track, [...out26, ...rounds27]) || (bopOf(2025, track) ? priorFromBop(bopOf(2025, track), `${ev} 2025`) : null);
  const prior = i && same ? mix(last27, same) : last27;
  const em = e || {models: Object.fromEntries(Object.keys(prior).map(m => [m, {L: null, V: null, stint: null, cars: []}]))};
  for (const m of Object.keys(em.models)) if (!prior[m]) prior[m] = classMean(prior);
  const est = estimate(em, prior, fit, m => look26(m, 2027, ev));
  rounds27.push({event: ev, track, year: 2027, measured: !!e, cars: est});
  last27 = Object.fromEntries(Object.entries(est).map(([m, x]) => [m, {kg: x.kg, kW: x.kW, g: x.above250, MJ: x.MJ, from: `${ev} 2027 ${e ? 'estimate' : 'projection'}`}]));
}
const projection2027 = {basis: 'Monza 2026 estimate', evoShiftPct: EVO.shift, note: 'Evo cars get the BoP change that cancels the learned Evo gain; others keep their last 2026 estimate', cars: proj, events: rounds27};
const result = {generated: new Date().toISOString().slice(0, 10), method: 'MAP inversion of class-wide BoP response learned from all Al Kamel laps 2024-2026 and the published 2024-2025 BoP', limits: LIMITS,
  coefficients: Object.fromEntries(Object.entries(fit.coef).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(4) : v])), holdout2025: holdout, learnedPartUsed: use, evo: EVO, specs: SPECS, events: out26, projection2027, fun: fun26};
writeFileSync(new URL('../../worker/lapsim/bop-estimate-data.js', import.meta.url), `// WEC Hypercar 2026 BoP estimate (not official). Built by scripts/sim/bop-estimate.mjs; method and hold-out test in docs/lapsim-wec-bop.md\nexport const bopEstimate2026 = ${JSON.stringify(result)};\n`);
if (process.argv.includes('--design')) writeFileSync('/tmp/bop-design.json', JSON.stringify({X: fit.X, Y: fit.Y}));
console.log(JSON.stringify({coef: result.coefficients, holdout, use, evo: EVO}, null, 1));
console.log('fun', JSON.stringify(fun26[0].cars));
console.log('2027', Object.entries(proj).map(([m, x]) => `${m.split(' ')[0]} ${x.kg}/${x.kW}${x.evo ? ' EVO' : ''}`).join(' | '));
for (const e of out26) console.log(e.event, Object.entries(e.cars).map(([m, x]) => `${m.split(' ')[0]} ${x.kg}/${x.kW}/${x.above250}/${x.MJ}`).join(' | '));
