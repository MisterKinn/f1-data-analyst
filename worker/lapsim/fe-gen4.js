// Formula E Gen4 (season 2026-27) prior car for the lap simulator. Not calibrated: no Gen4 timing data exists yet.
// Same rule set as the other series (series.js): values printed in the regulations stay fixed; drag, downforce and
// tyre grip are priors with bounds and get fitted once test and race laps arrive. Sources and page numbers:
// docs/lapsim-fe-gen4-prep.md. TR = FIA Formula E Technical Regulations 2026-2027 V4, SR = Sporting Regulations.

export const FE_GEN4_FIXED = {
  mass: 1046,            // kg with driver, TR 5.1
  wheelbase: 3.08,       // m, middle of 3070-3090 mm, TR 4.4.5
  frontMass: 0.45,       // middle of 44-46 %, TR 5.2
  tyreRadius: 0.355,     // m unloaded, 710 mm overall diameter front and rear, TR 13.8
  powerMaxKW: 600, frontCapKW: 250, rearCapKW: 350,  // TR 7.5
  regenMaxKW: 700, regenFrontCapKW: 350, regenRearCapKW: 350, // TR 7.5
  raceEnergyKWh: 51.25,  // net, or the event value, TR 7.5 / SR 27.8
  fastChargeKWh: 4.05,   // "[4.05 max TBC]", TR 7.5
  raceModeMaxKW: 450,    // SR 27.3 b); the value of each race comes in a Bulletin
  attackExtraKW: 150,    // SR 27.3 d)
};

// Not published anywhere. start = value the prior car uses; lo/hi = bounds for the fit; basis = where it comes from.
export const FE_GEN4_PRIOR = {
  muY: {start: 1.6, lo: 1.3, hi: 2.0, basis: 'Gen3 Evo needs about 1.5 for its Monaco duel lap (scripts/sim/fe-gen4-prior.mjs); Gen4 tyre reported 5-10 % grippier'},
  muXTrac: {start: 1.65, lo: 1.5, hi: 2.0, basis: '0-100 km/h in about 1.8 s needs a mean of 1.57 g on four driven tyres'},
  muX: {start: 1.5, lo: 1.3, hi: 1.9, basis: 'braking; same ratio to muY as the WEC prior'},
  cogHeight: {start: 0.29, lo: 0.25, hi: 0.33, basis: 'single-seater with the battery under the monocoque (engineering prior)'},
  rearAero: {start: 0.55, lo: 0.45, hi: 0.6, basis: 'aero balance, near the mass distribution'},
  cRoll: {start: 0.015, lo: 0.01, hi: 0.02, basis: 'same as the series common value'},
  etaDrive: {start: 0.9, lo: 0.88, hi: 0.97, basis: 'battery to wheel; 0.90 reproduces the published 0-200 km/h time (4.4 s), 0.97 (series claim) gives 4.2 s'},
  regenShare: {start: 0.9, lo: 0.6, hi: 1.0, basis: 'share of braking done by the motors; four circuits, two are motor-only'},
  etaRegen: {start: 0.95, lo: 0.9, hi: 0.97, basis: 'wheel to battery'},
  vMaxKph: {start: 340, lo: 335, hi: 345, basis: 'claimed top speed 335 km/h; 338 km/h reported in testing'},
};

// Aero packages (TR 4.5). No measured coefficient is public.
// LDF: the FIA tender TARGET as reported (SCz 2.0, SCx 0.65).
// HDF: revised 2026-11-11 from the tender target (SCz 3.0, SCx 0.75). Two independent hints agree on more downforce:
// Porsche "up to 150 percent more downforce compared to the GEN3 Evo" (2.5 x 1.75 = 4.4), and the 8 s Monaco gain
// over Gen3 Evo that engineers quote needs about 4.6 in this model. Drag keeps the tender lift/drag ratio (4.0).
// Bound from the top-speed claim: cdA <= 1.18.
export const FE_GEN4_AERO = {
  ldf: {label: 'Low downforce (LDF)', clA: 2.0, cdA: 0.65, bounds: {clA: [1.2, 3.0], cdA: [0.55, 1.0]}},
  hdf: {label: 'High downforce (HDF)', clA: 4.4, cdA: 1.1, tender: {clA: 3.0, cdA: 0.75}, bounds: {clA: [3.0, 6.0], cdA: [0.75, 1.18]}},
};

// Session configurations. Aero per session is fixed by a Bulletin for each event (SR 23.1, 27.3 a)); these are the
// series' published plan and may differ at an event.
export const FE_GEN4_MODES = {
  qualifying: {label: 'Qualifying', powerKW: 600, aero: 'hdf'},
  'unleashed': {label: 'E-Prix Unleashed, Race Mode', powerKW: 450, aero: 'hdf'},
  'unleashed-attack': {label: 'E-Prix Unleashed, Attack Mode', powerKW: 600, aero: 'hdf'},
  'eprix': {label: 'E-Prix, Race Mode', powerKW: 450, aero: 'ldf'},
  'eprix-attack': {label: 'E-Prix, Attack Mode', powerKW: 600, aero: 'ldf'},
};

// Front/rear power range allowed by the two axle caps at a total power (kW).
export function powerSplit(totalKW, f = FE_GEN4_FIXED) {
  if (!(totalKW > 0) || totalKW > f.frontCapKW + f.rearCapKW) throw new RangeError('total power outside 0..600 kW');
  const frontMin = Math.max(0, totalKW - f.rearCapKW), frontMax = Math.min(f.frontCapKW, totalKW);
  return {frontMinKW: frontMin, frontMaxKW: frontMax, rearMinKW: totalKW - frontMax, rearMaxKW: totalKW - frontMin, forced: frontMin === frontMax};
}

