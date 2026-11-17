// Formula E circuit maps (fe-maps.json, FIA / Al Kamel PDFs) -> track centre line in metres, per map.
// The track is the longest drawn line that is not white or black (usually a blue stroke, sometimes a blue fill),
// split at pen jumps; the longest piece is the lap. Scale: the printed "Track Length" (centre line).
import {resampleClosed, headingCurvature} from '../../../worker/lapsim/geometry.js';
const grey = c => { const m = /rgb\(([\d.]+)%, ([\d.]+)%, ([\d.]+)%\)/.exec(c || ''); if (!m) return true; const [r, g, b] = m.slice(1).map(Number); return Math.max(r, g, b) - Math.min(r, g, b) < 8; };
export const lengthOf = words => { const s = words.map(w => w.t).join(' '), m = /length\s*:?\s*([\d][\d,. ]*\d)\s*(k?m)/i.exec(s); if (!m) return null; const d = +m[1].replace(/\D/g, ''); return d >= 1000 && d < 10000 ? d : null; };
// a path with n subpaths is cut at its n-1 longest steps (the pen moves); long straights inside one subpath stay whole
const pieces = (pts, n = 1) => { if (n < 2) return [pts]; const st = pts.slice(1).map((q, i) => [Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), i + 1]).sort((a, b) => b[0] - a[0]).slice(0, n - 1).map(x => x[1]).sort((a, b) => a - b);
  const out = []; let from = 0; for (const c of [...st, pts.length]) { out.push(pts.slice(from, c)); from = c; } return out; };
const plen = p => p.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
export function lineOf(map) {
  const style = p => p.stroke ? `s${p.stroke}|${p.width}` : `f${p.fill}`;
  const ok = map.paths.filter(p => (p.stroke && !grey(p.stroke) && p.width < 20) || (!p.stroke && p.fill && !grey(p.fill)));
  const groups = {}; for (const p of ok) (groups[style(p)] ||= []).push(...pieces(p.points, p.subpaths).filter(q => q.length > 1));
  let best = null;
  for (const [st, ps] of Object.entries(groups)) { // chain the pieces of one style end to end (a lap drawn in several strokes)
    const left = ps.map(q => ({q, len: plen(q)})).sort((a, b) => b.len - a.len), chain = [...left.shift().q];
    for (;;) { const end = chain.at(-1), start = chain[0], gapClose = Math.hypot(end[0] - start[0], end[1] - start[1]);
      let k = -1, rev = false, g = Infinity;
      left.forEach((c, i) => { const a = Math.hypot(c.q[0][0] - end[0], c.q[0][1] - end[1]), b = Math.hypot(c.q.at(-1)[0] - end[0], c.q.at(-1)[1] - end[1]); if (a < g) { g = a; k = i; rev = false; } if (b < g) { g = b; k = i; rev = true; } });
      if (k < 0 || g > 30 || gapClose < g) break; const c = left.splice(k, 1)[0].q; chain.push(...(rev ? [...c].reverse() : c)); }
    const len = plen(chain), gap = Math.hypot(chain[0][0] - chain.at(-1)[0], chain[0][1] - chain.at(-1)[1]);
    if (chain.length > 20 && (!best || (gap < 40) > (best.gapPt < 40) || ((gap < 40) === (best.gapPt < 40) && len > best.lenPt))) best = {pts: chain, lenPt: len + (gap < 40 ? gap : 0), fill: st[0] === 'f', gapPt: gap};
  }
  return best;
}
// Centre line in metres at ds, scaled to the printed length; y flipped (PDF y points down).
export function metres(line, lengthM, ds = 5) {
  const s = lengthM / line.lenPt, x = line.pts.map(p => p[0] * s), y = line.pts.map(p => -p[1] * s);
  const r = resampleClosed(x, y, ds), {kappa} = headingCurvature(r.x, r.y, r.ds ?? ds, 20);
  const turn = kappa.reduce((a, k) => a + k * (r.ds ?? ds), 0) * 180 / Math.PI;
  return {x: r.x, y: r.y, ds: r.ds ?? ds, kappa, turn};
}
// Race direction and finish line of a traced lap line (owner 2026-11-17: start lines and directions were wrong): the PDF path is drawn
// in either direction from an arbitrary point. Direction: the printed turn numbers (integer labels near the line, the nearest instance
// of each) must run forward; majority of consecutive pairs. Start: the FINISH (or START/FINISH, else START) label projected onto the line.
export function orientLine(line, map, lengthM) {
  let P = line.pts; const scale = lengthM / line.lenPt;
  const along = Q => { const c = [0]; for (let i = 1; i < Q.length; i++) c.push(c[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1])); return c; };
  const near = (Q, w) => { let b = Infinity, k = 0; Q.forEach((p, i) => { const d = Math.hypot(p[0] - w.x, p[1] - (w.y - w.h / 2)); if (d < b) { b = d; k = i; } }); return {k, d: b}; };
  let cum = along(P); const L = line.lenPt, T = {};
  for (const w of map.words) if (/^\d{1,2}$/.test(w.t)) { const q = near(P, w); if (q.d * scale < 80 && (!T[w.t] || q.d < T[w.t].d)) T[w.t] = q; }
  let fwd = 0, back = 0; for (let k = 1; k < 30; k++) if (T[k] && T[k + 1]) { const ds = ((cum[T[k + 1].k] - cum[T[k].k]) % L + L) % L; if (ds < L / 2) fwd++; else back++; }
  const reversed = back > fwd; if (reversed) P = [...P].reverse();
  const w = map.words.find(x => x.t === 'FINISH' || x.t === 'START/FINISH') || map.words.find(x => /^finish$/i.test(x.t)) || map.words.find(x => x.t === 'START');
  let start = 'first point of the map line (not verified)', startVerified = false;
  if (w) { const q = near(P, w), off = Math.round(q.d * scale); P = [...P.slice(q.k), ...P.slice(0, q.k)];
    start = `"${w.t}" label on the official circuit map, ${off} m from the line`; startVerified = off <= 60 ? true : 'label far from the line'; }
  return {line: {...line, pts: P}, reversed, turnVotes: {fwd, back}, start, startVerified};
}
