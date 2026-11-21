// Gate G (AGENTS.md, owner 2026-11-21): every automatic data commit reports held-out RMS before and after on the same rows.
// node scripts/heldout-line.mjs <calibration-data.js before> <calibration-data.js after>  ->  one line (empty when a file is missing)
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {compare} from './sim/exp-compare.mjs';

export const line = r => 'Held-out RMS % before → after (same rows, calibration-data.js): ' +
  ['all', 'f1', 'wec'].filter(g => r[g]).map(g => `${g} ${r[g].base} → ${r[g].cand} (n ${r[g].n})`).join(', ');
if (process.argv[1]?.endsWith('heldout-line.mjs')) {
  const [a, b] = process.argv.slice(2).map(f => resolve(f));
  if (!a || !b || !existsSync(a) || !existsSync(b)) process.exit(0);
  const load = async f => (await import(pathToFileURL(f).href + '?' + Date.now())).lapsimCalibration;
  console.log(line(compare(await load(a), await load(b))));
}
