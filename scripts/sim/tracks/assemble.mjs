// Step 2 of new-track geometry: turn the OpenStreetMap raceway ways of a venue into closed laps (t.tol in a request: a stated wider
// length tolerance for a venue whose map misses a short piece).
// The ways are split where they meet, then every simple closed loop is listed with its length. A layout is ACCEPTED only
// when a loop is within 0.5 % of the official lap length stored in track-requests.json (lengthM with lengthSource).
// Without an official length the loops are only listed. © OpenStreetMap contributors, ODbL.
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {roadLap} from './road-lap.mjs';
const FIA = existsSync('.cache/lapsim/osm/fia-circuits.json') ? JSON.parse(readFileSync('.cache/lapsim/osm/fia-circuits.json', 'utf8')).rows : [];
const DIR = '.cache/lapsim/osm';
// read only when run as a script: importing loops() must not need a request file (probe-sebring.mjs crashed on it in Actions)
const requests = () => JSON.parse(readFileSync(process.env.TRACK_REQUESTS || 'scripts/sim/data/track-requests.json', 'utf8')).tracks;
const hav = (a, b) => { const R = 6371008.8, r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r; return R * Math.hypot(x, y); };
const key = p => p[0].toFixed(7) + ',' + p[1].toFixed(7);
const SKIP = /kart|motocross|rallycross|off_road|bmx|drag|rc_car|speedway_dirt/i, SKIPNAME = /pit ?lane|pitlane|boxengasse|피트|ピット|kart|drag|rally|drift|ドリフト|カート|motocross|skid|glisse|driving center/i;

// distance in metres from point p to the polyline pts (flat-earth, fine for a few hundred metres)
const offLine = (p, pts) => { const k = 111195, c = Math.cos(p[0] * Math.PI / 180), xy = q => [(q[1] - p[1]) * k * c, (q[0] - p[0]) * k]; let best = Infinity;
  if (pts.length === 1) return hav(p, pts[0]);
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = xy(pts[i - 1]), [bx, by] = xy(pts[i]), dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0; best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy)); }
  return best; };

export function totalTurnDeg(pts) {
  const n = pts.length - (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? 1 : 0), c = Math.cos(pts[0][0] * Math.PI / 180); let t = 0;
  const h = i => Math.atan2(pts[(i + 1) % n][0] - pts[i][0], (pts[(i + 1) % n][1] - pts[i][1]) * c);
  for (let i = 0; i < n; i++) { let d = h((i + 1) % n) - h(i); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; t += d; }
  return t * 180 / Math.PI;
}

// share of the one-way length of a loop that runs against the mapped direction, for the better of the two lap directions
// (a raceway is mapped oneway=yes in race direction; a loop that drives a one-way piece backwards is not the lap)
export function againstOneway(line, elements) {
  const ow = elements.filter(e => e.tags?.oneway === 'yes' && e.geometry?.length > 1).map(e => e.geometry.map(g => [g.lat, g.lon])), idx = new Map();
  ow.forEach((w, wi) => w.forEach((p, i) => { const k = key(p); if (!idx.has(k)) idx.set(k, []); idx.get(k).push([wi, i]); }));
  let fw = 0, bw = 0;
  for (let i = 1; i < line.length; i++) { const A = idx.get(key(line[i - 1])), B = idx.get(key(line[i])); if (!A || !B) continue;
    const hit = A.flatMap(([w, a]) => B.filter(([v, b]) => v === w && Math.abs(a - b) === 1).map(([, b]) => b - a))[0]; if (hit === undefined) continue;
    const m = hav(line[i - 1], line[i]); if (hit > 0) fw += m; else bw += m; }
  return Math.min(fw, bw) / Math.max(1, fw + bw);
}

