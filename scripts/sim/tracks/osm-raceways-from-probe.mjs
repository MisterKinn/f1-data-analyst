// OpenStreetMap raceway ways for every track, from the A5 probe output (branch probe/osm-pits, © OpenStreetMap contributors, ODbL).
//   node scripts/sim/tracks/osm-raceways-from-probe.mjs <probe-out/pits dir>   -> scripts/sim/data/tracks/osm-raceways-all.json
// Keeps highway=raceway ways that are not pit lanes (the shape reference for map-shape-osm.mjs). Seed ids taken from the track
// requests are mapped to our ids; seeds that are not simulator tracks are dropped there.
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
const SEED_ID = {'valencia-ricardo-tormo': 'ricardo-tormo'};
const dir = process.argv[2], tracks = {};
for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const seedId = f.slice(0, -5), id = SEED_ID[seedId] || seedId, o = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const ways = o.ways.filter(w => w.tags.highway === 'raceway' && !/pit|box/i.test(`${w.tags.name || ''} ${w.tags.service || ''} ${w.tags.raceway || ''}`)).map(w => ({g: w.g}));
  if (ways.length && !(tracks[id] && seedId !== id)) tracks[id] = {seed: o.seed, ways};
}
writeFileSync('scripts/sim/data/tracks/osm-raceways-all.json', JSON.stringify({source: '© OpenStreetMap contributors, ODbL (Overpass, GitHub Actions run 43863550462)', tracks}) + '\n');
console.log(Object.keys(tracks).length, 'tracks');
