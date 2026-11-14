// Track identity: one id per LAYOUT, never per venue. Every lap of every source goes through resolveTrack() before it is used.
// Why: Nürburgring and Hockenheim F1 sessions were once not recognised, and a lap must never be learned on the geometry of a
// different layout (Sakhir Grand Prix vs Outer, Paul Ricard 5.842 vs 5.771 km, Barcelona with and without the chicane).
//   node scripts/sim/learn/track-registry.mjs <f1db clone> <imsa_data clone> <endurance-cars.csv[.gz]>   -> scripts/sim/data/track-registry.json
// The committed JSON is what the code reads; rebuild it when a source adds a venue or a layout.
import {readdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const REG_FILE = new URL('../data/track-registry.json', import.meta.url);
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const LEN_TOL = 0.006; // a lap length within 0.6 % is the same layout; Barcelona 4.657 vs 4.675 km (0.39 %) is settled by `seasons`
let REG; export const registry = () => REG ??= JSON.parse(readFileSync(REG_FILE, 'utf8'));

// name: any event, circuit or folder name of a source. lengthKm: official or measured lap length when the source has one. season: year.
// Returns {venue, layout, sim, near, how}. sim is the simulator track id ONLY when the layout matches; otherwise null.
// near = a simulator track of the same venue within 2 % of the length: usable for learning with the layout's own track term only.
export function resolveTrack({name, lengthKm = null, season = null}, reg = registry()) {
  const n = ' ' + norm(name) + ' '; let venue = null, hit = 0;
  for (const [id, v] of Object.entries(reg.venues)) for (const a of v.aliases) if (n.includes(' ' + a + ' ') && a.length > hit) { venue = id; hit = a.length; }
  if (!venue) return {venue: null, layout: null, sim: null, how: 'unknown venue'};
  const L = reg.layouts.filter(l => l.venue === venue), inSeason = l => season != null && l.seasons?.some(([a, b]) => season >= a && season <= b);
  if (!L.length) return {venue, layout: null, sim: null, how: 'venue without a layout'};
  let c = L, how = 'only layout';
  if (lengthKm) { c = L.filter(l => Math.abs(l.lengthKm / lengthKm - 1) <= LEN_TOL); how = 'length'; if (!c.length) return {venue, layout: null, sim: null, how: `new layout: ${lengthKm} km is not a known layout of ${venue}`}; }
  if (c.length > 1 && c.some(inSeason)) { c = c.filter(inSeason); how += ' + season'; }
  if (c.length > 1 && lengthKm) c = [c.sort((a, b) => Math.abs(a.lengthKm - lengthKm) - Math.abs(b.lengthKm - lengthKm))[0]];
  if (c.length > 1) { const d = c.find(l => l.default) ; if (!d) return {venue, layout: null, sim: null, how: `ambiguous: ${c.map(l => l.id).join(', ')} (give a lap length)`}; c = [d]; how = 'venue default (no length given)'; }
  return {venue, layout: c[0].id, sim: c[0].sim || null, near: c[0].near || null, how};
}

// ---- builder ----
// venue id -> [name, country code, extra aliases]. Ids of simulator tracks are kept. f1db circuit ids and the archive's ids are aliases.
const V = {
  sakhir: ['Bahrain International Circuit', 'BHR', 'bahrain', 'sakhir'], jeddah: ['Jeddah Corniche Circuit', 'KSA', 'saudi'], imola: ['Imola', 'ITA', 'emilia', 'enzo e dino ferrari'],
  interlagos: ['Interlagos', 'BRA', 'sao paulo', 'jose carlos pace', 'brazil', 'brasil'], 'las-vegas': ['Las Vegas Strip', 'USA'], lusail: ['Lusail', 'QAT', 'losail', 'qatar'],
  'yas-marina-circuit': ['Yas Marina', 'UAE', 'yas marina', 'abu dhabi'], melbourne: ['Albert Park', 'AUS', 'australian'], shanghai: ['Shanghai', 'CHN', 'chinese'], suzuka: ['Suzuka', 'JPN', 'japanese grand'],
  miami: ['Miami International Autodrome', 'USA'], montreal: ['Circuit Gilles Villeneuve', 'CAN', 'gilles villeneuve'], 'monte-carlo': ['Monaco', 'MON', 'monaco', 'monte carlo'],
  catalunya: ['Barcelona-Catalunya', 'ESP', 'barcelona', 'barcelona catalunya'], spielberg: ['Red Bull Ring', 'AUT', 'red bull ring', 'a1 ring', 'osterreich', 'steiermark', 'styrian'],
  silverstone: ['Silverstone', 'GBR', 'british grand', '70th anniversary'], 'spa-francorchamps': ['Spa-Francorchamps', 'BEL', 'spa', 'francorchamps'], hungaroring: ['Hungaroring', 'HUN', 'magyar', 'mogyorod'],
  zandvoort: ['Zandvoort', 'NED', 'dutch grand'], monza: ['Monza', 'ITA', 'autodromo nazionale di monza'], madring: ['Madring', 'ESP', 'madrid'], baku: ['Baku City Circuit', 'AZE', 'azerbaijan'],
  'kuala-lumpur': ['Sepang', 'MAS', 'sepang', 'malaysia'], singapore: ['Marina Bay', 'SGP', 'marina bay'], austin: ['Circuit of the Americas', 'USA', 'circuit of the americas', 'cota', 'americas', 'lone star'],
  'mexico-city': ['Autódromo Hermanos Rodríguez', 'MEX', 'hermanos rodriguez', 'mexico'], yeongam: ['Korea International Circuit', 'KOR', 'korea international'], yongin: ['Everland Speedway', 'KOR', 'everland'],
  inje: ['Inje Speedium', 'KOR', 'speedium'], mugello: ['Mugello', 'ITA', 'toscana'], nurburgring: ['Nürburgring', 'GER', 'nuerburgring', 'eifel', 'nordschleife'], 'brands-hatch': ['Brands Hatch', 'GBR'],
  kyalami: ['Kyalami', 'RSA'], fuji: ['Fuji Speedway', 'JPN', 'fuji speedway'], daytona: ['Daytona International Speedway', 'USA', 'roar before the 24', 'daytona test', 'rolex 24'],
  'laguna-seca': ['Laguna Seca', 'USA', 'weathertech raceway laguna seca', 'monterey'], 'watkins-glen': ['Watkins Glen', 'USA', 'wgi', 'the glen', 'sahlen'], mosport: ['Canadian Tire Motorsport Park', 'CAN', 'canadian tire motorsport park', 'ctmp'],
  'road-america': ['Road America', 'USA', 'elkhart lake'], vir: ['Virginia International Raceway', 'USA', 'virginia international raceway', 'virginia'], indianapolis: ['Indianapolis Motor Speedway', 'USA', 'indianapolis motor speedway rc', 'battle on the bricks', 'brickyard'],
  'road-atlanta': ['Road Atlanta', 'USA', 'petit le mans'], 'mid-ohio': ['Mid-Ohio', 'USA', 'mid ohio sports car course'], 'lime-rock': ['Lime Rock Park', 'USA', 'lime rock park'],
  'le-mans': ['Circuit de la Sarthe (24 Hours)', 'FRA', 'le mans', 'lemans', 'sarthe'], bugatti: ['Le Mans Bugatti', 'FRA'], portimao: ['Algarve (Portimão)', 'POR', 'autodromo do algarve', 'algarve', 'portugal grand'],
  hockenheim: ['Hockenheimring', 'GER', 'hockenheimring', 'deutschland'], bathurst: ['Mount Panorama', 'AUS', 'mount panorama'], 'paul-ricard': ['Paul Ricard', 'FRA', 'castellet', 'le castellet', 'grand prix de france'],
  rwanda: ['Rwanda (planned)', 'RWA'], sebring: ['Sebring International Raceway', 'USA', 'sebring february test', 'february imsa sanctioned test'], 'long-beach': ['Long Beach street circuit', 'USA'],
  detroit: ['Detroit street course', 'USA', 'detroit street course'], 'belle-isle': ['Detroit Belle Isle', 'USA', 'belle isle street course'], dubai: ['Dubai Autodrome', 'UAE', 'dubai autodrome'],
  aragon: ['MotorLand Aragón', 'ESP', 'motorland', 'circuito motorland aragon'], istanbul: ['Istanbul Park', 'TUR', 'turkish', 'turkey'], sochi: ['Sochi Autodrom', 'RUS', 'sirius', 'russian grand'],
  macau: ['Macau Guia', 'MAC', 'guia'], misano: ['Misano', 'ITA'], zolder: ['Zolder', 'BEL'], norisring: ['Norisring', 'GER'], oschersleben: ['Oschersleben', 'GER'], lausitz: ['Lausitzring', 'GER', 'lausitzring', 'eurospeedway'],
  sachsenring: ['Sachsenring', 'GER'], assen: ['TT Circuit Assen', 'NED'], 'magny-cours': ['Magny-Cours', 'FRA', 'magny cours'], valencia: ['Valencia', 'ESP', 'ricardo tormo'], estoril: ['Estoril', 'POR'], jerez: ['Jerez', 'ESP'],
  buriram: ['Chang International Circuit', 'THA', 'chang international'], donington: ['Donington Park', 'GBR'], vallelunga: ['Vallelunga', 'ITA'], barber: ['Barber Motorsports Park', 'USA'], sonoma: ['Sonoma Raceway', 'USA', 'sears point'],
};
const F1DB = {bahrain: 'sakhir', 'marina-bay': 'singapore', monaco: 'monte-carlo', 'yas-marina': 'yas-marina-circuit', sepang: 'kuala-lumpur', hockenheimring: 'hockenheim', sirius: 'sochi'};
// simulator track -> the layout it was built on (venue, official km). Production tracks come from 2025/2026 F1 qualifying positions.
const SIM_LAYOUT = {'nurburgring-gp': ['nurburgring', 5.148], 'nurburgring-sprint': ['nurburgring', 3.629], 'nurburgring-24h': ['nurburgring', 25.378], 'sakhir-outer': ['sakhir', 3.543], 'paul-ricard-f1': ['paul-ricard', 5.842],
  'brands-hatch': ['brands-hatch', 3.916], kyalami: ['kyalami', 4.522], indianapolis: ['indianapolis', 3.925], 'lime-rock': ['lime-rock', 2.372], rwanda: ['rwanda', 5.302], yongin: ['yongin', 4.346], bathurst: ['bathurst', 6.213]};

if (process.argv[1]?.endsWith('track-registry.mjs')) {
  const [F1, ARCH, CARS] = process.argv.slice(2), {lapsimTracks, lapsimExtraTracks} = await import('../../../worker/lapsim/tracks-data.js');
  const venues = Object.fromEntries(Object.entries(V).map(([id, [name, country, ...al]]) => [id, {name, country, aliases: new Set([norm(id), norm(name), ...al.map(norm)])}]));
  // A timing feed can state the same layout a few metres differently (Spielberg 4.318 / 4.326 km). Lengths of one venue within
  // 0.35 % are one layout unless f1db lists them as separate layouts (exact match first: Barcelona 4.655 / 4.657 / 4.675 km).
  const layouts = [], put = (venue, km, src, seasons) => { let l = layouts.find(x => x.venue === venue && Math.abs(x.lengthKm - km) < 0.0006);
    if (!l && !src.startsWith('f1db')) { l = layouts.filter(x => x.venue === venue && Math.abs(x.lengthKm / km - 1) < 0.0035 && !(x.seasons.length && seasons?.length && Math.max(...x.seasons) < Math.min(...seasons) - 20)).sort((p, q) => Math.abs(p.lengthKm - km) - Math.abs(q.lengthKm - km))[0]; if (l) (l.alsoStatedKm ||= []).includes(+km.toFixed(3)) || l.alsoStatedKm.push(+km.toFixed(3)); }
    if (!l) layouts.push(l = {id: null, venue, lengthKm: +km.toFixed(3), seasons: [], sources: []}); if (!l.sources.includes(src)) l.sources.push(src); for (const y of seasons || []) l.seasons.push(y); return l; };
  // 1. f1db: every circuit and layout of the world championship, with the seasons each layout was raced
  const used = {}; for (const y of readdirSync(join(F1, 'src/data/seasons'))) { const rd = join(F1, 'src/data/seasons', y, 'races'); if (!existsSync(rd)) continue;
    for (const r of readdirSync(rd)) { const t = readFileSync(join(rd, r, 'race.yml'), 'utf8'), id = t.match(/circuitLayoutId: (\S+)/)?.[1]; if (id) (used[id] ||= []).push(+y); } }
  for (const f of readdirSync(join(F1, 'src/data/circuits'))) { const t = readFileSync(join(F1, 'src/data/circuits', f), 'utf8'), cid = t.match(/^id: (\S+)/m)[1], vid = F1DB[cid] || cid;
    const v = venues[vid] ||= {name: t.match(/^fullName: (.+)/m)?.[1] || cid, country: null, aliases: new Set()}; [cid, t.match(/^name: (.+)/m)?.[1], t.match(/^fullName: (.+)/m)?.[1], t.match(/^placeName: (.+)/m)?.[1]].filter(Boolean).forEach(a => v.aliases.add(norm(a)));
    for (const m of t.matchAll(/- id: (\S+)[^\n]*\n(?:\s+effective: \S+\n)?\s+length: ([\d.]+)/g)) put(vid, +m[2], 'f1db:' + m[1], used[m[1]] || []); }
  // 2. endurance archive: venue aliases, and the lap length measured from every car's best lap (KPH x lap time), per season
  for (const t of JSON.parse(readFileSync(join(ARCH, 'tracks.json'), 'utf8')).tracks) { const hit = Object.entries(venues).find(([id, v]) => [t.id, ...t.aliases].some(a => v.aliases.has(norm(a)))); if (hit) [t.id, t.official_name, t.short_name].forEach(a => hit[1].aliases.add(norm(a))); }
  const rows = (CARS.endsWith('.gz') ? gunzipSync(readFileSync(CARS)).toString() : readFileSync(CARS, 'utf8')).trim().split('\n').slice(1).map(l => l.split(',')), ev = new Map(), miss = new Set();
  for (const r of rows) { const km = +r[17]; if (!(km > 1)) continue; const k = r[0] + '|' + r[2] + '|' + r[1]; (ev.get(k) || ev.set(k, []).get(k)).push(km); }
  const tmp = {venues: Object.fromEntries(Object.entries(venues).map(([k, v]) => [k, {...v, aliases: [...v.aliases].filter(Boolean)}])), layouts: []};
  for (const [k, kms] of ev) { const [series, event, season] = k.split('|'), km = kms.sort((a, b) => a - b)[kms.length >> 1], r = resolveTrack({name: event}, tmp); if (!r.venue) { miss.add(series + ' ' + event); continue; }
    put(r.venue, km, 'alkamel:' + series, [+season]); }
  // 3. simulator tracks -> their layout
  const sim = {...lapsimTracks, ...lapsimExtraTracks};
  for (const [id, t] of Object.entries(sim)) { const [venue, km] = SIM_LAYOUT[id] || [id, (t.officialLengthM || 0) / 1000];
    let l = km ? layouts.filter(x => x.venue === venue && Math.abs(x.lengthKm / km - 1) < 0.004).sort((a, b) => Math.abs(a.lengthKm - km) - Math.abs(b.lengthKm - km))[0]
      : layouts.filter(x => x.venue === venue && x.seasons.includes(t.year || 2025) && x.sources.some(s => s.startsWith('f1db')))[0];
    if (!l && km) l = put(venue, km, 'simulator'); if (!l) throw new Error('no layout for simulator track ' + id); if (l.sim) throw new Error(`${id} and ${l.sim} claim one layout`); l.sim = id; }
  // ids: the simulator id when there is one, else venue-<metres>. seasons -> ranges. default = the layout used most recently.
  for (const l of layouts) { l.id = l.sim || `${l.venue}-${Math.round(l.lengthKm * 1000)}`; const ys = [...new Set(l.seasons)].sort((a, b) => a - b), rg = []; for (const y of ys) { const last = rg[rg.length - 1]; if (last && y - last[1] <= 1) last[1] = y; else rg.push([y, y]); } l.seasons = rg; }
  for (const v of Object.keys(venues)) { const L = layouts.filter(l => l.venue === v); if (L.length) L.sort((a, b) => (b.seasons.at(-1)?.[1] || 0) - (a.seasons.at(-1)?.[1] || 0) || (b.sim ? 1 : 0) - (a.sim ? 1 : 0))[0].default = true; }
  // near: a layout without its own geometry that shares almost the whole lap with a simulator track of the same venue (length within
  // 2 %: Paul Ricard 5.771 / 5.821 km against the F1 5.842 km line, Barcelona with the chicane). Learning may use that geometry with
  // the layout's OWN track term; the page never shows it as the same track.
  for (const l of layouts) if (!l.sim) { const s = layouts.filter(x => x.sim && x.venue === l.venue && Math.abs(x.lengthKm / l.lengthKm - 1) < 0.02).sort((p, q) => Math.abs(p.lengthKm - l.lengthKm) - Math.abs(q.lengthKm - l.lengthKm))[0]; if (s) l.near = s.sim; }
  layouts.sort((a, b) => a.venue.localeCompare(b.venue) || a.lengthKm - b.lengthKm);
  writeFileSync(REG_FILE, JSON.stringify({note: 'Generated by scripts/sim/learn/track-registry.mjs. One entry per layout. sim = simulator track built on exactly this layout.',
    sources: ['https://github.com/f1db/f1db (circuits, layouts, seasons; CC BY 4.0)', 'https://github.com/tobi/imsa_data (Al Kamel CSV archive: IMSA, WEC, ELMS, Asian LMS; lap length measured from KPH x lap time)', 'worker/lapsim/tracks-data.js'],
    venues: tmp.venues, layouts}, null, 1).replace(/\[\n\s+(\d+),\n\s+(\d+)\n\s+\]/g, '[$1, $2]'));
  console.log(Object.keys(venues).length, 'venues', layouts.length, 'layouts', layouts.filter(l => l.sim).length, 'with simulator geometry; unmapped events:', [...miss]);
}
