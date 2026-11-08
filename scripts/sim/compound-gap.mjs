// Lap-time gap between F1 dry compounds, measured on real low-fuel laps: the same driver's best
// Medium (or Hard) lap vs best Soft lap in one qualifying-type session (Sprint Qualifying/Shootout:
// SQ1/SQ2 on Mediums, SQ3 on Softs; Qualifying when at least MIN drivers ran both). The track gain
// between the two laps is removed with the fitted track-evolution curve. Model for events without a
// measurement: gap % = k(track) × C-steps between the compounds (k pooled, per track shrunk to it),
// tested leave-one-event-out. Writes worker/lapsim/compound-gap-data.js.
import {readdirSync, readFileSync, existsSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tiTrack} from './ti-races.mjs';
import {lapsimCompounds} from '../../worker/lapsim/compounds-data.js';
import {evolutionCoeffs, evolutionDelta} from '../../worker/lapsim/evolution.js';

const ROOT = process.env.LAPSIM_TI || '.cache/lapsim/ti', MIN = 8, SHRINK = 2;
const YEARS = (process.env.LAPSIM_GAP_YEARS || '2023,2024,2025,2026').split(',');
const ALIAS = {barcelona: 'catalunya'}, STEP = {SOFT: 2, MEDIUM: 1, HARD: 0};
const val = v => v === 'None' || v == null ? null : v;
const median = a => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const read = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

// one session: per driver best lap and its minute for each compound
function session(dir, id) {
  const info = read(join(dir, 'session_info.json')), t0 = info?.session_start_time ?? 0, evo = evolutionCoeffs('f1', id, 'qualifying');
  const at = m => evolutionDelta({...evo, session: 'qualifying', useCurve: !!evo.curve}, m, Infinity);
  const gaps = {MEDIUM: [], HARD: []}; let rain = 0, n = 0;
  for (const drv of readdirSync(dir).filter(d => /^[A-Z]{3}$/.test(d))) {
    const L = read(join(dir, drv, 'laptimes.json')); if (!L) continue;
    const best = {};
    for (let i = 0; i < L.lap.length; i++) {
      n++; if (L.wR?.[i] === true) rain++;
      const t = val(L.time[i]), c = L.compound?.[i], s = val(L.lST?.[i]);
      if (!Number.isFinite(t) || !Number.isFinite(s) || L.del?.[i] === true || val(L.pin?.[i]) != null || val(L.pout?.[i]) != null || /[24567]/.test(String(L.status?.[i] ?? '1')) || !(c in STEP)) continue;
      if (!(t < (best[c]?.t ?? Infinity))) continue;
      best[c] = {t, m: (s - t0) / 60};
    }
    const S = best.SOFT; if (!S) continue;
    // lap on X, moved to the soft lap's track state: X lap × (1 + evo(soft minute) − evo(X minute))
    for (const c of ['MEDIUM', 'HARD']) if (best[c] && Math.abs(best[c].t / S.t - 1) < 0.03) gaps[c].push((best[c].t * (1 + at(S.m) - at(best[c].m)) - S.t) / S.t * 100);
  }
  return rain / Math.max(1, n) > 0.05 ? null : gaps;
}

const events = [];
for (const y of YEARS) {
  if (!existsSync(join(ROOT, y))) continue;
  for (const ev of readdirSync(join(ROOT, y)).filter(e => /Grand Prix$/.test(e))) {
    const t = tiTrack(ev, +y), id = ALIAS[t] || t, cp = lapsimCompounds[id]?.[y];
    if (!cp) continue;
    for (const ses of ['Sprint Qualifying', 'Sprint Shootout', 'Qualifying']) {
      const dir = join(ROOT, y, ev, ses); if (!existsSync(dir)) continue;
      const g = session(dir, id); if (!g) continue;
      for (const c of ['MEDIUM', 'HARD']) if (g[c].length >= MIN)
        events.push({year: y, id, compound: c, drivers: g[c].length, pct: median(g[c]), steps: +cp[2].slice(1) - +cp[STEP[c]].slice(1), session: ses});
    }
  }
}
// one value per event and compound (sprint qualifying preferred: it comes first in the list)
const seen = new Set(), rows = events.filter(e => { const k = e.year + e.id + e.compound; return !seen.has(k) && seen.add(k); }).filter(e => e.steps > 0);
const kOf = rs => rs.reduce((s, r) => s + r.pct * r.steps, 0) / rs.reduce((s, r) => s + r.steps ** 2, 0);
const fit = rs => { const k = kOf(rs), by = {}; for (const r of rs) (by[r.id] ||= []).push(r);
  return {k, tracks: Object.fromEntries(Object.entries(by).map(([id, a]) => [id, (kOf(a) * a.length + k * SHRINK) / (a.length + SHRINK)]))}; };
// leave one event out: predict its gap from all others
const err = rows.map((r, i) => { const f = fit(rows.filter((_, j) => j !== i)); return (f.tracks[r.id] ?? f.k) * r.steps - r.pct; });
const rms = Math.sqrt(err.reduce((s, x) => s + x * x, 0) / err.length), noModel = Math.sqrt(rows.reduce((s, r) => s + r.pct ** 2, 0) / rows.length);
const all = fit(rows), measured = {};
for (const r of rows) ((measured[r.id] ||= {})[r.year] ||= {})[r.compound] = {pct: +r.pct.toFixed(4), drivers: r.drivers, session: r.session};
const out = {generatedAt: new Date().toISOString(), method: 'same-driver best laps per compound, low fuel, evolution-corrected', kPctPerStep: +all.k.toFixed(4),
  tracks: Object.fromEntries(Object.entries(all.tracks).map(([id, k]) => [id, +k.toFixed(4)])), test: {events: rows.length, rmsPct: +rms.toFixed(3), noModelPct: +noModel.toFixed(3)}, measured};
writeFileSync('worker/lapsim/compound-gap-data.js', '// Generated by scripts/sim/compound-gap.mjs\nexport const lapsimCompoundGap = ' + JSON.stringify(out) + ';\n');
console.log(`${rows.length} measured gaps, k ${all.k.toFixed(3)} %/C-step, leave-one-out RMS ${rms.toFixed(3)} % of lap (no model ${noModel.toFixed(3)} %)`);
