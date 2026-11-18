// BoP sensitivities (S4): lap-time change per BoP lever, per car and track, from the simulator (not measured).
// Each lever moves alone from the class default: mass -20..+40 kg (5 kg), peak power -30..+30 kW (5 kW); weather default and
// track temperature ±10 °C. Stint energy has no lap-time lever in the kernel (a qualifying lap is not energy-limited), so its
// fallback is the power change that uses the same energy per lap (labelled). Fit per car × track: Δlap = a·Δx + b·Δx² (R²).
// Runs the lap tool in-process (worker/lapsim/tool.js → kernel.js simulateLap, same car, track and conditions as the connector).
// Usage: node scripts/sim/bop-sensitivity.mjs [--check-w5] [--part i/n]   (parts write .cache/bop-sens/part-i.json; no part = merge)
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {simulate} from '../../worker/lapsim/tool.js';
import {realConditions} from '../../worker/lapsim/scenario.js';
import {lapsimStints} from '../../worker/lapsim/stint-data.js';

export const WEC_VENUES = ['austin', 'catalunya', 'fuji', 'imola', 'interlagos', 'le-mans', 'lusail', 'mexico-city', 'monza', 'nurburgring-gp', 'portimao', 'sakhir', 'sebring', 'shanghai', 'silverstone', 'spa-francorchamps'];
export const IMSA_VENUES = ['daytona', 'sebring', 'long-beach', 'laguna-seca', 'detroit', 'watkins-glen', 'mosport', 'lime-rock', 'road-america', 'vir', 'indianapolis', 'road-atlanta'];
const CLASS_CARS = {'wec-lmh': WEC_VENUES, 'wec-lmdh': WEC_VENUES, 'wec-lmgt3': WEC_VENUES, 'imsa-gtp': IMSA_VENUES, 'imsa-gtd': IMSA_VENUES};
const MASS = [-20, -15, -10, -5, 5, 10, 15, 20, 25, 30, 35, 40], POWER = [-30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30], MJ_LAP = [-2, -1.75, -1.5, -1.25, -1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const K_RACE = lapsimStints.k; // race-lap driveshaft energy / simulated qualifying-lap energy (stint-fit.mjs)
const r4 = x => Math.round(x * 1e4) / 1e4;

// W5 MCP points (W5 report, 2026-11-18): default lap and the +10 kW change at the class's default conditions
export const W5_POINTS = [['spa-francorchamps', 'wec-lmh', 119.617, -0.355], ['spa-francorchamps', 'wec-lmdh', 120.246, -0.350], ['spa-francorchamps', 'wec-lmgt3', 136.612, -0.542],
  ['le-mans', 'wec-lmh', 202.982, -0.861], ['le-mans', 'wec-lmdh', 202.559, -0.864], ['le-mans', 'wec-lmgt3', 232.410, -1.366],
  ...[['austin', -0.242, -0.408], ['fuji', -0.228, -0.427], ['imola', -0.300, -0.483], ['lusail', -0.257, -0.404], ['monza', -0.347, -0.553], ['sakhir', -0.254, -0.439], ['sebring', -0.345, -0.581], ['silverstone', -0.268, -0.437]]
    .flatMap(([t, lmh, gt3]) => [[t, 'wec-lmh', null, lmh], [t, 'wec-lmgt3', null, gt3]])];

const lap = (track, car, tt, patch, energy) => simulate({track, car, ...(tt != null ? {track_temp_c: tt} : {})}, {...(patch ? {carPatch: patch} : {}), ...(energy ? {driveEnergy: energy} : {})}).result.lap_seconds;
// least squares Δlap = a·x + b·x² through the origin, R², and whether the response keeps one sign of slope
function fit(xs, ys) {
  let s11 = 0, s12 = 0, s22 = 0, t1 = 0, t2 = 0;
  xs.forEach((x, i) => { s11 += x * x; s12 += x ** 3; s22 += x ** 4; t1 += x * ys[i]; t2 += x * x * ys[i]; });
  const det = s11 * s22 - s12 * s12, a = (s22 * t1 - s12 * t2) / det, b = (s11 * t2 - s12 * t1) / det;
  const m = ys.reduce((p, q) => p + q, 0) / ys.length, ssr = ys.reduce((p, y, i) => p + (y - a * xs[i] - b * xs[i] ** 2) ** 2, 0), sst = ys.reduce((p, y) => p + (y - m) ** 2, 0);
  const o = xs.map((x, i) => [x, ys[i]]).concat([[0, 0]]).sort((p, q) => p[0] - q[0]), d = o.slice(1).map((p, i) => Math.sign(p[1] - o[i][1])).filter(Boolean);
  return {a: +a.toPrecision(5), b: +b.toPrecision(4), r2: sst > 0 ? r4(1 - ssr / sst) : 1, monotonic: d.every(v => v === d[0])};
}
function sweep(track, car, dT) {
  const base = realConditions(track)[car], tt = dT ? (base?.trackTempC ?? 35) + dT : null, e0 = {}, l0 = lap(track, car, tt, null, e0);
  const mass = MASS.map(dx => lap(track, car, tt, c => { c.mass += dx; }) - l0);
  const pe = POWER.map(dx => { const e = {}; return [lap(track, car, tt, c => { c.pIce += dx * 1e3; }, e) - l0, e.mj - e0.mj]; });
  const fm = fit(MASS, mass), fp = fit(POWER, pe.map(p => p[0])), fe = fit(POWER, pe.map(p => p[1]));
  const out = {lap0: r4(l0), lapMJ: r4(e0.mj), mass: fm, power: fp, kgPerKW: r4(-fp.a / fm.a), raw: {mass: mass.map(r4), power: pe.map(p => r4(p[0]))}};
  // energy fallback: race laps use the whole per-lap allowance (K_RACE × qualifying-lap energy), so a ΔMJ allowance is met by the power that changes
  // the race-lap energy by ΔMJ: K_RACE·(e1·ΔP + e2·ΔP²) = ΔMJ, then Δlap from the power fit
  const dP = dMJ => { const A = K_RACE * fe.b, B = K_RACE * fe.a; return Math.abs(A) < 1e-12 ? dMJ / B : (-B + Math.sign(B) * Math.sqrt(B * B + 4 * A * dMJ)) / (2 * A); };
  const ed = MJ_LAP.map(dm => fp.a * dP(dm) + fp.b * dP(dm) ** 2), fE = fit(MJ_LAP, ed);
  out.energy = {...fE, fallback: 'power', kWPerMJLap: r4(dP(1)), mjPerKW: r4(K_RACE * fe.a)};
  out.kgPerMJLap = r4(-fE.a / fm.a);
  return out;
}

const arg = process.argv, main = import.meta.url === new URL(arg[1], 'file://' + process.cwd() + '/').href;
if (main && arg.includes('--check-w5')) {
  const rows = W5_POINTS.map(([t, c, l0, d10]) => { const a = lap(t, c), b = lap(t, c, null, x => { x.pIce += 10e3; }); return {t, c, l0: a, d: r4(b - a), okL: l0 == null || Math.abs(a - l0) <= 0.001, okD: Math.abs(b - a - d10) <= 0.0015, w5: [l0, d10]}; });
  for (const r of rows) console.log(r.okL && r.okD ? 'ok  ' : 'DIFF', r.t, r.c, r.l0, r.d, JSON.stringify(r.w5));
  console.log(rows.filter(r => r.okL && r.okD).length + '/' + rows.length, 'W5 points reproduced');
  process.exit(0);
}
const part = arg.includes('--part') ? arg[arg.indexOf('--part') + 1].split('/').map(Number) : null;
const jobs = Object.entries(CLASS_CARS).flatMap(([car, tracks]) => tracks.map(t => [t, car]));
mkdirSync('.cache/bop-sens', {recursive: true});
if (!main) { /* imported: constants only */ } else if (part) {
  const [i, n] = part, mine = jobs.filter((_, j) => j % n === i), res = {};
  for (const [t, car] of mine) { res[t + '|' + car] = {default: sweep(t, car, 0), cold: sweep(t, car, -10), hot: sweep(t, car, 10)}; console.log(i, t, car, res[t + '|' + car].default.kgPerKW); }
  writeFileSync(`.cache/bop-sens/part-${i}.json`, JSON.stringify(res));
} else {
  const all = {}; for (let i = 0; existsSync(`.cache/bop-sens/part-${i}.json`); i++) Object.assign(all, JSON.parse(readFileSync(`.cache/bop-sens/part-${i}.json`, 'utf8')));
  const tracks = {}; for (const [k, v] of Object.entries(all)) { const [t, car] = k.split('|'); (tracks[t] ||= {})[car] = v; }
  const valid = {mass: [MASS[0], MASS.at(-1)], power: [POWER[0], POWER.at(-1)], energyPerLap: [MJ_LAP[0], MJ_LAP.at(-1)]};
  const meta = {generated: new Date().toISOString().slice(0, 10), method: 'lap tool in-process (kernel simulateLap), one lever at a time from the class default; Δlap = a·Δx + b·Δx²', units: {mass: 'kg', power: 'kW', energy: 'MJ per lap'},
    valid, kRace: K_RACE, energyNote: 'no energy lever in the kernel (qualifying lap not energy-limited): fallback via the power that uses the same energy per race lap', jobs: Object.keys(all).length};
  writeFileSync('worker/lapsim/bop-sensitivity-data.js', `// Generated by scripts/sim/bop-sensitivity.mjs (docs/lapsim-bop-sensitivity.md). Simulator sensitivity, not measured.\nexport const bopSensitivityMeta = ${JSON.stringify(meta)};\nexport const bopSensitivity = ${JSON.stringify(tracks)};\n`);
  console.log('tracks', Object.keys(tracks).length, 'car-track', Object.keys(all).length);
}
