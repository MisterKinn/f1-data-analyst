// Gate G (v2) of the learned driver timing against the page's own output (owner 2026-11-22; follow-up of driver_gate.py, whose baselines
// were proxies). Usage: node scripts/sim/learn/iracing/driver_gate_page.mjs <results dir with driver_events_corners.csv> [--json out.json]
// The CSV holds derived numbers from the owner's iRacing laps (driver_events.py); it stays on the PC and is never committed.
// Pre-registered 2026-11-22 09:0x KST, before any page result was looked at:
//  type accuracy; classes GT3 (page car wec-lmgt3, channel class gt3) and GTP (page car wec-lmdh, channel class hyper); held-out unit =
//  iRacing track mapped to a page track; quantities decided separately: throttle rise 10→90 %, throttle pick-up start vs apex, brake off vs
//  apex; m = 1 candidate (class × apex-speed bin medians of the other tracks for the rise, class medians for pick-up and brake off), k =
//  1.45 (three quantities); per held-out track error = median over its iRacing corners of |obs − pred|, pred = the page's median of that
//  quantity over the page's corners in the same speed bin on that track (all bins if the bin has none); gain = baseline page − candidate
//  page; pass if mean gain − 1.45 × SE > 0 over ≥ 5 tracks. Corners on the page found as in driver_events.py (speed minimum over ±2 s,
//  ≥ 5 m/s lost in the 8 s before), measured the same way (brake > 5 % of the zone peak, throttle window apex −3 s … +1 s).
import {readFileSync, writeFileSync} from 'node:fs';
import {simulationPage, lapsimScript} from '../../../../worker/simulation.js';

const dir = process.argv[2], jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const TRACK = {cota: 'austin', fuji: 'fuji', indianapolis: 'indianapolis', lemans: 'le-mans', longbeach: 'long-beach', mexicocity: 'mexico-city',
  misano: 'misano', montreal: 'montreal', nurburgring: 'nurburgring-gp', roadatlanta: 'road-atlanta', silverstone: 'silverstone', spa: 'spa-francorchamps',
  spielberg: 'spielberg', suzuka: 'suzuka', twinring: 'motegi', zandvoort: 'zandvoort'};
const CLASSES = [['GT3', 'wec-lmgt3'], ['GTP', 'wec-lmdh']], K = 1.45, Q = ['rise', 'pick', 'off'];
const binOf = kph => kph < 90 ? 0 : kph < 160 ? 1 : 2, med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
// iRacing corners
const lines = readFileSync(dir + '/driver_events_corners.csv', 'utf8').trim().split(/\r?\n/), head = lines[0].split(','), col = k => head.indexOf(k);
const obs = lines.slice(1).map(l => l.split(',')).map(c => ({cls: c[col('cls')], track: TRACK[c[col('track')]], bin: binOf(+c[col('vmin')] * 3.6),
  rise: c[col('rise1090')] === '' || +c[col('rise1090')] >= 4 ? NaN : +c[col('rise1090')], pick: c[col('tPick10')] === '' ? NaN : +c[col('tPick10')],
  off: c[col('brake')] === '1' && c[col('tBrakeOff')] !== '' ? +c[col('tBrakeOff')] : NaN})).filter(o => o.track);
