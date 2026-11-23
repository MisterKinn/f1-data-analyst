// Step 3 attempt 3 (claude/gate-independent-geometry-attempt3-prereg-2026-11-23.md): car-free geometry for every track with an OSM loop.
// Attempt 1's method unchanged (build.mjs buildOne: OSM centre line, σ 8 m, least-curvature line, lineTrack 5 m, best open DEM with A2–A4)
// plus only:
//   (a) a width per station: OSM raceway area polygons, else the OSM `width` tag of the matched way, else track-widths.js, else the FIA
//       list width, else 12 m (declared);
//   (b) a kerb allowance where kerbs are usable: iRacing kerb use (kerb-use-data.js, metres beyond the edge) or a 4a "kerb"/"loop"
//       corner (KERB_M, ±40 m of the corner, both sides);
//   (c) 4a "line" corners as line enforced through the usableWidth hook (F1 rules of the era's latest event); WEC: no limits, so a second
//       curvature without the hook is kept where it differs;
//   (d) one geometry per layout era (track-state-data.js layoutEras), each from OSM as it stood in that era (Overpass attic date).
// Usage: node scripts/sim/geom-indep/build-a3.mjs eras <out/eras.json>          (era dates for the fetch)
//        node scripts/sim/geom-indep/build-a3.mjs build <raw dir> [--jobs 4] [--only a,b] [--out scripts/sim/data/geom-indep]
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {lineData} from '../../../worker/simulation.js';
import {lapsimAllTracks} from '../../../worker/lapsim/tracks.js';
import {lapsimTrackWidths} from '../../../worker/lapsim/track-widths.js';
import {lapsimTrackLimits} from '../../../worker/lapsim/track-limits-data.js';
import {lapsimTrackState} from '../../../worker/lapsim/track-state-data.js';
import {lapsimKerbUse} from '../../../worker/lapsim/kerb-use-data.js';
import {buildOne, SET} from './build.mjs';
import {lapsimTrackNorth} from '../../../worker/lapsim/track-north-data.js';

export const A3 = {kerbM: 1.0, cornerWinM: 40, defaultWidthM: 12, polyRayM: 25, kerbMaxM: 1.5, cuspR: 0.8, sourceIncomplete: {bridged: 0.05, lengthPct: 1.5, turnDeg: 5}};
const ROOT = new URL('../../../', import.meta.url).pathname, J = f => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
const OSM_SEEDS = J(ROOT + 'scripts/sim/data/tracks/osm-raceways-all.json').tracks;
const wrap = (i, n) => ((i % n) + n) % n;

// (d) layout eras: layoutEras holds the first year of each new layout; the open era uses today's OSM
export function erasOf(id) {
  const ys = lapsimTrackState.tracks?.[id]?.layoutEras || [], out = [];
  let from = null; for (const y of ys) { out.push({from, to: y - 1, date: `${y - 1}-06-01`}); from = y; }
  out.push({from, to: null, date: null}); return out;
}
// FIA list of licensed circuits: the row whose name shares a word with the track and whose length is within 4 % of ours
export function fiaRow(id, d) {
  const F = J(ROOT + 'scripts/sim/data/tracks/fia-circuits.json').rows.flat(), words = `${d.name} ${d.circuit || ''} ${id}`.toUpperCase().split(/[^A-Z]+/).filter(w => w.length > 3);
  const c = F.filter(r => words.some(w => r.name.includes(w)) && Math.abs(r.lengthM / (d.kappa.length * d.ds) - 1) < 0.04).sort((a, b) => b.list.localeCompare(a.list) || Math.abs(a.lengthM - d.kappa.length * d.ds) - Math.abs(b.lengthM - d.kappa.length * d.ds));
  return c[0] || null;
}
// 4a: named-corner rules of the latest parsed F1 event inside the era (WEC has no public source: no rules)
export function limitRules(id, era) {
  const rows = (Array.isArray(lapsimTrackLimits) ? lapsimTrackLimits : Object.values(lapsimTrackLimits)).filter(r => r.track === id && r.series === 'f1' && r.status === 'parsed' &&
    (era.from == null || r.year >= era.from) && (era.to == null || r.year <= era.to) && r.year <= 2026).sort((a, b) => b.year - a.year);
  return rows[0] ? {year: rows[0].year, doc: rows[0].doc, corners: rows[0].corners.filter(c => c.turn != null && ['line', 'kerb', 'loop'].includes(c.rule))} : null;
}
// (a) OSM area polygons as rings in the local plane
function rings(osm, P) {
  const R = [], ring = g => g.map(q => P.fwd(q.lat, q.lon));
  for (const e of osm.elements || []) {
    const t = e.tags || {}, area = t['area:highway'] === 'raceway' || (t.highway === 'raceway' && t.area === 'yes');
    if (!area) continue;
    if (e.type === 'way' && e.geometry?.length > 3) R.push(ring(e.geometry));
    if (e.type === 'relation') for (const m of e.members || []) if (m.geometry?.length > 3) R.push(ring(m.geometry));
  }
  return R;
}
const cross = (ox, oy, dx, dy, [ax, ay], [bx, by]) => { const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) return null;
  const t = ((ax - ox) * ey - (ay - oy) * ex) / den, u = ((ax - ox) * dy - (ay - oy) * dx) / den; return t > 0 && u >= 0 && u <= 1 ? t : null; };

