// Detroit: the OpenStreetMap circuit relation 17665938 gave no loop within 3 % of 2.650 km. Print its ways into the job log
// (gzip + base64 between @@OSM markers; not committed) to check offline. © OpenStreetMap contributors, ODbL.
import {gzipSync} from 'node:zlib';
const API = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const q = '[out:json][timeout:110];relation(17665938);out tags;way(r);out geom tags;';
for (let n = 0; n < 9; n++) { try { const r = await fetch(API[n % API.length], {method: 'POST', body: 'data=' + encodeURIComponent(q), headers: {'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'kongboda-lapsim'}, signal: AbortSignal.timeout(150000)});
  if (!r.ok) throw new Error(r.status); const d = await r.json(), b64 = gzipSync(JSON.stringify(d)).toString('base64');
  console.log(`@@OSM detroit-rel ${b64.length}`); for (let i = 0; i < b64.length; i += 4000) console.log('@@' + b64.slice(i, i + 4000)); console.log('@@END detroit-rel'); break; }
  catch (e) { console.log('try', n, e.message); await new Promise(f => setTimeout(f, 5000 * (n + 1))); } }