// the page
const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
const pageCorners = (track, car, drv) => {
  const d = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); if (d.carId !== car) return null;
  const R = {...V.R, lapChannels: (a, b, c, e, o) => V.R.lapChannels(a, b, c, e, {...o, drv})};
  const v = V.computeView(V.K, d, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, R);
  const L = k => v.tel.lanes.find(l => l.key === k), sp = L('speed'), n = sp.ser[0].v.length, ds = sp.ds, vs = sp.ser[0].v.map(x => x / 3.6);
  const t = [0]; for (let i = 1; i < n; i++) t.push(t[i - 1] + ds / Math.max(1, (vs[i] + vs[i - 1]) / 2));
  const th = L('throttle').ser[0].v.filter((_, k) => k % 2 === 0).map(x => x / 100), br = L('brake').ser[0].v.filter((_, k) => k % 2 === 0);
  const idx = (i0, dtS) => { let j = i0; if (dtS > 0) while (j < n - 1 && t[j] - t[i0] < dtS) j++; else while (j > 0 && t[i0] - t[j] < -dtS) j--; return j; };
  const out = [];
  for (let i = 1; i < n - 1; i++) {
    const a = idx(i, -2), b = idx(i, 2); let mn = Infinity; for (let j = a; j <= b; j++) mn = Math.min(mn, vs[j]); if (vs[i] !== mn || vs[i - 1] === vs[i]) continue;
    const p0 = idx(i, -8); let vin = 0; for (let j = p0; j < i; j++) vin = Math.max(vin, vs[j]); if (vin - vs[i] < 5) continue;
    const c = {bin: binOf(vs[i] * 3.6), rise: NaN, pick: NaN, off: NaN};
    let pk = 0; for (let j = p0; j <= i; j++) pk = Math.max(pk, br[j]);
    if (pk > 0) { let j = i; while (j > p0 && !(br[j] > 0.05 * pk)) j--; if (br[j] > 0.05 * pk) c.off = t[j] - t[i]; }
    const w0 = idx(i, -3), w1 = idx(i, 1); let tm = Infinity; for (let j = w0; j <= w1; j++) tm = Math.min(tm, th[j]);
    if (tm <= 0.9) { let km = w0; for (let j = w0; j <= w1; j++) if (th[j] <= tm + 0.02) km = j; const end = idx(km, 6);
      const first = lv => { for (let j = km; j <= end; j++) if (th[j] >= lv) return j; return -1; }, k10 = first(tm + 0.1 * (1 - tm)), k90 = first(tm + 0.9 * (1 - tm));
      if (k10 >= 0) c.pick = t[k10] - t[i]; if (k10 >= 0 && k90 >= 0 && t[k90] - t[k10] < 4) c.rise = t[k90] - t[k10]; }
    out.push(c);
  }
  return out;
};
const err = (O, P, q) => { const all = med(P.map(c => c[q])); return med(O.filter(o => Number.isFinite(o[q])).map(o => { const b = med(P.filter(c => c.bin === o.bin).map(c => c[q])); return Math.abs(o[q] - (Number.isFinite(b) ? b : all)); })); };
const result = {};
for (const [cls, car] of CLASSES) {
  const O = obs.filter(o => o.cls === cls), tracks = [...new Set(O.map(o => o.track))].filter(tr => pageCorners(tr, car, null));
  const g = Object.fromEntries(Q.map(q => [q, []])), rows = [];
  for (const tr of tracks) {
    const trn = O.filter(o => o.track !== tr), te = O.filter(o => o.track === tr);
    const D = {rise: [0, 1, 2].map(b => med(trn.filter(o => o.bin === b).map(o => o.rise))), pick: med(trn.map(o => o.pick)), off: med(trn.map(o => o.off))};
    const base = pageCorners(tr, car, null), cand = pageCorners(tr, car, D), row = {track: tr, n: te.length};
    for (const q of Q) { const eb = err(te, base, q), ec = err(te, cand, q); row[q] = [+eb.toFixed(3), +ec.toFixed(3)]; if (Number.isFinite(eb) && Number.isFinite(ec)) g[q].push(eb - ec); }
    rows.push(row); console.log(cls, JSON.stringify(row));
  }
  const all = O, D = {rise: [0, 1, 2].map(b => +med(all.filter(o => o.bin === b).map(o => o.rise)).toFixed(3)), pick: +med(all.map(o => o.pick)).toFixed(3), off: +med(all.map(o => o.off)).toFixed(3)};
  const verdict = Object.fromEntries(Q.map(q => { const a = g[q], mu = a.reduce((s, x) => s + x, 0) / a.length, se = Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / (a.length - 1) / a.length);
    return [q, {tracks: a.length, gain: +mu.toFixed(3), se: +se.toFixed(3), pass: a.length >= 5 && mu - K * se > 0}]; }));
  result[cls] = {car, table: D, verdict, rows}; console.log(cls, JSON.stringify(verdict), 'table', JSON.stringify(D));
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 1));
