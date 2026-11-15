// Candidate track from a curated track-atlas midline (tobi/track-atlas, MIT; geometry from OpenStreetMap, ODbL) when the OpenStreetMap
// loop is wrong. Owner 2026-11-15: the Daytona OSM loop skipped the Bus Stop chicane (simulated GTP 7-9 % too fast).
//   node scripts/sim/tracks/build-atlas-track.mjs <atlas json> <id> <old candidate file> <old candidate id>   -> extra-tracks-atlas.json
// Same smoothing and curvature as scripts/sim/tracks/build-extra.mjs; the lap starts at the atlas start/finish point; height is kept
// from the old candidate (no network here).
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resampleClosed, movingAverageClosed, headingCurvature, lonLatToLocal} from '../../../worker/lapsim/geometry.js';
const [src, id, oldFile, oldId] = process.argv.slice(2), a = JSON.parse(readFileSync(src, 'utf8')), DS = 5, POS_SMOOTH_M = 9, CURV_SMOOTH_M = 6;
let pts = a.coords.map(([lon, lat]) => [lat, lon]); if (pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts = pts.slice(0, -1);
// rotate so the lap starts at the point nearest the atlas start/finish
const [sl, sa] = [a.startFinish[1], a.startFinish[0]]; let k0 = 0, best = Infinity; pts.forEach((p, i) => { const d = (p[0] - sl) ** 2 + ((p[1] - sa) * Math.cos(sl * Math.PI / 180)) ** 2; if (d < best) { best = d; k0 = i; } });
pts = [...pts.slice(k0), ...pts.slice(0, k0)];
const loc = lonLatToLocal(pts.map(p => [p[1], p[0]]));
let g = resampleClosed(loc.x, loc.y, DS); const w = Math.max(1, Math.round(POS_SMOOTH_M / g.ds) | 1);
g = resampleClosed(Array.from(movingAverageClosed(g.x, w)), Array.from(movingAverageClosed(g.y, w)), DS);
const shrink = g.length / a.lengthM, {kappa: kk} = headingCurvature(g.x, g.y, g.ds, CURV_SMOOTH_M), n = g.x.length, ds = g.ds / shrink;
const old = JSON.parse(readFileSync(oldFile, 'utf8')).tracks[oldId], step = Math.max(1, Math.floor(n / 360)), map = {x: [], y: []};
for (let i = 0; i < n; i += step) { map.x.push(Math.round(g.x[i])); map.y.push(Math.round(g.y[i])); }
const out = existsSync('scripts/sim/data/tracks/extra-tracks-atlas.json') ? JSON.parse(readFileSync('scripts/sim/data/tracks/extra-tracks-atlas.json', 'utf8')) : {note: 'Candidate tracks from curated track-atlas midlines (see scripts/sim/tracks/build-atlas-track.mjs).', tracks: {}};
out.tracks[id] = {id, venue: old.venue, name: old.name, ds, length: a.lengthM, officialLengthM: a.lengthM, lengthSource: old.lengthSource, widthM: old.widthM, sectors: [], corners: [],
  kappa: Array.from(kk, v => Math.round(v / shrink * 1e5)), grade: Array.from({length: n}, () => 0), heading: null, map, elevation: old.elevation, centre: [+pts[0][0].toFixed(4), +pts[0][1].toFixed(4)],
  startFromSource: 'track-atlas start/finish point', atlasCorners: a.corners,
  quality: {evidence: 'curated map midline (track-atlas)', mapPoints: pts.length, smoothedLengthM: Math.round(g.length), smoothingShrinkPct: +((1 - shrink) * 100).toFixed(2)},
  sources: [a.source]};
writeFileSync('scripts/sim/data/tracks/extra-tracks-atlas.json', JSON.stringify(out));
console.log(id, 'points', pts.length, 'smoothed', Math.round(g.length), 'm, official', a.lengthM, 'shrink', ((1 - shrink) * 100).toFixed(2), '%');
