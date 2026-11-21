// W16 sign check of the page (Session C, 2026-11-21, rebuilt from Session E's description): for each dry qualifying track row of
// bop-platform-w16.json, sign(page LMH lap − page LMDh lap) against sign(median_gap_s) and sign(best_gap_s). The page lap is the
// class car's fix (carsFor(track)[cls].fix: lap, or the sum of real sectors). Sign check, not a gate.
import fs from 'node:fs';
import {carsFor} from '../../worker/lapsim/scenario.js';
const W = JSON.parse(fs.readFileSync(new URL('./data/bop-platform-w16.json', import.meta.url)));
const lap = f => f?.lap ?? (f?.real || []).reduce((a, b) => a + b, 0);
const rows = W.tracks.filter(r => r.condition === 'dry' && r.session === 'qualifying'), seen = new Set(), n = {median: [0, 0], best: [0, 0]}, wrong = [];
for (const r of rows) {
  const key = r.series + ':' + r.track; if (seen.has(key)) continue; seen.add(key);
  let c; try { c = carsFor(r.track); } catch { continue; }
  const a = lap(c?.['wec-lmh']?.fix), b = lap(c?.['wec-lmdh']?.fix); if (!a || !b) continue;
  const page = a - b;
  for (const m of ['median', 'best']) { const o = r[m + '_gap_s']; if (o == null || !page || !o) continue; const ok = Math.sign(page) === Math.sign(o); n[m][ok ? 0 : 1]++; if (!ok) wrong.push({measure: m, track: r.track, series: r.series, page: +page.toFixed(3), measured: +o.toFixed(3), other: +(r[(m === 'best' ? 'median' : 'best') + '_gap_s'] ?? NaN).toFixed(3)}); }
}
console.log(`rows (series × track) ${seen.size}; median same/wrong ${n.median.join('/')}; best same/wrong ${n.best.join('/')}`);
for (const w of wrong) console.log(`${w.measure} ✗ ${w.series} ${w.track}: page ${w.page}, measured ${w.measured} (other measure ${w.other})`);
