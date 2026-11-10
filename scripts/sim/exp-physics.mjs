// Read-only diagnostics for exp-compare. No fitting, gate decisions or model mutation.
import {PRIOR} from '../../worker/lapsim/cars.js';
import {SERIES} from '../../worker/lapsim/series.js';

// Mirrors calibrate.mjs BOUNDS; a regression test checks equality.
// pIce is relative to the season prior. These are source limits, not saved run metadata.
export const F1_BOUNDS = {muY: [1.5, 2.4], clA: [2.5, 8], cdA: [0.7, 1.9], cdALow: [0.45, 1.6], pIce: [0.85, 1.15]};
export const BOUND_TOLERANCE = 1e-6;
const finite = Number.isFinite;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const rms = a => a.length ? Math.sqrt(mean(a.map(x => x * x))) : null;
const object = x => x && typeof x === 'object' && !Array.isArray(x);

function groups(cal) {
  return [
    ...Object.entries(cal.seasons || {}).map(([year, season]) => [`f1/${year}`, season]),
    ...Object.entries(cal.series?.wec || {}).flatMap(([cls, years]) =>
      Object.entries(years).map(([year, season]) => [`wec-${cls}/${year}`, season])),
  ];
}

export function boundHits(group, car = {}) {
  const [kind, year] = group.split('/');
  const limits = kind === 'f1' ? F1_BOUNDS : SERIES.wec.classes[kind.slice(4)]?.bounds;
  const hits = [], unchecked = [];
  let checked = 0;
  if (!limits) return {checked, hits, unchecked: ['unknown class bounds']};
  for (const [parameter, pair] of Object.entries(limits)) {
    const scale = kind === 'f1' && parameter === 'pIce' ? PRIOR[year]?.pIce : 1;
    const value = car[parameter];
    if (!finite(scale) || !finite(value)) { unchecked.push(parameter); continue; }
    checked++;
    const [lower, upper] = pair.map(x => x * scale);
    for (const [side, limit] of [['lower', lower], ['upper', upper]]) {
      const tolerance = BOUND_TOLERANCE * Math.max(1, Math.abs(limit));
      const outside = side === 'lower' ? value < limit - tolerance : value > limit + tolerance;
      if (outside || Math.abs(value - limit) <= tolerance)
        hits.push({parameter, value, side, limit, outside});
    }
  }
  return {checked, hits, unchecked};
}

function metrics(rows) {
  const corners = rows.filter(r => r.cornerN > 0 && finite(r.cornerBiasKph));
  const cornerRms = corners.map(r => r.cornerRmsKph).filter(finite);
  const traps = rows.map(r => r.trapKph).filter(finite);
  return {
    corner: {nTracks: corners.length, nCorners: corners.reduce((s, r) => s + r.cornerN, 0),
      biasKph: mean(corners.map(r => r.cornerBiasKph)), rmsKph: rms(cornerRms)},
    trap: {nTracks: traps.length, biasKph: mean(traps), rmsKph: rms(traps)},
  };
}

