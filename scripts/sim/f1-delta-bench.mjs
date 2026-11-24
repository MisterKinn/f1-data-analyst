// Step 24 Δ benchmark (pre-registration: claude/prereg-step24-delta-2026-11-24.md, sha256 9459f58b…). Research script, not used by the site.
//   node scripts/sim/f1-delta-bench.mjs zones            → zone mapping table (season zone sets → simulator track distance)
//   python3 -I scripts/sim/f1-delta-fetch.py <dir>/zones.csv <dir>/feat   → per-lap, per-zone features (TracingInsights, 2023–2025 races)
//   python3 -I scripts/sim/f1-delta-cases.py <dir>/feat <dir>/zones.csv <dir> → Δ cases, σ_meas (bootstrap), MDE
//   node scripts/sim/f1-delta-bench.mjs model <dir>      → production-model Δ on the kept cases (only for uses that passed the noise check)
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../worker/lapsim/tracks.js';
import {eventFor} from '../../worker/lapsim/names.js';
import {lapsimTrackView} from '../../worker/lapsim/track-view-data.js';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {carsFor, realConditions} from '../../worker/lapsim/scenario.js';
import {lapsimF1Zones} from '../../worker/lapsim/f1-zones-data.js';
import {slotOf} from '../../worker/lapsim/zones.js';

const K = lapsimKernel(), DOCS = new URL('./data/fia-docs/', import.meta.url);
const csv = f => { const [h, ...rows] = readFileSync(new URL(f, DOCS), 'utf8').replace(/^﻿/, '').trim().split('\n').map(splitCsv); return rows.map(r => Object.fromEntries(h.map((k, i) => [k, r[i]]))); };
function splitCsv(l) { const o = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; } o.push(cur); return o; }
const idOf = (event, year) => event === 'Bahrain Grand Prix in Malaysia' ? 'kuala-lumpur' : Object.keys(T).find(id => eventFor(id, year) === event) || null;
const cornersOf = id => (T[id].corners?.length ? T[id].corners : lapsimTrackView[id]?.corners) || [];
const lenOf = id => T[id].kappa.length * T[id].ds, wrap = (s, L) => ((s % L) + L) % L;

// printed point → simulator distance (production reader rules, scripts/sim/f1-zones.mjs at())
export function at(id, txt) {
  const p = String(txt || '').trim(), C = cornersOf(id), L = lenOf(id);
  const line = /(finish|control|start) line/i.test(p) && !/turn|\bT\d/i.test(p);
  const tm = /(?:\bT|Turn\s?)(\d+)([A-Z]?)\b/i.exec(p), dm = /(\d+)\s?m\s+(before|after)/i.exec(p);
  let base;
  if (line) base = 0;
  else { if (!tm) return null; const n = +tm[1], l = (tm[2] || '').toUpperCase(); const c = C.find(k => k.number === n && (k.letter || '') === l) || C.find(k => k.number === n && !k.letter) || C.find(k => k.number === n); if (!c) return null; base = c.s; }
  const edge = /\bentry\b/i.test(p) ? -40 : /\bexit\b/i.test(p) ? 40 : 0;
  const d = dm ? +dm[1] * (dm[2].toLowerCase() === 'before' ? -1 : 1) + (/T\d+[A-Z]?[- ](entry|exit)/i.test(p) ? edge : 0) : edge;
  return wrap(base + d, L);
}
// zone end: braking point of the production 2025 car ≥ 100 m after the start (> 8 m/s² over 10 m), ISA-25 °C (pre-reg section 1)
const ENV0 = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}), vMemo = {};
function zoneEnd(id, s0) {
  const t = T[id], ds = t.ds, n = t.kappa.length, L = n * ds, v = vMemo[id] ??= K.simulateLap(K.trackFromData(t), carsFor(id)['2025'].car, ENV0).v;
  for (let k = Math.round(100 / ds); k < n; k++) { const i = (Math.round(s0 / ds) + k) % n, j = (i + Math.round(10 / ds)) % n; if ((v[j] ** 2 - v[i] ** 2) / 20 < -8) return Math.round(wrap(i * ds, L)); }
  return Math.round(wrap(s0 + 400, L));
}
function noOverlap(id, zs) { const L = lenOf(id), ah = (a, b) => wrap(b - a, L); for (const z of zs) for (const o of zs) if (o !== z && ah(z.from, o.from) > 0 && ah(z.from, o.from) < ah(z.from, z.to)) z.to = Math.round(wrap(o.from - 50, L)); }

// season zone set per (year, event): DRS rows for 2023–2025, normal-grip Straight Mode rows for 2026
export function zoneSets() {
  const out = {}, add = (year, event, n, text) => { const id = idOf(event, +year); const k = year + '|' + event; const e = out[k] ??= {year: +year, event, id, zones: [], dropped: []}; if ([...e.zones, ...e.dropped].some(z => z.n === n)) return; if (!id) { e.dropped.push({n, text, why: 'no simulator track'}); return; } const s = at(id, text); if (s == null) e.dropped.push({n, text, why: cornersOf(id).length ? 'unreadable' : 'no corner positions on the track file'}); else e.zones.push({n, text, from: Math.round(s)}); };
  for (const r of csv('f1-drs-zones-2022-2025.csv')) if (+r.year >= 2023) add(r.year, r.event, +r.zone, r.activation_point);
  for (const r of csv('f1-low-drag-zones-2022-2026.csv')) if (r.year === '2026' && /straight_mode/i.test(r.kind) && /normal grip/i.test(r.session_scope) && /^A\d/.test(r.zone)) add(r.year, r.event, +(/A(\d+)/.exec(r.zone)?.[1]), r.start_or_detection);
  for (const e of Object.values(out)) { if (!e.id) continue; e.zones.sort((a, b) => a.n - b.n); for (const z of e.zones) z.to = zoneEnd(e.id, z.from); noOverlap(e.id, e.zones); }
  return out;
}
// production zone of the same number for that season (worker/lapsim/f1-zones-data.js slot)
const prodZone = (id, year, n) => { const zt = lapsimF1Zones?.tracks?.[id], sl = zt && slotOf(zt, year); return zt?.[sl]?.zones?.find(z => z.n === n) || null; };

