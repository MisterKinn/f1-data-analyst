// Tracks, third pass (owner 2026-11-15): fetch the OpenStreetMap ways of Sebring, the street circuits and the tracks whose
// first runs failed, so the laps can be assembled and checked offline. The shell of a Claude session cannot reach Overpass and
// the Actions artifact store, so the raw ways are printed into the job log (gzip + base64, between @@OSM markers) and are NOT
// committed (physics rule 2.9). Committed: scripts/sim/data/learn/probe-tracks3.json (counts and errors only).
// © OpenStreetMap contributors, ODbL.
import {mkdirSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const API = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
async function overpass(q) { let last; // Overpass 504s are common: up to 8 tries over the mirrors with growing waits
  for (let n = 0; n < 8; n++) { try { const r = await fetch(API[n % API.length], {method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(120000), headers: {'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'kongboda-lapsim (github.com/MisterKinn/f1-data-analyst)'}}); if (!r.ok) throw new Error(`${r.status}`); return await r.json(); }
    catch (e) { last = `${API[n % API.length]}: ${e.message || e}`; await new Promise(f => setTimeout(f, 5000 * (n + 1))); } }
  throw new Error(last); }
const ROADS = '^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|service|living_street|pedestrian)$';
// id, centre, radius (m), roads radius (m, 0 = none)
const V = [
  ['sebring', 27.455, -81.35, 5000, 0], ['aragon', 41.0786, -0.2066, 3000, 0], ['lausitz', 51.5333, 13.9264, 3500, 0], ['autopolis', 33.0369, 130.9764, 3000, 0],
  ['the-bend', -35.2681, 139.5272, 4000, 0], ['barber', 33.5328, -86.6193, 2500, 0], ['snetterton', 52.4636, 0.9461, 2500, 0], ['sugo', 38.1406, 140.7747, 2500, 0],
  ['long-beach', 33.7637, -118.1922, 1500, 1500], ['detroit', 42.3291, -83.0437, 1500, 1500], ['norisring', 49.4317, 11.1236, 1500, 1500],
  ['fe-hong-kong', 22.2840, 114.1610, 1000, 1000], ['fe-paris', 48.8575, 2.3130, 900, 900], ['fe-santiago-forestal', -33.4365, -70.6420, 1200, 1200], ['fe-santiago-ohiggins', -33.4645, -70.6610, 1500, 1500],
  ['fe-seoul', 37.5140, 127.0730, 1200, 1200], ['fe-new-york', 40.6765, -74.0155, 1000, 1000], ['fe-puebla', 19.0400, -98.1600, 8000, 0], ['fe-marrakesh', 31.5900, -8.0300, 5000, 0],
  ['fe-bern', 46.9550, 7.4600, 1200, 1200], ['fe-rome', 41.8320, 12.4700, 1300, 1300], ['fe-london-excel', 51.5075, 0.0300, 900, 900], ['fe-london-battersea', 51.4795, -0.1570, 1000, 1000],
  ['fe-monaco', 43.7370, 7.4240, 1000, 1000], ['fe-valencia', 39.4867, -0.6289, 2500, 0],
];
const D = '.cache/lapsim/probe3', sum = {source: 'OpenStreetMap via Overpass (© OpenStreetMap contributors, ODbL). Raw ways in the job log only.', fetched: new Date().toISOString(), venues: {}};
mkdirSync(D, {recursive: true});
for (const [id, lat, lon, r, rr] of V) {
  try {
    const d = await overpass(`[out:json][timeout:110];(way["highway"="raceway"](around:${r},${lat},${lon});way["aeroway"~"^(runway|taxiway)$"](around:${r},${lat},${lon});way["leisure"="track"]["sport"~"motor"](around:${r},${lat},${lon}););out geom tags;`);
    if (rr) { const q = await overpass(`[out:json][timeout:110];way["highway"~"${ROADS}"](around:${rr},${lat},${lon});out geom tags;`); d.roads = q.elements; }
    // keep only what the assembler reads: tags and geometry
    const slim = e => ({type: e.type, id: e.id, tags: e.tags, geometry: e.geometry?.map(g => ({lat: +g.lat.toFixed(7), lon: +g.lon.toFixed(7)}))});
    const out = {elements: d.elements.filter(e => e.type === 'way').map(slim), roads: d.roads?.filter(e => e.type === 'way').map(slim)};
    writeFileSync(`${D}/${id}.json`, JSON.stringify(out));
    const b64 = gzipSync(JSON.stringify(out)).toString('base64');
    console.log(`@@OSM ${id} ${b64.length}`); for (let i = 0; i < b64.length; i += 4000) console.log('@@' + b64.slice(i, i + 4000)); console.log(`@@END ${id}`);
    sum.venues[id] = {ways: out.elements.length, raceway: out.elements.filter(e => e.tags?.highway === 'raceway').length, aeroway: out.elements.filter(e => e.tags?.aeroway).length, roads: out.roads?.length};
  } catch (e) { sum.venues[id] = {error: String(e).slice(0, 200)}; console.log(id, 'ERROR', e.message); }
  await new Promise(f => setTimeout(f, 2000));
}
writeFileSync('scripts/sim/data/learn/probe-tracks3.json', JSON.stringify(sum, null, 1));
console.log(JSON.stringify(sum.venues));
