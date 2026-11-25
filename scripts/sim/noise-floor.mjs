// Step 36 (report-only): lap-time measurement noise σ_meas per series, so definition-of-100 criterion 1 (held-out ≤ 1.2 σ_meas)
// can be checked. Nothing here changes a model, a fit or measured data; it only reads.
//   node scripts/sim/noise-floor.mjs [--ti <TracingInsights raw dir>] [--alkamel <full-lap store>] [--out <dir>]
// σ_meas (central addendum 2026-11-25 §1) = the within-driver spread of near-best laps in one session, after track evolution: push laps
// ≤ 102 % of that driver's session best, minus a per-session linear evolution slope fitted within drivers, residual scaled by √(n/(n−1)),
// robust SD (1.4826 × MAD), in % of the lap. Team-mate / co-driver spread is reported beside it, labelled: it contains driver skill.
// CIs: unit = event (addendum §2), bootstrap of event values, 2000 draws, seed 7. F1 2022 is the LOCKED set and is never read.
import {readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
export const PUSH = 1.02, MAD = 1.4826, SEED = 7, DRAWS = 2000, LOCKED_YEARS = new Set([2022]);
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
export const robustSd = r => MAD * med(r.map(Math.abs));
const rnd = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
// event values → median and 90 % bootstrap interval (unit = event)
export function summary(v) {
  v = v.filter(Number.isFinite); if (!v.length) return {n: 0};
  const r = rnd(SEED), m = []; for (let k = 0; k < DRAWS; k++) m.push(med(v.map(() => v[Math.floor(r() * v.length)])));
  m.sort((a, b) => a - b); const f = x => +x.toFixed(3);
  return {n: v.length, median: f(med(v)), ci90: [f(m[Math.floor(0.05 * DRAWS)]), f(m[Math.floor(0.95 * DRAWS)])]};
}
// laps: [{who, t (session clock, s), y (lap s)}] of one session → residuals in % of each driver's best, after evolution
export function withinDriver(laps, push = PUSH) {
  const by = new Map(); for (const l of laps) if (Number.isFinite(l.y) && Number.isFinite(l.t)) (by.get(l.who) || by.set(l.who, []).get(l.who)).push(l);
  const G = [...by.values()].map(a => { const b = Math.min(...a.map(l => l.y)); return {b, a: a.filter(l => l.y <= push * b)}; }).filter(g => g.a.length >= 2);
  if (G.length < 3) return null;
  let sxy = 0, sxx = 0; for (const {a} of G) { const mt = a.reduce((s, l) => s + l.t, 0) / a.length, my = a.reduce((s, l) => s + l.y, 0) / a.length; for (const l of a) { sxy += (l.t - mt) * (l.y - my); sxx += (l.t - mt) ** 2; } }
  const slope = sxx > 0 ? sxy / sxx : 0, res = [];
  for (const {a, b} of G) { const c = a.map(l => l.y - slope * l.t), m = c.reduce((s, x) => s + x, 0) / c.length, k = Math.sqrt(a.length / (a.length - 1)); for (const x of c) res.push(100 * k * (x - m) / b); }
  return {drivers: G.length, laps: res.length, slopeSPerH: +(slope * 3600).toFixed(3), res};
}
// σ_meas v2 (Project claude/definition-sigma-meas-2026-11-25.md, sha256 7b00840a…, frozen before any v2 number): laps
// [{who (driver, or driver × stint in practice), t (session clock), k (lap in stint, 0 in qualifying), y}] of one session.
// Candidates ≤ 103 % of the group's raw best → one pooled within-group least-squares fit on t and k → corrected laps ≤ (1 + X) × the
// group's corrected best → residual from the group mean × √(n/(n−1)), % of the group's raw best. Null below 3 groups with 2+ laps.
export const X_V2 = 0.015;
export function withinDriverV2(laps, X = X_V2) {
  const by = new Map(); for (const l of laps) if (Number.isFinite(l.y) && Number.isFinite(l.t)) (by.get(l.who) || by.set(l.who, []).get(l.who)).push({...l, k: Number.isFinite(l.k) ? l.k : 0});
  const G = [...by.values()].map(a => { const b = Math.min(...a.map(l => l.y)); return {b, a: a.filter(l => l.y <= 1.03 * b)}; }).filter(g => g.a.length >= 2);
  if (G.length < 3) return null;
  let tt = 0, kk = 0, tk = 0, ty = 0, ky = 0;
  for (const {a} of G) { const m = f => a.reduce((s, l) => s + l[f], 0) / a.length, mt = m('t'), mk = m('k'), my = m('y');
    for (const l of a) { const dt = l.t - mt, dk = l.k - mk, dy = l.y - my; tt += dt * dt; kk += dk * dk; tk += dt * dk; ty += dt * dy; ky += dk * dy; } }
  const det = tt * kk - tk * tk, [bt, bk] = kk > 1e-9 && Math.abs(det) > 1e-9 * tt * kk ? [(ty * kk - ky * tk) / det, (ky * tt - ty * tk) / det] : [tt > 0 ? ty / tt : 0, 0];
  const res = []; let used = 0;
  for (const {a, b} of G) { const c = a.map(l => l.y - bt * l.t - bk * l.k), cb = Math.min(...c), kept = c.filter(x => x <= (1 + X) * cb); if (kept.length < 2) continue;
    used++; const m = kept.reduce((p, q) => p + q, 0) / kept.length, f = Math.sqrt(kept.length / (kept.length - 1)); for (const x of kept) res.push(100 * f * (x - m) / b); }
  return used >= 3 ? {groups: used, laps: res.length, slopeSPerH: +(bt * 3600).toFixed(3), lapInStint: +bk.toFixed(4), res} : null;
}

// best laps of pairs that share a car or team → σ of one entry, Δ² / 2 (contains driver skill: labelled so)
export const pairSigma = groups => { const d = []; for (const g of groups) { const b = g.filter(Number.isFinite).sort((x, y) => x - y); if (b.length >= 2) d.push(100 * (b[1] - b[0]) / b[0]); } return d.length ? {pairs: d.length, sigma: Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length / 2)} : null; };

