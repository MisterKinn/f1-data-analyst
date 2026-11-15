// Racing line per driver for the endurance series (owner 2026-11-15: every series per driver). Al Kamel laps give each driver's lap
// and its three sector times (no speed trace), and tobi/track-atlas gives where those sectors are (metres). So per driver the
// least-curvature / shortest share is fitted per timing sector (3 values) to the shares of the driver's best clean dry qualifying lap
// (sector time / lap time after one common scale: car pace is not the line), tested on the driver's next clean lap within 2 %.
// Car: the page's class car (LMH, LMDh by manufacturer; GT3 = the LMGT3 car). Names go through drivers.mjs (one id per person).
// Usage: node scripts/sim/learn/driver-lines-endurance.mjs <imsa_data checkout> <track-atlas tracks.jsonl> <out dir> [part i/k]
import {readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lineTrack, blendLine, blendOff} from '../../../worker/lapsim/racing-line.js';
import {carsFor, realConditions} from '../../../worker/lapsim/scenario.js';
import {SERIES} from '../../../worker/lapsim/series.js';
import {lapsimAllTracks} from '../../../worker/lapsim/tracks.js';
import {lineData} from '../../../worker/simulation.js';
import {parseCsv, secs} from './build-endurance.mjs';
import {resolveTrack} from './track-registry.mjs';

