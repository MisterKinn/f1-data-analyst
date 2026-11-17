// Formula E Attack Zones for the simulator track maps (owner 2026-11-16), one set per rule set: Gen3 Evo (2024-26) and Gen4 (2026-27).
//   node scripts/sim/fe-zones.mjs
// Rules (the only Formula E "zone" on track; Formula E has no DRS / Straight Mode):
//  - Gen3 Evo, 2025-26 Sporting Regulations (27.02.2026) Art. 37.3: race power 300 kW, rear only ("Normal Mode"); Attack Mode 350 kW,
//    armed by driving through an activation zone "visible on the circuit and on television", whose shape and location vary per circuit;
//    with Attack Mode on, 4-Wheel Drive is allowed (front powertrain max 50kW / 60Nm); quantity per race in a Bulletin; not in the first
//    2 laps, not under FCY/SC, not when the zone is under yellow. Pit Boost (Art. 37.4-37.5) is a pit stop, not a track zone.
//  - Gen4, 2026-27 Sporting Regulations Art. 27.3 d) / 27.4 and Appendix 4: "Attack Zone" with three timing loops; Attack Mode = Race Mode
//    power (max 450kW, Bulletin) + 150kW; 4WD is on all the time (Technical Regulations 2026-27); the timer can be paused under
//    neutralisation and resumes after passing the Attack Zone again.
// Real zones: the "ATTACK (ZONE)" label printed on the official circuit map that gave the track line (fe-maps.json), placed on the
// nearest point of that line. The label sits next to the zone, so the position is good to a few tens of metres; the zone length is not
// printed, so every zone is drawn LEN metres long. A label more than NEAR m from the line (drawn with a leader arrow) gives an approximate
// position (est) and is left out of the rule. Gen4: no Gen4 event map yet, so each Formula E track keeps its Gen3 Evo zone (estimate).
// Virtual zones (every other simulator track, like the F1 estimated SM zones): the rule learned from the real zones: the corner whose
// sharpness rank is closest to theirs (median), at their median offset from that corner's apex.
// Out: worker/lapsim/fe-zones-data.js (lapsimFeZones)
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimFeTracks} from '../../worker/lapsim/fe-tracks-data.js';
import {lapsimTracks, lapsimExtraTracks} from '../../worker/lapsim/tracks-data.js';
import {lineOf} from './learn/fe-lines.mjs';

const LEN = 60, NEAR = 80, D = 'scripts/sim/data/learn/';
const OSM_LINES = JSON.parse(readFileSync('scripts/sim/data/tracks/fe-osm-lines.json', 'utf8')); // scripts/sim/tracks/fe-osm-lines.py
const maps = JSON.parse(readFileSync(D + 'fe-maps.json', 'utf8')).events;
const med = a => { a = [...a].sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };
const mod = (x, L) => ((x % L) + L) % L;
const R = (x, k = 0) => Math.round(x * 10 ** k) / 10 ** k;
const DOC = {
  gen3evo: {name: 'FIA Formula E 2025-26 Sporting Regulations (27.02.2026) Art. 37.3', url: 'https://www.fia.com/system/files/documents/2025-2026_fia_formula_e_world_championship_-_sporting_regulations_27.02.2026_-_clean_0.pdf'},
  gen4: {name: 'FIA Formula E 2026-27 Sporting Regulations Art. 27.3-27.4, Appendix 4', url: 'https://www.fia.com/system/files/documents/2026-2027_fia_formula_e_world_championship_-_sporting_regulations_23.06.2026_-_marked-up.pdf'},
};
export const RULES = {
  gen3evo: {attackKW: 350, baseKW: 300, awd: 'Attack Mode only (front max 50kW, 60Nm)', zone: 'activation zone', art: 'SR 2025-26 Art. 37.3 a), b), g)'},
  gen4: {attackKW: '[Race Mode] + 150', baseKW: '[Race Mode] max 450', awd: 'always', zone: 'Attack Zone (three timing loops)', art: 'SR 2026-27 Art. 27.3 d), 27.4, Appendix 4'},
};

// corners of a track: peaks of smoothed |curvature| (1/m) above 1/120 m, at least 40 m apart; sharpness rank 0 = sharpest
function corners(t) {
  const n = t.kappa.length, ds = t.ds, w = Math.max(1, Math.round(15 / ds)), k = t.kappa.map(v => Math.abs(v) / 1e5), sm = k.map((_, i) => { let s = 0; for (let j = -w; j <= w; j++) s += k[mod(i + j, n)]; return s / (2 * w + 1); });
  const pk = []; for (let i = 0; i < n; i++) if (sm[i] > 1 / 120 && sm[i] >= sm[mod(i - 1, n)] && sm[i] > sm[mod(i + 1, n)]) pk.push({s: i * ds, k: sm[i]});
  const out = []; for (const p of pk.sort((a, b) => b.k - a.k)) if (out.every(q => Math.min(Math.abs(q.s - p.s), n * ds - Math.abs(q.s - p.s)) > 40)) out.push(p);
  return out.map((c, i) => ({...c, rank: out.length > 1 ? i / (out.length - 1) : 0})).sort((a, b) => a.s - b.s);
}
const zone = (s, L) => ({n: 1, from: R(mod(s - LEN / 2, L)), to: R(mod(s + LEN / 2, L))});

