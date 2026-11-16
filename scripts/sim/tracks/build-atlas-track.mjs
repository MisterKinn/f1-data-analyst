// Candidate track from a curated track-atlas midline (tobi/track-atlas, MIT; geometry from OpenStreetMap, ODbL) when the OpenStreetMap
// loop is wrong. Owner 2026-11-15: the Daytona OSM loop skipped the Bus Stop chicane (simulated GTP 7-9 % too fast).
//   node scripts/sim/tracks/build-atlas-track.mjs <atlas json> <id> <old candidate file> <old candidate id>   -> extra-tracks-atlas.json
// Same smoothing and curvature as scripts/sim/tracks/build-extra.mjs; the lap starts at the atlas start/finish point; height is kept
// from the old candidate (no network here).
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resampleClosed, movingAverageClosed, headingCurvature, lonLatToLocal, alignClosed, applyAlignment} from '../../../worker/lapsim/geometry.js';
const [src, id, oldFile, oldId] = process.argv.slice(2), a = JSON.parse(readFileSync(src, 'utf8')), DS = 5;
// 2026-11-16: smoothing chosen on the 24 F1 circuits that have both an atlas midline and a measured F1 car-position line (the atlas
// track must give the measured track's lap with the 2025 car): 15 m / 10 m gave RMS 3.8 % (9 m / 6 m: 4.0 %). Not tuned on the extra tracks.
const POS_SMOOTH_M = 15, CURV_SMOOTH_M = 10;
let pts = a.coords.map(([lon, lat]) => [lat, lon]);
const dm = (p, q) => Math.hypot((p[1] - q[1]) * 111320 * Math.cos(p[0] * Math.PI / 180), (p[0] - q[0]) * 110574);
while (pts.length > 3 && dm(pts.at(-1), pts[0]) < 3) pts = pts.slice(0, -1); // closing duplicates
// rotate so the lap starts at the point nearest the atlas start/finish
const [sl, sa] = [a.startFinish[1], a.startFinish[0]]; let k0 = 0, best = Infinity; pts.forEach((p, i) => { const d = (p[0] - sl) ** 2 + ((p[1] - sa) * Math.cos(sl * Math.PI / 180)) ** 2; if (d < best) { best = d; k0 = i; } });
pts = [...pts.slice(k0), ...pts.slice(0, k0)];
const loc = lonLatToLocal(pts.map(p => [p[1], p[0]]));
let g = resampleClosed(loc.x, loc.y, DS); const w = Math.max(1, Math.round(POS_SMOOTH_M / g.ds) | 1);
g = resampleClosed(Array.from(movingAverageClosed(g.x, w)), Array.from(movingAverageClosed(g.y, w)), DS);
const shrink = g.length / a.lengthM, {kappa: kk} = headingCurvature(g.x, g.y, g.ds, CURV_SMOOTH_M), n = g.x.length, ds = g.ds / shrink;
// close the loop: one full turn and the end on the start point. Curvature from smoothed positions does not integrate back to a closed
// loop (Spielberg -365° and a 36 m gap; Daytona 8 m), which put a kink at the start line (a 5 m radius, laps 3-15 % slow).
let kc = Array.from(kk, v => v / shrink); { const turn = kc.reduce((s, v) => s + v * ds, 0), tgt = Math.sign(turn) * 2 * Math.PI; kc = kc.map(v => v + (tgt - turn) / (n * ds)); }
const gapOf = k => { let h = 0, x = 0, y = 0; for (const v of k) { h += v * ds; x += Math.cos(h) * ds; y += Math.sin(h) * ds; } return [x, y]; };
const basis = [i => Math.cos(2 * Math.PI * i / n), i => Math.sin(2 * Math.PI * i / n)];
for (let it = 0; it < 6; it++) { const g0 = gapOf(kc); if (Math.hypot(...g0) < 0.05) break; const e = 1e-6, J = basis.map(f => { const g1 = gapOf(kc.map((v, i) => v + e * f(i))); return [(g1[0] - g0[0]) / e, (g1[1] - g0[1]) / e]; });
  const det = J[0][0] * J[1][1] - J[1][0] * J[0][1], c0 = (-g0[0] * J[1][1] + g0[1] * J[1][0]) / det, c1 = (-g0[1] * J[0][0] + g0[0] * J[0][1]) / det; kc = kc.map((v, i) => v + c0 * basis[0](i) + c1 * basis[1](i)); }
const oldF = JSON.parse(readFileSync(oldFile, 'utf8')), old = (oldF.tracks || oldF.variants)[oldId], step = 1, map = {x: [], y: []};
for (let i = 0; i < n; i += step) { map.x.push(Math.round(g.x[i])); map.y.push(Math.round(g.y[i])); }
let grade = Array.from({length: n}, () => 0), gradeFit = null; // height: nearest point of the old candidate line after a rigid fit (sign flipped if it ran the other way)
if (old.grade?.length) { const m = old.kappa.length, ox = [0], oy = [0]; for (let i = 0, h = 0; i < m - 1; i++) { h += old.kappa[i] / 1e5 * old.ds; ox.push(ox[i] + Math.cos(h) * old.ds); oy.push(oy[i] + Math.sin(h) * old.ds); }
  const al = alignClosed(ox, oy, Array.from(g.x), Array.from(g.y));
  if (!al.mirror && al.rms < 40) { const P = applyAlignment(al, ox, oy), sg = al.dir === 1 ? 1 : -1;
    grade = Array.from({length: n}, (_, i) => { let b = Infinity, k = 0; for (let j = 0; j < m; j++) { const d = (P.x[j] - g.x[i]) ** 2 + (P.y[j] - g.y[i]) ** 2; if (d < b) { b = d; k = j; } } return sg * old.grade[k]; });
    gradeFit = {rmsM: +al.rms.toFixed(1), reversed: sg < 0}; } else gradeFit = {rmsM: +al.rms.toFixed(1), rejected: al.mirror ? 'mirror' : 'fit'}; }
const out = existsSync('scripts/sim/data/tracks/extra-tracks-atlas.json') ? JSON.parse(readFileSync('scripts/sim/data/tracks/extra-tracks-atlas.json', 'utf8')) : {note: 'Candidate tracks from curated track-atlas midlines (see scripts/sim/tracks/build-atlas-track.mjs).', tracks: {}};
out.tracks[id] = {id, venue: old.venue, name: old.name, ds, length: a.lengthM, officialLengthM: a.lengthM, lengthSource: old.lengthSource, widthM: a.widthM ?? old.widthM, widthSource: a.widthM ? 'track-atlas surface (aerial imagery)' : 'old candidate', sectors: [], corners: [],
  kappa: kc.map(v => Math.round(v * 1e5)), grade, heading: null, map, elevation: old.elevation, centre: [+pts[0][0].toFixed(4), +pts[0][1].toFixed(4)],
  startFromSource: 'track-atlas start/finish point', atlasCorners: a.corners,
  quality: {evidence: 'curated map midline (track-atlas)', mapPoints: pts.length, smoothedLengthM: Math.round(g.length), smoothingShrinkPct: +((1 - shrink) * 100).toFixed(2), gradeFromOld: gradeFit},
  sources: [a.source]};
writeFileSync('scripts/sim/data/tracks/extra-tracks-atlas.json', JSON.stringify(out));
console.log(id, 'points', pts.length, 'smoothed', Math.round(g.length), 'm, official', a.lengthM, 'shrink', ((1 - shrink) * 100).toFixed(2), '%');