// ---------- F1: TracingInsights qualifying laps (pinned track-state release asset ti-raw.tgz) ----------
const SLICK = new Set(['SOFT', 'MEDIUM', 'HARD']), num = v => v === 'None' || v == null || !Number.isFinite(+v) ? null : +v;
export function f1(dir, years = [2023, 2024, 2025, 2026]) {
  const ev = [];
  for (const y of years) { if (LOCKED_YEARS.has(y) || !existsSync(join(dir, String(y)))) continue;
    for (const e of readdirSync(join(dir, String(y)))) { const q = join(dir, String(y), e, 'Qualifying'); if (!existsSync(q)) continue;
      const laps = {lap: [], s1: [], s2: [], s3: []}, best = new Map(), team = new Map(); let wet = 0;
      for (const d of readdirSync(q)) { const f = join(q, d, 'laptimes.json'); if (!existsSync(f)) continue; const L = JSON.parse(readFileSync(f, 'utf8'));
        L.time.forEach((x, i) => { if (L.wR?.[i] === true) wet++;
          const y0 = num(x), t = num(L.sesT?.[i]); if (y0 == null || t == null || L.del?.[i] === true || L.iacc?.[i] !== true || L.wR?.[i] === true || !SLICK.has(L.compound?.[i]) || num(L.pout?.[i]) != null || num(L.pin?.[i]) != null) return;
          laps.lap.push({who: d, t, y: y0}); for (const s of ['s1', 's2', 's3']) { const v = num(L[s]?.[i]); if (v != null) laps[s].push({who: d, t, y: v, lap: y0}); }
          if (!(best.get(d) <= y0)) best.set(d, y0); team.set(d, L.team?.[i]); }); }
      if (wet) continue; // a session with rain laps is not a dry noise sample
      const w = withinDriver(laps.lap); if (!w) continue;
      const w2 = withinDriverV2(laps.lap);
      const ideal = d => ['s1', 's2', 's3'].reduce((a, s) => a + Math.min(...laps[s].filter(l => l.who === d).map(l => l.y)), 0), prox = med([...best].map(([d, b]) => 100 * (b / ideal(d) - 1)));
      const pole = Math.min(...best.values()), sec = {};
      for (const s of ['s1', 's2', 's3']) { // sector residuals only on laps that are push laps of the whole lap, in % of the pole lap
        const keep = new Set(laps.lap.filter(l => l.y <= PUSH * best.get(l.who)).map(l => l.who + '|' + l.t)), ws = withinDriver(laps[s].filter(l => keep.has(l.who + '|' + l.t)), Infinity);
        if (ws) sec[s] = robustSd(ws.res) * med(laps[s].filter(l => l.lap === best.get(l.who)).map(l => l.y)) / pole; }
      const teams = new Map(); for (const [d, b] of best) (teams.get(team.get(d)) || teams.set(team.get(d), []).get(team.get(d))).push(b);
      ev.push({event: `${y} ${e}`, pole, bestOverIdealPct: prox, sigmaPctV2: w2 ? robustSd(w2.res) : null, sigmaPct: robustSd(w.res), drivers: w.drivers, laps: w.laps, slopeSPerH: w.slopeSPerH, sectorPctOfLap: sec, teammate: pairSigma([...teams.values()])}); } }
  return {events: ev.length, sigmaPct: summary(ev.map(e => e.sigmaPct)), sigmaPctV2: summary(ev.map(e => e.sigmaPctV2)), sigmaS: summary(ev.map(e => e.sigmaPct * e.pole / 100)),
    sectorPctOfLap: Object.fromEntries(['s1', 's2', 's3'].map(s => [s, summary(ev.map(e => e.sectorPctOfLap[s]))])),
    teammatePct: summary(ev.map(e => e.teammate?.sigma)), bestOverIdealPct: summary(ev.map(e => e.bestOverIdealPct)), perEvent: ev.map(({event, sigmaPct, drivers, laps, slopeSPerH, teammate}) => ({event, sigmaPct: +sigmaPct.toFixed(3), drivers, laps, slopeSPerH, teammatePct: teammate && +teammate.sigma.toFixed(3)}))};
}

