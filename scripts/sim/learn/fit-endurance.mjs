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
import {SURFACE_ERAS} from '../../../worker/lapsim/surface.js';
import {lapsimCalibration} from '../../../worker/lapsim/calibration-data.js';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
import {lapsimFeTracks} from '../../../worker/lapsim/fe-tracks-data.js';
import {SERIES} from '../../../worker/lapsim/series.js';
import {resolveTrack, registry} from './track-registry.mjs';
import {modelOf} from './models.mjs';

const K = lapsimKernel(), WEC = lapsimCalibration.series.wec, ALL = {...lapsimTracks, ...lapsimExtraTracks, ...lapsimFeTracks};
export const WIDTH = {S: 0.02, SS: 0.10, SY: 0.05, T: 0.05, TG: 0.015, M: 0.015, MB: 0.010, MY: 0.007, B: 0.010, F: 1, F2: 0.05, AGE: 0.01, HOT: 0.02, TR: 0.01}, SIGMA = 0.005, HUBER = 2;
// Surface eras (docs/lapsim-learn.md section 12): a full resurfacing starts a new track term; the year is the first season on the
// new asphalt, from the circuits' own announcements. AGE = years on that asphalt (new asphalt is fastest, then slows; cap 3).
export const SURFACE = SURFACE_ERAS;
const era = (l, y) => SURFACE[l] && y >= SURFACE[l] ? l + '@' + SURFACE[l] : l, age = (l, y) => SURFACE[l] && y >= SURFACE[l] ? Math.min(3, y - SURFACE[l]) : 0;
// F1 track factor (log grip of the F1 calibration, latest season): an independent measure of how far the map geometry is off.
const F1G = {}; for (const y of Object.keys(lapsimCalibration.seasons).sort()) for (const [k, v] of Object.entries(lapsimCalibration.seasons[y].tracks || {})) if (v.grip != null) F1G[k] = Math.log(v.grip);
// Banked tracks: the banking is not in the geometry, so the lap depends more on air density (power) than the simulator gives.
const BANKED = new Set(['daytona']), drho = w => Number.isFinite(w.hpa) && Number.isFinite(w.airC) ? Math.log(w.hpa / (w.airC + 273.15) / (1013.25 / 298.15)) : 0;
const zc = z => Math.max(-0.8, Math.min(0.8, z)); // speed slope inside the usual range: street circuits and Daytona do not set it
const GT = /^(GTD|GTDPRO|LMGT3|GT|GT3)$/, body = s => bodyOf(s);
// class of a row -> simulator car. LMP2 (one spec car at almost every track) is kept as a probe of the track terms with the LMDh car.
export function groupOf(r) {
  if (r.cls === 'HYPERCAR' || r.cls === 'GTP') return r.season >= 2023 && r.model ? (SERIES.wec.classes.lmh.manufacturers.test(r.model.base) ? 'lmh' : 'lmdh') : null;
  if (GT.test(r.cls) || r.src === 't71' || r.src === 'sro') return r.model && /GT3|GTD/.test(r.model.base) ? 'gt3' : null;
  if (/^LMP2/.test(r.cls)) return r.model?.base === 'Oreca 07' ? 'lmp2' : null;
  return null;
}
const CAR = {lmh: 'lmh', lmdh: 'lmdh', gt3: 'lmgt3', lmp2: 'lmdh'}, calSeason = y => String(Math.min(2026, Math.max(2025, y)));
const simCache = new Map(), trk = new Map();
// The learning step always simulates with the LATEST calibrated class car (the car the page shows), whatever the season of the
// row: the 2025 and 2026 class cars differ by several percent on one track, so a layout term learned on one does not fit the other.
// Season differences go to S. Only the "before" column uses the season's own car, as the page did.
const LATEST = Object.fromEntries(Object.entries(WEC).map(([c, s]) => [c, Object.keys(s).sort().at(-1)]));
export function simLap(simId, group, season, w, grip = 1, own = false) {
  const cs = own ? calSeason(season) : LATEST[CAR[group]], k = [simId, group, cs, Math.round(w.airC ?? 25), Math.round(w.trackC ?? 35), Math.round((w.hpa ?? 1013) / 5), Math.round((w.hum ?? 50) / 10), grip].join('|'); if (simCache.has(k)) return simCache.get(k);
  const t = trk.get(simId) || trk.set(simId, K.trackFromData(ALL[simId])).get(simId), env = K.conditionsFromWeather({pressureHpa: w.hpa ?? 1013.25, airTempC: w.airC ?? 25, humidityPct: w.hum ?? 50, trackTempC: w.trackC ?? 35, windSpeed: 0, windFromDeg: 0});
  const lap = K.simulateLap(grip === 1 ? t : {...t, mu: Float64Array.from(t.mu, m => m * grip)}, WEC[CAR[group]][cs].car, env).lapTime; simCache.set(k, lap); return lap;
}
// what the page predicts today for a car that has no real lap here (worker/lapsim/scenario.js gripOf)
const prodGrip = (simId, group, season) => { const s = WEC[CAR[group]]; return [calSeason(season), ...Object.keys(s).sort().reverse()].map(k => s[k]?.tracks?.[simId]?.grip).find(g => g != null) ?? lapsimExtraTracks[simId]?.trackFactor?.grip ?? 1; };

