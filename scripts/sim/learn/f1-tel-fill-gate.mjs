// Fill of broken telemetry stretches, validation by synthetic blanking (claude/gate-ti-gaps-siteC-prereg-2026-11-22.md §3; Session D
// §5 bounds). The broken windows actually seen in 2026 pole laps (rule A+, telGaps) are cut out of clean pole laps at the same share of
// the lap and filled three ways: the page model of that car and track (scaled by one factor c from the window's two ends, c in
// [0.9, 1.1], ends blended over `blend` s), hold-last and linear. Tuning: blend 0.5 / 1.0 s on 2025 laps. Hold-out: 2026 clean laps,
// once (FILL_HOLDOUT=1). Unit = track. Out: scripts/sim/data/learn/f1-tel-fill-gate-2026-11-22.json
import {writeFileSync} from 'node:fs';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lapsimTracks} from '../../../worker/lapsim/tracks-data.js';
import {carsFor, realConditions} from '../../../worker/lapsim/scenario.js';
import {lapChannels} from '../../../worker/lapsim/channels.js';
import {lapsimF1RealTel} from '../../../worker/lapsim/f1-real-telemetry-data.js';
import {telGaps} from '../../../worker/lapsim/real-tel-gaps.js';
import {signFlip} from '../gate.mjs';

const K = lapsimKernel(), median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (s[(n - 1) >> 1] + s[n >> 1]) / 2 : NaN; };
const WIN = []; for (const ys of Object.values(lapsimF1RealTel)) for (const [y, r] of Object.entries(ys)) if (y === '2026') WIN.push(...telGaps(r));
const OPEN = process.env.FILL_HOLDOUT === '1';
function model(id, year) { // page model lap of that car: speed, gear, brake (on) over the share of the lap
  const td = lapsimTracks[id]; if (!td) return null; const c = carsFor(id)[year]; if (!c) return null;
  const tr = K.trackFromData(td), env = K.conditionsFromWeather(realConditions(id)?.[year] || {}); tr.mu.fill(c.grip);
  const sim = K.simulateLap(tr, c.car, env), ch = lapChannels(tr, c.car, env, sim, {cls: 'f1', seed: id + '|fill'});
  const at = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(f / 1e4 * arr.length))];
  return {v: f => at(sim.v, f) * 3.6, gear: f => at(ch.gear, f), brake: f => at(ch.brakeHuman, f) > 2 ? 1 : 0};
}
function judgeLap(id, year, r, blend) {
  const M = model(id, year); if (!M) return null; const f = r.f, n = f.length, L = r.len, out = [];
  for (const [a, b] of WIN) {
    const ins = []; for (let i = 0; i < n; i++) if (f[i] >= a && f[i] < b) ins.push(i);
    const i0 = ins[0] - 1, i1 = ins.at(-1) + 1; if (!ins.length || i0 < 0 || i1 >= n) continue; // window must have a good sample each side
    const ratio = i => r.speed[i] / Math.max(1, M.v(f[i])), c = Math.min(1.1, Math.max(0.9, (ratio(i0) + ratio(i1)) / 2));
    const vEdge = (i, e) => { const d = Math.abs(f[i] - f[e]) / 1e4 * L, tt = d / Math.max(1, r.speed[e] / 3.6); return Math.max(0, 1 - tt / blend); }; // weight of the true edge
    let se = {m: 0, h: 0, l: 0}, gOk = {m: 0, h: 0, l: 0}, bOn = 0, bHit = {m: 0, h: 0, l: 0};
    for (const i of ins) {
      const w = (f[i] - f[i0]) / (f[i1] - f[i0]), wa = vEdge(i, i0), wb = vEdge(i, i1), mv = c * M.v(f[i]);
      const fm = wa > 0 ? wa * r.speed[i0] + (1 - wa) * mv : wb > 0 ? wb * r.speed[i1] + (1 - wb) * mv : mv;
      const fill = {m: fm, h: r.speed[i0], l: r.speed[i0] + w * (r.speed[i1] - r.speed[i0])};
      const gear = {m: M.gear(f[i]), h: r.gear[i0], l: Math.round(r.gear[i0] + w * (r.gear[i1] - r.gear[i0]))};
      const brk = {m: M.brake(f[i]), h: r.brake[i0] > 0 ? 1 : 0, l: (w < 0.5 ? r.brake[i0] : r.brake[i1]) > 0 ? 1 : 0};
      for (const k of ['m', 'h', 'l']) { se[k] += (fill[k] - r.speed[i]) ** 2; gOk[k] += gear[k] === r.gear[i]; }
      if (r.brake[i] > 0) { bOn++; for (const k of ['m', 'h', 'l']) bHit[k] += brk[k]; }
    }
    out.push({win: [a, b], rmse: Object.fromEntries(Object.entries(se).map(([k, v]) => [k, Math.sqrt(v / ins.length)])), gear: Object.fromEntries(Object.entries(gOk).map(([k, v]) => [k, v / ins.length])),
      brakeR: bOn ? Object.fromEntries(Object.entries(bHit).map(([k, v]) => [k, v / bOn])) : null});
  }
  if (!out.length) return null;
  const agg = key => Object.fromEntries(['m', 'h', 'l'].map(k => [k, median(out.map(o => o[key]?.[k]).filter(Number.isFinite))]));
  return {id, year, windows: out.length, rmse: agg('rmse'), gear: agg('gear'), brakeR: agg('brakeR')};
}
const laps = year => Object.entries(lapsimF1RealTel).filter(([, ys]) => ys[year] && !telGaps(ys[year]).length).map(([id, ys]) => [id, ys[year]]);
const tune = {}; for (const blend of [0.5, 1.0]) { const R = laps('2025').map(([id, r]) => judgeLap(id, 2025, r, blend)).filter(Boolean);
  tune[blend] = {n: R.length, rmse: Object.fromEntries(['m', 'h', 'l'].map(k => [k, +median(R.map(x => x.rmse[k])).toFixed(2)])), gear: +median(R.map(x => x.gear.m)).toFixed(3), brakeR: +median(R.map(x => x.brakeR.m).filter(Number.isFinite)).toFixed(3)}; }
