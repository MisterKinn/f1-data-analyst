// Step 26 hold-out laps (pre-reg claude/prereg-step26-f1-throttle-timing-2026-11-24.md + amendment 1, §A3): the 2023 and 2024 dry
// pole laps from the TracingInsights season repos, in the f1-real-telemetry-data.js form. Measured data, only read and thinned.
// Pole lap = fastest Qualifying lap with a valid time, not deleted, on SOFT / MEDIUM / HARD; a session with any rain-flagged lap
// (wR) is dropped. Only tracks with a 2025 page car. Writes scripts/sim/data/f1-pole-tel-2023-2024.json and its .sha256.
// Usage: node scripts/sim/learn/f1-throttle-holdout-fetch.mjs [tiRoot=.cache/ti]
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cloneSeason, tiTrack} from '../ti-races.mjs';
import {simulationPage} from '../../../worker/simulation.js';

const ROOT = process.argv[2] || '.cache/ti', CACHE = '.cache/ti-tel', MAX = 900, DRY = ['SOFT', 'MEDIUM', 'HARD'], YEARS = [2023, 2024];
const OUT = 'scripts/sim/data/f1-pole-tel-2023-2024.json';
const hasCar = track => { try { return JSON.parse(simulationPage({track, car: '2025'}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]).carId === '2025'; } catch { return false; } };
const get = (year, p) => { const f = join(CACHE, String(year), p); if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  try { const t = execFileSync('curl', ['-sSf', '--max-time', '60', `https://raw.githubusercontent.com/TracingInsights/${year}/main/${p.split('/').map(encodeURIComponent).join('/')}`], {maxBuffer: 1 << 26}).toString();
    mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, t); return JSON.parse(t); } catch { return null; } };
const read = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

const laps = {}, dropped = [], tiSha = {};
for (const y of YEARS) {
  const dir = join(ROOT, String(y)); cloneSeason(dir, y);
  tiSha[y] = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD']).toString().trim();
  for (const ev of readdirSync(dir).filter(e => /Grand Prix$/.test(e)).sort()) {
    const track = tiTrack(ev, y), q = join(dir, ev, 'Qualifying');
    if (!hasCar(track)) { dropped.push({y, ev, track, why: 'no 2025 page car'}); continue; }
    if (!existsSync(q)) { dropped.push({y, ev, track, why: 'no qualifying'}); continue; }
    let rain = false, best = null;
    for (const drv of readdirSync(q).filter(x => /^[A-Z]{3}$/.test(x))) {
      const L = read(join(q, drv, 'laptimes.json')); if (!L) continue;
      for (let i = 0; i < L.lap.length; i++) {
        if (L.wR?.[i] === true) rain = true;
        const t = +L.time[i]; if (!Number.isFinite(t) || L.time[i] === 'None' || L.del?.[i] === true || !DRY.includes(L.compound?.[i])) continue;
        if (!best || t < best.time) best = {drv, lap: L.lap[i], time: t};
      }
    }
    if (rain) { dropped.push({y, ev, track, why: 'rain flag in session'}); continue; }
    if (!best) { dropped.push({y, ev, track, why: 'no valid dry lap'}); continue; }
    const raw = get(y, `${ev}/Qualifying/${best.drv}/${best.lap}_tel.json`), t = raw?.tel || raw;
    if (!t?.speed?.length) { dropped.push({y, ev, track, why: 'no telemetry file'}); continue; }
    // same thinning and fields as scripts/sim/f1-real-telemetry.mjs
    const n = t.speed.length, L = +t.distance[n - 1], step = Math.ceil(n / MAX), idx = [];
    for (let k = 0; k < n; k += step) idx.push(k);
    const pos = k => Number.isFinite(+t.rel_distance?.[k]) ? +t.rel_distance[k] : +t.distance[k] / L;
    (laps[track] ||= {})[y] = {driver: best.drv, lapNo: best.lap, lap: best.time, len: Math.round(L), src: `TracingInsights/${y} ${ev} Qualifying ${best.drv} lap ${best.lap}`,
      f: idx.map(k => Math.round(pos(k) * 1e4)), speed: idx.map(k => Math.round(+t.speed[k])), throttle: idx.map(k => Math.round(+t.throttle[k])),
      brake: idx.map(k => t.brake[k] === true || +t.brake[k] > 0 ? 1 : 0), gear: idx.map(k => +(t.gear ?? t.nGear)[k]), rpm: idx.map(k => Math.round(+(t.rpm ?? t.RPM)[k]))};
    console.log(y, track, best.drv, best.lap, best.time);
  }
}
const body = JSON.stringify({src: 'TracingInsights season repos', tiSha, dropped, laps});
writeFileSync(OUT, body);
writeFileSync(OUT + '.sha256', createHash('sha256').update(body).digest('hex') + '  ' + OUT.split('/').pop() + '\n');
console.log('tracks', Object.keys(laps).length, 'laps', Object.values(laps).reduce((s, o) => s + Object.keys(o).length, 0), 'dropped', dropped.length);