// validate.mjs writes only F1 rows. WEC per-track trap residuals are in the calibration;
// require its validation summary too, and check the rounded summary against those rows.
export function physicalDiagnostics(cal, validation) {
  if (!object(cal) || !object(validation?.summary) || !Array.isArray(validation?.rows))
    throw new Error('Expected a calibration and validate.mjs JSON with summary and rows');
  const entries = groups(cal), seasons = Object.fromEntries(entries), by = {}, seen = new Set();
  for (const row of validation.rows) {
    const group = `${row.series}/${row.year}`, id = `${group}|${row.track}`;
    if (row.series !== 'f1' || !seasons[group]?.tracks?.[row.track])
      throw new Error(`Validation row is absent from calibration: ${id}`);
    if (seen.has(id)) throw new Error(`Duplicate validation row: ${id}`);
    seen.add(id);
    (by[group] ||= []).push({track: row.track,
      cornerN: Number.isInteger(row.cornerKph?.n) && row.cornerKph.n > 0 ? row.cornerKph.n : 0,
      cornerBiasKph: finite(row.cornerKph?.bias) ? row.cornerKph.bias : null,
      cornerRmsKph: finite(row.cornerKph?.rms) ? row.cornerKph.rms : null,
      trapKph: finite(row.trapKph) ? row.trapKph : null});
  }
  const out = {};
  for (const [group, season] of entries) {
    const wec = group.startsWith('wec-'), summary = validation.summary[group];
    let rows = by[group] || [];
    if (wec && summary) rows = Object.entries(season.tracks || {}).map(([track, t]) => ({
      track, cornerN: 0, cornerBiasKph: null, cornerRmsKph: null,
      trapKph: finite(t.trapKph) && t.trapKph > 0 && finite(t.simTopKph) ? t.simTopKph - t.trapKph : null,
    }));
    if (rows.length && !summary) throw new Error(`Missing validation summary: ${group}`);
    const stats = metrics(rows);
    if (summary) {
      if (summary.tracks !== rows.length) throw new Error(`Validation track count mismatch: ${group}`);
      const expected = {trapBiasKph: stats.trap.biasKph, trapRmsKph: stats.trap.rmsKph};
      if (!wec) expected.cornerBiasKph = stats.corner.biasKph;
      for (const [key, value] of Object.entries(expected)) {
        const actual = summary[key];
        // Input summaries are rounded to 0.001 km/h by validate.mjs.
        if (value == null ? actual != null : !finite(actual) || Math.abs(actual - value) > 0.000501)
          throw new Error(`Validation summary mismatch: ${group} ${key}`);
      }
    }
    out[group] = {
      status: summary ? 'available' : 'missing validation',
      evidence: 'Layer 3 fitted model vs layer 2 measurements; in-sample, not held-out',
      heldOutRmsPct: finite(season.holdout?.rmsPct) ? season.holdout.rmsPct : null,
      heldOutN: season.holdout?.tracks?.length ?? 0,
      ...stats, bounds: boundHits(group, season.car),
      boundReference: 'Current source limits; original run bounds are not stored in the calibration',
      uncheckedTrackBounds: 'Grip/drag run settings are not stored; no bound check is inferred',
      cornerNote: wec ? 'Unavailable: validate.mjs has no WEC corner measurements' : 'Equal weight per track, as in validate.mjs; sampled minima',
      trapDefinition: wec ? 'Simulated lap maximum minus measured trap; NOT a trap-position comparison'
        : 'Simulated lap maximum minus measured trace maximum',
      rows,
    };
  }
  return out;
}

export function comparePhysical(base, cand) {
  const out = {};
  for (const group of new Set([...Object.keys(base), ...Object.keys(cand)])) {
    const a = base[group], b = cand[group];
    const br = new Map((b?.rows || []).map(r => [r.track, r]));
    const pairs = (a?.rows || []).filter(r => br.has(r.track)).map(r => [r, br.get(r.track)]);
    const cornerPairs = pairs.filter(p => p.every(r => r.cornerN > 0 && finite(r.cornerBiasKph)));
    const trapPairs = pairs.filter(p => p.every(r => finite(r.trapKph)));
    const cb = mean(cornerPairs.map(p => p[0].cornerBiasKph)), cc = mean(cornerPairs.map(p => p[1].cornerBiasKph));
    const tb = rms(trapPairs.map(p => p[0].trapKph)), tc = rms(trapPairs.map(p => p[1].trapKph));
    const hitKey = h => `${h.parameter}/${h.side}`;
    const oldHits = new Set((a?.bounds.hits || []).map(hitKey));
    out[group] = {
      corner: {tracks: cornerPairs.map(p => p[0].track), n: cornerPairs.length, baseBiasKph: cb, candBiasKph: cc,
        absBiasChangeKph: cb == null ? null : Math.abs(cc) - Math.abs(cb)},
      trap: {tracks: trapPairs.map(p => p[0].track), n: trapPairs.length, baseRmsKph: tb, candRmsKph: tc,
        rmsChangeKph: tb == null ? null : tc - tb},
      newBoundHits: a && b && !a.bounds.unchecked.length && !b.bounds.unchecked.length
        ? b.bounds.hits.filter(h => !oldHits.has(hitKey(h))) : null,
      note: 'Positive change is worse; diagnostics do not change the held-out gate. Missing data is not a pass.',
    };
  }
  return out;
}
