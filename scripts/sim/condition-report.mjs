// Condition report (AGENTS.md Gate G v3.1, item 7): how much of the held-out lap error goes with the session's conditions.
// Rows: the production held-out rows of calibration-data.js (F1 seasons, WEC classes), each joined to the real session's weather
// (official / OpenF1 / Al Kamel, stored with the fit). Conditions the data does not record (tyre age, tow, fuel, rubber) are listed as
// "not recorded". This is a diagnostic: it never changes a real lap or the fit. A condition term enters the model only through a gate.
// Usage: node scripts/sim/condition-report.mjs [--json out.json] [--md docs/lapsim-conditions.md]
import {writeFileSync} from 'node:fs';
import {lapsimCalibration as C} from '../../worker/lapsim/calibration-data.js';

const arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null;
export const FIELDS = [['trackTempC', 'track temperature', '°C'], ['airTempC', 'air temperature', '°C'], ['windSpeed', 'wind', 'm/s'],
  ['humidityPct', 'humidity', '%'], ['pressureHpa', 'air pressure', 'hPa']];
export const NOT_RECORDED = ['tyre age / set', 'tow (slipstream)', 'fuel load', 'track evolution (rubber)'];

export function rowsOf(cal) {
  const rows = [];
  for (const [y, s] of Object.entries(cal.seasons || {})) for (const h of s.holdout?.tracks || []) {
    const t = s.tracks?.[h.track]; if (!t?.realLap) continue;
    rows.push({group: `f1 ${y}`, track: h.track, errPct: 100 * h.errorSec / t.realLap, w: t.weather || null});
  }
  for (const [cl, ys] of Object.entries(cal.series?.wec || {})) for (const [y, s] of Object.entries(ys)) for (const h of s.holdout?.tracks || []) {
    const t = s.tracks?.[h.track]; if (!t?.realLap) continue;
    rows.push({group: `${cl} ${y}`, track: h.track, errPct: 100 * h.errorSec / t.realLap, w: t.weather || null});
  }
  return rows;
}

// least-squares slope of y on x with a 90 % bootstrap interval (seeded), and the share of variance it explains
export function slope(xs, ys, {iters = 4000, seed = 7} = {}) {
  const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), n = pts.length;
  const fit = P => { const mx = P.reduce((a, p) => a + p[0], 0) / P.length, my = P.reduce((a, p) => a + p[1], 0) / P.length;
    let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of P) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    return {b: sxx > 0 ? sxy / sxx : NaN, r2: sxx > 0 && syy > 0 ? sxy * sxy / (sxx * syy) : NaN}; };
  if (n < 5) return {n, b: NaN, r2: NaN, ci90: [NaN, NaN]};
  let s = seed >>> 0; const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), bs = [];
  for (let r = 0; r < iters; r++) { const b = fit(Array.from({length: n}, () => pts[Math.floor(rand() * n)])).b; if (Number.isFinite(b)) bs.push(b); }
  bs.sort((a, b) => a - b); const f = fit(pts);
  return {n, b: f.b, r2: f.r2, ci90: [bs[Math.floor(0.05 * bs.length)], bs[Math.floor(0.95 * bs.length) - 1]]};
}

function main() {
  const rows = rowsOf(C), groups = {all: rows, f1: rows.filter(r => r.group.startsWith('f1')), wec: rows.filter(r => !r.group.startsWith('f1'))};
  const res = {rows: rows.length, missingWeather: rows.filter(r => !r.w).map(r => `${r.group} ${r.track}`), notRecorded: NOT_RECORDED, groups: {}};
  for (const [g, R] of Object.entries(groups)) res.groups[g] = Object.fromEntries(FIELDS.map(([k]) => [k, slope(R.map(r => r.w?.[k]), R.map(r => r.errPct))]));
  const fmt = (v, d) => Number.isFinite(v) ? v.toFixed(d) : '–';
  const md = ['# Conditions and held-out error', '',
    `Built by \`scripts/sim/condition-report.mjs\` on ${new Date().toISOString().slice(0, 10)} (AGENTS.md Gate G v3.1, item 7) from the production held-out rows`,
    `(${rows.length} rows). Slope = change of held-out lap error (% of the real lap) per unit of the condition, with its 90 % bootstrap interval;`,
    'R² = share of the error variance that condition explains alone. An interval that excludes 0 marks a condition the model may be missing;',
    'it becomes a model term only through a pre-registered gate. Real laps and weather are never changed.', '',
    '| Group | Condition | n | Slope (%/unit) | 90 % interval | R² |', '|---|---|---|---|---|---|'];
  for (const [g, S] of Object.entries(res.groups)) for (const [k, name, unit] of FIELDS) { const s = S[k];
    md.push(`| ${g} | ${name} (${unit}) | ${s.n} | ${fmt(s.b, 4)} | ${fmt(s.ci90[0], 4)} … ${fmt(s.ci90[1], 4)} | ${fmt(s.r2, 2)} |`); }
  md.push('', `Rows without weather: ${res.missingWeather.length ? res.missingWeather.join(', ') : 'none'}.`,
    `Not recorded in the data (cannot be checked yet): ${NOT_RECORDED.join(', ')}.`, '');
  if (arg('--md')) writeFileSync(arg('--md'), md.join('\n'));
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(res, null, 1));
  console.log(md.join('\n'));
}
if (import.meta.url === `file://${process.argv[1]}`) main();
