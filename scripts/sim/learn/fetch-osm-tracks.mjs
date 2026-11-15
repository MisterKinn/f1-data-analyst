// Owner 2026-11-15: every missing track. Runs in GitHub Actions (Overpass API and elevation tiles need the network):
// OpenStreetMap raceway ways -> closed laps checked against the FIA lap length -> candidate tracks with height.
// Output (committed): scripts/sim/data/tracks/extra-tracks-2026-11-15.json and loops-2026-11-15.json. © OpenStreetMap contributors, ODbL.
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, existsSync} from 'node:fs';
const D = '.cache/lapsim/osm', env = {...process.env, TRACK_REQUESTS: 'scripts/sim/data/track-requests-2026-11-15.json'};
mkdirSync(D, {recursive: true}); copyFileSync('scripts/sim/data/tracks/fia-circuits.json', D + '/fia-circuits.json');
for (const s of ['fetch-osm', 'assemble', 'build-extra']) execFileSync('node', [`scripts/sim/tracks/${s}.mjs`], {env, stdio: 'inherit'});
copyFileSync(D + '/loops-summary.json', 'scripts/sim/data/tracks/loops-2026-11-15.json');
if (existsSync(D + '/extra-tracks.json')) copyFileSync(D + '/extra-tracks.json', 'scripts/sim/data/tracks/extra-tracks-2026-11-15.json');
// rerun 1794699588
