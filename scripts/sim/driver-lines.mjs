// Racing line per F1 driver (owner 2026-11-15), estimated from the driver's own speed trace: public F1 positions are snapped to
// one reference path, so no driven line is measured. For each driver's best clean dry qualifying lap (TracingInsights, FastF1),
// the share of least-curvature vs shortest line is fitted per window of the lap (blendOff, 10 windows) so the shape of the simulated
// speed trace (that season's car, that session's weather, speed / lap mean) matches the driver's: corner minimum speeds, braking
// judged on the minimum speed of every official corner (window of ±80 m around the apex) after one common scale, so car pace and
// the energy deployment on the straights (not line effects) do not drive the fit, and small distance offsets do not matter. Start: the car's own line (blendLine). Test on a lap the fit did not see: the driver's next best clean lap.
// Usage: node scripts/sim/driver-lines.mjs [years] ; LAPSIM_DL_TRACKS=a,b ; LAPSIM_DL_PART=i/k (split tracks across processes).
// Reads raw files from raw.githubusercontent.com/TracingInsights (cached in .cache/ti). Out: <LAPSIM_DL_OUT>/dl-<year>-<track>.json
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lineTrack, blendLine, blendOff} from '../../worker/lapsim/racing-line.js';
import {carsFor, realConditions} from '../../worker/lapsim/scenario.js';
import {lapsimAllTracks} from '../../worker/lapsim/tracks.js';
import {lineData} from '../../worker/simulation.js';
import {tiTrack} from './ti-races.mjs';

