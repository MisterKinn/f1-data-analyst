// Per-class engine density exponent (step 13-prep). Behind LAPSIM_ICE_BETA=measured (Node only); off, cars are untouched.
// Sets car.iceDensityExp; the kernel reads it only after gate 13 (patch claude/release/step13-kernel-ice-read-2026-11-23.patch).
import {lapsimIceDensity as D} from './ice-density-data.js';

export const iceBetaOn = () => globalThis.process?.env?.LAPSIM_ICE_BETA === 'measured';

// car key (carsFor) → class in ice-density-data.js; null = keep the kernel value
export function iceClassOf(key, entry = {}) {
  if (/^(wec-lmh|wec-lmdh|imsa-gtp|hyper-)/.test(key)) return 'hypercar';
  if (key === 'wec-lmgt3' || /^gt3-/.test(key) || entry.proxyOf === 'wec-lmgt3') return 'gt3';
  if (/^\d{4}$/.test(key) && D.f1Seasons?.includes(Number(key))) return 'f1';
  return null;
}

export function withIceDensity(cars, on = iceBetaOn()) {
  if (!on) return cars;
  for (const [k, e] of Object.entries(cars)) {
    const b = D.classes[iceClassOf(k, e)]?.beta;
    if (e?.car && Number.isFinite(b)) e.car = {...e.car, iceDensityExp: b};
  }
  return cars;
}
