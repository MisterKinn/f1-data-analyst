// Track temperature from a weather forecast: track − air = a + k × shortwave radiation (W/m²), fitted on
// real session weather (TracingInsights weather.json: air and track temperature every minute, F1 2024–2026
// practice and qualifying, dry) against the hourly radiation of the Open-Meteo archive at the circuit.
// Tested leave-one-event-out. Needs network (GitHub Actions). Out: worker/lapsim/tracktemp-data.js,
// scripts/sim/data/tracktemp.json.
import {existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {tiTrack} from './ti-races.mjs';
import {TRACK_LL} from '../../worker/lapsim/track-coords.js';

const ROOT = process.env.LAPSIM_TI_WEATHER || '.cache/lapsim/ti-weather', YEARS = (process.env.LAPSIM_TT_YEARS || '2024,2025,2026').split(',');
const ALIAS = {barcelona: 'catalunya', 'barcelona-catalunya': 'catalunya'}, SESSIONS = /^(Practice [123]|Qualifying|Sprint Qualifying|Sprint Shootout)$/;
const read = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
mkdirSync(ROOT, {recursive: true});
const rows = [];
for (const y of YEARS) {
  const dir = join(ROOT, y);
  if (!existsSync(join(dir, '.git'))) {
    execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', `https://github.com/TracingInsights/${y}`, dir], {stdio: 'inherit', env: {...process.env, GIT_LFS_SKIP_SMUDGE: '1'}});
    execFileSync('git', ['-C', dir, 'sparse-checkout', 'set', '--no-cone', '/*/*/weather.json', '/*/*/session_info.json'], {stdio: 'inherit'});
    execFileSync('git', ['-C', dir, 'checkout', '-q'], {stdio: 'inherit'});
  }
  for (const ev of readdirSync(dir).filter(e => /Grand Prix$/.test(e))) {
    const t = tiTrack(ev, +y), id = ALIAS[t] || t, ll = TRACK_LL[id]; if (!ll) continue;
    const samples = [];
    for (const ses of readdirSync(join(dir, ev)).filter(s => SESSIONS.test(s))) {
      const info = read(join(dir, ev, ses, 'session_info.json')), w = read(join(dir, ev, ses, 'weather.json'));
      if (!info?.t0_date || !w?.wT || w.wR?.some(Boolean)) continue;
      const t0 = Date.parse(info.t0_date + 'Z');
      w.wT.forEach((s, i) => { if (Number.isFinite(w.wAT[i]) && Number.isFinite(w.wTT[i])) samples.push({ms: t0 + s * 1000, air: w.wAT[i], track: w.wTT[i], ses}); });
    }
    if (samples.length < 30) continue;
    const day = ms => new Date(ms).toISOString().slice(0, 10), from = day(Math.min(...samples.map(s => s.ms))), to = day(Math.max(...samples.map(s => s.ms)));
    let H;
    try { H = (await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${ll[0]}&longitude=${ll[1]}&start_date=${from}&end_date=${to}&hourly=shortwave_radiation&timezone=GMT`)).json()).hourly; } catch (e) { console.log(y, ev, e.message); continue; }
    if (!H?.time) { console.log(y, ev, 'no archive'); continue; }
    // radiation is the mean of the preceding hour: interpolate at the sample time
    const T = H.time.map(x => Date.parse(x + ':00Z')), R = H.shortwave_radiation;
    const at = ms => { const k = T.findIndex(x => x >= ms); if (k <= 0) return R[Math.max(0, k)]; const f = (ms - T[k - 1]) / (T[k] - T[k - 1]); return R[k - 1] * (1 - f) + R[k] * f; };
    // one point per 10 minutes is enough (weather samples are 1/min and strongly correlated)
    samples.filter((_, i) => i % 10 === 0).forEach(s => { const sw = at(s.ms); if (Number.isFinite(sw)) rows.push({ev: y + ' ' + id, id, sw, d: s.track - s.air}); });
    console.log(y, id, samples.length, 'samples');
  }
}
// Timing71 sessions of other series at the same circuits (F1 replays left out: they duplicate the TI sessions):
// one point per session (median air/track temperature, radiation at the session midpoint)
const t71 = [];
const T71 = process.env.LAPSIM_T71_DIR;
if (T71) {
  const {mapSessions} = await import('./t71-tracks.mjs');
  for (const f of readdirSync(T71).filter(f => /^(wec|elms|alms|fe|gtwc|igtc|dtm|imsa)\.json$/.test(f))) {
    const key = f.slice(0, -5);
    for (const s of mapSessions(read(join(T71, f)).sessions.map(x => ({...x, key})))) {
      const ll = TRACK_LL[s.track], w = s.weather; const y = new Date(s.start * 1e3).getUTCFullYear();
      if (!ll || !w || w.air == null || w.track == null || w.wet > 0 || y < 2023 || !s.duration) continue;
      const mid = s.start * 1e3 + s.duration * 500, d0 = new Date(mid).toISOString().slice(0, 10);
      let H; try { H = (await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${ll[0]}&longitude=${ll[1]}&start_date=${d0}&end_date=${d0}&hourly=shortwave_radiation&timezone=GMT`)).json()).hourly; } catch { continue; }
      if (!H?.time) continue;
      const T = H.time.map(x => Date.parse(x + ':00Z')), R = H.shortwave_radiation, k = T.findIndex(x => x >= mid);
      const sw = k <= 0 ? R[Math.max(0, k)] : R[k - 1] + (R[k] - R[k - 1]) * (mid - T[k - 1]) / (T[k] - T[k - 1]);
      if (Number.isFinite(sw)) t71.push({ev: `${y} ${s.track} t71 ${key} ${s.start}`, id: s.track, year: String(y), sw, d: w.track - w.air, t71: true});
    }
  }
  console.log('Timing71 sessions', t71.length);
}
const fit = rs => { const n = rs.length, mx = rs.reduce((a, r) => a + r.sw, 0) / n, my = rs.reduce((a, r) => a + r.d, 0) / n; const k = rs.reduce((a, r) => a + (r.sw - mx) * (r.d - my), 0) / rs.reduce((a, r) => a + (r.sw - mx) ** 2, 0); return {k, a: my - k * mx}; };
const all = fit(rows), evs = [...new Set(rows.map(r => r.ev))], err = [], err0 = [];
for (const e of evs) { const f = fit(rows.filter(r => r.ev !== e)); for (const r of rows.filter(r => r.ev === e)) { err.push(f.a + f.k * r.sw - r.d); err0.push(0.02 * r.sw - r.d); } }
const rms = a => +Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length).toFixed(2);
let out = {generatedAt: new Date().toISOString(), a: +all.a.toFixed(3), k: +all.k.toFixed(5), test: {events: evs.length, points: rows.length, rmsC: rms(err), oldAssumptionRmsC: rms(err0)}};
if (t71.length) {
  // unseen-series test of the F1-only model, and the gate for adding the Timing71 points (F1 events scored;
  // Timing71 points of the same track and year are left out with the event)
  const unseen = t71.map(r => all.a + all.k * r.sw - r.d);
  const errC = [];
  for (const e of evs) { const [y, id] = e.split(' '); const f = fit([...rows.filter(r => r.ev !== e), ...t71.filter(r => !(r.id === id && r.year === y))]); for (const r of rows.filter(r => r.ev === e)) errC.push(f.a + f.k * r.sw - r.d); }
  const {gate} = await import('./gate.mjs'); const g = gate(err, errC);
  const both = fit([...rows, ...t71]);
  out.test.t71 = {sessions: t71.length, unseenRmsC: rms(unseen), candidateRmsC: rms(errC), gate: g.reason, used: g.accept};
  if (g.accept) out = {...out, a: +both.a.toFixed(3), k: +both.k.toFixed(5), test: {...out.test, rmsC: rms(errC)}};
  console.log(`Timing71: unseen-series RMS ${rms(unseen)} °C; gate ${rms(err)} → ${rms(errC)} °C: ${g.reason}`);
}
writeFileSync('worker/lapsim/tracktemp-data.js', '// Generated by scripts/sim/tracktemp-fit.mjs: track − air temperature = a + k × solar radiation (W/m²)\nexport const lapsimTrackTemp = ' + JSON.stringify(out) + ';\n');
mkdirSync('scripts/sim/data', {recursive: true}); writeFileSync('scripts/sim/data/tracktemp.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
