// Loader for scripts/sim/data/learn/driver-ratings.json.gz (FIA driver categorisation of the GT3 and LMP2 rows fit-endurance.mjs learns
// from; built by build-driver-ratings.mjs). Data only: nothing in the fit reads it yet (the main session adds that variant).
//   node scripts/sim/learn/driver-ratings.mjs   -> coverage report (group x series x season, and the gaps)
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';

export const FILE = 'scripts/sim/data/learn/driver-ratings.json.gz';
const read = f => JSON.parse((f.endsWith('.gz') ? gunzipSync(readFileSync(f)) : readFileSync(f)).toString());
export const RATINGS = ['P', 'G', 'S', 'B'];
let cache;
export const loadDriverRatings = (file = FILE) => file === FILE ? (cache ||= read(file)) : read(file);

// rating of a driver valid at a date (YYYY-MM-DD) of a season: the season's value, or the last value printed on or before the date
export function ratingAt(id, season, date = null, d = loadDriverRatings()) {
  const s = d.drivers[id]?.seasons?.[season]; if (!s) return null;
  if (!date || !s.changes) return s.changes?.at(-1)?.rating ?? s.rating;
  return [{rating: s.rating, date: ''}, ...s.changes].filter(c => c.date <= date).at(-1).rating;
}
export const lineupOf = (series, season, event, entry, d = loadDriverRatings()) => d.lineups[`${series}|${season}|${event}`]?.[String(entry)] ?? null;

// rows of fit-endurance.mjs (GT3, LMP2) with a known line-up rating, per group x series x season
export function coverage(d = loadDriverRatings()) {
  const t = {};
  for (const r of d.learned) { const k = `${r.group}|${r.series}|${r.season}`, o = t[k] ||= {group: r.group, series: r.series, season: r.season, rows: 0, lineup: 0, bestLapDriver: 0};
    o.rows++; if (r.lineup) o.lineup++; if (r.bestLapDriver) o.bestLapDriver++; }
  return Object.values(t).sort((a, b) => a.group.localeCompare(b.group) || a.series.localeCompare(b.series) || a.season - b.season);
}
export function bySeries(rows = coverage()) {
  const t = {}; for (const r of rows) { const o = t[`${r.group}|${r.series}`] ||= {group: r.group, series: r.series, rows: 0, lineup: 0, bestLapDriver: 0}; o.rows += r.rows; o.lineup += r.lineup; o.bestLapDriver += r.bestLapDriver; }
  return Object.values(t);
}

if (process.argv[1]?.endsWith('driver-ratings.mjs')) {
  const d = loadDriverRatings(), c = coverage(d);
  console.log(`generated ${d.generated}: ${Object.keys(d.drivers).length} drivers, ${Object.keys(d.lineups).length} events, ${d.learned.length} learned rows`);
  console.table(bySeries(c).map(r => ({...r, pct: +(100 * r.lineup / r.rows).toFixed(1)})));
  console.table(c);
  const gaps = d.learned.filter(r => !r.lineup), why = {}; for (const r of gaps) { const k = `${r.group} ${r.series}: ${r.why || 'a driver without a published rating'}`; why[k] = (why[k] || 0) + 1; }
  console.log('gaps', why);
}
