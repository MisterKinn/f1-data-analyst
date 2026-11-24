// Builds worker/lapsim/f1-zones-data.js from the zone lines of the FIA documents (scripts/sim/data/learn/f1-zones-raw.json, written by
// scripts/sim/learn/fetch-f1-zones.mjs). Owner rules 2026-11-15 (AGENTS.md rule 17): 2026 Straight Mode zones and overtake
// detection/activation; 2025 DRS zones, or the DRS zones of the last year F1 raced a circuit. A zone runs from its activation point to
// the braking point of the next numbered turn (the documents give only the start). Positions use the track's official turn numbers.
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../worker/lapsim/tracks.js';
import {eventFor} from '../../worker/lapsim/names.js';
import {lapsimTrackView} from '../../worker/lapsim/track-view-data.js';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {lapsimPitLanes} from '../../worker/lapsim/pit-lane-data.js';

// F1_ZONES_RAW=<file> (step 3 unseen-season gate): read only that raw file, without the extra years, map pictures or drop-in starts below
const RAW = process.env.F1_ZONES_RAW;
const raw = JSON.parse(readFileSync(RAW || new URL('./data/learn/f1-zones-raw.json', import.meta.url), 'utf8'));
// earlier years for circuits whose map of the wanted year is an image (fetch-f1-zones-extra.mjs); the 2025 slot keeps the newest year found
if (!RAW) try { raw.events.push(...JSON.parse(readFileSync(new URL('./data/learn/f1-zones-raw-extra.json', import.meta.url), 'utf8')).events); } catch (e) { /* optional */ }
// zones read from the FIA map pictures (their legend is part of the picture, not text): scripts/sim/data/learn/f1-zones-visual.json
if (!RAW) try { raw.events.push(...JSON.parse(readFileSync(new URL('./data/learn/f1-zones-visual.json', import.meta.url), 'utf8')).events.map(e => ({...e, docs: [{title: e.doc + ' (read from the map picture)', url: e.url || '', lines: e.lines.map(text => ({text}))}]}))); } catch (e) { /* optional */ }
// DRS numbers: a digit glued to 'm' is a distance, not the zone number (Lusail 2025 'DRS Activation 305m After Turn 16' read as zone 3)
// one FIA position: "90m after T15", "40m before T3", "12m after finish line", "Entry/Apex/Mid/Exit (of) T11", "T3 exit", "T1A-entry", "T11"
// 'entry to turn 10' (Zandvoort 2025) reads as 'entry of T10'
const POS = String.raw`(?:\d+% from T\d+ to T\d+|\d+\s?m\s+(?:before|after)\s+(?:(?:T|Turn\s?)\d+[A-Z]?(?:[- ](?:entry|exit))?|(?:the\s)?(?:finish|control|start) line)|(?:Entry|Apex|Mid|Exit|Start|End)(?:\s+(?:of|to))?[- ]?(?:T|Turn\s?)\d+[A-Z]?|T\d+[A-Z]?[- ](?:entry|exit))`;
const posRe = new RegExp(POS, 'i');
const cornersOf = id => (T[id].corners?.length ? T[id].corners : lapsimTrackView[id]?.corners) || [];
function at(id, txt) {
  // a bare turn ("DRS Activation2 (Turn 14)", Silverstone 2025) is the turn itself
  const m = posRe.exec(txt || '') || /(?:\bT|\bTurn\s?)\d+[A-Z]?\b/i.exec(txt || ''); if (!m) return null;
  const p = m[0], C = cornersOf(id), L = T[id].length;
  const fr = /(\d+)% from T(\d+) to T(\d+)/i.exec(p); // read from a map picture: a share of the way between two turns
  if (fr) { const a = C.find(k => k.number === +fr[2]), b = C.find(k => k.number === +fr[3]); if (!a || !b) return null; const span = ((b.s - a.s) % L + L) % L; return (a.s + span * fr[1] / 100) % L; }
  const dm = /(\d+)\s?m\s+(before|after)/i.exec(p), tm = /(?:T|Turn\s?)(\d+)([A-Z]?)/i.exec(p.replace(/^\d+\s?m\s+(before|after)\s+/i, ''));
  let base;
  if (/line/i.test(p) && !tm) base = 0; // the lap starts at the line
  else { if (!tm) return null; const n = Number(tm[1]), l = tm[2] || ''; const c = C.find(k => k.number === n && (k.letter || '') === l) || C.find(k => k.number === n && !k.letter) || C.find(k => k.number === n); if (!c) return null; base = c.s; }
  const edge = /entry|start/i.test(p) ? -40 : /exit|end/i.test(p) ? 40 : 0;
  const d = dm ? Number(dm[1]) * (dm[2].toLowerCase() === 'before' ? -1 : 1) + (/(T\d+[A-Z]?)[- ](entry|exit)/i.test(p) ? edge : 0) : edge;
  return ((base + d) % L + L) % L;
}
// end of a zone: where the simulated 2025 F1 car starts braking after the start (at least 100 m on). Until 2026-11-15 this was
// the next numbered turn, which cut zones at flat kinks (Montreal T12, Interlagos T15: zones of 95-100 m).
const K = lapsimKernel(), ENV = K.conditionsFromWeather({pressureHpa: 1013.25, airTempC: 25, humidityPct: 50, trackTempC: 35, windSpeed: 0, windFromDeg: 0}), speed = {};
// Where a zone ends (owner 2026-11-16): at the simulated car's next braking point, or earlier at the entry of the first numbered corner
// F1 does not take flat (f1-flat-corners.json, from the real laps: Hungaroring T4), or for an estimated zone (no FIA document) before the
// first bend tighter than 300 m radius (no Straight Mode through the Watkins Glen esses or the Daytona banking)
const FLAT = (() => { try { return JSON.parse(readFileSync(new URL('./data/f1-flat-corners.json', import.meta.url), 'utf8')).tracks; } catch { return {}; } })();
// a bend tighter than 300 m radius at s (curvature averaged over ±25 m)
// bend radius that splits a run / ends an estimated zone (300 m learned; a track left with no zone retries at 200 m, owner 2026-11-16:
// Ricardo Tormo's main straight curves at about 256 m). Tighter than that a track may have no zone at all, like Monaco 2026 (owner)
let RB = 300;
// a long sweep counts as a bend too (owner rule: no Straight Mode through the Daytona banking, about 300 m radius, now that rb is 250):
// a stretch curving one way tighter than 500 m radius that turns more than 150 degrees in all (2026-11-21, the loosest sweep that still passes Gate G)
const arcMemo = new Map();
function arcOf(id) { if (arcMemo.has(id)) return arcMemo.get(id);
  const t = T[id], n = t.kappa.length, w = Math.max(1, Math.round(25 / t.ds)), k = Array.from({length: n}, (_, i) => { let m = 0; for (let j = -w; j <= w; j++) m += t.kappa[(i + j + n) % n] / 1e5; return m / (2 * w + 1); });
  const arc = new Float32Array(n), on = i => Math.abs(k[i]) > 1 / 500, i0 = k.findIndex((_, i) => !on(i));
  if (i0 >= 0) for (let a = 0; a < n;) { const i = (i0 + a) % n; if (!on(i) || (a && on((i - 1 + n) % n) && Math.sign(k[i]) === Math.sign(k[(i - 1 + n) % n]))) { a++; continue; }
    let b = 0, tot = 0; while (b < n && on((i + b) % n) && Math.sign(k[(i + b) % n]) === Math.sign(k[i])) { tot += Math.abs(k[(i + b) % n]) * t.ds; b++; }
    for (let j = 0; j < b; j++) arc[(i + j) % n] = tot; a += Math.max(1, b); }
  arcMemo.set(id, {k, arc}); return arcMemo.get(id); }