// Kernel car for one aero package and power level. The kernel has no electric-only car type, so the battery
// power sits in pIce and there is no ERS; permanent all-wheel drive is awdAboveKph = 0.
export function gen4Car({aero = 'ldf', powerKW = 600, overrides = {}} = {}) {
  const a = FE_GEN4_AERO[aero];
  if (!a) throw new RangeError(`unknown aero package: ${aero}`);
  if (!(powerKW > 0) || powerKW > FE_GEN4_FIXED.powerMaxKW) throw new RangeError('power outside 0..600 kW');
  const p = Object.fromEntries(Object.entries(FE_GEN4_PRIOR).map(([k, v]) => [k, v.start]));
  const f = FE_GEN4_FIXED;
  return {
    label: `Gen4 ${aero.toUpperCase()} ${powerKW} kW (prior)`,
    mass: f.mass, wheelbase: f.wheelbase, cogHeight: p.cogHeight, rearWeight: 1 - f.frontMass, rearAero: p.rearAero,
    clA: a.clA, cdA: a.cdA, clALow: a.clA, cdALow: a.cdA, noLowDrag: true,
    muX: p.muX, muY: p.muY, muXTrac: p.muXTrac, dmuDfz: -5e-5, fz0: 3000, cRoll: p.cRoll,
    etaDrive: p.etaDrive, pIce: powerKW * 1e3, vMax: p.vMaxKph / 3.6, inertiaFactor: 1.06, vSubtractCorner: 0.3,
    awdAboveKph: 0, ers: {},
    regen: {maxW: f.regenMaxKW * 1e3, share: p.regenShare, eta: p.etaRegen},
    ...overrides,
  };
}

export function modeCar(mode, overrides) {
  const m = FE_GEN4_MODES[mode];
  if (!m) throw new RangeError(`unknown mode: ${mode}`);
  return gen4Car({aero: m.aero, powerKW: m.powerKW, overrides});
}

// Standing-start run on a flat straight with the same force model as the kernel (all four tyres drive, power cap,
// drag, rolling resistance). Used to check the prior against the published 0-100, 0-200 and top-speed claims.
export function straightLine(car, {rho = 1.225, dt = 0.001, tMax = 60} = {}) {
  const g = 9.81, m = car.mass, mEff = m * (car.inertiaFactor ?? 1);
  let v = 0, t = 0, t100 = null, t200 = null;
  while (t < tMax) {
    const down = 0.5 * rho * car.clA * v * v, drag = 0.5 * rho * car.cdA * v * v, roll = car.cRoll * (m * g + down);
    const fDrive = Math.min(car.pIce * car.etaDrive / Math.max(v, 0.5), car.muXTrac * (m * g + down));
    const a = (fDrive - drag - roll) / mEff;
    if (a < 1e-3 || v >= car.vMax) break;
    v += a * dt; t += dt;
    if (t100 == null && v >= 100 / 3.6) t100 = t;
    if (t200 == null && v >= 200 / 3.6) t200 = t;
  }
  return {t100, t200, vTopKph: v * 3.6, dragLimited: v < car.vMax - 0.1};
}

// Battery energy of one simulated lap (kWh): drive energy out, braking energy recovered inside the 700 kW limit,
// and the net value that counts against the race allowance. result: simulateLap() output; track: kernel track.
export function lapEnergy(result, car, track, {rho = 1.225} = {}) {
  const n = result.v.length, ds = track.ds, g = 9.81, m = car.mass, mEff = m * (car.inertiaFactor ?? 1);
  const rg = car.regen || {maxW: 0, share: 0, eta: 0};
  let out = 0, regen = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, vi = result.v[i], vj = result.v[j], vm = Math.max(1, 0.5 * (vi + vj)), dt = ds / vm;
    const down = 0.5 * rho * car.clA * vm * vm, drag = 0.5 * rho * car.cdA * vm * vm;
    const grade = track.grade ? m * g * Math.sin(track.grade[i]) : 0;
    const fWheel = mEff * (vj * vj - vi * vi) / (2 * ds) + drag + car.cRoll * (m * g + down) + grade;
    if (fWheel >= 0) out += Math.min(car.pIce, fWheel * vm / car.etaDrive) * dt;
    else regen += Math.min(rg.maxW, rg.share * -fWheel * vm * rg.eta) * dt;
  }
  const k = 1 / 3.6e6;
  return {outKWh: out * k, regenKWh: regen * k, netKWh: (out - regen) * k, regenFraction: out ? regen / out : 0};
}

// Gen3 Evo reference car (seasons 2024-25 and 2025-26) for checking the method on real laps: 350 kW with all four
// wheels driven in qualifying duels, 859 kg with driver, wheelbase 2970.5 mm. Aero is the Gen3 tender range middle
// (SCz 1.5-2.0, SCx 0.60-0.65); grip is the value to solve for.
export function gen3EvoCar(muY, {clA = 1.75, cdA = 0.62} = {}) {
  return {...gen4Car({aero: 'ldf', powerKW: 350}), label: 'Gen3 Evo 350 kW (reference)', mass: 859, wheelbase: 2.9705,
    clA, cdA, clALow: clA, cdALow: cdA, vMax: 322 / 3.6, ...gripSet(muY)};
}
// The three grip values move together, in the ratio of the prior.
export function gripSet(muY) {
  const p = FE_GEN4_PRIOR;
  return {muY, muX: muY * p.muX.start / p.muY.start, muXTrac: muY * p.muXTrac.start / p.muY.start};
}
