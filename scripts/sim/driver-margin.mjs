// Step 11a (phase a, measurement only; pre-registration claude/gate-driver-margin-prereg-2026-11-23.md): how much of the best driver's
// corner performance F1 drivers use, per corner type and phase, from real TracingInsights qualifying telemetry (not the kernel).
//   brake = peak deceleration before the apex, apex = minimum speed, exit = speed at apex + 60 m (integrated distance).
//   envelope = the best driver's value at that corner, season and track; margin = value / envelope. This is the margin to the best
//   driver, NOT to the car's physical limit.
// In: TracingInsights season repos (sparse clone with Qualifying laptimes.json + corners.json, LAPSIM_TI_DIR) and lap telemetry
// (raw.githubusercontent, cached in .cache/ti-tel, same cache as measure-car). Measured data is only read.
// Out: scripts/sim/data/learn/driver-margin.json. Run: node scripts/sim/driver-margin.mjs
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const num = x => x === 'None' || x == null ? NaN : +x;
const isOn = b => b === true || +b > 0;

// frozen telemetry mask, rules C and D (claude/ti-frozen-scan-2025-2026; same as the step-2a / I2 frozenMask), ± 1 sample
export function frozenMask(T) {
  const n = T.speed.length, bad = new Uint8Array(n), same = i => T.speed[i] === T.speed[i - 1] && T.rpm[i] === T.rpm[i - 1];
  const all5 = i => same(i) && T.gear[i] === T.gear[i - 1] && T.throttle[i] === T.throttle[i - 1] && T.brake[i] === T.brake[i - 1];
  const mark = (a, b) => { for (let k = Math.max(0, a - 1); k <= Math.min(n - 1, b + 1); k++) bad[k] = 1; };
  for (let i = 1; i < n;) { // C: speed and rpm repeat on 4+ samples
    if (!same(i)) { i++; continue; } let j = i; while (j + 1 < n && same(j + 1)) j++;
    if (j - (i - 1) + 1 >= 4) mark(i - 1, j); i = j + 1;
  }
  for (let i = 1; i < n;) { // D: all five channels repeat for 1.5 s or more at 5 km/h or more
    if (!all5(i)) { i++; continue; } let j = i; while (j + 1 < n && all5(j + 1)) j++;
    if (+T.time[j] - +T.time[i - 1] >= 1.5 && +T.speed[i - 1] >= 5) mark(i - 1, j); i = j + 1;
  }
  for (let i = 0; i < n; i++) if (+T.throttle[i] > 100) bad[i] = 1;
  return bad;
}

// one lap in SI units with distance integrated from speed over time (trapezoid)
export function lapFrom(T, bad = frozenMask(T), pick = null) {
  const idx = pick || T.speed.map((_, i) => i), t = idx.map(i => +T.time[i]), v = idx.map(i => +T.speed[i] / 3.6);
  const s = [0]; for (let k = 1; k < t.length; k++) s.push(s[k - 1] + (v[k] + v[k - 1]) / 2 * Math.max(0, t[k] - t[k - 1]));
  return {t, v, s, brake: idx.map(i => isOn(T.brake[i])), bad: idx.map(i => bad[i])};
}

// deceleration at sample i: −slope of a linear fit of v on t over ± w s, unmasked samples only (≥ 3)
function decel(L, i, w) {
  let n = 0, st = 0, sv = 0, stt = 0, stv = 0;
  for (let k = i; k >= 0 && L.t[i] - L.t[k] <= w; k--) if (!L.bad[k]) { n++; st += L.t[k]; sv += L.v[k]; stt += L.t[k] ** 2; stv += L.t[k] * L.v[k]; }
  for (let k = i + 1; k < L.t.length && L.t[k] - L.t[i] <= w; k++) if (!L.bad[k]) { n++; st += L.t[k]; sv += L.v[k]; stt += L.t[k] ** 2; stv += L.t[k] * L.v[k]; }
  const d = n * stt - st * st; return n >= 3 && d > 1e-12 ? -(n * stv - st * sv) / d : NaN;
}
const vAtS = (L, x) => { let k = 1; while (k < L.s.length && L.s[k] < x) k++; if (k >= L.s.length) return NaN; const f = (x - L.s[k - 1]) / Math.max(1e-9, L.s[k] - L.s[k - 1]); return L.v[k - 1] + f * (L.v[k] - L.v[k - 1]); };
const maskedIn = (L, a, b) => { for (let k = 0; k < L.s.length; k++) if (L.bad[k] && L.s[k] >= a && L.s[k] <= b) return true; return false; };

