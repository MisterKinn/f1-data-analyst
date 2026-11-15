// Estimated FIA "Power Unit Information" for every circuit without one (owner 2026-11-16: "as if I were the race director", 2026 rules
// from round 4 on). Rules learned from the 20 real 2026 documents (worker/lapsim/pu-docs-data.js), one track held out at a time:
// - qualifying recharge limit = 4.36 + 0.92 × braking energy per lap (MJ, simulated 2026 car, no limit) − 0.43 × power-limited distance
//   (km), to 0.5 MJ, 5–9 MJ (mean error 0.4 MJ, 9 of 20 exact)
// - power-limited distance = full-throttle distance − 1000 m (mean error 290 m); rate limit 50 kW/s above 3500 m, else 100 kW/s (C5.12.6)
// - race 7.0 MJ when qualifying ≤ 5.5, 8.0 when ≤ 6.5, else 8.5 (all 19 documents); Overtake active and practice +0.5; out laps 9 (8.5 when
//   race is 8.0)
// - qualifying-only large-cut [350 kW] and reset sectors: the exit of the last corner onto the start straight (16 of 17 documents)
// - Alt 1 (Sprint and Race) and large-cut sectors: twisty sections, stretches of 500 m or more with no full-throttle run of 400 m, outside
//   the Straight Mode zones
// - Overtake detection and activation: the 2026 zone marks (worker/lapsim/f1-zones-data.js)
// Out: worker/lapsim/pu-est-data.js. Run: node scripts/sim/pu-estimate.mjs
import {writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../worker/lapsim/tracks.js';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {lapsimPuDocs} from '../../worker/lapsim/pu-docs-data.js';
import {lapsimF1Zones} from '../../worker/lapsim/f1-zones-data.js';

const K = lapsimKernel(), out = {};
const half = x => Math.min(9, Math.max(5, Math.round(x * 2) / 2));
for (const id of Object.keys(T)) {
  if (id.startsWith('fe-') || lapsimPuDocs.events[id]) continue;
  const d = T[id], car = carsFor(id)['2026']?.car; if (!car) continue;
  let r; try { r = K.simulateLap({...K.trackFromData(d), otOn: true}, car, K.conditionsFromWeather({rechargeMJ: 99})); } catch { continue; }
  const n = r.v.length, ds = d.ds, L = n * ds, full = r.limit.filter(x => x === 1 || x === 2).length * ds, regen = r.energy.regenJ / 1e6;
  const pld = Math.max(500, Math.round((full - 1000) / 10) * 10), q = half(4.36 + 0.92 * regen - 0.43 * pld / 1000);
  const race = q <= 5.5 ? 7 : q <= 6.5 ? 8 : 8.5;
  // full-throttle runs (index ranges)
  const runs = []; for (let i = 0; i < n;) { if (!(r.limit[i] === 1 || r.limit[i] === 2)) { i++; continue; } let j = i; while (j < n && (r.limit[j] === 1 || r.limit[j] === 2)) j++; runs.push([i * ds, j * ds]); i = j; }
  if (runs.length > 1 && runs[0][0] === 0 && runs.at(-1)[1] >= L - ds) { runs[0][0] = runs.at(-1)[0] - L; runs.pop(); } // a run across the line
  const last = runs.find(([a, b]) => a <= 0 && b > 0) || runs.at(-1), ex = Math.round(((last[0] % L) + L) % L);
  const sm = (lapsimF1Zones.tracks?.[id]?.['2026']?.zones || []).map(z => [z.from, z.to]), inSm = s => sm.some(([a, b]) => b >= a ? s >= a && s <= b : s >= a || s <= b);
  // twisty stretches: no full-throttle run of 400 m, 500 m or longer, outside SM zones
  const long = runs.filter(([a, b]) => b - a >= 400), twisty = [];
  for (let k = 0; k < long.length; k++) { const a = long[k][1], b = k + 1 < long.length ? long[k + 1][0] : long[0][0] + L; if (b - a >= 500) { const from = Math.round(a % L), to = Math.round(b % L); if (!inSm(from) && !inSm(to)) twisty.push({sector: 'estimated', from, to, qOnly: false}); } }
  const marks = lapsimF1Zones.tracks?.[id]?.['2026']?.marks || [], det = marks.find(m => m.kind === 'det'), act = marks.find(m => m.kind === 'act');
  out[id] = {est: true, event: null, raceMJ: race, raceOvertakeMJ: race + 0.5, qualiMJ: q, practiceMJ: race + 0.5, outLapMJ: race === 8 ? 8.5 : 9, centrelineKm: +(L / 1000).toFixed(3),
    alt: twisty, bigCut: [...twisty.map(z => ({...z, maxKW: 350})), {sector: '[last corner exit]', from: ex, to: Math.round((ex + 250) % L), qOnly: true, maxKW: 350}],
    reset: [{sector: '[last corner exit]', from: ex, to: Math.round((ex + 300) % L), qOnly: true}], speed: [],
    overtake: det && act ? {detectionM: det.s, activationM: act.s, tbc: false} : null, powerLimitedDistanceM: pld, rampKWs: pld > 3500 ? 50 : 100,
    basis: {brakeEnergyMJ: +regen.toFixed(2), fullThrottleM: Math.round(full)},
    document: {title: 'Estimated Power Unit Information (rule learned from the 20 FIA 2026 documents; round-4 rules)', url: '', published: null}};
}
const note = 'Estimated FIA Power Unit Information for circuits without one (owner 2026-11-16), scripts/sim/pu-estimate.mjs';
writeFileSync(new URL('../../worker/lapsim/pu-est-data.js', import.meta.url), `// ${note}\nexport const lapsimPuEst = ${JSON.stringify({note, tracks: out})};\n`);
console.log(Object.keys(out).length + ' tracks;', Object.entries(out).slice(0, 8).map(([k, e]) => `${k} Q${e.qualiMJ}/R${e.raceMJ} PLD ${e.powerLimitedDistanceM} ${e.rampKWs}kW/s alt ${e.alt.length}`).join(' | '));
