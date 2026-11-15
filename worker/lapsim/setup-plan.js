// Setup simulator: which set-up knobs each car has, and where a track pushes them.
// One physics lap (the lap simulator's kernel, calibrated cars, real session weather) gives the
// track's demands: aero level that is fastest (drag vs downforce sweep), corner speed mix, braking,
// traction, kerbs/bumps and energy. Each knob is then placed on a 0–1 scale with the reason shown.
// Aero is computed; the mechanical knobs are rules of thumb driven by those computed demands.
import {lapsimKernel} from './kernel.js';
import {lapsimAllTracks} from './tracks.js';
import {carsFor, realConditions} from './scenario.js';

import {brakeZones} from './brakes.js';
import {energyLimit} from './energy-limits.js';
import {calendarEvents} from '../race-calendar-data.js';
import {PIRELLI_2026, PIRELLI_RANGE, SM_ZONES, BREMBO, F1_PRESS} from './setup-evidence.js';

const K = lapsimKernel();

// Aero window = downforce range of the wing choice, and the drag that comes with it. Extra wing
// downforce is less efficient than the whole car: the drag step uses a marginal lift/drag of 2.5
// (assumed until fitted from trap speeds). F1 teams pick a rear-wing spec per track (Monza to Monaco):
// ±20 % downforce. Hypercar: one homologated bodywork with one adjustable device (LMH 3.4.1): ±8 %.
export const AERO_RANGE = {f1: 0.40, hypercar: 0.16}, MARGINAL_LD = 2.5;
export const aeroWindow = (car, kind) => { const cl = AERO_RANGE[kind]; return {cl, cd: cl * car.clA / (car.cdA * MARGINAL_LD), low: kind === 'f1' ? 0.5 : 1}; };
// F1 2026: in straight mode the wings are flattened, so the wing level changes the straight-mode drag and
// downforce only partly (w.low = 0.5, assumed); hypercars have no low-drag mode (w.low = 1, same as hypercar-setup.js).
export function withSetup(car, s, w) {
  const k = s - 0.5, kl = k * (w.low ?? 1);
  return {...car, clA: car.clA * (1 + w.cl * k), cdA: car.cdA * (1 + w.cd * k), clALow: (car.clALow ?? car.clA) * (1 + w.cl * kl), cdALow: (car.cdALow ?? car.cdA) * (1 + w.cd * kl)};
}

// Calendar circuit ids that differ from simulator track ids (same as simulator-controls.js)
const CIRCUIT = {'albert-park': 'melbourne', spa: 'spa-francorchamps', cota: 'austin', mexico: 'mexico-city', barcelona: 'catalunya', 'red-bull-ring': 'spielberg',
  madrid: 'madring', sepang: 'kuala-lumpur', monaco: 'monte-carlo', bahrain: 'sakhir', 'yas-marina': 'yas-marina-circuit', ctmp: 'mosport'};

// Surface notes (public knowledge): street or public-road sections and well-known bumps. 0–1.
export const SURFACE = {
  'monte-carlo': {bumpy: 1, kerbs: 0.6, street: true}, singapore: {bumpy: 0.9, kerbs: 0.8, street: true}, baku: {bumpy: 0.7, kerbs: 0.3, street: true},
  'las-vegas': {bumpy: 0.6, kerbs: 0.3, street: true}, jeddah: {bumpy: 0.4, kerbs: 0.4, street: true}, montreal: {bumpy: 0.6, kerbs: 0.9},
  melbourne: {bumpy: 0.5, kerbs: 0.5}, miami: {bumpy: 0.5, kerbs: 0.5}, madring: {bumpy: 0.5, kerbs: 0.4}, austin: {bumpy: 0.8, kerbs: 0.6},
  interlagos: {bumpy: 0.7, kerbs: 0.5}, 'mexico-city': {bumpy: 0.5, kerbs: 0.5}, 'le-mans': {bumpy: 0.6, kerbs: 0.5}, daytona: {bumpy: 0.5, kerbs: 0.5},
  zandvoort: {bumpy: 0.3, kerbs: 0.7}, monza: {bumpy: 0.3, kerbs: 0.9}, 'road-atlanta': {bumpy: 0.5, kerbs: 0.6}, 'watkins-glen': {bumpy: 0.5, kerbs: 0.5},
  sebring: {bumpy: 1, kerbs: 0.5}, 'road-america': {bumpy: 0.4, kerbs: 0.5}, 'laguna-seca': {bumpy: 0.4, kerbs: 0.6}, fuji: {bumpy: 0.3, kerbs: 0.5},
};