function bendAt(id, s) { const t = T[id], n = t.kappa.length, i = Math.round(s / t.ds) % n, {k, arc} = arcOf(id); return Math.abs(k[i]) > 1 / RB || arc[i] > 150 * Math.PI / 180; }
function zoneEnd(id, s0, est = false) {
  const t = T[id], ds = t.ds, n = t.kappa.length, L = n * ds, ahead = s => ((s - s0) % L + L) % L;
  const v = speed[id] ??= K.simulateLap(K.trackFromData(t), carsFor(id)['2025'].car, ENV).v;
  let end = (s0 + 400) % L;
  // braking: a deceleration above 8 m/s2 held over 10 m (v dv/ds), the first one after 100 m
  for (let k = Math.round(100 / ds); k < n; k++) { const i = (Math.round(s0 / ds) + k) % n, j = (i + Math.round(10 / ds)) % n;
    if ((v[j] * v[j] - v[i] * v[i]) / (2 * 10) < -8) { end = Math.round((i * ds) % L); break; } }
  const F = FLAT[id];
  if (F && !est) { const lift = cornersOf(id).filter(c => F.loss[c.number + (c.letter || '')] >= 0.07 && ahead(c.s - 40) > 120 && ahead(c.s - 40) < ahead(end)).sort((a, b) => ahead(a.s) - ahead(b.s))[0];
    if (lift) end = Math.round(((lift.s - 40) % L + L) % L); }
  if (est || !F) { const k = t.kappa.map(x => x / 1e5), w = Math.max(1, Math.round(25 / ds));
    for (let d = est ? ds : 120; d < ahead(end); d += ds) { const i = Math.round(((s0 + d) % L) / ds) % n; let m = 0; for (let j = -w; j <= w; j++) m += k[(i + j + n) % n];
      if (est ? bendAt(id, (s0 + d) % L) : Math.abs(m / (2 * w + 1)) > 1 / RB) { end = Math.round((s0 + Math.max(0, d - 20)) % L); break; } } } // a bend at the start leaves a zero-length zone, dropped by the 300 m minimum
  return end;
}
// documented zones never overlap: a zone that runs into the next one ends 50 m before it starts (Spa 2026 zones 4 and 5)
function noOverlap(id, zones) {
  const L = T[id].length, ahead = (a, b) => ((b - a) % L + L) % L;
  for (const z of zones) for (const o of zones) if (o !== z && ahead(z.from, o.from) > 0 && ahead(z.from, o.from) < ahead(z.from, z.to)) z.to = Math.round(((o.from - 50) % L + L) % L);
}
const out = {};
for (const e of raw.events) {
  const id = e.year >= 2026 && /^Spanish/i.test(e.event) ? 'madring' : e.track; if (!T[id]) continue; // 2026: the Spanish GP moved to Madring
  // a race held away from its home circuit (2026 "Bahrain Grand Prix in Malaysia" ran at Sepang): its map is not this circuit's, so skip it
  // (stored under the circuit it ran at, it is that circuit's map: eventFor gives the event there)
  if ((e.docs || []).some(d => /_grand_prix_in_[a-z]+_-/.test(d.url || '')) && !eventFor(id, e.year)) continue;
  // two columns run together in the PDF text: "20m after T17 Exit T19" is "20m after T17" then "Exit T19", not the exit of T17
  const text = e.docs.flatMap(d => d.lines.map(l => l.text)).join('\n').replace(/(T\d+[A-Z]?) (Exit|Entry|Apex|Mid)(?= (?:of )?T(?:urn)?\s?\d)/gi, '$1 | $2'), doc = e.docs.find(d => d.lines.length) || e.docs[0];
  if (e.year >= 2026) {
    const zones = [], marks = [];
    for (const ln of text.split('\n')) { const m = /-\s*-?\s*ZONE\s*A(\d+)/i.exec(ln); if (!m) continue; const head = ln.slice(0, m.index), before = [...head.matchAll(new RegExp(POS, 'gi'))].pop(); if (!before || /n\/a/i.test(head.slice(before.index + before[0].length))) continue;
      const s = at(id, before[0]), n = Number(m[1]); if (s == null || zones.some(z => z.n === n)) continue;
      const z = {n, from: Math.round(s), to: Math.round(zoneEnd(id, s))};
      // owner 2026-11-16: the column after "ZONE An" is the low-grip activation (Alt set, Low Grip Conditions B1.5.11); n/a = zone off
      const tail = ln.slice(ln.toUpperCase().lastIndexOf('ZONE A' + n) + 6 + String(n).length), lp = new RegExp(POS, 'i').exec(tail);
      if (/n\/a/i.test(tail) && !lp) z.low = null; else if (lp) { const q = at(id, lp[0]); if (q != null) z.low = Math.round(q); }
      zones.push(z); }
    // overtake lines: "DETECTION - Entry T11", "ACTIVATION - T11" (a bare turn = the turn itself)
    const ot = (word, kind, label) => { const m = new RegExp(word + String.raw`\s*-\s*(` + POS + String.raw`|T(\d+[A-Z]?)\b)`, 'i').exec(text); if (!m) return; const s = m[2] ? at(id, '0m after T' + m[2]) : at(id, m[1]); if (s != null) marks.push({s: Math.round(s), kind, label, txt: m[1]}); };
    ot('DETECTION', 'det', 'OT D'); ot('ACTIVATION', 'act', 'OT A');
    // detection comes before activation: "DETECTION - Exit T16" and "ACTIVATION - 40m after T16" (Las Vegas 2026) both read T16 + 40 m;
    // on a tie the exit is read as the turn itself
    { const d = marks.find(m => m.kind === 'det'), a = marks.find(m => m.kind === 'act'), tn = /(?:Exit|Entry|Apex|Mid)(?:\s+of)?[- ]?T(\d+[A-Z]?)/i.exec(d?.txt || '');
      if (d && a && d.s === a.s && tn) { const s = at(id, '0m after T' + tn[1]); if (s != null) d.s = Math.round(s); } }
    for (const m of marks) delete m.txt;
    // activation not readable (columns run together, Hungaroring): the start of the first zone after the detection point
    const det = marks.find(m => m.kind === 'det'), L0 = T[id].length;
    if (det && !marks.some(m => m.kind === 'act') && zones.length) { const z = [...zones].sort((a, b) => ((a.from - det.s) % L0 + L0) % L0 - ((b.from - det.s) % L0 + L0) % L0)[0]; marks.push({s: z.from, kind: 'act', label: 'OT A'}); }
    noOverlap(id, zones);
    if (zones.length || marks.length) (out[id] ||= {})[String(e.year)] = {kind: 'sm', year: e.year, zones: zones.sort((a, b) => a.n - b.n), marks, doc: doc?.title || '', url: doc?.url || ''};
  } else {
    const zones = [], marks = [];
    for (const m of text.matchAll(new RegExp(String.raw`DRS\s*Activation\s*(?:point\s*)?(\d?)(?!\d|\s?m\b)\D{0,6}?(?:` + POS + String.raw`|(?:T|Turn\s?)\d+[A-Z]?\b)`, 'gi'))) { const s = at(id, m[0].slice(Math.max(0, m[0].search(/\(|\d+\s?m\b|Entry|Apex|Mid|Exit|T\d|Turn/i, 4)))); const n = m[1] ? Number(m[1]) : zones.length + 1; if (s != null && !zones.some(z => z.n === n)) zones.push({n, from: Math.round(s), to: Math.round(zoneEnd(id, s))}); }
    for (const m of text.matchAll(new RegExp(String.raw`DRS\s*Detection\s*(?:point\s*)?(\d?)(?!\d|\s?m\b)\D{0,6}?(?:` + POS + String.raw`|(?:T|Turn\s?)\d+[A-Z]?\b)`, 'gi'))) { const s = at(id, m[0].slice(Math.max(0, m[0].search(/\(|\d+\s?m\b|Entry|Apex|Mid|Exit|T\d|Turn/i, 4)))); if (s != null && !marks.some(k => k.label === 'D' + (m[1] || '1'))) marks.push({s: Math.round(s), kind: 'det', label: 'D' + (m[1] || '1')}); } // no number (Hungaroring 2025): one detection, D1
    // "DRS Detection1 SC2 before Turn 2" (Baku 2025): a Safety Car line, SC1 at the pit entry and SC2 at the pit exit (pit-lane-data.js)
    for (const m of text.matchAll(/DRS\s*Detection\s*(?:point\s*)?(\d?)\s*SC\s?([12])\b/gi)) { const p = lapsimPitLanes.tracks?.[id], s = p && (m[2] === '1' ? p.entryS : p.exitS);
      if (s != null && !marks.some(k => k.label === 'D' + (m[1] || '1'))) marks.push({s: Math.round(s), kind: 'det', label: 'D' + (m[1] || '1')}); }
    noOverlap(id, zones);
    // the 2025 slot holds 2025, else the newest earlier year (a circuit F1 left before 2025)
    if (zones.length && (!out[id]?.['2025'] || out[id]['2025'].year < e.year)) (out[id] ||= {})['2025'] = {kind: 'drs', year: e.year, zones: zones.sort((a, b) => a.n - b.n), marks, doc: doc?.title || '', url: doc?.url || ''};
  }
}
// Estimated zones (owner 2026-11-15, AGENTS.md rule 17): every circuit without an FIA document for a slot gets the zones a race director
// would set, by a rule learned from the documented F1 circuits (relearned 2026-11-16 on the corrected documents). Runs = full-throttle
// stretches of the simulated 2025 F1 car on straights (bends under 300 m radius split them; kinks under 60 m merged). 2025 DRS: the
// start-line straight plus every run of 500 m or more, at most 3 (F1 score 0.79 against the documented zones); activation 145 m after the
// run starts, detection 340 m before it. 2026 Straight Mode: every run of 300 m or more, at most 4 (score 0.83); activation 45 m after
// the run starts; overtake activation 140 m into the start-line straight and detection 120 m before it (all 17 documented circuits put
// them on that straight). Zones end at braking or before the first bend under 300 m radius (zoneEnd).
const runsMemo = new Map(); // the same circuit and bend radius give the same runs (the leave-one-out check asks many times)
function runsOf(id) { const key = id + ':' + RB; if (!runsMemo.has(key)) runsMemo.set(key, runsOf0(id)); return runsMemo.get(key); }
function runsOf0(id) {
  const t = T[id], ds = t.ds, r = K.simulateLap(K.trackFromData(t), carsFor(id)['2025'].car, ENV), n = r.v.length, L = n * ds;
  speed[id] ??= r.v;
  // a run is full throttle on a straight: bends tighter than 300 m radius split it (no zone through the Watkins Glen esses)
  const kk = t.kappa.map(x => x / 1e5), w = Math.max(1, Math.round(25 / ds)), bend = i => bendAt(id, i * ds);
  const fast = Array.from({length: n}, (_, i) => (r.limit[i] === 1 || r.limit[i] === 2) && !bend(i)), out = [], s0 = fast.findIndex(f => !f);
  if (s0 < 0) return [];
  for (let k = 0; k < n;) { const i = (s0 + k) % n; if (!fast[i]) { k++; continue; } let len = 0; while (len < n && fast[(s0 + k + len) % n]) len++; out.push({from: i * ds, len: len * ds}); k += len; }
  const m = []; for (const q of out) { const p = m.at(-1); if (p && ((q.from - (p.from + p.len)) % L + L) % L < 60) p.len = ((q.from + q.len - p.from) % L + L) % L; else m.push({...q}); }
  return m.map(q => ({...q, L}));
}
const EST = 'estimated: where a race director would put them (rule learned from the FIA zones of the F1 circuits)';
// the numbers of the rule. 2026 relearned 2026-11-21 leave-one-track-out on the 22 documented 2026 circuits with the corrected starts
// (scripts/sim/f1-zones-loto.mjs, Gate G passed on zone error, overtake mark error and lap effect): rb = bend radius (m) that splits a
// run and ends an estimated zone (300 -> 250), smOff = Straight Mode activation after the run start, otZone = overtake activation after
// the start of the zone over the line (was 140 m into the start-line straight) and otDet = detection before it. The 2025 DRS rule keeps
// its 2026-11-16 numbers (no held-out check for it yet).
export const EST_P = {rb: 250, smOff: 45, otZone: -160, otDet: 80}, DRS_P = {rb: 300};
export function estimate(id, need, E = EST_P) {
  const got = {};
  for (const rb of [E.rb, Math.min(E.rb, 200)]) { RB = rb; let R; try { R = runsOf(id); } catch { break; }
    if (!R.length) continue;
    const L = R[0].L, inRun = (s, q) => ((s - q.from) % L + L) % L < q.len, byLen = [...R].sort((a, b) => b.len - a.len);
    // the start-line straight; where the line sits in a bend or under braking (Inje, Las Vegas, Daytona …): the run nearest the line
    const gap = q => Math.min(((q.from - 0) % L + L) % L, ((0 - (q.from + q.len)) % L + L) % L), st = R.find(q => inRun(0, q) || inRun(L - 1, q)) || [...R].sort((a, b) => gap(a) - gap(b))[0];
    // an estimated zone starts clear of the bend before it
    const zoneOf = (q, off, n) => { let from = Math.round((q.from + Math.min(off, Math.max(0, q.len - 300))) % L); for (let k = 0; k < 40 && bendAt(id, from); k++) from = Math.round((from + T[id].ds) % L); return {n, from, to: Math.round(zoneEnd(id, from, true))}; };
    const order = P => [...new Set(P)].sort((a, b) => a.from - b.from), mark = (rb2) => (rb2 !== 300 ? {bendR: rb2} : {});
    if (need.includes('2025') && !got['2025']?.zones.length) { let P = byLen.filter((q, i) => i === 0 || q.len >= (E.drsRun ?? 500)); if (st && !P.includes(st)) P = [st, ...P]; P = order(P.slice(0, 3));
      const zones = P.map(q => zoneOf(q, E.drsOff ?? 145, 0)).filter(z => ((z.to - z.from) % L + L) % L >= 300).map((z, i) => ({...z, n: i + 1}));
      got['2025'] = {kind: 'drs', year: 2025, est: true, ...mark(RB), zones, marks: zones.map(z => ({s: Math.round(((z.from - (E.drsDet ?? 340)) % L + L) % L), kind: 'det', label: 'D' + z.n})), doc: EST, url: ''}; }
    if (need.includes('2026') && !got['2026']?.zones.length) { const P = order(byLen.filter((q, i) => i === 0 || q.len >= 300).slice(0, 4)), zones = P.map(q => zoneOf(q, E.smOff, 0)).filter(z => ((z.to - z.from) % L + L) % L >= 300).map((z, i) => ({...z, n: i + 1})), marks = [];
      // overtake: activation otZone after the start of the zone over the line (else the zone nearest it), detection otDet before it
      const zl = zones.find(z => ((0 - z.from) % L + L) % L <= ((z.to - z.from) % L + L) % L) || [...zones].sort((a, b) => gap({from: a.from, len: ((a.to - a.from) % L + L) % L}) - gap({from: b.from, len: ((b.to - b.from) % L + L) % L}))[0];
      // no zone at all (Sonoma): the start-line run stands in for it
      const z0 = zl || (st && {from: Math.round((st.from + E.smOff) % L)});
      if (z0) { const a = Math.round(((z0.from + E.otZone) % L + L) % L); marks.push({s: Math.round(((a - E.otDet) % L + L) % L), kind: 'det', label: 'OT D'}, {s: a, kind: 'act', label: 'OT A'}); }
      got['2026'] = {kind: 'sm', year: 2026, est: true, ...mark(RB), zones, marks, doc: EST, url: ''}; }
    // two runs split by a lift with no bend end at the same braking point (Las Vegas Strip, owner 2026-11-16): keep the longer, no overlap
    for (const y of need) { const g = got[y]; if (!g) continue; const len = z => ((z.to - z.from) % L + L) % L;
      g.zones = g.zones.filter(z => !g.zones.some(o => o !== z && o.to === z.to && len(o) > len(z))); noOverlap(id, g.zones); g.zones = g.zones.filter(z => len(z) >= 300).map((z, i) => ({...z, n: i + 1}));
      if (y === '2025') g.marks = g.zones.map(z => ({s: Math.round(((z.from - (E.drsDet ?? 340)) % L + L) % L), kind: 'det', label: 'D' + z.n})); }
    if (need.every(y => got[y]?.zones.length)) break; }
  RB = 300;
  return got;
}
for (const id of Object.keys(T)) {
  if (id.startsWith('fe-') || (out[id]?.['2025'] && out[id]?.['2026'])) continue; // a documented slot is never replaced
  const need = ['2025', '2026'].filter(y => !out[id]?.[y]), got = {...estimate(id, need.filter(y => y === '2025'), DRS_P), ...estimate(id, need.filter(y => y === '2026'))};
  for (const y of need) if (got[y]) (out[id] ||= {})[y] = got[y];
}
// Corrected official starts (G4, owner 2026-11-21): starts measured on the FIA maps (W7-F drop-in) replace the text-read starts; the
// site's zone ends of main 378a10a are kept (Sepang 2026 zones 2 and 3 had none: the W7-F ends). Sepang and Madring 2026 have no
// official turn numbers on the simulator track, so their FIA text cannot be placed: the drop-in makes them documented slots.
if (!RAW) try { const D = JSON.parse(readFileSync(new URL('./data/learn/f1-zones-raw-starts.json', import.meta.url), 'utf8')).zones;
  const slots = {}; for (const d of D) (slots[d.track + '|' + d.year] ||= []).push(d);
  for (const [k, ds] of Object.entries(slots)) { const [id, yr] = k.split('|'), y = Number(yr) >= 2026 ? yr : '2025', cur = out[id]?.[y]; if (!T[id] || (cur && cur.year !== Number(yr))) continue;
    const was = cur?.est;
    const old = cur?.zones || [], zones = ds.map(d => { const o = old.find(z => z.n === d.site); const z = {n: d.n, from: d.from, to: was ? d.to : o?.to ?? d.to};
      const low = d.low !== undefined ? d.low : o?.low; if (low !== undefined) z.low = low; return z; }).sort((a, b) => a.n - b.n);
    if (!was) { cur.zones = zones; continue; }
    // the overtake marks of these two are not in the drop-in: the estimated ones stay, flagged
    const e = raw.events.find(e => e.track === id && e.year === Number(yr)), doc = e?.docs?.[0];
    out[id][y] = {kind: cur.kind, year: Number(yr), zones, marks: cur.marks, ...(cur.marks.length ? {marksEst: true} : {}), doc: doc?.title || '', url: doc?.url || ''}; } } catch (e) { if (e.code !== 'ENOENT') throw e; }
// real qualifying of each slot (owner 2026-11-16: Brazil 2026 qualifying ran in Low Grip Conditions with Overtake disabled; Las Vegas 2025
// qualifying without DRS): the state at the green flag, from race control (scripts/sim/learn/fetch-aero-state.mjs)
try { const A = JSON.parse(readFileSync(new URL('./data/learn/f1-aero-state.json', import.meta.url), 'utf8'));
  for (const e of Object.values(A.sessions)) { if (e.session !== 'Qualifying' || !out[e.track]) continue; const sl = e.year >= 2026 ? String(e.year) : '2025', z = out[e.track][sl]; if (!z || z.est || z.year !== e.year) continue;
    z.real = {grip: e.grip.start, ...(e.ot ? {ot: e.ot.start} : {}), ...(e.drs ? {drs: (e.drs || {}).start || 'on'} : {})}; } } catch (e) { /* optional */ }
export const documented = out;
if (!process.env.F1_ZONES_NO_WRITE) {
const missing = [...new Set(raw.events.map(e => (e.year >= 2026 ? '2026' : '2025') + ' ' + e.track))].filter(k => { const [y, id] = k.split(' '); return !out[id]?.[y] || out[id][y].est; }); // no text table in any FIA map or note read
writeFileSync(new URL('../../worker/lapsim/f1-zones-data.js', import.meta.url), `// Generated by scripts/sim/f1-zones.mjs from FIA F1 event documents (circuit maps, Race Director notes). Do not edit by hand.
// Owner rules 2026-11-15 (AGENTS.md rule 17). Lap distances in metres on the simulator track; zone ends are the next turn's braking point.
export const lapsimF1Zones = ${JSON.stringify({generatedAt: new Date().toISOString().slice(0, 10), tracks: out, missing})};
`);
console.log(Object.keys(out).length, 'tracks'); for (const [id, o] of Object.entries(out)) console.log(id, Object.entries(o).map(([y, z]) => `${y}(${z.year}) ${z.kind} ${z.zones.map(q => q.n + ':' + q.from + '-' + q.to).join(' ')} ${z.marks.map(m => m.label + '@' + m.s).join(' ')}`).join(' | '));
console.log('missing', missing.join(', '));
}
