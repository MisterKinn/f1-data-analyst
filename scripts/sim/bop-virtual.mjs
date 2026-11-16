// Virtual BoP (owner 2026-11-16): "if a race were held at this circuit, what BoP would each car get?" for every simulator circuit.
// Learned from the real BoP of each class: published tables (WEC 2024-2025, ELMS, IMSA 2024-2026) and the estimates of the races the
// FIA/ACO no longer publish (WEC 2026). Per car and BoP value: value = class level at the track + car offset + car slope x track
// character, where the track character is the simulated class car's mean and top speed on that track (standardised). Slopes are
// ridge-shrunk to zero; the strength is chosen leave-one-track-out on the events up to 2025 and the error is reported on the 2026 events
// (physics rule 3). Recent seasons weigh more (2026 x3, 2025 x2, 2024 x1). Rebuilt by the daily BoP refresh, so every new real
// BoP (published or estimated after a race) moves both the real and the virtual tables.
// Out: worker/lapsim/bop-virtual-data.js
import {readFileSync, writeFileSync} from 'node:fs';
import {lapsimKernel} from '../../worker/lapsim/kernel.js';
import {carsFor} from '../../worker/lapsim/scenario.js';
import {lapsimAllTracks as T} from '../../worker/lapsim/tracks.js';
import {bopEstimate2026 as D} from '../../worker/lapsim/bop-estimate-data.js';
import {bopLmgt3 as G} from '../../worker/lapsim/bop-lmgt3-data.js';
import {bopElmsLmgt3 as E} from '../../worker/lapsim/bop-elms-lmgt3-data.js';

const K = lapsimKernel(), env = K.conditionsFromWeather({}), read = f => JSON.parse(readFileSync('scripts/sim/data/' + f, 'utf8'));
const WEC_TRACK = {LOSAIL: 'lusail', QATAR: 'lusail', IMOLA: 'imola', SPA: 'spa-francorchamps', LEMANS: 'le-mans', SAOPAULO: 'interlagos', INTERLAGOS: 'interlagos', COTA: 'austin',
  FUJI: 'fuji', BAHRAIN: 'sakhir', SAKHIR: 'sakhir', MONZA: 'monza', BARCELONA: 'catalunya', SILVERSTONE: 'silverstone', PORTIMAO: 'portimao', PAULRICARD: 'paul-ricard-2021'};
const trackOf = t => T[t] ? t : T[WEC_TRACK[t]] ? WEC_TRACK[t] : t === 'barcelona' && T.catalunya ? 'catalunya' : t === 'paul-ricard' && T['paul-ricard-2021'] ? 'paul-ricard-2021' : null;