// phases of every corner on one lap. corners: [{key, f}] with f = share of the lap (sorted). Values in m/s and m/s².
export function pickPhases(L, corners, {exitM = 60, win = 0.25, margin = 150} = {}) {
  const len = L.s.at(-1), pos = corners.map(c => c.f * len), out = [];
  let prevApex = -Infinity;
  for (let c = 0; c < corners.length; c++) {
    const a = c ? (pos[c - 1] + pos[c]) / 2 : 0, b = c + 1 < pos.length ? (pos[c] + pos[c + 1]) / 2 : len;
    const lo = Math.max(a, pos[c] - 250), hi = Math.min(b, pos[c] + 250);
    const ix = []; for (let k = 0; k < L.s.length; k++) if (L.s[k] >= lo && L.s[k] <= hi) ix.push(k);
    if (ix.length < 3) continue;
    let ap = ix[0]; for (const k of ix) if (L.v[k] < L.v[ap]) ap = k;
    const before = ix.filter(k => k <= ap), vmaxW = Math.max(...before.map(k => L.v[k]));
    if (ap === ix[0] || ap === ix.at(-1) || vmaxW - L.v[ap] < 10 / 3.6) continue; // edge or flat corner
    const r = {key: corners[c].key, apexS: L.s[ap], apex: null, brake: null, exit: null};
    if (!maskedIn(L, lo - margin, hi + margin)) r.apex = L.v[ap];
    // brake: from the last speed maximum before the apex (≤ 600 m back, not past the previous apex) to the apex
    let k0 = ap; for (let k = ap; k >= 0 && L.s[ap] - L.s[k] <= 600 && L.s[k] > prevApex; k--) if (L.v[k] > L.v[k0]) k0 = k;
    if (L.brake.slice(k0, ap + 1).some(Boolean) && !maskedIn(L, L.s[k0] - margin, L.s[ap] + margin)) {
      let pk = -Infinity; for (let k = k0; k <= ap; k++) if (!L.bad[k]) { const d = decel(L, k, win); if (d > pk) pk = d; }
      if (Number.isFinite(pk) && pk > 0) r.brake = pk;
    }
    const xe = L.s[ap] + exitM; if (xe < len && !maskedIn(L, L.s[ap] - margin, xe + margin)) r.exit = vAtS(L, xe);
    prevApex = L.s[ap];
    out.push(r);
  }
  return out;
}

// envelope per corner: the best value (or the top-3 mean); margins value / envelope. rows: [{drv, value}]
export function margins(rows, {env = 'max', minN = 5} = {}) {
  const ok = rows.filter(r => Number.isFinite(r.value) && r.value > 0);
  if (ok.length < minN) return null;
  const s = ok.map(r => r.value).sort((x, y) => y - x), E = env === 'top3' ? (s[0] + s[1] + s[2]) / 3 : s[0];
  return ok.map(r => ({drv: r.drv, m: r.value / E}));
}

// weighted quantile; vals [{x, w}]
function wq(vals, q) {
  const s = [...vals].sort((a, b) => a.x - b.x), W = s.reduce((a, v) => a + v.w, 0); let c = 0;
  for (const v of s) { c += v.w; if (c >= q * W) return v.x; } return s.at(-1)?.x;
}
function rng(seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
// cell stats: byTrack {track: [margins]}, equal weight per track; bootstrap tracks for the median
export function cellStats(byTrack, {B = 2000, seed = 11} = {}) {
  const tr = Object.keys(byTrack).filter(k => byTrack[k].length); if (!tr.length) return null;
  const pool = ids => ids.flatMap(k => byTrack[k].map(x => ({x, w: 1 / byTrack[k].length})));
  const P = pool(tr), r = rng(seed), meds = [];
  for (let b = 0; b < B; b++) meds.push(wq(pool(tr.map(() => tr[Math.floor(r() * tr.length)])), 0.5));
  meds.sort((a, b) => a - b);
  return {tracks: tr.length, n: P.length, median: wq(P, 0.5), p10: wq(P, 0.1), p90: wq(P, 0.9), ci90: [meds[Math.floor(0.05 * B)], meds[Math.floor(0.95 * B)]]};
}
// expected maximum of n standard normals (Monte Carlo, fixed seed)
export function eMaxNormal(n, draws = 20000) {
  const r = rng(7); let s = 0;
  for (let d = 0; d < draws; d++) { let m = -Infinity; for (let i = 0; i < n; i++) { const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); if (z > m) m = z; } s += m; }
  return s / draws;
}

