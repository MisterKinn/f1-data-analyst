// Cars, real qualifying conditions and FIA circuit changes for one track. Shared by the
// /simulation page and the lapsim_simulate connector tool so both give the same answer.
import {lapsimWecPoles} from './wec-poles-data.js';
import {lapsimF1Poles} from './f1-poles-data.js';
import {lapsimSeriesPoles} from './series-poles-data.js';
// series cars: key → [series, class, calibrated base car]
export const SERIES_CARS = {'imsa-gtp': ['imsa', 'gtp', 'wec-lmdh'], 'imsa-gtdpro': ['imsa', 'gtdpro', 'wec-lmgt3'], 'imsa-gtd': ['imsa', 'gtd', 'wec-lmgt3'],
  'elms-lmgt3': ['elms', 'lmgt3', 'wec-lmgt3'], 'alms-gt3': ['alms', 'gt3', 'wec-lmgt3'], 'gtwc-gt3': ['gtwc', 'gt3', 'wec-lmgt3'], 'dtm-gt3': ['dtm', 'gt3', 'wec-lmgt3'],
  'igtc-gt3': ['igtc', 'gt3', 'wec-lmgt3'], 'nur-gt3': ['nur', 'gt3', 'wec-lmgt3'], 'macau-gt3': ['macau', 'gt3', 'wec-lmgt3']};
import {lapsimCalibration} from './calibration-data.js';
import {lapsimExtraTracks} from './tracks-data.js';
import {lapsimLearned} from './learned-data.js';
import {lapsimTrackChanges} from './track-changes-data.js';
import {lapsimChangeEffects} from './change-effects-data.js';
import {TUM_2019, PRIOR, applyRules, applyDevelopment} from './cars.js';
import {SERIES} from './series.js';

// GT3 is shown per car model (base model + Evo tick box); F1, LMH and LMDh are shown per regulation (owner rule, 2026-11-14)
export const CAR_ORDER = ['base2019', '2025', '2026', '2027', '2028', 'wec-lmh', 'wec-lmdh', 'wec-lmgt3', ...(lapsimLearned?.models || []).map(m => m.key)];

