// Residual signature (AGENTS.md Gate G v3.1, item 6): where the model lap differs from the measured F1 pole lap, by part of the lap.
// Model = the page's model channels for that track and season (measured overlay off); measured = worker/lapsim/f1-real-telemetry-data.js.
// Parts (per track first, then over tracks; one value per track so tracks are the units):
//   corner   corner minimum speed, model / measured, by corner speed band (km/h): < 120, 120–180, 180–240, ≥ 240
//   straight end-of-straight speed (max before a braking zone), model − measured km/h, by straight length: < 400, 400–800, ≥ 800 m
//   brake    braking onset position, model − measured metres (+ = model brakes later), corners losing ≥ 15 m/s
//   decel    peak deceleration in heavy zones, model / measured, by entry speed: 150–250, ≥ 250 km/h
// Corners and zones are matched by share of the lap (±1.5 %). The measured samples are only read (resampling for display is the only
// step; physics rule 2.14 / AGENTS.md "Measured data is never touched").
// Usage: node scripts/sim/residual-signature.mjs [--json out.json] [--md docs/lapsim-signature.md] [--years 2025,2026]
import {writeFileSync} from 'node:fs';
import {lapsimF1RealTel} from '../../worker/lapsim/f1-real-telemetry-data.js';
import {lapsimF1WetQuali} from '../../worker/lapsim/f1-wet-quali-data.js';
import {isLockedF1} from './locked-set.mjs';
import {cleanTel} from '../../worker/lapsim/real-tel-gaps.js';

const arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null;
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
export const BANDS = {corner: [0, 120, 180, 240, Infinity], straight: [0, 400, 800, Infinity], decel: [150, 250, Infinity]};
const band = (edges, x) => { for (let i = 0; i < edges.length - 1; i++) if (x >= edges[i] && x < edges[i + 1]) return i; return -1; };

// events of one lap: x (m), v (m/s), brake (any unit), L (lap length, m)
export function lapEvents(x, v, br, L) {
  const n = v.length, t = [0]; for (let i = 1; i < n; i++) t.push(t[i - 1] + Math.max(0, x[i] - x[i - 1]) / Math.max(1, (v[i] + v[i - 1]) / 2));
  const win = (i, s) => { let j = i; if (s > 0) while (j < n - 1 && t[j] - t[i] < s) j++; else while (j > 0 && t[i] - t[j] < -s) j--; return j; };
  const corners = [];
  for (let i = 1; i < n - 1; i++) {
    const a = win(i, -2), b = win(i, 2); let mn = Infinity; for (let j = a; j <= b; j++) mn = Math.min(mn, v[j]);
    if (v[i] !== mn || v[i - 1] === v[i]) continue;
    const p0 = win(i, -8); let vin = 0, ivin = p0; for (let j = p0; j < i; j++) if (v[j] > vin) { vin = v[j]; ivin = j; }
    if (vin - v[i] < 5) continue;
    let pk = 0; for (let j = ivin; j <= i; j++) pk = Math.max(pk, br[j]);
    let on = NaN; if (pk > 0) { for (let j = ivin; j <= i; j++) if (br[j] > 0.05 * pk) { on = x[j]; break; } }
    let dmax = 0; for (let j = ivin + 1; j <= i; j++) { const dt = t[j] - t[j - 1]; if (dt > 0) dmax = Math.max(dmax, (v[j - 1] - v[j]) / dt); }
    const prev = corners.at(-1), straight = x[ivin] - (prev ? prev.x : x[0]);
    corners.push({s: x[i] / L, x: x[i], vmin: v[i] * 3.6, vend: vin * 3.6, straight, onShare: on / L, lost: vin - v[i], decel: dmax / 9.81});
  }
  return corners;
}
const match = (M, P) => M.map(m => { let best = null, d = 0.015; for (const p of P) { const e = Math.min(Math.abs(p.s - m.s), 1 - Math.abs(p.s - m.s)); if (e < d) { d = e; best = p; } } return best && [m, best]; }).filter(Boolean);

export function trackSignature(M, P, L) {
  const pairs = match(M, P), out = {corner: [[], [], [], []], straight: [[], [], []], brake: [], decel: [[], []]};
  for (const [m, p] of pairs) {
    const cb = band(BANDS.corner, m.vmin); if (cb >= 0) out.corner[cb].push(p.vmin / m.vmin);
    const sb = band(BANDS.straight, m.straight); if (sb >= 0 && m.straight > 100) out.straight[sb].push(p.vend - m.vend);
    if (m.lost >= 15 && Number.isFinite(m.onShare) && Number.isFinite(p.onShare)) {
      out.brake.push(((p.onShare - m.onShare + 1.5) % 1 - 0.5) * L);
      const db = band(BANDS.decel, m.vend); if (db >= 0 && m.decel > 0) out.decel[db].push(p.decel / m.decel);
    }
  }
  return {n: pairs.length, corner: out.corner.map(med), straight: out.straight.map(med), brake: med(out.brake), decel: out.decel.map(med)};
}

