// Step 35 (central 18:40 item 4): Formula E race energy model, labelled "model", report only. Energy per race by rule (or assumption),
// lift-and-coast approximated by a top-speed cap: each lap may use at most E_net / laps; the cap is lowered until the lap fits.
// Output: predicted race-pace ratio (race lap / pole lap; the G·T scale cancels) vs the measured ratio (fe-race-w12.json, 44,219 laps).
//   LAPSIM_FE_GEN4_RULES=on node scripts/sim/learn/fe-race-energy.mjs [out.json]
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
import {lapsimFeTracks} from '../../../worker/lapsim/fe-tracks-data.js';
import {FE_GENS} from '../../../worker/lapsim/fe-cars.js';
import {lapEnergy, modeCar, FE_GEN4_FIXED} from '../../../worker/lapsim/fe-gen4.js';
import {parseCsv} from './build-endurance.mjs';

const OUTF = process.argv[2], D = 'scripts/sim/data/learn/';
const K = lapsimKernel(), ALL = {...lapsimTracks, ...lapsimExtraTracks, ...lapsimFeTracks}, r = (x, d = 3) => +x.toFixed(d);
const W12 = JSON.parse(readFileSync(D + 'fe-race-w12.json', 'utf8')).events;
// race laps per race: the most laps any car did in that race session (Al Kamel), race_no = order of the season's races by date
const cars = parseCsv(gunzipSync(readFileSync(D + 'fe-cars.csv.gz')).toString()), races = {};
for (const c of cars) if (c.type === 'R') { const k = `${c.season}|${c.session}`; races[k] = Math.max(races[k] || 0, +c.laps || 0); }
const lapsOf = (season, no) => { const s = Object.keys(races).filter(k => k.startsWith(season + '|')).sort(); return s[no - 1] ? races[s[no - 1]] : null; };
const evo = FE_GENS['fe-gen3evo'].car;
const CARS = { // labels: rule = regulation value, assumption = not published
  gen3evo: {pole: {...evo, frontMaxW: 50e3}, race: {...evo, pIce: 300e3, awdAboveKph: null, regen: {maxW: 600e3, share: 0.9, eta: 0.95}, brakeAxle: {rearMaxW: 350e3, eta: 0.95}},
    energyKWh: 38.5, labels: {raceKW: 'rule 300 kW (SR 2024-25)', regen: 'rule 600 kW (TR 7.5)', energy: 'assumption 38.5 kWh (event note value not stored)', laps: 'measured (Al Kamel race rows)'}},
  gen4: {pole: modeCar('qualifying'), race: modeCar('eprix'), energyKWh: FE_GEN4_FIXED.raceEnergyKWh,
    labels: {raceKW: 'rule ≤ 450 kW (SR 27.3 b), Bulletin may lower it', regen: 'rule 700 kW (TR 7.5)', energy: 'rule 51.25 kWh (TR 7.5) or event note', aero: 'assumption LDF in E-Prix (FE_GEN4_MODES)'}}};
const ENV = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0});
function raceLap(tr, car, budgetKWh) { // lift-and-coast stand-in: lower the speed cap until the lap's net energy fits the budget
  const run = c => { const res = K.simulateLap(tr, c, ENV); return {res, e: lapEnergy(res, c, tr).netKWh}; };
  let full = run(car); if (full.e <= budgetKWh) return {lap: full.res.lapTime, eKWh: full.e, capKph: null, saving: false};
  let lo = 30, hi = car.vMax * 3.6, best = null;
  for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2, q = run({...car, vMax: m / 3.6}); if (q.e > budgetKWh) hi = m; else { lo = m; best = q; } }
  return best ? {lap: best.res.lapTime, eKWh: best.e, capKph: lo, saving: true} : {lap: NaN, eKWh: NaN, capKph: null, saving: true}; }
const rows = [];
for (const e of W12) { if (e.gen !== 'Gen3 Evo' || e.weather_class !== 'dry' || !e.race_ratio || !ALL[e.track_key]) continue;
  const season = 2014 + e.season, laps = lapsOf(season, e.race_no); if (!laps) continue;
  const tr = K.trackFromData(ALL[e.track_key]), C = CARS.gen3evo, pole = K.simulateLap(tr, C.pole, ENV).lapTime;
  const one = kwh => { const q = raceLap(tr, C.race, kwh / laps); return {ratio: q.lap / pole, capKph: q.capKph, eKWh: q.eKWh}; };
  const mid = one(C.energyKWh), lo = one(C.energyKWh - 2), hi = one(C.energyKWh + 2);
  rows.push({event: e.event, track: e.track_key, laps, measRatio: r(e.race_ratio, 4), predRatio: r(mid.ratio, 4), errPp: r((mid.ratio - e.race_ratio) * 100, 2),
    capKph: mid.capKph && r(mid.capKph, 1), sensPp: [r((hi.ratio - mid.ratio) * 100, 2), r((lo.ratio - mid.ratio) * 100, 2)]}); }
const err = rows.map(x => x.errPp), mean = a => a.reduce((s, v) => s + v, 0) / a.length, q = (a, p) => { const s = [...a].sort((x, y) => x - y), i = p * (s.length - 1), l = Math.floor(i); return s[l] + (s[Math.ceil(i)] - s[l]) * (i - l); };
const summary = {n: rows.length, biasPp: r(mean(err), 2), rmsPp: r(Math.sqrt(mean(err.map(v => v * v))), 2), band90Pp: [r(q(err, 0.05), 2), r(q(err, 0.95), 2)],
  energySens2kWhPp: r(mean(rows.map(x => (Math.abs(x.sensPp[0]) + Math.abs(x.sensPp[1])) / 2)), 2), measRatioSdPp: r(Math.sqrt(mean(rows.map(x => (x.measRatio - mean(rows.map(y => y.measRatio))) ** 2))) * 100, 2)};
// Gen4 race-pace prediction per layout (model, not fitted): ratio = E-Prix race lap / qualifying lap, laps assumed = Gen3 Evo median of that layout
const gen4 = {};
for (const id of [...new Set(rows.map(x => x.track))]) { const tr = K.trackFromData(ALL[id]), C = CARS.gen4, laps = rows.filter(x => x.track === id).map(x => x.laps).sort((a, b) => a - b)[0];
  const pole = K.simulateLap(tr, C.pole, ENV).lapTime, q2 = raceLap(tr, C.race, C.energyKWh / laps);
  gen4[id] = {lapsAssumed: laps, ratio: r(q2.lap / pole, 4), capKph: q2.capKph && r(q2.capKph, 1), band90Pp: summary.band90Pp}; }
const out = {label: 'model (race energy, lift-and-coast as a speed cap); not fitted', cars: Object.fromEntries(Object.entries(CARS).map(([k, v]) => [k, v.labels])), summary, rows, gen4};
if (OUTF) writeFileSync(OUTF, JSON.stringify(out, null, 1));
console.log(JSON.stringify({summary, gen4}, null, 1));