// grip: the per-track factor fitted with that season's car (absorbs asphalt and line differences)
export function carsFor(id) {
  const s = lapsimCalibration?.seasons || {}, p = lapsimCalibration?.projections || {};
  const gripOf = y => [y, ...Object.keys(s).sort().reverse()].map(k => s[k]?.tracks?.[id]?.grip).find(g => g != null) ?? lapsimExtraTracks[id]?.trackFactor?.grip ?? 1; // extra circuit: factor learned from its real laps, if any
  // drag: per-track straight-line factor shared by the F1 seasons (when the calibration fitted one)
  const drag = [...Object.keys(s).sort().reverse()].map(k => s[k]?.tracks?.[id]?.drag).find(d => d != null) ?? 1;
  const withDrag = c => drag === 1 ? c : {...c, cdA: c.cdA * drag, cdALow: (c.cdALow ?? c.cdA) * drag};
  const out = {base2019: {car: TUM_2019, grip: 1, kind: 'base', year: 2019}};
  for (const y of [2025, 2026]) out[y] = {car: s[y]?.car ? withDrag(s[y].car) : PRIOR[y], grip: s[y]?.car ? gripOf(y) : 1, kind: s[y]?.car ? 'calibrated' : 'prior', year: y};
  // projected cars are rebuilt from the current regulation values (rules-data.js) plus the fitted
  // development factor, so a regulation update applies without a new calibration run
  for (const y of [2027, 2028]) {
    const c = applyDevelopment(applyRules(s[2026]?.car || PRIOR[2026], y), p[y]?.development ?? 0); c.label = String(y);
    out[y] = {car: s[2026]?.car ? withDrag(c) : c, grip: gripOf(2026), kind: 'projected', year: y};
  }
  // WEC classes (latest calibrated season), on the same track factor as F1
  for (const [cls, def] of Object.entries(SERIES.wec.classes)) {
    const seasons = lapsimCalibration?.series?.wec?.[cls] || {}, y = Object.keys(seasons).sort().at(-1);
    out['wec-' + cls] = y ? {car: seasons[y].car, grip: gripOf(2026), kind: 'calibrated', year: Number(y), series: 'wec', cls}
      : {car: def.prior, grip: gripOf(2026), kind: 'prior', year: 2026, series: 'wec', cls};
    // sector correction on tracks this class raced in its calibrated season (Al Kamel best lap, dry)
    const p = y && lapsimWecPoles?.[id]?.[y]?.[cls];
    if (p) out['wec-' + cls].fix = {real: p.sectors, weather: p.weather, ref: 'wec-' + cls};
  }
  // Series without their own car model yet: provisional car from the nearest calibrated class (IMSA GTP = LMDh,
  // GT3 series = LMGT3). Raced sessions reproduce through a lap correction (real best lap minus the simulated
  // lap in that weather); elsewhere the provisional car is an estimate with no fitted error range.
  for (const [key, [ser, cls, base]] of Object.entries(SERIES_CARS)) {
    const b = out[base]; if (!b) continue;
    const ys = lapsimSeriesPoles?.[ser]?.[id] || {}, y = Object.keys(ys).filter(k => ys[k][cls]).sort().at(-1), p = y && ys[y][cls];
    out[key] = {car: b.car, grip: b.grip, kind: 'proxy', year: y ? Number(y) : b.year, series: ser, cls, proxyOf: base,
      ...(p ? {fix: {lap: p.lap, weather: p.weather || {}, ref: key, session: p.session}} : {})};
  }
  // Sector correction on tracks raced with this rule set: the real pole's sector times minus the
  // fitted 2026 car's sectors in the same weather (worked out where the lap is simulated). Projected
  // cars keep the 2026 correction (it describes the track, not the car).
  const t26 = s[2026]?.tracks?.[id], t25 = s[2025]?.tracks?.[id];
  // real pole sectors: TracingInsights pole table first (any driver), else the fit's reference lap when it was P1
  const fix = (t, y) => { if (!t || t.weather?.rain) return null; const p = lapsimF1Poles?.[id]?.[y];
    const real = p?.sectors || (t.position === 1 ? t.realSectors : null); return real ? {real, weather: t.weather, ref: '2026'} : null; };
  if (out[2026].kind === 'calibrated' && fix(t26, 2026)) for (const y of [2026, 2027, 2028]) out[y].fix = fix(t26, 2026);
  if (out[2025].kind === 'calibrated' && fix(t25, 2025)) out[2025].fix = {...fix(t25, 2025), ref: '2025'};
  // Learned from real laps (docs/lapsim-learn.md): a lap-time factor on the class car with no track factor.
  // Class cars take it only where their own calibration has no value for this track; GT3 model cars always (elsewhere: the
  // LMGT3 class car of this track times the model's gap to the fastest model).
  const L = lapsimLearned?.tracks?.[id], H = lapsimLearned?.heldOutPct || {};
  for (const cls of Object.keys(SERIES.wec.classes)) { const k = 'wec-' + cls, c = out[k], own = Object.values(lapsimCalibration?.series?.wec?.[cls] || {}).some(se => se.tracks?.[id]);
    if (L?.cls?.[k] && c.kind === 'calibrated' && !own) Object.assign(c, {grip: 1, timeScale: L.cls[k], learned: {pct: L.errPct?.[cls === 'lmgt3' ? 'gt3' : cls] ?? H[cls === 'lmgt3' ? 'gt3' : cls]?.event ?? null, events: L.events}}); }
  const g3 = out['wec-lmgt3'];
  if (g3?.kind === 'calibrated') for (const m of lapsimLearned?.models || []) out[m.key] = {car: g3.car, grip: L?.models?.[m.key] ? 1 : g3.grip, timeScale: L?.models?.[m.key] ?? (g3.timeScale || 1) * m.rel, kind: 'learned', year: m.season, series: 'gt3', cls: 'gt3',
    base: m.base, ...(m.evo ? {evo: m.evo} : {}), label: `${m.name} · ${m.bop} BoP`, learned: {pct: L?.models?.[m.key] ? Math.max(H.gt3?.eventModel ?? 0, L.errPct?.gt3 ?? 0) : null, events: L?.events ?? 0, model: true}};
  // Extra circuit: a car that has a real qualifying lap here reproduces it (lap-level correction, as for the series cars)
  for (const [k, r] of Object.entries(lapsimExtraTracks[id]?.realLaps || {})) if (out[k] && !out[k].fix) out[k].fix = {lap: r.lap, weather: r.weather || {}, ref: k, session: r.event};
  for (const c of Object.values(out)) c.unc = uncertainty(c, id);
  return out;
}

