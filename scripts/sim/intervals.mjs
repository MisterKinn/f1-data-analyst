// S4 — prediction ranges and their coverage test. Rows: held-out laps (track left out of the fit) of
// each calibrated group. The range for a group is learned from the OTHER season of the same group
// (never from the rows it is tested on). Two rules, declared before testing:
//   current:   ±k·RMS of the other season's held-out errors, centred on the model (no bias term)
//   candidate: centre shifted by the other season's mean held-out error, width ±k·SD·√(1+1/n)
// Score: Gaussian negative log-likelihood per row (proper score); paired gate on it (gate.mjs, on
// √NLL-gain is not needed: the gate takes per-row losses). Coverage at 1σ / 2σ is reported.
//   node scripts/sim/intervals.mjs [calibration file] → scripts/sim/data/intervals.json
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gate} from './gate.mjs';

export function groups(c) {
  const g = {};
  const add = (key, y, s) => {
    const real = Object.fromEntries(Object.entries(s.tracks || {}).map(([id, t]) => [id, t.realLap]));
    const rows = (s.holdout?.tracks || []).filter(r => real[r.track] > 0).map(r => ({track: r.track, pct: r.errorSec / real[r.track] * 100}));
    if (rows.length) (g[key] ||= {})[y] = rows;
  };
  for (const [y, s] of Object.entries(c.seasons || {})) add('f1', y, s);
  for (const [cls, ys] of Object.entries(c.series?.wec || {})) for (const [y, s] of Object.entries(ys)) add('wec-' + cls, y, s);
  return g;
}
const stats = e => { const n = e.length, m = e.reduce((a, x) => a + x, 0) / n, rms = Math.sqrt(e.reduce((a, x) => a + x * x, 0) / n);
  const sd = n > 1 ? Math.sqrt(e.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) : rms; return {n, mean: m, rms, sd}; };
export const rules = {
  current: s => ({mu: 0, sigma: s.rms}),
  candidate: s => ({mu: s.mean, sigma: s.sd * Math.sqrt(1 + 1 / s.n)}),
};
const nll = (x, {mu, sigma}) => Math.log(sigma) + 0.5 * ((x - mu) / sigma) ** 2;

export function test(c) {
  const out = {method: 'range learned from the other season of the same group, tested on this season\'s held-out laps', groups: {}, all: {}};
  const loss = {current: [], candidate: []}, cover = {current: [0, 0], candidate: [0, 0]};
  let N = 0;
  for (const [key, ys] of Object.entries(groups(c))) for (const y of Object.keys(ys)) {
    const other = Object.keys(ys).filter(k => k !== y);
    if (!other.length) continue;
    const s = stats(other.flatMap(k => ys[k].map(r => r.pct)));
    const row = {rows: ys[y].length, learnedFrom: other, learned: {meanPct: +s.mean.toFixed(3), rmsPct: +s.rms.toFixed(3), sdPct: +s.sd.toFixed(3)}};
    for (const [name, rule] of Object.entries(rules)) {
      const p = rule(s);
      const c1 = ys[y].filter(r => Math.abs(r.pct - p.mu) <= p.sigma).length, c2 = ys[y].filter(r => Math.abs(r.pct - p.mu) <= 2 * p.sigma).length;
      row[name] = {centrePct: +p.mu.toFixed(3), sigmaPct: +p.sigma.toFixed(3), cover1: +(c1 / ys[y].length).toFixed(2), cover2: +(c2 / ys[y].length).toFixed(2)};
      cover[name][0] += c1; cover[name][1] += c2;
      for (const r of ys[y]) loss[name].push(nll(r.pct, p));
    }
    N += ys[y].length;
    out.groups[`${key}/${y}`] = row;
  }
  // gate on per-row NLL: gate() compares squared errors, so pass √(NLL − min) to keep the loss order
  const shift = Math.min(...loss.current, ...loss.candidate);
  const g = gate(loss.current.map(x => Math.sqrt(x - shift)), loss.candidate.map(x => Math.sqrt(x - shift)));
  for (const name of Object.keys(rules)) out.all[name] = {rows: N, cover1: +(cover[name][0] / N).toFixed(2), cover2: +(cover[name][1] / N).toFixed(2),
    meanNll: +(loss[name].reduce((a, x) => a + x, 0) / N).toFixed(3)};
  out.gate = {reason: g.reason, accept: g.accept, n: g.n};
  return out;
}

if (process.argv[1]?.endsWith('intervals.mjs')) {
  const f = resolve(process.argv[2] || 'worker/lapsim/calibration-data.js');
  const {lapsimCalibration} = await import(f);
  const r = test(lapsimCalibration);
  if (!process.argv[2]) writeFileSync('scripts/sim/data/intervals.json', JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r, null, 1));
}
