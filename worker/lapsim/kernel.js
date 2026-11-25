// Self-contained lap simulator kernel. Everything the browser needs lives inside one function,
// so it can be shipped as source text (lapsimKernel.toString()) without depending on module
// names after bundling. Node modules re-export from the same instance.
// Engine power at road speed from a torque or power curve and the gear ratios (bug report 2026-11-15: the kernel took neither).
// car.engine = {rpm: [...], Nm: [...]} or {rpm, kW: [...]} or {rpm, frac: [...]} (share of car.pIce); rpmMax (default: last rpm).
// car.gears = overall or gearbox ratios, car.finalDrive (default 1), car.tyreRadius (m, rolling). Shifts are seamless; the best gear
// is used. Below the first curve point the torque of that point holds (clutch). The result never exceeds car.pIce (regulation or BoP cap).
export function powertrain(car, iceFactor = 1) {
  const cap = car.pIce * iceFactor, e = car.engine, g = car.gears;
  if (!e || !e.rpm?.length || !g?.length) return () => cap;
  const rpm = e.rpm, P = e.kW ? e.kW.map(x => x * 1e3) : e.Nm ? e.Nm.map((T, i) => T * rpm[i] * 2 * Math.PI / 60) : e.frac.map(f => f * car.pIce);
  const rpmMax = e.rpmMax ?? rpm.at(-1), k = (car.finalDrive ?? 1) * 60 / (2 * Math.PI * (car.tyreRadius ?? 0.35)), n = rpm.length;
  const at = x => { if (x <= rpm[0]) return P[0] * x / rpm[0]; for (let j = 1; j < n; j++) if (x <= rpm[j]) return P[j - 1] + (P[j] - P[j - 1]) * (x - rpm[j - 1]) / (rpm[j] - rpm[j - 1]); return P[n - 1]; };
  return v => { let best = 0; for (const r of g) { const x = v * r * k; if (x > rpmMax * 1.0001) continue; const p = at(x); if (p > best) best = p; } return Math.min(cap, best * iceFactor); };
}

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
  // Weather guard (central 2026-11-25 18:30): an empty or non-numeric cell is missing (the default below), never 0. A finite pressure
  // outside 500-1100 hPa is a reading error (an empty CSV cell read as 0 gave 0 hPa: no air, no power) and stops the caller; a fit that
  // needs a measured pressure passes opts.requirePressure and stops when it is missing.
  function conditionsFromWeather(w = {}, opts = {}) {
    if (Number.isFinite(w.pressureHpa) && (w.pressureHpa < 500 || w.pressureHpa > 1100)) throw new Error(`pressureHpa ${w.pressureHpa} is not a pressure (500-1100 hPa): an empty cell read as a number?`);
    if (opts.requirePressure && !Number.isFinite(w.pressureHpa)) throw new Error('pressureHpa missing: this fit needs the measured pressure');
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
      rechargeMax: Number.isFinite(w.rechargeMJ) ? w.rechargeMJ * 1e6 : undefined, puRamp: w.puRamp || undefined, // C5.12 shape (ramp inside forward())
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
  // knots (flag LAPSIM_EVENT_ENERGY, off by default; event-energy.js): the event's printed curve {std, ot} as [[kph, kW], ...], full power
  // below the first knot, linear between knots, the last value above (2026 Monaco/Singapore "Rev 1")
  function erskLimitW(rule, v, pMax, ot, knots) {
    const kph = v * 3.6;
    if (rule === 'f1-2026' && knots) { const k = ot ? knots.ot : knots.std; let p = k[0][1];
      for (let j = 1; j < k.length; j++) if (kph > k[j - 1][0]) p = kph >= k[j][0] ? k[j][1] : k[j - 1][1] + (k[j][1] - k[j - 1][1]) * (kph - k[j - 1][0]) / (k[j][0] - k[j - 1][0]);
      return Math.max(0, Math.min(pMax / 1000, p)) * 1000; }
    // C5.2.8 ii (Overtake active): 7100 - 20 * kph below 355 kph, under the 350 kW cap of C5.2.7
    if (rule === 'f1-2026' && ot) return Math.max(0, Math.min(pMax / 1000, kph < 355 ? 7100 - 20 * kph : 0)) * 1000;
    if (rule === 'f1-2026') {
      let p;
      if (kph < 340) p = 1800 - 5 * kph;
      else if (kph < 345) p = 6900 - 20 * kph;
      else p = 0;
      return Math.max(0, Math.min(pMax / 1000, p)) * 1000;
    }
    return pMax; // 2014–2025 rules: no speed taper, only the power cap
  }

  // car.lateralCap → a_y(v) in m/s², v in m/s: 'quad' a0 + k·v²; 'table' PCHIP (Fritsch–Carlson) through (kph, ay), flat outside
  function lateralCapFn(c) {
    if (c.kind !== 'table') return v => c.a0 + c.k * v * v;
    const x = c.kph.map(k => k / 3.6), y = c.ay, n = x.length, h = [], d = [], m = new Array(n).fill(0);
    for (let j = 0; j < n - 1; j++) { h[j] = x[j + 1] - x[j]; d[j] = (y[j + 1] - y[j]) / h[j]; }
    if (n > 1) { m[0] = d[0]; m[n - 1] = d[n - 2]; }
    for (let j = 1; j < n - 1; j++) m[j] = d[j - 1] * d[j] <= 0 ? 0 : 3 * (h[j - 1] + h[j]) / ((2 * h[j] + h[j - 1]) / d[j - 1] + (h[j] + 2 * h[j - 1]) / d[j]);
    return v => {
      if (n === 1 || v <= x[0]) return y[0]; if (v >= x[n - 1]) return y[n - 1];
      let j = 0; while (v > x[j + 1]) j++;
      const s = (v - x[j]) / h[j], s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * y[j] + (s3 - 2 * s2 + s) * h[j] * m[j] + (-2 * s3 + 3 * s2) * y[j + 1] + (s3 - s2) * h[j] * m[j + 1];
    };
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

  // C5.12.4–7 (2026+, owner 2026-11-16): when the battery runs out on a straight the power demand may drop by at most 150 kW at once (more in
  // the FIA's listed sectors), held 1 s, then by at most 100 kW/s (50 kW/s where the power-limited distance exceeds 3500 m) while the
  // ERS-K gives more than 100 kW, above 210 km/h (or the sector's threshold). The lap is run once, every sudden cut is replaced by that
  // shape starting early enough to use the same energy, and the lap is run again with that ERS-K ceiling.
  // Same inputs, same lap: a page view asks for the same lap several times (about half the calls).
  // The key holds every track field simulateLap reads, so a hit is the exact same result; callers get a copy (they scale times in place).
  // least recently used first out (owner 2026-11-18: one 2027 view needs 68 laps, so a 64-lap first-in-first-out cache forgot the car
  // switched away from); at most 600 laps or about 96 MB of their arrays
  const lapCache = new Map(), LAP_CACHE_MAX = 600, LAP_CACHE_BYTES = 96e6; let lapBytes = 0;
  const lapSize = r => { let b = 1e3; for (const x of Object.values(r)) b += ArrayBuffer.isView(x) ? x.byteLength : Array.isArray(x) ? 8 * x.length : 0; return b; };
  const lapKey = (track, car, env, opts) => JSON.stringify([track.kappa, track.ds, track.mu, track.vScale, track.aeroLow, track.grade, track.heading, track.otOn, track.ersCap, track.kv, track.bank, track.sectors, car, env, opts],
    (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v === undefined ? '__u' : v);
  // Plug-in hooks (docs/lapsim-hooks.md): env.gripHook, env.windAt, car.ers.law. Unset = today's lap, byte for byte. Functions do not
  // survive the cache key, so a lap with a hook is never cached. env.hookPasses (default 1): with more, the lap is run again and the
  // hooks see the previous run's speed and time (state.v, state.t).
  const hooked = (car, env) => !!(env.gripHook || env.windAt || (car.ers?.law && typeof car.ers.law === 'object'));
  function simulateLap(track, car, env = {}, opts = {}) {
    if (hooked(car, env)) { let r = null; for (let p = 0; p < Math.max(1, env.hookPasses || 1); p++) r = simulateLapRaw(track, car, env, opts, r); return r; }
    const key = lapKey(track, car, env, opts), hit = lapCache.get(key);
    if (hit) { lapCache.delete(key); lapCache.set(key, hit); return structuredClone(hit.r); }
    const r = simulateLapRaw(track, car, env, opts), e = {r: structuredClone(r), b: lapSize(r)};
    lapCache.set(key, e); lapBytes += e.b;
    for (const [k, x] of lapCache) { if ((lapCache.size <= LAP_CACHE_MAX && lapBytes <= LAP_CACHE_BYTES) || k === key) break; lapCache.delete(k); lapBytes -= x.b; }
    return r;
  }
  // Kernel step (pre-registration claude/gate-kernel-step1-prereg-2026-11-23.md): 1 = one explicit step per point (today);
  // 2 = Heun on v², substeps where the rate changes fast, event points inside a step, exact per-step energy and time account.
  // opts.kernelStep, else env LAPSIM_KERNEL_STEP (Node), else 2 (step-1 gate attempt 2 passed, 2026-11-23). With exact accounting the
  // 2026 cut-off / super-clip search starts only for cars with car.ers.law = 'b' (strategy B, step 10b).
  const STEP_DEFAULT = 2, stepOf = opts => opts.kernelStep ?? (+(globalThis.process?.env?.LAPSIM_KERNEL_STEP) || STEP_DEFAULT);
  function simulateLapRaw(track, car, env = {}, opts = {}, prev = null) {
    const n = track.kappa.length, ds = track.ds, STEP = stepOf(opts);
    const rho = env.rho ?? RHO_REF;
    const grip = env.grip ?? 1;
    const iceFactor = env.iceFactor ?? 1;
    const windSpeed = env.windSpeed ?? 0, windFrom = env.windFromDeg ?? 0;
    const t = makeTyre(car);
    const mg = t.m * G;
    const mu = track.mu, vScale = track.vScale, aeroLow = track.aeroLow, grade = track.grade, heading = track.heading, otOn = track.otOn, ersCap = track.ersCap || null; // true (whole lap) or a per-point array: where the driver uses Overtake
    const etaD = car.etaDrive ?? 0.96, etaK = car.etaErs ?? 0.95;
    const pIce = car.pIce * iceFactor, pAt = powertrain(car, iceFactor); // pAt(v): engine power at road speed v (torque curve and gears; flat pIce without them)
    const ers = car.ers || {pMax: 0};
    const pr = env.puRamp && ers.rule === 'f1-2026' ? env.puRamp : null, inZ = (list, x) => (list || []).find(z => z.to >= z.from ? x >= z.from && x <= z.to : x >= z.from || x <= z.to);
    // HOLD_MIN 100 kW: a step that already reaches 100 kW may drop at once. C5.12.4 read strictly also holds steps below 100 kW for 1 s
    // (HOLD_MIN 0); that variant waits for its own Gate G test (claude/release/c512-hold-wip-2026-11-21.patch)
    const ramp = pr ? {R: (pr.rateKWs || 100) * 1e3} : null, HOLD_MIN = 100e3;
    const rampStep = i => { const b = inZ(pr.bigCut, i * track.ds); return b ? (b.maxKW || 350) * 1e3 : 150e3; };
    const rampVMin = i => { const z = inZ(pr.speed, i * track.ds); return (z ? z.kph : 210) / 3.6; };
    const vMaxCar = car.vMax ?? 110;
    const cRoll = car.cRoll ?? 0.012;
    const k = Math.max(1, car.frictionExp ?? 2);
    const aeroFactor = 0.5 * rho;

    // Per-point constants
    // every per-point array has one more slot, n: a point inside a step (step 2 substeps, virt())
    const N1 = n + 1, tail = new Float64Array(N1), sinG = new Float64Array(N1), cosG = new Float64Array(N1);
    const kapX = new Float64Array(N1); kapX.set(track.kappa);
    // hooks: env.windAt(s, t) → {speed m/s, fromDeg} replaces the session wind; env.gripHook(i, state) → grip multiplier per point
    const hs = i => ({s: i * ds, ds, n, v: prev ? prev.v[i] : null, t: prev ? prev.time[i] : null});
    const windAt = env.windAt, gh = env.gripHook ? Float64Array.from({length: n}, (_, i) => env.gripHook(i, hs(i))) : null;
    // car.ers.law = 'b' (data, step 10b, claude/gate-ers-law-prereg-2026-11-23.md §9): regen from the tyres' braking force above drag and
    // rolling resistance, P = min(regenMax, share·max(0, m·a − D − R)·v·η) (corner-mode aero); 2014–25 deploy at every full-throttle
    // point (the lap budget does not bind, budget()); causal 2026 laps always search a cut-off / super-clip plan (strategy B).
    // Same law as worker/lapsim/ers-law.js ersLaw(); a function object in car.ers.law is the plug-in hook (docs/lapsim-hooks.md).
    const lawB = car.ers?.law === 'b';
    const law = lawB ? (car.ers.regenMax ? {regen: c => { if (!(c.pBrake > 0) || !(c.v > 0)) return 0;
      const f = c.pBrake / c.v - (aeroFactor * car.cdA * c.v * c.v + cRoll * (mg + aeroFactor * car.clA * c.v * c.v));
      return Math.min(c.regenMax, c.share * Math.max(0, f) * c.v * c.eta); }} : null) : (car.ers?.law || null);
    for (let i = 0; i < n; i++) {
      if (windAt) { const w = windAt(i * ds, prev ? prev.time[i] : null) || {}; tail[i] = heading ? tailwind(heading[i], w.speed || 0, w.fromDeg || 0) : 0; } else
      tail[i] = heading && windSpeed ? tailwind(heading[i], windSpeed, windFrom) : 0;
      const g = grade ? grade[i] : 0; sinG[i] = Math.sin(g); cosG[i] = Math.cos(g);
    }
    // Vertical curvature (1/m, + = dip/compression, − = crest): adds m·v²·kv to the normal load
    const kv = track.kv ? Float64Array.from({length: N1}, (_, i) => i < n ? track.kv[i] : 0) : null;
    // Banking (rad, tilted towards the corner centre): part of gravity holds the car in the corner and the
    // centripetal force adds load. bankLat(v, i): lateral force still needed from the tyres; bankN: extra load.
    const bank = track.bank ? Float64Array.from({length: N1}, (_, i) => i < n ? track.bank[i] : 0) : null;
    const bankLat = (v, i) => { const ay = v * v * Math.abs(kapX[i]); if (!bank || !bank[i]) return t.m * ay; const c = Math.cos(bank[i]), s = Math.sin(bank[i]); return Math.max(0, t.m * (ay * c - G * s)); };
    const bankN = (v, i) => { if (!bank || !bank[i]) return 0; const ay = v * v * Math.abs(kapX[i]), c = Math.cos(bank[i]), s = Math.sin(bank[i]); return mg * cosG[i] * (c - 1) + t.m * ay * s; };
    const normalAt = (v, i, L) => Math.max(0.1 * mg, mg * cosG[i] + L + (kv ? t.m * v * v * kv[i] : 0) + (bank ? bankN(v, i) : 0));
    // car.lateralCap (step 14a hand-off, claude/handoff-14a-to-10b-lateralcap-hook-2026-11-23.md; unset = today): measured lateral
    // capacity a_y(v) of the car at grip 1, as data — {kind: 'quad', a0 m/s², k 1/m} or {kind: 'table', kph: [...], ay: [...]} (PCHIP,
    // flat outside), rhoRef (kg/m³), braking (also the braking capacity). Speed is the air speed scaled to the density, ve = va·√(ρ/ρref);
    // the weight part keeps grade, vertical curvature and banking: F = m·(a_w·N_w/(m·g) + a_y(ve) − a_w), a_w = a_y(0). Still × grip.
    const lc = car.lateralCap || null, capAt = lc ? lateralCapFn(lc) : null, aW = lc ? capAt(0) : 0, rhoS = lc ? Math.sqrt(rho / (lc.rhoRef ?? 1.2)) : 1;
    const lcCap = (v, i, L) => t.m * (aW * (normalAt(v, i, L) - L) / mg + capAt(vAir(v, i) * rhoS) - aW);
    // Lateral capacity (N) at speed v on point i with aero load L (axle model or point mass)
    const latCap = (v, i, L) => {
      if (lc) return lcCap(v, i, L);
      const N = normalAt(v, i, L);
      if (!t.axle) return capacity(t.muY0, t.dmu, t.fz0, N);
      const W = N - L; // weight part (incl. grade and vertical curvature)
      return axleLateral(t, t.muY0, W * (1 - t.rearStatic) + L * (1 - t.rearAero), W * t.rearStatic + L * t.rearAero, v * v * Math.abs(kapX[i]));
    };
    const pureCap = (i, N) => t.axle ? tyreSum(t, t.muY0, N) : capacity(t.muY0, t.dmu, t.fz0, N);
    // aeroLow[i]: share of the low-drag change (1 = full activation; a fraction = partial activation, 2026 Low Grip zones, B7.1.2 b)
    const lowAt = i => aeroLow ? Math.min(1, Math.max(0, Number(aeroLow[i]) || 0)) : 0;
    const clAt = (i, low) => car.clA + low * ((car.clALow ?? car.clA) - car.clA);
    const cdAt = (i, low) => car.cdA + low * ((car.cdALow ?? car.cdA) - car.cdA);
    const muP = new Float64Array(N1); for (let i = 0; i < n; i++) muP[i] = gh ? grip * (mu ? mu[i] : 1) * gh[i] : grip * (mu ? mu[i] : 1);
    const muAt = i => muP[i];
    const vAir = (v, i) => Math.max(0, v - tail[i]);

    // 1) Lateral limit per point (aero in corner mode; the driver closes Straight Mode for corners)
    const vLat = new Float64Array(N1);
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
      const kap = Math.abs(kapX[i]);
      if (kap < 1e-6) return 1;
      const ay = bank ? bankLat(v, i) / t.m : v * v * kap;
      const va = vAir(v, i), L = aeroFactor * car.clA * va * va;
      const ayMax = muAt(i) * latCap(v, i, L) / t.m;
      const r = Math.min(1, ay / ayMax);
      return Math.pow(Math.max(0, 1 - Math.pow(r, k)), 1 / k);
    };

    // per-point values of the passes that do not depend on speed (step 1: forward(), worked out once with the same operations)
    const clF = new Float64Array(N1), cdF = new Float64Array(N1), muXF = new Float64Array(N1);
    for (let i = 0; i < n; i++) { const low = lowAt(i); clF[i] = clAt(i, low); cdF[i] = cdAt(i, low); muXF[i] = muAt(i) * (t.muXTrac / t.muY0); }
    // 2) Backward pass (braking): independent of the ERS strategy, so computed once.
    //    Straight Mode is closed under braking: corner-mode aero.
    const brakeAcc = (v, i) => {
      const va = vAir(v, i), L = aeroFactor * car.clA * va * va, N = normalAt(v, i, L);
      const fx = muAt(i) * (t.muX0 / t.muY0) * (lc?.braking ? latCap(v, i, L) : pureCap(i, N)) * ellipse(v, i);
      const drag = aeroFactor * car.cdA * va * va, roll = cRoll * N;
      let a = (fx + drag + roll) / t.m + G * sinG[i];
      if (car.brakeDecelMax) a = Math.min(a, car.brakeDecelMax);
      // speed-dependent peak deceleration [a0 m/s², a2 1/m]: a ≤ a0 + a2·v² (Hypercar: the iRacing GTP envelope, owner rule 14, "model"; unset = no cap)
      if (car.brakeEnv) a = Math.min(a, car.brakeEnv[0] + car.brakeEnv[1] * v * v);
      return a;
    };
    // step 2: the same friction ellipse with the aero load and normal load already worked out (corner-mode aero: L from car.clA)
    const ellN = (v, i, L, N) => {
      const kap = Math.abs(kapX[i]); if (kap < 1e-6) return 1;
      const ay = bank ? bankLat(v, i) / t.m : v * v * kap, W = N - L;
      const lcN = lc ? lcCap(v, i, L) : !t.axle ? capacity(t.muY0, t.dmu, t.fz0, N) : axleLateral(t, t.muY0, W * (1 - t.rearStatic) + L * (1 - t.rearAero), W * t.rearStatic + L * t.rearAero, v * v * kap);
      const r = Math.min(1, ay / (muAt(i) * lcN / t.m));
      return k === 2 ? Math.sqrt(Math.max(0, 1 - r * r)) : Math.pow(Math.max(0, 1 - Math.pow(r, k)), 1 / k);
    };
    const brakeAcc2 = (v, i) => {
      const va = vAir(v, i), L = aeroFactor * car.clA * va * va, N = normalAt(v, i, L);
      const fx = muAt(i) * (t.muX0 / t.muY0) * (lc?.braking ? latCap(v, i, L) : pureCap(i, N)) * ellN(v, i, L, N);
      const drag = aeroFactor * car.cdA * va * va, roll = cRoll * N;
      let a = (fx + drag + roll) / t.m + G * sinG[i];
      if (car.brakeDecelMax) a = Math.min(a, car.brakeDecelMax);
      if (car.brakeEnv) a = Math.min(a, car.brakeEnv[0] + car.brakeEnv[1] * v * v);
      return a;
    };
    const vBack = new Float64Array(n);
    // start backward integration from the slowest point (its speed is set by the lateral limit)
    let iMin = 0; for (let i = 1; i < n; i++) if (vLat[i] < vLat[iMin]) iMin = i;
    // step 2: Heun on w = v² over one track step of length len; k1 = rate (m/s²) at the start, R(v, f) = rate at fraction f of the
    // step. Where the rate changes by more than TOL_A across the step, up to 8 substeps with the rate interpolated along the step.
    let hk2 = 0; // rate at the predicted end of the last heun() step
    const TOL_A = 2, heun = (w0, k1, R, len, force) => {
      const k2 = hk2 = R(Math.sqrt(Math.max(1, w0 + 2 * k1 * len)), 1), d = Math.abs(k2 - k1);
      if (!(d > TOL_A) && !force) return w0 + len * (k1 + k2);
      const m = Math.max(force ? 4 : 1, Math.min(8, Math.ceil(d / TOL_A))), h = len / m; let w = w0;
      for (let q = 0; q < m; q++) { const a1 = q ? R(Math.sqrt(Math.max(1, w)), q / m) : k1, a2 = R(Math.sqrt(Math.max(1, w + 2 * a1 * h)), (q + 1) / m); w += h * (a1 + a2); }
      return w;
    };
    // virtual point n at fraction f from point a to point b: every per-point value interpolated linearly (as the geometry is)
    let vSrc = 0; const lin = (x, a, b, f) => { x[n] = (1 - f) * x[a] + f * x[b]; };
    // the lateral limit between two points: 1/v² is close to linear in the curvature (v² = μg / (κ − μ·ClA·ρ/2m) for a point mass)
    const latMid = (a, b, f) => 1 / Math.sqrt((1 - f) / (vLat[a] * vLat[a]) + f / (vLat[b] * vLat[b]));
    const VA = [kapX, tail, sinG, cosG, muP], virt = (a, b, f) => { for (const x of VA) lin(x, a, b, f); vLat[n] = latMid(a, b, f); lin(clF, a, b, f); lin(cdF, a, b, f); lin(muXF, a, b, f); if (bank) lin(bank, a, b, f); if (kv) lin(kv, a, b, f); vSrc = a; };
    // step 2: braking curve v² before the lateral cap (bw, for the meeting point) and at mid-step (bm, for the step time)
    const bw = STEP === 2 ? new Float64Array(n) : null, bm = STEP === 2 ? new Float64Array(n) : null;
    if (STEP === 2) for (let pass = 0; pass < 2; pass++) {
      if (pass === 0) vBack[iMin] = vLat[iMin];
      for (let c = 1; c <= n; c++) {
        const i = (iMin - c + 2 * n) % n, j = (i + 1) % n, vj = vBack[j];
        const Rj = x => brakeAcc2(Math.min(x, vLat[j]), j), Ri = x => brakeAcc2(Math.min(x, vLat[i]), i);
        const R = (x, f) => f === 0 ? Rj(x) : f === 1 ? Ri(x) : (virt(j, i, f), brakeAcc2(Math.min(x, vLat[n]), n));
        const k1 = Rj(vj), w = heun(vj * vj, k1, R, ds, kapX[i] * kapX[j] < 0);
        bw[i] = w; bm[i] = vj * vj + ds * (3 * k1 + hk2) / 4; vBack[i] = Math.min(Math.sqrt(w), vLat[i]);
      }
    }
    else for (let pass = 0; pass < 2; pass++) {
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
    // ers.law.regen({pBrake W at the wheels, v m/s, i, s m, regenMax, share, eta}) → DC power recovered, W (default: the formula below)
    const regenLaw = (pBrake, vm, i) => law.regen({pBrake, v: vm, i, s: i * ds, regenMax: ers.regenMax, share: ers.regenShare ?? 0.6, eta: etaRegen});
    // 2026+ F1: the battery is tracked point by point on the final pass (qualifying lap from a full
    // battery): no deploy when it is empty, recovery stops at the per-lap recharge limit, and charge above
    // the usable window is lost. Earlier passes only warm up the speed profile.
    const causal = ers.rule === 'f1-2026' && ers.causalSoc !== false;
    const socMax = ers.socWindow ?? 4e6, recMax = env.rechargeMax ?? ers.rechargeMax ?? 8.5e6;
    let vhLo = -Infinity, vhHi = Infinity; // after forward(): every vH in [vhLo, vhHi) takes the same branches, so gives the same run
    let cLo = -Infinity, cHi = Infinity; // likewise every vCut in (cLo, cHi]
    // per-point values of forward() that do not depend on speed, worked out once with the same operations
    const maxOf = a => { let m = -Infinity; for (let i = 0; i < a.length; i++) { const x = a[i]; if (x !== x) return NaN; if (x > m) m = x; } return m; }; // Math.max(...a) for the speeds (no ±0 case)
    const below = (vi, vCut) => vi < vCut ? (vi > cLo && (cLo = vi), true) : (vi < cHi && (cHi = vi), false);
    const forward1 = (vCut, vH = Infinity) => {
      const v = fwd; vhLo = -Infinity; vhHi = Infinity; cLo = -Infinity; cHi = Infinity;
      v[iMin] = Math.min(vLat[iMin], vBack[iMin]);
      let soc = socMax, got = 0;
      for (let pass = 0; pass < 2; pass++) {
        const track = causal && pass === 1, start = track ? 0 : iMin; let pPrev = 0, rp = null;
        for (let c = 0; c < n; c++) {
          const i = (start + c) % n, j = (i + 1) % n;
          const vi = Math.max(v[i], 1);
          const va = vAir(vi, i), L = aeroFactor * clF[i] * va * va, N = normalAt(vi, i, L);
          const lim = erskLimitW(ers.rule, vi, ers.pMax || 0, otOn === true || !!(otOn && otOn[i]), env.erskKnots);
          let pErs = below(vi, vCut) && (!track || soc > 0) ? Math.min(lim, ersCap ? ersCap[i] : Infinity) : 0;
          // C5.12 (2026 PU documents): a voluntary cut of ERS-K power while accelerating is one step of at most 150 kW (the event's
          // value in a listed corner zone) held 1 s, then a ramp at rateKWs down to 100 kW; below 100 kW it may stop at once
          // (C5.12.4/6/7). Done here, inside the deployment, so the cut-off speed is solved with the ramp's energy included (the
          // earlier ceiling passes after the lap did not converge: Hungaroring and Monza kept a 300 kW cut, A6 run 44259689110).
          if (ramp) {
            // an empty battery is no excuse: the ramp starts when the charge left is what the ramp itself will use
            // (at any speed: the cut it avoids may fall above the rule's speed)
            if (!rp && pPrev > 100e3) { const P1 = pPrev - rampStep(i), lo = Math.min(P1, 100e3), eR = P1 + 0.5 * (P1 - lo) * (P1 + lo) / ramp.R;
              if (P1 > HOLD_MIN && ((pErs < pPrev - 1e3 && vi >= rampVMin(i)) || (track && soc <= eR))) rp = {P1, t: 0}; }
            if (rp) { const al = rp.t < 1 ? rp.P1 : rp.P1 - ramp.R * (rp.t - 1); if (rp.t >= 1 && al <= 100e3) rp = null; else if (!track || soc > 0) pErs = Math.min(lim, al); }
          }
          if (law && law.deploy) pErs = law.deploy({i, s: i * ds, v: vi, lim, pErs, soc: track ? soc : null});
          const pI = pAt(vi), fPow = (pI * etaD + pErs * etaK * etaD) / vi;
          const nRear = t.rearStatic * (kv ? N - L : mg * cosG[i]) + t.rearAero * L;
          const muX = muXF[i] * pureCap(i, N) / N;
          // LMH hybrids also drive the front axle above a set speed (awdAboveKph): all four tyres
          const awd = t.awdAbove != null && vi > t.awdAbove;
          const fTrac = (awd ? muX * N : muX * nRear / Math.max(0.2, 1 - muX * t.hOverWb)) * ellipse(vi, i);
          let fDrive = Math.min(fPow, fTrac);
          powerLimited[i] = fPow <= fTrac ? 1 : 0;
          harv[i] = 0;
          if (throttleHarvest) {
            const spare = pI * etaD - fDrive * vi; // W at the wheels the ICE could still give
            if (spare > 0) harv[i] = Math.min(clipMax, spare / etaD) * etaRegen;
            else if (pErs === 0 && (vi > vH ? (vi < vhHi && (vhHi = vi), true) : (vi > vhLo && (vhLo = vi), false))) { const pc = Math.min(clipMax, pI); fDrive -= pc * etaD / vi; harv[i] = pc * etaRegen; }
          }
          // DC power the ERS-K actually supplies: whatever the ICE cannot, up to its limit
          ersUsed[i] = pErs > 0 ? Math.min(pErs, Math.max(0, fDrive * vi - pI * etaD) / (etaK * etaD)) : 0;
          // Hypercar hybrids (LMH front axle, LMDh rear axle): the BoP caps total power, so the motor
          // replaces engine power rather than adding to it; it can only drive above its deploy speed
          if (ers.rule === 'hypercar') ersUsed[i] = vi > (ers.deployFrom || 0) && below(vi, vCut) ? Math.min(ers.eMax || 0, fDrive * vi / etaD) : 0;
          const drag = aeroFactor * cdF[i] * va * va, roll = cRoll * N;
          const a = (fDrive - drag - roll) / (t.m * t.inertia) - G * sinG[i];
          const vn = Math.sqrt(Math.max(1, vi * vi + 2 * a * ds));
          v[j] = Math.min(vn, vLat[j], vMaxCar, vBack[j]);
          if (ramp) { if (v[j] > vi + 1e-6) { pPrev = ersUsed[i]; if (rp) rp.t += ds / vi; } else { pPrev = 0; rp = null; } }
          if (track) {
            // same energy terms as account(): deploy while accelerating, throttle harvest, braking regen
            const vm = 0.5 * (vi + v[j]), dt = ds / Math.max(vm, 1);
            let rec = v[j] >= vi - 1e-6 ? harv[i] * dt : 0;
            if (v[j] < vi - 1e-6 && ers.regenMax) rec += (law && law.regen ? regenLaw(t.m * (vi * vi - v[j] * v[j]) / (2 * ds) * vm, vm, i) : Math.min(ers.regenMax, (ers.regenShare ?? 0.6) * t.m * (vi * vi - v[j] * v[j]) / (2 * ds) * vm * etaRegen)) * dt;
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
    const account1 = (v) => {
      let eDeploy = 0, eRegen = 0, eHarv = 0, time = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, vm = 0.5 * (v[i] + v[j]), dt = ds / Math.max(vm, 1);
        time += dt;
        if (throttleHarvest && v[j] >= v[i] - 1e-6) eHarv += harv[i] * dt;
        if (v[j] > v[i] + 1e-6) eDeploy += ersUsed[i] * dt;
        if (v[j] < v[i] - 1e-6 && ers.regenMax) {
          // braking power at the wheels; the rear axle share can be recovered by the MGU-K
          const pBrake = t.m * (v[i] * v[i] - v[j] * v[j]) / (2 * ds) * vm;
          eRegen += (law && law.regen ? regenLaw(pBrake, vm, i) : Math.min(ers.regenMax, (ers.regenShare ?? 0.6) * pBrake * (ers.etaRegen ?? 0.9))) * dt; // regenMax is a DC limit
        }
      }
      return {eDeploy, eRegen: eRegen + eHarv, eBrake: eRegen, eHarv, time};
    };

    // Step 2 forward pass. The strategy decisions of a step (deploy on or off at the cut-off, the C5.12 ramp, super-clipping above vH,
    // battery not empty) are taken at the step's start, as in step 1, so the cut-off bands stay exact. Inside the step: Heun with the
    // drive force at both ends, the meeting point of the accelerating and braking curves, and the point where the battery empties.
    // Per-step time and energy (sDt, sDep, sBrk, sThr) are stored; the lap account and the flow arrays are their sums.
    const sDt = STEP === 2 ? new Float64Array(n) : null, sDep = STEP === 2 ? new Float64Array(n) : null;
    const sBrk = STEP === 2 ? new Float64Array(n) : null, sThr = STEP === 2 ? new Float64Array(n) : null;
    let dErs = 0, dHarv = 0, dPl = 0, dEl = 1; // outputs of drv(): DC deploy power (W), power recovered on throttle (W), power-limited flag, friction-ellipse share left
    // drive rate (m/s²) at speed vv on point i with the step's decisions: mode 0 no deploy, 1 deploy to the limit, 2 ramp ceiling al
    const drv = (vv, i, mode, al, hyOn, clipOf) => {
      const va = vAir(vv, i), L = aeroFactor * clF[i] * va * va, N = normalAt(vv, i, L);
      let pErs = 0;
      const q = i === n ? vSrc : i, ot = otOn === true || !!(otOn && otOn[q]);
      if (mode) { const lim = erskLimitW(ers.rule, vv, ers.pMax || 0, ot, env.erskKnots); pErs = mode === 2 ? Math.min(lim, al) : Math.min(lim, ersCap ? ersCap[q] : Infinity); }
      if (law && law.deploy) pErs = law.deploy({i: q, s: i * ds, v: vv, lim: erskLimitW(ers.rule, vv, ers.pMax || 0, ot, env.erskKnots), pErs, soc: null});
      const pI = pAt(vv), fPow = (pI * etaD + pErs * etaK * etaD) / vv;
      const nRear = t.rearStatic * (kv ? N - L : mg * cosG[i]) + t.rearAero * L;
      const muX = muXF[i] * pureCap(i, N) / N;
      const awd = t.awdAbove != null && vv > t.awdAbove;
      dEl = clF[i] === car.clA ? ellN(vv, i, L, N) : ellipse(vv, i); const fTrac = (awd ? muX * N : muX * nRear / Math.max(0.2, 1 - muX * t.hOverWb)) * dEl;
      let fDrive = Math.min(fPow, fTrac); dPl = fPow <= fTrac ? 1 : 0; dHarv = 0;
      if (throttleHarvest) {
        const spare = pI * etaD - fDrive * vv;
        if (spare > 0) dHarv = Math.min(clipMax, spare / etaD) * etaRegen;
        else if (pErs === 0 && clipOf()) { const pc = Math.min(clipMax, pI); fDrive -= pc * etaD / vv; dHarv = pc * etaRegen; }
      }
      dErs = pErs > 0 ? Math.min(pErs, Math.max(0, fDrive * vv - pI * etaD) / (etaK * etaD)) : 0;
      if (ers.rule === 'hypercar') dErs = hyOn ? Math.min(ers.eMax || 0, fDrive * vv / etaD) : 0;
      const drag = aeroFactor * cdF[i] * va * va, roll = cRoll * N;
      return (fDrive - drag - roll) / (t.m * t.inertia) - G * sinG[i];
    };
    // braking power at the wheels from w0 to w1 over len metres, and the DC power recovered (the step-1 formula)
    const regenP = (w0, w1, len, i) => { const vm = 0.5 * (Math.sqrt(w0) + Math.sqrt(w1)), pB = t.m * (w0 - w1) / (2 * len) * vm;
      return law && law.regen ? regenLaw(pB, vm, i) : Math.min(ers.regenMax, (ers.regenShare ?? 0.6) * pB * etaRegen); };
    // step state read by the rate functions below (one set of closures for the whole lap, no allocation per step)
    let sI = 0, sJ = 0, sMode = 0, sAl = 0, sHy = false, sVi = 0, sVH = Infinity, sCd = -1;
    const clipOf = () => { if (sCd < 0) sCd = sVi > sVH ? (sVi < vhHi && (vhHi = sVi), 1) : (sVi > vhLo && (vhLo = sVi), 0); return sCd === 1; };
    const Ri = x => drv(Math.min(x, vLat[sI]), sI, sMode, sAl, sHy, clipOf), Rj = x => drv(Math.min(x, vLat[sJ]), sJ, sMode, sAl, sHy, clipOf);
    const Rf = (x, f) => f === 0 ? Ri(x) : f === 1 ? Rj(x) : (virt(sI, sJ, f), drv(Math.min(x, vLat[n]), n, sMode, sAl, sHy, clipOf));
    const A0 = new Float64Array(3), A1 = new Float64Array(3), cuts = new Float64Array(5);
    const lineLow = f => { let q = 0, m = Infinity; for (let p = 0; p < 3; p++) { const w = A0[p] + (A1[p] - A0[p]) * f; if (w < m) { m = w; q = p; } } return q; };
    // q is the lowest line over the whole step (lines are straight: lowest at both ends)
    const lowAll = q => { for (let p = 0; p < 3; p++) if (p !== q && (A0[q] > A0[p] + 1e-9 || A1[q] > A1[p] + 1e-9)) return false; return true; };
    // C5.12 in step 2: a cut is a drop of more than 200 W per metre of track (1 kW per 5 m step, as step 1 at the production grid),
    // so a smooth taper is not read as a cut on a finer grid
    const forward2 = (vCut, vH = Infinity) => {
      const v = fwd; vhLo = -Infinity; vhHi = Infinity; cLo = -Infinity; cHi = Infinity; sVH = vH;
      v[iMin] = Math.min(vLat[iMin], vBack[iMin]);
      let soc = socMax, got = 0;
      const vc = vMaxCar * vMaxCar;
      for (let pass = 0; pass < 2; pass++) {
        const track = causal && pass === 1, start = track ? 0 : iMin; let pPrev = 0, rp = null, prevDt = 0, prevLim = 0, prevPhi = -1;
        // the rate at a step's predicted end is the next step's start rate when the step was not capped and the next step takes the
        // same decisions (its speed differs from the predicted one by O(ds²), so the method stays second order)
        let nK = NaN, nE = 0, nH = 0, nPl = 0, nEl = 1, nMode = -1, nAl = 0, nHy = false;
        // a rule without battery tracking repeats the first pass exactly unless the lap came back to iMin at another speed
        if (pass === 1 && !causal && v[iMin] === Math.min(vLat[iMin], vBack[iMin])) break;
        for (let c = 0; c < n; c++) {
          const i = (start + c) % n, j = (i + 1) % n;
          const vi = Math.max(v[i], 1), wi = vi * vi;
          // decisions at the step start (same rules and order as step 1)
          const lim = erskLimitW(ers.rule, vi, ers.pMax || 0, otOn === true || !!(otOn && otOn[i]), env.erskKnots);
          let mode = below(vi, vCut) && (!track || soc > 0) ? 1 : 0, al = 0;
          const pErs = mode ? Math.min(lim, ersCap ? ersCap[i] : Infinity) : 0;
          if (ramp) {
            if (!rp && pPrev > 100e3) { const P1 = pPrev - rampStep(i), lo = Math.min(P1, 100e3), eR = P1 + 0.5 * (P1 - lo) * (P1 + lo) / ramp.R;
              const cut = pErs < pPrev - 200 * ds && vi >= rampVMin(i);
              // event point: the cut happened inside the previous step (where the battery emptied, or where the limit crossed the
              // threshold), so the hold clock starts with the time since then
              if (P1 > HOLD_MIN && (cut || (track && soc <= eR))) { const th = pPrev - 200 * ds;
                rp = {P1, t: !cut ? 0 : prevPhi >= 0 ? (1 - prevPhi) * prevDt : prevLim > th && prevLim > pErs ? (1 - Math.min(1, Math.max(0, (prevLim - th) / (prevLim - pErs)))) * prevDt : 0}; } }
            if (rp) { const a0 = rp.t < 1 ? rp.P1 : rp.P1 - ramp.R * (rp.t - 1), tm = rp.t + 0.5 * ds / vi; // ceiling at mid-step time
              if (rp.t >= 1 && a0 <= 100e3) rp = null; else if (!track || soc > 0) { mode = 2; al = Math.max(Math.min(a0, 100e3), tm < 1 ? rp.P1 : rp.P1 - ramp.R * (tm - 1)); } }
          }
          sI = i; sJ = j; sMode = mode; sAl = al; sVi = vi; sCd = -1;
          sHy = ers.rule === 'hypercar' && vi > (ers.deployFrom || 0) && below(vi, vCut);
          // Heun step; rate speeds capped at the lateral limit of their end
          const reuse = nK === nK && nMode === mode && nAl === al && nHy === sHy;
          const k1 = reuse ? nK : Ri(vi), e1 = reuse ? nE : dErs, h1 = reuse ? nH : dHarv; powerLimited[i] = reuse ? nPl : dPl; harv[i] = h1; ersUsed[i] = e1; const el1 = reuse ? nEl : dEl;
          const wP = wi + 2 * k1 * ds, vP = Math.sqrt(Math.max(1, wP)), cdBefore = sCd;
          const k2 = Rj(Math.min(vP, vLat[j])), e2 = dErs, h2 = dHarv, pl2 = dPl, el2 = dEl; nK = NaN;
          const sub = kapX[i] * kapX[j] < 0;
          const stiff = Math.abs(k2 - k1) > TOL_A || sub;
          let wn = stiff ? heun(wi, k1, Rf, ds, sub) : wi + ds * (k1 + k2);
          const wm = wi + ds * (3 * k1 + k2) / 4;
          let vj = Math.min(Math.sqrt(Math.max(1, wn)), vLat[j], vMaxCar, vBack[j]);
          // energy and time of the step
          let dt = 0, dep = 0, thr = 0, brk = 0;
          // the step's profile is the lowest of three curves, each a straight line in v² over the step: accelerating (wi → wn),
          // braking (bw[i] → vBack[j]²) and the lateral limit (vLat², at most vMaxCar²). Where the lowest one changes inside the
          // step (event points: braking meets accelerating, the limit takes over), the step is split and each part booked by itself.
          A0[0] = wi; A0[1] = Math.min(bw[i], vc); A0[2] = Math.min(vLat[i] * vLat[i], vc);
          A1[0] = wn; A1[1] = Math.min(vBack[j] * vBack[j], vc); A1[2] = Math.min(vLat[j] * vLat[j], vc);
          if (!(wn <= A1[1] && wn <= A1[2] && wi <= A0[1] && wi <= A0[2]) && !lowAll(0) && !lowAll(1) && !lowAll(2)) {
            let nc = 0; cuts[nc++] = 0;
            for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) { const d = (A1[p] - A0[p]) - (A1[q] - A0[q]), f = d ? (A0[q] - A0[p]) / d : -1; if (f > 1e-9 && f < 1 - 1e-9) cuts[nc++] = f; }
            cuts[nc++] = 1; const cs = Array.from(cuts.subarray(0, nc)).sort((x, y) => x - y);
            let wA = wi, fa = 0;
            for (let c2 = 0; c2 + 1 < cs.length; c2++) {
              const q = lineLow(0.5 * (cs[c2] + cs[c2 + 1])), fb = cs[c2 + 1];
              if (c2 + 2 < cs.length && lineLow(0.5 * (cs[c2 + 1] + cs[c2 + 2])) === q) continue; // same line goes on
              const wB = fb === 1 ? vj * vj : A0[q] + (A1[q] - A0[q]) * fb, len = (fb - fa) * ds, vA = Math.sqrt(Math.max(1, wA)), vB = Math.sqrt(Math.max(1, wB)), tq = 2 * len / (vA + vB), fm = 0.5 * (fa + fb);
              dt += tq;
              if (vB > vA + 1e-6 * (fb - fa)) dep += (e1 + (e2 - e1) * fm) * tq;
              if (vB >= vA - 1e-6 * (fb - fa)) thr += (h1 + (h2 - h1) * fm) * tq;
              else if (ers.regenMax) brk += regenP(wA, wB, len, i) * tq;
              wA = wB; fa = fb;
            }
          } else {
            // Simpson: the speed at mid-step is the lowest of the accelerating curve, the braking curve and the lateral limit
            const vl = latMid(i, j, 0.5), vm = Math.max(1, Math.min(Math.sqrt(Math.max(1, Math.min(wm, bm[i]))), vl, vMaxCar));
            dt = ds / 6 * (1 / vi + 4 / vm + 1 / Math.max(vj, 1));
            // deploy and throttle-harvest power along the step; where either changes fast (corner exits: the friction ellipse
            // opens like a square root: less than 60 % of it left at an end; every step with throttle harvest) it is read at up to 7 points inside the step on the profile
            const me = vj >= vi - 1e-6 && (throttleHarvest || Math.min(el1, el2) < 0.6) ? Math.min(8, Math.ceil(Math.max(Math.abs(e1 - e2), Math.abs(h1 - h2)) / 25e3)) : 1;
            if (me > 1) {
              let eS = 0, hS = 0, tS = 0, vA = vi, eA = e1, hA = h1;
              for (let q = 1; q <= me; q++) {
                const f = q / me, wq = Math.min(wi + ds * f * (2 * k1 + (k2 - k1) * f), A0[1] + (A1[1] - A0[1]) * f, A0[2] + (A1[2] - A0[2]) * f);
                const vB = q === me ? Math.max(vj, 1) : Math.sqrt(Math.max(1, wq)); let eB = e2, hB = h2;
                if (q < me) { virt(i, j, f); drv(Math.min(vB, vLat[n]), n, mode, al, sHy, clipOf); eB = dErs; hB = dHarv; }
                const tq = 2 * ds / me / (vA + vB); eS += 0.5 * (eA + eB) * tq; hS += 0.5 * (hA + hB) * tq; tS += tq; vA = vB; eA = eB; hA = hB;
              }
              if (vj > vi + 1e-6) dep = eS * dt / tS;
              if (throttleHarvest) thr = hS * dt / tS;
            } else {
              if (vj > vi + 1e-6) dep = 0.5 * (e1 + e2) * dt;
              if (throttleHarvest && vj >= vi - 1e-6) thr = 0.5 * (h1 + h2) * dt;
            }
            if (vj < vi - 1e-6 && ers.regenMax) brk = regenP(wi, vj * vj, ds, i) * dt;
          }
          if (!throttleHarvest) thr = 0;
          let rpNew = null;
          if (ramp && track && !rp && mode === 1 && e1 > 100e3 && dep > 0) {
            // C5.12 event point: the charge left reaches the ramp's own energy inside this step, so the hold starts there
            const eRof = P1 => { const lo = Math.min(P1, 100e3); return P1 + 0.5 * (P1 - lo) * (P1 + lo) / ramp.R; };
            let P1 = e1 - rampStep(i), eR = eRof(P1);
            if (P1 > HOLD_MIN && soc > eR && soc - dep < eR) {
              // the cut is taken from the deploy power at the event point
              for (let it = 0; it < 2; it++) { const f = Math.min(1, Math.max(0, (soc - eR) / dep)); P1 = e1 + (e2 - e1) * f - rampStep(i); eR = eRof(P1); }
              const phi = Math.min(1, Math.max(0, (soc - eR) / dep)); sMode = 2; sAl = P1;
              const q1 = Ri(vi), qe1 = dErs, q2 = Rj(Math.min(Math.sqrt(Math.max(1, wi + 2 * q1 * ds)), vLat[j])), qe2 = dErs;
              wn = wi + ds * (phi * (k1 + k2) + (1 - phi) * (q1 + q2));
              vj = Math.min(Math.sqrt(Math.max(1, wn)), vLat[j], vMaxCar, vBack[j]);
              dt = 2 * ds / Math.max(vi + vj, 2); dep = phi * dep + (1 - phi) * 0.5 * (qe1 + qe2) * dt;
              rpNew = {P1, t: -phi * dt}; // the hold clock starts at the event point (t advances by dt below)
            }
          }
          if (ramp) { if (vj > vi + 1e-6) { pPrev = rpNew ? sAl : e2; if (rpNew) rp = rpNew; if (rp) rp.t += dt; } else { pPrev = 0; rp = null; } prevLim = pErs; prevPhi = -1; }
          if (track) {
            if (dep > Math.max(0, soc)) {
              // the battery empties inside the step: deploy for the share phi of the step, then none (event point)
              const phi = Math.max(0, soc) / dep;
              sMode = 0; sHy = false;
              const q1 = Ri(vi), q2 = Rj(Math.min(Math.sqrt(Math.max(1, wi + 2 * q1 * ds)), vLat[j]));
              wn = wi + ds * (phi * (k1 + k2) + (1 - phi) * (q1 + q2));
              vj = Math.min(Math.sqrt(Math.max(1, wn)), vLat[j], vMaxCar, vBack[j]);
              dt = 2 * ds / Math.max(vi + vj, 2); dep = Math.max(0, soc); prevPhi = phi;
            }
            const rec = Math.max(0, Math.min(thr + brk, recMax - got)); got += rec;
            soc -= dep; soc = Math.min(socMax, soc + rec);
          }
          prevDt = dt; v[j] = vj; sDt[i] = dt; sDep[i] = dep; sThr[i] = thr; sBrk[i] = brk;
          if (!stiff && vP <= vLat[j] && vj === Math.sqrt(Math.max(1, wn)) && sCd < 0 && cdBefore < 0 && sMode === mode) { nK = k2; nE = e2; nH = h2; nPl = pl2; nEl = el2; nMode = mode; nAl = al; nHy = sHy; }
        }
      }
      return v;
    };
    const account2 = () => { let eDeploy = 0, eRegen = 0, eHarv = 0, time = 0;
      for (let i = 0; i < n; i++) { time += sDt[i]; eDeploy += sDep[i]; eRegen += sBrk[i]; eHarv += sThr[i]; }
      return {eDeploy, eRegen: eRegen + eHarv, eBrake: eRegen, eHarv, time}; };
    const forward = STEP === 2 ? forward2 : forward1, account = STEP === 2 ? account2 : account1;

    // 4) Choose the deployment cut-off speed so the lap stays inside the energy budget.
    //    Deploying at lower speed gains more time per joule, so a speed threshold is a good
    //    approximation of the optimal allocation.
    const budget = (eRegen) => {
      // Hypercar: charge-sustaining over a lap (energy recovered on braking plus a small battery window)
      if (ers.rule === 'hypercar') return eRegen + (ers.socWindow ?? 0.5e6);
      if (!ers.pMax) return 0;
      if (ers.rule === 'f1-2026') return (ers.socWindow ?? 4e6) + Math.min(eRegen, env.rechargeMax ?? ers.rechargeMax ?? 8.5e6);
      return lawB ? Infinity : ers.deployMax ?? 4e6; // law (b): MGU-H → MGU-K is not limited, the 4 MJ ES rule does not bind
    };
    // runs already made at this vH: a cut-off inside a recorded band gives the identical lap, so its account is reused. top = the
    // profile's top speed, read later from the shared buffer (vTopA) as it was left by the last run of the search
    const cutRuns = new Map(); let lastTop = null;
    const fitCut = (vH, fixedBudget) => {
      let lo = 5, hi = vMaxCar + 1, list = cutRuns.get(vH); if (!list) cutRuns.set(vH, list = []);
      for (let it = 0; it < 20; it++) {
        const mid = 0.5 * (lo + hi); let r = null; for (const b of list) if (mid > b.lo && mid <= b.hi) { r = b; break; }
        if (!r) { const fv = forward(mid, vH); r = {lo: cLo, hi: cHi, a: account(fv), top: maxOf(fv)}; list.push(r); }
        const a = r.a; lastTop = r.top;
        // law (b) on a causal lap: the battery caps deploy, so deploy equals the budget to rounding; 1 J is not an overspend (a strict
        // test flipped the plan on 1e-8 J noise and the lap moved 0.13 % with the track step, mesh test 2026-11-24)
        if (a.eDeploy > (fixedBudget ?? budget(a.eRegen)) + (lawB && causal ? 1 : 0)) hi = mid; else lo = mid;
      }
      return lo;
    };
    let vCut = vMaxCar + 1, vH = Infinity, v = forward(vCut), acc = account(v);
    // step 2 tracks the battery exactly, so a causal lap overspends only by rounding: 1 J is not an overspend
    if ((ers.pMax || ers.rule === 'hypercar') && ((causal && lawB) || acc.eDeploy > budget(acc.eRegen) + (STEP === 2 ? 1 : 0))) {
      vCut = fitCut(Infinity); v = forward(vCut); acc = account(v);
      // super-clipping: if the lap is short of the recharge limit, harvest at full throttle at the top of
      // the straights (above vH) and spend the energy lower down, when that is faster
      const limit = env.rechargeMax ?? ers.rechargeMax ?? 8.5e6, soc = ers.socWindow ?? 4e6;
      if (throttleHarvest && acc.eRegen < limit - 1e4) {
        // super-clipping plan: deploy below a cut-off, harvest at full throttle above vH. The earlier single try (cut-off for a full
        // recharge, then vH) missed the energy limit by a few kJ when grip rose and fell back to the slower plan (Daytona, bug
        // 2026-11-15: more grip, slower lap). Now a few cut-offs below it are tried too and the fastest legal plan is kept.
        const cutB = fitCut(Infinity, soc + limit);
        // runs already made for this cut-off: a vH inside a recorded band gives the identical lap, so its account is reused
        const bands = new Map(), runAt = (cut, vh) => { let list = bands.get(cut); if (!list) bands.set(cut, list = []);
          for (const b of list) if (vh >= b.lo && vh < b.hi) return b.a;
          const a = account(forward(cut, vh)); list.push({lo: vhLo, hi: vhHi, a}); return a; };
        const vTopA = lastTop; // cut-offs from the top speed down (the full-recharge cut-off is often above it: no cut-off at all)
        // law (b): the same cut-offs on every track step (2 % steps down from the car's top speed, the 8 below the lap's top speed).
        // Fractions of the lap's top speed moved with the step (0.8 % under the C5.12 ramp) and so did the plan: 0.13 % lap change
        // when ds halved (mesh test 2026-11-24). shortcut: a 2 % grid can miss a narrow optimum (Silverstone ramp: 0.07 s); refine
        // around the best point if law (b) ships
        const fixed = []; for (let c = vMaxCar; fixed.length < 8 && c > 0.5 * vMaxCar; c *= 0.98) if (c <= Math.min(cutB, vTopA)) fixed.push(c);
        for (const cut of [cutB, ...(lawB ? fixed : [1, 0.98, 0.96, 0.94, 0.92, 0.9, 0.87, 0.84].map(f => Math.min(cutB, vTopA) * f))]) {
          for (const tol of [0, 1.5e3]) { let lo = 5, hi = vMaxCar + 1; // strict search (the earlier plan) and the tolerant one; the faster legal plan wins
          for (let it = 0; it < 20; it++) { const mid = 0.5 * (lo + hi), a = runAt(cut, mid); if (a.eDeploy > budget(a.eRegen) + tol) hi = mid; else lo = mid; }
          const b = runAt(cut, lo);
          // tolerance 1.5 kJ: the forward pass caps deploy by its own state of charge, and the lap account differs from it by
          // about 1 kJ (the old 1 kJ tolerance rejected legal plans)
          if (b.eDeploy <= budget(b.eRegen) + 1.5e3 && b.time < acc.time) { vCut = cut; vH = lo; acc = b; } } }
        v = forward(vCut, vH); acc = account(v); // forward() reuses its buffers: run the chosen plan last
      }
    }

    // Results
    const time = new Float64Array(n + 1);
    if (STEP === 2) for (let i = 0; i < n; i++) time[i + 1] = time[i] + sDt[i];
    else for (let i = 0; i < n; i++) { const j = (i + 1) % n; time[i + 1] = time[i] + 2 * ds / Math.max(v[i] + v[j], 2); }
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
      if (STEP === 2) for (let i = 0; i < n; i++) { dep[i] = sDep[i]; brk[i] = sBrk[i]; thr[i] = sThr[i]; }
      else for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, vm = 0.5 * (v[i] + v[j]), dt = ds / Math.max(vm, 1);
        if (throttleHarvest && v[j] >= v[i] - 1e-6) thr[i] = harv[i] * dt;
        if (v[j] > v[i] + 1e-6) dep[i] = ersUsed[i] * dt;
        if (v[j] < v[i] - 1e-6 && ers.regenMax) brk[i] = (law && law.regen ? regenLaw(t.m * (v[i] * v[i] - v[j] * v[j]) / (2 * ds) * vm, vm, i) : Math.min(ers.regenMax, (ers.regenShare ?? 0.6) * t.m * (v[i] * v[i] - v[j] * v[j]) / (2 * ds) * vm * (ers.etaRegen ?? 0.9))) * dt;
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
  function trackFromData(d, {aero = 'auto', steps = null} = {}) {
    // steps (A4 part 2, flag LAPSIM_KAPPA_REPAIR, off by default): [[lapDistanceM, halfWidthM], ...] false side steps in the source line;
    // kappa there becomes a straight blend between the two ends plus a constant that keeps the same heading change
    const kappa = Float64Array.from(d.kappa, v => v / 1e5);
    if (steps) { const n0 = kappa.length, k0 = Float64Array.from(kappa), at = i => k0[((i % n0) + n0) % n0];
      for (const [s, hw] of steps) { const c = Math.round(s / d.ds), h = Math.round(hw / d.ds), a = c - h, m = 2 * h, ka = at(a - 1), kb = at(a + m + 1), lin = j => ka + (kb - ka) * (j + 1) / (m + 2);
        let tot = 0, tl = 0; for (let j = 0; j <= m; j++) { tot += at(a + j); tl += lin(j); }
        for (let j = 0; j <= m; j++) kappa[((a + j) % n0 + n0) % n0] = lin(j) + (tot - tl) / (m + 1); } }
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
  // Hook (docs/lapsim-hooks.md): track.changeFactors(change) → {kind: 'grip' | 'cornerSpeed', factor} or null (no effect) replaces
  // change.effect; unset = change.effect, as before.
  function applyTrackChanges(track, changes, corners, {strength = 1} = {}) {
    const n = track.kappa.length, L = n * track.ds;
    const mu = Float64Array.from(track.mu || new Float64Array(n).fill(1));
    const vScale = Float64Array.from(track.vScale || new Float64Array(n).fill(1));
    const applied = [];
    for (const ch of changes) {
      const eff = track.changeFactors ? track.changeFactors(ch) : ch.effect;
      if (!ch.affectsLap || !eff || !corners?.length) continue;
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
      const factor = 1 + (eff.factor - 1) * strength;
      const target = eff.kind === 'grip' ? mu : vScale;
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