// Cars. F1: one rule set, team = power-unit supplier (2026 grid). Hypercar: model → class, chassis, hybrid axle.
export const F1_TEAMS = [
  ['mclaren', 'McLaren', 'Mercedes'], ['mercedes', 'Mercedes', 'Mercedes'], ['williams', 'Williams', 'Mercedes'], ['alpine', 'Alpine', 'Mercedes'],
  ['ferrari', 'Ferrari', 'Ferrari'], ['haas', 'Haas', 'Ferrari'], ['cadillac', 'Cadillac', 'Ferrari'], ['red-bull', 'Red Bull', 'Red Bull Ford'],
  ['racing-bulls', 'Racing Bulls', 'Red Bull Ford'], ['aston-martin', 'Aston Martin', 'Honda'], ['audi', 'Audi', 'Audi']];
export const HYPERCARS = [
  {key: 'toyota', name: 'Toyota GR010 HYBRID', cls: 'lmh', chassis: 'Toyota', hybrid: 'front', series: 'WEC'},
  {key: 'ferrari', name: 'Ferrari 499P', cls: 'lmh', chassis: 'Ferrari', hybrid: 'front', series: 'WEC'},
  {key: 'peugeot', name: 'Peugeot 9X8', cls: 'lmh', chassis: 'Peugeot', hybrid: 'front', series: 'WEC'},
  {key: 'aston', name: 'Aston Martin Valkyrie', cls: 'lmh', chassis: 'Aston Martin / Multimatic', hybrid: null, series: 'WEC · IMSA'},
  {key: 'cadillac', name: 'Cadillac V-Series.R', cls: 'lmdh', chassis: 'Dallara', hybrid: 'rear', series: 'WEC · IMSA'},
  {key: 'bmw', name: 'BMW M Hybrid V8', cls: 'lmdh', chassis: 'Dallara', hybrid: 'rear', series: 'WEC · IMSA'},
  {key: 'alpine', name: 'Alpine A424', cls: 'lmdh', chassis: 'Oreca', hybrid: 'rear', series: 'WEC'},
  {key: 'genesis', name: 'Genesis GMR-001', cls: 'lmdh', chassis: 'Oreca', hybrid: 'rear', series: 'WEC'},
  {key: 'porsche', name: 'Porsche 963', cls: 'lmdh', chassis: 'Multimatic', hybrid: 'rear', series: 'IMSA'},
  {key: 'acura', name: 'Acura ARX-06', cls: 'lmdh', chassis: 'Oreca', hybrid: 'rear', series: 'IMSA'},
];

// Tracks each class races on (calendar data) that the simulator has a line for
export function setupTracks(kind, events = calendarEvents, tracks = lapsimAllTracks) {
  const series = kind === 'f1' ? ['f1'] : ['wec', 'imsa'], out = new Map();
  for (const e of events) {
    if (!series.includes(e.series)) continue;
    const id = CIRCUIT[e.circuit] || e.circuit;
    if (!tracks[id]) continue;
    if (!out.has(id)) out.set(id, new Set());
    out.get(id).add(e.series === 'f1' ? 'F1' : e.series === 'wec' ? 'WEC' : 'IMSA');
  }
  return Object.fromEntries([...out].map(([k, s]) => [k, [...s]]));
}

const clamp = x => Math.max(0, Math.min(1, x));
const withGrip = (tr, g) => { if (!g || g === 1) return tr; const mu = Float64Array.from(tr.mu, m => m * g); return {...tr, mu}; };

// Session weather to set up for (owner rule 2026-11-15): F1 car = the Grand Prix held there (newest season
// first); hypercar = its own WEC/IMSA event, then the F1 Grand Prix; else any real race at the track; else a
// plausible default. Values are the weather of the session the best lap came from.
const finite = v => v && Number.isFinite(v.airTempC) && Number.isFinite(v.trackTempC);
export function pickWeather(id, kind, cls) {
  const conds = realConditions(id) || {}, f1 = ['2026', '2025', '2024', '2023'];
  const order = kind === 'f1' ? f1.map(k => [k, 'f1'])
    : [['wec-' + cls, 'wec'], ['wec-' + (cls === 'lmh' ? 'lmdh' : 'lmh'), 'wec'], ['imsa-gtp', 'imsa'], ...f1.map(k => [k, 'f1'])];
  for (const [k, src] of order) if (finite(conds[k])) return {w: conds[k], src, year: Number(conds[k].year ?? k), key: k};
  const any = Object.entries(conds).find(([, v]) => finite(v));
  if (any) return {w: any[1], src: 'other', year: Number(any[1].year) || null, key: any[0]};
  return {w: {}, src: 'assumed', year: null, key: null};
}