// ---------- F1 sector shape diagnostic: model sector shares vs the real pole lap's shares (calibration rows 2023–2026) ----------
// Grip is one scalar per track (fitted to the lap), so the sector SHARES are never fitted: their error is a shape error. Simplified path
// (no zones, PU ramp or banking): the gap of this lap to the fit's stored simLap is reported beside it. Diagnostic only.
export async function f1Sectors() {
  const {lapsimKernel} = await import('../../worker/lapsim/kernel.js'), {lapsimCalibration: C} = await import('../../worker/lapsim/calibration-data.js'), {lapsimTracks} = await import('../../worker/lapsim/tracks-data.js');
  const K = lapsimKernel(), rows = [];
  for (const [y, s] of Object.entries(C.seasons)) { if (LOCKED_YEARS.has(+y) || +y < 2023) continue; const ho = new Set((s.holdout?.tracks || []).map(t => t.track));
    for (const [id, t] of Object.entries(s.tracks)) { if (t.realSectors?.length !== 3 || !lapsimTracks[id]) continue;
      const tr = K.trackFromData(lapsimTracks[id], C.aero), w = t.weather || {};
      const r = K.simulateLap({...tr, mu: Float64Array.from(tr.mu, m => m * (t.grip || 1))}, s.car, K.conditionsFromWeather({pressureHpa: w.pressureHpa ?? 1013.25, airTempC: w.airTempC ?? 25, humidityPct: w.humidityPct ?? 50, trackTempC: w.trackTempC ?? 35, windSpeed: 0, windFromDeg: 0}));
      if (!r.sectors) continue; const real = t.realSectors.reduce((a, b) => a + b, 0);
      rows.push({event: `${y} ${id}`, heldOut: ho.has(id), lapGapPct: 100 * (r.lapTime / t.simLap - 1), e: r.sectors.map((x, i) => 100 * (x / r.lapTime - t.realSectors[i] / real))}); } }
  const rmsOf = (R, i) => R.length ? +Math.sqrt(R.reduce((a, r) => a + r.e[i] ** 2, 0) / R.length).toFixed(3) : null, f = R => ({n: R.length, rmsSharePctOfLap: [0, 1, 2].map(i => rmsOf(R, i))});
  return {note: 'share error = (model sector ÷ model lap − real sector ÷ real lap) × 100, % of lap; compare with the F1 sector σ_meas', all: f(rows), heldOut: f(rows.filter(r => r.heldOut)),
    lapGapToFitPct: summary(rows.map(r => Math.abs(r.lapGapPct))), perEvent: rows.map(r => ({...r, lapGapPct: +r.lapGapPct.toFixed(2), e: r.e.map(v => +v.toFixed(3))}))};
}

