// F1 low-drag zones in the lap simulation (owner 2026-11-16: a changed Straight Mode or DRS zone must change the predicted lap).
// An F1 car opens DRS (to 2025) or Straight Mode (2026 on) only in the zones of f1-zones-data.js (the FIA document, else the estimated
// zones). Used only when the F1 fit was made the same way (calibration-data.js aero: 'fia'), so the fitted factors and the page agree;
// otherwise the kernel's own straight finder stays. Cars of other series have no low-drag mode, so nothing changes for them.
import {lapsimF1Zones} from './f1-zones-data.js';
import {lapsimCalibration} from './calibration-data.js';

export const ZONES_ON = ['fia', 'fia2025'].includes(lapsimCalibration?.aero), DRS_ONLY = lapsimCalibration?.aero === 'fia2025';
const cache = new Map();
export const slotOf = (Z, y) => y < 2026 ? '2025' : String(Math.max(2026, ...Object.keys(Z || {}).map(Number).filter(k => k >= 2026 && k <= y)));
// track with the zone layout of this F1 season, or the track itself (other series, no zones, or zones off)
export function withZones(K, d, track, c) {
  const y = Number(c?.year), id = d?.id;
  if (!ZONES_ON || c?.series || !y || !id) return track;
  if (DRS_ONLY && y >= 2026) return track;
  // owner 2026-11-16: a car uses the newest zone set of its own year or earlier (2027/2028 FIA notes apply to that year only; 2026 stays)
  const slot = slotOf(lapsimF1Zones?.tracks?.[id], y), z = lapsimF1Zones?.tracks?.[id]?.[slot];
  if (!z?.zones?.length) return track;
  const key = id + ':' + slot;
  if (!cache.has(key)) cache.set(key, K.trackFromData({...d, aeroZones: z.zones.map(q => [q.from, q.to])}, {aero: 'fia'}).aeroLow);
  return {...track, aeroLow: cache.get(key)};
}

// Options (owner 2026-11-16, same rules as the /simulation page): SM 'normal' | 'alt' (low-grip activation of the FIA map, only partial
// activation: front wing in Straight Mode, rear flap in Corner Mode, B7.1.2 b; 0.3 of the low-drag change is an estimate) | 'off',
// Overtake (2026, C5.2.8 ii power curve; the driver uses it on the whole lap, one straight or not at all, whichever is fastest), DRS (2025).
export const PARTIAL = 0.3;
function zoneList(d, c, m) {
  const sl = slotOf(lapsimF1Zones?.tracks?.[d.id], c.year), z = lapsimF1Zones?.tracks?.[d.id]?.[sl], L = d.kappa.length * d.ds; if (!z) return null;
  if (sl === '2025' ? m.drs === false : m.sm === 'off') return [];
  return m.sm === 'alt' && sl === '2026' ? z.zones.filter(q => q.low !== null).map(q => [q.low != null ? q.low : (q.from + 50) % L, q.to]) : z.zones.map(q => [q.from, q.to]);
}
function optionTrack(K, d, tr, c, m) {
  const zs = zoneList(d, c, m); if (!zs) return tr;
  let low = zs.length ? K.trackFromData({...d, aeroZones: zs}, {aero: 'fia'}).aeroLow : new Uint8Array(d.kappa.length);
  if (m.sm === 'alt' && c.year >= 2026) low = Float32Array.from(low, x => x * PARTIAL);
  return {...tr, aeroLow: low};
}
// lap with the options, scaled so the default options (Normal, Overtake on / DRS on) give the fitted lap; null for cars without options
export function simulateWithOptions(K, d, tr, c, m, sim) {
  if (c?.series || !c?.year) return null;
  const run = mm => { const t0 = optionTrack(K, d, tr, c, {...mm, ot: false}), r0 = sim(t0); if (!(mm.ot && c.year >= 2026)) return r0;
    const n = d.kappa.length, L = n * d.ds; let best = r0; const consider = o => { const r = sim({...t0, otOn: o}); if (r.lapTime < best.lapTime) best = r; };
    consider(true); for (const [a, b] of zoneList(d, c, {sm: 'normal'}) || []) { const o = new Uint8Array(n), i0 = Math.round(a / d.ds), len = Math.round((((b - a) % L) + L) % L / d.ds); for (let k = 0; k <= len; k++) o[(i0 + k) % n] = 1; consider(o); }
    return best; };
  const def = c.year >= 2026 ? {sm: 'normal', ot: true} : {drs: true}, f = sim(withZones(K, d, tr, c)).lapTime / run(def).lapTime, r = run(m);
  r.lapTime *= f; if (r.time) for (let i = 0; i < r.time.length; i++) r.time[i] *= f; return r;
}
