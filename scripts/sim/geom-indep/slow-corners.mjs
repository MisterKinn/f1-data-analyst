// Step 3 report (for step 2b): slow corners (R < 60 m on either geometry) with the measured pole-lap minimum speed and the lateral
// acceleration each geometry implies, a_y = v_min² / R_min. Measured = worker/lapsim/f1-real-telemetry-data.js (read only).
// R_min = smallest radius within ±40 m of the corner on that line. Usage: node scripts/sim/geom-indep/slow-corners.mjs [--json out]
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimTracks as T} from '../../../worker/lapsim/tracks-data.js';
import {lapsimF1RealTel as RT} from '../../../worker/lapsim/f1-real-telemetry-data.js';

const G = JSON.parse(readFileSync('scripts/sim/data/geom-indep/tracks.json', 'utf8')).tracks;
const rmin = (r, s, w = 40) => { const n = r.kappa.length; let m = 0; for (let k = -Math.round(w / r.ds); k <= Math.round(w / r.ds); k++) m = Math.max(m, Math.abs(r.kappa[((Math.round(s / r.ds) + k) % n + n) % n]) / 1e5); return 1 / m; };
const out = [];
for (const id of Object.keys(G)) {
  const p = T[id], e = G[id].eras[0], q = e.row, Lp = p.kappa.length * p.ds;
  for (const c of p.corners || []) {
    const rp = rmin(p, c.s), sn = e.extra.dist[Math.round(c.s / p.ds) % e.extra.dist.length], rq = rmin(q, sn);
    if (Math.min(rp, rq) >= 60) continue;
    const v = {}; for (const [y, t] of Object.entries(RT[id] || {})) { const f = c.s / Lp; let vm = Infinity;
      t.f.forEach((x, i) => { const d = Math.abs(x / 1e4 - f); if (Math.min(d, 1 - d) < 0.012) vm = Math.min(vm, t.speed[i]); }); if (vm < Infinity) v[y] = vm; }
    const vk = Object.values(v).length ? Math.min(...Object.values(v)) : null, ay = R => vk && +((vk / 3.6) ** 2 / R / 9.81).toFixed(2);
    out.push({track: id, corner: 'T' + c.number + (c.letter || ''), rProdM: Math.round(rp), rIndepM: Math.round(rq), vMinKph: v, ayProdG: ay(rp), ayIndepG: ay(rq)});
  }
}
console.table(out.map(r => ({...r, vMinKph: Object.entries(r.vMinKph).map(([y, x]) => `${y}:${Math.round(x)}`).join(' ')})));
if (process.argv.includes('--json')) writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(out, null, 1));
