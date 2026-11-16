// WEC LMGT3 2026 BoP estimate (FIA/ACO stopped publishing BoP tables in 2026). Same method as the Hypercar one (bop-estimate.mjs):
// learn how a car's pace and top speed respond to its BoP from the published 2024-2025 LMGT3 tables (scripts/sim/data/wec-lmgt3-bop.json)
// and every Al Kamel LMGT3 lap (scripts/sim/data/learn/gt3-bop-pace.txt), then invert that relation for each 2026 event.
//   pace  L = u(model, season) + a·dkg% + b·curve + c·gain     (L: model's best race pace vs field median, %)
//   speed V = w(model, season) + e·gain + f·curve + g·dkg%     (V: model's median top speed vs field median, %)
// curve = the car's power-curve number (P1, P2, ... of its own curve table, so only changes within a model are learned);
// gain = power gain after 200 kph (%). u, w: fixed effect per model and season; a..g: one set for the class.
// Each 2026 event: MAP estimate (prior = previous event estimate mixed 50/50 with the 2025 table at the same track). Le Mans uses the
// ACO table (another weight basis): its own prior, not chained. Stint energy is not identifiable from lap data: the prior is kept.
// Hold-out: every 2025 event (Imola..Bahrain) estimated the same way with that event hidden. Writes worker/lapsim/bop-lmgt3-data.js.
import {readFileSync, writeFileSync} from 'node:fs';

const T = JSON.parse(readFileSync(new URL('./data/wec-lmgt3-bop.json', import.meta.url), 'utf8')).events;
const TRACK = {LOSAIL: 'lusail', IMOLA: 'imola', SPA: 'spa-francorchamps', LEMANS: 'le-mans', SAOPAULO: 'interlagos', COTA: 'austin', FUJI: 'fuji', BAHRAIN: 'sakhir', BARCELONA: 'barcelona', MONZA: 'monza', SILVERSTONE: 'silverstone'};
export const LMGT3_NAMES = {AstonMartin: 'Aston Martin Vantage AMR LMGT3', BMW: 'BMW M4 LMGT3', Corvette: 'Corvette Z06 LMGT3.R', Ferrari: 'Ferrari 296 LMGT3', Ford: 'Ford Mustang LMGT3', Lamborghini: 'Lamborghini Huracán LMGT3 Evo2', Lexus: 'Lexus RC F LMGT3', McLaren: 'McLaren 720S LMGT3 Evo', Mercedes: 'Mercedes-AMG LMGT3', Porsche: 'Porsche 911 GT3 R LMGT3'};
const EVENTS_2026 = ['IMOLA', 'SPA', 'LEMANS', 'SAOPAULO', 'COTA', 'FUJI', 'BARCELONA', 'MONZA'];
const ORDER25 = ['LOSAIL', 'IMOLA', 'SPA', 'SAOPAULO', 'COTA', 'FUJI', 'BAHRAIN'];
const LIM = {curveMin: 1, curveMax: 20};
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const med = a => { a = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };
const r1 = x => Math.round(x * 10) / 10, num = s => s === '-' ? null : +s;
const mfr = s => s.startsWith('Mercedes') ? 'Mercedes' : s;

// ---- measurements per event and model (WEC LMGT3 only)
const ev = {};
for (const l of readFileSync(new URL('./data/learn/gt3-bop-pace.txt', import.meta.url), 'utf8').split('\n')) {
  if (!l || l.startsWith('#')) continue; const [series, y, e, cls, car, m, , q, r, top] = l.split(' ');
  if (series !== 'wec' || cls !== 'LMGT3') continue; (ev[`${y} ${e}`] ||= []).push({m: mfr(m), r: num(r), top: num(top)});
}
const meas = {};
for (const [k, cars] of Object.entries(ev)) {
  const mr = med(cars.map(c => c.r)), mt = med(cars.map(c => c.top)); meas[k] = {};
  for (const m of new Set(cars.map(c => c.m))) { const cs = cars.filter(c => c.m === m && c.r);
    meas[k][m] = {L: cs.length ? 100 * (Math.min(...cs.map(c => c.r)) / mr - 1) : null, V: mean(cars.filter(c => c.m === m && c.top).map(c => 100 * (c.top / mt - 1))), n: cs.length}; }
}
const tab = k => T[k]?.cars ? Object.fromEntries(Object.entries(T[k].cars).map(([m, [curve, gain, kg, MJ]]) => [m, {curve, gain, kg, MJ}])) : null;
const kgRel = (b, m) => 100 * (b[m].kg / mean(Object.values(b).map(x => x.kg)) - 1);

