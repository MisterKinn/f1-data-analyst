// Leave-one-track-out check of the estimated-zone rule (scripts/sim/f1-zones.mjs estimate) on every documented 2026 F1 circuit
// (owner 2026-11-21, Gate G): for each circuit the rule's numbers are refitted on the other circuits, then the circuit is estimated
// as if it had no FIA map and compared with its real zones. Per circuit: start/end error of matched zones, missed and extra zones,
// overtake mark error and the lap-time effect (2026 car, Straight Mode in the estimated vs the real zones). One vote per circuit.
// The baseline is the rule in f1-zones.mjs (EST_P). Record of 2026-11-21 against the 2026-11-16 rule: scripts/sim/data/f1-zones-loto.json
// (zone error 173 -> 141 m, +32 +/- 16; overtake marks 468 -> 240 m; |lap effect| 0.494 -> 0.449 s, +0.045 +/- 0.026; all pass). Usage: node scripts/sim/f1-zones-loto.mjs  -> scripts/sim/data/f1-zones-loto.json
import {writeFileSync} from 'node:fs';
process.env.F1_ZONES_NO_WRITE = '1';
const {estimate, EST_P, documented} = await import('./f1-zones.mjs');
const {lapsimAllTracks: T} = await import('../../worker/lapsim/tracks.js');
const {lapsimKernel} = await import('../../worker/lapsim/kernel.js');
const {carsFor} = await import('../../worker/lapsim/scenario.js');

const K = lapsimKernel(), ENV = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0});
const ids = Object.keys(documented).filter(id => documented[id]['2026'] && !documented[id]['2026'].est && T[id]);
const mod = (x, L) => ((x % L) + L) % L, cd = (a, b, L) => Math.min(mod(a - b, L), mod(b - a, L));
const len = (z, L) => mod(z.to - z.from, L);
function overlap(a, b, L) { let o = 0; for (let s = 0; s < len(a, L); s += 5) if (mod(mod(a.from + s, L) - b.from, L) <= len(b, L)) o += 5; return o; }
// zone error of one circuit: matched zones |start| + |end| error; a missed real zone or an extra estimated zone counts its length
function score(id, est, real) {
  const L = T[id].length, used = new Set(); let err = 0, se = [], ee = [], missed = 0;
  for (const r of real.zones) {
    const m = est.zones.filter(z => !used.has(z)).map(z => ({z, o: overlap(r, z, L)})).sort((a, b) => b.o - a.o)[0];
    if (!m || m.o <= 0) { missed++; err += len(r, L); continue; }
    used.add(m.z); const ds = cd(m.z.from, r.from, L), de = cd(m.z.to, r.to, L); se.push(ds); ee.push(de); err += ds + de;
  }
  const extra = est.zones.filter(z => !used.has(z)); for (const z of extra) err += len(z, L);
  const mk = k => { if (real.marksEst) return null; // Sepang and Madring 2026: marks not in the drop-in
    const a = est.marks.find(m => m.kind === k), b = real.marks.find(m => m.kind === k); return a && b ? cd(a.s, b.s, L) : null; };
  return {err: err / Math.max(1, real.zones.length), startErr: se, endErr: ee, missed, extra: extra.length, otD: mk('det'), otA: mk('act')};
}
const ot = s => (s.otD ?? 0) + (s.otA ?? 0); // 0 on both sides where the real marks are unknown
const lapCache = new Map();
function lap(id, zones) {
  const k = id + JSON.stringify(zones); if (lapCache.has(k)) return lapCache.get(k);
  const t = T[id], tr = zones.length ? K.trackFromData({...t, aeroZones: zones.map(z => [z.from, z.to])}, {aero: 'fia'}) : K.trackFromData(t, {aero: 'fia'});
  const v = K.simulateLap(tr, carsFor(id)['2026'].car, ENV).lapTime; lapCache.set(k, v); return v;
}