// Source tables (scripts/sim/data/learn): the Al Kamel CSV archive (IMSA, WEC, ELMS, Asian LMS), the Al Kamel WEC lap rows of the
// all-laps run (WEC events the archive lacks), and Timing71 GT3 rows (SRO GT World Challenge in every region, IGTC, DTM, Nürburgring,
// Macau). Official Al Kamel rows win: Timing71 rows of IMSA, WEC, ELMS and Asian LMS are not used.
export const SOURCES = ['endurance-cars.csv.gz', 'wec-alkamel-cars.csv.gz', 't71-gt3-cars.csv.gz', 'sro-gt3-cars.csv.gz', 'sro-pdf-cars.csv.gz'].map(f => 'scripts/sim/data/learn/' + f);
// GT3 BoP body: who sets the BoP and how power is controlled (physics rules 4.2). SRO GT3 has no torque sensor.
const ACO = /^(wec|elms|alms)$/, SRO = /^(gtwc|igtc|nur|macau|britishgt)$|gtworldch|gt-world-challenge|24-hours-of-spa|intercontinental|suzuka-1000km|bathurst-12/;
export const bodyOf = s => s === 'imsa' ? 'imsa' : ACO.test(s) ? 'aco' : s === 'dtm' ? 'dtm' : SRO.test(s) ? 'sro' : null;
export const BODY_LABEL = {sro: 'SRO GT3', imsa: 'IMSA GTD', aco: 'WEC LMGT3', dtm: 'DTM'}, BODY_ORDER = ['sro', 'imsa', 'aco', 'dtm'];
// Layout of a row that has no lap length (Timing71): the layouts of the venue whose length gives a plausible mean speed for the
// class at this lap time. Several left: the one raced in that season, then the one with simulator geometry, then the venue default.
const BAND = {gt3: [125, 215], lmh: [140, 265], lmdh: [140, 265], lmp2: [140, 255]};
export function layoutOf({name, lengthKm, season, lap, group, feed, event}) {
  if (lengthKm) return resolveTrack({name, lengthKm, season});
  const v = resolveTrack({name}); if (!v.venue) return v;
  // Nürburgring: a Nordschleife lap is the 24 Hours layout only in a 24 Hours event; NLS races use a shorter layout we do not have
  if (v.venue === 'nurburgring' && lap > 400 && !/24/.test(event || '')) return {venue: v.venue, layout: null, sim: null, how: 'NLS layout (no geometry)'};
  // the event name states the short layout (DTM "Nürburgring short NGK" = the 3.629 km sprint layout)
  if (v.venue === 'nurburgring' && /short|sprint|kurz/i.test(event || name || '')) { const l = registry().layouts.find(x => x.sim === 'nurburgring-sprint'); if (l) return {venue: v.venue, layout: l.id, sim: l.sim, near: null, how: 'named short layout'}; }
  const [lo, hi] = BAND[group] || BAND.gt3, kph = l => l.lengthKm / (lap / 3600);
  let L = registry().layouts.filter(l => l.venue === v.venue && kph(l) >= lo && kph(l) <= hi);
  if (!L.length) return {venue: v.venue, layout: null, sim: null, how: `no layout of ${v.venue} fits the lap time`};
  const inS = L.filter(l => l.seasons?.some(([a, b]) => season >= a && season <= b)); if (inS.length) L = inS;
  // a sports-car lap with no length: prefer layouts sports-car timing has stated over F1-only layouts (Paul Ricard GT laps fell on the F1 line)
  const sc = L.filter(l => (l.sources || []).some(x => !x.startsWith('f1db'))); if (sc.length) L = sc;
  const l = L.find(x => x.sim) && L.length > 1 ? L.filter(x => x.sim).sort((a, b) => Math.abs(kph(a) - 170) - Math.abs(kph(b) - 170))[0] : L.find(x => x.default) || L[0];
  return {venue: v.venue, layout: l.id, sim: l.sim || null, near: l.near || null, how: 'lap-time band'};
}
const PDF_VENUE = [[/spa/, 'Spa-Francorchamps'], [/nuerburg|nurburg/, 'Nürburgring'], [/suzuka/, 'Suzuka'], [/kyalami/, 'Kyalami'], [/indianapolis/i, 'Indianapolis'],
  [/laguna/, 'Laguna Seca'], [/gulf|abu-dhabi|yas/, 'Yas Marina'], [/bathurst|panorama/, 'Bathurst']];
