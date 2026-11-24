// Step 0 of the unseen-season gate (claude/gate-geometry-f1-unseen-seasons-prereg-2026-11-24.md, rev 2): F1 2022 qualifying from the
// TracingInsights 2022 repository (FastF1 data), read-only, and the eligible list fixed before any fit.
// - tracks: F1 rows (lapsimTracks) with a G3 row (tracks-a3.json, open era, not source incomplete) and a 2022 TI qualifying folder;
// - layout rule: out when the 5a registry era (track-state-data.js layoutEras) of 2022 differs from that of 2026 (the G3 source);
// - wet rule: out when any weather sample of the session has rain, or any Q3 lap ran on INTERMEDIATE or WET;
// - DRS rule (central 2026-11-24): the 2022 FIA circuit-map zones (F1_ZONES_RAW, read by f1-zones.mjs on the production line); without
//   them the 2025 FIA zones are kept only if the 2022 pole lap's measured DRS openings match them (same count, every opening start within
//   DRS_TOL_M of a zone start); otherwise out. Measured DRS = flap open: TI's binary channel 1, or FastF1's raw 10/12/14 (8 = eligible, not open).
// Out (JSON): eligibility per track, the dry top-3 Q3 laps as calibrate traces (true year 2022, s on the production line: FastF1 distance
// scaled to the track length; shortcut: assumes lap start = timing line as in the OpenF1 traces), 2022 pole telemetry in the
// f1-real-telemetry-data.js record format, the zones chosen per track and their source.
// Usage: LAPSIM_TI_DIR=<dir with 2022/> [F1_ZONES_RAW=<2022 zone raw>] node scripts/sim/geom-indep/ti-2022.mjs <out.json>
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {lapsimTracks} from '../../../worker/lapsim/tracks-data.js';
import {lapsimTrackState} from '../../../worker/lapsim/track-state-data.js';
import {lapsimF1Zones} from '../../../worker/lapsim/f1-zones-data.js';
import {tiTrack} from '../ti-races.mjs';

