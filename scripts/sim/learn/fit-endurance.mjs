// Learning step for the endurance series (IMSA, WEC, ELMS, Asian LMS): every car model, every layout with simulator geometry.
//   node scripts/sim/learn/fit-endurance.mjs <endurance-cars.csv[.gz]> [out.json]
// Declared before the first run (rule 2.5), in docs/lapsim-learn.md section 3. Nothing here changes the production calibration.
// Model for the best dry qualifying lap of car model m at an event (log scale, so every term is a percentage):
//   log(real) = log(sim of the class car, event weather, no track factor) + S + T + TG + M + MB + MY + B*z + noise
//   S  class level per series and season      T  layout          TG layout x (prototype | GT)
//   M  car model   MB model x BoP body (IMSA | ACO)   MY model x body x season   B model x track speed (shape: fast vs slow track)
// Ridge widths are fixed below (not tuned). Error is always measured on rows the fit did not see.
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lapsimCalibration} from '../../../worker/lapsim/calibration-data.js';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
import {SERIES} from '../../../worker/lapsim/series.js';
import {resolveTrack} from './track-registry.mjs';
import {modelOf} from './models.mjs';

const K = lapsimKernel(), WEC = lapsimCalibration.series.wec, ALL = {...lapsimTracks, ...lapsimExtraTracks};
export const WIDTH = {S: 0.10, T: 0.05, TG: 0.015, M: 0.015, MB: 0.010, MY: 0.007, B: 0.010}, SIGMA = 0.005, HUBER = 2;
const GT = /^(GTD|GTDPRO|LMGT3|GT|GT3)$/, body = s => s === 'imsa' ? 'imsa' : 'aco';
// class of a row -> simulator car. LMP2 (one spec car at almost every track) is kept as a probe of the track terms with the LMDh car.
export function groupOf(r) {
  if (r.cls === 'HYPERCAR' || r.cls === 'GTP') return r.season >= 2023 && r.model ? (SERIES.wec.classes.lmh.manufacturers.test(r.model.base) ? 'lmh' : 'lmdh') : null;
  if (GT.test(r.cls)) return r.model && /GT3|GTD/.test(r.model.base) ? 'gt3' : null;
  if (/^LMP2/.test(r.cls)) return r.model?.base === 'Oreca 07' ? 'lmp2' : null;
  return null;
}
const CAR = {lmh: 'lmh', lmdh: 'lmdh', gt3: 'lmgt3', lmp2: 'lmdh'}, calSeason = y => String(Math.min(2026, Math.max(2025, y)));
const simCache = new Map(), trk = new Map();
// The learning step always simulates with the LATEST calibrated class car (the car the page shows), whatever the season of the
// row: the 2025 and 2026 class cars differ by several percent on one track, so a layout term learned on one does not fit the other.
// Season differences go to S. Only the "before" column uses the season's own car, as the page did.
const LATEST = Object.fromEntries(Object.entries(WEC).map(([c, s]) => [c, Object.keys(s).sort().at(-1)]));
function simLap(simId, group, season, w, grip = 1, own = false) {
  const cs = own ? calSeason(season) : LATEST[CAR[group]], k = [simId, group, cs, Math.round(w.airC ?? 25), Math.round(w.trackC ?? 35), Math.round((w.hpa ?? 1013) / 5), Math.round((w.hum ?? 50) / 10), grip].join('|'); if (simCache.has(k)) return simCache.get(k);
  const t = trk.get(simId) || trk.set(simId, K.trackFromData(ALL[simId])).get(simId), env = K.conditionsFromWeather({pressureHpa: w.hpa ?? 1013.25, airTempC: w.airC ?? 25, humidityPct: w.hum ?? 50, trackTempC: w.trackC ?? 35, windSpeed: 0, windFromDeg: 0});
  const lap = K.simulateLap(grip === 1 ? t : {...t, mu: Float64Array.from(t.mu, m => m * grip)}, WEC[CAR[group]][cs].car, env).lapTime; simCache.set(k, lap); return lap;
}
// what the page predicts today for a car that has no real lap here (worker/lapsim/scenario.js gripOf)
const prodGrip = (simId, group, season) => { const s = WEC[CAR[group]]; return [calSeason(season), ...Object.keys(s).sort().reverse()].map(k => s[k]?.tracks?.[simId]?.grip).find(g => g != null) ?? lapsimExtraTracks[simId]?.trackFactor?.grip ?? 1; };

