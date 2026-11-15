// Fastest qualifying lap of every F1 race 2006-2019 on a simulator track, from f1db (github.com/f1db/f1db, CC BY 4.0).
//   node scripts/sim/learn/f1db-poles.mjs <f1db clone>   -> scripts/sim/data/tracks/f1db-poles.json
// Used by build-geometry-extra.mjs (owner 2026-11-15: more real laps for Istanbul and Sochi from the historic F1 database):
// season pace ratios for seasons TracingInsights does not cover, and real-lap rows on the F1-history tracks.
// Lap = fastest single lap of the whole session (Q3 of 2006-2009 ran on race fuel; 2005 used aggregate times, so it is left out).
// A session whose fastest lap is slower than the race's fastest lap is flagged wet (a dry pole is faster than the race lap).
// Track identity goes through the registry, as in f1-race-records.mjs. No weather in f1db: standard conditions are used.
import {readdirSync, readFileSync, existsSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveTrack, registry} from './track-registry.mjs';
const secs = t => String(t).split(':').reduce((a, x) => a * 60 + Number(x), 0);
if (process.argv[1]?.endsWith('f1db-poles.mjs')) {
  const SRC = join(process.argv[2], 'src/data'), out = {}, reg = registry(), f1dbLen = new Map();
  for (const f of readdirSync(join(SRC, 'circuits'))) for (const m of readFileSync(join(SRC, 'circuits', f), 'utf8').matchAll(/- id: (\S+)[^\n]*\n(?:\s+effective: \S+\n)?\s+length: ([\d.]+)/g)) f1dbLen.set(m[1], +m[2]);
  for (const y of readdirSync(join(SRC, 'seasons')).filter(y => +y >= 2006 && +y <= 2019)) for (const r of readdirSync(join(SRC, 'seasons', y, 'races'))) {
    const dir = join(SRC, 'seasons', y, 'races', r), q = join(dir, 'qualifying-results.yml'), fl = join(dir, 'fastest-laps.yml'); if (!existsSync(q)) continue;
    const race = readFileSync(join(dir, 'race.yml'), 'utf8'), g = k => (race.match(new RegExp('^' + k + ': (.+)$', 'm')) || [])[1];
    const tr = resolveTrack({name: g('circuitId'), lengthKm: f1dbLen.get(g('circuitLayoutId')), season: +y}, reg); if (!tr.sim) continue;
    let best = null; for (const e of readFileSync(q, 'utf8').split(/\n- /)) { const v = k => (e.match(new RegExp('\\b' + k + ': "?([^"\\n]+)')) || [])[1];
      for (const k of ['q1', 'q2', 'q3', 'time']) { const t = v(k) && /^\d+:\d\d\.\d+$/.test(v(k)) ? secs(v(k)) : null; if (t && (!best || t < best.lap)) best = {lap: +t.toFixed(3), driver: v('driverId'), team: v('constructorId'), segment: k}; } }
    if (!best) continue;
    const raceLap = existsSync(fl) ? (s => s ? secs(s) : null)((readFileSync(fl, 'utf8').match(/time: "?([\d:.]+)/) || [])[1]) : null;
    (out[y] ||= {})[tr.sim] = {...best, raceFastest: raceLap, wet: raceLap != null && best.lap > raceLap, race: g('officialName')};
  }
  writeFileSync('scripts/sim/data/tracks/f1db-poles.json', JSON.stringify({source: 'f1db (github.com/f1db/f1db, CC BY 4.0): qualifying-results.yml and fastest-laps.yml, 2006-2019; fastest single lap of the session; wet = slower than the race fastest lap', poles: out}, null, 1));
  console.log(Object.entries(out).map(([y, o]) => `${y}: ${Object.keys(o).length}`).join(', '));
  for (const id of ['istanbul', 'sochi', 'nurburgring-gp', 'paul-ricard-f1']) console.log(id, Object.entries(out).filter(([, o]) => o[id]).map(([y, o]) => `${y} ${o[id].lap}${o[id].wet ? ' WET' : ''}`).join(' | '));
}
