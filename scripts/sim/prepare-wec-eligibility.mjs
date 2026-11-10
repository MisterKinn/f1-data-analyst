// Run once, on the pinned production seed and geometry, BEFORE all variant fits.
// node scripts/sim/prepare-wec-eligibility.mjs <output.json>
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {lapsimCalibration} from '../../worker/lapsim/calibration-data.js';
import {trackFromData} from '../../worker/lapsim/tracks.js';
import {buildEligibility, eligibilityInputs} from './wec-eligibility.mjs';
const output = process.argv[2];
if (!output) throw new Error('Provide a fixed eligibility output path');
const cache = process.env.LAPSIM_CACHE || '.cache/lapsim';
const table = buildEligibility({
  wec: JSON.parse(readFileSync(`${cache}/wec.json`, 'utf8')),
  tracks: Object.fromEntries(Object.entries(lapsimTracks).map(([id, t]) => [id, trackFromData(t)])),
  production: lapsimCalibration,
  mappings: JSON.parse(readFileSync('scripts/sim/data/wec-timing-positions.json', 'utf8')),
  inputs: eligibilityInputs('.', cache)
});
writeFileSync(output, JSON.stringify(table, null, 2) + '\n');
console.log(JSON.stringify({ratios: table.ratios, excluded: table.excluded, coverage: table.coverage}, null, 2));
