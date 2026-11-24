// ERS law (b) for the F1 kernel (step 10b, pre-registration claude/gate-ers-law-prereg-2026-11-23.md §4, §7–9).
// withErsLaw(car) sets car.ers.law = 'b' (data, so it is stored in calibration-data.js and the lap cache keeps working); the kernel
// carries the same law in its own source (kernel.js is self-contained). ersLaw() is the same law as plug-in functions
// (docs/lapsim-hooks.md), used by the tests and the identity check. Unset = laps byte-identical to the kernel without it.
// With 'b' the kernel also always searches a cut-off / super-clip plan on causal 2026 laps (strategy B, owner 2026-11-23 19:03).
//
// Deploy
// - f1-2014 (2014–25 rules): the MGU-K gives its limit (120 kW) at every full-throttle point. The 4 MJ per lap of TR 5.2.x limits only
//   ES → MGU-K; the MGU-H → MGU-K path is not limited, so the lap budget does not bind (owner 11:06, 10a evidence: no power drop at the
//   kernel's cut-off, wheel power flat 180–340 km/h). With 'b' the kernel's budget does not bind, so no cut-off is searched; the
//   kernel still takes only the power the drive can use (traction, ICE share).
// - f1-2026: no change. The kernel already applies the FIA taper (TR 2026 5.4.8 i/ii, C5.2.8: 1800 − 5·kph below 340, 6900 − 20·kph
//   to 345 kph, 350 kW cap; Overtake 7100 − 20·kph) and the event limits from the PU documents (recharge limit, C5.12 ramp) through
//   env. No MGU-K torque limit is added: no FIA number was found (prereg §6).
//
// Regen (rules whose car books regen, i.e. ers.regenMax is set)
// - From the braking force of the tyres, not from the kinetic-energy drop: F = m·a − D(v) − R(v), with D = ½ρ·CdA·v² (corner-mode
//   aero, as the kernel's braking pass) and R = c_roll·(m·g + ½ρ·ClA·v²). P = min(regenMax, share·max(0, F)·v·η); share is the
//   driven-axle (rear) share of the braking force. Identity per braking zone: P/(η·share) ≤ ΔKE − drag work − roll work.
// - Not modelled (declared): grade, vertical curvature, banking and wind in F (each < 1 % of a braking force of ~40 m/s²).

const G = 9.81;

// the law for one car in one environment, or null for rules this law does not cover (hypercar, FE, …)
export function ersLaw(car, env = {}) {
  const ers = car?.ers, rule = ers?.rule;
  if (rule !== 'f1-2014' && rule !== 'f1-2026') return null;
  const rho = env.rho ?? 1.18, m = car.mass, cRoll = car.cRoll ?? 0.012;
  const dragRoll = v => 0.5 * rho * car.cdA * v * v + cRoll * (m * G + 0.5 * rho * car.clA * v * v);
  const law = {};
  if (rule === 'f1-2014') law.deploy = c => c.lim;
  if (ers.regenMax) law.regen = c => {
    if (!(c.pBrake > 0) || !(c.v > 0)) return 0;
    const f = c.pBrake / c.v - dragRoll(c.v); // tyre braking force (N): m·a from the kernel's ΔKE, minus drag and rolling
    return Math.min(c.regenMax, c.share * Math.max(0, f) * c.v * c.eta);
  };
  return {law, dragRoll};
}

// car with law (b) set as data (a copy; the input car is not changed). Unknown rules come back unchanged.
export function withErsLaw(car) {
  return ersLaw(car) ? {...car, ers: {...car.ers, law: 'b'}} : car;
}

// identity check on a finished lap (kernel step 1 bookings): per braking zone, regen/(η·share) ≤ ΔKE − drag − roll.
// Zones with a lift step (drag and rolling alone slow the car more than the measured deceleration) are checked against Σ max(0, ·).
export function regenIdentity(res, car, env = {}, ds) {
  const l = ersLaw(car, env), ers = car.ers, n = res.v.length, eta = ers.etaRegen ?? 0.9, share = ers.regenShare ?? 0.6, zones = [];
  let z = null;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, vi = res.v[i], vj = res.v[j];
    if (vj < vi - 1e-6) {
      z ||= {i0: i, dKE: 0, dragRoll: 0, posWork: 0, regen: 0, lift: 0};
      const vm = 0.5 * (vi + vj), dKE = car.mass * (vi * vi - vj * vj) / 2, w = l.dragRoll(vm) * ds;
      z.dKE += dKE; z.dragRoll += w; z.posWork += Math.max(0, dKE - w); if (dKE < w) z.lift++;
      z.regen += res.flow.brk[i];
    } else if (z) { zones.push(z); z = null; }
  }
  if (z) zones.push(z);
  for (const q of zones) q.ok = q.regen / (eta * share) <= (q.lift ? q.posWork : q.dKE - q.dragRoll) + 1e-3;
  return zones;
}