// ---- class coefficients from within-model-season variation (fixed effects drop out)
function ols(X, Y) { const k = X[0].length, A = Array.from({length: k}, () => Array(k).fill(0)), y = Array(k).fill(0);
  X.forEach((x, n) => { for (let i = 0; i < k; i++) { y[i] += x[i] * Y[n]; for (let j = 0; j < k; j++) A[i][j] += x[i] * x[j]; } }); return solve(A, y); }
function solve(A, y) { const n = y.length, M = A.map((r, i) => [...r, y[i]]);
  for (let i = 0; i < n; i++) { let p = i; for (let j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j; [M[i], M[p]] = [M[p], M[i]];
    for (let j = i + 1; j < n; j++) { const f = M[j][i] / M[i][i]; for (let c = i; c <= n; c++) M[j][c] -= f * M[i][c]; } }
  const x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) x[i] = (M[i][n] - M[i].slice(i + 1, n).reduce((s, v, c) => s + v * x[i + 1 + c], 0)) / M[i][i]; return x; }
function fit(skip) {
  const obs = [];
  for (const k of Object.keys(T)) { if (k === skip || T[k].lemans) continue; const b = tab(k), me = meas[k]; if (!me) continue;
    for (const m of Object.keys(b)) if (me[m]?.L != null) obs.push({g: `${m} ${k.slice(0, 4)}`, m, L: me[m].L, V: me[m].V, dkg: kgRel(b, m), cu: b[m].curve, ga: b[m].gain}); }
  const G = {}; for (const o of obs) (G[o.g] ||= []).push(o);
  const X = [], Y = [], XV = [], YV = [];
  for (const list of Object.values(G)) { if (list.length < 2) continue; const mu = f => mean(list.map(f));
    const a = mu(o => o.dkg), b = mu(o => o.cu), c = mu(o => o.ga), l = mu(o => o.L);
    for (const o of list) { X.push([o.dkg - a, o.cu - b, o.ga - c]); Y.push(o.L - l); }
    const lv = list.filter(o => o.V != null); if (lv.length > 1) { const v = mean(lv.map(o => o.V)), a2 = mean(lv.map(o => o.dkg)), b2 = mean(lv.map(o => o.cu)), c2 = mean(lv.map(o => o.ga));
      for (const o of lv) { XV.push([o.dkg - a2, o.cu - b2, o.ga - c2]); YV.push(o.V - v); } } }
  const [a, b, c] = ols(X, Y), [g, f, e] = ols(XV, YV);
  const sd = (Xs, Ys, k) => Math.sqrt(mean(Xs.map((x, i) => (Ys[i] - x.reduce((s, v, j) => s + v * k[j], 0)) ** 2)));
  const u = {}, w = {}; for (const [k, list] of Object.entries(G)) { u[k] = mean(list.map(o => o.L - a * o.dkg - b * o.cu - c * o.ga)); const lv = list.filter(o => o.V != null); if (lv.length) w[k] = mean(lv.map(o => o.V - g * o.dkg - f * o.cu - e * o.ga)); }
  return {coef: {a, b, c, e, f, g, sdL: sd(X, Y, [a, b, c]), sdV: sd(XV, YV, [g, f, e]), n: X.length}, u, w};
}
// prior spread: one event-to-event change in 2024-2025 (same car, consecutive published tables, Le Mans left out)
const steps = {kg: [], curve: [], gain: []}; const keys = Object.keys(T).filter(k => !T[k].lemans);
for (let i = 1; i < keys.length; i++) { const p = tab(keys[i - 1]), q = tab(keys[i]); if (keys[i].slice(0, 4) !== keys[i - 1].slice(0, 4)) continue;
  for (const m of Object.keys(q)) if (p[m]) { steps.kg.push(q[m].kg - p[m].kg); steps.curve.push(q[m].curve - p[m].curve); steps.gain.push(q[m].gain - p[m].gain); } }
const rms = a => Math.sqrt(mean(a.map(x => x * x)));
const SD = {kg: Math.max(3, rms(steps.kg)), curve: Math.max(0.5, rms(steps.curve)), gain: Math.max(0.5, rms(steps.gain))};

