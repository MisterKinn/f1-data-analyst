// Forward-chaining backtest (AGENTS.md Gate G v3.1, owner 2026-11-22): events in time order, each predicted only from earlier events.
// v1 (same lap path as level C, scripts/sim/holdout-track.mjs): the event's own track terms are replaced by what was known before it —
// F1: the latest earlier fitted grip and drag factor of that track (earlier = smaller OpenF1 session key, so 2025 for a 2026 event), else
// the mean of all earlier events' factors (1 for the first events); WEC: the class's previous-season grip at that track, else that season's
// class mean (2025 rows have no earlier WEC season and are left out). No correction to the real lap, no learned time scale.
// Limit of v1: the car is the production car (pinned), not refitted on earlier events only; a per-origin refit is a later version.
// Usage: node scripts/sim/backtest-forward.mjs [--json out.json]
import {writeFileSync} from 'node:fs';
import {lapsimCalibration as CAL} from '../../worker/lapsim/calibration-data.js';
import {predict, gmean, stats} from './holdout-track.mjs';

const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null, rows = {}, out = {};
const F = []; for (const y of ['2025', '2026']) for (const [id, t] of Object.entries(CAL.seasons?.[y]?.tracks || {})) if (t.grip != null && t.sessionKey) F.push({y, id, sk: t.sessionKey, grip: t.grip, drag: t.drag ?? 1});
F.sort((a, b) => a.sk - b.sk);
for (const e of F) {
  const before = F.filter(x => x.sk < e.sk), same = before.filter(x => x.id === e.id).at(-1);
  const g = same ? same.grip : before.length ? gmean(before.map(x => x.grip)) : 1, dr = same ? same.drag : before.length ? gmean(before.map(x => x.drag)) : 1;
  const car = CAL.seasons[e.y].car, p = predict(e.id, e.y, {grip: g, car: {...car, cdA: car.cdA * dr, cdALow: (car.cdALow ?? car.cdA) * dr}}); if (!p) continue;
  (rows['f1-' + e.y] ||= []).push({track: e.id, sessionKey: e.sk, from: same ? 'same track, earlier' : 'mean of earlier events', ...p}); console.log('f1-' + e.y, e.id, p.errPct.toFixed(3));
}
for (const [cls, seasons] of Object.entries(CAL.series?.wec || {})) {
  const ys = Object.keys(seasons).sort(), y = ys.at(-1), prev = ys.at(-2); if (!prev) continue;
  const P = seasons[prev].tracks || {}, mean = gmean(Object.values(P).map(t => t.grip).filter(Number.isFinite));
  for (const id of Object.keys(seasons[y].tracks || {})) {
    const p = predict(id, 'wec-' + cls, {grip: P[id]?.grip ?? mean}); if (!p) continue;
    (rows['wec-' + cls] ||= []).push({track: id, from: P[id] ? 'previous season, same track' : 'previous season mean', ...p}); console.log('wec-' + cls, id, p.errPct.toFixed(3));
  }
}
for (const [k, r] of Object.entries(rows)) out[k] = stats(r.map(x => x.errPct));
out.f1 = stats(Object.entries(rows).filter(([k]) => k.startsWith('f1')).flatMap(([, r]) => r.map(x => x.errPct)));
out.wec = stats(Object.entries(rows).filter(([k]) => k.startsWith('wec')).flatMap(([, r]) => r.map(x => x.errPct)));
out.all = stats(Object.values(rows).flat().map(x => x.errPct));
console.log(JSON.stringify(out));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({summary: out, rows}, null, 1));
