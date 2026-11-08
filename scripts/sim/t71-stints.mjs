// Timing71 WEC race stints in the shape of scripts/sim/data/wec-stints.json (Al Kamel), for the years
// Al Kamel files are not collected (Hypercar 2021–2024) and as a cross-check where both exist.
// A Timing71 stint = laps between pit stops; "full" = no full-course neutralised lap (local yellows count as
// racing laps, like Al Kamel FLAG_AT_FL); first and last stint dropped.
//   node scripts/sim/t71-stints.mjs [summaryDir]  → scripts/sim/data/t71-wec-stints.json + check vs Al Kamel
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {mapSessions} from './t71-tracks.mjs';

const dir = process.argv[2] || 'scripts/sim/data/t71';
export function t71Stints(sessions, cls = /hyper/i) {
  const out = {};
  for (const s of sessions.filter(s => s.kind === 'R' && s.track && s.endFlag === 'chequered')) {
    const year = new Date(s.start * 1e3).getUTCFullYear(), cars = {};
    for (const [num, c] of Object.entries(s.cars)) {
      if (!cls.test(c.cls || '')) continue;
      const st = (c.stints || []).map(x => ({laps: x[1] - x[0] + 1, full: x[10] === 0}));
      if (st.length < 3) continue;
      cars[num] = {manufacturer: String(c.make || '').split(/\s+/)[0], team: c.team,
        stints: st.slice(1, -1).filter(x => x.full).map(x => x.laps), allStints: st.map(x => x.laps)};
    }
    if (Object.keys(cars).length) ((out[year] ||= {})[s.track] = {event: s.description, source: 'Timing71', cars});
  }
  return out;
}

if (process.argv[1]?.endsWith('t71-stints.mjs')) {
  const sessions = mapSessions(JSON.parse(readFileSync(`${dir}/wec.json`, 'utf8')).sessions.map(s => ({...s, key: 'wec'})));
  const t71 = t71Stints(sessions);
  writeFileSync('scripts/sim/data/t71-wec-stints.json', JSON.stringify(t71));
  // cross-check: same year, track and car number → full stint lengths (the longest repeated one, ±1 lap)
  const fullStint = s => { const c = [...s].sort((a, b) => b - a).filter(x => x >= 5); return c.find(x => c.filter(y => Math.abs(y - x) <= 1).length >= 2) ?? null; };
  const ak = existsSync('scripts/sim/data/wec-stints.json') ? JSON.parse(readFileSync('scripts/sim/data/wec-stints.json', 'utf8')) : {};
  let n = 0, same = 0, diff = [];
  for (const [y, tr] of Object.entries(ak)) for (const [id, ev] of Object.entries(tr)) for (const [num, c] of Object.entries(ev.cars)) {
    const t = t71[y]?.[id]?.cars?.[num]; if (!t) continue;
    const a = fullStint(c.stints), b = fullStint(t.stints); if (a == null && b == null) continue;
    n++; if (a != null && b != null && Math.abs(a - b) <= 1) same++; else diff.push(`${y} ${id} #${num} AlKamel ${a} T71 ${b}`);
  }
  const rows = Object.entries(t71).map(([y, tr]) => `${y}: ${Object.keys(tr).join(', ')}`);
  console.log(rows.join('\n'));
  console.log(`cross-check full stint (±1 lap): ${same}/${n} same`); console.log(diff.slice(0, 15).join('\n'));
}
