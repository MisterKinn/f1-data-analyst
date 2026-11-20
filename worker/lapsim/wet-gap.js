// F1 intermediate / full-wet lap: wet lap = same car's dry lap × (1 + gap/100) (W2-F, docs/lapsim-wet-gap.md).
// A past session in the measured table is replayed exactly: one car model's group mean, else the session's
// lap-weighted mean over every car. Anything else uses the constant per compound. The evolution curve is not
// added on top: that failed Gate G (it carries the same wet effect a second time).
import {lapsimWetGap} from './wet-gap-data.js';

const ORDER = ['Practice 1', 'Practice 2', 'Practice 3', 'Sprint Shootout', 'Sprint Qualifying', 'Sprint', 'Qualifying', 'Race'];
// TracingInsights session name → site session type (2021-2022 "Sprint Qualifying" was the sprint race)
export const wetType = (s, y) => /^Practice/.test(s) ? 'practice' : s === 'Race' ? 'race' : s === 'Sprint' || (s === 'Sprint Qualifying' && y <= 2022) ? 'sprint' : 'qualifying';

export function wetGap({track, compound = 'inter', year = null, type = 'qualifying', carModel = null, session = null} = {}) {
  const W = lapsimWetGap, tyre = compound === 'wet' ? 'wet' : 'inter', C = tyre === 'wet' ? 'W' : 'I';
  // session: exact name ("Practice 1") when one type ran wet twice in a weekend; else the latest wet session of that type
  const rows = (W.tracks[track] || []).filter(r => r[0] === +year && r[4] === C && (session ? r[2] === session : wetType(r[2], r[0]) === type));
  const car = carModel && rows.find(r => r[3].toLowerCase() === String(carModel).toLowerCase());
  if (car) return {pct: car[5], basis: 'car', year: car[0], event: car[1], session: car[2], carModel: car[3], laps: car[6], cars: 1};
  if (rows.length) {
    const s = rows.reduce((a, r) => ORDER.indexOf(r[2]) > ORDER.indexOf(a[2]) ? r : a)[2], R = rows.filter(r => r[2] === s), n = R.reduce((a, r) => a + r[6], 0);
    return {pct: Math.round(R.reduce((a, r) => a + r[5] * r[6], 0) / n * 1e4) / 1e4, basis: 'session', year: R[0][0], event: R[0][1], session: s, laps: n, cars: R.length};
  }
  return {pct: W.constants[tyre], basis: 'constant', laps: null, cars: null};
}

// what the /simulation page embeds for one track: constants, errors, and each measured season × session type × tyre
export function wetGapPage(track) {
  const W = lapsimWetGap, past = {};
  for (const r of W.tracks[track] || []) for (const tyre of ['inter', 'wet']) {
    const type = wetType(r[2], r[0]), k = ((past[r[0]] ||= {})[type] ||= {});
    if (!k[tyre]) { const g = wetGap({track, compound: tyre, year: r[0], type}); if (g.basis === 'session') k[tyre] = g; }
  }
  return {c: W.constants, loo: W.test.loo.mae, unseen: W.test.unseen2026.mae, past};
}
