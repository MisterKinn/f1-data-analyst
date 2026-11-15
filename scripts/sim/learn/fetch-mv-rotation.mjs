// Broadcast orientation of the F1 track maps (owner 2026-11-15: the map should open the way fans know it, e.g. Monza with the main
// straight along the bottom). MultiViewer's circuit info (the source F1 graphics follow) gives each circuit's outline in the raw F1
// position frame and the rotation it is shown at. The simulator map is in true east/north, so the opening turn of our map is the
// MultiViewer rotation minus the turn from the raw frame to true (fitted with alignClosed). Out: scripts/sim/data/learn/mv-rotation.json.
// Needs network: run in Actions (lapsim-learn.yml). Only the derived angles are stored.
import {writeFileSync} from 'node:fs';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
import {alignClosed} from '../../../worker/lapsim/geometry.js';

const KEYS = {istanbul: [9, 2021], sochi: [61, 2020], 'nurburgring-gp': [20, 2020], 'sakhir-outer': [63, 2020], 'paul-ricard-f1': [33, 2021], portimao: [75, 2021], mugello: [76, 2020], hockenheim: [30, 2019]};
const out = {}, log = [];
const all = {...lapsimTracks, ...lapsimExtraTracks};
for (const [id, t] of Object.entries(all)) {
  const [key, year] = t.circuitKey ? [t.circuitKey, t.year] : KEYS[id] || [];
  if (!key || !t.map?.x?.length) continue;
  try {
    const r = await fetch(`https://api.multiviewer.app/api/v1/circuits/${key}/${year}`, {headers: {'user-agent': 'kongboda-lapsim'}});
    if (!r.ok) { log.push(`${id}: HTTP ${r.status}`); continue; }
    const mv = await r.json();
    if (!mv.x?.length) { log.push(`${id}: no outline`); continue; }
    const al = alignClosed(mv.x, mv.y, t.map.x, t.map.y), theta = al.theta * 180 / Math.PI;
    const rot = (((mv.rotation - theta) % 360) + 540) % 360 - 180;
    out[id] = {circuitKey: key, year, mvRotation: mv.rotation, rawToTrueDeg: +theta.toFixed(1), mirror: al.mirror, fitRmsM: +al.rms.toFixed(1), openDeg: +rot.toFixed(1)};
    console.log(id, out[id]);
    await new Promise(res => setTimeout(res, 400));
  } catch (e) { log.push(`${id}: ${e.message}`); }
}
writeFileSync('scripts/sim/data/learn/mv-rotation.json', JSON.stringify({source: 'api.multiviewer.app circuit info (rotation and outline); derived angles only', tracks: out, log}, null, 1));
console.log(Object.keys(out).length, 'tracks', log);