// ---------- Formula E: duel rounds = the same driver's repeated qualifying laps (fe-duels.csv); team-mates from fe-cars.csv.gz ----------
const csv = f => { const t = (f.endsWith('.gz') ? gunzipSync(readFileSync(f)).toString() : readFileSync(f, 'utf8')).trim().split('\n'), split = l => { const o = []; let s = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { o.push(s); s = ''; } else s += c; } o.push(s); return o; }, h = split(t[0]); return t.slice(1).map(l => { const a = split(l); return Object.fromEntries(h.map((k, i) => [k, a[i]])); }); };
export function fe(dir = 'scripts/sim/data/learn') {
  const D = csv(join(dir, 'fe-duels.csv')).filter(r => !(+r.rainShare > 0.02)), byEv = new Map();
  for (const r of D) (byEv.get(r.season + ' ' + r.event) || byEv.set(r.season + ' ' + r.event, []).get(r.season + ' ' + r.event)).push(r);
  const ev = []; for (const [e, R] of byEv) { const rm = new Map(); for (const s of new Set(R.map(r => r.session))) rm.set(s, med(R.filter(r => r.session === s).map(r => +r.best)));
    // round order = track evolution: a lap is taken relative to its round's median (no session clock in the duel table)
    const by = new Map(); for (const r of R) (by.get(r.driver) || by.set(r.driver, []).get(r.driver)).push(+r.best - rm.get(r.session));
    const res = []; for (const a of by.values()) if (a.length >= 2) { const m = a.reduce((s, x) => s + x, 0) / a.length, k = Math.sqrt(a.length / (a.length - 1)); for (const x of a) res.push(100 * k * (x - m) / med(R.map(r => +r.best))); }
    const em = med(R.map(r => +r.best)), w2 = withinDriverV2(R.map(r => ({who: r.driver, t: 0, k: 0, y: +r.best - rm.get(r.session) + em})));
    if (res.length >= 4 || w2) ev.push({event: e, sigmaPct: res.length >= 4 ? robustSd(res) : null, sigmaPctV2: w2 ? robustSd(w2.res) : null, laps: res.length}); }
  const C = csv(join(dir, 'fe-cars.csv.gz')).filter(r => r.type === 'Q' && r.season >= 2025 && !(+r.rainShare > 0.02)), tm = new Map();
  for (const r of C) { const k = r.season + ' ' + r.event, t = (tm.get(k) || tm.set(k, new Map()).get(k)); const a = t.get(r.team) || t.set(r.team, new Map()).get(r.team); a.set(r.entry, Math.min(a.get(r.entry) ?? Infinity, +r.best)); }
  return {note: 'within-driver = duel rounds (QF/SF/F) of one driver, each lap relative to its round median; few laps per event', events: ev.length, sigmaPct: summary(ev.map(e => e.sigmaPct)), sigmaPctV2: summary(ev.map(e => e.sigmaPctV2)),
    teammatePct: summary([...tm.values()].map(t => pairSigma([...t.values()].map(m => [...m.values()]))?.sigma)), perEvent: ev.map(e => ({...e, sigmaPct: +e.sigmaPct.toFixed(3)}))};
}

// ---------- NLS / N24: per-driver bests per car and session (nls-laps.json.gz); no per-lap rows stored ----------
export function nls(dir = 'scripts/sim/data/learn') {
  const R = JSON.parse(gunzipSync(readFileSync(join(dir, 'nls-laps.json.gz')))).rows, out = {};
  // rating filter (addendum §3): SP9 PRO = Platinum/Gold line-ups; SP9 PRO-AM and 'SP 9' (older, unsplit) reported apart
  for (const [name, re] of [['SP9 PRO', /^SP9 PRO$/], ['SP9 PRO-AM', /^SP9 PRO-AM$/], ['SP9 all', /^SP ?9/]]) {
    const ev = new Map(); for (const r of R.filter(r => re.test(r.cls || '') && r.kind === 'qualifying')) { const k = r.season + ' ' + r.event; (ev.get(k) || ev.set(k, []).get(k)).push(r); }
    const co = [...ev.values()].map(rs => pairSigma(rs.map(r => (r.drivers || []).map(d => d.best))) ?.sigma), pr = [...ev.values()].map(rs => med(rs.filter(r => r.cleanMedian && r.best).map(r => 100 * (r.cleanMedian / r.best - 1))));
    out[name] = {events: ev.size, codriverPct: summary(co), cleanMedianOverBestPct: summary(pr)}; }
  return {note: 'no per-lap rows are stored for NLS: within-driver σ is not measurable here. codriver = best laps of drivers sharing one car (contains driver skill); cleanMedianOverBest = car median of clean laps ÷ best − 1 (traffic, fuel and driver change: an upper bound)', ...out};
}

