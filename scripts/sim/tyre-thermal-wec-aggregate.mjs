// Step 7a WEC warm-up: per-unit table from Al Kamel lap-by-lap sessions (fetch-evolution.mjs wec-*.json files).
// Rules: Project doc claude/gate-tyre-thermal-wec-warmup-prereg-2026-11-23.md. Self-contained (no repo imports), so it can
// run where the raw files are. The rubber and warm-up terms copy evolutionDelta() with the pooled WEC coefficients of 2026-11-23.
//   node scripts/sim/tyre-thermal-wec-aggregate.mjs <dir with wec-*.json> <years, e.g. 2025> > units.json
// (years: the hold-out season is aggregated only after the power check on the tuning season passes)
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const COEF = {practice: {gainPct: -0.536, tauMin: 15, warmupPct: 0.089, warmupLaps: 2, scale: 1},
  qualifying: {gainPct: 1.2, tauMin: 60, warmupPct: 1.5, warmupLaps: 2, scale: 0.8}};
const rubber = (c, t) => { const a = c.gainPct / 100 * c.scale; return a > 0 && c.tauMin > 0 ? -a * (1 - Math.exp(-Math.max(0, t) / c.tauMin)) : 0; };
const warm = (c, k) => c.warmupPct / 100 * Math.max(0, 1 - (k - 1) / c.warmupLaps);
const CLS = {HYPERCAR: 'hypercar', LMGT3: 'lmgt3'};

const dir = process.argv[2], YEARS = String(process.argv[3] || '').split(',').map(Number), units = {};
for (const f of readdirSync(dir).filter(f => /^wec-.*\.json$/.test(f))) {
  const S = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  if (!YEARS.includes(S.year)) continue;
  const ci = Object.fromEntries(S.columns.map((k, i) => [k, i]));
  const type = S.type === 'qualifying' || /hyperpole|qualif/i.test(S.session) ? 'qualifying' : 'practice', c = COEF[type];
  const byCar = {};
  for (const r of S.rows) (byCar[r[ci.car]] ||= []).push(r);
  for (const rs of Object.values(byCar)) {
    rs.sort((a, b) => a[ci.lap] - b[ci.lap]);
    const cls = CLS[String(rs[0][ci.class]).toUpperCase()]; if (!cls) continue;
    const green = rs.filter(r => !r[ci.outLap] && !r[ci.neutral] && Number.isFinite(r[ci.time]));
    if (!green.length) continue;
    const best = Math.min(...green.map(r => r[ci.time]));
    for (let i = 0; i + 2 < rs.length; i++) {
      const [o, A, B] = [rs[i], rs[i + 1], rs[i + 2]];
      if (!o[ci.outLap] || A[ci.lap] !== o[ci.lap] + 1 || B[ci.lap] !== o[ci.lap] + 2) continue;
      if ([A, B].some(r => r[ci.outLap] || r[ci.neutral] || !Number.isFinite(r[ci.time]))) continue;
      if (!(B[ci.time] <= 1.02 * best && A[ci.time] <= 1.06 * best)) continue;
      const y = 100 * (A[ci.time] - B[ci.time]) / B[ci.time] - 100 * (rubber(c, A[ci.minute]) - rubber(c, B[ci.minute]));
      const k = `${S.year}|${S.track}|${cls}`;
      const u = units[k] ||= {year: S.year, track: S.track, cls, n: 0, sumY: 0, sumY2: 0, sumProd: 0, sessions: new Set(), nQuali: 0};
      u.n++; u.sumY += y; u.sumY2 += y * y; u.sumProd += 100 * (warm(c, 1) - warm(c, 2)); u.sessions.add(S.session); if (type === 'qualifying') u.nQuali++;
    }
  }
}
const out = Object.values(units).map(u => ({year: u.year, track: u.track, cls: u.cls, n: u.n, y: +(u.sumY / u.n).toFixed(5),
  sdY: +Math.sqrt(Math.max(0, u.sumY2 / u.n - (u.sumY / u.n) ** 2)).toFixed(5), prod: +(u.sumProd / u.n).toFixed(5), sessions: u.sessions.size, nQuali: u.nQuali}))
  .sort((a, b) => a.year - b.year || a.track.localeCompare(b.track) || a.cls.localeCompare(b.cls));
console.log(JSON.stringify({source: 'Al Kamel WEC lap-by-lap (fetch-evolution.mjs; artifact lapsim-evolution, fork run 42419815711)', rule: 'claude/gate-tyre-thermal-wec-warmup-prereg-2026-11-23.md', units: out}));
