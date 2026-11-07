// Cars, real qualifying conditions and FIA circuit changes for one track. Shared by the
// /simulation page and the lapsim_simulate connector tool so both give the same answer.
import {lapsimCalibration} from './calibration-data.js';
import {lapsimTrackChanges} from './track-changes-data.js';
import {TUM_2019, PRIOR, applyRules} from './cars.js';
import {SERIES} from './series.js';

export const CAR_ORDER = ['base2019', '2025', '2026', '2027', '2028', 'wec-hypercar', 'wec-lmgt3'];

// grip: the per-track factor fitted with that season's car (absorbs asphalt and line differences)
export function carsFor(id) {
  const s = lapsimCalibration?.seasons || {}, p = lapsimCalibration?.projections || {};
  const gripOf = y => [y, 2026, 2025].map(k => s[k]?.tracks?.[id]?.grip).find(g => g != null) ?? 1;
  const out = {base2019: {car: TUM_2019, grip: 1, kind: 'base', year: 2019}};
  for (const y of [2025, 2026]) out[y] = {car: s[y]?.car || PRIOR[y], grip: s[y]?.car ? gripOf(y) : 1, kind: s[y]?.car ? 'calibrated' : 'prior', year: y};
  for (const y of [2027, 2028]) out[y] = {car: p[y]?.car || applyRules(s[2026]?.car || PRIOR[2026], y), grip: gripOf(2026), kind: 'projected', year: y};
  // WEC classes (latest calibrated season), on the same track factor as F1
  for (const [cls, def] of Object.entries(SERIES.wec.classes)) {
    const seasons = lapsimCalibration?.series?.wec?.[cls] || {}, y = Object.keys(seasons).sort().at(-1);
    out['wec-' + cls] = y ? {car: seasons[y].car, grip: gripOf(2026), kind: 'calibrated', year: Number(y), series: 'wec', cls}
      : {car: def.prior, grip: gripOf(2026), kind: 'prior', year: 2026, series: 'wec', cls};
  }
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
  return out;
}

// Latest "Changes to the circuit" list read from the race director's notes
export function latestChanges(id) {
  const years = Object.keys(lapsimTrackChanges[id] || {}).sort();
  if (!years.length) return null;
  const e = lapsimTrackChanges[id][years.at(-1)];
  // drop a signature line read by older parser versions ("… The FIA Formula 1 Race Director")
  return {year: Number(years.at(-1)), ...e, changes: (e.changes || []).filter(c => !/race director\s*$/i.test(c.text))};
}

// Latest season whose real lap on this track the cars were fitted to (null when none)
export function fittedYear(id) {
  const years = Object.keys(lapsimCalibration?.seasons || {}).filter(y => lapsimCalibration.seasons[y]?.tracks?.[id]).map(Number);
  return years.length ? Math.max(...years) : null;
}