const [root, atlasFile, out, part = '0/1'] = process.argv.slice(2), [pi, pk] = part.split('/').map(Number), K = lapsimKernel();
// sector boundaries (fractions of the lap) per simulator track
const atlas = {};
for (const l of readFileSync(atlasFile, 'utf8').split('\n').filter(Boolean)) {
  const t = JSON.parse(l), slug = t.external_ids?.imsa_data || t.slug;
  for (const lay of t.layouts || []) {
    const ts = (lay.range_layers || []).find(r => r.kind === 'timing_sectors'); if (!ts || !lay.length_m) continue;
    const sim = resolveTrack({name: slug.replace(/-/g, ' '), lengthKm: lay.length_m / 1000}).sim || resolveTrack({name: t.name || slug}).sim; if (!sim || atlas[sim]) continue;
    // sector ends are fractions of the lap (metres in older entries)
    const ends = ts.items.map(x => x.end > 1 ? x.end / lay.length_m : x.end).slice(0, 2); if (ends.length === 2) atlas[sim] = {cuts: ends, series: ts.series || null, source: 'tobi/track-atlas ' + t.slug + '/' + lay.id};
  }
}
const files = [];
const walk = d => { for (const f of readdirSync(d, {withFileTypes: true})) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (/(qualif|hyperpole).*-laps\.csv$/i.test(f.name) && !/race/i.test(f.name)) files.push(p); } };
walk(join(root, 'data'));
const bucket = r => /HYPERCAR|GTP/i.test(r.CLASS) ? (SERIES.wec.classes.lmh.manufacturers.test(r.MANUFACTURER || '') ? 'lmh' : 'lmdh') : /GT3|GTD|^GT$|LMGT3/i.test(r.CLASS) ? 'gt3' : null;
const CAR = {lmh: 'wec-lmh', lmdh: 'wec-lmdh', gt3: 'wec-lmgt3'};
const groups = {}; // track|bucket -> {driver -> laps}
for (const f of files) {
  const [, series, season, event] = f.match(/data\/([^/]+)\/(\d{4})\/\d+-([^/]+)\//) || [];
  if (!series) continue;
  let rows; try { rows = parseCsv(readFileSync(f, 'utf8')); } catch { continue; }
  if (rows.some(r => /RAIN|WET/i.test(r.TRACK_STATUS || ''))) continue;
  for (const r of rows) {
    const b = bucket(r), t = secs(r.LAP_TIME), s = [r.S1_SECONDS, r.S2_SECONDS, r.S3_SECONDS].map(Number);
    if (!b || !r.DRIVER_NAME || !Number.isFinite(t) || s.some(x => !(x > 0)) || Math.abs(s[0] + s[1] + s[2] - t) > 0.05 || r.CROSSING_FINISH_LINE_IN_PIT || r.PIT_TIME || (r.FLAG_AT_FL && r.FLAG_AT_FL !== 'GF')) continue;
    const lenKm = Number(r.KPH) > 0 ? Number(r.KPH) * t / 3600 : null, id = resolveTrack({name: event.replace(/-/g, ' '), lengthKm: lenKm, season: +season}).sim;
    if (!id || !atlas[id]) continue;
    const g = (groups[id + '|' + b] ||= {}), d = (g[r.DRIVER_NAME.trim()] ||= []);
    d.push({t, s, series, season: +season, manufacturer: r.MANUFACTURER || null, team: r.TEAM || null});
  }
}
mkdirSync(out, {recursive: true});
Object.keys(groups).sort().filter((k, i) => i % pk === pi).forEach(key => {
  const [id, b] = key.split('|'), of = join(out, `dle-${id}-${b}.json`); if (existsSync(of)) return;
  const L = lineData(id), c = carsFor(id)[CAR[b]]; if (!L || !c) return;
  const env = K.conditionsFromWeather(realConditions(id)[CAR[b]] || {}), ref = [L.mid.map(p => p[0]), L.mid.map(p => p[1])], mc = L.base.map(x => x / 10), sp = L.sp.map(x => x / 10);
  const cuts = atlas[id].cuts, W = 10, grp = k => { const f = (k + 0.5) / W; return f < cuts[0] ? 0 : f < cuts[1] ? 1 : 2; };
  const run = w3 => { const w = Array.from({length: W}, (_, k) => w3[grp(k)]), off = blendOff(mc, sp, w), tr = lineTrack(K, ref[0].map((x, i) => x + L.nrm[i][0] * off[i]), ref[1].map((y, i) => y + L.nrm[i][1] * off[i]), 5); tr.mu.fill(c.grip || 1);
    const r = K.simulateLap(tr, c.car, env), n = r.time.length, at = f => r.time[Math.min(n - 1, Math.round(f * n))]; return [at(cuts[0]), at(cuts[1]) - at(cuts[0]), r.lapTime - at(cuts[1])]; };
  const err = (sim, s) => { const k = (s[0] + s[1] + s[2]) / (sim[0] + sim[1] + sim[2]); return 100 * Math.sqrt(sim.reduce((q, x, i) => q + ((x * k - s[i]) / s[i]) ** 2, 0) / 3); };
  const carL = blendLine(K, ref, L.nrm, mc, sp, c.car, env, c.grip || 1), w0 = [0, 1, 2].map(g => { const ks = [...Array(W).keys()].filter(k => grp(k) === g); return +(ks.reduce((q, k) => q + carL.w[k], 0) / ks.length).toFixed(2); });
  const cache = new Map(), simOf = w => { const k = w.join(); if (!cache.has(k)) cache.set(k, run(w)); return cache.get(k); };
  const search = (w00, target, steps) => { let w = w00.slice(), best = err(simOf(w), target);
    for (const step of steps) for (let g = 0; g < 3; g++) for (const dv of [-step, step]) { const t = w.slice(); t[g] = Math.max(0, Math.min(1, +(t[g] + dv).toFixed(2))); if (t[g] === w[g]) continue; const e = err(simOf(t), target); if (e < best - 0.005) { best = e; w = t; break; } }
    return {w, best}; };
  // field line first (median sector shares of every driver's best lap: track, timing lines and car model), then each driver's
  // difference from it; the test compares with the field line on the driver's next clean lap
  const best1 = Object.entries(groups[key]).map(([name, laps]) => { laps.sort((a, b2) => a.t - b2.t); return [name, laps[0], laps.slice(1).find(l => l.t < laps[0].t * 1.02)]; });
  if (best1.length < 3) return;
  const share = s => s.map(x => x / (s[0] + s[1] + s[2])), field = [0, 1, 2].map(i => { const v = best1.map(([, l]) => share(l.s)[i]).sort((x, y) => x - y); return v[v.length >> 1]; });
  const F = search(w0, field, [0.3, 0.15, 0.075]);
  const res = {};
  for (const [name, L1, L2] of best1) {
    const before = err(simOf(F.w), L1.s); if (!(before < 25)) continue;
    const S = search(F.w, L1.s, [0.15, 0.075]);
    res[name] = {w3: S.w, series: L1.series, season: L1.season, manufacturer: L1.manufacturer, team: L1.team, lap: L1.t, fit: [+before.toFixed(3), +S.best.toFixed(3)], test: L2 ? [+err(simOf(F.w), L2.s).toFixed(3), +err(simOf(S.w), L2.s).toFixed(3)] : null};
  }
  writeFileSync(of, JSON.stringify({id, bucket: b, cuts, atlas: atlas[id].source, carW3: w0, fieldW3: F.w, field: [+err(simOf(w0), field).toFixed(3), +F.best.toFixed(3)], drivers: res}));
  console.log(id, b, Object.keys(res).length, 'drivers');
});