// ---- one event: MAP of (kg, curve, gain) per model around the prior
function estimate(me, prior, F, season, S = SCALE) {
  const out = {}, kg0 = mean(Object.values(prior).map(p => p.kg)), {coef: k} = F;
  for (const [m, p] of Object.entries(prior)) {
    const o = me?.[m], key = Object.keys(F.u).filter(x => x.startsWith(m + ' ')).sort().at(-1), known = !!key && key.endsWith(String(season));
    const u = key ? F.u[key] : 0, w = key ? F.w[key] ?? 0 : 0, sp = [SD.kg, SD.curve, SD.gain].map(s => s * (known ? 1 : 1.5));
    const A = [[1 / sp[0] ** 2, 0, 0], [0, 1 / sp[1] ** 2, 0], [0, 0, 1 / sp[2] ** 2]], y = [p.kg / sp[0] ** 2, p.curve / sp[1] ** 2, p.gain / sp[2] ** 2];
    const add = (h, val, s) => { for (let i = 0; i < 3; i++) { y[i] += h[i] * val / s ** 2; for (let j = 0; j < 3; j++) A[i][j] += h[i] * h[j] / s ** 2; } };
    // dkg% = 100 (kg/kg0 - 1): linear in kg with slope 100/kg0
    if (o?.L != null && key) add([k.a * 100 / kg0, k.b, k.c], o.L - u + k.a * 100, S * k.sdL * (known ? 1 : 2));
    if (o?.V != null && key) add([k.g * 100 / kg0, k.f, k.e], o.V - w + k.g * 100, S * k.sdV * (known ? 1 : 2));
    const x = solve(A, y), sd = [0, 1, 2].map(i => Math.sqrt(solve(A, [0, 1, 2].map(j => +(i === j)))[i]));
    out[m] = {kg: Math.round(x[0]), curve: Math.min(LIM.curveMax, Math.max(LIM.curveMin, Math.round(x[1]))), gain: r1(x[2]), MJ: Math.round(p.MJ),
      sd: {kg: Math.round(sd[0]), curve: r1(sd[1]), gain: r1(sd[2])}, evidence: {pacePct: o?.L == null ? null : +o.L.toFixed(2), speedPct: o?.V == null ? null : +o.V.toFixed(2), cars: o?.n ?? 0}, learned: known, priorFrom: p.from};
  }
  return out;
}
const fromTab = (b, from) => b ? Object.fromEntries(Object.entries(b).map(([m, v]) => [m, {...v, from}])) : null;
function mix(a, b) { if (!a || !b) return a || b; const o = {}; for (const m of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[m], y = b[m];
  o[m] = x && y ? {kg: (x.kg + y.kg) / 2, curve: (x.curve + y.curve) / 2, gain: (x.gain + y.gain) / 2, MJ: (x.MJ + y.MJ) / 2, from: `${x.from} + ${y.from}`} : {...(x || y)}; } return o; }

// ---- hold-out on 2025 (SCALE: measurement noise multiplier, from the environment for tuning)
const SCALE = +(process.env.SCALE || 4); // 4: best hold-out of 1, 2, 4, 8, 16 (8 and 16 tie); lap data is noisy in LMGT3 (Bronze drivers, traffic, success ballast)
const test = [];
for (let i = 1; i < ORDER25.length; i++) { const k = `2025 ${ORDER25[i]}`, truth = tab(k); if (!truth || !meas[k]) continue;
  const F = fit(k), prior = mix(fromTab(tab(`2025 ${ORDER25[i - 1]}`), 'previous event'), fromTab(tab(`2024 ${ORDER25[i]}`), 'same track 2024'));
  for (const m of Object.keys(prior)) if (!truth[m]) delete prior[m];
  const est = estimate(meas[k], prior, F, 2025);
  for (const [m, x] of Object.entries(est)) test.push({ekg: x.kg - truth[m].kg, ecu: x.curve - truth[m].curve, ega: x.gain - truth[m].gain, pkg: prior[m].kg - truth[m].kg, pcu: prior[m].curve - truth[m].curve, pga: prior[m].gain - truth[m].gain}); }
const mae = f => +mean(test.map(t => Math.abs(t[f]))).toFixed(2);
const holdout = {cases: test.length, model: {kg: mae('ekg'), curve: mae('ecu'), gain: mae('ega')}, priorOnly: {kg: mae('pkg'), curve: mae('pcu'), gain: mae('pga')}};
const use = {kg: holdout.model.kg <= holdout.priorOnly.kg, curve: holdout.model.curve <= holdout.priorOnly.curve, gain: holdout.model.gain <= holdout.priorOnly.gain};

