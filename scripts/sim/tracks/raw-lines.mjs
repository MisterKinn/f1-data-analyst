// Map midlines without the shape correction, for osm-fit-start.py: {id: [[x, y], ...]}
import {lineData} from '../../../worker/simulation.js';
import {lapsimAllTracks} from '../../../worker/lapsim/tracks.js';
const o = {};
for (const id of Object.keys(lapsimAllTracks)) { const m = lineData(id, {shape: false})?.mid; if (m) o[id] = m; }
process.stdout.write(JSON.stringify(o));
