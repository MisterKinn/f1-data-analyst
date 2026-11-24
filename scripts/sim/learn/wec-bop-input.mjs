// Per-event WEC BoP (minimum weight, maximum power) as physical inputs to the class car of the endurance fit (central decision
// 2026-11-24, WEC season level, candidate A). No fitted parameter: the class car (calibrated on the latest seasons) is taken as the
// class median BoP of the latest season with published values (REF), and a row's car gets mass + (BoP mass - REF mass) and
// pIce * (BoP power / REF power). Hypercar power is the combined cap; scaling pIce by it is an approximation. LMGT3 decisions
// give a power-curve id, not kW: only the mass is used. Events without a public BoP (all of 2026 at the snapshot), and models
// missing from a decision, take the class median of that season, or of the latest published season, marked unknown.
// Off unless LAPSIM_WEC_BOP=1 (fit-endurance.mjs). Source: scripts/sim/data/fia-docs/wec-bop-2023-2026.csv.
import {readFileSync} from 'node:fs';
import {modelOf} from './models.mjs';
import {trackOf} from './wec-lap-sanity.mjs';

export const FILE = 'scripts/sim/data/fia-docs/wec-bop-2023-2026.csv';
const CLS = {lmh: 'Hypercar', lmdh: 'Hypercar', gt3: 'LMGT3'};
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return !n ? null : n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const split = l => { const o = []; let f = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { o.push(f); f = ''; } else f += c; } o.push(f); return o; };

// BoP car name of a decision -> our model key (same matcher as the lap tables)
export const bopModel = (name, season, cls) => modelOf(name, +season, cls === 'LMGT3' ? 'LMGT3' : 'HYPERCAR')?.key ?? null;

export function bopTable(text = readFileSync(FILE, 'utf8')) {
  const [head, ...lines] = text.replace(/^﻿/, '').trim().split(/\r?\n/), cols = split(head), byKey = new Map(), seasons = {};
  for (const l of lines) {
    const a = split(l), r = Object.fromEntries(cols.map((c, i) => [c, a[i] ?? '']));
    if (!Object.values(CLS).includes(r.class) || !/^published/.test(r.status) || !(+r.min_weight_kg > 0)) continue;
    const track = trackOf(r.event), model = bopModel(r.car_model, r.year, r.class); if (!track || !model) continue;
    const v = {mass: +r.min_weight_kg, power: +r.max_power_kw > 0 ? +r.max_power_kw : null};
    byKey.set([r.class, r.year, track, model].join('|'), v); ((seasons[r.class] ||= {})[r.year] ||= []).push(v);
  }
  const med = {}, ref = {};
  for (const [c, ys] of Object.entries(seasons)) { for (const [y, v] of Object.entries(ys)) (med[c] ||= {})[y] = {mass: median(v.map(x => x.mass)), power: median(v.map(x => x.power))};
    const last = Object.keys(med[c]).sort().at(-1); ref[c] = {season: +last, ...med[c][last]}; }
  return {byKey, med, ref};
}

// row {series, season, event, group, model}: null when the row is not a WEC Hypercar / LMGT3 row; else
// {mass, power, unknown, dMass, pScale} with dMass / pScale relative to the class reference
export function bopFor(T, row) {
  const c = CLS[row.group]; if (row.series !== 'wec' || !c || !T.ref[c]) return null;
  const known = T.byKey.get([c, row.season, trackOf(row.event), row.model].join('|'));
  const fall = T.med[c][row.season] || T.ref[c], v = known || fall, ref = T.ref[c];
  return {mass: v.mass, power: v.power, unknown: !known, dMass: v.mass - ref.mass, pScale: v.power && ref.power ? v.power / ref.power : 1};
}