const Y = 2022, ROOT = join(process.env.LAPSIM_TI_DIR || '.cache/ti', String(Y)), OUT = process.argv[2], DRS_TOL_M = 100, MAX_POS = 3, MAX_TEL = 900;
const A3 = JSON.parse(readFileSync(new URL('../data/geom-indep/tracks-a3.json', import.meta.url), 'utf8')).tracks;
const G3 = Object.keys(lapsimTracks).filter(id => { const e = A3[id]?.eras.find(q => q.to == null); return e && !e.sourceIncomplete; });
const doc22 = process.env.F1_ZONES_RAW ? (process.env.F1_ZONES_NO_WRITE = '1', (await import('../f1-zones.mjs')).documented) : {};
const J = f => JSON.parse(readFileSync(f, 'utf8'));
// a file of the sparse TI checkout; fetched from the repository on first use (git, so the raw input is the commit's blob)
// (no silent drops: a file that cannot be read is listed and the run stops at the end)
// git show works outside the sparse-checkout patterns (a checkout of such a path fails in CI)
const failed = [], file = p => { const f = join(ROOT, p); if (!existsSync(f)) try { mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, execFileSync('git', ['-C', ROOT, 'show', `HEAD:${p}`], {maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore']})); } catch { failed.push(p); return null; } return J(f); };
const num = v => v === 'None' || v == null || !Number.isFinite(+v) ? null : +v;
const eraOf = (id, y) => (lapsimTrackState.tracks[id]?.layoutEras || []).filter(s => s <= y).length;
const len = id => lapsimTracks[id].kappa.length * lapsimTracks[id].ds;
const events = readdirSync(ROOT).filter(e => /Grand Prix$/.test(e));
const out = {year: Y, source: `TracingInsights/${Y} (FastF1), commit ${execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim()}`,
  rules: {drsTolM: DRS_TOL_M, maxPos: MAX_POS, wet: 'rain in any weather sample, or a Q3 lap on INTERMEDIATE/WET', layout: '5a registry era 2022 = era 2026'},
  tracks: {}, traces: [], realTel: {}, zones: {}};

for (const id of G3) {
  const r = out.tracks[id] = {eligible: false};
  const ev = events.find(e => tiTrack(e, Y) === id); if (!ev) { r.reason = 'not raced in 2022'; continue; } r.event = ev;
  if (eraOf(id, Y) !== eraOf(id, 2026)) { r.reason = 'layout: 2022 era differs from the G3 source (5a registry)'; continue; }
  const Q = `${ev}/Qualifying`, info = file(`${Q}/session_info.json`), W = file(`${Q}/weather.json`), D = file(`${Q}/drivers.json`)?.drivers || [];
  if (!info || !W || !D.length) { r.reason = 'TI session files missing'; continue; }
  const laps = D.filter(d => existsSync(join(ROOT, Q, d.driver, 'laptimes.json'))).map(d => ({d, T: file(`${Q}/${d.driver}/laptimes.json`)})); // sparse checkout: every driver with laps
  r.rain = W.wR.some(Boolean);
  r.q3Compounds = [...new Set(laps.flatMap(({T}) => T.qs.map((q, i) => q === 'Q3' ? T.compound[i] : null).filter(Boolean)))];
  const wet = r.rain || r.q3Compounds.some(c => /INTER|WET/i.test(c));
  // Q3 order (classification without penalties): best valid Q3 lap per driver
  const best = laps.map(({d, T}) => { let k = -1; T.qs.forEach((q, i) => { if (q === 'Q3' && !T.del[i] && num(T.time[i]) != null && (k < 0 || +T.time[i] < +T.time[k])) k = i; });
    return k < 0 ? null : {d, T, k, time: +T.time[k]}; }).filter(Boolean).sort((a, b) => a.time - b.time).slice(0, MAX_POS);
  if (!best.length) { r.reason = 'no valid Q3 lap'; continue; }
  r.pole = {driver: best[0].d.driver, lap: best[0].time};
  const L = len(id), trace = [];
  for (const [p, b] of best.entries()) {
    const tel = file(`${Q}/${b.d.driver}/${b.T.lap[b.k]}_tel.json`)?.tel; if (!tel?.speed?.length) continue;
    const n = tel.speed.length, Lti = +tel.distance[n - 1], f = L / Lti, t0 = num(b.T.lST[b.k]);
    const w = W.wT.map((t, i) => i).filter(i => W.wT[i] >= t0 - 900 && W.wT[i] <= t0 + 120), mean = k => w.length ? w.reduce((a, i) => a + +W[k][i], 0) / w.length : null;
    const we = w.reduce((a, i) => a + W.wWS[i] * Math.sin(W.wWD[i] * Math.PI / 180), 0), wn = w.reduce((a, i) => a + W.wWS[i] * Math.cos(W.wWD[i] * Math.PI / 180), 0);
    trace.push({year: Y, track: id, session_key: Number(info.t0_date.slice(0, 10).replace(/-/g, '')), date: b.T.lSD[b.k].slice(0, 23) + 'Z', driver_number: Number(b.d.dn), team: b.d.team, position: p + 1,
      lap_seconds: b.time, sectors: [num(b.T.s1[b.k]), num(b.T.s2[b.k]), num(b.T.s3[b.k])],
      s: tel.distance.map(x => Math.round(Math.max(0, +x) * f * 10) / 10), v: tel.speed.map(Number), throttle: tel.throttle.map(Number), brake: tel.brake.map(x => x === true || +x > 0 ? 100 : 0),
      weather: {airTempC: mean('wAT'), trackTempC: mean('wTT'), humidityPct: mean('wH'), pressureHpa: mean('wP'), rain: r.rain,
        windSpeed: w.length ? Math.hypot(we, wn) / w.length : null, windFromDeg: w.length ? (Math.atan2(we, wn) * 180 / Math.PI + 360) % 360 : null},
      src: `TracingInsights/${Y} ${ev} Qualifying ${b.d.driver} lap ${b.T.lap[b.k]}`});
    if (p === 0) { // pole: measured DRS openings (m on the production line) and the telemetry record of f1-real-telemetry.mjs
      const s = trace.at(-1).s, open = []; let a = null;
      tel.drs.forEach((x, i) => { const o = +x === 1 || +x >= 10; if (o && a == null) a = s[i]; if (!o && a != null) { if (s[i] - a >= 50) open.push([Math.round(a), Math.round(s[i])]); a = null; } });
      if (a != null) { if (open.length && open[0][0] <= 20) open[0][0] = Math.round(a); else if (L - a >= 50) open.push([Math.round(a), Math.round(L)]); } // a zone over the line is one opening
      r.drsOpen = open;
      const step = Math.ceil(n / MAX_TEL), idx = []; for (let k = 0; k < n; k += step) idx.push(k);
      const pos = k => Number.isFinite(+tel.rel_distance?.[k]) ? +tel.rel_distance[k] : +tel.distance[k] / Lti;
      out.realTel[id] = {driver: b.d.driver, lapNo: b.T.lap[b.k], lap: b.time, len: Math.round(Lti), src: trace.at(-1).src,
        f: idx.map(k => Math.round(pos(k) * 1e4)), speed: idx.map(k => Math.round(+tel.speed[k])), throttle: idx.map(k => Math.round(+tel.throttle[k])),
        brake: idx.map(k => tel.brake[k] === true || +tel.brake[k] > 0 ? 1 : 0), gear: idx.map(k => +tel.gear[k]), rpm: idx.map(k => Math.round(+tel.rpm[k]))};
    }
  }
  if (wet) { r.reason = 'wet: ' + (r.rain ? 'rain in the session' : 'Q3 on ' + r.q3Compounds.join('/')); continue; }
  // DRS zones: 2022 FIA document, else the 2025 FIA zones when the measured 2022 openings match them
  const d = doc22[id]?.['2025'], z25 = lapsimF1Zones.tracks?.[id]?.['2025'], circ = (a, b) => { const x = Math.abs(a - b) % L; return Math.min(x, L - x); };
  const op = r.drsOpen || [], matches = z => !!z?.zones?.length && !z.est && z.zones.length === op.length && op.every(([a]) => z.zones.some(q => circ(q.from, a) <= DRS_TOL_M));
  if (d && d.year === Y && !d.est) { out.zones[id] = {...d, source: `FIA ${Y} ${d.doc}`}; r.zoneSource = `FIA ${Y} document`; r.zoneCheck = matches(d) ? 'measured openings match' : 'measured openings differ (report only)'; }
  else if (matches(z25)) { out.zones[id] = {...z25, source: `FIA ${z25.year} ${z25.doc}, kept: 2022 measured DRS openings match (count ${z25.zones.length}, starts within ${DRS_TOL_M} m)`}; r.zoneSource = `FIA ${z25.year} (matched by 2022 measured DRS)`; }
  else { r.reason = `DRS: no 2022 FIA zones and the 2022 openings (${r.drsOpen?.length ?? 'no pole telemetry'}) do not match the 2025 zones (${z25?.zones.length ?? 0}${z25?.est ? ', estimated' : ''})`; continue; }
  if (!trace.length) { r.reason = 'no telemetry'; continue; }
  r.eligible = true; r.laps = trace.length; out.traces.push(...trace);
}
out.eligible = Object.keys(out.tracks).filter(id => out.tracks[id].eligible); out.n = out.eligible.length;
for (const id of Object.keys(out.realTel)) if (!out.tracks[id].eligible) delete out.realTel[id];
out.failedFiles = failed;
writeFileSync(OUT, JSON.stringify(out));
for (const [id, r] of Object.entries(out.tracks)) console.log(id.padEnd(20), r.eligible ? `eligible (${r.laps} laps, pole ${r.pole.driver} ${r.pole.lap}, zones ${r.zoneSource}${r.zoneCheck ? '; ' + r.zoneCheck : ''})` : 'out: ' + r.reason);
console.log(`n = ${out.n} eligible tracks: ${out.eligible.join(', ')}`);
if (failed.length) { console.log(`STOP: ${failed.length} TI file(s) could not be read:\n` + failed.join('\n')); process.exit(1); }
