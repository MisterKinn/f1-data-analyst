// Formula E: tracks from the official circuit maps and a learned lap-time model per rule set (Gen2, Gen3, Gen3 Evo; Gen4 prior).
//   node scripts/sim/learn/build-fe.mjs
// In:  scripts/sim/data/learn/fe-maps.json (FIA / Al Kamel circuit-map PDFs, fetch-fe-maps.mjs), fe-cars.csv.gz (Al Kamel, every
//      session of seasons 5-12, one row per car and session), fe-duels.csv (qualifying duels, PDF classifications; optional).
// Out: worker/lapsim/fe-tracks-data.js (lapsimFeTracks), worker/lapsim/fe-data.js (lapsimFe), scripts/sim/data/learn/fe-fit.json.
// Model (log scale, ridge): log(real) = log(sim of the rule-set car at the session's power, session weather) + G(rule set) + T(layout);
// T ~ N(0, 0.05). Session power (fe-cars.js feCarFor): qualifying groups below full power (Gen3 300 kW, Season 8 220 kW), duels and
// practice at full power, so G holds no power deficit and exp(G + T) on the full-power page car predicts a full-power lap.
// Reproduction: every layout and rule set that raced keeps its fastest real lap (owner rule 2026-11-14).
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {lapsimKernel} from '../../../worker/lapsim/kernel.js';
import {lapsimTracks, lapsimExtraTracks} from '../../../worker/lapsim/tracks-data.js';
import {feKeyOf, feCarFor} from '../../../worker/lapsim/fe-cars.js';
import {buildTrack} from '../build-geometry-extra.mjs';
import {parseCsv} from './build-endurance.mjs';
import {lineOf, lengthOf, metres} from './fe-lines.mjs';

const K = lapsimKernel(), D = 'scripts/sim/data/learn/', lapsimAllTracks = {...lapsimTracks, ...lapsimExtraTracks}; // not the FE tracks this script writes
const NAME = {'são paolo': 'São Paulo', 'mexico city': 'Mexico', 'ad diriyah': 'Diriyah', madrid: 'Jarama', 'new york city': 'New York'};
export const venueOf = s => { const v = s.replace(/^R\d+\s+/, '').replace(/\s+(rookie\s+)?testing$/i, '').trim(); return NAME[v.toLowerCase()] || v; };
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const seasonYear = s => 2014 + +/Season (\d+)/.exec(s)[1]; // Season 12 = 2025-26 -> 2026
const SAME = 0.004; // two lengths within 0.4 % are one layout
// Simulator tracks that already are the Formula E layout (same lap, same length)
const REUSE = {'Monaco|3337': 'monte-carlo'};
const IDS = {Jarama: 'jarama', Monaco: 'fe-monaco'};
// registry venue of a Formula E venue (scripts/sim/data/track-registry.json); others get their own venue fe-<name>
const REG_VENUE = {Jarama: 'jarama', Monaco: 'monte-carlo', Jeddah: 'jeddah', Shanghai: 'shanghai', Miami: 'miami', Mexico: 'mexico-city', Misano: 'misano', Valencia: 'valencia'};

