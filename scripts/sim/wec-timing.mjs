// WEC observations only. Never changes the shared F1 track or guesses a timing position.
export const LENGTH_TOLERANCE = 0.02;
// Three sectors and a lap are published to 0.001 s: allow their combined rounding error.
export const SECTOR_SUM_TOLERANCE = 0.002;
const finite = Number.isFinite;

export function timingMapping(table, series, track, year) {
  if (table?.series !== series) return null;
  const rows = table.rows.filter(r => r.track === track && r.year === Number(year));
  if (rows.length > 1) throw new Error(`Duplicate ${series} timing mapping: ${track}/${year}`);
  return rows[0] || null;
}

export function checkTiming(mapping, track, lapSeconds, sectors) {
  const length = track.ds * track.kappa.length;
  const out = {sectorReason: null, trapReason: null, lengthErrorPct: null, sectorEnds: null, trapDistance: null};
  if (!mapping || !mapping.sourceUrl || !(mapping.layoutLengthM > 0))
    return {...out, sectorReason: 'no verified mapping', trapReason: 'no verified mapping'};
  const official = mapping.layoutLengthM;
  out.lengthErrorPct = Math.abs(length / official - 1) * 100;
  // A known official coordinate cannot safely be placed on a different-length layout either.
  const lengthOK = finite(length) && length > 0 && out.lengthErrorPct <= LENGTH_TOLERANCE * 100 + 1e-10;
  const ends = [mapping.s1EndM, mapping.s2EndM];
  if (!ends.every(finite) || !(ends[0] > 0 && ends[1] > ends[0] && ends[1] < official))
    out.sectorReason = 'invalid sector distances';
  else if (!lengthOK) out.sectorReason = 'layout length differs by more than 2%';
  else if (!Array.isArray(sectors) || sectors.length !== 3 || !sectors.every(v => finite(v) && v > 0))
    out.sectorReason = 'missing or invalid measured sectors';
  else if (!finite(lapSeconds) || Math.abs(sectors.reduce((a, b) => a + b, 0) - lapSeconds) > SECTOR_SUM_TOLERANCE + 1e-10)
    out.sectorReason = 'measured sectors do not sum to lap within 0.002 s';
  else out.sectorEnds = ends.map(s => s * length / official);
  if (!finite(mapping.trapDistanceM) || !mapping.trapSourceUrl)
    out.trapReason = 'no verified numeric trap distance';
  else if (mapping.trapDistanceM < 0 || mapping.trapDistanceM >= official)
    out.trapReason = 'invalid trap distance';
  else if (!lengthOK) out.trapReason = 'layout length differs by more than 2%';
  else out.trapDistance = mapping.trapDistanceM * length / official;
  return out;
}

export function applyWecTiming(lap, measured, mapping, {trapPosition = false, sectors = false, sectorWeight = 2, eligibility = null} = {}) {
  if (!trapPosition && !sectors) return lap;
  if (sectors && ![1, 2, 4].includes(sectorWeight)) throw new Error('WEC sector weight must be 1, 2 or 4');
  const check = checkTiming(mapping, lap.track, lap.lapSeconds, measured.sectors);
  const out = {...lap};
  const hasTrap = trapPosition && check.trapDistance !== null && finite(measured.topSpeedKph) && measured.topSpeedKph > 0;
  const hasSectors = sectors && check.sectorEnds !== null && eligibility?.eligible === true;
  if (hasTrap) { out.trapDistance = check.trapDistance; out.trapKph = measured.topSpeedKph; }
  if (hasSectors) {
    // Per-series copy; trackFromData's F1 sector points remain untouched.
    out.track = {...lap.track, sectors: check.sectorEnds};
    out.sectors = measured.sectors.slice(); out.wSector = sectorWeight;
  }
  out.timing = {sectorUsed: hasSectors, trapPositionUsed: hasTrap,
    sectorReason: sectors ? check.sectorReason || (hasSectors ? null : eligibility?.reason || 'no fixed production eligibility') : 'flag off',
    trapReason: trapPosition ? check.trapReason || (hasTrap ? null : 'missing measured trap') : 'flag off',
    lengthErrorPct: check.lengthErrorPct, sourceUrl: mapping?.sourceUrl ?? null,
    trapSourceUrl: hasTrap ? mapping.trapSourceUrl : null};
  return out;
}

// Interpolate accumulated time within each cell, including the final cell of the lap.
export function sectorTimes(result, track) {
  const timeAt = s => {
    const x = s / track.ds, i = Math.floor(x), f = x - i;
    if (i >= result.time.length) return result.lapTime;
    return result.time[i] + f * ((result.time[i + 1] ?? result.lapTime) - result.time[i]);
  };
  const [a, b] = track.sectors.map(timeAt);
  return [a, b - a, result.lapTime - b];
}
