// Lap-length sanity check for the WEC lap tables (data fix 2026-11-24, Lusail bug): a car's best lap more than 3 % off the
// official class best of that season and track is flagged. Official bests: scripts/sim/data/track-real-laps.json (Al Kamel
// qualifying, le-mans / fuji / portimao / sebring) and the stored calibration (series.wec[cls][year].tracks[id].realLap).
// Hypercar rows use the faster of lmh / lmdh. Flags only; nothing is dropped from a table here.
// node scripts/sim/learn/wec-lap-sanity.mjs   -> counts per table and the flagged events
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

export const TOL = 0.03;
// Lone Star Le Mans (COTA) before Le Mans
const TRACK = [[/lone.?star|americas|austin/i, 'austin'], [/sebring/i, 'sebring'], [/portim|algarve/i, 'portimao'], [/spa/i, 'spa-francorchamps'], [/le.?mans/i, 'le-mans'], [/monza/i, 'monza'],
  [/fuji/i, 'fuji'], [/bahrain|sakhir/i, 'sakhir'], [/qatar|losail|lusail/i, 'lusail'], [/imola/i, 'imola'], [/sao.?paulo|interlagos/i, 'interlagos'],
  [/barcelona|catalunya/i, 'catalunya']];
export const trackOf = e => TRACK.find(([re]) => re.test(String(e)))?.[1] ?? null;
// Al Kamel WEC event names -> short track id (venue column, else the name), so keys match the other tables. Kept raw when two events of
// one season would share an id (2021: Bahrain 6 h and 8 h, Spa prologue and race). rows: {season, event, venue}; returns the new events.
export function wecEventIds(rows) {
  const id = r => r.venue || trackOf(r.event) || r.event, owners = new Map();
  for (const r of rows) { const k = r.season + '|' + id(r); (owners.get(k) || owners.set(k, new Set()).get(k)).add(r.event); }
  return rows.map(r => owners.get(r.season + '|' + id(r)).size === 1 ? id(r) : r.event);
}
const GROUP = {lmh: 'HYPERCAR', lmdh: 'HYPERCAR', HYPERCAR: 'HYPERCAR', lmgt3: 'LMGT3', LMGT3: 'LMGT3'};

// official best per "season|track|HYPERCAR|LMGT3"
export function officialBests({realLaps, calibration}) {
  const out = {}, put = (y, t, c, lap) => { const g = GROUP[c], k = [y, t, g].join('|'); if (g && lap > 20 && !(out[k] <= lap)) out[k] = lap; };
  for (const l of realLaps?.laps || []) if (l.series === 'wec') put(l.season, l.track, l.type, l.lap);
  for (const [c, ys] of Object.entries(calibration?.series?.wec || {})) for (const [y, s] of Object.entries(ys)) for (const [t, r] of Object.entries(s.tracks || {})) put(+y, t, c, r.realLap);
  return out;
}
// 'ok' | 'off <±x.x %>' | 'no reference'
export function lapCheck(row, bests) {
  const t = row.track ?? trackOf(row.venue || row.event), g = GROUP[row.cls], ref = t && g ? bests[[+row.season, t, g].join('|')] : null;
  if (!ref || !(row.best > 0)) return 'no reference';
  const d = row.best / ref - 1; return Math.abs(d) > TOL ? `off ${d > 0 ? '+' : ''}${(100 * d).toFixed(1)} %` : 'ok';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {lapsimCalibration} = await import('../../../worker/lapsim/calibration-data.js');
  const bests = officialBests({realLaps: JSON.parse(readFileSync('scripts/sim/data/track-real-laps.json', 'utf8')), calibration: lapsimCalibration});
  const csv = f => { const [h, ...L] = gunzipSync(readFileSync(f)).toString().trim().split('\n'), c = h.split(',');
    return L.map(l => Object.fromEntries(l.split(',').map((v, i) => [c[i], v]))); }; // these tables have no quoted fields with commas (fetch-rows strips them)
  const tables = {
    'learn/wec-alkamel-cars.csv.gz': csv('scripts/sim/data/learn/wec-alkamel-cars.csv.gz').filter(r => r.series === 'wec').map(r => ({...r, best: +r.best})),
    'learn/endurance-cars.csv.gz (wec)': csv('scripts/sim/data/learn/endurance-cars.csv.gz').filter(r => r.series === 'wec').map(r => ({...r, best: +r.best})),
    't71-wec-extra.json': JSON.parse(readFileSync('scripts/sim/data/t71-wec-extra.json', 'utf8')).rows.map(r => ({track: r.track, season: r.year, cls: r.cls, best: r.lap})),
  };
  for (const [name, rows] of Object.entries(tables)) {
    // qualifying-type rows only are compared (practice and race laps are legitimately slower than the class best)
    const q = rows.filter(r => r.type == null || r.type === 'Q'), res = q.map(r => ({r, v: lapCheck(r, bests)})), off = res.filter(x => x.v.startsWith('off'));
    const ev = {}; for (const {r, v} of off) { const k = `${r.season} ${r.event ?? r.track} ${r.cls}`; (ev[k] ||= []).push(+v.split(' ')[1]); }
    console.log(`${name}: ${q.length} Q rows, checked ${res.filter(x => x.v !== 'no reference').length}, flagged ${off.length}`);
    for (const [k, a] of Object.entries(ev)) console.log(`  ${k}: ${a.length} rows, ${Math.min(...a)} to ${Math.max(...a)} %`);
  }
}
