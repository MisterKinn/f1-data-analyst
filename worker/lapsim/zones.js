// F1 low-drag zones in the lap simulation (owner 2026-11-16: a changed Straight Mode or DRS zone must change the predicted lap).
// An F1 car opens DRS (to 2025) or Straight Mode (2026 on) only in the zones of f1-zones-data.js (the FIA document, else the estimated
// zones). Used only when the F1 fit was made the same way (calibration-data.js aero: 'fia'), so the fitted factors and the page agree;
// otherwise the kernel's own straight finder stays. Cars of other series have no low-drag mode, so nothing changes for them.
import {lapsimF1Zones} from './f1-zones-data.js';
import {lapsimCalibration} from './calibration-data.js';
import {lapsimPuDocs} from './pu-docs-data.js';
import {lapsimPuEst} from './pu-est-data.js';

export const ZONES_ON = ['fia', 'fia2025'].includes(lapsimCalibration?.aero), DRS_ONLY = lapsimCalibration?.aero === 'fia2025';
const cache = new Map();
// 2026 qualifying power curve (owner 2026-11-16, FIA Power Unit Information): from round 4 on the whole qualifying lap runs on Base – Overtake
// (C5.2.8 ii); rounds 1–3 (Melbourne, Shanghai, Suzuka 2026) on Base – Standard, Overtake only when within 1 s. 2027+ and tracks without a
// document follow the round-4 rules. PU_QUALI: the F1 fit used it (calibration puQuali), so the fit's own setup includes it.
export const otWholeLap = (id, year, docs = lapsimPuDocs) => year >= 2026 && !(year === 2026 && docs?.events?.[id]?.round <= 3);
export const PU_QUALI = !!lapsimCalibration?.puQuali;
export const slotOf = (Z, y) => y < 2026 ? '2025' : String(Math.max(2026, ...Object.keys(Z || {}).map(Number).filter(k => k >= 2026 && k <= y)));
// track with the zone layout of this F1 season, or the track itself (other series, no zones, or zones off)
export function withZones(K, d, track, c) {
  const y = Number(c?.year), id = d?.id;
  const pq = t => { const k = PU_QUALI && !c?.series && y && otWholeLap(id, y) ? lapsimCalibration?.otChoice?.[id] : null; if (k == null || k === 'none') return t; if (k === 'all') return {...t, otOn: true};
    const q = lapsimF1Zones?.tracks?.[id]?.[slotOf(lapsimF1Zones?.tracks?.[id], y)]?.zones?.[k]; if (!q) return t; const n = d.kappa.length, L = n * d.ds, o = new Uint8Array(n), i0 = Math.round(q.from / d.ds), len = Math.round((((q.to - q.from) % L) + L) % L / d.ds); for (let j = 0; j <= len; j++) o[(i0 + j) % n] = 1; return {...t, otOn: o}; };
  if (!ZONES_ON || c?.series || !y || !id) return pq(track);
  if (DRS_ONLY && y >= 2026) return pq(track);
  // owner 2026-11-16: a car uses the newest zone set of its own year or earlier (2027/2028 FIA notes apply to that year only; 2026 stays)
  const slot = slotOf(lapsimF1Zones?.tracks?.[id], y), z = lapsimF1Zones?.tracks?.[id]?.[slot];
  if (!z?.zones?.length) return pq(track);
  const key = id + ':' + slot;
  if (!cache.has(key)) cache.set(key, K.trackFromData({...d, aeroZones: z.zones.map(q => [q.from, q.to])}, {aero: 'fia'}).aeroLow);
  return pq({...track, aeroLow: cache.get(key)});
}

// Options (owner 2026-11-16, same rules as the /simulation page): SM 'normal' | 'alt' (low-grip activation of the FIA map, only partial
// activation: front wing in Straight Mode, rear flap in Corner Mode, B7.1.2 b; PARTIAL of the low-drag change, model) | 'off',
// Overtake (2026, C5.2.8 ii power curve; the driver uses it on the whole lap, one straight or not at all, whichever is fastest), DRS (2025).
// PARTIAL (model, 2026-11-21): share of the Straight Mode drag drop left in Low Grip. Fitted to top speeds of the two dry Low Grip races
// with Overtake disabled (race leader's slick laps, no tow, vs the practice 90th percentile): Interlagos −9 km/h → 0.96, Sepang −20 km/h
// → 0.66; each fit predicts the other track better than the earlier 0.3 guess (errors 6.4 vs 17.5 and 10.4 vs 15.9 km/h). The front
// wing in Straight Mode carries most of the drop. Same value in simulation.js (browser copy).
export const PARTIAL = 0.8;
function zoneList(d, c, m) {
  const sl = slotOf(lapsimF1Zones?.tracks?.[d.id], c.year), z = lapsimF1Zones?.tracks?.[d.id]?.[sl], L = d.kappa.length * d.ds; if (!z) return null;
  if (sl === '2025' ? m.drs === false : m.sm === 'off') return [];
  return m.sm === 'alt' && sl === '2026' ? z.zones.filter(q => q.low !== null).map(q => [q.low != null ? q.low : (q.from + 50) % L, q.to]) : z.zones.map(q => [q.from, q.to]);
}
export function optionTrack(K, d, tr, c, m) {
  const zs = zoneList(d, c, m); if (!zs) return tr;
  let low = zs.length ? K.trackFromData({...d, aeroZones: zs}, {aero: 'fia'}).aeroLow : new Uint8Array(d.kappa.length);
  if (m.sm === 'alt' && c.year >= 2026) low = Float32Array.from(low, x => x * PARTIAL);
  return {...tr, aeroLow: low};
}
// lap with the options, scaled so the default options (Normal, Overtake on / DRS on) give the fitted lap; null for cars without options
export function simulateWithOptions(K, d, tr, c, m, sim, simFit = sim) {
  if (c?.series || !c?.year) return null;
  const run = mm => { const t0 = optionTrack(K, d, tr, c, {...mm, ot: false}); const r0 = sim(t0); if (!(mm.ot && c.year >= 2026)) return r0;
    const n = d.kappa.length, L = n * d.ds; let best = r0; const consider = o => { const r = sim({...t0, otOn: o}); if (r.lapTime < best.lapTime) best = r; };
    consider(true); for (const [a, b] of zoneList(d, c, {sm: 'normal'}) || []) { const o = new Uint8Array(n), i0 = Math.round(a / d.ds), len = Math.round((((b - a) % L) + L) % L / d.ds); for (let k = 0; k <= len; k++) o[(i0 + k) % n] = 1; consider(o); }
    return best; };
  const def = c.year >= 2026 ? {sm: 'normal', ot: true} : {drs: true}, f = simFit(withZones(K, d, tr, c)).lapTime / run(def).lapTime, r = run(m);
  r.lapTime *= f; if (r.time) for (let i = 0; i < r.time.length; i++) r.time[i] *= f; return r;
}

// C5.12 power-reduction rule of the event's PU document (scaled to the simulator track), else the round-4 default 100 kW/s
export function puRampOf(d, id) { const p = lapsimPuDocs?.events?.[id] || lapsimPuEst?.tracks?.[id], k = p?.centrelineKm ? d.kappa.length * d.ds / (p.centrelineKm * 1000) : 1, sc = z => ({...z, from: z.from * k, to: z.to * k});
  return {rateKWs: p?.rampKWs || 100, bigCut: (p?.bigCut || []).map(sc), speed: (p?.speed || []).map(sc)}; }
export const PU_RAMP = !!lapsimCalibration?.puRamp;