export function loadRows(files = SOURCES) {
  const best = new Map(), skipped = {}, skip = why => { skipped[why] = (skipped[why] || 0) + 1; };
  const split = l => { const o = []; let f = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { o.push(f); f = ''; } else f += c; } o.push(f); return o; };
  // records: the FASTEST real lap of every car model (per BoP body) and of every class on every layout, any season, any dry session
  // (owner rule 2026-11-14: a car + track combination that really ran shows its fastest real lap). Race laps also kept apart.
  const records = new Map(), keep = (k, o) => { const p = records.get(k); if (!p || o.real < p.real) records.set(k, o); };
  const archive = new Set(), pending = [];
  for (const file of [].concat(files)) {
    const src = /t71/.test(file) ? 't71' : /alkamel/.test(file) ? 'alkamel' : /sro-/.test(file) ? 'sro' : 'archive'; // sro-pdf (IGTC) is SRO too
    const [head, ...lines] = (file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString() : readFileSync(file, 'utf8')).trim().split('\n'), cols = head.split(',');
    for (const l of lines) { const a = split(l), r = Object.fromEntries(cols.map((c, i) => [c, a[i]])); r.src = src;
      if (/sro-pdf/.test(file)) r.venue = PDF_VENUE.find(([re]) => re.test(r.venue))?.[1] || r.venue.replace(/-/g, ' '); // IGTC PDF meetings are named by slug
      if (src === 't71' && (ACO.test(r.feed) || r.feed === 'imsa' || !bodyOf(r.feed))) continue; // official Al Kamel rows cover these; other GT series have their own BoP
      if (!['Q', 'P', 'R'].includes(r.type)) continue;
      // SRO tables: the GT3 classes name the car without 'GT3'
      r.season = +r.season; r.best = +r.best; r.model = modelOf(src === 'sro' && !/GT4|GTC|CUP/i.test(r.cls) && !/GT3/i.test(r.vehicle) ? r.vehicle + ' GT3' : r.vehicle, r.season, src === 't71' || src === 'sro' ? 'GT3' : r.cls); const group = groupOf(r); if (!group || !(r.best > 20)) continue;
      const num = v => v === '' || v == null ? null : +v, w = {airC: num(r.airC), trackC: num(r.trackC), hum: num(r.hum), hpa: num(r.hpa)}; if (w.trackC != null && w.airC != null && w.trackC > w.airC + 35) w.trackC = null; // IMSA 2021 track temperatures are not usable
      const tr = layoutOf({name: r.venue || r.event, lengthKm: num(r.lenKm), season: r.season, lap: r.best, group, feed: r.feed, event: r.event}), b = group === 'gt3' ? bodyOf(r.series) : null;
      if (group === 'gt3' && !b) continue;
      if (src === 'archive' && r.series === 'wec' && tr.venue) archive.add(r.season + '|' + tr.venue);
      pending.push({r, group, tr, w, b, num}); } }
  // an SRO row is fitted only when its layout is certain: not found by lap time among several built layouts (Paul Ricard GT laps fell on
  // the F1 layout), and
  // inside the seasons the layout is known to have been used (Baku 2013 was another street circuit than the F1 one)
  const REGL = new Map(JSON.parse(readFileSync('scripts/sim/data/track-registry.json', 'utf8')).layouts.map(l => [l.id, l]));
  const simsOf = v => [...REGL.values()].filter(l => l.venue === v && l.sim && !l.sim.startsWith('fe-')).length; // Formula E street layouts are no GT3 candidate
  const sroSure = (tr, y) => { if (tr.how === 'lap-time band' && simsOf(tr.venue) !== 1) return false; const sz = REGL.get(tr.layout)?.seasons || []; return !sz.length || sz.some(([a, b]) => y >= a - 1 && y <= b + 1); };
  // SRO rows fill only thin layouts: a layout with fewer than 3 GT3 seasons from the timed sources, and only its other seasons
  // SRO tables and PDFs: a "best lap" far below its session's median is a gap or a total read as a lap (Natsoft race PDFs): dropped
  { const med = new Map(); for (const p of pending) if (p.r.src === 'sro') (med.get(p.r.event + '|' + p.r.session) || med.set(p.r.event + '|' + p.r.session, []).get(p.r.event + '|' + p.r.session)).push(p.r.best);
    for (const [k, a] of med) { a.sort((x, y) => x - y); med.set(k, a[a.length >> 1]); }
    for (let i = pending.length - 1; i >= 0; i--) { const r = pending[i].r; if (r.src === 'sro' && r.best < 0.92 * med.get(r.event + '|' + r.session)) { pending.splice(i, 1); skip('SRO lap far below its session median (a gap read as a lap)'); } } }
  // and an SRO lap more than 5 % below the median event best of its layout and class (3+ events) is not a lap of that layout
  { const ev = new Map(); for (const p of pending) { const k = p.tr.layout + '|' + p.group, e = p.r.event + '|' + p.r.season; const m = ev.get(k) || ev.set(k, new Map()).get(k); m.set(e, Math.min(m.get(e) ?? Infinity, p.r.best)); }
    const ref = new Map([...ev].filter(([, m]) => m.size >= 3).map(([k, m]) => { const a = [...m.values()].sort((x, y) => x - y); return [k, a[a.length >> 1]]; }));
    for (let i = pending.length - 1; i >= 0; i--) { const p = pending[i], m = ref.get(p.tr.layout + '|' + p.group); if (p.r.src === 'sro' && m && p.r.best < 0.95 * m) { pending.splice(i, 1); skip('SRO lap far below the event bests of its layout'); } } }
  const covered = new Set(pending.filter(p => p.r.src !== 'sro' && p.r.type === 'Q' && p.group === 'gt3').map(p => p.tr.layout + '|' + p.r.season));
  const thick = new Set(Object.entries([...covered].reduce((o, k) => { const l = k.split('|')[0]; o[l] = (o[l] || 0) + 1; return o; }, {})).filter(([, n]) => n >= 3).map(([l]) => l));
  for (const {r, group, tr, w, b, num} of pending) {
    // a layout found from the lap time alone must also fit the class car: within 8 % of its simulated lap there (no track factor;
    // 12 % was only needed while the Paul Ricard map was broken)
    if (tr.how === 'lap-time band' && tr.sim && Math.abs(r.best / simLap(tr.sim, group, r.season, w) - 1) > 0.08) { skip('lap does not fit the layout found by lap time'); continue; }
    if (r.src === 'alkamel' && archive.has(r.season + '|' + tr.venue)) continue; // the archive already holds this WEC event (same season and venue)
    const dry = !(+r.rainShare > 0.02), o = {series: r.series, season: r.season, event: r.event, layout: tr.layout, group, model: r.model.key, body: b, entry: r.entry, real: r.best, type: r.type, session: r.session, w};
    if (dry && tr.sim && (r.src !== 'sro' || sroSure(tr, r.season))) for (const k of [`${tr.layout}|m|${o.model}|${b}`, `${tr.layout}|c|${group}`, `${tr.layout}|c|${group}|${b}`, `${tr.layout}|c|${group}|s:${r.series}`]) { keep(k, o); if (r.type === 'R') keep(k + '|race', o); }
    // Hypercar class pair (owner 2026-11-21): each event's class best, dry qualifying (and race), so LMH and LMDh can come from the same event
    if (dry && tr.sim && (group === 'lmh' || group === 'lmdh') && (r.type === 'Q' || r.type === 'R') && (r.series === 'wec' || r.series === 'imsa'))
      keep(`${tr.layout}|ev|${r.series}|${r.season}|${r.event}|${group}${r.type === 'R' ? '|race' : ''}`, o);
    // DTM: records only. Tried 2026-11-15 with named layouts (short NGK = sprint): Timing71 DTM rows carry no weather or rain flag, and
    // single wet sessions gave 7-11 % errors (GT3 event-hidden 1.12 -> 1.40 %), so they stay out of the fit.
    // SRO official tables (no weather): fitted only for a layout and season that no
    // Timing71 or Al Kamel row covers, on layouts those sources barely have (owner 2026-11-15: Misano had one event, so its error could not use a track term)
    if (r.type !== 'Q' || b === 'dtm' || r.src === 'sro' && (thick.has(tr.layout) || covered.has(tr.layout + '|' + r.season) || !sroSure(tr, r.season))) continue;
    const why = !dry ? 'wet qualifying' : !tr.layout ? 'layout not resolved: ' + (tr.how || '').slice(0, 40) : !(tr.sim || tr.near) ? 'no simulator geometry: ' + tr.layout : null; // a ⚠️ track is learned too: its layout term absorbs the geometry error and the held-out error decides the mark
    if (why) { skip(why); continue; }
    const k = [r.series, r.season, r.event, group, r.model.key].join('|'), p = best.get(k);
    if (!p || r.best < p.real) best.set(k, {...o, sim: tr.sim || tr.near, sibling: !tr.sim, trap: num(r.trapKph), eventKey: [r.series, r.season, r.event].join('|')});
  }
  // a best lap more than 10 % off the class best of its event is not a push lap (traffic, incomplete timing, Code 60): not fitted
  const top = new Map(); for (const r of best.values()) { const k = r.eventKey + '|' + r.group; top.set(k, Math.min(top.get(k) ?? Infinity, r.real)); }
  for (const [k, r] of best) if (r.real > 1.10 * top.get(r.eventKey + '|' + r.group)) { best.delete(k); skip('not a push lap (>10 % off the event class best)'); }
  const rows = [...best.values()]; for (const r of rows) { r.sim0 = simLap(r.sim, r.group, r.season, r.w); r.y = Math.log(r.real / r.sim0); r.prod = simLap(r.sim, r.group, r.season, r.w, prodGrip(r.sim, r.group, r.season), true); }
  const zStat = {};
  // z: how fast the layout is (class car mean speed, standard weather), standardised per group
  for (const g of new Set(rows.map(r => r.group))) { const R = rows.filter(r => r.group === g), v = r => Math.log(ALL[r.sim].length / simLap(r.sim, g, 2026, {})), m = R.reduce((a, r) => a + v(r), 0) / R.length, sd = Math.sqrt(R.reduce((a, r) => a + (v(r) - m) ** 2, 0) / R.length) || 1; for (const r of R) r.z = (v(r) - m) / sd; zStat[g] = {m, sd}; }
  return {rows, skipped, zStat, records};
}
const kind = g => g === 'gt3' ? 'gt' : 'proto';
const terms = r => { const f = F1G[r.sim] ?? 0, e = era(r.layout, r.season), t = [['S', r.group + '|' + r.series + '|' + r.season, 1], ['SS', r.group + '|' + r.series, 1], ['SY', r.group + '|' + r.season, 1],
  ['T', e, 1], ['TG', e + '|' + kind(r.group), 1], ['M', r.model, 1], ['MB', r.model + '|' + body(r.series), 1], ['MY', r.model + '|' + body(r.series) + '|' + r.season, 1], ['B', r.model, zc(r.z)],
  ['F', kind(r.group), f], ['F2', 'all', 10 * f * f], ['AGE', 'all', age(r.layout, r.season)]];
  if (Number.isFinite(r.w?.trackC)) t.push(['HOT', 'all', Math.max(0, r.w.trackC - 45) / 10]); // grip above 45 °C track temperature: the simulator loses too much
  if (BANKED.has(r.layout)) t.push(['TR', r.layout, 10 * drho(r.w || {})]);
  return t; };
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
  const loaded = loadRows(process.argv.length > 3 ? process.argv.slice(2, -1) : SOURCES), skipped = loaded.skipped, OUT = process.argv.length > 3 ? process.argv.at(-1) : 'scripts/sim/data/learn/endurance-fit.json'; let rows = loaded.rows;
  // Wet or disrupted qualifying that the rain column missed (rule 3.3.1): the whole class of an event is more than 4 % slower than
  // the fit predicts from every OTHER event. Slow side only. The sessions are listed, not fitted and not scored.
  // Repeated until no new session is found (at most 3 passes): a wet session left in the data pulls the prediction of the others.
  const slow = []; for (let pass = 0; pass < 3; pass++) { const g = new Map(), found = slow.length; for (const ev of new Set(rows.map(r => r.eventKey))) { const f = fit(rows.filter(r => r.eventKey !== ev)); for (const r of rows.filter(r => r.eventKey === ev)) { const k = ev + '|' + r.group; (g.get(k) || g.set(k, []).get(k)).push(Math.log(r.real / f.predict(r))); } }
    const mean = new Map([...g].map(([k, e]) => [k, e.reduce((a, x) => a + x, 0) / e.length])), wetEv = new Set([...mean].filter(([, m]) => m > 0.04).map(([k]) => k.split('|').slice(0, -1).join('|')));
    // another class of an event with a wet class is dropped from 2 % slow (same weekend weather, e.g. WEC 2025 COTA GT3 at 3.9 %)
    for (const [k, m] of mean) if (m > 0.04 || m > 0.02 && wetEv.has(k.split('|').slice(0, -1).join('|'))) slow.push({session: k, cars: g.get(k).length, slowerPct: +(m * 100).toFixed(1)});
    const bad = new Set(slow.map(s => s.session)); rows = rows.filter(r => !bad.has(r.eventKey + '|' + r.group)); if (slow.length === found) break; }
  skipped['slow session (wet or disrupted), listed'] = loaded.rows.length - rows.length;
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
  // GT3 cars on the page: one per car model AND BoP body (SRO GT3 first: the base GT3, no torque sensor), base and Evo kit apart.
  // SRO (the basic GT3, no torque sensor) keeps the plain key gt3-<model>; other BoP bodies are gt3-<body>-<model>
  const slug = (k, b) => (b === 'sro' ? 'gt3-' : `gt3-${b}-`) + k.toLowerCase().replace(/\+evo2?/, m => m.slice(1)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const info = {}; for (const r of rows) { const o = info[r.model] ||= {group: r.group, bodies: {}}; const b = o.bodies[body(r.series)] ||= {last: 0, n: 0}; b.last = Math.max(b.last, r.season); b.n++; }
  for (const [k, r] of loaded.records) if (r.group === 'gt3' && !k.endsWith('|race')) { const o = info[r.model] ||= {group: 'gt3', bodies: {}}; const b = o.bodies[r.body] ||= {last: 0, n: 0, recordOnly: true}; b.last = Math.max(b.last, r.season); }
  const mTerm = (m, b, y, z) => g0('M:' + m) + g0(`MB:${m}|${b}`) + g0(`MY:${m}|${b}|${y}`) + g0('B:' + m) * zc(z);
  // level of a body: mean season level of its series in the latest season it raced (row-weighted)
  const levelOf = (g, b) => { const S = rows.filter(r => r.group === g && body(r.series) === b), y = Math.max(...S.map(r => r.season)); const lv = (s, yy) => g0(`S:${g}|${s}|${yy}`) + g0(`SS:${g}|${s}`) + g0(`SY:${g}|${yy}`), ks = S.filter(r => r.season === y).map(r => r.series); return ks.length ? ks.reduce((a, s) => a + lv(s, y), 0) / ks.length : lv('wec', last); };
  const current = g => Object.entries(info).filter(([, o]) => o.group === g && o.bodies.aco?.last >= last - 1 && !o.bodies.aco.recordOnly).map(([m, o]) => [m, o.bodies.aco.last]);
  const classTerm = (g, z) => levelOf(g, 'aco') + Math.min(...current(g).map(([m, y]) => mTerm(m, 'aco', y, z)));
  const gt3 = Object.entries(info).filter(([, o]) => o.group === 'gt3').flatMap(([m, o]) => Object.entries(o.bodies).filter(([b]) => BODY_ORDER.includes(b)).map(([b, x]) => ({m, b, y: x.last, n: x.n, fitted: !x.recordOnly})));
  const evoBases = new Set(gt3.filter(x => x.y >= last - 1 && / \+EVO/.test(x.m)).map(x => x.b + '|' + x.m.replace(/ \+EVO2?$/, ''))), shown = gt3; // every model that raced is listed (owner 2026-11-15: every measured lap, older generations too)
  const f5 = v => +Math.exp(v).toFixed(5), ownLayouts = [...new Set(rows.filter(r => !r.sibling).map(r => r.layout))], tracks = {};
  for (const id of ownLayouts) { const R = rows.filter(r => r.layout === id), kinds = new Set(R.map(r => kind(r.group))), e = era(id, 9999), f = F1G[R[0].sim] ?? 0, T = k => g0('T:' + e) + g0(`TG:${e}|${k}`) + g0('F:' + k) * f + g0('F2:all') * 10 * f * f + g0('AGE:all') * age(id, last), bl = res.byGroupLayout; // current surface, standard weather
    tracks[id] = {events: new Set(R.map(r => r.eventKey)).size, cls: Object.fromEntries(['lmh', 'lmdh', 'gt3'].filter(g => kinds.has(kind(g))).map(g => ['wec-' + (g === 'gt3' ? 'lmgt3' : g), f5(classTerm(g, zOf(id, g)) + T(kind(g)))])),
      errPct: Object.fromEntries(['lmh', 'lmdh', 'gt3'].map(g => [g, bl[g + ' @ ' + id]?.eventOutClass ?? null]).filter(([, v]) => v != null)),
      models: kinds.has('gt') ? Object.fromEntries(shown.filter(x => x.fitted).map(x => [slug(x.m, x.b), f5(levelOf('gt3', x.b) + mTerm(x.m, x.b, x.y, zOf(id, 'gt3')) + T('gt'))])) : {}}; }
  // Real laps to REPRODUCE (owner rule 2026-11-14): the fastest real lap of each car (model + body) and each class on every layout
  // with geometry, any season and dry session. WEC class cars take the fastest WEC or IMSA lap (owner 2026-11-15), then the same
  // class in other series (ACO-body GT3 for LMGT3, then any GT3).
  const realOf = r => ({lap: r.real, year: r.season, series: r.series, event: r.event, session: r.session, type: r.type, entry: r.entry, model: r.model, body: r.body || undefined, ...(r.pairEvent !== undefined ? {pairEvent: r.pairEvent} : {}),
    weather: Object.fromEntries(Object.entries({airTempC: r.w.airC, trackTempC: r.w.trackC, humidityPct: r.w.hum, pressureHpa: r.w.hpa}).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [k, +v.toFixed(2)]))});
  const rec = loaded.records, get = (...ks) => ks.map(k => rec.get(k)).find(Boolean), pack = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v).map(([k, v]) => [k, realOf(v)]));
  const recLayouts = new Set([...rec.keys()].map(k => k.split('|')[0]).filter(id => registry().layouts.find(l => l.id === id)?.sim));
  for (const id of new Set([...ownLayouts, ...recLayouts])) { const t = tracks[id] ||= {events: 0, cls: {}, errPct: {}, models: {}};
    // WEC class cars: the faster of the WEC and IMSA records (owner 2026-11-15, rule 12); another series fills only an empty slot
    const best = (g, sfx) => [rec.get(`${id}|c|${g}|s:wec${sfx}`), rec.get(`${id}|c|${g}|s:imsa${sfx}`)].filter(Boolean).sort((a, b) => a.real - b.real)[0];
    // LMH and LMDh (owner 2026-11-21, "같은 시즌으로 맞춤"): both class laps from the latest event where both classes set a dry qualifying
    // (race: race) lap here (latest season; WEC before IMSA in the same season); so the page's LMH − LMDh gap is a real same-event gap under that event's BoP. Without such
    // an event the class keeps the fastest WEC/IMSA lap of any season, marked pairEvent: null.
    const pair = sfx => { const ev = {}; for (const [k, v] of rec) { const q = k.split('|'); if (q[0] !== id || q[1] !== 'ev' || (sfx ? q[6] !== 'race' : q.length !== 6)) continue;
        (ev[q.slice(2, 5).join('|')] ||= {series: q[2], season: +q[3], session: ''})[q[5]] = v; }
      const both = Object.values(ev).filter(e => e.lmh && e.lmdh).sort((a, b) => b.season - a.season || (a.series === 'wec' ? 0 : 1) - (b.series === 'wec' ? 0 : 1)
        || String(b.lmh.session).localeCompare(String(a.lmh.session)));
      return both[0] || null; };
    const paired = (g, sfx) => { const p = pair(sfx); return p ? {...p[g], pairEvent: `${p.series.toUpperCase()} ${p.season} ${p[g].event}`} : (v => v && {...v, pairEvent: null})(best(g, sfx) || get(`${id}|c|${g}${sfx}`)); };
    const cls = sfx => ({'wec-lmh': paired('lmh', sfx), 'wec-lmdh': paired('lmdh', sfx), 'wec-lmgt3': best('gt3', sfx) || get(`${id}|c|gt3|aco${sfx}`, `${id}|c|gt3${sfx}`)});
    t.real = pack(Object.fromEntries(shown.map(x => [slug(x.m, x.b), get(`${id}|m|${x.m}|${x.b}`)]))); t.classReal = pack(cls(''));
    t.raceReal = pack({...Object.fromEntries(shown.map(x => [slug(x.m, x.b), get(`${id}|m|${x.m}|${x.b}|race`)])), ...cls('|race')}); }
  const learned = {generated: res.generated, source: 'Al Kamel published timing 2021-2026 (IMSA, WEC, ELMS, Asian Le Mans Series) and Timing71 (SRO GT World Challenge, IGTC, DTM, Nürburgring, Macau): every car model. scripts/sim/learn/fit-endurance.mjs, docs/lapsim-learn.md',
    heldOutPct: Object.fromEntries(['lmh', 'lmdh', 'gt3'].map(g => [g, {event: res.byGroup[g].eventOutClass, eventModel: res.byGroup[g].eventOut, model: res.byGroup[g].modelOut, before: res.byGroup[g].beforeClass, n: res.byGroup[g].events}])),
    models: shown.sort((a, b) => BODY_ORDER.indexOf(a.b) - BODY_ORDER.indexOf(b.b) || a.m.localeCompare(b.m)).map(x => ({key: slug(x.m, x.b), name: x.m.replace(/ \+EVO(2?)$/, (_, n) => ' Evo' + n), base: x.m.replace(/ \+EVO2?$/, ''), ...(/ \+EVO/.test(x.m) ? {evo: /EVO2/.test(x.m) ? 'evo2' : 'evo'} : {}),
      body: x.b, bop: BODY_LABEL[x.b], season: x.y, rows: x.n, fitted: x.fitted, rel: f5((x.fitted ? levelOf('gt3', x.b) + mTerm(x.m, x.b, x.y, 0) : levelOf('gt3', x.b) + g0('M:' + x.m)) - classTerm('gt3', 0))})), tracks};
  writeFileSync('worker/lapsim/learned-data.js', '// Generated by scripts/sim/learn/fit-endurance.mjs. Do not edit by hand. Lap-time factors learned from real laps (docs/lapsim-learn.md).\nexport const lapsimLearned=' + JSON.stringify(learned) + ';\n');
  console.log('learned-data.js:', Object.keys(tracks).length, 'tracks,', learned.models.length, 'GT3 models'); console.table(learned.models.map(m => ({key: m.key, season: m.season, rows: m.rows, fitted: m.fitted, rel: m.rel})));
  console.log('rows', rows.length, 'events', res.events, 'layouts', res.layouts, 'models', res.models, 'params', Object.keys(full.coef).length); console.log('skipped', skipped); console.log('slow sessions', slow.map(s => s.session + ' +' + s.slowerPct + '%').join('; ')); console.table(res.byGroup); console.table(res.byGroupSeries);
}
