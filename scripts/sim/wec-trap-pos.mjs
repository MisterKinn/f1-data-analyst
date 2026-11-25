// WEC speed-trap position per track and season (step 34 data fix; physics rules §4.3 limit 2: the trap was compared with the lap
// maximum). Source: scripts/sim/data/fia-docs/wec-timing-lines-2023-2025.csv (Al Kamel circuit maps; "sourced" = printed distance,
// "estimated" = digitised on the map, ±25 m). Placement as printed: metres from our s = 0 (timing line).
// A season without a row takes the position only when every published season shows the same distance (≥ 2 seasons), as the
// step 21 sector lines; otherwise null (the fit keeps the old lap-maximum comparison there).
import {readFileSync} from 'node:fs';

const ID = {'Qatar / Lusail': 'lusail', Imola: 'imola', 'Spa-Francorchamps': 'spa-francorchamps', 'Le Mans': 'le-mans', 'São Paulo / Interlagos': 'interlagos',
  COTA: 'austin', Fuji: 'fuji', Bahrain: 'sakhir', 'Portimão': 'portimao', Monza: 'monza', Sebring: 'sebring'};
// minimal CSV with quoted fields
const parse = t => t.replace(/^﻿/, '').trim().split('\n').map(l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; });
export function trapTable(file = 'scripts/sim/data/fia-docs/wec-timing-lines-2023-2025.csv') {
  const [h, ...L] = parse(readFileSync(file, 'utf8')), k = n => h.indexOf(n), T = {};
  for (const r of L) if (/speed trap/i.test(r[k('line')]) && ID[r[k('circuit')]]) (T[ID[r[k('circuit')]]] ||= {})[r[k('year')]] = {m: +r[k('distance_m')], status: r[k('status')]};
  return T;
}
let T = null;
export function trapAt(track, year) {
  const t = (T ||= trapTable())[track]; if (!t) return null;
  if (t[year]) return t[year];
  const v = Object.values(t); return v.length >= 2 && v.every(x => x.m === v[0].m) ? {...v[0], carried: true} : null;
}