const G = {rb: [300, 250, 200, 175, 150], smOff: [45], otZone: [-280, -240, -200, -160, -120, -80, -40, 0, 40], otDet: [40, 80, 120, 160, 200]};
const cache = new Map();
const est = (id, P) => { const k = id + ':' + JSON.stringify(P); if (!cache.has(k)) cache.set(k, estimate(id, ['2026'], {...EST_P, ...P})['2026'] || {zones: [], marks: []}); return cache.get(k); };
// fit on a set of circuits: zone numbers first (rb, smOff), then the overtake numbers with that rb
function fit(train) {
  let best = null;
  for (const rb of G.rb) for (const smOff of G.smOff) { const e = train.reduce((s, id) => s + score(id, est(id, {rb, smOff}), documented[id]['2026']).err, 0) / train.length; if (!best || e < best.e) best = {e, rb, smOff}; }
  let bo = null;
  for (const otZone of G.otZone) for (const otDet of G.otDet) { const P = {rb: best.rb, smOff: best.smOff, otZone, otDet}; const e = train.reduce((s, id) => s + ot(score(id, est(id, P), documented[id]['2026'])), 0); if (!bo || e < bo.e) bo = {e, otZone, otDet}; }
  return {rb: best.rb, smOff: best.smOff, otZone: bo.otZone, otDet: bo.otDet};
}
const rows = [];
for (const h of ids) {
  const P = fit(ids.filter(i => i !== h)), real = documented[h]['2026'];
  const b = estimate(h, ['2026'], EST_P)['2026'] || {zones: [], marks: []}, c = est(h, P);
  const sb = score(h, b, real), sc = score(h, c, real), lr = lap(h, real.zones);
  rows.push({track: h, fold: P, base: {...sb, lapDiff: lap(h, b.zones) - lr, zones: b.zones, marks: b.marks}, cand: {...sc, lapDiff: lap(h, c.zones) - lr, zones: c.zones, marks: c.marks}, real: real.zones.length});
  console.log(h.padEnd(20), `fold ${JSON.stringify(P)}`, `base ${sb.err.toFixed(0)} m (miss ${sb.missed} extra ${sb.extra}, OT ${ot(sb)} m, lap ${(lap(h, b.zones) - lr).toFixed(3)} s)`, `cand ${sc.err.toFixed(0)} m (miss ${sc.missed} extra ${sc.extra}, OT ${ot(sc)} m, lap ${(lap(h, c.zones) - lr).toFixed(3)} s)`);
}
// Gate G: one vote per circuit, paired on the same rows; pass if the mean gain is above 1 paired SE
function gate(f) { const d = rows.map(r => f(r.base) - f(r.cand)), n = d.length, m = d.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return {n, gain: m, se: sd / Math.sqrt(n), pass: m > sd / Math.sqrt(n)}; }
const mean = f => rows.reduce((s, r) => s + f(r), 0) / rows.length;
const summary = {
  tracks: rows.length, full: fit(ids),
  zoneErr: {base: mean(r => r.base.err), cand: mean(r => r.cand.err), gate: gate(s => s.err)},
  otErr: {base: mean(r => ot(r.base)), cand: mean(r => ot(r.cand)), gate: gate(ot)},
  lapAbs: {base: mean(r => Math.abs(r.base.lapDiff)), cand: mean(r => Math.abs(r.cand.lapDiff)), gate: gate(s => Math.abs(s.lapDiff))},
  missed: {base: mean(r => r.base.missed), cand: mean(r => r.cand.missed)}, extra: {base: mean(r => r.base.extra), cand: mean(r => r.cand.extra)},
};
console.log(JSON.stringify(summary, null, 1));
writeFileSync(new URL('./data/f1-zones-loto-latest.json', import.meta.url), JSON.stringify({generatedAt: new Date().toISOString().slice(0, 10), baseline: EST_P, grid: G, summary, rows}) + '\n');