// ---- real BoP per class: [{year, track, event, cars: {car: {field: value}}}] ----
const CLASSES = {};
{ // WEC Hypercar: published 2024-2025 (wec-bop.json), estimated 2026 (bop-estimate-data.js)
  const ev = [], W = read('wec-bop.json');
  for (const [t, ys] of Object.entries(W)) for (const [y, o] of Object.entries(ys)) if (+y >= 2024 && o?.cars) ev.push({year: +y, track: trackOf(t), event: t, kind: 'published', cars: Object.fromEntries(Object.entries(o.cars).map(([c, v]) => [c, {kg: v.kg, kW: v.kW, MJ: v.MJ}]))});
  for (const e of D.events) ev.push({year: 2026, track: trackOf(e.track), event: e.event, kind: 'estimate', cars: Object.fromEntries(Object.entries(e.cars).map(([c, v]) => [c, {kg: v.kg, kW: v.kW, MJ: v.MJ}]))});
  CLASSES['wec-hypercar'] = {series: 'wec', cls: 'hypercar', ref: 'wec-lmdh', fields: ['kg', 'kW', 'MJ'], events: ev};
}
{ // WEC LMGT3: published 2024-2025 ([P#, gain, kg, MJ]), estimated 2026
  const ev = [], P = read('wec-lmgt3-bop.json').events;
  for (const [k, o] of Object.entries(P)) { const [y, name] = k.split(' '); if (name === 'LEMANS') continue; // Le Mans: ACO table on another weight basis (not used in the fit)
    ev.push({year: +y, track: trackOf(name), event: name, kind: 'published', cars: Object.fromEntries(Object.entries(o.cars).filter(([, v]) => v).map(([c, v]) => [c, {kg: v[2], gain: v[1], MJ: v[3], curve: v[0]}]))}); }
  for (const e of G.events) if (!e.lemans) ev.push({year: 2026, track: trackOf(e.track), event: e.event, kind: 'estimate', cars: Object.fromEntries(Object.entries(e.cars).map(([c, v]) => [c, {kg: v.kg, gain: v.gain, MJ: v.MJ, curve: v.curve}]))});
  CLASSES['wec-lmgt3'] = {series: 'wec', cls: 'lmgt3', ref: 'wec-lmgt3', fields: ['kg', 'gain', 'MJ'], events: ev};
}
{ // ELMS LMGT3 2026: published where the tables are public, estimated otherwise
  CLASSES['elms-lmgt3'] = {series: 'elms', cls: 'lmgt3', ref: 'wec-lmgt3', fields: ['kg', 'gain', 'MJ'], events: E.events.map(e => ({year: 2026, track: trackOf(e.track), event: e.event, kind: e.official ? 'published' : 'estimate',
    cars: Object.fromEntries(Object.entries(e.cars).map(([c, v]) => [c, {kg: v.kg, gain: v.gain, MJ: v.MJ, curve: v.curve}]))}))};
}
{ // IMSA GTP / GTD (published). GTP: % power format only (from mid 2025); GTD: 2025-2026 (2024 used restrictors and boost)
  const I = read('imsa-bop.json').events;
  CLASSES['imsa-gtp'] = {series: 'imsa', cls: 'gtp', ref: 'wec-lmdh', fields: ['kg', 'pLow', 'pHigh', 'MJ'], events: I.filter(e => Object.values(e.gtp).some(v => v.pHigh != null))
    .map(e => ({year: e.year, track: trackOf(e.track), event: e.event, kind: 'published', cars: Object.fromEntries(Object.entries(e.gtp).filter(([, v]) => v.pHigh != null).map(([c, v]) => [c, {kg: v.kg, pLow: v.pLow, pHigh: v.pHigh, MJ: v.MJ}]))}))};
  CLASSES['imsa-gtd'] = {series: 'imsa', cls: 'gtd', ref: 'wec-lmgt3', fields: ['kg', 'pLow', 'pHigh', 'MJ'], events: I.filter(e => e.year >= 2025)
    .map(e => ({year: e.year, track: trackOf(e.track), event: e.event, kind: 'published', cars: Object.fromEntries(Object.entries(e.gtd).filter(([, v]) => v.pHigh != null).map(([c, v]) => [c, {kg: v.kg, pLow: v.pLow, pHigh: v.pHigh, MJ: v.MJ}]))}))};
}

// ---- track character: simulated class car, standard weather ----
const charCache = {};
function character(id, ref) {
  const k = id + '|' + ref; if (charCache[k]) return charCache[k];
  const c = carsFor(id)[ref]; if (!c) return null;
  const t = K.trackFromData(T[id]), r = K.simulateLap(c.grip && c.grip !== 1 ? t : t, c.car, env), L = r.v.length * t.ds;
  return charCache[k] = {mean: L / r.lapTime * 3.6, vmax: r.vMaxKph};
}

const W8 = y => y >= 2026 ? 3 : y === 2025 ? 2 : 1;
function fit(evs, field, cars, lam, Z) {
  // class level: weighted linear fit of the event mean on the track character; car: offset + slope (ridge)
  const rows = evs.filter(e => Z[e.track]).map(e => { const vs = Object.values(e.cars).map(v => v[field]).filter(Number.isFinite); return {e, z: Z[e.track], m: vs.reduce((a, b) => a + b, 0) / vs.length, w: W8(e.year)}; }).filter(r => Number.isFinite(r.m));
  const lin = (pts, lam0) => { // y = a + b1 z1 + b2 z2, ridge on b
    let S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
    for (const {x, y, w} of pts) { const f = [1, x[0], x[1]]; for (let i = 0; i < 3; i++) { v[i] += w * f[i] * y; for (let j = 0; j < 3; j++) S[i][j] += w * f[i] * f[j]; } }
    S[1][1] += lam0; S[2][2] += lam0; return solve3(S, v); };
  const latest = Math.max(...rows.map(r => r.e.year));
  const lvlRows = rows.filter(r => r.e.year === latest), level = lin(lvlRows.map(r => ({x: [r.z.mean, r.z.vmax], y: r.m, w: 1})), lam * 2);
  const car = {};
  for (const c of cars) { const pts = rows.flatMap(r => Number.isFinite(r.e.cars[c]?.[field]) ? [{x: [r.z.mean, r.z.vmax], y: r.e.cars[c][field] - r.m, w: r.w}] : []);
    if (!pts.length) continue; car[c] = lin(pts, lam); }
  return {level, car};
}
const solve3 = (A, b) => { const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) { let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-12) continue;
    for (let k = 0; k < 3; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j]; } }
  return M.map((r, i) => Math.abs(r[i]) < 1e-12 ? 0 : r[3] / r[i]); };
