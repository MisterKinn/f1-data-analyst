// Lap of a circuit that runs on public roads (no "raceway" ways on the map), from OpenStreetMap road ways.
// Method, declared before the first run (2026-11-11): the venue lists, in lap order, road names taken from an official
// circuit description (`via` with `viaSource` in track-requests.json). The named ways are joined in that order by the
// shortest road path between them (no road used twice), closing back to the first. Every direction choice is tried.
// The lap is ACCEPTED only when exactly one distinct loop is within 0.5 % of the official length; otherwise nothing is built.
// Nothing is fitted or tuned here. © OpenStreetMap contributors, ODbL.
const hav = (a, b) => { const R = 6371008.8, r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r; return R * Math.hypot(x, y); };
const key = p => p[0].toFixed(7) + ',' + p[1].toFixed(7);

export function roadLap(roadElements, via, officialM, {tol = 0.005, skip = /^(motorway|motorway_link|trunk|trunk_link)$/} = {}) {
  const ways = roadElements.filter(e => e.type === 'way' && e.geometry?.length > 1 && !skip.test(e.tags?.highway || '')).map(e => ({name: e.tags?.name || null, pts: e.geometry.map(g => [g.lat, g.lon])}));
  // graph on map nodes: every consecutive pair of points of a way is an edge
  const adj = new Map(), add = (a, b, m, w) => { (adj.get(a) || adj.set(a, []).get(a)).push({to: b, m, w}); };
  const pos = new Map();
  ways.forEach((w, wi) => { for (let i = 1; i < w.pts.length; i++) { const a = key(w.pts[i - 1]), b = key(w.pts[i]), m = hav(w.pts[i - 1], w.pts[i]); pos.set(a, w.pts[i - 1]); pos.set(b, w.pts[i]); add(a, b, m, wi); add(b, a, m, wi); } });
  // a named road can be several ways end to end: chain them into one stretch per name (longest chain)
  const stretch = name => { const ws = ways.map((w, i) => ({w, i})).filter(x => x.w.name === name); if (!ws.length) return null;
    const ends = new Map(); for (const {w} of ws) for (const p of [w.pts[0], w.pts[w.pts.length - 1]]) ends.set(key(p), (ends.get(key(p)) || 0) + 1);
    const tips = [...ends].filter(([, c]) => c === 1).map(([k]) => k); if (tips.length !== 2) return {error: `${name}: ${ws.length} ways with ${tips.length} free ends (need 2)`};
    let at = tips[0], m = 0; const used = new Set(), nodes = [at];
    for (;;) { const nx = ws.find(x => !used.has(x.i) && (key(x.w.pts[0]) === at || key(x.w.pts[x.w.pts.length - 1]) === at)); if (!nx) break; used.add(nx.i);
      const pts = key(nx.w.pts[0]) === at ? nx.w.pts : [...nx.w.pts].reverse(); for (let i = 1; i < pts.length; i++) { m += hav(pts[i - 1], pts[i]); nodes.push(key(pts[i])); } at = nodes[nodes.length - 1]; }
    return {name, nodes, m, ways: new Set(ws.map(x => x.i))}; };
  const S = via.map(stretch); const bad = S.find(s => !s || s.error); if (bad !== undefined) return {accepted: false, reason: bad ? bad.error : `road name not on the map: ${via[S.indexOf(bad)]}`};
  const dijkstra = (from, to, blocked) => { const dist = new Map([[from, 0]]), prev = new Map(), done = new Set(), q = [[0, from]];
    while (q.length) { let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i; const [dd, n] = q.splice(bi, 1)[0]; if (done.has(n)) continue; done.add(n); if (n === to) break;
      for (const e of adj.get(n) || []) { if (blocked.has(e.to) && e.to !== to) continue; const nd = dd + e.m; if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, n); q.push([nd, e.to]); } } }
    if (!dist.has(to)) return null; const path = [to]; while (path[0] !== from) path.unshift(prev.get(path[0])); return {m: dist.get(to), path}; };
  const found = [];
  for (let mask = 0; mask < 1 << S.length; mask++) {
    const seq = S.map((s, i) => mask >> i & 1 ? {...s, nodes: [...s.nodes].reverse()} : s); let nodes = [...seq[0].nodes], m = seq[0].m, ok = true;
    for (let i = 0; i < seq.length && ok; i++) { const nxt = seq[(i + 1) % seq.length], from = nodes[nodes.length - 1], to = nxt.nodes[0];
      const blocked = new Set(nodes.slice(i === seq.length - 1 ? 1 : 0, -1)); for (let j = i + 2; j < seq.length; j++) for (const n of seq[j].nodes) blocked.add(n); for (const n of nxt.nodes.slice(1)) blocked.add(n);
      const p = from === to ? {m: 0, path: [to]} : dijkstra(from, to, blocked); if (!p) { ok = false; break; }
      m += p.m; nodes.push(...p.path.slice(1)); if (i < seq.length - 1) { m += nxt.m; nodes.push(...nxt.nodes.slice(1)); } }
    if (ok && nodes[0] === nodes[nodes.length - 1] && new Set(nodes.slice(1)).size === nodes.length - 1 && !found.some(f => Math.abs(f.m - m) < 15)) found.push({m, nodes});
  }
  found.sort((a, b) => Math.abs(a.m - officialM) - Math.abs(b.m - officialM));
  const near = found.filter(f => Math.abs(f.m - officialM) / officialM <= tol), best = found[0];
  return {accepted: near.length === 1, loopsTried: found.map(f => Math.round(f.m)), loopM: best ? Math.round(best.m) : null, errorPct: best ? +(Math.abs(best.m - officialM) / officialM * 100).toFixed(2) : null,
    reason: near.length === 1 ? undefined : near.length ? 'more than one loop matches the length' : 'no loop within 0.5 % of the official length', line: near.length === 1 ? near[0].nodes.map(n => pos.get(n)) : null};
}

