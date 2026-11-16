// Side steps in a source line where the real track runs straight (owner 2026-11-16: "Daytona T1 squashed"), found by the kink scan
// (tests/track-map-detail.test.mjs) and checked by eye against the circuit maps: lap distance of the step (m), optional half-width (m).
// Used by the drawn map (simulation.js mapRepair) and, once approved, by the simulator geometry (kernel trackFromData, option steps).
export const TRACK_STEPS = {daytona: [[300, 80]], autopolis: [185], 'ricardo-tormo': [3400], 'laguna-seca': [2286]};
export const STEP_REPAIR_M = 45;
// Task A4 part 2 (declared 2026-11-17): the simulator's curvature still has the false S-bend at each step. The kernel repairs it when
// given these steps (trackFromData(d, {steps: kappaSteps(id)})); production does not pass them until the owner approves
// (flag LAPSIM_KAPPA_REPAIR in the scripts; docs/lapsim-track-shapes.md, "A4 part 2").
export const kappaSteps = id => (TRACK_STEPS[id] || []).map(e => Array.isArray(e) ? e : [e, STEP_REPAIR_M]);
