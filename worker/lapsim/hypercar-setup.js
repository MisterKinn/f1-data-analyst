// Hypercar set-up per car and track. The rules fix an aero performance window (downforce and
// lift/drag range, homologated per car), so a team's choice at a track is mostly where it sits in
// that window: more downforce (slower on the straights) or less drag. We describe it with one
// number s ∈ [0, 1] (0 = lowest-drag set-up, 1 = highest-downforce set-up) and
//  - read it from timing (speed trap + sector times of each car) for cars that have raced,
//  - predict it by optimising the lap for cars that have not (2027 Evo kits, first-year cars),
//    then correct by how far each team's real choices sat from the optimum (team bias).

// Width of the window around the class car (±half of these around s = 0.5). Assumed until read
// from the homologation/BoP documents: ±8% downforce, ±5% drag.
export const WINDOW = {cl: 0.16, cd: 0.10};

export function withSetup(car, s, w = WINDOW) {
  const k = s - 0.5;
  return {...car, clA: car.clA * (1 + w.cl * k), clALow: (car.clALow ?? car.clA) * (1 + w.cl * k), cdA: car.cdA * (1 + w.cd * k), cdALow: (car.cdALow ?? car.cdA) * (1 + w.cd * k)};
}

// golden-section search of f on [0, 1]
function golden(f, it = 18) {
  let a = 0, b = 1; const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
  for (let i = 0; i < it; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
  }
  return (a + b) / 2;
}

// Fastest set-up for a car on a track (K = lapsim kernel)
export function optimalSetup(K, track, car, env, w = WINDOW) {
  const s = golden(x => K.simulateLap(track, withSetup(car, x, w), env).lapTime);
  const r = K.simulateLap(track, withSetup(car, s, w), env);
  return {s, lapTime: r.lapTime, trapKph: r.vMaxKph};
}

// Set-up a car actually ran, read from its trap speed and sector times (weights: 1 km/h of trap ≈ 0.05 s)
export function setupFromTiming(K, track, car, env, obs, w = WINDOW) {
  const err = x => {
    const r = K.simulateLap(track, withSetup(car, x, w), env);
    let e = 0;
    if (Number.isFinite(obs.trapKph)) e += (0.05 * (r.vMaxKph - obs.trapKph)) ** 2;
    // only the sector split matters here (the car's overall pace is fitted separately)
    if (obs.sectors?.every(Number.isFinite) && r.sectors) {
      const tr = obs.sectors.reduce((a, b) => a + b, 0), ts = r.sectors.reduce((a, b) => a + b, 0);
      for (let i = 0; i < 3; i++) e += (obs.sectors[i] / tr * ts - r.sectors[i]) ** 2;
    }
    return e;
  };
  return golden(err);
}

// LMDh chassis builders: a new LMDh car starts from the cars on the same chassis
export const CHASSIS = {porsche: 'multimatic', ford: 'multimatic', cadillac: 'dallara', bmw: 'dallara', mclaren: 'dallara',
  acura: 'oreca', alpine: 'oreca', genesis: 'oreca', lamborghini: 'ligier'};
export const makeKey = m => String(m || '').toLowerCase().replace(/[^a-z]/g, '').replace(/^astonmartin.*/, 'aston');

// Prior for a car with no laps yet: mean of its chassis family (LMDh) or of its class (LMH), plus
// an Evo step (historical mean gain of Evo kits) or a first-season deficit for new entrants.
export function priorCar(cars, {make, cls, evo = false, firstSeason = false}, steps = {evoPct: -0.4, newPct: 0.5}) {
  const fam = CHASSIS[make], pool = Object.entries(cars).filter(([k, c]) => c.cls === cls && (cls !== 'lmdh' || !fam || CHASSIS[k] === fam)).map(([, c]) => c);
  const src = pool.length ? pool : Object.values(cars).filter(c => c.cls === cls);
  if (!src.length) return null;
  const avg = key => src.reduce((a, c) => a + c.car[key], 0) / src.length;
  const car = {...src[0].car, clA: avg('clA'), cdA: avg('cdA'), clALow: avg('clA'), cdALow: avg('cdA'), muY: avg('muY')};
  // pace step applied as a lap-time multiplier (BoP then moves it back toward the field)
  const pacePct = (evo ? steps.evoPct : 0) + (firstSeason ? steps.newPct : 0);
  return {car, pacePct, basis: pool.length ? (cls === 'lmdh' && fam ? 'chassis:' + fam : 'class') : 'class', teamBias: src.reduce((a, c) => a + (c.teamBias ?? 0), 0) / src.length};
}
