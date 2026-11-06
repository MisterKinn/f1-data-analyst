// Kongboda quasi-steady-state lap simulator.
// Point-mass car on a fixed racing line: tyre friction ellipse with load sensitivity,
// downforce and drag on the air-relative speed (wind), rear-axle traction, ICE + ERS-K
// power with the regulation speed taper and a per-lap energy budget, and active aero
// (2026 Straight Mode) or DRS zones. The method follows the forward/backward approach of
// TUM's laptime-simulation (Heilmeier et al.); the code is written for this site.
// All inputs are plain numbers/arrays so it runs in Node and in the browser.
import {tailwind, RHO_REF} from './atmosphere.js';

const G = 9.81;

// ERS-K DC power limit (W) as a function of speed (m/s) for each rule set.
// 2026–2028: Section C, Article C5.2.7/C5.2.8i (Overtake not active). Issue 21, 19 Oct 2026.
// 2027/2028 cap the deploy power at 300 kW (WMSC, June 2026); the speed taper is unchanged.
export function erskLimitW(rule, v, pMax) {
  const kph = v * 3.6;
  if (rule === 'f1-2026') {
    let p;
    if (kph < 340) p = 1800 - 5 * kph;
    else if (kph < 345) p = 6900 - 20 * kph;
    else p = 0;
    return Math.max(0, Math.min(pMax / 1000, p)) * 1000;
  }
  return pMax; // 2014–2025 rules: no speed taper, only the power cap
}

function makeTyre(car) {
  const m = car.mass, wb = car.wheelbase ?? 3.6, h = car.cogHeight ?? 0.3;
  return {
    m, hOverWb: h / wb,
    muX0: car.muX, muY0: car.muY, dmu: car.dmuDfz ?? -5e-5, fz0: car.fz0 ?? 3000,
    rearStatic: car.rearWeight ?? 0.55, rearAero: car.rearAero ?? 0.55,
    muXTrac: car.muXTrac ?? car.muX, inertia: car.inertiaFactor ?? 1.0,
  };
}

// Total lateral force capacity (N) with linear load sensitivity per tyre.
function capacity(mu0, dmu, fz0, normal) {
  const fzT = normal / 4;
  const mu = Math.max(0.3, mu0 + dmu * (fzT - fz0));
  return mu * normal;
}