// Error range (1 sigma, % of lap time) and confidence label (common rule).
// On a track the car was fitted on: the season's in-sample lap-time error (RMS over its tracks).
// On a track it was not fitted on: the holdout error (tracks left out of the fit, predicted).
// Projections add half the historical development range for each projected year.
export function uncertainty(c, id) {
  const cal = lapsimCalibration || {};
  if (c.kind === 'base' || c.kind === 'prior') return {pct: null, confidence: 'not-fitted'};
  if (c.kind === 'proxy') return {pct: null, confidence: c.fix ? 'reproduced' : 'provisional'};
  if (c.learned) { // error of the learning step with this event hidden; a GT3 model on a track with no endurance lap: class error and model error together
    const base = c.learned.pct ?? (c.learned.model ? Math.hypot(cal.series?.wec?.lmgt3?.[Object.keys(cal.series?.wec?.lmgt3 || {}).sort().at(-1)]?.holdout?.rmsPct ?? 2, lapsimLearned.heldOutPct?.gt3?.model ?? 1) : null);
    return base == null ? {pct: null, confidence: 'low'} : {pct: Math.round(base * 100) / 100, confidence: base > 3 ? 'very-low' : base > 1 ? 'low' : 'medium', basis: 'holdout', holdoutPct: base}; }
  const season = c.series ? cal.series?.[c.series]?.[c.cls]?.[c.year] : c.kind === 'projected' ? cal.seasons?.[2026] : cal.seasons?.[c.year];
  if (!season) return {pct: null, confidence: 'low'};
  const errs = Object.values(season.tracks || {}).filter(t => t.realLap > 0).map(t => t.errorSec / t.realLap * 100);
  const inSample = errs.length ? Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length) : null;
  const fitted = !!season.tracks?.[id];
  let pct = fitted ? inSample : season.holdout?.rmsPct ?? null;
  if (pct == null) return {pct: null, confidence: 'low'};
  if (c.kind === 'projected') {
    let band = 0;
    for (const y of [2027, 2028]) if (y <= c.year) { const b = cal.projections?.[y]?.bandPct; if (b) band += Math.abs(b[0] - b[1]) / 2; }
    pct = Math.hypot(pct, band);
  }
  // thresholds: ≤1% medium, ≤3% low, above very low; never "high" (provisional estimates)
  const confidence = pct > 3 ? 'very-low' : c.kind === 'projected' || pct > 1 ? 'low' : 'medium';
  return {pct: Math.round(pct * 100) / 100, confidence, basis: fitted ? 'fit' : 'holdout', holdoutPct: season.holdout?.rmsPct ?? null};
}

// Weather of the real pole lap per season (OpenF1 session means), with the real lap time
export function realConditions(id) {
  const s = lapsimCalibration?.seasons || {}, out = {};
  for (const y of ['2025', '2026']) { const r = s[y]?.tracks?.[id]; if (r?.weather) out[y] = {...r.weather, realLap: r.realLap, driver: r.driver, position: r.position ?? 1}; }
  // WEC: best qualifying/Hyperpole lap per class, keyed like the car ('wec-hypercar')
  for (const [cls, seasons] of Object.entries(lapsimCalibration?.series?.wec || {})) {
    const y = Object.keys(seasons).filter(k => seasons[k].tracks?.[id]).sort().at(-1), r = y && seasons[y].tracks[id];
    if (r?.weather) out['wec-' + cls] = {...r.weather, realLap: r.realLap, year: Number(y), event: r.event, car: r.car, manufacturer: r.manufacturer, position: 1};
  }
  // series cars: the real session of their latest raced season here (Timing71 weather, session median)
  for (const [key, [ser, cls]] of Object.entries(SERIES_CARS)) {
    const ys = lapsimSeriesPoles?.[ser]?.[id] || {}, y = Object.keys(ys).filter(k => ys[k][cls]).sort().at(-1), p = y && ys[y][cls];
    if (p) out[key] = {...Object.fromEntries(Object.entries(p.weather || {}).filter(([, v]) => Number.isFinite(v))), realLap: p.lap, year: Number(y), event: p.session, car: p.car, manufacturer: p.make, position: 1, source: 'timing71'};
  }
  // extra circuits: the real lap of each car that raced here (docs/lapsim-tracks-extra.md)
  for (const [k, r] of Object.entries(lapsimExtraTracks[id]?.realLaps || {})) if (!out[k]) out[k] = {...r.weather, realLap: r.lap, year: r.year, event: r.event, car: r.car, manufacturer: r.manufacturer, position: 1, source: r.source};
  return out;
}

// Latest "Changes to the circuit" list read from the race director's notes
export function latestChanges(id) {
  const years = Object.keys(lapsimTrackChanges[id] || {}).sort();
  if (!years.length) return null;
  const e = lapsimTrackChanges[id][years.at(-1)];
  // drop a signature line read by older parser versions ("… The FIA Formula 1 Race Director")
  return {year: Number(years.at(-1)), ...e, changes: (e.changes || []).filter(c => !/race director\s*$/i.test(c.text)).map(learnedEffect)};
}

// Use the effect size learned from past changes (speed traces before/after) instead of the assumed
// one when at least 3 earlier cases of that kind exist.
export function learnedEffect(c) {
  const l = lapsimChangeEffects?.learned?.[c.type];
  if (!c.effect || !l || l.n < 3) return c;
  const pct = ((l.kind === 'grip' ? Math.sqrt(l.factor) : l.factor) - 1) * 100, sign = pct > 0 ? '+' : '';
  return {...c, effect: {...c.effect, kind: l.kind, factor: l.factor, learned: true,
    ko: `과거 ${l.n}건의 실제 변화에서 학습: 코너 속도 ${sign}${pct.toFixed(2)}%`, en: `Learned from ${l.n} past cases: ${sign}${pct.toFixed(2)}% corner speed`}};
}

// Latest season whose real lap on this track the cars were fitted to (null when none)
export function fittedYear(id) {
  const years = Object.keys(lapsimCalibration?.seasons || {}).filter(y => lapsimCalibration.seasons[y]?.tracks?.[id]).map(Number);
  return years.length ? Math.max(...years) : null;
}
