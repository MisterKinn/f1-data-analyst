// Braking from a simulated lap: braking zones (speed before/after, distance, time, deceleration), how
// the stopping force splits between aero drag, the hybrid motor (regen) and the friction brakes, front
// vs rear, and an estimated pedal load and line pressure. Self-contained (the page sends its source to
// the browser). Regen axle: F1 rear (MGU-K), LMDh rear (spec Bosch motor), LMH front (up to 200 kW).
// Pedal load: k × peak deceleration (k fitted on Brembo's published figures, brake-calibration.js);
// pressure: pedal load × pedal ratio / master-cylinder area (assumed typical values, labelled).
export function brakeZones(track, car, env, v, limit, opts = {}) {
  const G = 9.81, n = v.length, ds = track.ds, rho = env?.rho ?? 1.2, m = car.mass, L = car.wheelbase ?? 3.4, h = car.cogHeight ?? 0.3;
  const rearW = car.rearWeight ?? 0.55, ers = car.ers || {}, axle = ers.axle || (ers.rule === 'f1-2026' || ers.pMax ? 'rear' : null);
  const regenMax = ers.regenMax ?? ers.eMax ?? 0, share = ers.regenShare ?? 0.6;
  const ramp = opts.rampS ?? 0, pedalPerG = opts.pedalPerG ?? 33, ratio = opts.pedalRatio ?? 3.5, mcMm = opts.masterCylMm ?? 17.8;
  const zones = [];
  let energy = {total: 0, drag: 0, regen: 0, front: 0, rear: 0};
  for (let i = 0; i < n; i++) {
    if (limit[i] !== 3 || limit[(i - 1 + n) % n] === 3) continue;
    let j = i, peak = 0, dist = 0, time = 0, zf = 0, zr = 0, zg = 0, hd = 0, ht = 0, hs = -1, he = -1, gsum = 0;
    while (limit[j % n] === 3 && j - i < n / 3) {
      const a = j % n, b = (j + 1) % n, vm = 0.5 * (v[a] + v[b]), dec = (v[a] * v[a] - v[b] * v[b]) / (2 * ds); // m/s²
      const low = track.aeroLow?.[a], drag = 0.5 * rho * (low ? car.cdALow ?? car.cdA : car.cdA) * vm * vm, down = 0.5 * rho * (low ? car.clALow ?? car.clA : car.clA) * vm * vm;
      // stopping force left after drag, shared by the axles in proportion to their dynamic load (static +
      // load transfer + aero balance); regen takes its share on its own axle, friction brakes the rest
      const total = m * dec, need = Math.max(0, total - drag), fz = m * G + down;
      const front = Math.min(1, Math.max(0, ((1 - rearW) * m * G + (1 - (car.rearAero ?? 0.55)) * down + m * dec * h / L) / fz));
      const fNeed = need * front, rNeed = need - fNeed, regenF = axle ? Math.min(regenMax / Math.max(vm, 1), share * need, axle === 'front' ? fNeed : rNeed) : 0;
      const ff = fNeed - (axle === 'front' ? regenF : 0), fr = rNeed - (axle === 'front' ? 0 : regenF);
      zf += ff * ds; zr += fr * ds; zg += regenF * ds;
      energy.total += total * ds; energy.drag += drag * ds; energy.regen += regenF * ds; energy.front += ff * ds; energy.rear += fr * ds;
      peak = Math.max(peak, dec / G); dist += ds; time += ds / Math.max(vm, 1);
      // the hard part (pedal pressed: deceleration above 1.5 g, beyond what drag and lifting give)
      if (dec / G >= (opts.hardG ?? 1.5)) { hd += ds; ht += ds / Math.max(vm, 1); gsum += dec / G * ds; if (hs < 0) hs = a; he = b; }
      j++;
    }
    // a braking zone counts from a speed drop of minDropKph (30 km/h matches Brembo's zone counts)
    if (j - i < 2 || (v[i] - v[j % n]) * 3.6 < (opts.minDropKph ?? 10)) continue;
    // pedal load from the mean deceleration of the hard part; front-circuit pressure from the pedal force,
    // pedal ratio and master-cylinder bore, with the balance bar sending the front friction share forward
    const meanG = hd ? gsum / hd : peak, pedalKg = pedalPerG * meanG, front = zf / Math.max(1, zf + zr);
    const barPerKg = G * ratio * front / (Math.PI * (mcMm / 2000) ** 2) / 1e5;
    // effective pressure build-up (fitted on Brembo): the real zone is longer by v0·t/2 and t/2
    const v0 = v[hs < 0 ? i : hs];
    zones.push({start: i, end: j % n, vFrom: v0 * 3.6, vTo: v[he < 0 ? j % n : he] * 3.6, distM: (hd || dist) + v0 * ramp / 2, timeS: (ht || time) + ramp / 2, peakG: peak, meanG, liftDistM: dist,
      frontPct: 100 * zf / Math.max(1, zf + zr), regenPct: 100 * zg / Math.max(1, zf + zr + zg), pedalKg, bar: pedalKg * barPerKg});
    i = j;
  }
  const brakingTime = zones.reduce((s, z) => s + z.timeS, 0);
  return {zones, brakingTime, peakG: Math.max(0, ...zones.map(z => z.peakG)), totalG: zones.reduce((s, z) => s + z.peakG, 0),
    energy: {totalKWh: energy.total / 3.6e6, dragKWh: energy.drag / 3.6e6, regenKWh: energy.regen / 3.6e6, frictionKWh: (energy.front + energy.rear) / 3.6e6, frontPct: 100 * energy.front / Math.max(1, energy.front + energy.rear)}, regenAxle: axle};
}
