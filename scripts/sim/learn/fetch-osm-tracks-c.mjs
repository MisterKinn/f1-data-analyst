// Owner 2026-11-15, third pass: Sebring at the official length and the tracks whose first runs failed (Aragón, Lausitz DTM,
// Autopolis, Snetterton 300). Runs in GitHub Actions (Overpass API and elevation tiles need the network).
// Output (committed): scripts/sim/data/tracks/extra-tracks-2026-11-15c.json and loops-2026-11-15c.json. © OpenStreetMap contributors, ODbL.
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, existsSync} from 'node:fs';
const D = '.cache/lapsim/osm', env = {...process.env, TRACK_REQUESTS: 'scripts/sim/data/track-requests-2026-11-15c.json'};
mkdirSync(D, {recursive: true}); copyFileSync('scripts/sim/data/tracks/fia-circuits.json', D + '/fia-circuits.json');
for (const s of ['fetch-osm', 'assemble', 'build-extra']) execFileSync('node', [`scripts/sim/tracks/${s}.mjs`], {env, stdio: 'inherit'});
copyFileSync(D + '/loops-summary.json', 'scripts/sim/data/tracks/loops-2026-11-15c.json');
if (existsSync(D + '/extra-tracks.json')) copyFileSync(D + '/extra-tracks.json', 'scripts/sim/data/tracks/extra-tracks-2026-11-15c.json');
