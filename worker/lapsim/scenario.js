// Cars, real qualifying conditions and FIA circuit changes for one track. Shared by the
// /simulation page and the lapsim_simulate connector tool so both give the same answer.
import {lapsimCalibration} from './calibration-data.js';
import {lapsimTrackChanges} from './track-changes-data.js';
import {TUM_2019, PRIOR, applyRules} from './cars.js';

export const CAR_ORDER = ['base2019', '2025', '2026', '2027', '2028'];

// grip: the per-track factor fitted with that season's car (absorbs asphalt and line differences)
export function carsFor(id) {
  const s = lapsimCalibration?.seasons || {}, p = lapsimCalibration?.projections || {};
  const gripOf = y => [y, 2026, 2025].map(k => s[k]?.tracks?.[id]?.grip).find(g => g != null) ?? 1;
  const out = {base2019: {car: TUM_2019, grip: 1, kind: 'base', year: 2019}};
  for (const y of [2025, 2026]) out[y] = {car: s[y]?.car || PRIOR[y], grip: s[y]?.car ? gripOf(y) : 1, kind: s[y]?.car ? 'calibrated' : 'prior', year: y};
  for (const y of [2027, 2028]) out[y] = {car: p[y]?.car || applyRules(s[2026]?.car || PRIOR[2026], y), grip: gripOf(2026), kind: 'projected', year: y};
  return out;
}

// Weather of the real pole lap per season (OpenF1 session means), with the real lap time
export function realConditions(id) {
  const s = lapsimCalibration?.seasons || {}, out = {};
  for (const y of ['2025', '2026']) { const r = s[y]?.tracks?.[id]; if (r?.weather) out[y] = {...r.weather, realLap: r.realLap, driver: r.driver, position: r.position ?? 1}; }
  return out;
}

// Latest "Changes to the circuit" list read from the race director's notes
export function latestChanges(id) {
  const years = Object.keys(lapsimTrackChanges[id] || {}).sort();
  return years.length ? {year: Number(years.at(-1)), ...lapsimTrackChanges[id][years.at(-1)]} : null;
}

// Latest season whose real lap on this track the cars were fitted to (null when none)
export function fittedYear(id) {
  const years = Object.keys(lapsimCalibration?.seasons || {}).filter(y => lapsimCalibration.seasons[y]?.tracks?.[id]).map(Number);
  return years.length ? Math.max(...years) : null;
}