async function main() {
  const {simulationPage, lapsimScript} = await import('../../worker/simulation.js');
  const js = lapsimScript(), body = js.slice('(()=>{'.length, js.lastIndexOf(';('));
  const V = new Function(body + ';return {K,computeView,R:{renderMap,renderTrace,evolutionDelta,evolutionCurve,lineTrack,brakeZones,lapChannels,blendLine,blendOff}};')();
  const page = (track, car) => {
    const d = JSON.parse(simulationPage({track, car}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); if (d.carId !== car) return null; d.realTel = null;
    const v = V.computeView(V.K, d, {carId: car, compareId: '', compareIds: [], mode: 'real', manual: {}, active: {}, strength: 1, sm: 'normal', ot: true, drs: true, evo: {type: 'qualifying', tyre: '', useCurve: true, over: {}}}, V.R);
    const lane = k => v.tel.lanes.find(l => l.key === k), sp = lane('speed'), n = sp.ser[0].v.length, ds = sp.ds, L = n * ds;
    const brk = lane('brake').ser[0].v.filter((_, k) => k % 2 === 0);
    return {L, ev: lapEvents(Array.from({length: n}, (_, i) => i * ds), sp.ser[0].v.map(x => x / 3.6), brk, L)};
  };
  const years = (arg('--years') || '2025,2026').split(','), res = {};
  for (const y of years) {
    const rows = [];
    // wet or damp qualifying (f1-wet-quali-data.js: the sessions the dry fit leaves out) is not compared with the dry model
    for (const tr of Object.keys(lapsimF1RealTel).filter(t => lapsimF1RealTel[t][y] && !lapsimF1WetQuali[t]?.[y] && !isLockedF1(t, y))) {
      const r = lapsimF1RealTel[tr][y], L = r.len, x = r.f.map(f => f / 1e4 * L), P = page(tr, y);
      if (!P) continue;
      // broken stretches of the file are left out, and events within 150 m of one (real-tel-gaps.js, owner 2026-11-22)
      const c = cleanTel(r), M = lapEvents(c.x, c.speed.map(s => s / 3.6), c.brake.map(Number), L).filter(e => !c.near(e.x)), sig = trackSignature(M, P.ev, L);
      rows.push({track: tr, ...sig}); console.log(y, tr, JSON.stringify(sig));
    }
    const over = k => (i => med(rows.map(r => i == null ? r[k] : r[k][i])));
    res[y] = {tracks: rows.length, corner: [0, 1, 2, 3].map(over('corner')), straight: [0, 1, 2].map(over('straight')), brake: over('brake')(), decel: [0, 1].map(over('decel')), rows};
  }
  const f = (a, d = 3) => a.map(x => Number.isFinite(x) ? x.toFixed(d) : '–').join(' / ');
  const md = ['# Residual signature (model vs measured F1 pole laps)', '',
    `Built by \`scripts/sim/residual-signature.mjs\` on ${new Date().toISOString().slice(0, 10)} (AGENTS.md Gate G v3.1, item 6). Median over tracks of the`,
    'per-track median. Corner and decel are model / measured; straight is model − measured km/h; brake is model − measured metres',
    '(+ = model brakes later). A physics change reports this table before and after; no part may get worse beyond its own noise.',
    'Limits: measured pole telemetry is about 7.5 Hz, so its corner minima read a little high (B1: about +1.3 km/h on the model side) and its',
    'peak deceleration reads low (a short peak falls between samples): decel ratios above 1 are partly sampling. F1 brake is on/off, so brake',
    'onset is the first sample with the brake on.', '',
    '| Season | Tracks | Corner min < 120 / 120–180 / 180–240 / ≥ 240 km/h | End-of-straight Δ < 400 / 400–800 / ≥ 800 m | Brake onset Δ (m) | Peak decel 150–250 / ≥ 250 km/h |',
    '|---|---|---|---|---|---|',
    ...years.map(y => `| ${y} | ${res[y].tracks} | ${f(res[y].corner)} | ${f(res[y].straight, 1)} | ${Number.isFinite(res[y].brake) ? res[y].brake.toFixed(0) : '–'} | ${f(res[y].decel)} |`), ''];
  if (arg('--md')) writeFileSync(arg('--md'), md.join('\n'));
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(res, null, 1));
  console.log(md.join('\n'));
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
