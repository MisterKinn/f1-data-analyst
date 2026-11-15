// Builds worker/lapsim/f1-zones-data.js from the zone lines of the FIA documents (scripts/sim/data/learn/f1-zones-raw.json, written by
// scripts/sim/learn/fetch-f1-zones.mjs). Owner rules 2026-11-15 (AGENTS.md rule 17): 2026 Straight Mode zones and overtake
// detection/activation; 2025 DRS zones, or the DRS zones of the last year F1 raced a circuit. A zone runs from its activation point to
// the braking point of the next numbered turn (the documents give only the start). Positions use the track's official turn numbers.
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimAllTracks as T} from '../../worker/lapsim/tracks.js';
import {lapsimTrackView} from '../../worker/lapsim/track-view-data.js';

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
  const m = posRe.exec(txt || ''); if (!m) return null;
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
// end of a zone: braking for the next numbered turn after the start (at least 150 m on)
function zoneEnd(id, s0) {
  const C = cornersOf(id), L = T[id].length, ahead = C.map(c => ({c, d: ((c.s - s0) % L + L) % L})).filter(x => x.d > 150).sort((a, b) => a.d - b.d)[0];
  return ahead ? ((ahead.c.s - 60) % L + L) % L : (s0 + 400) % L;
}
const out = {};
for (const e of raw.events) {
  const id = e.year >= 2026 && /^Spanish/i.test(e.event) ? 'madring' : e.track; if (!T[id]) continue; // 2026: the Spanish GP moved to Madring
  const text = e.docs.flatMap(d => d.lines.map(l => l.text)).join('\n'), doc = e.docs.find(d => d.lines.length) || e.docs[0];
  if (e.year >= 2026) {
    const zones = [], marks = [];
    for (const ln of text.split('\n')) { const m = /-\s*-?\s*ZONE\s*A(\d+)/i.exec(ln); if (!m) continue; const head = ln.slice(0, m.index), before = [...head.matchAll(new RegExp(POS, 'gi'))].pop(); if (!before || /n\/a/i.test(head.slice(before.index + before[0].length))) continue;
      const s = at(id, before[0]), n = Number(m[1]); if (s != null && !zones.some(z => z.n === n)) zones.push({n, from: Math.round(s), to: Math.round(zoneEnd(id, s))}); }
    // overtake lines: "DETECTION - Entry T11", "ACTIVATION - T11" (a bare turn = the turn itself)
    const ot = (word, kind, label) => { const m = new RegExp(word + String.raw`\s*-\s*(` + POS + String.raw`|T(\d+[A-Z]?)\b)`, 'i').exec(text); if (!m) return; const s = m[2] ? at(id, '0m after T' + m[2]) : at(id, m[1]); if (s != null) marks.push({s: Math.round(s), kind, label}); };
    ot('DETECTION', 'det', 'OT D'); ot('ACTIVATION', 'act', 'OT A');
    if (zones.length || marks.length) (out[id] ||= {})[String(e.year)] = {kind: 'sm', year: e.year, zones: zones.sort((a, b) => a.n - b.n), marks, doc: doc?.title || '', url: doc?.url || ''};
  } else {
    const zones = [], marks = [];
    for (const m of text.matchAll(new RegExp(String.raw`DRS\s*Activation\s*(?:point\s*)?(\d)\D{0,6}?` + POS, 'gi'))) { const s = at(id, m[0].slice(m[0].search(posRe))); if (s != null && !zones.some(z => z.n === Number(m[1]))) zones.push({n: Number(m[1]), from: Math.round(s), to: Math.round(zoneEnd(id, s))}); }
    for (const m of text.matchAll(new RegExp(String.raw`DRS\s*Detection\s*(?:point\s*)?(\d)\D{0,6}?` + POS, 'gi'))) { const s = at(id, m[0].slice(m[0].search(posRe))); if (s != null && !marks.some(k => k.label === 'D' + m[1])) marks.push({s: Math.round(s), kind: 'det', label: 'D' + m[1]}); }
    // the 2025 slot holds 2025, else the newest earlier year (a circuit F1 left before 2025)
    if (zones.length && (!out[id]?.['2025'] || out[id]['2025'].year < e.year)) (out[id] ||= {})['2025'] = {kind: 'drs', year: e.year, zones: zones.sort((a, b) => a.n - b.n), marks, doc: doc?.title || '', url: doc?.url || ''};
  }
}
const missing = [...new Set(raw.events.map(e => (e.year >= 2026 ? '2026' : '2025') + ' ' + e.track))].filter(k => { const [y, id] = k.split(' '); return !out[id]?.[y]; }); // no text table in any FIA map or note read
writeFileSync(new URL('../../worker/lapsim/f1-zones-data.js', import.meta.url), `// Generated by scripts/sim/f1-zones.mjs from FIA F1 event documents (circuit maps, Race Director notes). Do not edit by hand.
// Owner rules 2026-11-15 (AGENTS.md rule 17). Lap distances in metres on the simulator track; zone ends are the next turn's braking point.
export const lapsimF1Zones = ${JSON.stringify({generatedAt: new Date().toISOString().slice(0, 10), tracks: out, missing})};
`);
console.log(Object.keys(out).length, 'tracks'); for (const [id, o] of Object.entries(out)) console.log(id, Object.entries(o).map(([y, z]) => `${y}(${z.year}) ${z.kind} ${z.zones.map(q => q.n + ':' + q.from + '-' + q.to).join(' ')} ${z.marks.map(m => m.label + '@' + m.s).join(' ')}`).join(' | '));
console.log('missing', missing.join(', '));
