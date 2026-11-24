// 2026 per-event ERS-K speed taper (step 24, flag LAPSIM_EVENT_ENERGY=on, off by default).
// Source: scripts/sim/data/fia-docs/f1-2026-power-unit-information.csv (FIA "Power Unit Information", applies_to_session = 1). Monaco
// and Singapore run "Rev 1": printed breakpoints 350 kW to 200 km/h, 0 at 300 km/h. The Rev 1 Overtake knots in that file are read off
// the plot (approximate), so Overtake uses the printed Rev 1 curve too. Every other event keeps the kernel's Base / Overtake curves.
// The per-event recharge limits are already in production (energy-limits.js, same FIA documents, 0 differences).
export const eventEnergyOn = () => globalThis.process?.env?.LAPSIM_EVENT_ENERGY === 'on';
export const REV1 = [[200, 350], [300, 0]];
const REV1_TRACKS = ['monte-carlo', 'singapore'];
export const taperOf = (id, year) => year === 2026 && REV1_TRACKS.includes(id) ? 'rev1' : 'base';
// env.erskKnots for the kernel, or undefined (kernel Base / Overtake curves)
export const erskKnots = (id, year, on = eventEnergyOn()) => on && taperOf(id, year) === 'rev1' ? {std: REV1, ot: REV1} : undefined;
