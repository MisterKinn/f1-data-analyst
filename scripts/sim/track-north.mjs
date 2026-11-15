// True north of each simulator track map: fits the map (rotation, mirror, shift; trimmed nearest-point error) to a geo-referenced
// outline of the same circuit: bacinger/f1-circuits GeoJSON or the OpenStreetMap candidate line in scripts/sim/data/tracks.
// Usage: node scripts/sim/track-north.mjs [id,id]  (writes $OUT or /tmp/track-north.json). Owner request 2026-11-15 (map compass).
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../worker/lapsim/tracks.js';
import {lonLatToLocal} from '../../worker/lapsim/geometry.js';
const D = new URL('./data/tracks/', import.meta.url).pathname;
const G = (await (await fetch('https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson')).json()).features; // MIT, not stored
const refs = [];
for (const f of G) { const c = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates.flat() : f.geometry.coordinates; refs.push({key: 'bacinger:' + f.properties.id, ...lonLatToLocal(c)}); }
for (const fn of readdirSync(D).filter(f => f.startsWith('extra-tracks'))) { const d = JSON.parse(readFileSync(D + fn, 'utf8')); const ts = d.tracks || d; for (const [k, v] of Object.entries(ts)) if (v && v.map && v.centre) refs.push({key: 'osm:' + k, venue: v.venue, x: v.map.x, y: v.map.y}); }
const BAC = {'nurburgring-gp': 'de-1927', 'sakhir-outer': 'bh-2002', 'paul-ricard-f1': 'fr-1969', istanbul: 'tr-2005', sochi: 'ru-2014', mugello: 'it-1914', portimao: 'pt-2008', hockenheim: 'de-1932', 'magny-cours': 'fr-1960', estoril: 'pt-1972', kyalami: 'za-1961', 'watkins-glen': 'us-1956', indianapolis: 'us-1909', 'paul-ricard-2021': 'fr-1969'};
const dens = (X, Y, step) => { const ox = [], oy = []; for (let i = 0; i < X.length; i++) { const j = (i + 1) % X.length, L = Math.hypot(X[j]-X[i], Y[j]-Y[i]), k = Math.max(1, Math.ceil(L/step)); for (let s = 0; s < k; s++) { ox.push(X[i]+(X[j]-X[i])*s/k); oy.push(Y[i]+(Y[j]-Y[i])*s/k); } } return [ox, oy]; };
function fit(ax, ay, bx, by, trim) {
  const [Bx, By] = dens(bx, by, 4);
  const cell = 20, grid = new Map(); Bx.forEach((x, i) => { const k = Math.floor(x/cell)+','+Math.floor(By[i]/cell); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const nn = (x, y) => { let bd = Infinity; const cx = Math.floor(x/cell), cy = Math.floor(y/cell); for (let r = 0; r < 12; r++) { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx),Math.abs(dy)) !== r) continue; const L = grid.get((cx+dx)+','+(cy+dy)); if (L) for (const i of L) { const d = (Bx[i]-x)**2+(By[i]-y)**2; if (d < bd) bd = d; } } if (bd < (r*cell)**2) break; } return Math.min(Math.sqrt(bd), 250); };
  const ca = [ax.reduce((a,b)=>a+b)/ax.length, ay.reduce((a,b)=>a+b)/ay.length], cb = [bx.reduce((a,b)=>a+b)/bx.length, by.reduce((a,b)=>a+b)/by.length];
  const step = Math.max(1, Math.floor(ax.length/150)), idx = ax.map((_,i)=>i).filter(i=>i%step===0);
  const cost = (th, m, tx, ty) => { const c = Math.cos(th), s = Math.sin(th); const d = idx.map(i => { const px = m*(ax[i]-ca[0]), py = ay[i]-ca[1]; return nn(c*px - s*py + cb[0] + tx, s*px + c*py + cb[1] + ty); }).sort((a,b)=>a-b); const n = Math.floor(d.length*trim); return Math.sqrt(d.slice(0,n).reduce((a,v)=>a+v*v,0)/n); };
  let best = {e: Infinity};
  for (const m of [1, -1]) for (let deg = 0; deg < 360; deg += 3) { const e = cost(deg*Math.PI/180, m, 0, 0); if (e < best.e) best = {e, th: deg*Math.PI/180, m, tx: 0, ty: 0}; }
  for (let st of [40, 20, 10, 5, 2, 1, 0.5]) { let imp = true; while (imp) { imp = false; for (const [dth, dx, dy] of [[st*Math.PI/1800,0,0],[-st*Math.PI/1800,0,0],[0,st,0],[0,-st,0],[0,0,st],[0,0,-st]]) { const e = cost(best.th+dth, best.m, best.tx+dx, best.ty+dy); if (e < best.e - 1e-6) { best = {...best, e, th: best.th+dth, tx: best.tx+dx, ty: best.ty+dy}; imp = true; } } } }
  return {deg: ((best.th*180/Math.PI)%360+360)%360, mirror: best.m < 0, rms: best.e, full: cost(best.th, best.m, best.tx, best.ty) };
}
const only = process.argv[2] ? process.argv[2].split(',') : null;
const out = {};
for (const [id, t] of Object.entries(T)) {
  if (only && !only.includes(id)) continue;
  if (!t.map?.x?.length) { out[id] = {none: 'no map'}; continue; }
  if (t.heading && t.quality?.alignRms != null) { out[id] = {deg: 0, src: 'bacinger (build)', rms: t.quality.alignRms}; continue; }
  const cands = refs.filter(r => (r.venue && (r.venue === id || id.startsWith(r.venue + '-') || r.venue === id.replace(/-(f1|gp|sprint|24h|outer|2021|2025|gardner)$/, ''))) || (BAC[id] && r.key === 'bacinger:' + BAC[id]));
  const res = cands.map(r => ({src: r.key, ...fit(t.map.x, t.map.y, r.x, r.y, 0.9)})).sort((a, b) => a.rms - b.rms);
  out[id] = res[0] ? {...res[0], alt: res.slice(1, 3).map(r => r.src + ' ' + r.deg.toFixed(0) + '° ' + r.rms.toFixed(0))} : {none: 'no reference'};
  console.log(id, JSON.stringify(out[id]));
}
writeFileSync(process.env.OUT || '/tmp/track-north.json', JSON.stringify(out, null, 1)); // reviewed, then copied into worker/lapsim/track-north-data.js
