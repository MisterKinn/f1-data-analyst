// GT3 / Hypercar pedal timing matched to the owner's iRacing laps on the page's own output (owner 2026-11-22 10:05: "no real data, so
// sim racing is the reference"; model (iRacing)). For each class: throttle squeeze τ, pick-up lead and brake-off are each picked from a
// grid so the page's timing at the iRacing corners matches best over all mapped tracks; leave-one-track-out gains are reported (Gate G
// numbers for the record, owner decision ships the match). Usage: node scripts/sim/learn/iracing/pedal_calib_page.mjs <results dir> [--json out]
import {readFileSync, writeFileSync} from 'node:fs';
import {simulationPage, lapsimScript} from '../../../../worker/simulation.js';
const dir = process.argv[2], jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null, K = 1.45;
const TRACK = {cota: 'austin', fuji: 'fuji', indianapolis: 'indianapolis', lemans: 'le-mans', longbeach: 'long-beach', mexicocity: 'mexico-city',
  misano: 'misano', montreal: 'montreal', nurburgring: 'nurburgring-gp', roadatlanta: 'road-atlanta', silverstone: 'silverstone', spa: 'spa-francorchamps',
  spielberg: 'spielberg', suzuka: 'suzuka', twinring: 'motegi', zandvoort: 'zandvoort'};
const CLS = [['GT3', 'wec-lmgt3', {up: 0.969, down: 0.871}], ['GTP', 'wec-lmdh', {up: 0.981, down: 0.878}]];
const GRID = {tau: [0.10, 0.20, 0.35, 0.50, 0.70], pick: [0, -0.1, -0.2, -0.3, -0.5], off: [null, -0.15, -0.3, -0.6, -0.9]}, METRIC = {tau: 'rise', pick: 'pick', off: 'off'};
const binOf = kph => kph < 90 ? 0 : kph < 160 ? 1 : 2, med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const L = readFileSync(dir + '/driver_events_corners.csv', 'utf8').trim().split(/\r?\n/), H = L[0].split(','), c = k => H.indexOf(k);
const obs = L.slice(1).map(l => l.split(',')).map(x => ({cls: x[c('cls')], track: TRACK[x[c('track')]], bin: binOf(+x[c('vmin')] * 3.6),
  rise: x[c('rise1090')] === '' || +x[c('rise1090')] >= 4 ? NaN : +x[c('rise1090')], pick: x[c('tPick10')] === '' ? NaN : +x[c('tPick10')],
  off: x[c('brake')] === '1' && x[c('tBrakeOff')] !== '' ? +x[c('tBrakeOff')] : NaN})).filter(o => o.track);