export function loops(elements, {maxM = 30000, minM = 1500, cap = 200000, snapM = 12} = {}) {
  const ways = elements.filter(e => e.type === 'way' && e.geometry?.length > 1 && (e.inRelation || (e.tags?.highway === 'raceway' && e.tags?.raceway !== 'pitlane' && !SKIP.test(e.tags?.sport || '') && !SKIPNAME.test(e.tags?.name || '') && !/dirt|ground|unpaved|gravel|grass|sand/i.test(e.tags?.surface || ''))))
    .map(e => ({name: e.tags?.name || null, pts: e.geometry.map(g => [g.lat, g.lon])}));
  // close small mapping gaps: a way end within SNAP_M of a point of another way is moved onto that point (map ways often do not share a node)
  // two open ends near each other (Detroit hairpin, 6 m): an end already moved is looked up at its new place, so the second end
  // joins the first instead of the two swapping places and staying open
  const SNAP_M = snapM, all = ways.flatMap((w, wi) => w.pts.map(p => ({p, wi}))), moved = new Map(), at = q => moved.get(q) || q; let snapped = 0;
  for (const [wi, w] of ways.entries()) for (const e of [0, w.pts.length - 1]) {
    const p = w.pts[e]; if (all.some(o => o.wi !== wi && at(o.p)[0] === p[0] && at(o.p)[1] === p[1])) continue;
    let best = null, bd = SNAP_M; for (const o of all) { if (o.wi === wi) continue; const dd = hav(p, at(o.p)); if (dd < bd) { bd = dd; best = at(o.p); } }
    if (best) { moved.set(p, best); w.pts[e] = best; snapped++; }
  }
  // split ways at every point that another way (or the same way) also touches
  const count = new Map(); for (const w of ways) w.pts.forEach((p, i) => { const k = key(p); count.set(k, (count.get(k) || 0) + (i === 0 || i === w.pts.length - 1 ? 2 : 1)); });
  const edges = [];
  for (const w of ways) { let s = 0; for (let i = 1; i < w.pts.length; i++) if (i === w.pts.length - 1 || count.get(key(w.pts[i])) > 1) { const pts = w.pts.slice(s, i + 1); edges.push({a: key(pts[0]), b: key(pts[pts.length - 1]), pts, m: pts.slice(1).reduce((t, p, j) => t + hav(pts[j], p), 0), name: w.name}); s = i; } }
  // two map ways drawn over the same nodes (e.g. an "F1 track" way on top of a "permanent circuit" way) give pairs of identical
  // edges; each pair doubles the number of loops, so the search hit its cap before it reached the full lap (Yeongam, Paul Ricard).
  // Keep one edge per pair: same two end points, the same length within 1 m and the middle point of one within 2 m of the line of the other
  // (two halves of a symmetric ring have equal ends and length but different middles, and both must stay).
  { const seenE = new Map(), keep = []; for (const e of edges) { const k = e.a < e.b ? e.a + '|' + e.b : e.b + '|' + e.a, l = seenE.get(k) || seenE.set(k, []).get(k), mid = e.pts[e.pts.length >> 1]; if (l.some(o => Math.abs(o.m - e.m) < 1 && offLine(mid, o.pts) < 2)) continue; l.push({m: e.m, pts: e.pts}); keep.push(e); } var dropped = edges.length - keep.length; edges.length = 0; edges.push(...keep); }
  const adj = new Map(); edges.forEach((e, i) => { for (const n of [e.a, e.b]) (adj.get(n) || adj.set(n, []).get(n)).push(i); });
  const found = new Map(); let steps = 0;
  const nodes = [...adj.keys()].filter(n => adj.get(n).length !== 2);
  // every connected part needs a start. A plain ring (all nodes touch exactly two edges) has no junction, so it was never
  // searched when another part of the venue had one (Jarama and Mosport: the lap is a ring once the pit lane is left out).
  const starts = [...nodes], reached = new Set();
  const flood = n0 => { const st = [n0]; reached.add(n0); while (st.length) { const n = st.pop(); for (const i of adj.get(n)) { const o = edges[i].a === n ? edges[i].b : edges[i].a; if (!reached.has(o)) { reached.add(o); st.push(o); } } } };
  for (const n of nodes) if (!reached.has(n)) flood(n);
  for (const n of adj.keys()) if (!reached.has(n)) { starts.push(n); flood(n); }
  function walk(start, node, len, used, path) {
    if (++steps > cap) return;
    for (const i of adj.get(node)) {
      if (used.has(i)) continue; const e = edges[i], next = e.a === node ? e.b : e.a, L = len + e.m;
      if (L > maxM) continue;
      if (next === start) { if (L >= minM) { const sig = [...path, i].sort((x, y) => x - y).join('.'); if (!found.has(sig)) found.set(sig, {m: L, path: [...path, i], start}); } continue; }
      if (path.some(j => edges[j].a === next || edges[j].b === next) && next !== start) { // already visited node: not a simple loop
        const seen = new Set([start]); let n = start; for (const j of path) { n = edges[j].a === n ? edges[j].b : edges[j].a; seen.add(n); } if (seen.has(next)) continue; }
      used.add(i); path.push(i); walk(start, next, L, used, path); path.pop(); used.delete(i);
    }
  }
  for (const s of starts) { walk(s, s, 0, new Set(), []); if (steps > cap) break; }
  // open ends: a way end that touches nothing. Listed with the distance to the nearest point of another edge, so a missing
  // connection (gap wider than the snap distance, or a missing way) can be seen in the committed summary.
  const dangling = [...adj.entries()].filter(([, v]) => v.length === 1).map(([n, v]) => { const p = n.split(',').map(Number); let bd = Infinity; edges.forEach((e, i) => { if (i !== v[0]) for (const q of e.pts) { const dd = hav(p, q); if (dd < bd) bd = dd; } }); return {at: p, nearestOtherM: Number.isFinite(bd) ? Math.round(bd) : null, way: edges[v[0]].name, wayM: Math.round(edges[v[0]].m)}; }).slice(0, 20);
  const line = l => { let n = l.start; const out = []; for (const j of l.path) { const e = edges[j], fwd = e.a === n; out.push(...(fwd ? e.pts : [...e.pts].reverse()).slice(out.length ? 1 : 0)); n = fwd ? e.b : e.a; } return out; };
  return {snapped, duplicateEdgesDropped: dropped, dangling, wayList: ways.map(w => [w.name, Math.round(w.pts.slice(1).reduce((t, p, j) => t + hav(w.pts[j], p), 0))]), ways: ways.length, edges: edges.length, junctions: nodes.length, searchCapped: steps > cap, loops: [...found.values()].sort((a, b) => b.m - a.m).map(l => ({m: Math.round(l.m), names: [...new Set(l.path.map(j => edges[j].name).filter(Boolean))], line: () => line(l)}))};
}

