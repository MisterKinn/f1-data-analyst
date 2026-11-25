// Keeps the noise job's content pin in step with the Al Kamel full-lap manifest (step 36, central 2026-11-25: the pinned file list
// changes in the same commit as the data, so the pipeline never checks a copy against a stale pin).
//   node scripts/sim/learn/pin-alkamel-manifest.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const P = '.github/lapsim-snapshot.json', s = JSON.parse(readFileSync(P, 'utf8')), m = s.noise.alkamel.manifest;
s.noise.alkamel.manifest_sha256 = createHash('sha256').update(readFileSync(m)).digest('hex');
writeFileSync(P, JSON.stringify(s, null, 2) + '\n'); console.log(`pinned ${m}: ${s.noise.alkamel.manifest_sha256}`);
