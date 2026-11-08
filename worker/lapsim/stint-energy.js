// Hypercar stint energy (WEC "virtual energy tank"): the rules measure the energy delivered at the
// driveshafts (torque sensors) from pit-out to pit-in and cap it per stint (BoP, MJ). From a simulated
// lap we get the same quantity: the positive work the car needs at the wheels (kinetic energy gained +
// drag + rolling resistance + climbing), summed over the lap.
const G = 9.81;

// Driveshaft energy (J) of one lap with speed profile v (m/s) on track (kernel track object)
export function driveEnergyJ(track, car, env, v) {
  const n = v.length, ds = track.ds, rho = env?.rho ?? 1.2, m = car.mass * (car.inertiaFactor ?? 1), cr = car.cRoll ?? 0.012;
  let e = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, vm = 0.5 * (v[i] + v[j]), low = track.aeroLow?.[i];
    const drag = 0.5 * rho * (low ? car.cdALow ?? car.cdA : car.cdA) * vm * vm, down = 0.5 * rho * (low ? car.clALow ?? car.clA : car.clA) * vm * vm;
    const climb = car.mass * G * (track.grade?.[i] ?? 0);
    const w = 0.5 * m * (v[j] * v[j] - v[i] * v[i]) + (drag + cr * (car.mass * G + down) + climb) * ds;
    if (w > 0) e += w;
  }
  return e;
}

// Stint from the BoP energy: laps the energy allows at this pace, and the stint length in minutes
export function stintFromEnergy(stintMJ, lapJ, lapTime) {
  if (!(stintMJ > 0) || !(lapJ > 0)) return null;
  const laps = stintMJ * 1e6 / lapJ;
  return {laps, minutes: laps * lapTime / 60, lapMJ: lapJ / 1e6};
}
