// Step-28 input (central decision 2026-11-24, step 26 amendment 1 §A7): per-corner pedal-timing gap rows, production page vs measured
// 2025-26 F1 pole laps (worker/lapsim/f1-real-telemetry-data.js, cleanTel, wet and locked out). Descriptive data, not a gate.
// Out: scripts/sim/data/f1-pedal-gap-corners-2025-2026.csv and .sha256. Usage: node scripts/sim/learn/f1-pedal-corners.mjs
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {lapsimF1RealTel} from '../../../worker/lapsim/f1-real-telemetry-data.js';
import {lapsimF1WetQuali} from '../../../worker/lapsim/f1-wet-quali-data.js';
import {isLockedF1} from '../locked-set.mjs';
import {cleanTel} from '../../../worker/lapsim/real-tel-gaps.js';
import {page, kapOf, metrics, pairs} from './f1-pedal-metrics.mjs';

const OUT = 'scripts/sim/data/f1-pedal-gap-corners-2025-2026.csv', f = x => Number.isFinite(x) ? +x.toFixed(3) : '';
const rows = ['track,season,corner_id,lap_share,apex_kph_meas,apex_kph_model,thr_on_vs_apex_meas_s,thr_on_vs_apex_model_s,thr_on_lag_s,rise_10_90_meas_s,rise_10_90_model_s,trail_proxy_meas,trail_proxy_model,brake_off_to_thr_on_meas_s,brake_off_to_thr_on_model_s'];
for (const y of ['2025', '2026']) for (const tr of Object.keys(lapsimF1RealTel).sort()) {
  const r = lapsimF1RealTel[tr][y]; if (!r || lapsimF1WetQuali[tr]?.[y] || isLockedF1(tr, y)) continue;
  const P = page(tr, y); if (!P) continue;
  const c = cleanTel(r); if (c.share > 0.5) continue;
  const kap = kapOf(P.kappa), M = metrics(c.x, c.speed.map(s => s / 3.6), c.throttle.map(Number), c.brake.map(b => b > 0 ? 1 : 0), r.len, kap);
  const S = metrics(P.x, P.v, P.th, P.brOn, P.L, kap);
  pairs(M.corners.filter(e => !c.near(e.s * r.len)), S.corners).forEach(([m, p], k) => rows.push([tr, y, k + 1, f(m.s), f(m.kph), f(p.kph), f(m.onApex), f(p.onApex), f(p.onApex - m.onApex),
    f(m.rise), f(p.rise), f(m.trail), f(p.trail), f(m.gap), f(p.gap)].join(',')));
}
const body = rows.join('\n') + '\n';
writeFileSync(OUT, body);
writeFileSync(OUT + '.sha256', createHash('sha256').update(body).digest('hex') + '  ' + OUT.split('/').pop() + '\n');
console.log(rows.length - 1, 'corners');
