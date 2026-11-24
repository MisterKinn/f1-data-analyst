// Pedal-timing metrics of a lap, model (page) or measured (step 26; Project claude/status-2026-11-24-step26-pedals.md). Same functions as
// the step-26 diagnostic pedal-gap.mjs (sha256 fbd02888…ae876), moved here so the gate and the step-28 export share them.
// page(track, car, drvF1): the page's shown channels for that track and car (measured overlay off), with DRV.f1 optionally replaced.
import {simulationPage, lapsimScript} from '../../../worker/simulation.js';

const G = 9.81;
export const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
export const BIN = kph => kph < 90 ? 0 : kph < 160 ? 1 : 2;
const PROD_F1 = 'const DRV = {f1: {off: -0.598, up: 0.771, down: 0.675}';
const views = new Map();
function view(drvF1) {
  const key = drvF1 ? JSON.stringify(drvF1) : '';
  if (!views.has(key)) {
    const js = lapsimScript(); let body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
    if (drvF1) { if (!body.includes(PROD_F1)) throw new Error('DRV.f1 literal not found: production table changed'); body = body.replace(PROD_F1, 'const DRV = {f1: ' + JSON.stringify(drvF1)); }
    views.set(key, new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')());
  }
  return views.get(key);
}
const pages = new Map();
export function page(track, car, drvF1 = null) {
  if (!pages.has(track + car)) pages.set(track + car, simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
  const d = JSON.parse(pages.get(track + car)); if (d.carId !== car) return null; // parsed fresh: the view may write into it
  const V = view(drvF1), dd = {...d, realTel: null};
  const v = V.computeView(V.K, dd, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, V.R);
  const lane = k => v.tel.lanes.find(l => l.key === k).ser[0].v;
  const sp = lane('speed'), n = sp.length, ds = d.track.ds, th = lane('throttle'), br = lane('brake'), N = th.length;
  const x = Array.from({length: N}, (_, k) => k * ds * n / N), spd = x.map((_, k) => { const i = Math.floor(k * n / N), f = k * n / N - i; return (1 - f) * sp[i] + f * sp[(i + 1) % n]; });
  return {L: n * ds, kappa: d.track.kappa, x, v: spd.map(s => s / 3.6), th, brOn: br.map(b => b > 2 ? 1 : 0), // > 2 bar: the page's own "brake on" (channels.js)
    guard: JSON.stringify([sp, br])}; // speed and brake lanes: must not change with the throttle table
}
export const kapOf = kappa => { const nk = kappa.length; return s => { const u = ((s % 1) + 1) % 1 * nk, i = Math.floor(u) % nk, f = u - Math.floor(u); return (1 - f) * kappa[i] + f * kappa[(i + 1) % nk]; }; };

// one lap -> metrics. x m, v m/s, th 0-100, brOn 0/1, L lap length, kap(share) curvature 1/m
export function metrics(x, v, th, brOn, L, kap) {
  const n = v.length, t = [0]; for (let i = 1; i < n; i++) t.push(t[i - 1] + Math.max(0, x[i] - x[i - 1]) / Math.max(1, (v[i] + v[i - 1]) / 2));
  const dt = i => i + 1 < n ? t[i + 1] - t[i] : 0;
  let part = 0; for (let i = 0; i < n; i++) if (th[i] > 5 && th[i] < 95) part += dt(i); part /= t[n - 1]; // partial-throttle share (5-95 %)
  const win = (i, s) => { let j = i; if (s > 0) while (j < n - 1 && t[j] - t[i] < s) j++; else while (j > 0 && t[i] - t[j] < -s) j--; return j; };
  const dec = v.map((_, i) => { const a = win(i, -0.13), b = win(i, 0.13); return t[b] > t[a] ? -(v[b] - v[a]) / (t[b] - t[a]) / G : 0; });
  const lat = v.map((vi, i) => vi * vi * Math.abs(kap(x[i] / L)) / G);
  const corners = [];
  for (let i = 1; i < n - 1; i++) {
    const a = win(i, -2), b = win(i, 2); let mn = Infinity; for (let j = a; j <= b; j++) mn = Math.min(mn, v[j]);
    if (v[i] !== mn || v[i - 1] === v[i]) continue;
    const p0 = win(i, -8); let vin = 0, iv = p0; for (let j = p0; j < i; j++) if (v[j] > vin) { vin = v[j]; iv = j; }
    if (vin - v[i] < 5) continue;
    const c = {s: x[i] / L, kph: v[i] * 3.6, lost: vin - v[i]};
    const e = win(i, 4); let j90 = -1; for (let j = i; j <= e; j++) if (th[j] >= 90) { j90 = j; break; } // rise 10 -> 90 %
    if (j90 > 0) { let j10 = j90; while (j10 > p0 && th[j10] >= 10) j10--;
      if (th[j10] < 10 && j10 >= win(i, -3)) { const cr = (lv, a, b) => t[a] + (t[b] - t[a]) * (lv - th[a]) / Math.max(1e-9, th[b] - th[a]);
        c.rise = cr(90, j90 - 1, j90) - cr(10, j10, j10 + 1); } }
    if (c.lost >= 15) { let both = 0, tot = 0; for (let j = iv; j < i; j++) { tot += dt(j); if (dec[j] > 1 && lat[j] > 1) both += dt(j); } c.trail = tot > 0 ? both / tot : NaN; }
    let jb = -1; for (let j = iv; j <= Math.min(n - 1, win(i, 2)); j++) if (brOn[j]) jb = j; // brake off -> throttle on
    if (jb >= 0 && jb >= iv) { const tOff = t[jb + 1 < n ? jb + 1 : jb]; let jt = -1; for (let j = jb + 1; j <= win(jb, 5); j++) if (th[j] > 10) { jt = j; break; }
      if (jt > 0) { c.gap = t[jt] - tOff; c.offApex = tOff - t[i]; c.onApex = t[jt] - t[i]; } }
    corners.push(c);
  }
  return {part, corners};
}
// measured corners matched to model corners by share of the lap (+-1.5 %), as residual-signature.mjs
export function pairs(M, S) {
  const out = []; for (const m of M) { let best = null, d = 0.015; for (const p of S) { const e = Math.min(Math.abs(p.s - m.s), 1 - Math.abs(p.s - m.s)); if (e < d) { d = e; best = p; } } if (best) out.push([m, best]); }
  return out;
}