export function widthsFor(id, era, osm, d) {
  return ({cl, P, reg, W}) => {
    const n = cl.x.length, Rg = rings(osm, P), segs = Rg.flatMap(r => r.slice(0, -1).map((p, i) => [p, r[i + 1]]));
    const left = new Array(n).fill(null), right = new Array(n).fill(null), src = new Array(n).fill(null);
    const nrm = i => { const a = wrap(i - 1, n), b = (i + 1) % n, tx = cl.x[b] - cl.x[a], ty = cl.y[b] - cl.y[a], l = Math.hypot(tx, ty) || 1; return [-ty / l, tx / l]; };
    for (let i = 0; i < n; i++) if (segs.length) { const [nx, ny] = nrm(i); let tl = Infinity, tr = Infinity, inside = 0;
      for (const [a, b] of segs) { const p = cross(cl.x[i], cl.y[i], nx, ny, a, b), q = cross(cl.x[i], cl.y[i], -nx, -ny, a, b); if (p != null) { tl = Math.min(tl, p); inside++; } if (q != null) tr = Math.min(tr, q); }
      if (tl <= A3.polyRayM && tr <= A3.polyRayM && inside % 2 === 1 && tl + tr >= 6) { left[i] = tl; right[i] = tr; src[i] = 'osm-area'; } }
    // the OSM width tag of the nearest raceway way (within 15 m)
    const tagged = (osm.elements || []).filter(e => e.type === 'way' && e.tags?.highway === 'raceway' && +e.tags.width > 5 && e.geometry).map(e => ({w: +e.tags.width, p: e.geometry.map(q => P.fwd(q.lat, q.lon))}));
    for (let i = 0; i < n; i++) if (src[i] == null && tagged.length) { let b = 15, w = null; for (const t of tagged) for (const [x, y] of t.p) { const dd = Math.hypot(x - cl.x[i], y - cl.y[i]); if (dd < b) { b = dd; w = t.w; } } if (w) { left[i] = right[i] = w / 2; src[i] = 'osm-width-tag'; } }
    const fb = lapsimTrackWidths[id]?.m ? ['track-widths.js', lapsimTrackWidths[id].m] : W ? ['fia-list', W] : ['default-12m', A3.defaultWidthM];
    for (let i = 0; i < n; i++) if (src[i] == null) { left[i] = right[i] = fb[1] / 2; src[i] = fb[0]; }
    // (b) kerb allowance: iRacing kerb use on lineData(id).mid (production map frame → this plane by the registration)
    const kL = new Array(n).fill(0), kR = new Array(n).fill(0), KU = lapsimKerbUse.tracks?.[id]; let kerbSrc = 'none';
    if (KU) { const mid = lineMid(id);
      if (mid && KU.n === mid.length) { const un = r => { const a = new Array(mid.length).fill(0); for (const [i0, ...v] of r || []) v.forEach((x, k) => { a[(i0 + k) % a.length] = x / 10; }); return a; };
        const kl = un(KU.kl), kr = un(KU.kr), pts = mid.map(([x, y]) => reg.apply(x, y));
        pts.forEach(([x, y], j) => { if (!kl[j] && !kr[j]) return; let b = 64, bi = -1; for (let i = 0; i < n; i++) { const q = (cl.x[i] - x) ** 2 + (cl.y[i] - y) ** 2; if (q < b) { b = q; bi = i; } }
          if (bi >= 0) { kL[bi] = Math.max(kL[bi], kl[j]); kR[bi] = Math.max(kR[bi], kr[j]); } });
        kerbSrc = 'kerb-use-data.js (iRacing)'; } }
    // 4a corners at the production corner position, mapped through the registration to the nearest centre station
    const rules = limitRules(id, era), lineAt = new Uint8Array(n), win = Math.round(A3.cornerWinM / SET.ds), cnr = [];
    for (const c of rules?.corners || []) { const pc = (d.corners || []).find(q => q.number === c.turn && (!c.letter || q.letter === c.letter)); if (!pc) { cnr.push({turn: c.turn, rule: c.rule, placed: false}); continue; }
      const k = Math.round(pc.s / d.ds) % reg.x.length; let b = Infinity, bi = 0; for (let i = 0; i < n; i++) { const q = (cl.x[i] - reg.x[k]) ** 2 + (cl.y[i] - reg.y[k]) ** 2; if (q < b) { b = q; bi = i; } }
      for (let q = -win; q <= win; q++) { const i = wrap(bi + q, n); if (c.rule === 'line') lineAt[i] = 1; else { if (!kL[i]) kL[i] = A3.kerbM; if (!kR[i]) kR[i] = A3.kerbM; } }
      cnr.push({turn: c.turn, letter: c.letter, rule: c.rule, placed: true}); }
    const kc = Float64Array.from({length: n}, (_, i) => { const a = wrap(i - 2, n), b = (i + 2) % n, ax = cl.x[i] - cl.x[a], ay = cl.y[i] - cl.y[a], bx = cl.x[b] - cl.x[i], by = cl.y[b] - cl.y[i];
      return 2 * (ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(cl.x[b] - cl.x[a], cl.y[b] - cl.y[a]) || 1); });
    let capped = 0; const cap = (w, i, side) => { const R = 1 / Math.max(1e-6, Math.abs(kc[i])), inside = side === 'left' ? kc[i] > 0 : kc[i] < 0; if (inside && w > A3.cuspR * R) { capped++; return A3.cuspR * R; } return w; };
    const half = left.map((w, i) => cap(Math.max(0.5, w - SET.carM + Math.min(A3.kerbMaxM, kL[i])), i, 'left')), rgt = right.map((w, i) => cap(Math.max(0.5, w - SET.carM + Math.min(A3.kerbMaxM, kR[i])), i, 'right'));
    // (c) line enforced: no kerb allowance at that corner (F1). WEC: the line without this hook
    const usableWidth = lineAt.some(Boolean) ? (i, side, w) => lineAt[i] ? Math.min(w, cap(Math.max(0.5, (side === 'left' ? left[i] : right[i]) - SET.carM), i, side)) : w : null;
    const share = k => +(src.filter(s => s === k).length / n).toFixed(3);
    return {half, right: rgt, usableWidth, note: {sources: {'osm-area': share('osm-area'), 'osm-width-tag': share('osm-width-tag'), [fb[0]]: share(fb[0])},
      medianWidthM: +[...left.map((v, i) => v + right[i])].sort((a, b) => a - b)[n >> 1].toFixed(2), kerb: kerbSrc, kerbShare: +(kL.concat(kR).filter(v => v > 0).length / (2 * n)).toFixed(3),
      limits: rules ? {year: rules.year, doc: rules.doc, corners: cnr} : null, lineEnforcedShare: +(lineAt.filter(Boolean).length / n).toFixed(3), cuspCapped: capped}};
  };
}
const lineMid = id => { try { return lineData(id).mid; } catch { return null; } };

