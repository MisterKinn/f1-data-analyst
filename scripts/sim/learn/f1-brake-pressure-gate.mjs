// Gate BP-1 (claude/gate-brake-pressure-prereg-2026-11-22.md §M-BP / BP-1 + claude/gate-bp1-C-amendment-2026-11-22.md):
// peak brake pedal load from the measured speed of the F1 pole lap (model M-BP) against Brembo's estimate for the hardest corner of
// each GP (scripts/sim/data/brembo.json). Brake on/off is measured only for its timing, so pressure comes from speed alone:
// friction force = m|a| − drag − rolling − regen, pedal load = k_season × force / g0. Odd calendar rounds fit k, even rounds are the
// hold-out (run once). Broken telemetry (rule A+ + 150 m) is skipped. Out: scripts/sim/data/learn/f1-brake-pressure-gate-2026-11-22.json (attempt 1: …-a1.json). Attempt 2 grid: BP_WIN 5 / 11, BP_STAT peak / p80
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimF1RealTel} from '../../../worker/lapsim/f1-real-telemetry-data.js';
import {lapsimTracks} from '../../../worker/lapsim/tracks-data.js';
import {realConditions} from '../../../worker/lapsim/scenario.js';
import {cleanTel} from '../../../worker/lapsim/real-tel-gaps.js';
import {tiTrack} from '../ti-races.mjs';
import {signFlip} from '../gate.mjs';
import {mbpSeries, zones} from '../../../worker/lapsim/brake-pressure.js';

const G0 = 9.81, B = JSON.parse(readFileSync('scripts/sim/data/brembo.json', 'utf8')).f1;
const ROUNDS = {
  2025: ['Australian', 'Chinese', 'Japanese', 'Bahrain', 'Saudi Arabian', 'Miami', 'Emilia Romagna', 'Monaco', 'Spanish', 'Canadian', 'Austrian', 'British', 'Belgian', 'Hungarian', 'Dutch', 'Italian', 'Azerbaijan', 'Singapore', 'United States', 'Mexico City', 'São Paulo', 'Las Vegas', 'Qatar', 'Abu Dhabi'],
  2026: ['Australian', 'Chinese', 'Japanese', 'Miami', 'Canadian', 'Monaco', 'Barcelona-Catalunya', 'Austrian', 'British', 'Belgian', 'Hungarian', 'Dutch', 'Italian', 'Spanish', 'Azerbaijan', 'Bahrain', 'Singapore', 'United States', 'Mexico City', 'São Paulo', 'Las Vegas'],
};
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (s[(n - 1) >> 1] + s[n >> 1]) / 2 : NaN; };

