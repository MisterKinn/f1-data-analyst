// Typical weather per track and series (W4, ERA5 2016-2025 via Open-Meteo) for the /simulation weather preset.
// One preset per track × series: the documented session slot of that series here (month and local hour, [p10, p50, p90]),
// else the month × hour grid cell of the series' event here in the race calendar (labelled "typical month and hour").
// Past sessions keep their real weather; this preset is only for cars without a real session here (future or never raced).
// In: .cache/gpt-2026-11-18/w4-climatology.json (W4 bundle), worker/race-calendar-data.js. Out: worker/lapsim/climate-data.js
import {readFileSync, writeFileSync} from 'node:fs';
import {calendarEvents} from '../../worker/race-calendar-data.js';
import {sessionSchedule} from '../../worker/session-schedule.js';
import {lapsimAllTracks} from '../../worker/lapsim/tracks.js';

const W = JSON.parse(readFileSync(process.env.W4 || '.cache/gpt-2026-11-18/w4-climatology.json', 'utf8'));
// site series key → W4 slot series and race-calendar series (first one with data at the track wins)
export const SERIES = {f1: [['F1'], ['f1']], wec: [['WEC'], ['wec']], imsa: [['IMSA'], ['imsa']], fe: [['FE'], ['formula-e']], elms: [[], ['elms']], alms: [[], ['alms']],
  gtwc: [['GTWC Europe', 'GTWC America', 'GTWC Asia', 'GTWC Australia'], ['gtwc-europe', 'gtwc-america', 'gtwc-asia', 'gtwc-australia']], dtm: [['DTM'], []],
  igtc: [['IGTC'], ['igtc']], nur: [['NLS'], ['nls', '24h-series']], macau: [['Macau FIA GT World Cup'], ['macau']], supergt: [[], ['super-gt']]};
