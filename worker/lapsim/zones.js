// F1 low-drag zones in the lap simulation (owner 2026-11-16: a changed Straight Mode or DRS zone must change the predicted lap).
// An F1 car opens DRS (to 2025) or Straight Mode (2026 on) only in the zones of f1-zones-data.js (the FIA document, else the estimated
// zones). Used only when the F1 fit was made the same way (calibration-data.js aero: 'fia'), so the fitted factors and the page agree;
// otherwise the kernel's own straight finder stays. Cars of other series have no low-drag mode, so nothing changes for them.
import {lapsimF1Zones} from './f1-zones-data.js';
import {lapsimCalibration} from './calibration-data.js';

export const ZONES_ON = ['fia', 'fia2025'].includes(lapsimCalibration?.aero), DRS_ONLY = lapsimCalibration?.aero === 'fia2025';
const cache = new Map();
// track with the zone layout of this F1 season, or the track itself (other series, no zones, or zones off)
export function withZones(K, d, track, c) {
  const y = Number(c?.year), id = d?.id;
  if (!ZONES_ON || c?.series || !y || !id) return track;
  if (DRS_ONLY && y >= 2026) return track;
  const slot = y >= 2026 ? '2026' : '2025', z = lapsimF1Zones?.tracks?.[id]?.[slot];
  if (!z?.zones?.length) return track;
  const key = id + ':' + slot;
  if (!cache.has(key)) cache.set(key, K.trackFromData({...d, aeroZones: z.zones.map(q => [q.from, q.to])}, {aero: 'fia'}).aeroLow);
  return {...track, aeroLow: cache.get(key)};
}