const K = lapsimKernel(), C = '.cache/ti', OUT = process.env.LAPSIM_DL_OUT || C, years = (process.argv[2] || '2026').split(',');
const only = process.env.LAPSIM_DL_TRACKS?.split(','), [pi, pk] = (process.env.LAPSIM_DL_PART || '0/1').split('/').map(Number);
const val = v => v === 'None' || v == null ? null : v;
function get(year, p) {
  const f = join(C, 'files', year, p); if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  try { const t = execFileSync('curl', ['-sSf', '--max-time', '30', `https://raw.githubusercontent.com/TracingInsights/${year}/main/${p.split('/').map(encodeURIComponent).join('/')}`], {maxBuffer: 1 << 26}).toString(); mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, t); return JSON.parse(t); } catch { return null; }
}
for (const year of years) {
  const tree = execFileSync('git', ['-c', 'core.quotepath=off', '-C', join(C, year), 'ls-tree', '-r', '--name-only', 'HEAD'], {maxBuffer: 1 << 28}).toString().split('\n');
  const events = [...new Set(tree.filter(p => /\/Qualifying\/[A-Z]{3}\/laptimes\.json$/.test(p)).map(p => p.split('/')[0]))];
  events.filter((e, i) => i % pk === pi).forEach(event => {
    const id = tiTrack(event, +year), L = lineData(id), car = carsFor(id)[year];
    const of = join(OUT, `dl-${year}-${id}.json`);
    if (!L || !car || (only && !only.includes(id)) || existsSync(of)) return; // one file per track: a stopped run resumes
    const w0 = realConditions(id)[year] || {}, env = K.conditionsFromWeather(w0);
    const ref = [L.mid.map(p => p[0]), L.mid.map(p => p[1])], mc = L.base.map(x => x / 10), sp = L.sp.map(x => x / 10);
    const sim = w => { const off = blendOff(mc, sp, w), tr = lineTrack(K, ref[0].map((x, i) => x + L.nrm[i][0] * off[i]), ref[1].map((y, i) => y + L.nrm[i][1] * off[i]), 5); tr.mu.fill(car.grip || 1); return K.simulateLap(tr, car.car, env).v; };
    const shape = v => { const m = v.reduce((a, b) => a + b, 0) / v.length; return v.map(x => x / m); };
    const realShape = tel => { // the driver's speed at the same fractions of the lap as the simulation points
      const d = tel.rel_distance, s = tel.speed, at = n => Array.from({length: n}, (_, i) => { const f = (i + 0.5) / n; let j = 1; while (j < d.length - 1 && d[j] < f) j++; const a = d[j - 1], b = d[j]; return s[j - 1] + (s[j] - s[j - 1]) * ((f - a) / ((b - a) || 1)); });
      const R = n => shape(at(n)); R.abs = at; return R;
    };
    const td = lapsimAllTracks[id], Lm = td.length || td.kappa.length * td.ds;
    // official corners; a track without a corner list (Sakhir, Jeddah, Madring) uses the curvature peaks (radius under 300 m, 150 m apart)
    let cs = (td.corners || []).map(c => c.s / Lm);
    if (cs.length < 4) { const kp = td.kappa.map(k => Math.abs(k) / 1e5), n = kp.length, gap = Math.round(150 / td.ds); cs = [];
      for (let i = 0; i < n; i++) if (kp[i] > 1 / 300 && kp.every((x, j) => Math.abs(j - i) > gap && n - Math.abs(j - i) > gap || x <= kp[i])) cs.push(i / n); }
    const mins = (v, f0) => cs.map(f => { let m = Infinity; const n = v.length; for (let i = Math.floor((f - 80 / Lm) * n); i <= Math.ceil((f + 80 / Lm) * n); i++) m = Math.min(m, v[((i % n) + n) % n]); return m; });
    // % RMS of the corner minimum speeds after one common scale (car pace is not the line); b: real corner minimum speeds
    const rmsV = (a, b) => { const k = b.reduce((q, x, i) => q + x / a[i], 0) / a.length; return 100 * Math.sqrt(a.reduce((q, x, i) => q + ((x * k - b[i]) / b[i]) ** 2, 0) / a.length); };
    if (cs.length < 4) return;
    const memo = new Map(), simMins = w => { const k = w.join(); if (!memo.has(k)) memo.set(k, mins(sim(w))); return memo.get(k); };
    const search = (w0, target, steps) => { let w = w0.slice(), best = rmsV(simMins(w), target); const moved = new Set();
      for (const step of steps) for (let k = 0; k < w.length; k++) { if (step < steps[0] && !moved.has(k)) continue; for (const dv of [-step, step]) {
        const c = w.slice(); c[k] = Math.max(0, Math.min(1, +(c[k] + dv).toFixed(2))); if (c[k] === w[k]) continue;
        const e = rmsV(simMins(c), target); if (e < best - 0.01) { best = e; w = c; moved.add(k); break; } } }
      return {w, best}; };
    const carLine = blendLine(K, ref, L.nrm, mc, sp, car.car, env, car.grip || 1);
    // 1) every driver's best clean lap (and the next one within 2 %, kept for the test)
    const drivers = tree.filter(p => p.startsWith(event + '/Qualifying/') && p.endsWith('/laptimes.json')).map(p => p.split('/')[2]), laps = {};
    for (const drv of drivers) {
      const T = get(year, `${event}/Qualifying/${drv}/laptimes.json`); if (!T) continue; // wet laps are left out one by one (a shower in Q1 does not hide the dry Q3 lap)
      const ls = T.lap.map((lap, i) => ({lap, t: val(T.time[i]), ok: T.del?.[i] !== true && T.wR?.[i] !== true && val(T.pin?.[i]) == null && val(T.pout?.[i]) == null})).filter(x => Number.isFinite(x.t) && x.ok).sort((x, y) => x.t - y.t);
      if (!ls.length) continue;
      const tel = l => { const f = get(year, `${event}/Qualifying/${drv}/${l.lap}_tel.json`), t = f?.tel || f; return t?.rel_distance?.length > 100 ? t : null; };
      const t1 = tel(ls[0]); if (!t1) continue;
      const nxt = ls.slice(1).find(l => l.t < ls[0].t * 1.02), t2 = nxt ? tel(nxt) : null;
      laps[drv] = {team: T.team?.[0] || null, lap: ls[0].t, b1: mins(realShape(t1).abs(400)), b2: t2 ? mins(realShape(t2).abs(400)) : null};
    }
    const D = Object.keys(laps); if (D.length < 3) return;
    // 2) the field line: fitted to the median corner shape of all drivers (what the track and the car model explain), so a driver's
    //    line below is only what differs from the field, and the test compares with the field line, not with the car line
    const norm = b => { const m = b.reduce((x, y) => x + y, 0) / b.length; return b.map(x => x / m); };
    const field = cs.map((_, i) => { const v = D.map(d => norm(laps[d].b1)[i]).sort((x, y) => x - y); return v[v.length >> 1]; });
    const F = search(carLine.w, field, [0.3, 0.15]), fieldMins = simMins(F.w);
    const res = {};
    for (const drv of D) {
      const r = laps[drv], before = rmsV(fieldMins, r.b1); if (!(before < 25)) continue; // an aborted or blocked lap is not a driver's line
      const S = search(F.w, r.b1, [0.15, 0.075]), mine = simMins(S.w);
      res[drv] = {w: S.w, team: r.team, lap: r.lap, fitBefore: +before.toFixed(3), fitAfter: +S.best.toFixed(3), test: r.b2 ? {before: +rmsV(fieldMins, r.b2).toFixed(3), after: +rmsV(mine, r.b2).toFixed(3)} : null};
      console.log(year, id, drv, res[drv].fitBefore, '->', res[drv].fitAfter, res[drv].test ? 'test ' + res[drv].test.before + ' -> ' + res[drv].test.after : '');
    }
    mkdirSync(OUT, {recursive: true});
    const P = get(year, `${event}/Qualifying/drivers.json`), names = Object.fromEntries((P?.drivers || []).map(x => [x.driver, ((x.fn || '') + ' ' + (x.ln || '')).trim()]));
    writeFileSync(of, JSON.stringify({id, year, event, names, carW: carLine.w, fieldW: F.w, field: [+rmsV(simMins(carLine.w), field).toFixed(3), +F.best.toFixed(3)], drivers: res}));
  });
}
