// Step 3 flag (claude/gate-independent-geometry-prereg-2026-11-23.md): LAPSIM_GEOM_INDEP=1 puts the car-independent geometry of
// scripts/sim/data/geom-indep/tracks.json into the WORKING COPY before a fit or a report: the four tracks' rows in
// worker/lapsim/tracks-data.js, their FIA zone positions in worker/lapsim/f1-zones-data.js and the lap distances of their measured
// speed traces in <cache>/traces.json (speeds, times and every other value unchanged: only the distance axis moves to the new line).
// Never committed: run it in CI or in a scratch copy. Flag off: does nothing (byte-identical).
// Usage: LAPSIM_GEOM_INDEP=1 node scripts/sim/geom-indep/apply.mjs [cacheDir=.cache/lapsim]
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {mapDist} from './build.mjs';

// LAPSIM_GEOM_INDEP=a3 (attempt 3, claude/gate-independent-geometry-attempt3-prereg-2026-11-23.md): tracks-a3.json, every track it holds
// (F1 rows and the extra circuits; Formula E rows stay), the era that holds 2026, tracks marked "source incomplete" left as they are
const MODE = process.env.LAPSIM_GEOM_INDEP;
if (MODE !== '1' && MODE !== 'a3') { console.log('LAPSIM_GEOM_INDEP not set: nothing changed'); process.exit(0); }
const CACHE = process.argv[2] || '.cache/lapsim', TD = 'worker/lapsim/tracks-data.js', ZD = 'worker/lapsim/f1-zones-data.js';
const G = JSON.parse(readFileSync(`scripts/sim/data/geom-indep/${MODE === 'a3' ? 'tracks-a3.json' : 'tracks.json'}`, 'utf8')).tracks;
const {lapsimTracks, lapsimExtraTracks} = await import('../../../' + TD), {lapsimF1Zones} = await import('../../../' + ZD);
const rowsOf = id => id in lapsimTracks ? lapsimTracks : id in lapsimExtraTracks ? lapsimExtraTracks : null, skipped = [];
if (MODE === 'a3') for (const id of Object.keys(G)) { const e = G[id].eras.find(q => q.to == null); if (!rowsOf(id) || !e || e.sourceIncomplete) { skipped.push(id); delete G[id]; } }
// era for a season: the one whose [from, to] holds it (one era per track today)
const eraOf = (id, year) => G[id].eras.find(e => (e.from == null || year >= e.from) && (e.to == null || year <= e.to)) || G[id].eras.at(-1);
const maps = {}, lin = {};
for (const id of Object.keys(G)) { const R = rowsOf(id), old = R[id], e = MODE === 'a3' ? G[id].eras.find(q => q.to == null) : eraOf(id, old.year), Lnew = e.row.kappa.length * e.row.ds;
  maps[id] = s => mapDist(s, old.ds, e.extra.dist, Lnew); R[id] = {...e.row, map: e.row.map ?? old.map};
  // traces: the same correspondence without the wrap (a trace runs 0 … L once), clamped to the new lap
  const t = e.extra.dist, n = t.length; lin[id] = s => { const f = Math.max(0, s) / old.ds, i = Math.min(n - 1, Math.floor(f)), b = i + 1 < n ? t[i + 1] : t[0] + Lnew; return Math.max(0, Math.min(Lnew, t[i] + (b - t[i]) * (f - i))); }; }
const src = readFileSync(TD, 'utf8');
writeFileSync(TD, src.replace(/export const lapsimTracks=[\s\S]*?;\n/, () => `export const lapsimTracks=${JSON.stringify(lapsimTracks)};\n`)
  .replace(/export const lapsimExtraTracks=[\s\S]*?;\n/, () => `export const lapsimExtraTracks=${JSON.stringify(lapsimExtraTracks)};\n`));
const r = v => Math.round(v);
for (const [id, f] of Object.entries(maps)) for (const z of Object.values(lapsimF1Zones.tracks?.[id] || {})) {
  for (const q of z.zones || []) { q.from = r(f(q.from)); q.to = r(f(q.to)); if (q.low != null) q.low = r(f(q.low)); }
  for (const m of z.marks || []) m.s = r(f(m.s)); }
const zs = readFileSync(ZD, 'utf8');
writeFileSync(ZD, zs.replace(/export const lapsimF1Zones = [\s\S]*;\n?$/, () => `export const lapsimF1Zones = ${JSON.stringify(lapsimF1Zones)};\n`));
const TP = CACHE + '/traces.json';
if (existsSync(TP)) { const tr = JSON.parse(readFileSync(TP, 'utf8')); let k = 0;
  for (const t of tr) if (maps[t.track]) { t.s = t.s.map(s => +lin[t.track](s).toFixed(1)); k++; }
  writeFileSync(TP, JSON.stringify(tr)); console.log(`traces remapped: ${k}`); }
console.log('geometry applied:', Object.keys(G).join(', ')); if (skipped.length) console.log('left as they are (source incomplete or no row):', skipped.join(', '));