// ---------- Al Kamel full laps (WEC, ELMS, IMSA; draft release asset data-alkamel-full-laps): practice and qualifying ----------
const GROUP = c => /HYPERCAR|GTP|LMH|LMDH/i.test(c) ? 'proto' : /^LMP2/i.test(c) ? 'lmp2' : /LMGT3|GTD|^GT3$/i.test(c) ? 'gt3' : null;
export async function alkamel(store) {
  if (!store || !existsSync(store)) return {note: 'full-lap store not present in this run (the release asset is a draft on the fork): not measured'};
  const {sessions, readSession} = await import('./learn/alkamel-full-laps.mjs'), rat = JSON.parse(gunzipSync(readFileSync('scripts/sim/data/learn/driver-ratings.json.gz'))).drivers;
  const key = s => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''), rating = new Map();
  for (const d of Object.values(rat)) for (const [y, v] of Object.entries(d.seasons || {})) rating.set(key(v.name || d.name) + '|' + y, v.rating);
  const ev = new Map(), pro = r => /^[PG]$/.test(r) ? 'PG' : /^[SB]$/.test(r) ? 'SB' : 'unknown';
  for (const s of sessions(undefined, f => f.kind === 'practice' || f.kind === 'qualifying')) {
    let laps; try { laps = readSession(s, store); } catch { continue; }
    if (laps.some(l => l.rain)) continue;
    for (const g of ['proto', 'lmp2', 'gt3']) { const L = laps.filter(l => GROUP(l.cls || '') === g && Number.isFinite(l.time) && !l.pitIn && !l.pitOut && /^(GF|GREEN|FF|FINISH)?$/i.test(l.flag || ''));
      for (const band of ['all', 'PG', 'SB']) { const sel = band === 'all' ? L : L.filter(l => pro(rating.get(key(l.driver) + '|' + s.season)) === band);
        const w = withinDriver(sel.map(l => ({who: l.car + '|' + l.driverNumber, t: l.elapsed, y: l.time}))); if (!w) continue;
        const k = [s.series, s.season, s.event, g, band].join('|'); (ev.get(k) || ev.set(k, []).get(k)).push(...w.res); }
      // v2: qualifying = driver groups on the session clock; practice = driver × stint groups with lap-in-stint as a covariate
      const q = s.kind === 'qualifying', w2 = withinDriverV2(L.map(l => ({who: l.car + '|' + l.driverNumber + (q ? '' : '|' + l.stint), t: l.elapsed, k: q ? 0 : l.stintLap, y: l.time})));
      if (w2) { const k = [s.series, s.season, s.event, g, q ? 'v2q' : 'v2p'].join('|'); (ev.get(k) || ev.set(k, []).get(k)).push(...w2.res); } }
    for (const g of ['proto', 'gt3']) { const cars = new Map(); for (const l of laps.filter(l => GROUP(l.cls || '') === g && Number.isFinite(l.time) && !l.pitIn && !l.pitOut)) { const c = cars.get(l.car) || cars.set(l.car, new Map()).get(l.car); c.set(l.driverNumber, Math.min(c.get(l.driverNumber) ?? Infinity, l.time)); }
      const p = pairSigma([...cars.values()].map(m => [...m.values()])); if (p) { const k = [s.series, s.season, s.event, g, 'codriver'].join('|'); (ev.get(k) || ev.set(k, []).get(k)).push(p.sigma); } } }
  const out = {}; for (const ser of ['wec', 'elms', 'imsa']) for (const g of ['proto', 'lmp2', 'gt3']) for (const band of ['all', 'PG', 'SB', 'codriver']) {
    const v = [...ev].filter(([k]) => { const q = k.split('|'); return q[0] === ser && q[3] === g && q[4] === band; }).map(([, r]) => band === 'codriver' ? med(r) : robustSd(r));
    if (v.length) out[`${ser} ${g} ${band}`] = summary(v); }
  // v2 per event: qualifying when it gave a value (3+ groups with 2+ near-best laps), else practice (definition rule 1)
  for (const ser of ['wec', 'elms', 'imsa']) for (const g of ['proto', 'lmp2', 'gt3']) {
    const evs = new Set([...ev.keys()].map(k => k.split('|')).filter(q => q[0] === ser && q[3] === g && /^v2/.test(q[4])).map(q => q.slice(0, 4).join('|'))), v = [], src = {qualifying: 0, practice: 0};
    for (const e of evs) { const r = ev.get(e + '|v2q') || ev.get(e + '|v2p'); src[ev.has(e + '|v2q') ? 'qualifying' : 'practice']++; v.push(robustSd(r)); }
    if (v.length) out[`${ser} ${g} v2`] = {...summary(v), source: src}; }
  return {note: 'within-driver σ per event (practice + qualifying, dry, green, no pit laps); bands by FIA rating of the lap\'s driver (driver-ratings.json.gz, name match): PG Platinum/Gold, SB Silver/Bronze; codriver = best laps of drivers of one car (contains skill)', ...out};
}

