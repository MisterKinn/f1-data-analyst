// Racing line per driver for the endurance series (owner 2026-11-15: every series per driver). Al Kamel laps give each driver's lap
// and its three sector times (no speed trace), and tobi/track-atlas gives where those sectors are (metres). So per driver the
// least-curvature / shortest share is fitted per timing sector (3 values) to the shares of the driver's best clean dry qualifying lap
// (sector time / lap time after one common scale: car pace is not the line), tested on the driver's next clean lap within 2 %.
// Car: the page's class car (LMH, LMDh by manufacturer; GT3 = the LMGT3 car). Names go through drivers.mjs (one id per person).
// More laps (Formula E from Al Kamel, SRO GT3 from Timing71) come as JSON lines in LAPSIM_DL_EXTRA (comma separated files):
// {series, season, venue, lenKm, bucket ('gt3' | 'fe-gen2' | 'fe-gen3' | 'fe-gen3evo'), driver, manufacturer, team, t, s: [s1, s2, s3]}.
// Where track-atlas has no sector positions, the two sector cuts are estimated: the cut pair that makes the car's simulated sector
// shares match the field's median shares (the field line then absorbs that estimate; a driver's line is the difference from it).
// Names: one id per person before grouping (drivers.mjs), so two spellings of one driver are one driver.
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
import {buildRegistry} from './drivers.mjs';
import {trackWarn} from '../../../worker/simulator-controls.js';

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
const CAR = {lmh: 'wec-lmh', lmdh: 'wec-lmdh', gt3: 'wec-lmgt3', 'fe-gen2': 'fe-gen2', 'fe-gen3': 'fe-gen3', 'fe-gen3evo': 'fe-gen3evo'};
const laps = []; // every clean lap, grouped after the names are joined
const groups = {}; // track|bucket -> {driver -> laps}
for (const f of files) {
  const [, series, season, event] = f.match(/data\/([^/]+)\/(\d{4})\/\d+-([^/]+)\//) || [];
  if (!series) continue;
  let rows; try { rows = parseCsv(readFileSync(f, 'utf8')); } catch { continue; }
  if (rows.some(r => /RAIN|WET/i.test(r.TRACK_STATUS || ''))) continue;
  for (const r of rows) {
    const b = bucket(r), t = secs(r.LAP_TIME), s = [1, 2, 3].map(k => r['S' + k + '_SECONDS'] ? Number(r['S' + k + '_SECONDS']) : secs(r['S' + k])); // IMSA files have only S1-S3 as m:ss
    if (!b || !r.DRIVER_NAME || !Number.isFinite(t) || s.some(x => !(x > 0)) || Math.abs(s[0] + s[1] + s[2] - t) > 0.05 || r.CROSSING_FINISH_LINE_IN_PIT || r.PIT_TIME || (r.FLAG_AT_FL && r.FLAG_AT_FL !== 'GF')) continue;
    const lenKm = Number(r.KPH) > 0 ? Number(r.KPH) * t / 3600 : null, id = resolveTrack({name: event.replace(/-/g, ' '), lengthKm: lenKm, season: +season}).sim;
    if (!id) continue;
    laps.push({id, b, name: r.DRIVER_NAME.trim(), t, s, series, season: +season, manufacturer: r.MANUFACTURER || null, team: r.TEAM || null});
  }
}
for (const f of (process.env.LAPSIM_DL_EXTRA || '').split(',').filter(x => x && existsSync(x))) for (const line of readFileSync(f, 'utf8').split('\n')) {
  if (!line) continue; let r; try { r = JSON.parse(line); } catch { continue; }
  if (!r.driver || !(r.t > 0) || !Array.isArray(r.s) || r.s.length !== 3 || r.s.some(x => !(x > 0)) || Math.abs(r.s[0] + r.s[1] + r.s[2] - r.t) > 0.1) continue;
  const id = r.trackId || resolveTrack({name: String(r.venue || '').replace(/-/g, ' '), lengthKm: r.lenKm || null, season: r.season}).sim; if (!id || !CAR[r.bucket]) continue;
  // a lap is learned only on its own layout: no Formula E layout for a GT3 lap, and the mean speed on this layout must be in the class band
  const len = lapsimAllTracks[id]?.length, vKph = len ? len / 1000 / (r.t / 3600) : 0, band = r.bucket === 'gt3' ? [125, 215] : r.bucket.startsWith('fe-') ? [80, 170] : [140, 265];
  if ((r.bucket === 'gt3' && id.startsWith('fe-')) || vKph < band[0] || vKph > band[1]) continue;
  laps.push({id, b: r.bucket, name: String(r.driver).trim(), t: r.t, s: r.s, series: r.series, season: r.season, manufacturer: r.manufacturer || null, team: r.team || null});
}
{ const c = {}; for (const l of laps) if (!['wec', 'imsa', 'elms', 'alms', 'fe'].includes(l.series)) { const k = l.series + ' ' + l.id; c[k] = (c[k] || 0) + 1; } console.log('Timing71 laps by series and track', JSON.stringify(c)); }
const reg = buildRegistry([...new Set(laps.map(l => l.name))].map(name => ({name})));
for (const l of laps) { const pid = reg.ids.get(l.name) || l.name; ((groups[l.id + '|' + l.b] ||= {})[pid] ||= []).push(l); }
console.log('laps', laps.length, '(extra', laps.filter(l => !['wec', 'imsa', 'elms', 'alms'].includes(l.series)).length + ')', 'groups', Object.keys(groups).length, 'people', Object.keys(reg.people).length);
mkdirSync(out, {recursive: true});
Object.keys(groups).sort().filter((k, i) => i % pk === pi).forEach(key => { try { fitGroup(key); } catch (e) { console.log('group failed', key, e.stack?.split('\n').slice(0, 3).join(' | ')); } });
function fitGroup(key) {
  const [id, b] = key.split('|'), of = join(out, `dle-${id}-${b}.json`); if (existsSync(of)) return;
  // Formula E on a track marked ⚠️ (doubtful map line or big track factor): the line there measures the map error, not the driver
  if (b.startsWith('fe-') && trackWarn(id, lapsimAllTracks[id])) { console.log('skip', key, 'track marked ⚠️'); return; }
  const L = lineData(id), c = carsFor(id)[CAR[b]]; if (!L || !c) { console.log('skip', key, !L ? 'no line' : 'no car'); return; }
  const env = K.conditionsFromWeather(realConditions(id)[CAR[b]] || {}), ref = [L.mid.map(p => p[0]), L.mid.map(p => p[1])], mc = L.base.map(x => x / 10), sp = L.sp.map(x => x / 10);
  // sector cuts: track-atlas, else estimated from the field's median sector shares with the car line (0.01 steps)
  const shareOf = s => s.map(x => x / (s[0] + s[1] + s[2]));
  // the car line's simulated time at a lap fraction, and the field's median sector shares
  const best = Object.values(groups[key]).map(ls => ls.slice().sort((a, b2) => a.t - b2.t)[0]); if (best.length < 3) { console.log('skip', key, 'fewer than 3 drivers'); return; }
  const med = [0, 1, 2].map(i => { const v = best.map(l => shareOf(l.s)[i]).sort((x, y) => x - y); return v[v.length >> 1]; });
  const cl0 = blendLine(K, ref, L.nrm, mc, sp, c.car, env, c.grip || 1), tr0 = lineTrack(K, ref[0].map((x, i) => x + L.nrm[i][0] * cl0.off[i]), ref[1].map((y, i) => y + L.nrm[i][1] * cl0.off[i]), 5); tr0.mu.fill(c.grip || 1);
  // sector times between lap fractions, the lap starting at fraction o of our track (a timing line may sit away from our map start)
  const sec3 = (r, o, cs) => { const n = r.time.length, T = r.lapTime, tf = f => r.time[Math.min(n - 1, Math.round(((f % 1) + 1) % 1 * n))], d = (x, y) => (((tf(y) - tf(x)) % T) + T) % T;
    return [d(o, o + cs[0]), d(o + cs[0], o + cs[1]), d(o + cs[1], o)]; };
  const r0 = K.simulateLap(tr0, c.car, env);
  const cutErr = (cs, o = 0) => { const q = sec3(r0, o, cs), t = q[0] + q[1] + q[2]; return Math.sqrt(q.reduce((e, x, i) => e + (x / t - med[i]) ** 2, 0) / 3); };
  let est = null, eBest = Infinity; for (let a = 0.15; a <= 0.6; a += 0.01) for (let b2 = a + 0.15; b2 <= 0.88; b2 += 0.01) { const e = cutErr([a, b2]); if (e < eBest) { eBest = e; est = [+a.toFixed(2), +b2.toFixed(2)]; } }
  // track-atlas positions (measured) with the start line found by a shift of at most 8 % of the lap; kept when the field's sector
  // shares then fit within 1.5 % of the lap and the shift is not at its bound, otherwise the positions are estimated from the field (labelled)
  let cuts = atlas[id]?.cuts, cutSrc = atlas[id]?.source || null, o = 0;
  if (cuts) { let eo = Infinity; for (let x = -0.08; x <= 0.0801; x += 0.002) { const e = cutErr(cuts, x); if (e < eo) { eo = e; o = +x.toFixed(3); } }
    if (eo <= 0.015 && Math.abs(o) < 0.079) cutSrc += o ? ` (timing line ${Math.round(o * (lapsimAllTracks[id].length || 0))} m from our start)` : ''; else cuts = null; }
  if (!cuts) { cuts = est; o = 0; cutSrc = 'estimated from the field sector times' + (atlas[id] ? ' (track-atlas positions did not fit this layout)' : ''); }
  const W = 10, grp = k => { const f = (((k + 0.5) / W - o) % 1 + 1) % 1; return f < cuts[0] ? 0 : f < cuts[1] ? 1 : 2; };
  const run = w3 => { const w = Array.from({length: W}, (_, k) => w3[grp(k)]), off = blendOff(mc, sp, w), tr = lineTrack(K, ref[0].map((x, i) => x + L.nrm[i][0] * off[i]), ref[1].map((y, i) => y + L.nrm[i][1] * off[i]), 5); tr.mu.fill(c.grip || 1);
    return sec3(K.simulateLap(tr, c.car, env), o, cuts); };
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
    res[name] = {name: reg.people[name]?.name || name, aliases: reg.people[name]?.aliases || [name], w3: S.w, series: L1.series, season: L1.season, manufacturer: L1.manufacturer, team: L1.team, lap: L1.t, fit: [+before.toFixed(3), +S.best.toFixed(3)], test: L2 ? [+err(simOf(F.w), L2.s).toFixed(3), +err(simOf(S.w), L2.s).toFixed(3)] : null};
  }
  writeFileSync(of, JSON.stringify({id, bucket: b, cuts, start: o, atlas: cutSrc, names: Object.fromEntries(Object.keys(groups[key]).map(k => [k, reg.people[k]?.name || k])), carW3: w0, fieldW3: F.w, field: [+err(simOf(w0), field).toFixed(3), +F.best.toFixed(3)], drivers: res}));
  console.log(id, b, Object.keys(res).length, 'drivers');
}