function buildTrack(id, raw, bac) {
  const d = lapsimAllTracks[id], seed = OSM_SEEDS[id]?.seed, out = {id, eras: [], report: []};
  const fr = fiaRow(id, d), fia = {lengthM: d.officialLengthM ?? fr?.lengthM ?? null, widthM: fr?.widthM ?? null};
  // registration loop: the bacinger/f1-circuits feature within 3 km of the seed, else OSM itself (attempt 1, A1)
  const bf = bac.features.find(f => { const c = f.geometry.coordinates, m = c.reduce((a, [lo, la]) => [a[0] + la / c.length, a[1] + lo / c.length], [0, 0]);
    return Math.hypot((m[0] - seed[0]) * 111320, (m[1] - seed[1]) * 111320 * Math.cos(seed[0] * Math.PI / 180)) < 3000; }) || null;
  for (const era of erasOf(id)) {
    const osm = J(era.date ? `${raw}/${id}-osm-${era.date}.json` : `${raw}/${id}-osm.json`);
    if (!osm?.elements?.some(e => e.tags?.highway === 'raceway')) { out.report.push({era, status: 'no OSM loop'}); continue; }
    try {
      // the centre line uses raceway ways only; area outlines (the asphalt edge) would pull the registration and the foot points
      const centreOsm = {...osm, elements: osm.elements.filter(e => e.type === 'way' && e.tags?.highway === 'raceway' && e.tags?.area !== 'yes' && !e.tags?.['area:highway'])};
      const b = buildOne(id, centreOsm, J(`${raw}/${id}-dem.json`), null, null, null, {row: d, seed, fia, bacFeature: bf, widthM: fia.widthM, northDeg: bf ? null : lapsimTrackNorth[id]?.deg ?? null, widths: widthsFor(id, era, osm, d)});
      const turn = Math.abs(b.report.turnDeg), closes = Math.min(Math.abs(turn - 360), turn) <= A3.sourceIncomplete.turnDeg;
      const incomplete = b.report.bridgedShare > A3.sourceIncomplete.bridged || (b.report.centreVsOfficialPct != null && Math.abs(b.report.centreVsOfficialPct) > A3.sourceIncomplete.lengthPct) || !closes;
      out.eras.push({from: era.from, to: era.to, osmDate: era.date || 'current', sourceIncomplete: incomplete, row: {...b.row, map: undefined}, extra: b.extra});
      out.report.push({era, status: incomplete ? 'source incomplete' : 'ok', registration: bf ? 'bacinger' : 'osm', ...b.report});
    } catch (e) { out.report.push({era, status: 'failed', error: String(e).slice(0, 200)}); }
  }
  return out;
}

