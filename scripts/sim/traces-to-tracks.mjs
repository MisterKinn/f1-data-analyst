// Calibration on the committed track shapes (owner 2026-11-18, option 1): the speed traces come from a fresh build, whose lap
// length differs from the committed track by a few metres (Imola -4 m, Monaco -16 m in run 44180547107). Each trace's distances
// are scaled to the committed length, so corners line up with worker/lapsim/tracks-data.js.
// node scripts/sim/traces-to-tracks.mjs <fresh tracks module>
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const len = t => t.kappa.length * t.ds;
const kept = (await import('../../worker/lapsim/tracks-data.js')).lapsimTracks;
const built = (await import(pathToFileURL(resolve(process.argv[2])).href)).lapsimTracks;
const file = '.cache/lapsim/traces.json', traces = JSON.parse(await readFile(file, 'utf8'));
let n = 0;
for (const t of traces) {
  const a = kept[t.track], b = built[t.track]; if (!a || !b) continue;
  const f = len(a) / len(b); if (f !== 1) { t.s = t.s.map(x => x * f); n++; }
}
await writeFile(file, JSON.stringify(traces));
console.log(`${n} of ${traces.length} traces scaled to the committed track length`);
