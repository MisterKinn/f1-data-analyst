// Compact summary of a calibration run for experiments: F1 holdout per season, WEC holdout per class/season
// (WEC uses the F1 track factors, so its holdout is the "WEC predicted from F1" test), parameters at bounds,
// track factor range. node scripts/sim/exp-summary.mjs [name] → probe-out/exp-<name>.json
import {writeFileSync, mkdirSync} from 'node:fs';
const name = process.argv[2] || 'run';
const {lapsimCalibration: c} = await import(`../../worker/lapsim/calibration-data.js?${Date.now()}`);
const out = {name, f1: {}, wec: {}, trackGrip: {}, trackDrag: {}};
for (const [y, s] of Object.entries(c.seasons || {})) {
  if (s.holdout?.rmsPct != null) out.f1[y] = {holdoutPct: s.holdout.rmsPct, inSamplePct: rms(Object.values(s.tracks || {}).map(t => t.errorSec / t.realLap * 100))};
  for (const [id, t] of Object.entries(s.tracks || {})) { out.trackGrip[id] = t.grip; if (t.drag != null) out.trackDrag[id] = t.drag; }
}
for (const [cls, ys] of Object.entries(c.series?.wec || {})) for (const [y, v] of Object.entries(ys))
  out.wec[`${cls}/${y}`] = {holdoutPct: v.holdout?.rmsPct, bop: v.bop, pooled: v.pooled, inSamplePct: rms(Object.values(v.tracks || {}).map(t => t.errorSec / t.realLap * 100)), car: {muY: v.car.muY, clA: v.car.clA, cdA: v.car.cdA}};
const g = Object.values(out.trackGrip); out.gripRange = g.length ? [Math.min(...g), Math.max(...g)] : null;
mkdirSync('probe-out', {recursive: true}); writeFileSync(`probe-out/exp-${name}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({name, f1: out.f1, wec: Object.fromEntries(Object.entries(out.wec).map(([k, v]) => [k, v.holdoutPct])), gripRange: out.gripRange}));
function rms(a) { a = a.filter(Number.isFinite); return a.length ? +Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length).toFixed(3) : null; }