function corners(x, vs, th, br) { // as driver_gate_page.mjs / f1-driver-gate.mjs
  const n = vs.length, t = [0]; for (let i = 1; i < n; i++) t.push(t[i - 1] + Math.max(0, x[i] - x[i - 1]) / Math.max(1, (vs[i] + vs[i - 1]) / 2));
  const idx = (i0, dtS) => { let j = i0; if (dtS > 0) while (j < n - 1 && t[j] - t[i0] < dtS) j++; else while (j > 0 && t[i0] - t[j] < -dtS) j--; return j; };
  const out = [];
  for (let i = 1; i < n - 1; i++) {
    const a = idx(i, -2), b = idx(i, 2); let mn = Infinity; for (let j = a; j <= b; j++) mn = Math.min(mn, vs[j]); if (vs[i] !== mn || vs[i - 1] === vs[i]) continue;
    const p0 = idx(i, -8); let vin = 0; for (let j = p0; j < i; j++) vin = Math.max(vin, vs[j]); if (vin - vs[i] < 5) continue;
    const cc = {bin: binOf(vs[i] * 3.6), rise: NaN, pick: NaN, off: NaN};
    let pk = 0; for (let j = p0; j <= i; j++) pk = Math.max(pk, br[j]);
    if (pk > 0) { let j = i; while (j > p0 && !(br[j] > 0.05 * pk)) j--; if (br[j] > 0.05 * pk) cc.off = t[j] - t[i]; }
    const w0 = idx(i, -3), w1 = idx(i, 1); let tm = Infinity; for (let j = w0; j <= w1; j++) tm = Math.min(tm, th[j]);
    if (tm <= 0.9) { let km = w0; for (let j = w0; j <= w1; j++) if (th[j] <= tm + 0.02) km = j; const end = idx(km, 6);
      const first = lv => { for (let j = km; j <= end; j++) if (th[j] >= lv) return j; return -1; }, k10 = first(tm + 0.1 * (1 - tm)), k90 = first(tm + 0.9 * (1 - tm));
      if (k10 >= 0) cc.pick = t[k10] - t[i]; if (k10 >= 0 && k90 >= 0 && t[k90] - t[k10] < 4) cc.rise = t[k90] - t[k10]; }
    out.push(cc);
  }
  return out;
}
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const pageCorners = (track, car, drv) => {
  const d = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); if (d.carId !== car) return null;
  const R = {...V.R, lapChannels: (a, b, cc, e, o) => V.R.lapChannels(a, b, cc, e, {...o, drv})};
  const v = V.computeView(V.K, d, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, R);
  const Ln = k => v.tel.lanes.find(l => l.key === k), sp = Ln('speed'), n = sp.ser[0].v.length;
  return corners(Array.from({length: n}, (_, i) => i * sp.ds), sp.ser[0].v.map(x => x / 3.6), Ln('throttle').ser[0].v.filter((_, k) => k % 2 === 0).map(x => x / 100), Ln('brake').ser[0].v.filter((_, k) => k % 2 === 0));
};
const err = (O, P, q) => { const all = med(P.map(x => x[q])); return med(O.filter(o => Number.isFinite(o[q])).map(o => { const b = med(P.filter(x => x.bin === o.bin).map(x => x[q])); return Math.abs(o[q] - (Number.isFinite(b) ? b : all)); })); };
const stat = a => { const mu = a.reduce((s, x) => s + x, 0) / a.length, se = Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / (a.length - 1) / a.length); return {tracks: a.length, gain: +mu.toFixed(4), se: +se.toFixed(4), pass: a.length >= 5 && mu - K * se > 0}; };
const result = {};
for (const [cls, car, base] of CLS) {
  const O = obs.filter(o => o.cls === cls), tracks = [...new Set(O.map(o => o.track))], E = {};
  for (const tr of tracks) { const te = O.filter(o => o.track === tr), b = pageCorners(tr, car, base); if (!b) continue;
    E[tr] = {base: {rise: err(te, b, 'rise'), pick: err(te, b, 'pick'), off: err(te, b, 'off')}};
    for (const [p, g] of Object.entries(GRID)) E[tr][p] = g.map(x => err(te, pageCorners(tr, car, {...base, [p]: x}), METRIC[p]));
    console.log(cls, tr, JSON.stringify(E[tr].base), Object.keys(GRID).map(p => E[tr][p].map(x => x.toFixed(2)).join(' ')).join(' | ')); }
  const T = Object.keys(E), r = {base};
  for (const [p, g] of Object.entries(GRID)) { const q = METRIC[p], mean = (j, set) => set.reduce((s, x) => s + (E[x][p][j] ?? 0), 0) / set.length;
    let bj = 0; for (let j = 1; j < g.length; j++) if (mean(j, T) < mean(bj, T)) bj = j;
    const gains = T.map(tr => { const o = T.filter(x => x !== tr); let k = 0; for (let j = 1; j < g.length; j++) if (mean(j, o) < mean(k, o)) k = j; return E[tr].base[q] - E[tr][p][k]; }).filter(Number.isFinite);
    r[p] = {value: g[bj], errAt: +mean(bj, T).toFixed(3), loto: stat(gains), gains: gains.map(x => +x.toFixed(4))}; }
  result[cls] = r; console.log(cls, JSON.stringify(r));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 1));
