// IMSA GTP energy use per lap from the Timing71 VFT column (Virtual Fuel Tank, % of the BoP stint energy left).
// Per race and car: stints with no full-course lap, ≥10 laps, starting on a full tank (VFT ≥85%) and ending ≤40%; % per lap = (VFT first lap − VFT last lap) / (laps − 1).
// A measurement, not a model: MJ per lap = % per lap × BoP Maximum Stint Energy where that is known.
//   node scripts/sim/t71-imsa-vft.mjs [summaryDir] → scripts/sim/data/t71-imsa-vft.json
import {readFileSync, writeFileSync} from 'node:fs';
import {mapSessions} from './t71-tracks.mjs';

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : null; };
export function vftRows(sessions) {
  const out = {};
  for (const s of sessions.filter(s => s.kind === 'R' && s.cols?.includes('VFT'))) {
    const year = new Date(s.start * 1e3).getUTCFullYear(), cars = {};
    for (const [num, c] of Object.entries(s.cars)) {
      if (!/gtp/i.test(c.cls || '')) continue;
      const per = [];
      for (const x of c.stints || []) {
        const laps = x[1] - x[0] + 1, v0 = +x[5], v1 = +x[6], neutral = x[10] ?? (x[2] === laps ? 0 : 1);
        if (laps >= 10 && neutral === 0 && v0 >= 85 && v0 <= 100 && v1 >= 0 && v1 <= 40) per.push((v0 - v1) / (laps - 1));
      }
      if (per.length) cars[num] = {make: c.make, pctPerLap: +median(per).toFixed(3), stints: per.length};
    }
    if (Object.keys(cars).length) ((out[year] ||= {})[s.track ?? s.description] = {event: s.description, cars});
  }
  return out;
}

if (process.argv[1]?.endsWith('t71-imsa-vft.mjs')) {
  const dir = process.argv[2] || 'scripts/sim/data/t71';
  const t = vftRows(mapSessions(JSON.parse(readFileSync(`${dir}/imsa.json`, 'utf8')).sessions.map(s => ({...s, key: 'imsa'}))));
  writeFileSync('scripts/sim/data/t71-imsa-vft.json', JSON.stringify(t, null, 1));
  for (const [y, tr] of Object.entries(t)) for (const [id, ev] of Object.entries(tr)) {
    const v = Object.values(ev.cars).map(c => c.pctPerLap);
    console.log(y, id.padEnd(14), `cars ${v.length}`, `median ${median(v).toFixed(2)} %/lap`, `range ${Math.min(...v).toFixed(2)}–${Math.max(...v).toFixed(2)}`);
  }
}