const [cmd, a1] = process.argv.slice(2), arg = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null;
if (cmd === 'eras') { const E = {}; for (const id of Object.keys(OSM_SEEDS)) { const e = erasOf(id).filter(x => x.date); if (e.length) E[id] = e; } mkdirSync(a1.replace(/\/[^/]*$/, ''), {recursive: true}); writeFileSync(a1, JSON.stringify(E, null, 1)); console.log(E); }
if (cmd === 'one') { const r = buildTrack(a1, arg('--raw'), J(`${arg('--raw')}/f1-circuits.geojson`)); writeFileSync(arg('--to'), JSON.stringify(r)); }
// The build runs in groups (GitHub jobs stop at 6 h): `parts` builds the tracks of one group into per-track files plus ids.json (the
// tracks it tried); `merge` writes the outputs from any number of part folders in the canonical track order. `build` is parts + merge
// in one job, so a split build and a single build write the same bytes from the same sources (checked in the workflow's split-check).
export const canonicalIds = () => Object.keys(OSM_SEEDS).filter(id => lapsimAllTracks[id]);
export const groupIds = (k, N) => canonicalIds().filter((_, i) => i % N === k - 1);
async function parts(raw, tmp, {jobs = 2, only = null} = {}) {
  const ids = canonicalIds().filter(id => (!only || only.includes(id)) && existsSync(`${raw}/${id}-osm.json`)); mkdirSync(tmp, {recursive: true});
  const queue = [...ids]; let live = 0;
  await new Promise(done => { const next = () => { if (!queue.length && !live) return done(); while (live < jobs && queue.length) { const id = queue.shift(); live++;
    const p = spawn('node', [new URL(import.meta.url).pathname, 'one', id, '--raw', raw, '--to', `${tmp}/${id}.json`], {stdio: 'inherit'}); p.on('exit', c => { live--; console.log(id, c === 0 ? 'built' : 'FAILED ' + c); next(); }); } }; next(); });
  writeFileSync(`${tmp}/ids.json`, JSON.stringify(ids));
}
export function merge(partDirs, outDir) {
  const tried = new Set(partDirs.flatMap(d => J(`${d}/ids.json`) || [])), ids = canonicalIds().filter(id => tried.has(id)), tracks = {}, report = {};
  for (const id of ids) { const f = partDirs.map(d => `${d}/${id}.json`).find(existsSync), r = f && J(f);
    if (!r) { report[id] = [{status: 'failed (no output)'}]; continue; } report[id] = r.report; if (r.eras.length) tracks[id] = {layout: lapsimAllTracks[id].name, eras: r.eras}; }
  mkdirSync(outDir, {recursive: true});
  writeFileSync(`${outDir}/tracks-a3.json`, JSON.stringify({generatedBy: 'scripts/sim/geom-indep/build-a3.mjs', prereg: 'claude/gate-independent-geometry-attempt3-prereg-2026-11-23.md', settings: {...SET, ...A3}, tracks}));
  writeFileSync(`${outDir}/build-report-a3.json`, JSON.stringify(report, null, 1));
  console.log('tracks built:', Object.keys(tracks).length, 'of', ids.length);
}
if (cmd === 'ids') console.log(arg('--group') ? groupIds(...arg('--group').split('/').map(Number)).join(',') : canonicalIds().join(','));
if (cmd === 'parts') await parts(a1, arg('--to'), {jobs: +(arg('--jobs') || 2), only: arg('--only')?.split(',')});
if (cmd === 'merge') merge(process.argv.slice(3).filter((x, i, a) => !x.startsWith('--') && a[i - 1] !== '--out'), arg('--out'));
if (cmd === 'build') { const tmp = `${a1}/a3-parts`; await parts(a1, tmp, {jobs: +(arg('--jobs') || 2), only: arg('--only')?.split(',')}); merge([tmp], arg('--out') || 'scripts/sim/data/geom-indep'); }
