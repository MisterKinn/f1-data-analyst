// Long Beach and Detroit (owner 2026-11-15: must be built). Road names cannot describe these laps (both carriageways of one road,
// hairpins through median openings, car-park roads), so the lap comes from a drawn circuit map scaled to the official length,
// as for Formula E. This probe finds candidate maps and keeps a derived summary (drawn paths, printed words; files not stored):
//  - Wikimedia Commons circuit SVGs (search, licence and author kept) -> PDF (rsvg-convert) -> cairo SVG (pdftocairo) -> paths
//  - OpenStreetMap circuit relations near each venue (raw ways printed into the job log only, between @@OSM markers)
// Out: scripts/sim/data/learn/street-maps.json. Needs network, poppler-utils and librsvg2-bin: Actions.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {gzipSync} from 'node:zlib';
import {summarise} from './fetch-fe-maps.mjs';
const TMP = mkdtempSync(join(tmpdir(), 'street-')), UA = {'user-agent': 'kongboda-lapsim/1.0 (github.com/MisterKinn/f1-data-analyst)'};
const V = [{id: 'long-beach', q: ['Long Beach street circuit', 'Long Beach Grand Prix circuit'], seed: [33.7637, -118.1922]},
  {id: 'detroit', q: ['Detroit street circuit 2023', 'Detroit Grand Prix circuit'], seed: [42.3291, -83.0437]}];
const api = async p => (await fetch('https://commons.wikimedia.org/w/api.php?format=json&' + p, {headers: UA, signal: AbortSignal.timeout(60000)})).json();
const out = {source: 'Wikimedia Commons circuit maps (licence per file) and OpenStreetMap relations (© OpenStreetMap contributors, ODbL). Derived: drawn paths and words; files not stored.', venues: {}};
for (const v of V) { const o = out.venues[v.id] = {maps: [], relations: [], log: []};
  const titles = new Set(); for (const q of v.q) { try { const r = await api('action=query&list=search&srnamespace=6&srlimit=12&srsearch=' + encodeURIComponent(q + ' svg')); for (const x of r.query.search) if (/\.svg$/i.test(x.title)) titles.add(x.title); } catch (e) { o.log.push('search ' + q + ': ' + e.message); } }
  for (const title of [...titles].slice(0, 10)) { try {
      const ii = Object.values((await api('action=query&prop=imageinfo&iiprop=url|extmetadata&titles=' + encodeURIComponent(title))).query.pages)[0].imageinfo[0], md = ii.extmetadata || {};
      const svg = join(TMP, 'm.svg'), pdf = join(TMP, 'm.pdf'), cairo = join(TMP, 'c.svg'); writeFileSync(svg, Buffer.from(await (await fetch(ii.url, {headers: UA, signal: AbortSignal.timeout(60000)})).arrayBuffer()));
      execFileSync('rsvg-convert', ['-f', 'pdf', '-o', pdf, svg]); execFileSync('pdftocairo', ['-svg', pdf, cairo]);
      const html = execFileSync('pdftotext', ['-bbox', pdf, '-']).toString(), pg = html.match(/<page width="([\d.]+)" height="([\d.]+)"/);
      const words = [...html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map(m => ({t: m[5], x: +((+m[1] + +m[3]) / 2).toFixed(1), y: +((+m[2] + +m[4]) / 2).toFixed(1)}));
      o.maps.push({title, url: ii.descriptionurl, licence: md.LicenseShortName?.value, artist: String(md.Artist?.value || '').replace(/<[^>]*>/g, '').slice(0, 120), date: md.DateTimeOriginal?.value?.slice?.(0, 40), ...summarise(readFileSync(cairo, 'utf8'), words, {w: +pg[1], h: +pg[2]})});
      console.log(v.id, title, o.maps.at(-1).paths.length, 'paths');
    } catch (e) { o.log.push(title + ': ' + String(e.message).slice(0, 160)); } }
  try { const q = `[out:json][timeout:110];relation["type"~"route|circuit"](around:3000,${v.seed[0]},${v.seed[1]});out tags;`, r = await (await fetch('https://overpass-api.de/api/interpreter', {method: 'POST', body: 'data=' + encodeURIComponent(q), headers: {...UA, 'content-type': 'application/x-www-form-urlencoded'}, signal: AbortSignal.timeout(150000)})).json();
    o.relations = r.elements.filter(e => /race|circuit|grand prix|street/i.test(JSON.stringify(e.tags))).map(e => ({id: e.id, tags: e.tags}));
    for (const rel of o.relations.slice(0, 3)) { const g = await (await fetch('https://overpass-api.de/api/interpreter', {method: 'POST', body: 'data=' + encodeURIComponent(`[out:json][timeout:110];relation(${rel.id});way(r);out geom tags;`), headers: {...UA, 'content-type': 'application/x-www-form-urlencoded'}, signal: AbortSignal.timeout(150000)})).json();
      rel.ways = g.elements.length; const b64 = gzipSync(JSON.stringify({elements: g.elements})).toString('base64'); console.log(`@@OSM ${v.id}-rel-${rel.id} ${b64.length}`); for (let i = 0; i < b64.length; i += 4000) console.log('@@' + b64.slice(i, i + 4000)); console.log(`@@END ${v.id}-rel-${rel.id}`); }
  } catch (e) { o.log.push('overpass: ' + String(e.message).slice(0, 160)); }
}
writeFileSync('scripts/sim/data/learn/street-maps.json', JSON.stringify(out));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.venues).map(([k, v]) => [k, {maps: v.maps.map(m => m.title + ' ' + m.licence), relations: v.relations.map(r => r.id + ' ' + r.tags.name), log: v.log}])), null, 1));
