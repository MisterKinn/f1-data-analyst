// Car models for the lap simulator.
// 2019: TUM's published generic F1 car (laptime-simulation F1_Shanghai.ini), as the base.
// 2025/2026: starting values from the regulations, replaced by values fitted to real
// qualifying laps (worker/lapsim/calibration-data.js) when available.
// 2027/2028: the fitted 2026 car with the ratified power-unit rule changes plus the historical
// development rate of a regulation cycle (worker/lapsim/pole-trend.js).

export const TUM_2019 = {
  label: '2019 (TUM base)', mass: 733, wheelbase: 3.6, cogHeight: 0.335,
  clA: 4.88, cdA: 1.56, clALow: 4.88, cdALow: 1.56 * (1 - 0.17),
  muX: 1.65, muY: 1.85, muXTrac: 1.95, dmuDfz: -5e-5, fz0: 3000, cRoll: 0.03,
  etaDrive: 0.96, etaErs: 1.0, pIce: 575e3, vMax: 318.8 / 3.6, inertiaFactor: 1.09, vSubtractCorner: 0.5,
  ers: {rule: 'f1-2014', pMax: 120e3, deployMax: 4e6},
};

// Priors (calibration starting points), from the regulations of each year.
export const PRIOR = {
  2025: {
    label: '2025', mass: 806, wheelbase: 3.6, cogHeight: 0.3,
    clA: 5.0, cdA: 1.45, clALow: 4.6, cdALow: 1.2,
    muX: 1.65, muY: 1.85, muXTrac: 1.95, dmuDfz: -5e-5, fz0: 3000, cRoll: 0.012,
    etaDrive: 0.96, etaErs: 0.95, pIce: 560e3, vMax: 380 / 3.6, inertiaFactor: 1.06, vSubtractCorner: 0.3,
    ers: {rule: 'f1-2014', pMax: 120e3, deployMax: 4e6},
  },
  // 768 kg minimum (C4.1) + about 8 kg of qualifying fuel; ERS-K 350 kW DC both ways (C5.2.7) with the C5.2.8 speed
  // taper, 4 MJ state-of-charge window (C5.2.9), 8.5 MJ recharge per lap (C5.2.10).
  2026: {
    label: '2026', mass: 776, wheelbase: 3.4, cogHeight: 0.3,
    clA: 3.6, cdA: 1.2, clALow: 2.6, cdALow: 0.85,
    muX: 1.65, muY: 1.85, muXTrac: 1.95, dmuDfz: -5e-5, fz0: 3000, cRoll: 0.012,
    etaDrive: 0.96, etaErs: 0.95, pIce: 400e3, vMax: 380 / 3.6, inertiaFactor: 1.06, vSubtractCorner: 0.3,
    ers: {rule: 'f1-2026', pMax: 350e3, socWindow: 4e6, rechargeMax: 8.5e6, regenMax: 350e3, regenShare: 0.4, etaRegen: 0.9},
  },
};

// Ratified power-unit changes (FIA World Motor Sport Council, June 2026), relative to 2026.
export const RULE_CHANGES = {
  2027: {pIceScale: 1.05, ersPMax: 300e3, regenMax: 375e3, note: {
    ko: '연료 유량 +5%, MGU-K 최대 배치 350→300kW, 회생 한도 350→375kW',
    en: 'Fuel flow +5%, MGU-K deployment 350→300 kW, recharge rate 350→375 kW'}},
  2028: {pIceScale: 1.125, ersPMax: 300e3, regenMax: 400e3, note: {
    ko: '연료 유량 2026년 대비 +12.5%, 회생 한도 400kW',
    en: 'Fuel flow +12.5% over 2026, recharge rate 400 kW'}},
};

// Chassis/aero development as one factor d: downforce +d, mechanical grip +d/3.
export function applyDevelopment(car, d) {
  const c = structuredClone(car);
  c.clA *= 1 + d; c.clALow = (c.clALow ?? car.clA) * (1 + d);
  const g = 1 + d / 3;
  c.muY *= g; c.muX *= g; if (c.muXTrac) c.muXTrac *= g;
  return c;
}

export function applyRules(car2026, year) {
  const r = RULE_CHANGES[year]; if (!r) return structuredClone(car2026);
  const c = structuredClone(car2026);
  c.pIce = car2026.pIce * r.pIceScale;
  c.ers = {...c.ers, pMax: r.ersPMax, regenMax: r.regenMax};
  c.label = String(year);
  return c;
}
