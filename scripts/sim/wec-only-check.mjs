// WEC-only fit check (lapsim-split-check.yml): the WEC block of a LAPSIM_ONLY=wec run equals the full run's, while the F1 seasons differ
//   node scripts/sim/wec-only-check.mjs <full-run calibration-data.js> <wec-only calibration-data.js>
import {pathToFileURL} from 'node:url';
const [full, only] = await Promise.all(process.argv.slice(2).map(async f => (await import(pathToFileURL(f).href)).lapsimCalibration));
const same = JSON.stringify(full.series?.wec) === JSON.stringify(only.series?.wec), f1Differs = JSON.stringify(full.seasons) !== JSON.stringify(only.seasons);
console.log(`WEC-only check: WEC block ${same ? 'identical' : 'DIFFERENT'} to the full run; F1 seasons ${f1Differs ? 'differ (as intended)' : 'equal (the check proves less)'}`);
if (!same) process.exit(1);
