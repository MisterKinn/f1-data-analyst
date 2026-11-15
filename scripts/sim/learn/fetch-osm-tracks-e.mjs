// Owner 2026-11-15: Long Beach and Detroit from their OpenStreetMap circuit relations, scaled to the official length.
// Output (committed): scripts/sim/data/tracks/extra-tracks-2026-11-15e.json and loops-2026-11-15e.json. © OpenStreetMap contributors, ODbL.
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, existsSync} from 'node:fs';
const D = '.cache/lapsim/osm', env = {...process.env, TRACK_REQUESTS: 'scripts/sim/data/track-requests-2026-11-15e.json'};
mkdirSync(D, {recursive: true}); copyFileSync('scripts/sim/data/tracks/fia-circuits.json', D + '/fia-circuits.json');
for (const s of ['fetch-osm', 'assemble', 'build-extra']) execFileSync('node', [`scripts/sim/tracks/${s}.mjs`], {env, stdio: 'inherit'});
copyFileSync(D + '/loops-summary.json', 'scripts/sim/data/tracks/loops-2026-11-15e.json');
if (existsSync(D + '/extra-tracks.json')) copyFileSync(D + '/extra-tracks.json', 'scripts/sim/data/tracks/extra-tracks-2026-11-15e.json');