// Second method (2026-11-15), for divided roads and laps that mix public roads with mapped raceway pieces (Long Beach infield
// and hairpin): `via` lists the roads or raceway pieces in lap order. Junction i is any map node where piece i meets piece i+1
// (shared node, or a way end within joinM of the other piece). Leg i runs from junction i-1 to junction i on the ways of piece i
// only (shortest path). Every combination of junctions is tried; the lap is a simple closed loop. Same acceptance as roadLap:
// exactly one distinct loop (15 m apart) within tol of the official length, otherwise nothing is built.
export function junctionLap(elements, via, officialM, {tol = 0.005, joinM = 15, maxCombos = 20000} = {}) {
  const ways = elements.filter(e => e.type === 'way' && e.geometry?.length > 1).map(e => ({name: e.tags?.name || null, pts: e.geometry.map(g => [g.lat, g.lon])}));
  const piece = n => ways.filter(w => w.name === n); const P = via.map(piece);
  const missing = via.filter((n, i) => !P[i].length); if (missing.length) return {accepted: false, reason: `not on the map: ${missing.join(', ')}`};
  const pos = new Map(), adj = via.map(() => new Map()), add = (g, a, b, m) => { (g.get(a) || g.set(a, []).get(a)).push({to: b, m}); };
  P.forEach((ws, i) => { for (const w of ws) for (let j = 1; j < w.pts.length; j++) { const a = key(w.pts[j - 1]), b = key(w.pts[j]), m = hav(w.pts[j - 1], w.pts[j]); pos.set(a, w.pts[j - 1]); pos.set(b, w.pts[j]); add(adj[i], a, b, m); add(adj[i], b, a, m); } });
  // junctions between piece i and i+1: shared nodes, plus way ends of one piece near a node of the other (joined by a short link)
  const link = new Map(), J = via.map((_, i) => { const A = adj[i], B = adj[(i + 1) % via.length], out = new Set([...A.keys()].filter(k => B.has(k)));
    for (const [S, T] of [[A, B], [B, A]]) for (const [k, e] of S) { if (e.length !== 1 || out.has(k)) continue; let best = null, bd = joinM; for (const t of T.keys()) { const dd = hav(pos.get(k), pos.get(t)); if (dd < bd) { bd = dd; best = t; } }
      if (best) { const j = S === A ? best : k, o = S === A ? k : best; out.add(j); link.set(i + '|' + j, {node: o, m: bd}); } }
    return [...out]; });
  if (J.some(j => !j.length)) return {accepted: false, reason: `no junction between ${via.map((n, i) => J[i].length ? null : `${n} and ${via[(i + 1) % via.length]}`).filter(Boolean).join(', ')}`};
  const dijkstra = (g, from, to) => { const dist = new Map([[from, 0]]), prev = new Map(), done = new Set(), q = [[0, from]];
    while (q.length) { let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i; const [dd, n] = q.splice(bi, 1)[0]; if (done.has(n)) continue; done.add(n); if (n === to) break;
      for (const e of g.get(n) || []) { const nd = dd + e.m; if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, n); q.push([nd, e.to]); } } }
    if (!dist.has(to)) return null; const path = [to]; while (path[0] !== from) path.unshift(prev.get(path[0])); return {m: dist.get(to), path}; };
  // a junction node may sit on piece i+1 only through a link: the leg on piece i+1 starts from the linked node of piece i+1
  const onPiece = (i, j) => adj[i].has(j) ? {n: j, m: 0} : (() => { const l = link.get(((i - 1 + via.length) % via.length) + '|' + j) || link.get(i + '|' + j); return l && adj[i].has(l.node) ? {n: l.node, m: l.m} : null; })();
  let combos = 1; for (const j of J) combos *= j.length; if (combos > maxCombos) return {accepted: false, reason: `${combos} junction combinations (more than ${maxCombos})`};
  const found = [], idx = J.map(() => 0), cache = new Map();
  for (let c = 0; c < combos; c++) {
    let m = 0, nodes = [], ok = true;
    for (let i = 0; i < via.length && ok; i++) { const a = onPiece(i, J[(i - 1 + via.length) % via.length][idx[(i - 1 + via.length) % via.length]]), b = onPiece(i, J[i][idx[i]]); if (!a || !b) { ok = false; break; }
      const k = i + '|' + a.n + '|' + b.n; if (!cache.has(k)) cache.set(k, a.n === b.n ? null : dijkstra(adj[i], a.n, b.n)); const p = cache.get(k); if (!p) { ok = false; break; }
      m += p.m + a.m; nodes.push(...(nodes.length ? p.path.slice(nodes.at(-1) === p.path[0] ? 1 : 0) : p.path)); }
    if (ok && nodes.length > 3) { const inner = nodes[0] === nodes.at(-1) ? nodes.slice(1) : nodes; if (new Set(inner).size === inner.length && !found.some(f => Math.abs(f.m - m) < 15)) found.push({m, nodes: inner}); }
    for (let i = 0; i < idx.length; i++) { if (++idx[i] < J[i].length) break; idx[i] = 0; }
  }
  found.sort((a, b) => Math.abs(a.m - officialM) - Math.abs(b.m - officialM));
  const near = found.filter(f => Math.abs(f.m - officialM) / officialM <= tol), best = found[0];
  return {accepted: near.length === 1, loopsTried: found.map(f => Math.round(f.m)).slice(0, 30), loopM: best ? Math.round(best.m) : null, errorPct: best ? +(Math.abs(best.m - officialM) / officialM * 100).toFixed(2) : null,
    reason: near.length === 1 ? undefined : near.length ? 'more than one loop matches the length' : `no loop within ${tol * 100} % of the official length`, line: near.length === 1 ? [...near[0].nodes, near[0].nodes[0]].map(n => pos.get(n)) : null};
}