const blend = +Object.keys(tune).sort((a, b) => tune[a].rmse.m - tune[b].rmse.m)[0];
console.log('windows', WIN.length, 'tuning (2025)', JSON.stringify(tune), 'chosen blend', blend);
if (!OPEN) process.exit(0);
const H = laps('2026').map(([id, r]) => judgeLap(id, 2026, r, blend)).filter(Boolean), boot = (a, q) => { let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), b = [];
  for (let i = 0; i < 2000; i++) b.push(median(a.map(() => a[Math.floor(rnd() * a.length)]))); b.sort((x, y) => x - y); return b[Math.floor(q * b.length)]; };
const rm = H.map(x => x.rmse.m), sfH = signFlip(H.map(x => x.rmse.h - x.rmse.m)), sfL = signFlip(H.map(x => x.rmse.l - x.rmse.m));
const res = {n: H.length, rmseMed: +median(rm).toFixed(2), rmseUpper: +boot(rm, 0.9).toFixed(2), holdLast: +median(H.map(x => x.rmse.h)).toFixed(2), linear: +median(H.map(x => x.rmse.l)).toFixed(2),
  gear: +median(H.map(x => x.gear.m)).toFixed(3), brakeR: +median(H.map(x => x.brakeR.m).filter(Number.isFinite)).toFixed(3), vsHold: sfH, vsLinear: sfL};
res.pass = res.n >= 5 && res.rmseMed <= 8 && res.rmseUpper <= 12 && res.gear >= 0.85 && res.brakeR >= 0.8 && sfH.gain > 0 && sfH.p < 0.05 && sfL.gain > 0 && sfL.p < 0.05;
writeFileSync('scripts/sim/data/learn/f1-tel-fill-gate-2026-11-22.json', JSON.stringify({gate: 'fill §3', run: new Date().toISOString(), tune, blend, holdout: res, rows: H}, null, 1) + '\n');
console.log(JSON.stringify(res));
