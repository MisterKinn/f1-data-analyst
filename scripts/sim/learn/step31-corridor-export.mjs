// Step 31 (geometry input): kernel path, heading and map line data (midline, iRacing kerb offsets) of the 13 corridor tracks, plus the
// corner apexes of the 2023-25 traces (sim frame). Same sources as the step 30d export. 2022 never read.
// Usage (repo root): node scripts/sim/learn/step31-corridor-export.mjs <out.json>
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../../worker/lapsim/tracks.js';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lineData} from '../../../worker/simulation.js';

export const CORRIDOR = ['austin', 'hungaroring', 'interlagos', 'mexico-city', 'montreal', 'monza', 'sakhir', 'shanghai', 'silverstone',
  'spa-francorchamps', 'spielberg', 'suzuka', 'zandvoort'];
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const K = lapsimKernel(), EV = JSON.parse(readFileSync('scripts/sim/data/f1-envelope/traces.json', 'utf8')).events, out = {};
  for (const id of CORRIDOR) {
    const d = T[id], t = K.trackFromData(d), L = lineData(id), k = L.kerbLine, n = d.kappa.length;
    const apex = [...new Set(Object.values(EV).filter(e => e.track === id).flatMap(e => {
      if (!(e.year >= 2023 && e.year <= 2025)) throw new Error('2022 is locked');
      return e.corners.map(([i]) => (((i - e.shift) % n) + n) % n); }))].sort((a, b) => a - b);
    out[id] = {ds: d.ds, kappa: Array.from(t.kappa), heading: Array.from(t.heading), mapx: d.map.x, mapy: d.map.y, mid: L.mid, nrm: L.nrm,
      kerbL: k ? k.l.map(v => v / 10) : null, kerbR: k ? k.r.map(v => v / 10) : null, apex};
  }
  writeFileSync(process.argv[2], JSON.stringify(out));
  console.log(Object.entries(out).map(([k, v]) => `${k}:${v.apex.length}:${v.kerbL ? 'kerbs' : '-'}`).join(' '));
}