// 1. real zones from the circuit map of each Formula E track
const real = {}, learn = [];
for (const [id, t] of Object.entries(lapsimFeTracks)) {
  const url = (t.sources || []).map(s => (/https?:\/\/\S+/.exec(s) || [])[0]).find(Boolean), m = url && maps.find(e => e.url === url);
  const w = m && m.words.find(x => /^attack$/i.test(x.t)); if (!w) continue;
  const o = OSM_LINES.tracks[id]?.attack?.[0]; // track line from OSM (the map has no lap line): label placed by the map-to-OSM fit
  if (o) { const L = t.kappa.length * t.ds; real[id] = {s: o.frac * L, gapM: o.gapM, src: `${m.season} ${m.event}`, url}; if (o.gapM > NEAR) continue;
    const cs = corners(t), s = o.frac * L; if (!cs.length) continue;
    const c = cs.reduce((a, b) => Math.abs(mod(b.s - s + L / 2, L) - L / 2) < Math.abs(mod(a.s - s + L / 2, L) - L / 2) ? b : a);
    learn.push({id, rank: c.rank, off: mod(s - c.s + L / 2, L) - L / 2}); continue; }
  const line = lineOf(m); if (!line) continue;
  const P = line.pts, cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  let bi = 0, bd = Infinity; P.forEach((p, i) => { const d = Math.hypot(p[0] - w.x, p[1] - (w.y - w.h / 2)); if (d < bd) { bd = d; bi = i; } });
  const L = t.kappa.length * t.ds, s = cum[bi] / line.lenPt * L, gapM = bd * L / line.lenPt;
  real[id] = {s, gapM, src: `${m.season} ${m.event}`, url};
  const cs = corners(t); if (!cs.length || gapM > NEAR) continue; // a label far from the line (leader arrow) does not teach the rule
  const c = cs.reduce((a, b) => Math.abs(mod(b.s - s + L / 2, L) - L / 2) < Math.abs(mod(a.s - s + L / 2, L) - L / 2) ? b : a);
  learn.push({id, rank: c.rank, off: mod(s - c.s + L / 2, L) - L / 2});
}
const rule = {rank: R(med(learn.map(x => x.rank)), 2), offM: R(med(learn.map(x => x.off))), n: learn.length, cases: learn.map(x => `${x.id} rank ${x.rank.toFixed(2)} ${x.off >= 0 ? '+' : ''}${Math.round(x.off)} m`)};

// 2. every simulator track: real zone if printed, else the learned rule
const tracks = {};
for (const [id, t] of Object.entries({...lapsimTracks, ...lapsimExtraTracks, ...lapsimFeTracks})) {
  if (!t?.kappa?.length) continue; const L = t.kappa.length * t.ds, r = real[id];
  let set;
  if (r) set = {zones: [zone(r.s, L)], marks: [{s: R(r.s), kind: 'az', label: 'AZ'}], est: r.gapM > NEAR, doc: `official circuit map ${r.src}: "ATTACK ZONE" label ${Math.round(r.gapM)} m from the line${r.gapM > NEAR ? ' (far: position approximate)' : ''}; length not printed, drawn ${LEN} m`, url: r.url};
  else { const cs = corners(t); if (!cs.length) continue; const c = cs.reduce((a, b) => Math.abs(b.rank - rule.rank) < Math.abs(a.rank - rule.rank) ? b : a), s = mod(c.s + rule.offM, L);
    set = {zones: [zone(s, L)], marks: [{s: R(s), kind: 'az', label: 'AZ'}], est: true, doc: `estimated: where Formula E would put it (rule learned from ${rule.n} printed zones: corner sharpness rank ${rule.rank}, ${rule.offM} m from its apex)`, url: ''}; }
  tracks[id] = {gen3evo: {kind: 'attack', ...set, rules: DOC.gen3evo.name},
    gen4: {kind: 'attack', ...set, est: true, doc: r ? `Gen3 Evo zone carried over until the Gen4 circuit map of this event is published (${set.doc})` : set.doc, rules: DOC.gen4.name}};
}
writeFileSync(new URL('../../worker/lapsim/fe-zones-data.js', import.meta.url), `// Generated by scripts/sim/fe-zones.mjs (Formula E Attack Zones, Gen3 Evo and Gen4). Do not edit by hand. Lap distances in metres.\nexport const lapsimFeZones = ${JSON.stringify({generatedAt: new Date().toISOString().slice(0, 10), rules: RULES, docs: DOC, lengthM: LEN, rule, tracks})};\n`);
console.log('real', Object.entries(real).map(([k, v]) => `${k} s=${Math.round(v.s)} gap=${Math.round(v.gapM)}m`).join(' | '));
console.log('rule', JSON.stringify(rule), 'tracks', Object.keys(tracks).length);
