// Step 1 of new-track geometry: fetch every OpenStreetMap "highway=raceway" way near each requested venue.
// © OpenStreetMap contributors, ODbL. Raw ways go to .cache/lapsim/osm/<id>.json (artifact, not committed);
// the committed summary lists way names, lengths and closed loops so each layout can be assembled and checked
// against the official lap length before any simulator use. No geometry is invented here.
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
const REQ = JSON.parse(readFileSync(process.env.TRACK_REQUESTS || 'scripts/sim/data/track-requests.json', 'utf8')).tracks.filter(t => t.status === 'osm' && t.seed);
const OUT = '.cache/lapsim/osm'; mkdirSync(OUT, {recursive: true});
const API = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const hav = (a, b) => { const R = 6371008.8, r = Math.PI / 180, dφ = (b.lat - a.lat) * r, dλ = (b.lon - a.lon) * r; const h = Math.sin(dφ / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dλ / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function overpass(q, n = 0) {
  try { const r = await fetch(API[n % API.length], {method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(60000), headers: {'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'kongboda-lapsim (github.com/MisterKinn/f1-data-analyst)'}}); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { if (n >= 2) throw new Error(`${API[n % API.length]}: ${e.message || e}`); await new Promise(f => setTimeout(f, 4000)); return overpass(q, n + 1); }
}
const summary = {source: 'OpenStreetMap via Overpass API (© OpenStreetMap contributors, ODbL)', fetched: new Date().toISOString(), tracks: {}};
for (const t of REQ) {
  try {
    let d;
    if (existsSync(`${OUT}/${t.id}.json`)) d = JSON.parse(readFileSync(`${OUT}/${t.id}.json`, 'utf8'));   // kept from an earlier run (Actions cache)
    else {
      d = await overpass(`[out:json][timeout:50];(way["highway"="raceway"](around:${t.radius},${t.seed[0]},${t.seed[1]});relation["type"~"circuit|route"]["route"~"raceway|circuit",i](around:${t.radius},${t.seed[0]},${t.seed[1]}););out geom tags;`);
      if (t.kind) { try { const r = await overpass(`[out:json][timeout:50];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service)$"](around:${Math.min(t.radius, 1800)},${t.seed[0]},${t.seed[1]});out geom tags;`); d.roads = r.elements; } catch (e) { d.roadsError = String(e).slice(0, 120); } }
      writeFileSync(`${OUT}/${t.id}.json`, JSON.stringify(d));
      await new Promise(f => setTimeout(f, 3000));
    }
    // no raceway way at all (lap on public roads, e.g. Bathurst): fetch the roads too, also when the file came from the cache
    if (!d.roads && !d.roadsError && (t.kind || !d.elements.some(e => e.type === 'way'))) { try { const r = await overpass(`[out:json][timeout:50];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service)$"](around:${Math.min(t.radius, 1800)},${t.seed[0]},${t.seed[1]});out geom tags;`); d.roads = r.elements; } catch (e) { d.roadsError = String(e).slice(0, 120); } writeFileSync(`${OUT}/${t.id}.json`, JSON.stringify(d)); }
    // a venue whose lap uses public roads: add the ways of its route relation (marked, so the assembler keeps them)
    if (t.relation && !d.relationDone) { const r = await overpass(`[out:json][timeout:50];relation(${t.relation});way(r);out geom tags;`); d.elements.push(...r.elements.filter(e => e.type === 'way').map(e => ({...e, inRelation: t.relation}))); d.relationDone = true; writeFileSync(`${OUT}/${t.id}.json`, JSON.stringify(d)); }
    const ways = d.elements.filter(e => e.type === 'way' && e.geometry).map(e => ({id: e.id, name: e.tags?.name || null, ref: e.tags?.ref || null, sport: e.tags?.sport || null, surface: e.tags?.surface || null, oneway: e.tags?.oneway || null,
      width: e.tags?.width || null, m: Math.round(e.geometry.slice(1).reduce((a, p, i) => a + hav(e.geometry[i], p), 0)), closed: hav(e.geometry[0], e.geometry[e.geometry.length - 1]) < 0.5, nodes: e.geometry.length}));
    summary.tracks[t.id] = {kind: t.kind || 'permanent', roads: d.roads ? d.roads.length : undefined, roadNames: d.roads ? Object.entries(d.roads.reduce((o, e) => { const k = e.tags?.name; if (k) o[k] = (o[k] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 40).map(x => x[0]) : undefined, ways: ways.length, totalM: ways.reduce((a, w) => a + w.m, 0), closedLoops: ways.filter(w => w.closed).map(w => [w.name, w.m]),
      relations: d.elements.filter(e => e.type === 'relation').map(e => ({id: e.id, name: e.tags?.name, members: e.members?.length})),
      byName: Object.entries(ways.reduce((o, w) => { const k = `${w.name ?? '(no name)'} | ${w.sport ?? ''} | ${w.surface ?? ''}`; (o[k] ||= [0, 0])[0]++; o[k][1] += w.m; return o; }, {})).sort((a, b) => b[1][1] - a[1][1]).slice(0, 25)};
  } catch (e) { summary.tracks[t.id] = {error: String(e).slice(0, 200)}; }
  writeFileSync(`${OUT}/osm-summary.json`, JSON.stringify(summary, null, 1));
}
writeFileSync(`${OUT}/osm-summary.json`, JSON.stringify(summary, null, 1));
console.log(Object.entries(summary.tracks).map(([k, v]) => `${k}: ${v.error || v.ways + ' ways, ' + v.totalM + ' m'}`).join('\n'));
