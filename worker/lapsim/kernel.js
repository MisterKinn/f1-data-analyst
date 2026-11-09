// Self-contained lap simulator kernel. Everything the browser needs lives inside one function,
// so it can be shipped as source text (lapsimKernel.toString()) without depending on module
// names after bundling. Node modules re-export from the same instance.
export function lapsimKernel() {
  // Air and wind for the lap simulator. Pure functions, shared by server and browser.

  const RD = 287.058;   // J/(kg·K), dry air
  const RV = 461.495;   // J/(kg·K), water vapour
  const RHO_REF = 1.18; // kg/m³, the density the TUM base car was set up with

  // Saturation vapour pressure over water, hPa (Buck 1981).
  function saturationVapourPressure(tempC) {
    return 6.1121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  }

  // Station pressure (hPa) from altitude (m) for the ISA atmosphere; used only when no measurement exists.
  function pressureFromAltitude(altitudeM) {
    return 1013.25 * Math.pow(1 - 2.25577e-5 * altitudeM, 5.25588);
  }

  // Moist-air density in kg/m³ from station pressure (hPa), air temperature (°C) and relative humidity (%).
  function airDensity({ pressureHpa, tempC, humidityPct = 50 }) {
    if (!Number.isFinite(pressureHpa) || !Number.isFinite(tempC)) throw new TypeError('pressureHpa and tempC are required');
    const T = tempC + 273.15;
    const pv = Math.min(1, Math.max(0, humidityPct / 100)) * saturationVapourPressure(tempC);
    const pd = pressureHpa - pv;
    return (pd * 100) / (RD * T) + (pv * 100) / (RV * T);
  }

  // Wind along the track. headingRad: direction of travel in the east/north frame
  // (0 = east, π/2 = north). windFromDeg: meteorological direction the wind comes FROM
  // (0 = from north, 90 = from east). Returns the tailwind component in m/s (negative = headwind).
  function tailwind(headingRad, windSpeed, windFromDeg) {
    if (!windSpeed) return 0;
    const toRad = (windFromDeg + 180) * Math.PI / 180;     // direction the air moves TO, clockwise from north
    const we = windSpeed * Math.sin(toRad), wn = windSpeed * Math.cos(toRad);
    return we * Math.cos(headingRad) + wn * Math.sin(headingRad);
  }

  // Tyre grip factor from track temperature. Assumption, not a measured curve: grip peaks
  // near tOpt and falls off quadratically (a per 10 °C squared). Calibrated values may replace it.
  function gripFromTrackTemp(trackTempC, { tOpt = 35, a = 0.005, floor = 0.9 } = {}) {
    if (!Number.isFinite(trackTempC)) return 1;
    const x = (trackTempC - tOpt) / 10;
    return Math.max(floor, 1 - a * x * x);
  }

  // ICE power factor from intake air. Turbocharged engines recover most of the density loss,
  // so power follows density only weakly: (ρ/ρref)^beta. beta is a calibration value.
  function icePowerFactor(rho, { beta = 0.15, rhoRef = RHO_REF } = {}) {
    return Math.pow(rho / rhoRef, beta);
  }

  // One call that turns session weather into simulator conditions.
  function conditionsFromWeather(w = {}, opts = {}) {
    const pressureHpa = Number.isFinite(w.pressureHpa) ? w.pressureHpa
      : Number.isFinite(w.altitudeM) ? pressureFromAltitude(w.altitudeM) : 1013.25;
    const tempC = Number.isFinite(w.airTempC) ? w.airTempC : 25;
    const rho = airDensity({ pressureHpa, tempC, humidityPct: Number.isFinite(w.humidityPct) ? w.humidityPct : 50 });
    return {
      rho,
      windSpeed: Number.isFinite(w.windSpeed) ? w.windSpeed : 0,
      windFromDeg: Number.isFinite(w.windFromDeg) ? w.windFromDeg : 0,
      grip: gripFromTrackTemp(w.trackTempC, opts.grip),
      iceFactor: icePowerFactor(rho, opts.ice),
      // per-event ERS recharge limit (2026+ rules), MJ per lap
      rechargeMax: Number.isFinite(w.rechargeMJ) ? w.rechargeMJ * 1e6 : undefined,
      clipMax: Number.isFinite(w.clipKW) ? w.clipKW * 1e3 : undefined,
      inputs: { pressureHpa, tempC, humidityPct: w.humidityPct ?? 50, trackTempC: w.trackTempC ?? null },
    };
  }

  // Kongboda quasi-steady-state lap simulator.
  // Point-mass car on a fixed racing line: tyre friction ellipse with load sensitivity,
  // downforce and drag on the air-relative speed (wind), rear-axle traction, ICE + ERS-K
  // power with the regulation speed taper and a per-lap energy budget, and active aero
  // (2026 Straight Mode) or DRS zones. The method follows the forward/backward approach of
  // TUM's laptime-simulation (Heilmeier et al.); the code is written for this site.
  // All inputs are plain numbers/arrays so it runs in Node and in the browser.

  const G = 9.81;

  // ERS-K DC power limit (W) as a function of speed (m/s) for each rule set.
  // 2026–2028: Section C, Article C5.2.7/C5.2.8i (Overtake not active). Issue 21, 19 Oct 2026.
  // 2027/2028 cap the deploy power at 300 kW (WMSC, June 2026); the speed taper is unchanged.
  function erskLimitW(rule, v, pMax) {
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
      muXTrac: car.muXTrac ?? car.muX, inertia: car.inertiaFactor ?? 1.0, awdAbove: car.awdAboveKph != null ? car.awdAboveKph / 3.6 : null,
      axle: !!car.axle, q: car.loadExp ?? 0.85, hOverTw: h / (car.trackWidth ?? 1.6), rollFront: car.rollFront ?? 0.5,
    };
  }

  // Total lateral force capacity (N) with linear load sensitivity per tyre.
  function capacity(mu0, dmu, fz0, normal) {
    const fzT = normal / 4;
    const mu = Math.max(0.3, mu0 + dmu * (fzT - fz0));
    return mu * normal;
  }

  // Axle model (car.axle): lateral capacity limited by the weaker axle. Loads per axle from static
  // weight + aero balance (rearAero) + vertical curvature share; lateral load transfer m·ay·h/tw split by
  // roll-stiffness share (rollFront); each tyre Fy = mu0·fz0·(Fz/fz0)^q (q < 1: degressive, Pacejka-like).
  // The lateral force each axle must give follows the mass distribution: Fy_r = m·ay·rearWeight.
  // Returns the largest total lateral force (N) both axles can carry, so it is used like capacity().
  function axleLateral(t, mu0, Nf, Nr, ay) {
    const tyre = fz => fz <= 0 ? 0 : mu0 * t.fz0 * Math.pow(fz / t.fz0, t.q);
    const dF = t.m * Math.abs(ay) * t.hOverTw;
    const pair = (Nax, d) => tyre(Nax / 2 + d) + tyre(Nax / 2 - d);
    const cf = pair(Nf, dF * t.rollFront), cr = pair(Nr, dF * (1 - t.rollFront));
    return Math.min(cf / (1 - t.rearStatic), cr / t.rearStatic);
  }
  // Same tyre law for the friction available in x on all four (or two driven) tyres, no transfer
  function tyreSum(t, mu0, N, nTyres = 4) { return nTyres * (N <= 0 ? 0 : mu0 * t.fz0 * Math.pow(N / nTyres / t.fz0, t.q)); }

  function simulateLap(track, car, env = {}, opts = {}) {
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
    // Vertical curvature (1/m, + = dip/compression, − = crest): adds m·v²·kv to the normal load
    const kv = track.kv || null;
    // Banking (rad, tilted towards the corner centre): part of gravity holds the car in the corner and the
    // centripetal force adds load. bankLat(v, i): lateral force still needed from the tyres; bankN: extra load.
    const bank = track.bank || null;
    const bankLat = (v, i) => { const ay = v * v * Math.abs(track.kappa[i]); if (!bank || !bank[i]) return t.m * ay; const c = Math.cos(bank[i]), s = Math.sin(bank[i]); return Math.max(0, t.m * (ay * c - G * s)); };
    const bankN = (v, i) => { if (!bank || !bank[i]) return 0; const ay = v * v * Math.abs(track.kappa[i]), c = Math.cos(bank[i]), s = Math.sin(bank[i]); return mg * cosG[i] * (c - 1) + t.m * ay * s; };
    const normalAt = (v, i, L) => Math.max(0.1 * mg, mg * cosG[i] + L + (kv ? t.m * v * v * kv[i] : 0) + (bank ? bankN(v, i) : 0));
    // Lateral capacity (N) at speed v on point i with aero load L (axle model or point mass)
    const latCap = (v, i, L) => {
      const N = normalAt(v, i, L);
      if (!t.axle) return capacity(t.muY0, t.dmu, t.fz0, N);
      const W = N - L; // weight part (incl. grade and vertical curvature)
      return axleLateral(t, t.muY0, W * (1 - t.rearStatic) + L * (1 - t.rearAero), W * t.rearStatic + L * t.rearAero, v * v * Math.abs(track.kappa[i]));
    };
    const pureCap = (i, N) => t.axle ? tyreSum(t, t.muY0, N) : capacity(t.muY0, t.dmu, t.fz0, N);
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
        const va = vAir(v, i), L = aeroFactor * cl * va * va;
        return m * latCap(v, i, L) - (bank ? bankLat(v, i) : t.m * v * v * kap);
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
      const ay = bank ? bankLat(v, i) / t.m : v * v * kap;
      const va = vAir(v, i), L = aeroFactor * car.clA * va * va;
      const ayMax = muAt(i) * latCap(v, i, L) / t.m;
      const r = Math.min(1, ay / ayMax);
      return Math.pow(Math.max(0, 1 - Math.pow(r, k)), 1 / k);
    };

    // 2) Backward pass (braking): independent of the ERS strategy, so computed once.
    //    Straight Mode is closed under braking: corner-mode aero.
    const brakeAcc = (v, i) => {
      const va = vAir(v, i), L = aeroFactor * car.clA * va * va, N = normalAt(v, i, L);
      const fx = muAt(i) * (t.muX0 / t.muY0) * pureCap(i, N) * ellipse(v, i);
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
    const fwd = new Float64Array(n), ersUsed = new Float64Array(n), powerLimited = new Uint8Array(n), harv = new Float64Array(n);
    // 2026+ rules: the MGU-K also recharges on throttle. Free where traction, not power, limits the car
    // (spare ICE power), and by "super-clipping" (harvesting at full throttle above vH, which costs speed).
    const throttleHarvest = ers.rule === 'f1-2026' && ers.throttleHarvest !== false;
    const clipMax = env.clipMax ?? ers.clipMax ?? 350e3, etaRegen = ers.etaRegen ?? 0.9;
    // 2026+ F1: the battery is tracked point by point on the final pass (qualifying lap from a full
    // battery): no deploy when it is empty, recovery stops at the per-lap recharge limit, and charge above
    // the usable window is lost. Earlier passes only warm up the speed profile.
    const causal = ers.rule === 'f1-2026' && ers.causalSoc !== false;
    const socMax = ers.socWindow ?? 4e6, recMax = env.rechargeMax ?? ers.rechargeMax ?? 8.5e6;
    const forward = (vCut, vH = Infinity) => {
      const v = fwd;
      v[iMin] = Math.min(vLat[iMin], vBack[iMin]);
      let soc = socMax, got = 0;
      for (let pass = 0; pass < 2; pass++) {
        const track = causal && pass === 1, start = track ? 0 : iMin;
        for (let c = 0; c < n; c++) {
          const i = (start + c) % n, j = (i + 1) % n;
          const vi = Math.max(v[i], 1);
          const low = lowAt(i);
          const va = vAir(vi, i), L = aeroFactor * clAt(i, low) * va * va, N = normalAt(vi, i, L);
          const pErs = vi < vCut && (!track || soc > 0) ? erskLimitW(ers.rule, vi, ers.pMax || 0) : 0;
          const fPow = (pIce * etaD + pErs * etaK * etaD) / vi;
          const nRear = t.rearStatic * (kv ? N - L : mg * cosG[i]) + t.rearAero * L;
          const muX = muAt(i) * (t.muXTrac / t.muY0) * pureCap(i, N) / N;
          // LMH hybrids also drive the front axle above a set speed (awdAboveKph): all four tyres
          const awd = t.awdAbove != null && vi > t.awdAbove;
          const fTrac = (awd ? muX * N : muX * nRear / Math.max(0.2, 1 - muX * t.hOverWb)) * ellipse(vi, i);
          let fDrive = Math.min(fPow, fTrac);
          powerLimited[i] = fPow <= fTrac ? 1 : 0;
          harv[i] = 0;
          if (throttleHarvest) {
            const spare = pIce * etaD - fDrive * vi; // W at the wheels the ICE could still give
            if (spare > 0) harv[i] = Math.min(clipMax, spare / etaD) * etaRegen;
            else if (pErs === 0 && vi > vH) { const pc = Math.min(clipMax, pIce); fDrive -= pc * etaD / vi; harv[i] = pc * etaRegen; }
          }
          // DC power the ERS-K actually supplies: whatever the ICE cannot, up to its limit
          ersUsed[i] = pErs > 0 ? Math.min(pErs, Math.max(0, fDrive * vi - pIce * etaD) / (etaK * etaD)) : 0;
          // Hypercar hybrids (LMH front axle, LMDh rear axle): the BoP caps total power, so the motor
          // replaces engine power rather than adding to it; it can only drive above its deploy speed
          if (ers.rule === 'hypercar') ersUsed[i] = vi > (ers.deployFrom || 0) && vi < vCut ? Math.min(ers.eMax || 0, fDrive * vi / etaD) : 0;
          const drag = aeroFactor * cdAt(i, low) * va * va, roll = cRoll * N;
          const a = (fDrive - drag - roll) / (t.m * t.inertia) - G * sinG[i];
          const vn = Math.sqrt(Math.max(1, vi * vi + 2 * a * ds));
          v[j] = Math.min(vn, vLat[j], vMaxCar, vBack[j]);
          if (track) {
            // same energy terms as account(): deploy while accelerating, throttle harvest, braking regen
            const vm = 0.5 * (vi + v[j]), dt = ds / Math.max(vm, 1);
            let rec = v[j] >= vi - 1e-6 ? harv[i] * dt : 0;
            if (v[j] < vi - 1e-6 && ers.regenMax) rec += Math.min(ers.regenMax, (ers.regenShare ?? 0.6) * t.m * (vi * vi - v[j] * v[j]) / (2 * ds) * vm * etaRegen) * dt;
            rec = Math.max(0, Math.min(rec, recMax - got)); got += rec;
            if (v[j] > vi + 1e-6) { const use = Math.min(ersUsed[i] * dt, Math.max(0, soc)); if (use < ersUsed[i] * dt) ersUsed[i] = use / dt; soc -= use; }
            else ersUsed[i] = 0;
            soc = Math.min(socMax, soc + rec);
          }
        }
      }
      return v;
    };

    // Energy accounting on the final profile
    const account = (v) => {
      let eDeploy = 0, eRegen = 0, eHarv = 0, time = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, vm = 0.5 * (v[i] + v[j]), dt = ds / Math.max(vm, 1);
        time += dt;
        if (throttleHarvest && v[j] >= v[i] - 1e-6) eHarv += harv[i] * dt;
        if (v[j] > v[i] + 1e-6) eDeploy += ersUsed[i] * dt;
        if (v[j] < v[i] - 1e-6 && ers.regenMax) {
          // braking power at the wheels; the rear axle share can be recovered by the MGU-K
          const pBrake = t.m * (v[i] * v[i] - v[j] * v[j]) / (2 * ds) * vm;
          eRegen += Math.min(ers.regenMax, (ers.regenShare ?? 0.6) * pBrake * (ers.etaRegen ?? 0.9)) * dt; // regenMax is a DC limit
        }
      }
      return {eDeploy, eRegen: eRegen + eHarv, eBrake: eRegen, eHarv, time};
    };

    // 4) Choose the deployment cut-off speed so the lap stays inside the energy budget.
    //    Deploying at lower speed gains more time per joule, so a speed threshold is a good
    //    approximation of the optimal allocation.
    const budget = (eRegen) => {
      // Hypercar: charge-sustaining over a lap (energy recovered on braking plus a small battery window)
      if (ers.rule === 'hypercar') return eRegen + (ers.socWindow ?? 0.5e6);
      if (!ers.pMax) return 0;
      if (ers.rule === 'f1-2026') return (ers.socWindow ?? 4e6) + Math.min(eRegen, env.rechargeMax ?? ers.rechargeMax ?? 8.5e6);
      return ers.deployMax ?? 4e6;
    };
    const fitCut = (vH, fixedBudget) => {
      let lo = 5, hi = vMaxCar + 1;
      for (let it = 0; it < 20; it++) {
        const mid = 0.5 * (lo + hi), a = account(forward(mid, vH));
        if (a.eDeploy > (fixedBudget ?? budget(a.eRegen))) hi = mid; else lo = mid;
      }
      return lo;
    };
    let vCut = vMaxCar + 1, vH = Infinity, v = forward(vCut), acc = account(v);
    if ((ers.pMax || ers.rule === 'hypercar') && acc.eDeploy > budget(acc.eRegen)) {
      vCut = fitCut(Infinity); v = forward(vCut); acc = account(v);
      // super-clipping: if the lap is short of the recharge limit, harvest at full throttle at the top of
      // the straights (above vH) and spend the energy lower down, when that is faster
      const limit = env.rechargeMax ?? ers.rechargeMax ?? 8.5e6, soc = ers.socWindow ?? 4e6;
      if (throttleHarvest && acc.eRegen < limit - 1e4) {
        const tA = acc.time, cutB = fitCut(Infinity, soc + limit);
        let lo = 5, hi = vMaxCar + 1;
        for (let it = 0; it < 20; it++) {
          const mid = 0.5 * (lo + hi), a = account(forward(cutB, mid));
          if (a.eDeploy > budget(a.eRegen)) hi = mid; else lo = mid;
        }
        const vB = lo, vb = forward(cutB, vB), b = account(vb);
        if (b.eDeploy <= budget(b.eRegen) + 1e3 && b.time < tA) { vCut = cutB; vH = vB; acc = b; v = vb; }
        else { v = forward(vCut); acc = account(v); }
      }
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
    // energy flow per point (J), same accounting as account(): deployed, recovered under braking and at
    // full throttle (2026 F1 super-clipping); the page builds the battery estimate from it
    let flow = null;
    if (ers.pMax || ers.rule === 'hypercar') {
      const dep = new Array(n).fill(0), brk = new Array(n).fill(0), thr = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, vm = 0.5 * (v[i] + v[j]), dt = ds / Math.max(vm, 1);
        if (throttleHarvest && v[j] >= v[i] - 1e-6) thr[i] = harv[i] * dt;
        if (v[j] > v[i] + 1e-6) dep[i] = ersUsed[i] * dt;
        if (v[j] < v[i] - 1e-6 && ers.regenMax) brk[i] = Math.min(ers.regenMax, (ers.regenShare ?? 0.6) * t.m * (v[i] * v[i] - v[j] * v[j]) / (2 * ds) * vm * (ers.etaRegen ?? 0.9)) * dt;
      }
      flow = {dep, brk, thr, soc: ers.socWindow ?? (ers.rule === 'hypercar' ? 0.5e6 : 4e6), recharge: ers.rule === 'f1-2026' ? env.rechargeMax ?? ers.rechargeMax ?? 8.5e6 : null, rule: ers.rule || 'ers'};
    }
    const sec = track.sectors ? track.sectors.map(sv => Math.round(sv / ds)) : null;
    const sectors = sec ? [time[sec[0]], time[sec[1]] - time[sec[0]], time[n] - time[sec[1]]] : null;
    return {
      lapTime: time[n], sectors, v: Array.from(v), time: Array.from(time.subarray(0, n)), limit: Array.from(limit),
      energy: {deployJ: acc.eDeploy, regenJ: acc.eRegen, budgetJ: budget(acc.eRegen), rechargeMaxJ: ers.rule === 'f1-2026' ? env.rechargeMax ?? ers.rechargeMax ?? 8.5e6 : null, throttleHarvestJ: acc.eHarv ?? 0, clipFromKph: Number.isFinite(vH) ? vH * 3.6 : null, cutoffKph: vCut > vMaxCar ? null : vCut * 3.6},
      vMaxKph: Math.max(...v) * 3.6, vMinKph: Math.min(...v) * 3.6, flow,
    };
  }

  // Track helpers: build a simulator track object from stored geometry and find straights.

  // Mark long, nearly straight runs as active-aero (Straight Mode) or DRS zones when the FIA
  // zone list is not available. kappaMax: maximum |curvature| (1/m) still counted as straight.
  function autoStraights(kappa, ds, {kappaMax = 1 / 700, minLength = 250, startOffset = 60} = {}) {
    const n = kappa.length, low = new Uint8Array(n);
    const straight = i => Math.abs(kappa[(i + n) % n]) < kappaMax;
    // find a corner to start from so runs that wrap around the start line are handled
    let s0 = 0; while (s0 < n && straight(s0)) s0++;
    if (s0 >= n) return low.fill(1);
    let i = 0;
    while (i < n) {
      const a = (s0 + i) % n;
      if (!straight(a)) { i++; continue; }
      let len = 0; while (len < n && straight(s0 + i + len)) len++;
      if (len * ds >= minLength) {
        const skip = Math.round(startOffset / ds);
        for (let k = skip; k < len; k++) low[(s0 + i + k) % n] = 1;
      }
      i += len;
    }
    return low;
  }

  // Decode a stored track (see scripts/sim/build-tracks.mjs) into typed arrays.
  // Stored arrays are integers: kappa ×1e5 (1/m), grade ×1e4 (rad), heading ×1e3 (rad).
  function trackFromData(d, {aero = 'auto'} = {}) {
    const kappa = Float64Array.from(d.kappa, v => v / 1e5);
    const n = kappa.length;
    const track = {
      id: d.id, name: d.name, ds: d.ds, kappa,
      grade: d.grade ? Float64Array.from(d.grade, v => v / 1e4) : null,
      heading: d.heading ? Float64Array.from(d.heading, v => v / 1e3) : null,
      mu: new Float64Array(n).fill(1), vScale: new Float64Array(n).fill(1),
      sectors: d.sectors || null, corners: d.corners || [],
    };
    if (aero === 'auto' || !d.aeroZones?.length) track.aeroLow = autoStraights(kappa, d.ds);
    else {
      const low = new Uint8Array(n);
      for (const [a, b] of d.aeroZones) for (let s = a; ; s += d.ds) {
        const i = Math.round((((s % (n * d.ds)) + n * d.ds) % (n * d.ds)) / d.ds) % n;
        low[i] = 1;
        if (b >= a ? s >= b : s >= b + n * d.ds) break;
      }
      track.aeroLow = low;
    }
    return track;
  }

  // Default scenario factors. Kept small and explicit; the page shows them next to each change.
  const CHANGE_EFFECTS = {
    resurfacing: {kind: 'grip', factor: 1.02, ko: '새 노면: 그립 +2% 가정', en: 'New surface: +2% grip assumed'},
    bump_removal: {kind: 'grip', factor: 1.01, ko: '범프 제거: 그립 +1% 가정', en: 'Bump removed: +1% grip assumed'},
    kerb_lowered: {kind: 'cornerSpeed', factor: 1.005, ko: '연석 낮춤: 코너 속도 +0.5% 가정', en: 'Lower kerb: +0.5% corner speed assumed'},
    kerb_raised: {kind: 'cornerSpeed', factor: 0.995, ko: '연석 높임·추가: 코너 속도 −0.5% 가정', en: 'Higher or added kerb: −0.5% corner speed assumed'},
  };

  // Distance window (m) along the lap for a corner reference, from corner apex distances.
  const PART_WINDOW = {approach: [-250, -30], entry: [-90, -10], apex: [-30, 30], exit: [10, 90], after: [30, 200], null: [-80, 80]};
  function windowFor(ref, corners) {
    const c = corners.find(x => x.number === ref.turn && (x.letter || '') === (ref.letter || ''))
      || corners.find(x => x.number === ref.turn);
    if (!c) return null;
    const w = PART_WINDOW[ref.part] || PART_WINDOW.null;
    return [c.s + w[0], c.s + w[1]];
  }

  // Apply parsed changes to a track (mu / vScale arrays). corners: [{number, letter, s}] with s in metres.
  // strength scales every scenario effect (0 = ignore, 1 = default, 2 = double).
  function applyTrackChanges(track, changes, corners, {strength = 1} = {}) {
    const n = track.kappa.length, L = n * track.ds;
    const mu = Float64Array.from(track.mu || new Float64Array(n).fill(1));
    const vScale = Float64Array.from(track.vScale || new Float64Array(n).fill(1));
    const applied = [];
    for (const ch of changes) {
      if (!ch.affectsLap || !ch.effect || !corners?.length) continue;
      // spans in metres: one stretch (from..to), one corner, or several separate corners (list)
      const spans = [];
      if (ch.range.list) for (const r of ch.range.list) { const w = windowFor(r, corners); if (w) spans.push(w); }
      else {
        const a = windowFor(ch.range.from, corners), b = windowFor(ch.range.to, corners);
        if (a && b) {
          let s1 = ch.range.single ? a[1] : b[1];
          if (ch.range.from.part === 'entry' && ch.range.to.part === 'entry' && !ch.range.single) s1 = b[0];
          spans.push([a[0], s1]);
        }
      }
      if (!spans.length) { applied.push({...ch, applied: false, reason: 'corner not found'}); continue; }
      const factor = 1 + (ch.effect.factor - 1) * strength;
      const target = ch.effect.kind === 'grip' ? mu : vScale;
      const hit = new Uint8Array(n);
      for (const [a0, a1] of spans) {
        const s0 = ((a0 % L) + L) % L, s1 = ((a1 % L) + L) % L;
        for (let i = 0; i < n; i++) { const s = i * track.ds; if (s0 <= s1 ? (s >= s0 && s <= s1) : (s >= s0 || s <= s1)) hit[i] = 1; }
      }
      let count = 0;
      for (let i = 0; i < n; i++) if (hit[i]) { target[i] *= factor; count++; }
      const norm = x => ((x % L) + L) % L;
      applied.push({...ch, applied: count > 0, sStart: norm(spans[0][0]), sEnd: norm(spans[spans.length - 1][1]), spans: spans.map(([a0, a1]) => [norm(a0), norm(a1)]), points: count, factor});
    }
    return {track: {...track, mu, vScale}, applied};
  }

  return {
    RD, RV, RHO_REF, saturationVapourPressure, pressureFromAltitude, airDensity, tailwind, gripFromTrackTemp, icePowerFactor, conditionsFromWeather,
    erskLimitW, makeTyre, capacity, simulateLap,
    autoStraights, trackFromData,
    CHANGE_EFFECTS, PART_WINDOW, windowFor, applyTrackChanges,
  };
}