// 1. Layouts from the maps: venue + printed length; the newest map with a closed lap line is the geometry
const maps = JSON.parse(readFileSync(D + 'fe-maps.json', 'utf8')).events.map(e => ({...e, venue: venueOf(e.event), year: seasonYear(e.season), lengthM: lengthOf(e.words)})).filter(e => e.lengthM);
const layouts = [];
for (const m of maps.sort((a, b) => b.year - a.year)) {
  let L = layouts.find(l => l.venue === m.venue && Math.abs(m.lengthM / l.lengthM - 1) < SAME);
  if (!L) layouts.push(L = {venue: m.venue, lengthM: m.lengthM, years: new Set(), maps: []});
  L.years.add(m.year); L.maps.push(m);
}
// the lap line of a layout: the newest map with a closed vector line (seasons 5-8 maps are raster or black outlines only)
const pickLine = l => { for (const m of l.maps) { const line = lineOf(m); if (!line || line.gapPt > 40) continue; const g = metres(line, m.lengthM); if (Math.abs(Math.abs(g.turn) - 360) < 5) return {m, g}; } return null; };
for (const l of layouts) { const ys = [...l.years].sort(), same = layouts.filter(o => o.venue === l.venue), newest = same.every(o => Math.max(...o.years) <= Math.max(...ys));
  l.pick = pickLine(l); // the id year is the first year of a map that gives the line, so older maps without a line never rename a track
  const idYear = l.pick ? Math.min(...l.maps.filter(m => pickLine({maps: [m]})).map(m => m.year)) : ys[0];
  l.id = REUSE[`${l.venue}|${l.lengthM}`] || (IDS[l.venue] || 'fe-' + slug(l.venue)) + (newest ? '' : '-' + idYear); l.first = ys[0]; l.last = ys.at(-1); }

// 2. Track geometry (least-curvature line inside an 11 m street track, flat)
const tracks = {}, geomLog = [];
for (const l of layouts) {
  if (lapsimAllTracks[l.id]) { l.sim = l.id; geomLog.push({id: l.id, from: 'existing simulator track'}); continue; }
  if (!l.pick) { geomLog.push({id: l.id, from: 'no usable lap line on the maps'}); continue; }
  const {m, g} = l.pick, c = {ds: g.ds, length: Math.round(g.kappa.length * g.ds), officialLengthM: l.lengthM, widthM: 11, kappa: Array.from(g.kappa, k => Math.round(k * 1e5)), grade: null, sectors: [], corners: []};
  const span = l.first === l.last ? `${l.first - 1}-${String(l.first).slice(2)}` : `${l.first - 1}-${String(l.last).slice(2)}`;
  const t = buildTrack(l.id, {name: `${l.venue} (Formula E ${span})`, layout: `Formula E ${l.lengthM} m`, widthM: 11,
    shapeEvidence: '2 measured (official FIA Formula E circuit map, vector line)', sources: [`FIA Formula E circuit map, ${m.season}, ${m.event} (Al Kamel Systems): ${m.url}`]}, c);
  t.series = 'fe'; t.fit = true; tracks[l.id] = t; l.sim = l.id; geomLog.push({id: l.id, from: `${m.season} ${m.event}`, turn: Math.round(g.turn), length: t.length});
}

// 3. Rows: Al Kamel car-session bests, matched to a layout by venue and measured length
const base = parseCsv(gunzipSync(readFileSync(D + 'fe-cars.csv.gz')).toString());
// duels (fetch-fe-duels.mjs, PDF classifications): lap length, car and team from the same car's group row of that event
const duels = existsSync(D + 'fe-duels.csv') ? parseCsv(readFileSync(D + 'fe-duels.csv', 'utf8')).flatMap(d => {
  const g = base.find(r => r.season === d.season && r.event === d.event && r.entry === d.entry && r.type === 'Q'); return g ? [{...g, ...d, session: d.session, type: 'Q', vehicle: g.vehicle, team: g.team, lenKm: g.lenKm}] : []; }) : [];
const rows = [...base, ...duels].map(r => ({...r, season: +r.season, best: +r.best, lenM: +r.lenKm * 1000, venue: venueOf(r.event)}))
  .filter(r => r.best > 0 && r.lenM > 0);
const skipped = {};
for (const r of rows) { const l = layouts.find(l => l.venue === r.venue && Math.abs(r.lenM / l.lengthM - 1) < SAME); r.layout = l?.sim; r.key = feKeyOf(r.season);
  if (!r.layout) skipped[`${r.venue} ${r.lenM}`] = (skipped[`${r.venue} ${r.lenM}`] || 0) + 1; }
const used = rows.filter(r => r.layout && !(+r.rainShare > 0.02) && r.best < 1.3 * r.lenM / 1000 * 30); // dry; slower than 120 km/h average is not a lap

