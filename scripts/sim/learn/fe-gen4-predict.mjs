// Step 35 (central 18:40 item 3): Gen4 qualifying-lap predictions for every FE layout we have. Prior only: no Gen4 lap is used to fit
// anything. Lap = sim(Gen4 qualifying car, rule hooks on) × exp(G_gen3evo + T_layout) from the Gen3 Evo fit (assumption: the Gen3 Evo
// model bias and each track factor carry over to Gen4). Band = Gen3 Evo event-hidden 90 % band ⊕ Gen4 prior range (grip, HDF aero).
//   LAPSIM_FE_GEN4_RULES=on node scripts/sim/learn/fe-gen4-predict.mjs <fe-data.js> <fe-fit.json> [out.json]
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
import {lapsimFeTracks} from '../../../worker/lapsim/fe-tracks-data.js';
import {modeCar, gripSet, FE_GEN4_AERO, FE_GEN4_MODES} from '../../../worker/lapsim/fe-gen4.js';

const [DATAF, FITF, OUTF] = process.argv.slice(2);
if (process.env.LAPSIM_FE_GEN4_RULES !== 'on') throw new Error('set LAPSIM_FE_GEN4_RULES=on (rule hooks of the Gen4 car)');
const FE = (await import(pathToFileURL(DATAF).href)).lapsimFe, FIT = JSON.parse(readFileSync(FITF, 'utf8'));
const K = lapsimKernel(), ALL = {...lapsimTracks, ...lapsimExtraTracks, ...lapsimFeTracks}, r = (x, d = 3) => +x.toFixed(d);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y), i = p * (s.length - 1), lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const ev = FIT.rows.filter(x => x.key === 'fe-gen3evo').map(x => x.event), bandModel = [q(ev, 0.05), q(ev, 0.95)]; // % (+ = real slower than predicted)
const G = FE.G['fe-gen3evo'], mode = FE_GEN4_MODES.qualifying, base = modeCar('qualifying');
const PRIOR = { // assumption ranges for the Gen4 prior (labelled)
  gripLo: {...base, ...gripSet(1.5)}, gripHi: {...base, ...gripSet(1.7)},                       // Bridgestone tyre: Gen3 Evo 1.5 to +13 %
  aeroTender: {...base, clA: FE_GEN4_AERO.hdf.tender.clA, cdA: FE_GEN4_AERO.hdf.tender.cdA, clALow: FE_GEN4_AERO.hdf.tender.clA, cdALow: FE_GEN4_AERO.hdf.tender.cdA}};
const out = {note: 'Gen4 prior prediction, not fitted to any Gen4 lap; labels: power/axles/mass/regen = rule, grip/aero/eta/G/T carry-over = assumption',
  car: {mode: mode.label, powerKW: mode.powerKW, aero: mode.aero, mass: base.mass, frontMaxW: base.frontMaxW, brakeAxle: base.brakeAxle, muY: base.muY, clA: base.clA, cdA: base.cdA},
  G_gen3evo: G, bandModelPct: bandModel.map(x => r(x, 2)), tracks: {}};
for (const [id, t] of Object.entries(FE.tracks)) { if (!ALL[id] || !t.seasons?.some(s => s >= 2025)) continue;
  const w = t.real?.['fe-gen3evo']?.weather, env = K.conditionsFromWeather({pressureHpa: w?.pressureHpa || 1013.25, airTempC: w?.airTempC || 25, humidityPct: w?.humidityPct || 50, trackTempC: w?.trackTempC || 35, windSpeed: 0, windFromDeg: 0});
  const tr = K.trackFromData(ALL[id]), scale = Math.exp(G + (t.T || 0)), lap = c => K.simulateLap(tr, c, env).lapTime * scale;
  const p = lap(base), pr = Object.fromEntries(Object.entries(PRIOR).map(([k, c]) => [k, (lap(c) / p - 1) * 100]));
  const lo = Math.min(0, ...Object.values(pr)), hi = Math.max(0, ...Object.values(pr));
  // total band: model and prior half-widths added in quadrature on each side (%)
  const bLo = -Math.hypot(bandModel[0], lo), bHi = Math.hypot(bandModel[1], hi);
  out.tracks[id] = {venue: t.venue, lengthM: t.lengthM, predS: r(p), bandS: [r(p * (1 + bLo / 100)), r(p * (1 + bHi / 100))], bandPct: [r(bLo, 2), r(bHi, 2)],
    priorPct: Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, r(v, 2)])), gen3evoBestS: t.real?.['fe-gen3evo']?.lap ?? null,
    gainVsGen3EvoPct: t.real?.['fe-gen3evo']?.lap ? r((p / t.real['fe-gen3evo'].lap - 1) * 100, 2) : null}; }
// Jarama both ways (central 19:00): the only Gen3 Evo row (Madrid 2026 qualifying, cold) stays in the fit; shown with and without its T.
// The official Gen4 test best (83.838 s, Al Kamel S13 test) is a check, not a target.
if (out.tracks.jarama) { const j = out.tracks.jarama, T = FE.tracks.jarama.T || 0, noT = j.predS / Math.exp(T);
  out.jaramaBothWays = {withMadrid2026T: {T, predS: j.predS, bandS: j.bandS}, withoutT: {T: 0, predS: r(noT), bandS: [r(noT * (1 + j.bandPct[0] / 100)), r(noT * (1 + j.bandPct[1] / 100))]},
    officialTestBestS: 83.838, note: 'check only; label: the with-T value is the model, the without-T value is a sensitivity'}; }
// Race pace (central 19:00): primary = constant ratio (Gen3 Evo dry races, n 24, mean race lap / pole 1.0826, leave-one-race-out RMS 2.68 pp,
// 90 % −4.68 … +4.35 pp; assumption: the ratio carries to Gen4). The physics energy model (fe-race-energy.mjs) stays report-only until it beats this.
const RATIO = 1.0826, RB = [-4.68, 4.35];
for (const t of Object.values(out.tracks)) t.racePace = {method: 'constant ratio (primary)', lapS: r(t.predS * RATIO), bandS: [r(t.predS * (RATIO + RB[0] / 100)), r(t.predS * (RATIO + RB[1] / 100))]};
if (OUTF) writeFileSync(OUTF, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