// Wet: intermediate-tyre grip as a fixed share of dry grip (assumed until fitted from wet sessions), cooler track
export const WET = {grip: 0.75, trackOverAirC: 3};

function envFor(id, kind, cls, wet) {
  const pick = pickWeather(id, kind, cls);
  const w = {pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0,
    ...Object.fromEntries(Object.entries(pick.w).filter(([, v]) => Number.isFinite(v)))};
  if (wet) { w.trackTempC = w.airTempC + WET.trackOverAirC; w.humidityPct = Math.max(w.humidityPct, 90); }
  const energy = kind === 'f1' ? energyLimit(id, 2026) : null;
  return {env: K.conditionsFromWeather({...w, rechargeMJ: energy?.mj ?? undefined}), weather: w, source: {src: pick.src, year: pick.year, rain: !!pick.w.rain}, energy};
}

// Track demands from one simulated lap
export function trackDemands(track, car, env, r) {
  const n = r.v.length, ds = track.ds, L = n * ds, share = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) share[r.limit[i]] += 1 / n;
  // corners: runs of points tighter than 500 m radius (at least 20 m long); the lowest speed in the run classes it
  const corners = [], tight = i => Math.abs(track.kappa[i]) > 1 / 500;
  let i0 = 0; while (i0 < n && tight(i0)) i0++; // start on a straight so no corner is split at the line
  for (let k = 0; k < n; k++) {
    const i = (i0 + k) % n; if (!tight(i) || tight((i - 1 + n) % n)) continue;
    let j = 0, vmin = Infinity; while (j < n && tight((i + j) % n)) { vmin = Math.min(vmin, r.v[(i + j) % n]); j++; }
    if (j * ds >= 20) corners.push(vmin * 3.6);
  }
  const slow = corners.filter(v => v < 130).length, fast = corners.filter(v => v >= 210).length, cn = Math.max(1, corners.length);
  let h = 0, hMin = 0, hMax = 0; if (track.grade) for (let i = 0; i < n; i++) { h += Math.sin(track.grade[i]) * ds; hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
  let above190 = 0; for (let i = 0; i < n; i++) if (r.v[i] * 3.6 >= 190) above190 += 1 / n;
  const b = brakeZones(track, car, env, r.v, r.limit);
  const heavy = b.zones.filter(z => z.vFrom - z.vTo >= 100).length;
  return {lengthKm: L / 1000, lapTime: r.lapTime, vMax: r.vMaxKph, vMin: r.vMinKph, corner: share[0], traction: share[1], fullPower: share[2], braking: share[3],
    corners: corners.length, slow, fast, slowShare: slow / cn, fastShare: fast / cn, heavyBrakes: heavy, brakeZones: b.zones.length,
    brakeTimeShare: b.brakingTime / r.lapTime, peakG: b.peakG, regenMJ: b.energy.regenKWh * 3.6, brakeMJ: b.energy.totalKWh * 3.6, elevation: hMax - hMin, above190};
}

// Fastest aero level: sweep then a parabola through the best three points
export function aeroSweep(track, car, env, w, steps = 10) {
  const pts = [];
  for (let k = 0; k <= steps; k++) { const s = k / steps, r = K.simulateLap(track, withSetup(car, s, w), env); pts.push({s, lap: r.lapTime, vMax: r.vMaxKph}); }
  let i = pts.reduce((b, p, k) => p.lap < pts[b].lap ? k : b, 0), s = pts[i].s;
  if (i > 0 && i < steps) { const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]], d = a.lap - 2 * b.lap + c.lap; if (d > 0) s = clamp(b.s + (a.lap - c.lap) / (2 * d) / steps); }
  return {s, pts};
}

const built = new Map();
const trackCache = (id, tracks) => { if (!built.has(id)) built.set(id, K.trackFromData(tracks[id])); return built.get(id); };

const pos = (p, why) => ({p: Math.round(clamp(p) * 100) / 100, why});