export function loadRows(file) {
  const [head, ...lines] = (file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString() : readFileSync(file, 'utf8')).trim().split('\n'), cols = head.split(','), best = new Map(), skipped = {};
  const split = l => { const o = []; let f = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { o.push(f); f = ''; } else f += c; } o.push(f); return o; };
  for (const l of lines) { const a = split(l), r = Object.fromEntries(cols.map((c, i) => [c, a[i]])); if (r.type !== 'Q') continue;
    r.season = +r.season; r.best = +r.best; r.model = modelOf(r.vehicle, r.season, r.cls); const group = groupOf(r); if (!group) continue;
    const num = v => v === '' ? null : +v, w = {airC: num(r.airC), trackC: num(r.trackC), hum: num(r.hum), hpa: num(r.hpa)}; if (w.trackC != null && w.airC != null && w.trackC > w.airC + 35) w.trackC = null; // IMSA 2021 track temperatures are not usable
    const wet = +r.rainShare > 0.02, tr = resolveTrack({name: r.event, lengthKm: num(r.lenKm), season: r.season}), why = wet ? 'wet qualifying' : !tr.layout ? 'layout not resolved' : !(tr.sim || tr.near) ? 'no simulator geometry: ' + tr.layout : null; // a ⚠️ track is learned too: its layout term absorbs the geometry error and the held-out error decides the mark
    if (why) { skipped[why] = (skipped[why] || 0) + 1; continue; }
    const k = [r.series, r.season, r.event, group, r.model.key].join('|'), o = best.get(k);
    if (!o || r.best < o.real) best.set(k, {series: r.series, season: r.season, event: r.event, layout: tr.layout, sim: tr.sim || tr.near, sibling: !tr.sim, group, model: r.model.key, entry: r.entry, real: r.best, trap: num(r.trapKph), w, eventKey: [r.series, r.season, r.event].join('|')});
  }
  const rows = [...best.values()]; for (const r of rows) { r.sim0 = simLap(r.sim, r.group, r.season, r.w); r.y = Math.log(r.real / r.sim0); r.prod = simLap(r.sim, r.group, r.season, r.w, prodGrip(r.sim, r.group, r.season), true); }
  const zStat = {};
  // z: how fast the layout is (class car mean speed, standard weather), standardised per group
  for (const g of new Set(rows.map(r => r.group))) { const R = rows.filter(r => r.group === g), v = r => Math.log(ALL[r.sim].length / simLap(r.sim, g, 2026, {})), m = R.reduce((a, r) => a + v(r), 0) / R.length, sd = Math.sqrt(R.reduce((a, r) => a + (v(r) - m) ** 2, 0) / R.length) || 1; for (const r of R) r.z = (v(r) - m) / sd; zStat[g] = {m, sd}; }
  return {rows, skipped, zStat};
}
const kind = g => g === 'gt3' ? 'gt' : 'proto';
const terms = r => [['S', r.group + '|' + r.series + '|' + r.season, 1], ['T', r.layout, 1], ['TG', r.layout + '|' + kind(r.group), 1], ['M', r.model, 1], ['MB', r.model + '|' + body(r.series), 1], ['MY', r.model + '|' + body(r.series) + '|' + r.season, 1], ['B', r.model, r.z]];
// Ridge least squares with Huber weights (a wet-suspect or disrupted session is down-weighted, never deleted: rule 4.3 no. 7).
export function fit(rows, widths = WIDTH) {
  const idx = new Map(), id = (t, k) => { const key = t + ':' + k; if (!idx.has(key)) idx.set(key, {i: idx.size, t}); return idx.get(key).i; }, X = rows.map(r => terms(r).map(([t, k, v]) => [id(t, k), v])), P = idx.size;
  const lam = new Float64Array(P); for (const {i, t} of idx.values()) lam[i] = (SIGMA / widths[t]) ** 2;
  let beta = new Float64Array(P), wt = rows.map(() => 1);
  for (let it = 0; it < 4; it++) {
    const A = Array.from({length: P}, (_, i) => { const a = new Float64Array(P); a[i] = lam[i]; return a; }), b = new Float64Array(P);
    X.forEach((x, n) => { const w = wt[n]; for (const [i, vi] of x) { b[i] += w * vi * rows[n].y; for (const [j, vj] of x) A[i][j] += w * vi * vj; } });
    for (let i = 0; i < P; i++) { for (let j = 0; j <= i; j++) { let s = A[i][j]; for (let k = 0; k < j; k++) s -= A[i][k] * A[j][k]; A[i][j] = i === j ? Math.sqrt(s) : s / A[j][j]; } } // Cholesky, lower
    const y = new Float64Array(P); for (let i = 0; i < P; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= A[i][k] * y[k]; y[i] = s / A[i][i]; }
    beta = new Float64Array(P); for (let i = P - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < P; k++) s -= A[k][i] * beta[k]; beta[i] = s / A[i][i]; }
    wt = X.map((x, n) => { const e = Math.abs(rows[n].y - x.reduce((a, [i, v]) => a + beta[i] * v, 0)) / SIGMA; return e <= HUBER ? 1 : HUBER / e; });
  }
  const coef = Object.fromEntries([...idx].map(([k, {i}]) => [k, beta[i]]));
  return {coef, predict: r => r.sim0 * Math.exp(terms(r).reduce((a, [t, k, v]) => a + (coef[t + ':' + k] ?? 0) * v, 0))};
}
const rms = e => e.length ? Math.sqrt(e.reduce((a, x) => a + x * x, 0) / e.length) * 100 : null, r2 = v => v == null ? null : +v.toFixed(2);
// class-best rows of a set of model rows: the fastest real model against the fastest predicted model of the same event and class
const classBest = (rows, pred) => { const g = new Map(); rows.forEach((r, i) => { const k = r.eventKey + '|' + r.group, o = g.get(k) || g.set(k, {real: Infinity, pred: Infinity, r}).get(k); o.real = Math.min(o.real, r.real); o.pred = Math.min(o.pred, pred[i]); }); return [...g.values()]; };
function table(rows, preds, by) { // preds: {name: [per row]}
  const out = {}; for (const key of new Set(rows.map(by))) { const I = rows.map((r, i) => by(r) === key ? i : -1).filter(i => i >= 0), R = I.map(i => rows[i]), o = out[key] = {models: I.length};
    for (const [name, p] of Object.entries(preds)) { const pp = I.map(i => p[i]); if (pp.some(v => v == null)) continue; o[name] = r2(rms(pp.map((v, j) => v / R[j].real - 1))); const cb = classBest(R, pp); o.events = cb.length; o[name + 'Class'] = r2(rms(cb.map(c => c.pred / c.real - 1))); } }
  return out;
}