// ---------- WEC / IMSA / ELMS / Asian LMS without lap files: best ÷ ideal (own best sectors) − 1 per car-session (endurance-cars.csv.gz) ----------
// A one-sided proxy. σ_meas is estimated by the F1 ratio σ ÷ proxy measured on the same quantities (assumption: the ratio transfers).
export function idealProxy(dir = 'scripts/sim/data/learn') {
  const G = c => /^(HYPERCAR|GTP)$/.test(c) ? 'proto' : /^(GTD|GTDPRO|LMGT3)$/.test(c) ? 'gt3' : /^LMP2/.test(c) ? 'lmp2' : null, ev = new Map();
  for (const r of csv(join(dir, 'endurance-cars.csv.gz'))) { const g = G(r.cls); if (!g || !['P', 'Q'].includes(r.type) || !(+r.ideal > 0) || !(+r.best > 0) || +r.rainShare > 0.02) continue;
    const k = `${r.series} ${g}|${r.season} ${r.event}`; (ev.get(k) || ev.set(k, []).get(k)).push(100 * (+r.best / +r.ideal - 1)); }
  const out = {}; for (const k of new Set([...ev.keys()].map(k => k.split('|')[0]))) out[k] = summary([...ev].filter(([q]) => q.startsWith(k + '|')).map(([, a]) => med(a)));
  return {note: 'best ÷ sum of own best sectors − 1, % (dry FP + Q, event median); a one-sided proxy, not σ_meas', ...out};
}

// ---------- per-lap files of other series (step 36 round 3: NLS wige PDFs, Al Kamel USAC = SRO GT World Challenge America / IGTC,
// Asian LMS): {sessions: [{series, season, event, session, kind, laps: [{who, cls, clock, stint, k, y, pit, deleted, flag, rain}]}]} ----------
const LAP_CLASS = (series, cls) => series === 'nls' ? (/^SP ?9/i.test(cls || '') ? 'gt3' : null)
  : /GT4|TCX|GTC|CUP|LMP3/i.test(cls || '') ? null : /LMP2/i.test(cls || '') ? 'lmp2' : 'gt3';
export function lapFiles(files) {
  const ev = new Map();
  for (const f of files) for (const s of JSON.parse(gunzipSync(readFileSync(f))).sessions) {
    if (!/practice|qualifying/.test(s.kind) || s.rain || s.laps.some(l => l.rain)) continue;
    const q = s.kind === 'qualifying', by = new Map();
    for (const l of s.laps) { const c = LAP_CLASS(s.series, l.cls); if (!c || l.pit || l.deleted || !Number.isFinite(l.y) || !/^(GF|GREEN|FF|FINISH)?$/i.test(l.flag || '')) continue; (by.get(c) || by.set(c, []).get(c)).push(l); }
    for (const [c, L] of by) { const w = withinDriverV2(L.map(l => ({who: l.who + (q ? '' : '|' + l.stint), t: l.clock, k: q ? 0 : l.k, y: l.y}))); if (!w) continue;
      const k = [s.series, c, s.season + ' ' + s.event].join('|'), e = ev.get(k) || ev.set(k, {q: [], p: []}).get(k); e[q ? 'q' : 'p'].push(...w.res); } }
  const out = {}; for (const key of new Set([...ev.keys()].map(k => k.split('|').slice(0, 2).join('|')))) {
    const src = {qualifying: 0, practice: 0}, v = [...ev].filter(([k]) => k.startsWith(key + '|')).map(([, e]) => { src[e.q.length ? 'qualifying' : 'practice']++; return robustSd(e.q.length ? e.q : e.p); });
    out[key.replace('|', ' ') + ' v2'] = {...summary(v), source: src}; }
  return {note: 'σ_meas v2 from per-lap files (definition doc v2); NLS clock = the car\'s running sum of lap times; classes: NLS SP9, other series every class except GT4/TCX/GTC/Cup/LMP3', ...out};
}

