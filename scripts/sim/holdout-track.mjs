// Level C: unseen-track test (AGENTS.md "Unraced tracks", owner 2026-11-22). Each raced track is hidden at once from every season, class
// and series: its own lap-time terms are removed (F1 track grip and drag factor, WEC track grip snapshot, learned time scale, the sector
// or lap correction to the real lap; kerbs and bumps change only the map), and the lap is predicted the way a new track is predicted:
// the production car (inputs pinned, no refit) on the class-mean factor of the other tracks (geometric mean of the same season / class),
// through the page's own lap path (computeView, real session weather). Reported: RMS and median absolute error (%) per class.
// Usage: node scripts/sim/holdout-track.mjs [--json out.json]
import {writeFileSync} from 'node:fs';
import {simulationPage, lapsimScript} from '../../worker/simulation.js';
import {lapsimCalibration as CAL} from '../../worker/lapsim/calibration-data.js';
import {lapsimWecTrackGrip} from '../../worker/lapsim/wec-track-grip-data.js';
import {carStartOptions} from '../../worker/lapsim/view-keys.js';
import {isLockedF1, isLockedSeason} from './locked-set.mjs';

const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
export const gmean = a => Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length);
export const stats = e => { const a = e.map(Math.abs).sort((x, y) => x - y); return {n: e.length, rmsPct: +Math.sqrt(e.reduce((s, x) => s + x * x, 0) / e.length).toFixed(3), medAbsPct: +((a[(a.length - 1) >> 1] + a[a.length >> 1]) / 2).toFixed(3)}; };
// raw lap of one car on one track with its own terms removed (no correction to the real lap, no learned time scale)
export const predict = (id, carId, override) => {
  const d = JSON.parse(simulationPage({track: id, car: carId}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
  if (d.carId !== carId) return null;
  const c = d.cars[carId]; Object.assign(c, override); delete c.fix; delete c.timeScale; delete c.learned;
  const real = d.conds[c.series ? carId : String(c.year)]; if (!real?.realLap || real.rain) return null;
  const v = V.computeView(V.K, d, {carId, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}, ...carStartOptions(d, carId)}, V.R);
  const [m, s] = v.lap.split(':'), lap = s ? +m * 60 + +s : +m;
  return {real: real.realLap, sim: lap, errPct: (lap - real.realLap) / real.realLap * 100};
};
if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = {}, out = {};
  // F1: every calibrated season; the hidden track gets the season's mean grip and mean drag factor of the other tracks
  for (const y of ['2025', '2026']) {
    const T = CAL.seasons?.[y]?.tracks || {}, ids = Object.keys(T).filter(id => T[id].grip != null), car = CAL.seasons[y].car;
    for (const id of ids.filter(x => !isLockedF1(x, y))) { // locked set (AGENTS.md v3.1): never held out
      const o = ids.filter(x => x !== id), g = gmean(o.map(x => T[x].grip)), dr = gmean(o.map(x => T[x].drag ?? 1));
      const p = predict(id, y, {grip: g, car: {...car, cdA: car.cdA * dr, cdALow: (car.cdALow ?? car.cdA) * dr}}); if (!p) continue;
      (rows['f1-' + y] ||= []).push({track: id, ...p}); console.log('f1-' + y, id, p.errPct.toFixed(3));
    }
  }
  // WEC classes (latest calibrated season, as the page): the hidden track gets the mean of the other tracks' frozen WEC grip
  const WG = lapsimWecTrackGrip.grip;
  for (const [cls, seasons] of Object.entries(CAL.series?.wec || {})) {
    const y = Object.keys(seasons).sort().at(-1), ids = isLockedSeason(y) ? [] : Object.keys(seasons[y].tracks || {});
    for (const id of ids) {
      const o = Object.keys(WG).filter(x => x !== id), p = predict(id, 'wec-' + cls, {grip: gmean(o.map(x => WG[x]))}); if (!p) continue;
      (rows['wec-' + cls] ||= []).push({track: id, ...p}); console.log('wec-' + cls, id, p.errPct.toFixed(3));
    }
  }
  for (const [k, r] of Object.entries(rows)) out[k] = stats(r.map(x => x.errPct));
  out.f1 = stats(Object.entries(rows).filter(([k]) => k.startsWith('f1')).flatMap(([, r]) => r.map(x => x.errPct)));
  out.wec = stats(Object.entries(rows).filter(([k]) => k.startsWith('wec')).flatMap(([, r]) => r.map(x => x.errPct)));
  out.all = stats(Object.values(rows).flat().map(x => x.errPct));
  console.log(JSON.stringify(out));
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({summary: out, rows}, null, 1));
}