const STAT = process.env.BP_STAT === 'p80' ? z => z.p80F : z => z.peakF;
const rows = [];
for (const year of [2025, 2026]) for (const [ev, ref] of Object.entries(B[year] || {})) {
  const h = ref.hardest?.[0], round = ROUNDS[year].indexOf(ev.replace(/ Grand Prix$/, '')) + 1; if (!h?.pedalKg || !round) continue;
  const id = tiTrack(ev, year), lap = lapsimF1RealTel[id]?.[year], td = lapsimTracks[id === 'catalunya' ? 'barcelona-catalunya' : id] || lapsimTracks[id];
  const base = {year, round, ev, id, turn: h.turn, brembo: {kg: h.pedalKg, g: h.decelG, vFrom: h.vFrom, vTo: h.vTo}, split: round % 2 ? 'tune' : 'holdout'};
  if (!lap) { rows.push({...base, drop: 'no measured lap'}); continue; }
  const c = cleanTel(lap); if (c.share > 0.5) { rows.push({...base, drop: 'lap more than half broken'}); continue; }
  const s = mbpSeries(c.x, c.speed, year, realConditions(id)?.[year], {win: +(process.env.BP_WIN || 5)}), Z = zones(s), L = lap.len;
  const corner = td?.corners?.find(k => String(k.number) === String(h.turn) && !k.letter) || td?.corners?.find(k => String(k.number) === String(h.turn));
  const d = z => corner ? (q => Math.min(q, L - q))(Math.abs(z.xMin / L - corner.s / td.length) * L) : Math.abs(z.vFrom - h.vFrom) + Math.abs(z.vTo - h.vTo);
  if (corner && c.near(corner.s / td.length * L)) { rows.push({...base, drop: 'Brembo corner at broken telemetry'}); continue; }
  const z = Z.sort((a, b) => d(a) - d(b))[0]; if (!z || (corner && d(z) > 300)) { rows.push({...base, drop: 'no zone within 300 m of the corner'}); continue; }
  if (c.near(z.x0) || c.near(z.x1)) { rows.push({...base, drop: 'zone at broken telemetry'}); continue; }
  rows.push({...base, by: corner ? 'corner' : 'speeds', distM: +d(z).toFixed(0), model: {Fn: Math.round(STAT(z)), fg: +(STAT(z) / G0).toFixed(1), g: +z.peakG.toFixed(2), vFrom: Math.round(z.vFrom), vTo: Math.round(z.vTo)}});
}
const k = {}; for (const y of [2025, 2026]) k[y] = median(rows.filter(r => r.year === y && r.split === 'tune' && r.model).map(r => r.brembo.kg / r.model.fg));
const kBase = {}; for (const y of [2025, 2026]) kBase[y] = median(rows.filter(r => r.year === y && r.split === 'tune' && r.model).map(r => r.brembo.kg));
for (const r of rows) if (r.model) { r.model.kg = +(k[r.year] * r.model.fg).toFixed(1); r.e = r.model.kg / r.brembo.kg - 1; r.eBase = kBase[r.year] / r.brembo.kg - 1; r.eG = r.model.g / r.brembo.g - 1; }
const OPEN = process.env.BP_HOLDOUT === '1'; // tuning checks first; the hold-out is opened once
if (!OPEN) { for (const r of rows.filter(r => r.split === 'tune')) console.log(r.year, r.round, r.id, 'T' + r.turn, r.drop || `${r.by} ${r.distM}m Brembo ${r.brembo.kg}kg ${r.brembo.g}g ${r.brembo.vFrom}->${r.brembo.vTo} | model ${r.model.kg}kg ${r.model.g}g ${r.model.vFrom}->${r.model.vTo} e ${(r.e * 100).toFixed(0)}%`);
  console.log({k, kBase, tuneMedAbsE: median(rows.filter(r => r.split === 'tune' && r.e != null).map(r => Math.abs(r.e)))}); process.exit(0); }
const judge = sel => {
  const H = rows.filter(r => r.split === 'holdout' && r.e != null && sel(r)), ae = H.map(r => Math.abs(r.e));
  let rng = 1; const rand = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296), bs = [];
  for (let b = 0; b < 2000; b++) bs.push(median(ae.map(() => ae[Math.floor(rand() * ae.length)])));
  bs.sort((a, b) => a - b); const up = bs[Math.floor(0.9 * bs.length)], sf = signFlip(H.map(r => Math.abs(r.eBase) - Math.abs(r.e)), {m: 1});
  const med = median(ae), pass = H.length >= 5 && med <= 0.10 && up <= 0.15 && sf.gain > 0 && sf.p < 0.05;
  return {n: H.length, medAbsE: +med.toFixed(3), upper90: +up.toFixed(3), baseMedAbsE: +median(H.map(r => Math.abs(r.eBase))).toFixed(3), gain: +sf.gain.toFixed(3), p: +sf.p.toFixed(4),
    medAbsEG: +median(H.map(r => Math.abs(r.eG)).filter(Number.isFinite)).toFixed(3), byYear: Object.fromEntries([2025, 2026].map(y => [y, +median(H.filter(r => r.year === y).map(r => Math.abs(r.e))).toFixed(3)])), pass};
};
const out = {gate: 'BP-1', run: new Date().toISOString(), k, kBaseline: kBase, headline: judge(() => true), withoutSepang2026: judge(r => !(r.year === 2026 && r.id === 'kuala-lumpur')), rows};
writeFileSync('scripts/sim/data/learn/f1-brake-pressure-gate-2026-11-22.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({k, kBase, headline: out.headline, withoutSepang2026: out.withoutSepang2026}, null, 1));
for (const r of rows) console.log(r.year, String(r.round).padStart(2), r.split.padEnd(7), r.id.padEnd(18), 'T' + r.turn, r.drop || `${r.by} ${r.distM}m  Brembo ${r.brembo.kg}kg ${r.brembo.g}g ${r.brembo.vFrom}->${r.brembo.vTo} | model ${r.model.kg}kg ${r.model.g}g ${r.model.vFrom}->${r.model.vTo}  e ${(r.e * 100).toFixed(0)}%`);
