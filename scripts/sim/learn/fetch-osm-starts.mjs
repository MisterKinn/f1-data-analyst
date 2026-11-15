// Owner 2026-11-15: map-built tracks ran backwards and started at the first mapped node. Runs in GitHub Actions (Overpass needs the
// network). For every map track: OpenStreetMap pit lanes and start/finish features near the circuit, so the builder can put the start
// on the pit straight and check the direction (a one-way pit lane is drawn in the race direction).
// Output (committed): scripts/sim/data/learn/osm-starts.json. © OpenStreetMap contributors, ODbL.
import {readFileSync, writeFileSync} from 'node:fs';
const D = 'scripts/sim/data/', spec = JSON.parse(readFileSync(D + 'track-extra.json', 'utf8')).tracks, files = {};
const API = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
async function overpass(q, n = 0) {
  try { const r = await fetch(API[n % API.length], {method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(70000), headers: {'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'kongboda-lapsim (github.com/MisterKinn/f1-data-analyst)'}}); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { if (n >= 3) throw new Error(`${API[n % API.length]}: ${e.message || e}`); await new Promise(f => setTimeout(f, 4000 * (n + 1))); return overpass(q, n + 1); }
}
const out = {source: 'OpenStreetMap via Overpass API (© OpenStreetMap contributors, ODbL)', fetched: new Date().toISOString(), tracks: {}};
for (const [id, s] of Object.entries(spec)) {
  if (s.driven) continue;
  const f = files[s.file] ??= JSON.parse(readFileSync(D + 'tracks/' + s.file, 'utf8')), c = (f.tracks || f.variants)[s.candidate];
  if (!c?.centre || !c.map) { out.tracks[id] = {error: 'no map centre'}; continue; }
  // map x/y are east/north metres from c.centre (the first mapped node); the circle covers the whole lap
  const r = Math.min(9000, Math.max(...c.map.x.map((x, i) => Math.hypot(x, c.map.y[i]))) + 300), [la, lo] = c.centre, A = `(around:${Math.round(r)},${la},${lo})`;
  // key lookups only (a name regex over the whole circle timed out on every mirror); pit and start/finish filtering is done here
  const q = `[out:json][timeout:60];(way["highway"~"^(raceway|service)$"]${A};nwr["raceway"]${A};);out geom tags;`;
  try {
    const d = await overpass(q);
    const keep = e => /pit|finish|start|timing|grid/i.test([e.tags?.raceway, e.tags?.service, e.tags?.name].join(' '));
    out.tracks[id] = {centre: c.centre, elements: d.elements.filter(keep).map(e => ({type: e.type, id: e.id, tags: e.tags || {},
      geom: e.type === 'node' ? [[+e.lat.toFixed(7), +e.lon.toFixed(7)]] : (e.geometry || (e.members || []).flatMap(m => m.geometry || [])).map(g => [+g.lat.toFixed(7), +g.lon.toFixed(7)])}))};
    console.log(id, out.tracks[id].elements.length, out.tracks[id].elements.map(e => e.tags.name || e.tags.raceway || e.tags.service || e.type).slice(0, 6).join(' | '));
  } catch (e) { out.tracks[id] = {error: String(e.message || e)}; console.log(id, 'error', e.message); }
  writeFileSync(D + 'learn/osm-starts.json', JSON.stringify(out)); // partial results survive a timeout
  await new Promise(f => setTimeout(f, 1500));
}
writeFileSync(D + 'learn/osm-starts.json', JSON.stringify(out));
