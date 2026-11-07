// Track evolution, one module for every series: how lap time changes over a session as rubber goes
// down, a wet track dries and tyres come up to temperature. Lap time, not grip, is the unit we fit
// and predict, because that is what the timing data measures:
//   lap(t, k) = lap0 × (1 + rubber(t) + wet(t) + warmup(k))   (fractions of the lap)
//   rubber(t) = −a × (1 − e^(−t/τ))        a = total gain, τ = time to most of it (min)
//   wet(t)    = w0 × P[tyre] × e^(−t/τd)   w0 = wetness at the session start (0..1), τd = drying time
//   warmup(k) = c × max(0, 1 − (k − 1)/n)  k = laps since the out-lap, n = warm-up laps
// Where a real session of the same series, track and session type has been measured
// (scripts/sim/evolution-fit.mjs), its measured curve is used instead of the formula, so a session
// that has run is reproduced; the formula with pooled coefficients covers everything else.
// All inputs 0 (the default) → lap0 unchanged.
import {lapsimEvolution} from './evolution-data.js';

// Default coefficients per series (lap-time fractions, minutes). Uncalibrated until fitted.
// P: lap-time penalty of a fully wet track on each tyre (slicks lose most, wets least).
export const EVOLUTION_DEFAULTS = {
  f1:     {gainPct: 1.0, tauMin: 40, warmupPct: 0.8, warmupLaps: 1, P: {slick: 0.30, inter: 0.12, wet: 0.16}},
  wec:    {gainPct: 1.2, tauMin: 60, warmupPct: 1.5, warmupLaps: 2, P: {slick: 0.30, inter: 0.13, wet: 0.17}},
  imsa:   {gainPct: 1.2, tauMin: 60, warmupPct: 1.5, warmupLaps: 2, P: {slick: 0.30, inter: 0.13, wet: 0.17}},
  gtwc:   {gainPct: 1.0, tauMin: 50, warmupPct: 1.5, warmupLaps: 2, P: {slick: 0.30, inter: 0.13, wet: 0.17}},
  fe:     {gainPct: 1.8, tauMin: 45, warmupPct: 1.0, warmupLaps: 1, P: {slick: 0.25, inter: 0.25, wet: 0.25}}, // one all-weather tyre, new street surfaces
  supergt: {gainPct: 1.0, tauMin: 50, warmupPct: 1.2, warmupLaps: 2, P: {slick: 0.30, inter: 0.13, wet: 0.17}},
};
// Session type scales the rubber gain (a race lays down more rubber per minute than practice)
export const SESSION_SCALE = {practice: 1, qualifying: 0.8, sprint: 1.1, race: 1.3};

// Coefficients for a series/track/session: fitted track value > fitted series value > default
export function evolutionCoeffs(series = 'f1', track = null, session = 'qualifying') {
  const fit = lapsimEvolution?.series?.[series], def = EVOLUTION_DEFAULTS[series] || EVOLUTION_DEFAULTS.f1;
  const tr = track ? fit?.tracks?.[track]?.[session] : null, ses = fit?.sessions?.[session];
  const base = {...def, ...(ses?.coeffs || {}), ...(tr?.coeffs || {})};
  return {...base, curve: tr?.curve || null, calibrated: !!(tr || ses), basis: tr ? 'track' : ses ? 'series' : 'default',
    holdoutPct: ses?.holdoutPct ?? fit?.holdoutPct ?? null};
}

// Lap-time change (fraction) at session minute t and lap k after the out-lap. Self-contained: the
// /simulation page sends this function's source to the browser.
export function evolutionDelta(p = {}, t = 0, k = Infinity) {
  const num = (v, d = 0) => Number.isFinite(v) ? v : d, T = Math.max(0, t);
  const scale = {practice: 1, qualifying: 0.8, sprint: 1.1, race: 1.3}[p.session] ?? 1; // = SESSION_SCALE
  let rubber = 0;
  const c = p.curve;
  if (Array.isArray(c) && c.length > 1 && p.useCurve !== false) {
    // measured curve (pct), piecewise linear, flat outside its range
    let v = c.at(-1)[1];
    if (T <= c[0][0]) v = c[0][1];
    else for (let i = 1; i < c.length; i++) if (T <= c[i][0]) { v = c[i - 1][1] + (c[i][1] - c[i - 1][1]) * (T - c[i - 1][0]) / Math.max(1e-9, c[i][0] - c[i - 1][0]); break; }
    rubber = v / 100;
  } else {
    const a = num(p.gainPct) / 100 * scale, tau = num(p.tauMin);
    rubber = a > 0 && tau > 0 ? -a * (1 - Math.exp(-T / tau)) : 0;
  }
  const w0 = Math.min(1, Math.max(0, num(p.wetStart))), td = num(p.dryMin), P = (p.P || {})[p.tyre || 'slick'] ?? 0;
  // a track that does not dry (td = 0) stays at its start wetness
  const wet = w0 > 0 ? w0 * P * (td > 0 ? Math.exp(-T / td) : 1) : 0;
  const n = num(p.warmupLaps), wu = n > 0 && Number.isFinite(k) ? num(p.warmupPct) / 100 * Math.max(0, 1 - (k - 1) / n) : 0;
  return rubber + wet + wu;
}

// Expected lap time over a session: lap0 = the simulated lap on the reference track state (the
// state the car was fitted to, i.e. the end of qualifying for F1), so the curve is shifted to be 0
// at the reference minute. Returns [{minute, lap}] plus the last-lap prediction.
export function evolutionCurve(lap0, p = {}, {from = 0, to = 60, step = 2, refMinute = null, k = Infinity} = {}) {
  const ref = refMinute == null ? 0 : evolutionDelta({...p, wetStart: 0}, refMinute, Infinity);
  const pts = [];
  for (let t = from; t <= to + 1e-9; t += step) pts.push({minute: Math.round(t * 10) / 10, lap: lap0 * (1 + evolutionDelta(p, t, k) - ref)});
  return {points: pts, last: pts.at(-1)};
}