if (process.argv[1]?.endsWith('assemble.mjs')) {
  const out = {source: 'OpenStreetMap raceway ways (© OpenStreetMap contributors, ODbL); loops found by scripts/sim/tracks/assemble.mjs', rule: 'accepted = within 0.5 % of the official lap length', tracks: {}}, lines = {};
  for (const t of requests().filter(t => t.status === 'osm')) {
    const f = `${DIR}/${t.id}.json`; if (!existsSync(f)) { out.tracks[t.id] = {error: 'no map data'}; continue; }
    const file = JSON.parse(readFileSync(f, 'utf8')), raw = file.elements, clone = a => JSON.parse(JSON.stringify(a));
    // permanent raceway ways and the ways of a route relation are searched separately (the same way can be in both)
    // t.skipName: ways that are not part of any lap of the venue (Lausitz: the DEKRA test oval and slalom areas)
    const skip = t.skipName ? new RegExp(t.skipName, 'i') : null, keep = e => !(skip && skip.test(e.tags?.name || ''));
    const els = raw.filter(e => !e.inRelation && keep(e)), rel = raw.filter(e => e.inRelation && keep(e));
    // official lengths: every FIA-licensed layout whose name matches this venue (newest list first), plus any length stored with a source
    const re = t.fia ? new RegExp(t.fia, 'i') : null, seen = new Set();
    const fia = re ? FIA.filter(x => re.test(x.name) && !(t.fiaNot && new RegExp(t.fiaNot, 'i').test(x.name))).filter(x => !seen.has(x.name + x.lengthM) && seen.add(x.name + x.lengthM)) : [];
    const targets = [...(t.lengths || []).map(x => ({id: `${t.id} | ${x.name}`, lengthM: x.lengthM, src: x.source + (x.roundedTo ? ` [rounded to ${x.roundedTo}]` : '')})), ...fia.map(x => ({id: `${t.id} | ${x.name}`, lengthM: x.lengthM, src: `FIA list ${x.list}`, fia: x}))];
    // loops much longer than the longest official lap cannot be accepted, so the search stops there
    const maxM = targets.length ? Math.max(...targets.map(g => g.lengthM)) * 1.03 : 30000;
    const both = sm => { const a = loops(clone(els), {snapM: sm, maxM}); if (rel.length) { const b = loops(clone(rel), {snapM: sm, maxM}); a.loops.push(...b.loops); a.relationWays = b.ways; a.relationLoops = b.loops.length; } return a; };
    let r = both(12), snapUsed = 12;
    // nearest loops by length; a loop that crosses itself (total turn not ±360°) is not a lap. A venue with no accepted lap is
    // tried again with wider gap closing; the length check still decides
    const pick = () => targets.map(g => { const cand = r.loops.map(l => ({l, err: Math.abs(l.m - g.lengthM) / g.lengthM})).sort((a, b) => a.err - b.err).slice(0, 40).filter(c => t.crossover || Math.abs(Math.abs(totalTurnDeg(c.l.line())) - 360) < 30);
      // t.oneway: several loops fit the length (Lausitz); only a loop that drives the one-way raceway pieces in their mapped direction
      // (at most 2 % of its one-way length against it) counts, and exactly one distinct such loop must be within the tolerance
      let best = cand[0], unique = true;
      if (t.oneway) { const ok1 = cand.filter(c => c.err <= (t.tol ?? 0.005) && againstOneway(c.l.line(), els) <= 0.02), d = []; for (const c of ok1) if (!d.some(x => Math.abs(x.l.m - c.l.m) < 15)) d.push(c); unique = d.length === 1; best = d[0] || cand[0]; }
      if (!best) return {id: g.id, officialM: g.lengthM, source: g.src, accepted: false};
      const ok = unique && best.err <= (t.tol ?? 0.005); if (ok) lines[g.id] = best.l.line().map(p => [+p[0].toFixed(7), +p[1].toFixed(7)]);
      return {id: g.id, officialM: g.lengthM, source: g.src, grade: g.fia?.grade, pole: g.fia?.pole, widthM: g.fia?.widthM, loopM: best.l.m, errorPct: +(best.err * 100).toFixed(2), accepted: ok, gapClosedM: snapUsed, scaleToOfficial: t.scaleToOfficial || undefined, oneway: t.oneway ? (unique ? 'one loop follows the one-way direction' : 'no single loop follows the one-way direction') : undefined}; });
    const accepted = pick(); let acc2 = accepted;
    for (const sm of [30, 60]) { if (!targets.length || acc2.some(a => a.accepted)) break; r = both(sm); snapUsed = sm; acc2 = pick(); }
    accepted.splice(0, accepted.length, ...acc2);
    // a lap on public roads: named roads in lap order from an official description (road-lap.mjs); the length check still decides
    if (t.via && file.roads && !accepted.some(a => a.accepted)) for (const [i, g] of targets.entries()) {
      const rl = roadLap(file.roads, t.via, g.lengthM); if (rl.accepted) lines[g.id] = rl.line.map(p => [+p[0].toFixed(7), +p[1].toFixed(7)]);
      accepted[i] = {id: g.id, officialM: g.lengthM, source: g.src, grade: g.fia?.grade, pole: g.fia?.pole, widthM: g.fia?.widthM, loopM: rl.loopM, errorPct: rl.errorPct, accepted: rl.accepted, method: 'public roads joined in the order of ' + t.via.join(' > '), viaSource: t.viaSource, reason: rl.reason, loopsTried: rl.loopsTried};
    }
    const distinct = []; for (const l of r.loops) if (!distinct.some(d => Math.abs(d.m - l.m) < 15)) distinct.push({m: l.m, names: l.names.slice(0, 4)});
    out.tracks[t.id] = {relationWays: r.relationWays, relationLoops: r.relationLoops, gapClosedM: snapUsed, snappedEnds: r.snapped, wayList: accepted.some(a => a.accepted) ? undefined : r.wayList.slice(0, 60), ways: r.ways, edges: r.edges, junctions: r.junctions, searchCapped: r.searchCapped, duplicateEdgesDropped: r.duplicateEdgesDropped, openEnds: accepted.every(a => a.accepted) ? undefined : r.dangling, loopsFound: r.loops.length, loopLengthsM: distinct.slice(0, 40), accepted};
  }
  writeFileSync(`${DIR}/loops-summary.json`, JSON.stringify(out, null, 1)); writeFileSync(`${DIR}/accepted-lines.json`, JSON.stringify(lines));
  console.log(Object.entries(out.tracks).map(([k, v]) => `${k}: ${v.error || v.loopsFound + ' loops, longest ' + (v.loopLengthsM[0]?.m ?? '-')}`).join('\n'));
}
