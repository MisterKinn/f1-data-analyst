// Builds worker/lapsim/f1-zones-data.js from the zone lines of the FIA documents (scripts/sim/data/learn/f1-zones-raw.json, written by
// scripts/sim/learn/fetch-f1-zones.mjs). Owner rules 2026-11-15 (AGENTS.md rule 17): 2026 Straight Mode zones and overtake
// detection/activation; 2025 DRS zones, or the DRS zones of the last year F1 raced a circuit. A zone runs from its activation point to
// the braking point of the next numbered turn (the documents give only the start). Positions use the track's official turn numbers.
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../worker/lapsim/tracks.js';
import {lapsimTrackView} from '../../worker/lapsim/track-view-data.js';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {carsFor} from '../../worker/lapsim/scenario.js';

const raw = JSON.parse(readFileSync(new URL('./data/learn/f1-zones-raw.json', import.meta.url), 'utf8'));
// earlier years for circuits whose map of the wanted year is an image (fetch-f1-zones-extra.mjs); the 2025 slot keeps the newest year found
try { raw.events.push(...JSON.parse(readFileSync(new URL('./data/learn/f1-zones-raw-extra.json', import.meta.url), 'utf8')).events); } catch (e) { /* optional */ }
// zones read from the FIA map pictures (their legend is part of the picture, not text): scripts/sim/data/learn/f1-zones-visual.json
try { raw.events.push(...JSON.parse(readFileSync(new URL('./data/learn/f1-zones-visual.json', import.meta.url), 'utf8')).events.map(e => ({...e, docs: [{title: e.doc + ' (read from the map picture)', url: e.url || '', lines: e.lines.map(text => ({text}))}]}))); } catch (e) { /* optional */ }
// one FIA position: "90m after T15", "40m before T3", "12m after finish line", "Entry/Apex/Mid/Exit (of) T11", "T3 exit", "T1A-entry", "T11"
const POS = String.raw`(?:\d+% from T\d+ to T\d+|\d+\s?m\s+(?:before|after)\s+(?:(?:T|Turn\s?)\d+[A-Z]?(?:[- ](?:entry|exit))?|(?:the\s)?(?:finish|control|start) line)|(?:Entry|Apex|Mid|Exit|Start|End)(?:\s+of)?[- ]?(?:T|Turn\s?)\d+[A-Z]?|T\d+[A-Z]?[- ](?:entry|exit))`;
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
function bendAt(id, s) { const t = T[id], n = t.kappa.length, w = Math.max(1, Math.round(25 / t.ds)), i = Math.round(s / t.ds) % n; let m = 0; for (let j = -w; j <= w; j++) m += t.kappa[(i + j + n) % n] / 1e5; return Math.abs(m / (2 * w + 1)) > 1 / 300; }
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
      if (Math.abs(m / (2 * w + 1)) > 1 / 300) { end = Math.round((s0 + Math.max(0, d - 20)) % L); break; } } } // a bend at the start leaves a zero-length zone, dropped by the 300 m minimum
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
  if ((e.docs || []).some(d => /_grand_prix_in_[a-z]+_-/.test(d.url || ''))) continue;
  // two columns run together in the PDF text: "20m after T17 Exit T19" is "20m after T17" then "Exit T19", not the exit of T17
  const text = e.docs.flatMap(d => d.lines.map(l => l.text)).join('\n').replace(/(T\d+[A-Z]?) (Exit|Entry|Apex|Mid)(?= (?:of )?T(?:urn)?\s?\d)/gi, '$1 | $2'), doc = e.docs.find(d => d.lines.length) || e.docs[0];
  if (e.year >= 2026) {
    const zones = [], marks = [];
    for (const ln of text.split('\n')) { const m = /-\s*-?\s*ZONE\s*A(\d+)/i.exec(ln); if (!m) continue; const head = ln.slice(0, m.index), before = [...head.matchAll(new RegExp(POS, 'gi'))].pop(); if (!before || /n\/a/i.test(head.slice(before.index + before[0].length))) continue;
      const s = at(id, before[0]), n = Number(m[1]); if (s != null && !zones.some(z => z.n === n)) zones.push({n, from: Math.round(s), to: Math.round(zoneEnd(id, s))}); }
    // overtake lines: "DETECTION - Entry T11", "ACTIVATION - T11" (a bare turn = the turn itself)
    const ot = (word, kind, label) => { const m = new RegExp(word + String.raw`\s*-\s*(` + POS + String.raw`|T(\d+[A-Z]?)\b)`, 'i').exec(text); if (!m) return; const s = m[2] ? at(id, '0m after T' + m[2]) : at(id, m[1]); if (s != null) marks.push({s: Math.round(s), kind, label}); };
    ot('DETECTION', 'det', 'OT D'); ot('ACTIVATION', 'act', 'OT A');
    // activation not readable (columns run together, Hungaroring): the start of the first zone after the detection point
    const det = marks.find(m => m.kind === 'det'), L0 = T[id].length;
    if (det && !marks.some(m => m.kind === 'act') && zones.length) { const z = [...zones].sort((a, b) => ((a.from - det.s) % L0 + L0) % L0 - ((b.from - det.s) % L0 + L0) % L0)[0]; marks.push({s: z.from, kind: 'act', label: 'OT A'}); }
    noOverlap(id, zones);
    if (zones.length || marks.length) (out[id] ||= {})[String(e.year)] = {kind: 'sm', year: e.year, zones: zones.sort((a, b) => a.n - b.n), marks, doc: doc?.title || '', url: doc?.url || ''};
  } else {
    const zones = [], marks = [];
    for (const m of text.matchAll(new RegExp(String.raw`DRS\s*Activation\s*(?:point\s*)?(\d)\D{0,6}?(?:` + POS + String.raw`|(?:T|Turn\s?)\d+[A-Z]?\b)`, 'gi'))) { const s = at(id, m[0].slice(Math.max(0, m[0].search(/\(|\d+\s?m\b|Entry|Apex|Mid|Exit|T\d|Turn/i, 4)))); if (s != null && !zones.some(z => z.n === Number(m[1]))) zones.push({n: Number(m[1]), from: Math.round(s), to: Math.round(zoneEnd(id, s))}); }
    for (const m of text.matchAll(new RegExp(String.raw`DRS\s*Detection\s*(?:point\s*)?(\d)\D{0,6}?(?:` + POS + String.raw`|(?:T|Turn\s?)\d+[A-Z]?\b)`, 'gi'))) { const s = at(id, m[0].slice(Math.max(0, m[0].search(/\(|\d+\s?m\b|Entry|Apex|Mid|Exit|T\d|Turn/i, 4)))); if (s != null && !marks.some(k => k.label === 'D' + m[1])) marks.push({s: Math.round(s), kind: 'det', label: 'D' + m[1]}); }
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
function runsOf(id) {
  const t = T[id], ds = t.ds, r = K.simulateLap(K.trackFromData(t), carsFor(id)['2025'].car, ENV), n = r.v.length, L = n * ds;
  speed[id] ??= r.v;
  // a run is full throttle on a straight: bends tighter than 300 m radius split it (no zone through the Watkins Glen esses)
  const kk = t.kappa.map(x => x / 1e5), w = Math.max(1, Math.round(25 / ds)), bend = i => { let m = 0; for (let j = -w; j <= w; j++) m += kk[(i + j + n) % n]; return Math.abs(m / (2 * w + 1)) > 1 / 300; };
  const fast = Array.from({length: n}, (_, i) => (r.limit[i] === 1 || r.limit[i] === 2) && !bend(i)), out = [], s0 = fast.findIndex(f => !f);
  if (s0 < 0) return [];
  for (let k = 0; k < n;) { const i = (s0 + k) % n; if (!fast[i]) { k++; continue; } let len = 0; while (len < n && fast[(s0 + k + len) % n]) len++; out.push({from: i * ds, len: len * ds}); k += len; }
  const m = []; for (const q of out) { const p = m.at(-1); if (p && ((q.from - (p.from + p.len)) % L + L) % L < 60) p.len = ((q.from + q.len - p.from) % L + L) % L; else m.push({...q}); }
  return m.map(q => ({...q, L}));
}
const EST = 'estimated: where a race director would put them (rule learned from the FIA zones of the F1 circuits)';
for (const id of Object.keys(T)) {
  if (id.startsWith('fe-') || (out[id]?.['2025'] && out[id]?.['2026'])) continue; // a documented slot is never replaced
  let R; try { R = runsOf(id); } catch { continue; }
  if (!R.length) continue;
  const L = R[0].L, inRun = (s, q) => ((s - q.from) % L + L) % L < q.len, byLen = [...R].sort((a, b) => b.len - a.len), st = R.find(q => inRun(0, q) || inRun(L - 1, q));
  // an estimated zone starts clear of the bend before it
  const zoneOf = (q, off, n) => { let from = Math.round((q.from + Math.min(off, Math.max(0, q.len - 300))) % L); for (let k = 0; k < 40 && bendAt(id, from); k++) from = Math.round((from + T[id].ds) % L); return {n, from, to: Math.round(zoneEnd(id, from, true))}; };
  const order = P => [...new Set(P)].sort((a, b) => a.from - b.from);
  if (!out[id]?.['2025']) { let P = byLen.filter((q, i) => i === 0 || q.len >= 500); if (st && !P.includes(st)) P = [st, ...P]; P = order(P.slice(0, 3));
    const zones = P.map(q => zoneOf(q, 145, 0)).filter(z => ((z.to - z.from) % L + L) % L >= 300).map((z, i) => ({...z, n: i + 1}));
    (out[id] ||= {})['2025'] = {kind: 'drs', year: 2025, est: true, zones, marks: zones.map(z => ({s: Math.round(((z.from - 340) % L + L) % L), kind: 'det', label: 'D' + z.n})), doc: EST, url: ''}; }
  if (!out[id]?.['2026']) { const P = order(byLen.filter((q, i) => i === 0 || q.len >= 300).slice(0, 4)), zones = P.map(q => zoneOf(q, 45, 0)).filter(z => ((z.to - z.from) % L + L) % L >= 300).map((z, i) => ({...z, n: i + 1})), marks = [];
    if (st) { const a = Math.round((st.from + 140) % L); marks.push({s: Math.round(((a - 120) % L + L) % L), kind: 'det', label: 'OT D'}, {s: a, kind: 'act', label: 'OT A'}); }
    (out[id] ||= {})['2026'] = {kind: 'sm', year: 2026, est: true, zones, marks, doc: EST, url: ''}; }
}
const missing = [...new Set(raw.events.map(e => (e.year >= 2026 ? '2026' : '2025') + ' ' + e.track))].filter(k => { const [y, id] = k.split(' '); return !out[id]?.[y] || out[id][y].est; }); // no text table in any FIA map or note read
writeFileSync(new URL('../../worker/lapsim/f1-zones-data.js', import.meta.url), `// Generated by scripts/sim/f1-zones.mjs from FIA F1 event documents (circuit maps, Race Director notes). Do not edit by hand.
// Owner rules 2026-11-15 (AGENTS.md rule 17). Lap distances in metres on the simulator track; zone ends are the next turn's braking point.
export const lapsimF1Zones = ${JSON.stringify({generatedAt: new Date().toISOString().slice(0, 10), tracks: out, missing})};
`);
console.log(Object.keys(out).length, 'tracks'); for (const [id, o] of Object.entries(out)) console.log(id, Object.entries(o).map(([y, z]) => `${y}(${z.year}) ${z.kind} ${z.zones.map(q => q.n + ':' + q.from + '-' + q.to).join(' ')} ${z.marks.map(m => m.label + '@' + m.s).join(' ')}`).join(' | '));
console.log('missing', missing.join(', '));
