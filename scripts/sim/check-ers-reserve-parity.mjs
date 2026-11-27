// Same-process regression against the pre-change kernel. Needs its Git object locally.
// Local arithmetic verification only; not a pipeline accuracy reproduction.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {lapsimAllTracks} from '../../worker/lapsim/tracks.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {puRampOf} from '../../worker/lapsim/zones.js';

const baseline = '468e817e80266870bae1b9363a78da1971cadbbb';
const cwd = fileURLToPath(new URL('../../', import.meta.url));
const source = execFileSync('git', ['show', `${baseline}:worker/lapsim/kernel.js`], {cwd, encoding: 'utf8', maxBuffer: 2e6});
const before = new Function(source.replaceAll('export function ', 'function ') + ';return lapsimKernel();')();
const after = lapsimKernel(), digest = createHash('sha256');
let cases = 0;
for (const id of ['monza', 'silverstone', 'hungaroring', 'monte-carlo']) {
  const d = lapsimAllTracks[id], cars = carsFor(id);
  for (const kernelStep of [1, 2]) for (const config of [
    {year: '2025', ramp: false, rechargeMJ: 7},
    {year: '2026', ramp: false, rechargeMJ: 7},
    {year: '2026', ramp: true, rechargeMJ: 7},
    {year: '2026', ramp: true, rechargeMJ: 0},
  ]) {
    const tr = {...after.trackFromData(d), otOn: true};
    const car = cars[config.year].car;
    const env = after.conditionsFromWeather({rechargeMJ: config.rechargeMJ,
      puRamp: config.ramp ? puRampOf(d, id) : undefined});
    const a = JSON.stringify(before.simulateLap(tr, car, env, {kernelStep}));
    const b = JSON.stringify(after.simulateLap(tr, car, env, {kernelStep}));
    assert.ok(b === a, `${id}/${config.year}/step${kernelStep}/ramp${config.ramp}/recharge${config.rechargeMJ}: full result mismatch`);
    digest.update(`${id}:${kernelStep}:${JSON.stringify(config)}\n${a}\n`);
    cases++;
  }
}
console.log(JSON.stringify({baseline, cases, comparison: 'exact JSON equality of full results',
  sha256: digest.digest('hex'), status: 'PASS'}, null, 2));