// Knob positions for a track (0 = left label, 1 = right label of each knob)
export function placeKnobs(kind, d, aero, surface = {}, ev = {}) {
  const bumpy = surface.bumpy ?? 0.3, kerbs = surface.kerbs ?? 0.5, mix = d.fastShare - d.slowShare;
  const brakeLoad = clamp((d.brakeTimeShare - 0.10) / 0.12), tractionNeed = clamp((d.traction - 0.05) / 0.25 + d.slowShare * 0.5);
  const out = {
    aero: pos(aero.s, 'aero'),
    rideHeight: pos(0.35 + 0.45 * bumpy + 0.15 * kerbs - 0.25 * d.fastShare, 'rideHeight'),
    springs: pos(0.5 + 0.4 * mix - 0.35 * bumpy + 0.15 * clamp((d.vMax - 280) / 60), 'springs'),
    rollBalance: pos(0.5 + 0.35 * mix, 'rollBalance'),
    dampers: pos(0.6 - 0.45 * kerbs * 0.5 - 0.35 * bumpy + 0.2 * d.fastShare, 'dampers'),
    camber: ev.pirelli ? pos((ev.pirelli.p[0] - PIRELLI_RANGE.pMin) / Math.max(0.1, PIRELLI_RANGE.pMax - PIRELLI_RANGE.pMin), 'pirelli')
      : pos(0.4 + 0.5 * d.fastShare + 0.2 * d.corner - 0.2 * d.braking, 'camber'),
    brakeCooling: ev.brembo ? pos(0.5 * brakeLoad + 0.5 * (ev.brembo.i - 1) / 4, 'brembo') : pos(brakeLoad, 'brakeCooling'),
    diff: pos(0.4 + 0.5 * tractionNeed - 0.2 * d.fastShare, 'diff'),
  };
  if (kind !== 'f1') out.tc = pos(tractionNeed, 'tc');
  return out;
}

// Wet weather moves the mechanical set-up the usual way (softer, higher, more open diff, more TC, less
// brake cooling); aero comes from the wet-grip lap sweep itself.
const WET_SHIFT = {rideHeight: 0.2, springs: -0.25, rollBalance: -0.15, dampers: -0.2, brakeCooling: -0.3, diff: -0.15, tc: 0.3};
function wetShift(knobs, wet) {
  if (!wet) return knobs;
  const out = {};
  for (const [k, v] of Object.entries(knobs)) out[k] = WET_SHIFT[k] ? pos(v.p + WET_SHIFT[k], v.why) : v;
  return out;
}

// Full plan for one car on one track
export function setupPlan(trackId, carId, {wet = false} = {}, tracks = lapsimAllTracks) {
  const kind = carId.startsWith('f1') ? 'f1' : 'hypercar', model = kind === 'f1' ? null : HYPERCARS.find(m => m.key === carId.split(':')[1]);
  const cls = kind === 'f1' ? null : (model?.cls || (carId.includes('lmdh') ? 'lmdh' : 'lmh'));
  const carKey = kind === 'f1' ? '2026' : 'wec-' + cls, c = carsFor(trackId)[carKey]; if (!c) return null;
  let car = c.car;
  if (model && model.hybrid === null) car = {...car, ers: {}, awdAboveKph: undefined, label: model.name}; // Valkyrie: no hybrid
  if (wet) car = {...car, muX: car.muX * WET.grip, muY: car.muY * WET.grip, muXTrac: (car.muXTrac ?? car.muX) * WET.grip};
  let track = withGrip(trackCache(trackId, tracks), c.grip);
  // F1 2026: no straight-mode zone at this track (Monaco) = no low-drag mode anywhere
  if (kind === 'f1' && SM_ZONES[trackId] === 0) track = {...track, aeroLow: null};
  const {env, weather, source, energy} = envFor(trackId, kind, cls, wet);
  const w = aeroWindow(car, kind), aero = aeroSweep(track, car, env, w);
  const set = withSetup(car, aero.s, w), r = K.simulateLap(track, set, env), d = trackDemands(track, set, env, r);
  const low = aero.pts[0], high = aero.pts.at(-1);
  const ev = kind === 'f1' ? {pirelli: PIRELLI_2026[trackId] || null, brembo: BREMBO[trackId] || null, sm: SM_ZONES[trackId] ?? null, press: F1_PRESS[trackId] || null} : {};
  return {trackId, carId, wet, source, kind, cls, model, vCapKph: car.vMax * 3.6, carLabel: car.label, kindLabel: c.kind, weather, energy, demands: d, aero: {...aero, low, high, lap: r.lapTime, vMax: r.vMaxKph}, window: w,
    knobs: wetShift(placeKnobs(kind, d, aero, SURFACE[trackId], ev), wet), surface: SURFACE[trackId] || null, evidence: ev};
}