// ---------------------------------------------------------------- main
async function main() {
  const R = new URL('../../', import.meta.url);
  const {lapsimTracks} = await import(new URL('worker/lapsim/tracks-data.js', R));
  const {lapsimTrackView} = await import(new URL('worker/lapsim/track-view-data.js', R));
  const {lapsimCornerNumbers} = await import(new URL('worker/lapsim/corner-numbers-data.js', R));
  const {tiTrack} = await import(new URL('scripts/sim/ti-races.mjs', R));
  const ROOT = process.env.LAPSIM_TI_DIR || '.cache/ti', CACHE = process.env.LAPSIM_TI_TEL || '.cache/ti-tel', YEARS = ['2023', '2024', '2025', '2026'];
  const PHASES = ['brake', 'apex', 'exit'], TYPES = ['slow', 'medium', 'fast'], GROUPS = ['pole', 'top5', 'field'];
  const typeOf = kph => kph < 120 ? 'slow' : kph <= 200 ? 'medium' : 'fast';
  // the site's corner list (worker/simulation.js order): track corners, else track-view corners, else corner-numbers-data
  const siteCorners = id => { const td = lapsimTracks[id]; return td.corners?.length ? td.corners : lapsimTrackView?.[id]?.corners?.length ? lapsimTrackView[id].corners : lapsimCornerNumbers[id]?.corners || null; };

  // 1. picks: fastest timed dry lap per driver (not deleted, no pit in/out, no rain flag); session dropped at >= 10 % rain laps
  const sessions = [], dropped = {layout: [], wet: [], noCorners: []};
  for (const y of YEARS) {
    const dir = join(ROOT, y); if (!existsSync(dir)) continue;
    for (const ev of readdirSync(dir).filter(e => /Grand Prix$/.test(e)).sort()) {
      const q = join(dir, ev, 'Qualifying'); if (!existsSync(q)) continue;
      const track = tiTrack(ev, +y); if (!lapsimTracks[track]) continue;
      const sc = siteCorners(track); if (!sc?.length) { dropped.noCorners.push(`${y} ${track}`); continue; }
      let n = 0, wet = 0; const laps = [];
      for (const drv of readdirSync(q).filter(x => /^[A-Z]{3}$/.test(x))) {
        const f = join(q, drv, 'laptimes.json'); if (!existsSync(f)) continue;
        const L = JSON.parse(readFileSync(f, 'utf8')); let best = null;
        for (let i = 0; i < L.time.length; i++) {
          n++; if (L.wR?.[i] === true) wet++;
          const t = num(L.time[i]);
          if (!Number.isFinite(t) || L.del?.[i] === true || L.pin?.[i] !== 'None' || L.pout?.[i] !== 'None' || L.wR?.[i] === true) continue;
          if (!best || t < best.time) best = {year: y, ev, track, drv, lap: L.lap[i], time: t};
        }
        if (best) laps.push(best);
      }
      if (!n || wet / n >= 0.1) { dropped.wet.push(`${y} ${track}`); continue; }
      // layout check against this session's FastF1 corners.json
      let ff = null; try { ff = JSON.parse(readFileSync(join(q, 'corners.json'), 'utf8')); } catch {}
      if (ff?.CornerNumber && ff.CornerNumber.length !== sc.length) { dropped.layout.push(`${y} ${track} (site ${sc.length}, session ${ff.CornerNumber.length})`); continue; }
      laps.sort((a, b) => a.time - b.time);
      sessions.push({year: y, ev, track, laps, ff, sc});
    }
  }
  // 2. telemetry (cache shared with measure-car), fetched 12 at a time
  const exec = promisify(execFile), file = p => join(CACHE, p.year, `${p.ev}_${p.drv}_${p.lap}.json`.replace(/ /g, '_'));
  const all = sessions.flatMap(s => s.laps), todo = all.filter(p => !existsSync(file(p)));
  for (let i = 0; i < todo.length; i += 12) await Promise.all(todo.slice(i, i + 12).map(async p => {
    const url = `https://raw.githubusercontent.com/TracingInsights/${p.year}/main/${[p.ev, 'Qualifying', p.drv, p.lap + '_tel.json'].map(encodeURIComponent).join('/')}`;
    try { const {stdout} = await exec('curl', ['-sSf', '--max-time', '60', url], {maxBuffer: 1 << 26}); mkdirSync(dirname(file(p)), {recursive: true}); writeFileSync(file(p), stdout); } catch {}
  }));
  const tel = p => { try { const r = JSON.parse(readFileSync(file(p), 'utf8')); const T = r.tel || r; return T?.speed?.length > 100 ? T : null; } catch { return null; } };

  // 3. phases per lap, for the base options and the systematic rows
  const OPTS = {base: {}, exit40: {exitM: 40}, exit80: {exitM: 80}, win20: {win: 0.2}, win35: {win: 0.35}};
  const counts = {sessions: sessions.length, picked: all.length, withTel: 0, droppedMasked: 0, cornersDroppedPos: 0}, dt = [], dsx = [];
  const rows = Object.fromEntries(Object.keys(OPTS).map(k => [k, []])), half = []; // rows: {year, track, ck, drv, rank, phase, value}
  for (const S of sessions) {
    const trackLen = lapsimTracks[S.track].length, ffLen = [];
    const laps = S.laps.map((p, rank) => ({p, rank, T: tel(p)})).filter(x => x.T);
    for (const x of laps) { x.bad = frozenMask(x.T); x.L = lapFrom(x.T, x.bad); ffLen.push(x.L.s.at(-1)); }
    const Lref = [...ffLen].sort((a, b) => a - b)[ffLen.length >> 1];
    // corners as share of the lap; drop those > 80 m from their FastF1 position
    const corners = S.sc.map((c, i) => ({key: `${c.number}${c.letter || ''}`, f: c.s / trackLen, ffD: S.ff?.Distance?.[i]})).filter(c => {
      if (!Number.isFinite(c.ffD) || !Lref) return true; const ok = Math.abs(c.ffD - c.f * Lref) <= 80; if (!ok) counts.cornersDroppedPos++; return ok; }).sort((a, b) => a.f - b.f);
    for (const x of laps) {
      counts.withTel++;
      const {L, bad, T, p, rank} = x;
      let badT = 0; for (let k = 1; k < L.t.length; k++) if (bad[k]) badT += L.t[k] - L.t[k - 1];
      if (badT > 0.5 * L.t.at(-1)) { counts.droppedMasked++; continue; }
      for (let k = 1; k < L.t.length; k++) { dt.push(L.t[k] - L.t[k - 1]); dsx.push(L.s[k] - L.s[k - 1]); }
      for (const [o, opt] of Object.entries(OPTS)) for (const r of pickPhases(L, corners, opt)) for (const ph of PHASES)
        if (r[ph] != null) rows[o].push({year: S.year, track: S.track, ck: r.key, drv: p.drv, rank, phase: ph, value: r[ph]});
      // half-rate split (even and odd samples) for the noise floor
      const idx = T.speed.map((_, i) => i), A = pickPhases(lapFrom(T, bad, idx.filter(i => i % 2 === 0)), corners), Bh = pickPhases(lapFrom(T, bad, idx.filter(i => i % 2 === 1)), corners);
      for (const a of A) { const b = Bh.find(z => z.key === a.key); if (b) for (const ph of PHASES) if (a[ph] != null && b[ph] != null) half.push({year: S.year, track: S.track, ck: a.key, phase: ph, d: (a[ph] - b[ph]) / ((a[ph] + b[ph]) / 2)}); }
    }
  }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
  const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };

  // corner type: median apex speed of the corner over the season's drivers (sys row: the envelope driver's apex)
  const typeMaps = rs => { const ap = {}; for (const r of rs) if (r.phase === 'apex') (ap[`${r.year}|${r.track}|${r.ck}`] ||= []).push(r.value * 3.6);
    return {median: Object.fromEntries(Object.entries(ap).map(([k, a]) => [k, typeOf(med(a))])), envelope: Object.fromEntries(Object.entries(ap).map(([k, a]) => [k, typeOf(Math.max(...a))]))}; };
  const TM = typeMaps(rows.base);

  function table(rs, {env = 'max', type = 'median'} = {}) {
    const by = {}; for (const r of rs) (by[`${r.year}|${r.track}|${r.ck}|${r.phase}`] ||= []).push(r);
    const cells = {}, nDrv = [];
    for (const [k, a] of Object.entries(by)) {
      const [y, tr, ck, ph] = k.split('|'), ty = TM[type][`${y}|${tr}|${ck}`]; if (!ty) continue;
      const m = margins(a.map(r => ({drv: r.drv, value: r.value})), {env}); if (!m) continue;
      nDrv.push(m.length);
      const rank = Object.fromEntries(a.map(r => [r.drv, r.rank]));
      for (const g of GROUPS) for (const x of m) if (g === 'field' || (g === 'pole' ? rank[x.drv] === 0 : rank[x.drv] < 5)) ((cells[`${ty}|${ph}|${g}`] ||= {})[tr] ||= []).push(x.m);
    }
    return {cells, nDrv: med(nDrv)};
  }
  const base = table(rows.base), stats = {};
  for (const [k, byTrack] of Object.entries(base.cells)) stats[k] = cellStats(byTrack);
  // systematic rows: shift of the cell median
  const sysRuns = {env: [table(rows.base, {env: 'top3'})], exitM: [table(rows.exit40), table(rows.exit80)], win: [table(rows.win20), table(rows.win35)], type: [table(rows.base, {type: 'envelope'})]};
  const medOf = (T, k) => T.cells[k] ? cellStats(T.cells[k], {B: 1}).median : NaN;

  // floors
  const eMax = eMaxNormal(Math.round(base.nDrv)), noise = {};
  for (const ty of TYPES) for (const ph of PHASES) {
    const d = half.filter(h => h.phase === ph && TM.median[`${h.year}|${h.track}|${h.ck}`] === ty).map(h => h.d);
    noise[`${ty}|${ph}`] = d.length > 10 ? {n: d.length, sigmaHalf: sd(d) / Math.SQRT2} : null;
  }
  const apexKph = {}; for (const r of rows.base) if (r.phase === 'apex' || r.phase === 'exit') { const ty = TM.median[`${r.year}|${r.track}|${r.ck}`]; (apexKph[`${ty}|${r.phase}`] ||= []).push(r.value * 3.6); }
  const out = {};
  for (const ty of TYPES) for (const ph of PHASES) for (const g of GROUPS) {
    const k = `${ty}|${ph}|${g}`, s = stats[k]; if (!s) continue;
    const sys = {};
    for (const [name, Ts] of Object.entries(sysRuns)) { const xs = Ts.map(T => medOf(T, k)); if (xs.every(Number.isFinite)) sys[name] = Ts.length === 2 ? Math.abs(xs[1] - xs[0]) / 2 : Math.abs(xs[0] - s.median); }
    const sysTot = Math.hypot(...Object.values(sys)), stat = (s.ci90[1] - s.ci90[0]) / 2;
    const nz = noise[`${ty}|${ph}`], noiseFloor = nz ? nz.sigmaHalf * eMax : null;
    const b1 = ph === 'brake' ? null : 1.3 / med(apexKph[`${ty}|${ph}`] || [NaN]);
    const floor = Math.max(noiseFloor ?? 0, b1 ?? 0);
    out[k] = {type: ty, phase: ph, group: g, ...s, stat, sys, sysTotal: sysTot, total: Math.hypot(stat, sysTot), floor: {b1, noise: noiseFloor, cell: floor},
      shortfall: 1 - s.median, status: s.tracks < 5 ? 'not enough data' : 1 - s.median > floor ? 'resolved' : 'not resolved'};
  }
  const r4 = x => typeof x === 'number' ? +x.toFixed(4) : Array.isArray(x) ? x.map(r4) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([a, b]) => [a, r4(b)])) : x;
  const res = {note: 'Driver margin to the best-driver envelope (NOT the car limit), F1 qualifying 2023-26, TracingInsights best dry lap per driver, frozen samples masked (rules C+D). scripts/sim/driver-margin.mjs; pre-registration claude/gate-driver-margin-prereg-2026-11-23.md. Evidence layer 2 (measured speed); margins are measured ratios, not model values.',
    counts, dropped, sampling: {dtMedianS: med(dt), dsMedianM: med(dsx), driversPerCornerMedian: base.nDrv, eMaxNormal: eMax}, noise, cells: out};
  mkdirSync('scripts/sim/data/learn', {recursive: true});
  writeFileSync('scripts/sim/data/learn/driver-margin.json', JSON.stringify(r4(res), null, 1) + '\n');
  console.log(JSON.stringify({counts, dropped, sampling: res.sampling}));
  console.log('| type | phase | group | tracks | n | median | p10 | p90 | CI90 median | ± sys | floor | status |\n|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of Object.values(out)) console.log(`| ${c.type} | ${c.phase} | ${c.group} | ${c.tracks} | ${c.n} | ${c.median.toFixed(3)} | ${c.p10.toFixed(3)} | ${c.p90.toFixed(3)} | ${c.ci90.map(x => x.toFixed(3)).join('–')} | ${c.sysTotal.toFixed(3)} | ${c.floor.cell.toFixed(3)} | ${c.status} |`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
