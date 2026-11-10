// Optional WEC-only stopping rule. No environment variable means legacy behavior.
export function wecNmStop(env) {
  if (env.LAPSIM_WEC_NM_TOL == null || env.LAPSIM_WEC_NM_TOL === '') return undefined;
  const tolerance = Number(env.LAPSIM_WEC_NM_TOL), cap = Number(env.LAPSIM_WEC_NM_CAP || 2000);
  if (!(Number.isFinite(tolerance) && tolerance > 0)) throw new Error('LAPSIM_WEC_NM_TOL must be positive and finite');
  if (!(Number.isInteger(cap) && cap >= 10)) throw new Error('LAPSIM_WEC_NM_CAP must be an integer >= 10');
  return {tolerance, cap, window: 10};
}

export function simplexSize(points, best = 0) {
  return Math.max(0, ...points.flatMap(p => p.map((x, j) => Math.abs(x - points[best][j]))));
}
