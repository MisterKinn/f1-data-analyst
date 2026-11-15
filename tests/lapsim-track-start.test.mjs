import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimExtraTracks as E} from '../worker/lapsim/tracks-data.js';
import {simulationPage} from '../worker/simulation.js';

// owner 2026-11-15: map tracks ran backwards (Le Mans, Daytona); every declared direction must hold in the built lap
test('extra map tracks run in their declared real direction', () => {
  const spec = JSON.parse(readFileSync('scripts/sim/data/track-extra.json', 'utf8')).tracks;
  for (const [id, s] of Object.entries(spec)) {
    if (!s.direction || !E[id]) continue;
    const {x, y} = E[id].map; let a = 0;
    for (let i = 0; i < x.length; i++) { const j = (i + 1) % x.length; a += x[i] * y[j] - x[j] * y[i]; }
    assert.equal(a > 0 ? 'ccw' : 'cw', s.direction, id);
  }
});

// owner 2026-11-15: Silverstone F1 starts on the Hamilton Straight, other series on the National Pits Straight
test('Silverstone start marker differs between F1 and other series', () => {
  const at = car => String(simulationPage({track: 'silverstone', car}, 'en')).match(/<rect x="([\d.]+)" y="([\d.]+)"[^>]*class="ls-start"/).slice(1).join(',');
  assert.notEqual(at('2026'), at('wec-lmh'));
});