const CIRCUIT = {'albert-park': 'melbourne', spa: 'spa-francorchamps', cota: 'austin', mexico: 'mexico-city', barcelona: 'catalunya', 'red-bull-ring': 'spielberg',
  madrid: 'madring', sepang: 'kuala-lumpur', monaco: 'monte-carlo', bahrain: 'sakhir', 'yas-marina': 'yas-marina-circuit'}; // = simulator-controls.js
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
const localHour = (iso, tz) => +new Intl.DateTimeFormat('en-GB', {timeZone: tz, hour: '2-digit', hourCycle: 'h23'}).format(new Date(iso));
// Known usual months where the calendar has no current event here: the Bahrain GP runs in March (the November 2020 rounds were one-offs;
// the 2026 round was not held)
const USUAL = {'sakhir|f1': 3};
const qualiStart = e => (sessionSchedule[e.id] || []).find(x => /qualif|hyperpole/i.test(x.nameEn) && !/sprint/i.test(x.nameEn))?.start;
const rows = [];
const out = {};
for (const id of Object.keys(lapsimAllTracks)) {
  const t = W.tracks[id];
  if (!t || t.lat == null) { out[id] = null; continue; } // Rwanda: no coordinates in W4 and none on the site
  const cols = t.grid_cols, gi = k => cols.indexOf(k), P = {};
  for (const [key, [slotSeries, calSeries]] of Object.entries(SERIES)) {
    const cal = calendarEvents.filter(e => calSeries.includes(e.series) && (CIRCUIT[e.circuit] || e.circuit) === id).sort((a, b) => b.start.localeCompare(a.start))[0];
    const month = cal ? +cal.start.slice(5, 7) : null;
    const slots = t.slots.filter(s => slotSeries.includes(s.series));
    if (slots.length) {
      const by = {}; for (const x of slots) (by[x.m] ||= []).push(x);
      // month: this series' event here in the race calendar; else a known usual month; else the month with most documented hours (earlier wins)
      const ms = Object.keys(by).map(Number), m = month && by[month] ? month : USUAL[`${id}|${key}`] && by[USUAL[`${id}|${key}`]] ? USUAL[`${id}|${key}`]
        : ms.sort((a, b) => by[b].length - by[a].length || a - b)[0];
      // hour: the official qualifying start of that event (session schedule), else its race start, else the first hour of the documented
      // block (a block covering the whole day, a 24-hour race, gets 14:00, labelled assumed)
      const hs = by[m].map(x => x.h).sort((a, b) => a - b), q = cal && qualiStart(cal), want = q ? localHour(q, t.tz) : cal?.raceStart ? localHour(cal.raceStart, t.tz) : null;
      const first = hs.length === 24 ? 14 : hs.find(h => !hs.includes((h + 23) % 24)) ?? hs[0], h = want != null && hs.includes(want) ? want : first, sl = by[m].find(x => x.h === h);
      P[key] = {basis: 'slot', series: sl.series, m, h, hourAssumed: want == null && hs.length === 24, air: sl.air_degC.map(r1), rh: sl.rh_pct.map(Math.round), p: sl.p_hPa.map(r1), wind: sl.wind_ms.map(r1),
        dir: Math.round(sl.wind_dir_deg[1]), sw: Math.round(sl.sw_W_m2[1]), rain: r1(sl.rain)};
      if (!month && !USUAL[`${id}|${key}`] && ms.length > 1) rows.push(`${id} ${key} → month ${m} of ${ms.join('/')}`);
    } else if (cal) {
      const h = cal.raceStart ? localHour(cal.raceStart, t.tz) : 14, g = t.grid.find(r => r[0] === month && r[1] === h);
      if (g) P[key] = {basis: 'grid', series: cal.series, m: month, h, hourAssumed: !cal.raceStart, air: [null, r1(g[gi('air_degC')]), null], rh: [null, Math.round(g[gi('rh_pct')]), null], p: [null, r1(g[gi('p_hPa')]), null],
        wind: [null, r1(g[gi('wind_ms')]), null], dir: Math.round(g[gi('wind_dir_deg')]), sw: Math.round(g[gi('sw_W_m2')]), rain: r1(g[gi('rain')])};
    }
  }
  // a series that never races here: the slot of the main series that does (F1, WEC, IMSA, FE, ... in that order), labelled with that series
  const main = Object.keys(SERIES).find(k => P[k]);
  // no series slot or calendar event at all (club and national circuits): the grid cell of a summer afternoon (July, or January south of
  // the equator, 14:00), labelled assumed
  if (!main) { const m = t.lat < 0 ? 1 : 7, g = t.grid.find(r => r[0] === m && r[1] === 14);
    if (g) P.any = {basis: 'grid', series: null, m, h: 14, hourAssumed: true, monthAssumed: true, air: [null, r1(g[gi('air_degC')]), null], rh: [null, Math.round(g[gi('rh_pct')]), null], p: [null, r1(g[gi('p_hPa')]), null],
      wind: [null, r1(g[gi('wind_ms')]), null], dir: Math.round(g[gi('wind_dir_deg')]), sw: Math.round(g[gi('sw_W_m2')]), rain: r1(g[gi('rain')])}; }
  out[id] = {tz: t.tz, presets: P, main: main || 'any'};
}
const a = W.archive_vs_trackside.air_degC;
const meta = {source: 'ERA5 2016-2025 via Open-Meteo (W4, 2026-11-18)', credit: 'Contains modified Copernicus Climate Change Service information (ERA5), via Open-Meteo, CC BY 4.0',
  airBias: a.bias, airRms: a.rms, airPairs: a.pairs_n, trackTemp: {offset: 4.806, perSw: 0.01776, heldOut: 3.97}};
writeFileSync('worker/lapsim/climate-data.js', `// Generated by scripts/sim/climate.mjs (docs/lapsim-climate.md)\nexport const lapsimClimateMeta = ${JSON.stringify(meta)};\nexport const lapsimClimate = ${JSON.stringify(out)};\n`);
console.log('tracks without any series preset', Object.entries(out).filter(([, x]) => x && !x.main).map(([k]) => k).join(' '));
const n = Object.values(out).filter(Boolean).reduce((s, x) => s + Object.keys(x.presets).length, 0);
console.log(rows.join('\n'));
console.log('tracks', Object.keys(out).length, 'with climate', Object.values(out).filter(Boolean).length, 'presets', n);
