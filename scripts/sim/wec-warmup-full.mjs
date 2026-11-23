// Step 15-prep, amendment 1: the pit-out run table from step 16's full Al Kamel files (loader alkamel-full-laps.mjs), same run
// rule and columns as wec-warmup-measure.mjs. Rules: Project docs claude/gate-wec-warmup-evolution-prereg-2026-11-23.md (+ amendment).
//   node scripts/sim/wec-warmup-full.mjs > runs.json      (needs .cache/alkamel-full-laps, see docs/lapsim-alkamel-laps.md)
import {sessions, readSession} from './learn/alkamel-full-laps.mjs';

const TRACK = {'LOSAIL': 'lusail', 'IMOLA': 'imola', 'SPA FRANCORCHAMPS': 'spa-francorchamps', 'SAO PAULO': 'interlagos', 'CIRCUIT OF THE AMERICAS': 'austin',
  'BAHRAIN INTERNATIONAL CIRCUIT': 'sakhir', 'AUTODROMO NAZIONALE DI MONZA': 'monza', 'SEBRING': 'sebring', 'AUTODROMO DO ALGARVE': 'portimao',
  'LE MANS': 'le-mans', 'FUJI SPEEDWAY': 'fuji'};
const CLS = c => { const s = String(c).toUpperCase(); return s === 'HYPERCAR' ? 'hypercar' : /^LMP2/.test(s) ? 'lmp2' : s === 'LMGT3' ? 'lmgt3' : /LMGTE/.test(s) ? 'lmgte' : null; };
const columns = ['year', 'track', 'type', 'session', 'cls', 'car', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'best', 'trackC', 'airC', 'pitS', 'minute', 'first'];
const runs = [], log = [];
for (const s of sessions(undefined, s => s.series === 'wec' && [2023, 2024, 2025].includes(s.season) && ['practice', 'qualifying', 'race'].includes(s.kind))) {
  const track = TRACK[String(s.event).toUpperCase()] || String(s.event).toLowerCase().replace(/[^a-z0-9]+/g, '-'), type = s.kind, byCar = new Map();
  for (const l of readSession(s)) if (l.time > 30) (byCar.get(l.car) || byCar.set(l.car, []).get(l.car)).push(l);
  const n0 = runs.length;
  for (const [car, L] of byCar) {
    const cls = CLS(L[0].cls); if (!cls) continue;
    const green = L.filter(l => !l.pitIn && !l.pitOut && l.flag === 'GF'); if (!green.length) continue;
    const best = Math.min(...green.map(l => l.time));
    for (let i = 0; i < L.length; i++) {
      const o = L[i], first = i === 0 && type !== 'race';
      if (!(first || (i > 0 && L[i - 1].pitIn && L[i - 1].lap === o.lap - 1))) continue;   // o = out-lap
      if (o.pitIn || o.flag !== 'GF') continue;
      const k = [];
      for (let j = 1; j <= 6; j++) { const l = L[i + j]; if (!l || l.lap !== o.lap + j || l.pitIn || l.flag !== 'GF') break; k.push(l.time); }
      if (k.length < 3) continue;
      const a = L[i + 1]; if (a.rain || o.rain) continue;   // rain at the run: out
      const pitS = o.pitTime ?? (i > 0 ? L[i - 1].pitTime : null) ?? null;
      runs.push([s.season, track, type, s.session, cls, car, ...[0, 1, 2, 3, 4, 5].map(j => k[j] ?? null), best, a.trackTempC, a.airTempC, pitS,
        a.elapsed != null ? Math.round((a.elapsed - a.time) / 0.6) / 100 : null, first ? 1 : 0]);
    }
  }
  log.push(`${s.season} ${track} ${s.session}: ${runs.length - n0} runs`);
}
console.error(log.join('\n'));
console.log(JSON.stringify({source: "Al Kamel FIA WEC full lap files 2023-25 (step 16 draft release data-alkamel-full-laps; manifest scripts/sim/data/learn/alkamel-full-laps-manifest.json)",
  rule: 'claude/gate-wec-warmup-evolution-prereg-2026-11-23.md + amendment 1', columns, runs}));