// ---------- GT3 BoP Δ split-half noise per BoP body (as step 21 v2): class-relative model level per event, sessions alternate A/B ----------
export function gt3Bop(dir = 'scripts/sim/data/learn') {
  const rows = [...csv(join(dir, 'endurance-cars.csv.gz')), ...csv(join(dir, 't71-gt3-cars.csv.gz')), ...csv(join(dir, 'sro-gt3-cars.csv.gz'))]
    .filter(r => ['P', 'Q'].includes(r.type) && +r.best > 20 && !(+r.rainShare > 0.02) && /GT3|GTD|LMGT3|^GT$|Pro|Silver|Bronze|Gold|Am/i.test(r.cls) && !/GT4|GTC|CUP|GTE|LMP|GTP|HYPER/i.test(r.cls + ' ' + r.vehicle));
  const body = s => s === 'imsa' ? 'imsa' : /^(wec|elms|alms)$/.test(s) ? 'aco' : s === 'dtm' ? 'dtm' : /^(gtwc|britishgt)$|gtworldch|24-hours-of-spa|intercontinental/.test(s) ? 'sro' : null;
  const mod = v => String(v).toLowerCase().replace(/[^a-z0-9]/g, ''), ev = new Map();
  for (const r of rows) { const b = body(r.series); if (!b) continue; const k = [b, r.season, r.event].join('|'), e = ev.get(k) || ev.set(k, new Map()).get(k); (e.get(r.session) || e.set(r.session, []).get(r.session)).push({m: mod(r.vehicle), t: +r.best}); }
  const d = {sro: [], imsa: [], aco: [], dtm: []}, evD = {sro: [], imsa: [], aco: [], dtm: []};
  for (const [k, S] of ev) { const b = k.split('|')[0], ss = [...S.keys()].sort(); if (ss.length < 2) continue;
    // half value of a model: mean over its cars' bests in that half; class-relative = minus the mean of the other models
    const half = h => { const m = new Map(); ss.forEach((s, i) => { if (i % 2 !== h) return;
        const top = Math.min(...S.get(s).map(r => r.t)); for (const {m: x, t} of S.get(s)) if (t <= 1.03 * top) (m.get(x) || m.set(x, []).get(x)).push(t); }); return new Map([...m].map(([x, a]) => [x, a.reduce((p, q) => p + q, 0) / a.length])); };
    const A = half(0), B = half(1), M = [...A.keys()].filter(x => B.has(x)); if (M.length < 3) continue;
    const rel = (H, x) => H.get(x) - M.filter(y => y !== x).reduce((p, y) => p + H.get(y), 0) / (M.length - 1), dd = M.map(x => rel(A, x) - rel(B, x));
    d[b].push(...dd); evD[b].push(Math.sqrt(dd.reduce((p, q) => p + q * q, 0) / dd.length) / 2); }
  const out = {}; for (const b of Object.keys(d)) { const s = d[b].length ? Math.sqrt(d[b].reduce((p, q) => p + q * q, 0) / d[b].length) / 2 : null;
    // a year-to-year BoP Δ is the difference of two event levels: σ_Δ = √2 σ_level
    out[b] = {cases: d[b].length, sigmaLevelS: s && +s.toFixed(3), sigmaDeltaS: s && +(Math.SQRT2 * s).toFixed(3), robustSigmaDeltaS: s && +(Math.SQRT2 * med(d[b].map(Math.abs)) / 0.6745 / 2).toFixed(3), perEventLevelS: summary(evD[b]), dataLimit: s == null ? null : Math.SQRT2 * s > 0.1}; }
  return {note: 'split-half (step 21 v2 rule): dry FP + Q sessions of one event alternate A/B in session order; model half value = mean best of its cars within 103 % of the session top; class-relative to the mean of the other models; σ_level = √mean(d²)/2, σ_Δ = √2 σ_level; data limit when σ_Δ > 0.1 s. Model key = vehicle string (D4). SRO and DTM tables carry no weather: their wet sessions cannot be dropped (robust σ given beside). Rating filter: none (a BoP level is a whole-field quantity; per-car line-ups differ by class).', ...out};
}

