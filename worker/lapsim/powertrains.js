// Engine curve and gear ratios per rule set (bug report 2026-11-15: no torque curve or gears). Engineering estimates where the
// makers publish nothing; checked with Wolfram (overall ratio so the top gear reaches the top speed at the rev limit, geometric spread).
// Power is a share of the car's pIce (its regulation or BoP cap), so the fitted power level is unchanged; the curve only adds the
// shape: less power low in the rev range and none above the top gear's limit.
const geo = (top, spread, n) => Array.from({length: n}, (_, i) => +(top * spread ** ((n - 1 - i) / (n - 1))).toFixed(3));
// F1 1.6 V6 turbo: fuel flow limit rises 0.009 x rpm + 5.5 kg/h below 10 500 rpm, flat 100 kg/h above (FIA F1 TR 5.1.4); rev limit
// 15 000; 8 gears, 1st about 115 km/h, 8th 345 km/h at 12 000 rpm; 18-inch tyres, 0.36 m rolling radius.
const F1 = {engine: {rpm: [4000, 6000, 8000, 10500, 12000, 13500, 15000], frac: [0.415, 0.595, 0.775, 1, 1, 0.97, 0.9], rpmMax: 15000}, gears: geo(4.72, 3.0, 8), tyreRadius: 0.36};
// Hypercar (LMH and LMDh, turbo V6 or V8 and NA V8 under a BoP power cap): broad plateau 6 000-8 200 rpm; 7 gears, 7th 340 km/h at 8 200.
const HYPER = {engine: {rpm: [2500, 4000, 5500, 6500, 7000, 8200, 8600], frac: [0.4, 0.66, 0.9, 0.98, 1, 1, 0.95], rpmMax: 8600}, gears: geo(3.23, 3.0, 7), tyreRadius: 0.355};
// GT3 (BoP restrictor or boost map flattens the top): plateau 6 000-7 600 rpm; 6 gears, 6th 300 km/h at 7 600; 0.34 m tyres.
const GT3 = {engine: {rpm: [2500, 4000, 5500, 6000, 7000, 7600, 8000], frac: [0.4, 0.65, 0.9, 0.97, 1, 1, 0.96], rpmMax: 8000}, gears: geo(3.25, 2.9, 6), tyreRadius: 0.34};
// Formula E: one reduction gear; the motor gives constant torque up to its base speed (a quarter of the 20 000 rpm limit), then constant power.
const fe = (ratio, r) => ({engine: {rpm: [1000, 5000, 20000], frac: [0.2, 1, 1], rpmMax: 20000}, gears: [ratio], tyreRadius: r});
const FE = {gen4: fe(7.87, 0.355), gen3evo: fe(8.2, 0.35), gen3: fe(8.2, 0.35), gen2: fe(8.24, 0.34)};
export const POWERTRAINS = {f1: F1, hypercar: HYPER, gt3: GT3, fe: FE};
// The preset for a scenario car entry (series, class); a car that already carries its own curve keeps it.
export function powertrainFor(c) {
  if (c.series === 'fe') return FE[c.cls] || FE.gen3evo;
  if (!c.series) return F1;
  if (c.cls === 'lmh' || c.cls === 'lmdh' || c.cls === 'gtp') return HYPER;
  return GT3; // LMGT3, IMSA GTD, every GT3 model
}
export const withPowertrain = (car, c) => car.engine && car.gears ? car : {...car, ...powertrainFor(c)};
