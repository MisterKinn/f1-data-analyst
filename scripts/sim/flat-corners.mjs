// Which numbered corners F1 takes flat (owner 2026-11-16): a Straight Mode / DRS zone of an FIA document runs on through flat corners
// (Abbey, the Baku kinks, Zandvoort's banked last corner) but ends at the first corner where the cars slow down (Hungaroring T4).
// From the dry top-3 qualifying laps of each season: speed loss = 1 - (lowest speed within 40 m of the corner) / (highest speed in the
// 200 m before it); flat when the median loss is under 7 % (Abbey 4.8 % and Farm 6.6 % stay inside their zones; Copse 7.6 % and Hungaroring T4 15.9 % end one). Usage: node scripts/sim/flat-corners.mjs [traces.json]
// Output: scripts/sim/data/f1-flat-corners.json (read by scripts/sim/f1-zones.mjs). lapsim-data.yml runs it after the tracks are built.
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimTracks} from '../../worker/lapsim/tracks-data.js';
import {lapsimTrackView} from '../../worker/lapsim/track-view-data.js';

const traces = JSON.parse(readFileSync(process.argv[2] || '.cache/lapsim/traces.json', 'utf8')), OUT = 'scripts/sim/data/f1-flat-corners.json', LIMIT = 0.07;
const out = {note: 'Corners F1 takes flat: median speed loss under 7 % on the dry top-3 qualifying laps (scripts/sim/flat-corners.mjs)', tracks: {}};
for (const [id, t] of Object.entries(lapsimTracks)) {
  const C = (t.corners?.length ? t.corners : lapsimTrackView?.[id]?.corners) || [], laps = traces.filter(x => x.track === id && !x.weather?.rain && x.position <= 3);
  if (!C.length || !laps.length) continue;
  const L = t.length, loss = {};
  for (const c of C) {
    const per = laps.map(lap => { let vin = 0, vmin = 1e9;
      lap.s.forEach((s, k) => { const d = ((s - c.s) % L + L) % L, dd = d > L / 2 ? d - L : d; if (dd >= -200 && dd < -40) vin = Math.max(vin, lap.v[k]); if (dd >= -40 && dd <= 40) vmin = Math.min(vmin, lap.v[k]); });
      return vin && vmin < 1e9 ? 1 - vmin / vin : null; }).filter(x => x != null).sort((a, b) => a - b);
    if (per.length) loss[c.number + (c.letter || '')] = +per[per.length >> 1].toFixed(3);
  }
  out.tracks[id] = {laps: laps.length, flat: Object.keys(loss).filter(k => loss[k] < LIMIT), loss};
}
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(Object.entries(out.tracks).map(([id, v]) => `${id}: flat ${v.flat.join(',') || '-'}`).join('\n'));
