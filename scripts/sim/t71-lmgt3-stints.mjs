// LMGT3 full-stint lengths (laps) per event and manufacturer from Timing71 race stints (same rule as the
// Hypercar stints: no full-course lap, first/last stint dropped; full stint = longest length a car ran at
// least twice, ±1 lap). A measurement: fuel per lap needs the per-car fuel capacity, which is not published
// with the BoP. Out: scripts/sim/data/t71-lmgt3-stints.json
import {readFileSync, writeFileSync} from 'node:fs';
import {mapSessions} from './t71-tracks.mjs';
import {t71Stints} from './t71-stints.mjs';

const dir = process.argv[2] || 'scripts/sim/data/t71';
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : null; };
const fullStint = s => { const c = [...s].sort((a, b) => b - a).filter(x => x >= 5); return c.find(x => c.filter(y => Math.abs(y - x) <= 1).length >= 2) ?? null; };
const st = t71Stints(mapSessions(JSON.parse(readFileSync(`${dir}/wec.json`, 'utf8')).sessions.map(s => ({...s, key: 'wec'}))), /gt3/i);
const out = {};
for (const [y, tr] of Object.entries(st)) for (const [id, ev] of Object.entries(tr)) {
  const by = {};
  for (const c of Object.values(ev.cars)) { const f = fullStint(c.stints); if (f) (by[c.manufacturer.toLowerCase()] ||= []).push(f); }
  if (Object.keys(by).length) ((out[y] ||= {})[id] = Object.fromEntries(Object.entries(by).map(([m, f]) => [m, {laps: median(f), cars: f.length}])));
}
writeFileSync('scripts/sim/data/t71-lmgt3-stints.json', JSON.stringify(out, null, 1));
for (const [y, tr] of Object.entries(out)) for (const [id, by] of Object.entries(tr)) console.log(y, id.padEnd(18), Object.entries(by).map(([m, v]) => `${m} ${v.laps}(${v.cars})`).join('  '));