// content pin (central 2026-11-25): every manifest file present with the sha256 of its raw bytes; the tarball hash is not the pin
export function checkAlkamel(store, manifest = 'scripts/sim/data/learn/alkamel-full-laps-manifest.json') {
  const files = JSON.parse(readFileSync(manifest, 'utf8')).files, bad = files.filter(f => !existsSync(join(store, f.path)) || createHash('sha256').update(gunzipSync(readFileSync(join(store, f.path)))).digest('hex') !== f.sha256);
  return {files: files.length, ok: files.length - bad.length, bad: bad.map(f => f.path)};
}
if (process.argv[1]?.endsWith('noise-floor.mjs')) {
  if (arg('--check-alkamel')) { const c = checkAlkamel(arg('--check-alkamel')); console.log(`Al Kamel content check: ${c.ok}/${c.files} files match the manifest sha256`); if (c.bad.length) { console.error(c.bad.slice(0, 20).join('\n')); process.exit(1); } process.exit(0); }
  const out = arg('--out', 'out/noise'), ti = arg('--ti'); mkdirSync(out, {recursive: true});
  const res = {generated: new Date().toISOString(), definition: 'σ_meas = within-driver robust SD of push laps (≤102 % of own best) in one session after a linear evolution slope; % of lap; median over events, 90 % CI by event bootstrap (seed 7)',
    f1: ti ? f1(ti) : {note: 'no --ti: not measured'}, f1Sectors: await f1Sectors(), fe: fe(), nls: nls(), alkamel: await alkamel(arg('--alkamel')), idealProxy: idealProxy(), lapFiles: lapFiles(process.argv.flatMap((a, i) => a === '--laps' ? [process.argv[i + 1]] : []).filter(f => existsSync(f))), gt3Bop: gt3Bop()};
  writeFileSync(join(out, 'noise-floor.json'), JSON.stringify(res, null, 1));
  const line = (n, s) => s?.n ? `| ${n} | ${s.median} | ${s.ci90.join(' – ')} | ${s.n} |` : `| ${n} | – | – | 0 |`, L = ['| Quantity | median | 90 % CI | events |', '|---|---|---|---|'];
  if (res.f1.sigmaPct) L.push(line('F1 within-driver σ v1 (% lap)', res.f1.sigmaPct), line('F1 within-driver σ v2 (% lap)', res.f1.sigmaPctV2), line('F1 within-driver σ (s)', res.f1.sigmaS), ...['s1', 's2', 's3'].map(s => line(`F1 ${s} σ (% lap)`, res.f1.sectorPctOfLap[s])), line('F1 team-mate σ (% lap, contains skill)', res.f1.teammatePct));
  L.push(line('F1 best ÷ ideal − 1 (%, proxy)', res.f1.bestOverIdealPct));
  for (const [k, v] of Object.entries(res.idealProxy)) if (v?.n) L.push(line(`${k} best ÷ ideal − 1 (%, proxy)`, v));
  L.push(`| F1 sector share error RMS s1/s2/s3 (% lap, diagnostic; held-out n ${res.f1Sectors.heldOut.n}) | ${res.f1Sectors.heldOut.rmsSharePctOfLap.join(' / ')} | all n ${res.f1Sectors.all.n}: ${res.f1Sectors.all.rmsSharePctOfLap.join(' / ')} | – |`);
  L.push(line('FE within-driver σ v1 (duels, % lap)', res.fe.sigmaPct), line('FE within-driver σ v2 (duels, % lap)', res.fe.sigmaPctV2), line('FE team-mate σ (% lap, contains skill)', res.fe.teammatePct));
  for (const k of ['SP9 PRO', 'SP9 PRO-AM', 'SP9 all']) L.push(line(`NLS ${k} co-driver σ (% lap, contains skill)`, res.nls[k].codriverPct), line(`NLS ${k} clean median ÷ best − 1 (%)`, res.nls[k].cleanMedianOverBestPct));
  for (const [k, v] of Object.entries(res.lapFiles)) if (v?.n) L.push(line(`${k} (q ${v.source.qualifying} / p ${v.source.practice}) (% lap)`, v));
  for (const [k, v] of Object.entries(res.alkamel)) if (v?.n) L.push(line(`Al Kamel ${k}${/v2$/.test(k) ? ` (q ${v.source.qualifying} / p ${v.source.practice})` : / (all|PG|SB)$/.test(k) ? ' v1' : ''} (% lap)`, v));
  L.push('', '| BoP body | cases | σ_level (s) | σ_Δ (s) | robust σ_Δ (s) | data limit (> 0.1 s) |', '|---|---|---|---|---|---|', ...Object.entries(res.gt3Bop).filter(([k]) => k !== 'note').map(([b, v]) => `| ${b} | ${v.cases} | ${v.sigmaLevelS ?? '–'} | ${v.sigmaDeltaS ?? '–'} | ${v.robustSigmaDeltaS ?? '–'} | ${v.dataLimit ?? '–'} |`));
  writeFileSync(join(out, 'noise-floor.md'), L.join('\n') + '\n'); console.log(L.join('\n'));
}
