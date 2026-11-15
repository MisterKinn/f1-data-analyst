// Applies the speed-implied curvature cap (worker/lapsim/geometry.js capCurvature, the same step build-geometry.mjs runs) to the
// stored F1 tracks when only the speed traces are at hand: node scripts/sim/cap-curvature.mjs <traces.json> [gMax=6.5]
import {readFileSync, writeFileSync} from 'node:fs';
import {capCurvature} from '../../worker/lapsim/geometry.js';
const [file, g = '6.5'] = process.argv.slice(2), OUT = 'worker/lapsim/tracks-data.js', traces = JSON.parse(readFileSync(file, 'utf8'));
const src = readFileSync(OUT, 'utf8'), m = /^export const lapsimTracks=(.*);$/m.exec(src), tracks = JSON.parse(m[1]);
// banked corners (scripts/sim/data/banking.json) carry more than gMax; shortcut: the whole track is skipped, per corner when banking is modelled
const BANKED = new Set(Object.keys((j => j.tracks || j)(JSON.parse(readFileSync('scripts/sim/data/banking.json', 'utf8')))));
for (const t of Object.values(tracks)) {
  if (t.quality?.kappaCap || BANKED.has(t.id)) continue; // already capped by the builder
  const dry = traces.filter(x => x.track === t.id && !x.weather?.rain && x.position <= 3), own = dry.filter(x => x.year === t.year), laps = own.length ? own : dry;
  if (!laps.length) continue;
  const r = capCurvature(t.kappa, t.ds, laps, +g); t.kappa = r.kappa; t.quality = {...t.quality, kappaCap: {gMax: +g, points: r.points, laps: laps.length}};
  console.log(t.id, r.points);
}
writeFileSync(OUT, src.replace(m[0], () => 'export const lapsimTracks=' + JSON.stringify(tracks) + ';'));
