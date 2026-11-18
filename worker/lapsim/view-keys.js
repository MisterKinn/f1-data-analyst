// Keys of a stored lap simulator view (first-view job, owner 2026-11-18). The precompute script (scripts/sim/precompute-views.mjs) and
// the page (worker/simulation.js sends these as source text) use the same functions, so a stored view is used only when its build and
// its state are exactly the ones the page would compute.

// short text hash: two 32-bit FNV/DJB sums in base 36
export function viewHash(s) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = (Math.imul(b, 33) + c) | 0; }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

// JSON with object keys sorted, so the same state always gives the same text
export function canonJson(x) {
  return JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(q => [q, v[q]])) : v);
}

// build = the page script version + the page data without the car asked for in the URL (the only field that changes with ?car=)
export function viewBuildKey(version, dataText) {
  const d = JSON.parse(dataText); delete d.carId;
  return version + '-' + viewHash(JSON.stringify(d));
}

// options a car starts with: the real qualifying's state when this car's season raced here (Brazil 2026: Alt, OT off), else the defaults
export function carStartOptions(data, carId) {
  const c = data.cars[carId], z = !c.series && c.year && data.zones ? data.zones[c.year < 2026 ? '2025' : String(Math.max(2026, ...Object.keys(data.zones).map(Number).filter(k => k >= 2026 && k <= c.year)))] : null, rq = z && z.real && z.year === c.year && c.fix ? z.real : {};
  return {sm: rq.grip === 'low' ? 'alt' : 'normal', ot: rq.ot !== 'off', drs: rq.drs !== 'off'};
}

// the state of the page's first view of a car (lapsimClient: initial state, then the car's start options in update())
export function firstViewState(data, carId) {
  const yearKey = data.conds['2026'] ? '2026' : Object.keys(data.conds)[0];
  return Object.assign({carId, compareId: '', mode: 'real', manual: Object.assign({pressureHpa: 1013, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}, data.conds[yearKey] || {}), active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}},
    {optCar: carId}, carStartOptions(data, carId));
}
