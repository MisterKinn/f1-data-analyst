// Step 29b: a ± range and a check status for every LapSim Δ answer (rule docs/prereg/step29b-delta-intervals-2026-11-25.md).
// Flag LAPSIM_DELTA_PM=on (off by default): without it nothing is added to the connector output or the page.
import {lapsimDeltaIntervals as D} from './delta-intervals-data.js';
import {lapsimCalibration} from './calibration-data.js';

// the calibration the ranges were built on: generatedAt + every held-out row (a refit changes them); another calibration = stale
export function calFingerprint(c) {
  const s = JSON.stringify([c.generatedAt, ['2025', '2026'].map(y => c.seasons?.[y]?.holdout?.tracks), ['lmh', 'lmdh', 'lmgt3'].map(k => ['2025', '2026'].map(y => c.series?.wec?.[k]?.[y]?.holdout?.tracks))]);
  let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + '.' + s.length;
}
export const deltaStale = (c = lapsimCalibration) => !D.calibration || calFingerprint(c) !== D.calibration.fingerprint;
const STALE = {status: 'stale', reason: 'the calibration changed after these ranges were built; rebuild them (scripts/sim/delta-intervals.mjs after a new Δ bench run)'};

export const deltaPmOn = () => globalThis.process?.env?.LAPSIM_DELTA_PM === 'on';
const r2 = x => Math.round(x * 100) / 100;
const CHECK = `90 % empirical range (no normal assumption); rule sha256 ${D.rule?.sha256.slice(0, 8)}…`;

// status and reason per Δ type (rule R4); "checked" types carry numbers from the data file
export const DELTA_TYPES = {
  drs: {status: 'checked', reason: `measured / model ratio over ${D.drs?.n} pooled DRS zone cases 2023–25 (run ${D.drs?.source.run}): median ${r2(D.drs?.q50)}, 90 % ${r2(D.drs?.q05)} to ${r2(D.drs?.q95)}; one ratio assumed for every zone of a lap`},
  straight_mode: {status: 'unchecked', reason: 'no measured Straight Mode / Overtake Δ case (the DRS check covers 2023–25 DRS only)'},
  mass_fuel: {status: 'data limit', reason: 'measured noise above 0.1 s per case (F1 fuel 0.169 s, step 29a; WEC BoP mass 0.82 s, step 21)'},
  power_energy: {status: 'data limit', reason: '2026 energy has no clean measured pairing (step 24); WEC BoP power noise 0.82 s (step 21)'},
  tyre: {status: 'unchecked', reason: 'no measured Δ check for grip, compound or wet (tyre wear stopped on noise, step 29a)'},
  weather: {status: 'unchecked', reason: 'no measured Δ check for air density, temperature, humidity or wind'},
  track_change: {status: 'data limit', reason: 'gate 5b: not judgeable at this number of cases; every change type at strength 0'},
  aero: {status: 'unchecked', reason: 'no measured Δ check for CdA or ClA'},
  car_vs_car: {status: 'unchecked', reason: 'no paired car-vs-car check'},
  evolution: {status: 'unchecked', reason: 'no Δ check of track evolution'},
};

// one Δ answer: model value plus, for a checked type, the measured-Δ range (rule R2)
export function deltaCheck(type, deltaS) {
  const t = DELTA_TYPES[type], out = {status: t.status, reason: t.reason};
  if (t.status === 'checked' && deltaStale()) return STALE;
  if (type !== 'drs' || !Number.isFinite(deltaS)) return out;
  const a = deltaS * D.drs.q05, b = deltaS * D.drs.q95, lo = Math.min(a, b), hi = Math.max(a, b);
  const inside = lo <= deltaS && deltaS <= hi;
  return {...out, range_s: [r2(lo), r2(hi)], plus_s: r2(hi - deltaS), minus_s: r2(deltaS - lo), level: D.level, basis: CHECK, model_in_range: inside,
    ...(inside ? {} : {range_note: 'the model Δ lies outside the measured range (the model overstates DRS 2–4×); quote the range, not the model value'})};
}

// absolute lap (rule R3): F1 2025/2026 and WEC LMH, LMDh, LMGT3 2025/2026 class cars; other cars unchecked
const lapGroup = car => car.kind !== 'calibrated' || (car.year !== 2025 && car.year !== 2026) ? null
  : !car.series ? 'f1' : car.series === 'wec' && ['lmh', 'lmdh', 'lmgt3'].includes(car.cls) ? 'wec' : null;
export function lapCheck(car, lapS) {
  const g = lapGroup(car);
  if (g && deltaStale()) return STALE;
  if (!g || !Number.isFinite(lapS)) return {status: 'unchecked', reason: 'this car is not in the held-out rows of the lap check'};
  const q = D.lap[g], lo = lapS / (1 + q.q95), hi = lapS / (1 + q.q05);
  return {status: 'checked', range_s: [r2(lo), r2(hi)], plus_s: r2(hi - lapS), minus_s: r2(lapS - lo), level: D.level, basis: CHECK,
    reason: `${q.n} held-out ${g.toUpperCase()} rows (tracks left out of the fit, run ${D.lap.source.run}); about 2 rows per tail, so the range is rough; on a raced track the default lap reproduces the real lap, the range is for what the fit has not seen`};
}

export const deltaRule = () => ({rule_sha256: D.rule?.sha256, calibration_sha256: D.calibration?.sha256, level: D.level, quantile: D.quantile});

// the page's share (only sent with the flag on): DRS ratios and the lap quantiles of each checked car
export function deltaPmData(cars) {
  if (deltaStale()) return {drs: null, lap: {}, stale: true};
  const lap = {};
  for (const [k, c] of Object.entries(cars)) { const g = lapGroup(c); if (g) lap[k] = {q05: D.lap[g].q05, q95: D.lap[g].q95, n: D.lap[g].n}; }
  return {drs: {q05: D.drs.q05, q50: D.drs.q50, q95: D.drs.q95, n: D.drs.n}, lap};
}
