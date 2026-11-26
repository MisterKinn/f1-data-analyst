import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectSectorLines} from '../scripts/sim/learn/fe-sector-lines-proj.mjs';
import {lapsimFeTracks} from '../worker/lapsim/fe-tracks-data.js';

const SL = JSON.parse(readFileSync('scripts/sim/data/learn/fe-sector-lines.json', 'utf8')).tracks;

test('FE sector projection: near the old fraction, ordered, old fields untouched', () => {
  const before = JSON.stringify(SL['fe-london']), p = projectSectorLines(lapsimFeTracks['fe-london'], SL['fe-london']);
  assert.ok(Math.abs(p.f1Proj - SL['fe-london'].f1) < 0.02 && Math.abs(p.f2Proj - SL['fe-london'].f2) < 0.02);
  assert.ok(p.f1Proj < p.f2Proj && p.projOffM.every(d => d <= 10));
  assert.equal(JSON.stringify(SL['fe-london']), before);
});

test('FE sector projection: no centre line gives null (readers keep f1/f2)', () => {
  assert.equal(projectSectorLines(undefined, SL['monte-carlo']), null);
});
