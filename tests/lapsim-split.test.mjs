// Split calibration run (GitHub jobs stop at 6 h): the workflow runs one job per piece of scripts/sim/calibrate.mjs (LAPSIM_PART)
// and a merge. Equality with one process is checked on real data by .github/workflows/lapsim-split-check.yml.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SERIES} from '../worker/lapsim/series.js';

const wf = readFileSync(new URL('../.github/workflows/lapsim-data.yml', import.meta.url), 'utf8');
const cal = readFileSync(new URL('../scripts/sim/calibrate.mjs', import.meta.url), 'utf8');

test('the parts matrix has every held-out (season, fold) and every WEC class, so the merge finds every piece', () => {
  const parts = wf.match(/part: \[([^\]]+)\]/)[1].split(',').map(x => x.trim());
  const years = cal.match(/LAPSIM_HOLDOUT_YEARS \|\| '([0-9,]+)'/)[1].split(',');
  const folds = +cal.match(/const HO_FOLDS = (\d+)/)[1];
  assert.deepEqual(parts, [...years.flatMap(y => Array.from({length: folds}, (_, f) => `f1-ho-${y}-${f}`)), ...Object.keys(SERIES.wec.classes).map(c => 'wec-' + c)]);
});

test('every calibration job reads the same fit settings', () => {
  const runs = wf.match(/node scripts\/sim\/calibrate\.mjs/g);
  assert.equal(runs.length, 3);
  assert.equal((wf.match(/set -a; \. \.github\/lapsim-fit\.env; set \+a; LAPSIM_PART=/g) || []).length, 3);
  assert.doesNotMatch(wf, /run: node scripts\/sim\/calibrate\.mjs/);
});

test('every job stays under the 300-minute cap (rule 4d.2)', () => {
  for (const m of wf.matchAll(/timeout-minutes: (\d+)/g)) assert.ok(+m[1] <= 300, m[0]);
});
