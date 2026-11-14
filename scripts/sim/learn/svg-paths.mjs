// Minimal reader for the SVG that `pdftocairo -svg` writes: every <path> with its absolute points (Bezier curves sampled),
// after applying the transforms of the path and of its parent <g> elements. Enough to find a circuit line in an official map.
const num = s => s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
export function transformOf(s) { let m = [1, 0, 0, 1, 0, 0]; if (!s) return m;
  for (const [, f, a] of s.matchAll(/(matrix|translate|scale)\s*\(([^)]*)\)/g)) { const v = num(a);
    m = mul(m, f === 'matrix' ? v : f === 'translate' ? [1, 0, 0, 1, v[0], v[1] ?? 0] : [v[0], 0, 0, v[1] ?? v[0], 0, 0]); }
  return m; }
// path data -> list of subpaths, each a list of [x, y] (absolute commands M L H V C Q Z, the ones cairo writes, plus relative forms)
export function pathPoints(d, step = 8) {
  const out = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0;
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []; let i = 0, cmd = null;
  const n = () => +toks[i++], push = (a, b) => { cur.push([a, b]); x = a; y = b; };
  while (i < toks.length) { if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++]; const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { cur = []; out.push(cur); push(n() + ox, n() + oy); sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') push(n() + ox, n() + oy);
    else if (C === 'H') push(n() + ox, y); else if (C === 'V') push(x, n() + oy);
    else if (C === 'C' || C === 'Q') { const k = C === 'C' ? 3 : 2, p = [[x, y]]; for (let j = 0; j < k; j++) p.push([n() + ox, n() + oy]);
      const len = p.slice(1).reduce((a, q, j) => a + Math.hypot(q[0] - p[j][0], q[1] - p[j][1]), 0), m = Math.max(2, Math.ceil(len / step));
      for (let s = 1; s <= m; s++) { const t = s / m, u = 1 - t; const b = k === 3 ? [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] : [u * u, 2 * u * t, t * t];
        cur.push([b.reduce((a, w, j) => a + w * p[j][0], 0), b.reduce((a, w, j) => a + w * p[j][1], 0)]); } [x, y] = cur.at(-1); }
    else if (C === 'Z') { if (cur?.length) { cur.closed = true; push(sx, sy); } }
    else i++; }
  return out.filter(s => s.length > 1);
}
// every path of the document: {stroke, fill, width, subpaths (transformed)}
export function svgPaths(svg) {
  const stack = [[1, 0, 0, 1, 0, 0]], paths = [];
  for (const m of svg.matchAll(/<(\/?)(g|path|symbol|defs|clipPath|mask)\b([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, self] = m, at = k => (attrs.match(new RegExp('\\s' + k + '="([^"]*)"')) || [])[1];
    if (close) { if (tag !== 'path') stack.pop(); continue; }
    const t = mul(stack.at(-1), transformOf(at('transform')));
    if (tag === 'path') { if (stack.some(s => s.skip)) continue; const sub = pathPoints(at('d') || '').map(s => Object.assign(s.map(([a, b]) => [t[0] * a + t[2] * b + t[4], t[1] * a + t[3] * b + t[5]]), {closed: s.closed}));
      const scale = Math.sqrt(Math.abs(t[0] * t[3] - t[1] * t[2]));
      if (sub.length) paths.push({stroke: at('stroke') || null, fill: at('fill') || null, width: at('stroke-width') ? +at('stroke-width') * scale : null, dash: at('stroke-dasharray') || null, subpaths: sub}); }
    else if (!self) stack.push(['symbol', 'defs', 'clipPath', 'mask'].includes(tag) || stack.at(-1).skip ? Object.assign([...t], {skip: true}) : t);
  }
  return paths;
}
export const polyLen = p => p.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