// 4. Records: fastest lap per layout and rule set (any session), fastest race lap
const rec = (r, type) => ({lap: r.best, weather: {airTempC: +r.airC || undefined, trackTempC: +r.trackC || undefined, humidityPct: +r.hum || undefined, pressureHpa: +r.hpa || undefined}, year: r.season, event: r.event, session: r.session.replace(/^\d+_/, ''), type, kW: feCarFor(r.key, r.season, r.session, r.type).pIce / 1e3, entry: r.entry, model: r.vehicle.replace(/\s+/g, ' ').trim(), team: r.team});
const real = {}, raceReal = {};
for (const r of used) { const a = (real[r.layout] ||= {}), b = (raceReal[r.layout] ||= {});
  if (!a[r.key] || r.best < a[r.key].lap) a[r.key] = rec(r, r.type);
  if (r.type === 'R' && (!b[r.key] || r.best < b[r.key].lap)) b[r.key] = rec(r, 'R'); }

// 5. Fit rows: best qualifying lap per layout, season and rule set
const simCache = new Map(), trk = id => trk[id] ||= K.trackFromData(tracks[id] || lapsimAllTracks[id]);
const simLap = (id, key, r) => { const car = feCarFor(key, r.season, r.session, r.type), k = [id, key, car.pIce, Math.round(+r.airC || 25), Math.round(+r.trackC || 35)].join('|'); if (simCache.has(k)) return simCache.get(k);
  const env = K.conditionsFromWeather({pressureHpa: +r.hpa || 1013.25, airTempC: +r.airC || 25, humidityPct: +r.hum || 50, trackTempC: +r.trackC || 35, windSpeed: 0, windFromDeg: 0});
  const v = K.simulateLap(trk(id), car, env).lapTime; simCache.set(k, v); return v; };
const qb = new Map();
for (const r of used.filter(r => r.type === 'Q' && r.key !== 'fe-gen4')) { const k = `${r.layout}|${r.season}|${r.key}`; if (!qb.has(k) || r.best < qb.get(k).best) qb.set(k, r); }
const fitRows = [...qb.values()].map(r => ({layout: r.layout, season: r.season, key: r.key, real: r.best, sim: simLap(r.layout, r.key, r), kW: feCarFor(r.key, r.season, r.session, r.type).pIce / 1e3, session: r.session.replace(/^\d+_/, ''), event: r.event}));
for (const f of fitRows) f.y = Math.log(f.real / f.sim);

function fit(rs, tauT = 0.05, sigma = 0.01) { // alternating ridge: G per rule set (free), T per layout (shrunk to 0)
  const G = {}, T = {}, lam = (sigma / tauT) ** 2;
  for (let it = 0; it < 200; it++) {
    for (const k of new Set(rs.map(r => r.key))) { const a = rs.filter(r => r.key === k); G[k] = a.reduce((s, r) => s + r.y - (T[r.layout] || 0), 0) / a.length; }
    for (const l of new Set(rs.map(r => r.layout))) { const a = rs.filter(r => r.layout === l); T[l] = a.reduce((s, r) => s + r.y - G[r.key], 0) / (a.length + lam); }
  }
  return {G, T};
}
const pct = x => (Math.exp(x) - 1) * 100, rms = a => a.length ? +Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length).toFixed(2) : null;
const all = fit(fitRows);
const out = fitRows.map(r => { const ev = fit(fitRows.filter(o => o !== r)), lo = fit(fitRows.filter(o => o.layout !== r.layout));
  return {...r, before: pct(r.y), inSample: pct(r.y - all.G[r.key] - (all.T[r.layout] || 0)), event: pct(r.y - (ev.G[r.key] ?? 0) - (ev.T[r.layout] || 0)), layoutOut: pct(r.y - (lo.G[r.key] ?? 0))}; });