if (process.argv[1]?.endsWith('fit-endurance.mjs')) {
  const loaded = loadRows(process.argv[2]), skipped = loaded.skipped, OUT = process.argv[3] || 'scripts/sim/data/learn/endurance-fit.json'; let rows = loaded.rows;
  // Wet or disrupted qualifying that the rain column missed (rule 3.3.1): the whole class of an event is more than 4 % slower than
  // the fit predicts from every OTHER event. One pass, slow side only. The sessions are listed, not fitted and not scored.
  const slow = []; { const g = new Map(); for (const ev of new Set(rows.map(r => r.eventKey))) { const f = fit(rows.filter(r => r.eventKey !== ev)); for (const r of rows.filter(r => r.eventKey === ev)) { const k = ev + '|' + r.group; (g.get(k) || g.set(k, []).get(k)).push(Math.log(r.real / f.predict(r))); } }
    for (const [k, e] of g) { const m = e.reduce((a, x) => a + x, 0) / e.length; if (m > 0.04) slow.push({session: k, cars: e.length, slowerPct: +(m * 100).toFixed(1)}); }
    const bad = new Set(slow.map(s => s.session)); rows = rows.filter(r => !bad.has(r.eventKey + '|' + r.group)); skipped['slow session (wet or disrupted), listed'] = loaded.rows.length - rows.length; }
  const full = fit(rows);
  const groups = k => [...new Set(rows.map(r => r[k]))], hold = (key, drop = () => false) => { const p = new Array(rows.length); for (const g of groups(key)) { const f = fit(rows.filter(r => r[key] !== g)); rows.forEach((r, i) => { if (r[key] === g) p[i] = f.predict(r); }); } return p; };
  const preds = {before: rows.map(r => r.prod), raw: rows.map(r => r.sim0), inSample: rows.map(full.predict), eventOut: hold('eventKey'), layoutOut: hold('layout'), modelOut: hold('model')};
  const sens = {}; for (const [n, f] of [['half', 0.5], ['double', 2]]) { const w = Object.fromEntries(Object.entries(WIDTH).map(([k, v]) => [k, v * f])), p = new Array(rows.length); for (const g of groups('eventKey')) { const ft = fit(rows.filter(r => r.eventKey !== g), w); rows.forEach((r, i) => { if (r.eventKey === g) p[i] = ft.predict(r); }); } sens[n] = table(rows, {eventOut: p}, r => r.group); }
  const res = {generated: new Date().toISOString().slice(0, 10), note: 'RMS error in percent. before = the page today for a car with no real lap here (class car, production track factor). eventOut = this event hidden. layoutOut = every event at this layout hidden (track-unseen). modelOut = this car model hidden everywhere. ...Class = class-best lap (fastest model) instead of each model.',
    widths: WIDTH, sigma: SIGMA, rows: rows.length, events: groups('eventKey').length, layouts: groups('layout').length, models: groups('model').length, skipped, slowSessions: slow, slowSessions: slow,
    byGroup: table(rows, preds, r => r.group), byGroupLayout: table(rows, preds, r => r.group + ' @ ' + r.layout), byGroupSeries: table(rows, preds, r => r.group + ' ' + r.series), byModel: table(rows.filter(r => r.group === 'gt3'), Object.fromEntries(Object.entries(preds).map(([k, p]) => [k, p.filter((_, i) => rows[i].group === 'gt3')])), r => r.model),
    sensitivity: sens, coef: Object.fromEntries(Object.entries(full.coef).map(([k, v]) => [k, +v.toFixed(5)])),
    worst: rows.map((r, i) => ({...r, e: preds.eventOut[i] / r.real - 1})).sort((a, b) => Math.abs(b.e) - Math.abs(a.e)).slice(0, 25).map(r => `${r.eventKey} ${r.group} ${r.model} real ${r.real} err ${(r.e * 100).toFixed(2)} %`)};
  writeFileSync(OUT, JSON.stringify(res, null, 1));
  // ---- what the page and the tool read: worker/lapsim/learned-data.js ----
  // Lap-time factors on the class car with NO track factor (grip 1), standard weather handled by the simulator as usual.
  // Class cars (regulation level: LMH, LMDh, LMGT3) = level of the latest WEC season + layout + the fastest current model.
  // GT3 model cars = their own model terms; BoP body ACO (WEC, ELMS, Asian LMS) when the model races there, else IMSA.
  const c = full.coef, g0 = k => c[k] ?? 0, last = Math.max(...rows.map(r => r.season)), zOf = (simId, g) => (Math.log(ALL[simId].length / simLap(simId, g, 2026, {})) - loaded.zStat[g].m) / loaded.zStat[g].sd;
  const slug = k => 'gt3-' + k.toLowerCase().replace(/\+evo2?/, m => m.slice(1)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const info = {}; for (const r of rows) { const o = info[r.model] ||= {group: r.group, bodies: {}}; const b = o.bodies[body(r.series)] ||= {last: 0, n: 0}; b.last = Math.max(b.last, r.season); b.n++; }
  const mTerm = (m, b, y, z) => g0('M:' + m) + g0(`MB:${m}|${b}`) + g0(`MY:${m}|${b}|${y}`) + g0('B:' + m) * z;
  const levelOf = (g, b) => g0(`S:${g}|${b === 'imsa' ? 'imsa' : 'wec'}|${last}`);
  const current = g => Object.entries(info).filter(([, o]) => o.group === g && o.bodies.aco?.last >= last - 1).map(([m, o]) => [m, o.bodies.aco.last]);
  const classTerm = (g, z) => levelOf(g, 'aco') + Math.min(...current(g).map(([m, y]) => mTerm(m, 'aco', y, z)));
  const gt3 = Object.entries(info).filter(([, o]) => o.group === 'gt3').map(([m, o]) => { const b = o.bodies.aco ? 'aco' : 'imsa'; return {m, b, y: o.bodies[b].last, n: Object.values(o.bodies).reduce((a, x) => a + x.n, 0)}; });
  const evoBases = new Set(gt3.filter(x => x.y >= last - 1 && / \+EVO/.test(x.m)).map(x => x.m.replace(/ \+EVO2?$/, ''))), shown = gt3.filter(x => x.y >= last - 1 || evoBases.has(x.m));
  const f5 = v => +Math.exp(v).toFixed(5), ownLayouts = [...new Set(rows.filter(r => !r.sibling).map(r => r.layout))], tracks = {};
  for (const id of ownLayouts) { const R = rows.filter(r => r.layout === id), kinds = new Set(R.map(r => kind(r.group))), T = k => g0('T:' + id) + g0(`TG:${id}|${k}`), bl = res.byGroupLayout;
    tracks[id] = {events: new Set(R.map(r => r.eventKey)).size, cls: Object.fromEntries(['lmh', 'lmdh', 'gt3'].filter(g => kinds.has(kind(g))).map(g => ['wec-' + (g === 'gt3' ? 'lmgt3' : g), f5(classTerm(g, zOf(id, g)) + T(kind(g)))])),
      errPct: Object.fromEntries(['lmh', 'lmdh', 'gt3'].map(g => [g, bl[g + ' @ ' + id]?.eventOutClass ?? null]).filter(([, v]) => v != null)),
      models: kinds.has('gt') ? Object.fromEntries(shown.map(x => [slug(x.m), f5(levelOf('gt3', x.b) + mTerm(x.m, x.b, x.y, zOf(id, 'gt3')) + T('gt'))])) : {}}; }
  const learned = {generated: res.generated, source: 'Al Kamel published timing 2021-2026 (IMSA, WEC, ELMS, Asian Le Mans Series): best dry qualifying lap of every car model. scripts/sim/learn/fit-endurance.mjs, docs/lapsim-learn.md',
    heldOutPct: Object.fromEntries(['lmh', 'lmdh', 'gt3'].map(g => [g, {event: res.byGroup[g].eventOutClass, eventModel: res.byGroup[g].eventOut, model: res.byGroup[g].modelOut, before: res.byGroup[g].beforeClass, n: res.byGroup[g].events}])),
    models: shown.sort((a, b) => a.m.localeCompare(b.m)).map(x => ({key: slug(x.m), name: x.m.replace(/ \+EVO(2?)$/, (_, n) => ' Evo' + n), base: x.m.replace(/ \+EVO2?$/, ''), ...(/ \+EVO/.test(x.m) ? {evo: /EVO2/.test(x.m) ? 'evo2' : 'evo'} : {}), bop: x.b === 'aco' ? 'ACO (WEC)' : 'IMSA', season: x.y, rows: x.n,
      rel: f5(levelOf('gt3', x.b) + mTerm(x.m, x.b, x.y, 0) - classTerm('gt3', 0))})), tracks};
  writeFileSync('worker/lapsim/learned-data.js', '// Generated by scripts/sim/learn/fit-endurance.mjs. Do not edit by hand. Lap-time factors learned from real laps (docs/lapsim-learn.md).\nexport const lapsimLearned=' + JSON.stringify(learned) + ';\n');
  console.log('learned-data.js:', Object.keys(tracks).length, 'tracks,', learned.models.length, 'GT3 models'); console.table(learned.models.map(m => ({key: m.key, bop: m.bop, season: m.season, rows: m.rows, rel: m.rel})));
  console.log('rows', rows.length, 'events', res.events, 'layouts', res.layouts, 'models', res.models, 'params', Object.keys(full.coef).length); console.log('skipped', skipped); console.log('slow sessions', slow.map(s => s.session + ' +' + s.slowerPct + '%').join('; ')); console.table(res.byGroup); console.table(res.byGroupSeries);
}