const predict = (m, c, z) => m.level[0] + m.level[1] * z.mean + m.level[2] * z.vmax + (m.car[c] ? m.car[c][0] + m.car[c][1] * z.mean + m.car[c][2] * z.vmax : 0);

const out = {generated: new Date().toISOString().slice(0, 10), method: 'Per car and BoP value: class level at the track + car offset + car slope x (simulated mean and top speed of the class car, standardised). Ridge on the slopes; strength chosen leave-one-track-out on events up to 2025, error reported leave-one-track-out on 2026 events.', classes: {}};
for (const [key, C] of Object.entries(CLASSES)) {
  const evs = C.events.filter(e => e.track && T[e.track]); if (!evs.length) continue;
  const latest = Math.max(...evs.map(e => e.year)), cars = [...new Set(evs.filter(e => e.year === latest).flatMap(e => Object.keys(e.cars)))].sort();
  const raw = Object.fromEntries(Object.keys(T).filter(id => !id.startsWith('fe-')).map(id => [id, character(id, C.ref)]).filter(([, z]) => z));
  const mu = k => Object.values(raw).reduce((a, z) => a + z[k], 0) / Object.keys(raw).length, sd = k => Math.sqrt(Object.values(raw).reduce((a, z) => a + (z[k] - mu(k)) ** 2, 0) / Object.keys(raw).length);
  const mM = mu('mean'), sM = sd('mean'), mV = mu('vmax'), sV = sd('vmax'), Z = Object.fromEntries(Object.entries(raw).map(([id, z]) => [id, {mean: (z.mean - mM) / sM, vmax: (z.vmax - mV) / sV}]));
  // leave-one-track-out error of each field; lam chosen on <= 2025 events (or all but the latest season when only one season exists)
  const loto = (pool, lam, test, field, base) => { let e = 0, n = 0;
    for (const t of new Set(test.map(x => x.track))) { const m = fit(pool.filter(x => x.track !== t), field, cars, base ? 1e9 : lam, Z);
      for (const ev of test.filter(x => x.track === t)) { const vs = Object.values(ev.cars).map(v => v[field]).filter(Number.isFinite); if (!vs.length) continue;
        for (const [c, v] of Object.entries(ev.cars)) if (Number.isFinite(v[field]) && m.car[c]) { e += Math.abs(predict(m, c, Z[t]) - v[field]); n++; } } }
    return n ? e / n : null; };
  const seasons = [...new Set(evs.map(e => e.year))].sort(), early = seasons.length > 1 ? evs.filter(e => e.year < latest) : evs, late = seasons.length > 1 ? evs.filter(e => e.year === latest) : evs;
  const fields = {}; // 1e9 below = no track effect (car mean only), also a candidate
  for (const f of C.fields) {
    let best = null; for (const lam of [0.3, 1, 3, 10, 30, 100, 1e9]) { const err = loto(early, lam, early, f); if (err != null && (!best || err < best.err)) best = {lam, err}; }
    const lam = best?.lam ?? 10, m = fit(evs, f, cars, lam, Z);
    fields[f] = {lam, holdout: {model: round(loto(evs, lam, late, f), 2), carMeanOnly: round(loto(evs, lam, late, f, true), 2), events: late.length, reportedOn: seasons.length > 1 ? String(latest) : 'all (one season)'},
      tracks: Object.fromEntries(Object.keys(Z).map(id => [id, Object.fromEntries(cars.filter(c => m.car[c]).map(c => [c, round(predict(m, c, Z[id]), f === 'kg' || f === 'kW' || f === 'MJ' ? 0 : 1)]))]))};
  }
  const curve = {}; if (C.cls === 'lmgt3') for (const e of evs.filter(x => x.year === latest)) for (const [c, v] of Object.entries(e.cars)) if (v.curve != null) curve[c] = v.curve; // power curve P# is per car: latest value
  out.classes[key] = {series: C.series, cls: C.cls, cars, fields: C.fields, latest, realTracks: [...new Set(evs.map(e => e.track))], events: evs.length, sources: [...new Set(evs.map(e => e.kind))],
    ...(Object.keys(curve).length ? {curve} : {}), values: Object.fromEntries(Object.entries(fields).map(([f, v]) => [f, v.tracks])), holdout: Object.fromEntries(Object.entries(fields).map(([f, v]) => [f, {...v.holdout, lam: v.lam}]))};
  console.log(key, 'cars', cars.length, 'events', evs.length, JSON.stringify(out.classes[key].holdout));
}
function round(x, d) { return x == null ? null : Math.round(x * 10 ** d) / 10 ** d; }
writeFileSync('worker/lapsim/bop-virtual-data.js', '// Generated by scripts/sim/bop-virtual.mjs. Do not edit by hand.\nexport const bopVirtual = ' + JSON.stringify(out) + ';\n');
