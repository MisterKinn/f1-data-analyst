// SRO official results (fetch-sro.mjs) → one row per car and session in the shape of build-endurance.mjs COLS (+ venue, feed).
// Lap = the 'Best Lap' column, or 'Time' when it is a lap (m:ss.sss) in a practice or qualifying table. Race totals are skipped.
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {COLS, csvLine} from './build-endurance.mjs';
const IN = process.argv[2] || 'scripts/sim/data/learn/sro-results.json.gz', OUT = process.argv[3] || 'scripts/sim/data/learn/sro-gt3-cars.csv.gz';
const lap = t => { const m = /^(\d{1,2}):(\d{2}\.\d{3})$/.exec(t || ''); return m ? +(m[1] * 60 + +m[2]).toFixed(3) : null; };
const typeOf = s => /race|main/.test(s) ? 'R' : /qualif|pole|super-?pole/.test(s) && !/pre-?qualif|combined/.test(s) ? 'Q' : /practice|test|warm|pre-?qualif/.test(s) ? 'P' : null;
const out = [];
for (const s of JSON.parse(gunzipSync(readFileSync(IN)))) {
  const h = s.header || [], at = n => h.indexOf(n), type = typeOf(s.session), bl = at('Best Lap'), ti = at('Time');
  if (!type || at('Car') < 0 || (bl < 0 && (type === 'R' || ti < 0))) continue;
  const venue = (s.title.split('|')[1] || s.meeting).trim(), series = s.site.startsWith('britishgt') ? 'britishgt' : 'gtwc';
  for (const r of s.rows) { const best = lap(r[bl >= 0 ? bl : ti]); if (!best) continue;
    const o = {series, season: s.year, event: `${s.site.split('.')[0]} | ${venue}`, session: s.session, type, cls: r[at('Class')] || '', entry: r[at('Car #')] || '', vehicle: r[at('Car')], team: r[at('Team')] || '', best, laps: r[at('Laps')] || ''};
    out.push(csvLine([...COLS.map(c => o[c] ?? ''), venue, s.site.split('.')[0]])); }
}
writeFileSync(OUT, gzipSync([...COLS, 'venue', 'feed'].join(',') + '\n' + out.join('\n') + '\n'));
console.log(OUT, out.length, 'car-session rows');