// ---- 2026 chain
const F = fit(null); let last = fromTab(tab('2025 BAHRAIN'), 'Bahrain 2025 (last published)'); const events = [];
for (const e of EVENTS_2026) {
  const k = `2026 ${e}`, lm = e === 'LEMANS', same = fromTab(tab(`2025 ${e}`), `${e} 2025`);
  const prior = lm ? same : same ? mix(last, same) : last; if (!prior) continue;
  const me = meas[k]; for (const m of Object.keys(me || {})) if (!prior[m]) { const v = Object.values(prior); prior[m] = {kg: mean(v.map(x => x.kg)), curve: 10, gain: mean(v.map(x => x.gain)), MJ: mean(v.map(x => x.MJ)), from: 'class mean (new car)'}; }
  for (const m of Object.keys(prior)) if (me && !me[m]) delete prior[m]; // a make not entered at this event
  const est = estimate(me, prior, F, 2025);
  for (const [m, x] of Object.entries(est)) { if (!use.kg) x.kg = Math.round(prior[m].kg); if (!use.curve) x.curve = Math.round(prior[m].curve); if (!use.gain) x.gain = r1(prior[m].gain); }
  events.push({event: e, track: TRACK[e], lemans: lm, cars: est});
  if (!lm) last = Object.fromEntries(Object.entries(est).map(([m, x]) => [m, {kg: x.kg, curve: x.curve, gain: x.gain, MJ: x.MJ, from: `${e} 2026 estimate`}]));
}
// ---- 2027, every announced round: estimated from its laps once raced (BoP refresh workflow), projected before that (latest estimate
// mixed with the newest value at the same track). No LMGT3 Evo kit is announced for 2027.
const ROUNDS_2027 = ['LOSAIL', 'IMOLA', 'SILVERSTONE', 'SPA', 'LEMANS', 'SAOPAULO', 'COTA', 'FUJI', 'BAHRAIN'], rounds27 = [];
const newest = (e, list) => { const hit = [...list].reverse().find(x => x.event === e); return hit ? Object.fromEntries(Object.entries(hit.cars).map(([m, x]) => [m, {kg: x.kg, curve: x.curve, gain: x.gain, MJ: x.MJ, from: `${e} ${hit.year || 2026}`}])) : fromTab(tab(`2025 ${e}`), `${e} 2025`); };
for (const e of ROUNDS_2027) {
  const lm = e === 'LEMANS', same = newest(e, [...events, ...rounds27]), prior = lm ? same : same ? mix(last, same) : {...last}; if (!prior) continue;
  const me = meas[`2027 ${e}`]; if (me) for (const m of Object.keys(prior)) if (!me[m]) delete prior[m];
  const est = estimate(me, prior, F, 2026);
  rounds27.push({event: e, track: TRACK[e], year: 2027, lemans: lm, measured: !!me, cars: est});
  if (!lm) last = Object.fromEntries(Object.entries(est).map(([m, x]) => [m, {kg: x.kg, curve: x.curve, gain: x.gain, MJ: x.MJ, from: `${e} 2027 ${me ? 'estimate' : 'projection'}`}]));
}
const projection2027 = {basis: 'last 2026 estimate, then each round in turn', note: 'no announced LMGT3 Evo kits for 2027', events: rounds27};
const R4 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(4) : v]));
const result = {generated: new Date().toISOString().slice(0, 10), method: 'MAP inversion of the LMGT3 BoP response learned from all Al Kamel LMGT3 laps 2024-2026 and the published 2024-2025 WEC LMGT3 tables',
  names: LMGT3_NAMES, coefficients: R4(F.coef), priorSd: R4(SD), holdout2025: holdout, learnedPartUsed: use, sources: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, {doc: v.doc, url: v.url}])), events, projection2027};
writeFileSync(new URL('../../worker/lapsim/bop-lmgt3-data.js', import.meta.url), `// WEC LMGT3 2026 BoP estimate (not official). Built by scripts/sim/gt3-bop-estimate.mjs; method in docs/lapsim-wec-bop.md\nexport const bopLmgt3 = ${JSON.stringify(result)};\n`);
console.log(JSON.stringify({coef: result.coefficients, SD: result.priorSd, holdout, use}));
for (const e of events) console.log(e.event, Object.entries(e.cars).map(([m, x]) => `${m} ${x.kg}/P${x.curve}/${x.gain}%`).join(' | '));