export function simulateLap(track, car, env = {}, opts = {}) {
  const n = track.kappa.length, ds = track.ds;
  const rho = env.rho ?? RHO_REF;
  const grip = env.grip ?? 1;
  const iceFactor = env.iceFactor ?? 1;
  const windSpeed = env.windSpeed ?? 0, windFrom = env.windFromDeg ?? 0;
  const t = makeTyre(car);
  const mg = t.m * G;
  const mu = track.mu, vScale = track.vScale, aeroLow = track.aeroLow, grade = track.grade, heading = track.heading;
  const etaD = car.etaDrive ?? 0.96, etaK = car.etaErs ?? 0.95;
  const pIce = car.pIce * iceFactor;
  const ers = car.ers || {pMax: 0};
  const vMaxCar = car.vMax ?? 110;
  const cRoll = car.cRoll ?? 0.012;
  const k = Math.max(1, car.frictionExp ?? 2);
  const aeroFactor = 0.5 * rho;

  // Per-point constants
  const tail = new Float64Array(n), sinG = new Float64Array(n), cosG = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    tail[i] = heading && windSpeed ? tailwind(heading[i], windSpeed, windFrom) : 0;
    const g = grade ? grade[i] : 0; sinG[i] = Math.sin(g); cosG[i] = Math.cos(g);
  }
  const lowAt = i => !!(aeroLow && aeroLow[i]);
  const clAt = (i, low) => low ? (car.clALow ?? car.clA) : car.clA;
  const cdAt = (i, low) => low ? (car.cdALow ?? car.cdA) : car.cdA;
  const muAt = i => grip * (mu ? mu[i] : 1);
  const vAir = (v, i) => Math.max(0, v - tail[i]);

  // 1) Lateral limit per point (aero in corner mode; the driver closes Straight Mode for corners)
  const vLat = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const kap = Math.abs(track.kappa[i]);
    if (kap < 1e-5) { vLat[i] = vMaxCar; continue; }
    const m = muAt(i), cl = car.clA;
    const f = v => {
      const va = vAir(v, i), L = aeroFactor * cl * va * va, N = mg * cosG[i] + L;
      return m * capacity(t.muY0, t.dmu, t.fz0, N) - t.m * v * v * kap;
    };
    let lo = 1, hi = vMaxCar;
    if (f(hi) >= 0) { vLat[i] = vMaxCar; continue; }
    for (let it = 0; it < 48; it++) { const mid = 0.5 * (lo + hi); if (f(mid) >= 0) lo = mid; else hi = mid; }
    vLat[i] = Math.max(1, lo * (vScale ? vScale[i] : 1) - (car.vSubtractCorner ?? 0));
  }

  // Combined-slip reduction: remaining longitudinal share of the friction ellipse
  const ellipse = (v, i, lat) => {
    const kap = Math.abs(track.kappa[i]);
    if (kap < 1e-6) return 1;
    const ay = v * v * kap;
    const va = vAir(v, i), L = aeroFactor * car.clA * va * va, N = mg * cosG[i] + L;
    const ayMax = muAt(i) * capacity(t.muY0, t.dmu, t.fz0, N) / t.m;
    const r = Math.min(1, ay / ayMax);
    return Math.pow(Math.max(0, 1 - Math.pow(r, k)), 1 / k);
  };

  // 2) Backward pass (braking): independent of the ERS strategy, so computed once.
  //    Straight Mode is closed under braking: corner-mode aero.
  const brakeAcc = (v, i) => {
    const va = vAir(v, i), L = aeroFactor * car.clA * va * va, N = mg * cosG[i] + L;
    const fx = muAt(i) * (t.muX0 / t.muY0) * capacity(t.muY0, t.dmu, t.fz0, N) * ellipse(v, i);
    const drag = aeroFactor * car.cdA * va * va, roll = cRoll * N;
    let a = (fx + drag + roll) / t.m + G * sinG[i];
    if (car.brakeDecelMax) a = Math.min(a, car.brakeDecelMax);
    return a;
  };
  const vBack = new Float64Array(n);
  // start backward integration from the slowest point (its speed is set by the lateral limit)
  let iMin = 0; for (let i = 1; i < n; i++) if (vLat[i] < vLat[iMin]) iMin = i;
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 0) vBack[iMin] = vLat[iMin];
    for (let c = 1; c <= n; c++) {
      const i = (iMin - c + 2 * n) % n, j = (i + 1) % n;
      const vj = vBack[j];
      const v = Math.sqrt(vj * vj + 2 * brakeAcc(vj, i) * ds);
      vBack[i] = Math.min(v, vLat[i]);
    }
  }

  // 3) Forward pass for a given deployment cut-off speed (ERS strategy) and clip-harvest flag
  const fwd = new Float64Array(n), ersUsed = new Float64Array(n), powerLimited = new Uint8Array(n);
  const forward = (vCut) => {
    const v = fwd;
    v[iMin] = Math.min(vLat[iMin], vBack[iMin]);
    for (let pass = 0; pass < 2; pass++) {
      for (let c = 0; c < n; c++) {
        const i = (iMin + c) % n, j = (i + 1) % n;
        const vi = Math.max(v[i], 1);
        const low = lowAt(i);
        const va = vAir(vi, i), L = aeroFactor * clAt(i, low) * va * va, N = mg * cosG[i] + L;
        const pErs = vi < vCut ? erskLimitW(ers.rule, vi, ers.pMax || 0) : 0;
        const fPow = (pIce * etaD + pErs * etaK * etaD) / vi;
        const nRear = t.rearStatic * mg * cosG[i] + t.rearAero * L;
        const muX = muAt(i) * (t.muXTrac / t.muY0) * capacity(t.muY0, t.dmu, t.fz0, N) / N;
        const fTrac = muX * nRear / Math.max(0.2, 1 - muX * t.hOverWb) * ellipse(vi, i);
        const fDrive = Math.min(fPow, fTrac);
        powerLimited[i] = fPow <= fTrac ? 1 : 0;
        // DC power the ERS-K actually supplies: whatever the ICE cannot, up to its limit
        ersUsed[i] = pErs > 0 ? Math.min(pErs, Math.max(0, fDrive * vi - pIce * etaD) / (etaK * etaD)) : 0;
        const drag = aeroFactor * cdAt(i, low) * va * va, roll = cRoll * N;
        const a = (fDrive - drag - roll) / (t.m * t.inertia) - G * sinG[i];
        const vn = Math.sqrt(Math.max(1, vi * vi + 2 * a * ds));
        v[j] = Math.min(vn, vLat[j], vMaxCar, vBack[j]);
      }
    }
    return v;
  };

  // Energy accounting on the final profile
  const account = (v) => {
    let eDeploy = 0, eRegen = 0, time = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, vm = 0.5 * (v[i] + v[j]), dt = ds / Math.max(vm, 1);
      time += dt;
      if (v[j] > v[i] + 1e-6) eDeploy += ersUsed[i] * dt;
      if (v[j] < v[i] - 1e-6 && ers.regenMax) {
        // braking power at the wheels; the rear axle share can be recovered by the MGU-K
        const pBrake = t.m * (v[i] * v[i] - v[j] * v[j]) / (2 * ds) * vm;
        eRegen += Math.min(ers.regenMax, (ers.regenShare ?? 0.6) * pBrake) * (ers.etaRegen ?? 0.9) * dt;
      }
    }
    return {eDeploy, eRegen, time};
  };

  // 4) Choose the deployment cut-off speed so the lap stays inside the energy budget.
  //    Deploying at lower speed gains more time per joule, so a speed threshold is a good
  //    approximation of the optimal allocation.
  const budget = (eRegen) => {
    if (!ers.pMax) return 0;
    if (ers.rule === 'f1-2026') return (ers.socWindow ?? 4e6) + Math.min(eRegen, ers.rechargeMax ?? 8.5e6);
    return ers.deployMax ?? 4e6;
  };
  let vCut = vMaxCar + 1, v = forward(vCut), acc = account(v);
  if (ers.pMax && acc.eDeploy > budget(acc.eRegen)) {
    let lo = 5, hi = vMaxCar + 1;
    for (let it = 0; it < 26; it++) {
      const mid = 0.5 * (lo + hi);
      v = forward(mid); acc = account(v);
      if (acc.eDeploy > budget(acc.eRegen)) hi = mid; else lo = mid;
    }
    vCut = lo; v = forward(vCut); acc = account(v);
  }

  // Results
  const time = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; time[i + 1] = time[i] + 2 * ds / Math.max(v[i] + v[j], 2); }
  const limit = new Uint8Array(n); // 0 lateral, 1 traction, 2 power, 3 braking
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (v[j] < v[i] - 1e-6) limit[i] = 3;
    else if (Math.abs(v[i] - vLat[i]) < 0.05) limit[i] = 0;
    else limit[i] = powerLimited[i] ? 2 : 1;
  }
  const sec = track.sectors ? track.sectors.map(sv => Math.round(sv / ds)) : null;
  const sectors = sec ? [time[sec[0]], time[sec[1]] - time[sec[0]], time[n] - time[sec[1]]] : null;
  return {
    lapTime: time[n], sectors, v: Array.from(v), time: Array.from(time.subarray(0, n)), limit: Array.from(limit),
    energy: {deployJ: acc.eDeploy, regenJ: acc.eRegen, budgetJ: budget(acc.eRegen), cutoffKph: vCut > vMaxCar ? null : vCut * 3.6},
    vMaxKph: Math.max(...v) * 3.6, vMinKph: Math.min(...v) * 3.6,
  };
}