const mode = process.argv[2], dir = process.argv[3];
if (mode === 'zones') {
  const rows = [['year', 'event', 'track', 'zone', 'printed_activation', 'sim_from_m', 'sim_to_m', 'prod_slot_from_m', 'prod_minus_csv_m', 'dropped']];
  for (const e of Object.values(zoneSets())) {
    for (const z of e.zones) { const p = e.id && prodZone(e.id, e.year, z.n); rows.push([e.year, e.event, e.id, z.n, z.text, z.from, z.to, p?.from ?? '', p ? Math.round(wrap(p.from - z.from + lenOf(e.id) / 2, lenOf(e.id)) - lenOf(e.id) / 2) : '', '']); }
    for (const z of e.dropped) rows.push([e.year, e.event, e.id || '', z.n, z.text, '', '', '', '', z.why]);
  }
  process.stdout.write(rows.map(r => r.map(x => /[",]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x).join(',')).join('\n') + '\n');
}

// model stage: production 2025 car (grip, timeScale, production weather), the case's own season zone set (pre-reg "Model")
if (mode === 'model') {
  const rd = f => readFileSync(f, 'utf8').trim().split(/\r?\n/).map(splitCsv), [zh, ...zr] = rd(dir + '/zones.csv'), [ch, ...cr] = rd(dir + '/f1-delta-cases-2026-11-24.csv');
  const obj = (h, r) => Object.fromEntries(h.map((k, i) => [k, r[i]])), zones = zr.map(r => obj(zh, r)), cases = cr.map(r => obj(ch, r)).filter(c => c.kept === '1');
  const withGrip = (tr, g) => ({...tr, mu: Float64Array.from(tr.mu, m => m * g)}), memo = new Map();
  const lapOf = (id, list) => { const k = id + JSON.stringify(list); if (memo.has(k)) return memo.get(k);
    const d = T[id], c = carsFor(id)['2025'], conds = realConditions(id), real = conds['2025'] || conds['2026'] || Object.values(conds)[0] || {};
    const pick = (key, fb) => Number.isFinite(real[key]) ? real[key] : fb;
    const env = K.conditionsFromWeather({airTempC: pick('airTempC', 25), trackTempC: pick('trackTempC', 35), humidityPct: pick('humidityPct', 50), pressureHpa: pick('pressureHpa', 1013.25), windSpeed: pick('windSpeed', 0), windFromDeg: pick('windFromDeg', 0)});
    let tr = K.trackFromData(d); tr = {...tr, aeroLow: list.length ? K.trackFromData({...d, aeroZones: list}, {aero: 'fia'}).aeroLow : new Uint8Array(d.kappa.length)};
    const r = K.simulateLap(withGrip(tr, c.grip || 1), c.car, env), f = c.timeScale || 1, out = {lap: r.lapTime * f, time: r.time.map(t => t * f), ds: d.ds, L: lenOf(id)};
    memo.set(k, out); return out; };
  const tAt = (r, s) => { const extra = s >= r.L ? r.lap : 0, x = (s % r.L) / r.ds, i = Math.floor(x), n = r.time.length, a = r.time[i % n], b = i + 1 < n ? r.time[i + 1] : r.lap; return extra + a + (b - a) * (x - i); };
  const rows = [['case_id', 'use', 'year', 'event', 'track', 'driver', 'stint', 'zone', 'meas_delta_s', 'sigma_meas_s', 'pred_delta_s']];
  for (const c of cases) {
    const set = zones.filter(z => z.year === c.year && z.event === c.event && z.sim_from_m !== '').map(z => ({n: z.zone, a: +z.sim_from_m, b: +z.sim_to_m})), all = set.map(z => [z.a, z.b]);
    let pred;
    if (c.use === 'drs_lap') pred = lapOf(c.track, all).lap - lapOf(c.track, []).lap;
    else { const z = set.find(q => q.n === c.zone), L = lenOf(c.track), a = z.a, e = (z.b < z.a ? z.b + L : z.b) + 150, on = lapOf(c.track, all), off = lapOf(c.track, set.filter(q => q !== z).map(q => [q.a, q.b]));
      pred = (tAt(on, e) - tAt(on, a)) - (tAt(off, e) - tAt(off, a)); }
    rows.push([c.case_id, c.use, c.year, c.event, c.track, c.driver, c.stint, c.zone, c.meas_delta_s, c.sigma_meas_s, pred.toFixed(4)]);
  }
  writeFileSync(dir + '/baseline.csv', rows.map(r => r.join(',')).join('\n') + '\n'); console.log('model rows', rows.length - 1);
}