const table = (sel, by) => { const g = {}; for (const r of out.filter(sel)) (g[by(r)] ||= []).push(r);
  return Object.fromEntries(Object.entries(g).map(([k, a]) => [k, {rows: a.length, before: rms(a.map(r => r.before)), event: rms(a.map(r => r.event)), layoutOut: rms(a.map(r => r.layoutOut)), inSample: rms(a.map(r => r.inSample))}])); };
const byKey = table(() => true, r => r.key), byLayout = table(() => true, r => r.layout);
console.table(byKey); console.table(byLayout); console.log('skipped (no layout):', skipped); console.table(geomLog);

// 6. Outputs
const errPct = Object.fromEntries(Object.entries(byLayout).map(([l, v]) => [l, v.event]));
const feTracks = {};
for (const l of layouts) if (l.sim) feTracks[l.sim] = {venue: l.venue, lengthM: l.lengthM, seasons: [...l.years].sort(), T: +(all.T[l.sim] || 0).toFixed(4), errPct: errPct[l.sim] ?? null, real: real[l.sim] || {}, raceReal: raceReal[l.sim] || {}};
const data = {generated: new Date().toISOString().slice(0, 10), G: Object.fromEntries(Object.entries(all.G).map(([k, v]) => [k, +v.toFixed(4)])), heldOutPct: byKey, tracks: feTracks,
  note: 'Learned by scripts/sim/learn/build-fe.mjs. timeScale on a Formula E track = exp(G + T); elsewhere exp(G). Gen4 has no laps: exp(T) on the prior.'};
writeFileSync('worker/lapsim/fe-data.js', '// Generated by scripts/sim/learn/build-fe.mjs (Formula E learning step). Do not edit by hand.\nexport const lapsimFe=' + JSON.stringify(data) + ';\n');
writeFileSync('worker/lapsim/fe-tracks-data.js', '// Generated by scripts/sim/learn/build-fe.mjs from the official Formula E circuit maps. Do not edit by hand.\nexport const lapsimFeTracks=' + JSON.stringify(tracks) + ';\n');
// one registry layout per Formula E simulator track (rule: every simulator track is exactly one layout of the registry)
const REG = 'scripts/sim/data/track-registry.json', reg = JSON.parse(readFileSync(REG, 'utf8'));
reg.layouts = reg.layouts.filter(l => !(l.sources || []).every(x => x.startsWith('fia-fe-map'))); for (const l of reg.layouts) if (l.sim && tracks[l.sim]) delete l.sim;
for (const l of layouts) { if (!tracks[l.sim]) continue; const venue = REG_VENUE[l.venue] || 'fe-' + slug(l.venue), km = +(l.lengthM / 1000).toFixed(3);
  reg.venues[venue] ||= {name: l.venue + (REG_VENUE[l.venue] ? '' : ' (Formula E street circuit)'), country: null, aliases: [slug(l.venue).replace(/-/g, ' ')]};
  const old = reg.layouts.find(x => x.venue === venue && Math.abs(x.lengthKm / km - 1) < SAME);
  if (old) { old.sim = l.sim; old.id = l.sim; (old.sources ||= []).push('fia-fe-map'); } else reg.layouts.push({id: l.sim, venue, lengthKm: km, seasons: [[l.first, l.last]], sources: ['fia-fe-map'], sim: l.sim}); }
writeFileSync(REG, JSON.stringify(reg, null, 1).replace(/\[\n\s+(\d+),\n\s+(\d+)\n\s+\]/g, '[$1, $2]'));
writeFileSync(D + 'fe-fit.json', JSON.stringify({generated: data.generated, byKey, byLayout, rows: out.map(r => ({...r, before: +r.before.toFixed(2), inSample: +r.inSample.toFixed(2), event: +r.event.toFixed(2), layoutOut: +r.layoutOut.toFixed(2), y: undefined})), geometry: geomLog, skipped, layouts: layouts.map(l => ({id: l.sim || l.id, venue: l.venue, lengthM: l.lengthM, seasons: [...l.years].sort()}))}, null, 1));
