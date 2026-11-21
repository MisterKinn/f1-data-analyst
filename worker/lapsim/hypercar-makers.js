// Hypercar per maker (owner 2026-11-21): LapSim, BoPSim and SetupSim share one list of makers and one BoP choice.
// BoP for a maker at a track, current season first: the 2026 estimate (bop-estimate-data.js, BoPSim's estimate at WEC events), else the
// virtual BoP (bop-virtual-data.js, BoPSim's estimate for any track), else the published table of the latest season raced there
// (wec-bop-data.js; the maker residuals were learned on these published tables). Weight and power relative to that table's
// class average scale the regulation car (LMH: front motor; LMDh: rear hybrid). Maker residuals: hypercar-maker-data.js (Gate G v2).
import {lapsimWecBop} from './wec-bop-data.js';
import {bopEstimate2026} from './bop-estimate-data.js';
import {bopVirtual as lapsimBopVirtual} from './bop-virtual-data.js';
import {lapsimHypercarMakers} from './hypercar-maker-data.js';

export const HYPERCARS = [
  {key: 'toyota', name: 'Toyota GR010 HYBRID', make: 'Toyota', cls: 'lmh', chassis: 'Toyota', hybrid: 'front', series: 'WEC'},
  {key: 'ferrari', name: 'Ferrari 499P', make: 'Ferrari', cls: 'lmh', chassis: 'Ferrari', hybrid: 'front', series: 'WEC'},
  {key: 'peugeot', name: 'Peugeot 9X8', make: 'Peugeot', cls: 'lmh', chassis: 'Peugeot', hybrid: 'front', series: 'WEC'},
  {key: 'aston', name: 'Aston Martin Valkyrie', make: 'Aston Martin', cls: 'lmh', chassis: 'Aston Martin / Multimatic', hybrid: null, series: 'WEC · IMSA'},
  {key: 'cadillac', name: 'Cadillac V-Series.R', make: 'Cadillac', cls: 'lmdh', chassis: 'Dallara', hybrid: 'rear', series: 'WEC · IMSA'},
  {key: 'bmw', name: 'BMW M Hybrid V8', make: 'BMW', cls: 'lmdh', chassis: 'Dallara', hybrid: 'rear', series: 'WEC · IMSA'},
  {key: 'alpine', name: 'Alpine A424', make: 'Alpine', cls: 'lmdh', chassis: 'Oreca', hybrid: 'rear', series: 'WEC'},
  {key: 'genesis', name: 'Genesis GMR-001', make: 'Genesis', cls: 'lmdh', chassis: 'Oreca', hybrid: 'rear', series: 'WEC'},
  {key: 'porsche', name: 'Porsche 963', make: 'Porsche', cls: 'lmdh', chassis: 'Multimatic', hybrid: 'rear', series: 'IMSA'},
  {key: 'acura', name: 'Acura ARX-06', make: 'Acura', cls: 'lmdh', chassis: 'Oreca', hybrid: 'rear', series: 'IMSA'},
  {key: 'lamborghini', name: 'Lamborghini SC63', make: 'Lamborghini', cls: 'lmdh', chassis: 'Ligier', hybrid: 'rear', series: 'WEC 2024'},
  {key: 'isotta', name: 'Isotta Fraschini Tipo6-C', make: 'Isotta Fraschini', cls: 'lmh', chassis: 'Isotta Fraschini / Michelotto', hybrid: 'front', series: 'WEC 2024'},
  {key: 'glickenhaus', name: 'Glickenhaus SCG 007', make: 'Glickenhaus', cls: 'lmh', chassis: 'Podium Advanced Technologies', hybrid: null, series: 'WEC 2021–2023'},
  {key: 'vanwall', name: 'Vanwall Vandervell 680', make: 'Vanwall', cls: 'lmh', chassis: 'ByKolles', hybrid: null, series: 'WEC 2023'},
  {key: 'alpine-a480', name: 'Alpine A480 (grandfathered LMP1)', make: null, cls: 'lmh', chassis: 'Oreca', hybrid: null, series: 'WEC 2021–2022'},
];
const first = s => String(s || '').toLowerCase().split(/\s+/)[0];
const pick = (cars, m) => Object.keys(cars || {}).find(n => first(n) === first(m.make || m.name));
const rel = (cars, name, src, event, season) => { const all = Object.values(cars), kg0 = all.reduce((a, x) => a + x.kg, 0) / all.length, kW0 = all.reduce((a, x) => a + x.kW, 0) / all.length;
  return {kg: cars[name].kg, kW: cars[name].kW, rKg: cars[name].kg / kg0, rKW: cars[name].kW / kW0, source: src, event, season, spec: cars[name].spec || null}; };

// BoP of maker m at track id (null when no table has this maker)
export function hypercarBop(id, m) {
  const D = bopEstimate2026, e = D && [...(D.events || [])].reverse().find(x => x.track === id), en = e && pick(e.cars, m);
  if (en) return rel(e.cars, en, 'estimate', e.event, 2026);
  const f = e && (D.fun || []).find(x => x.event === e.event), fn = f && pick(f.cars, m); // a maker not entered there: BoPSim's "for fun" row
  if (fn) return {...rel(f.cars, fn, 'estimate', e.event, 2026), fun: true};
  const V = lapsimBopVirtual?.classes?.['wec-hypercar'], kg = V?.values?.kg?.[id], kW = V?.values?.kW?.[id], vn = kg && pick(kg, m);
  if (vn && kW?.[vn]) { const cars = Object.fromEntries(Object.keys(kg).filter(n => kW[n]).map(n => [n, {kg: kg[n], kW: kW[n]}])); return rel(cars, vn, 'virtual', null, V.latest); }
  const W = lapsimWecBop?.[id], y = W && Object.keys(W).sort().at(-1), wn = y && pick(W[y].cars, m);
  if (wn) return rel(W[y].cars, wn, 'official', W[y].source, Number(y));
  return null;
}
export const makerResidual = m => lapsimHypercarMakers?.residual?.[m.make] || null;
// the maker's car: its regulation car with the BoP weight and power, and the learned residual as a lap-time factor
export function hypercarFor(id, m, classCar) {
  const b = hypercarBop(id, m), res = makerResidual(m); if (!classCar) return null;
  let car = {...classCar.car, label: m.name};
  if (b) car = {...car, mass: car.mass * b.rKg, pIce: car.pIce * b.rKW};
  if (m.hybrid === null) car = {...car, ers: {}, awdAboveKph: undefined};
  return {car, bop: b, residual: res, timeScale: 1 + (res?.pct || 0) / 100};
}

// which maker the BoP makes fastest on this track: the regulation car with each maker's BoP, lap times the residual (memoised per track)
const RANK = new Map();
export function hypercarRanking(K, id, trackData, cars) {
  if (RANK.has(id)) return RANK.get(id);
  const keys = Object.keys(cars).filter(k => k.startsWith('hyper-')), env = K.conditionsFromWeather({});
  const laps = keys.map(k => { const c = cars[k], tr = K.trackFromData(trackData), g = c.grip || 1;
    const t = g === 1 ? tr : {...tr, mu: Float64Array.from(tr.mu, x => x * g)}; return [k, K.simulateLap(t, c.car, env).lapTime * (c.timeScale || 1), !!c.bop?.fun]; })
    .sort((a, b) => a[2] - b[2] || a[1] - b[1]); // makers entered at the event first; "for fun" makers (not entered) rank after them
  const r = laps.map(([k, lap, fun]) => ({key: k, lap: +lap.toFixed(3), ...(fun && {fun: true})})); RANK.set(id, r); return r;
}
