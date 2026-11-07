// Fits the race-pace model (worker/lapsim/race-pace.js) on OpenF1 race laps downloaded by
// fetch-openf1.mjs: per race, then pooled per track over seasons. Leave-out test: each race of the
// latest season predicted from earlier seasons at the same track and that race's real pole.
// Writes worker/lapsim/race-data.js (fitted factors only) and docs/lapsim-race.md.
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cleanLaps, fitRace, poolTrack, raceLaps, strategies, COMPOUNDS} from '../../worker/lapsim/race-pace.js';
import {lapsimCalibration} from '../../worker/lapsim/calibration-data.js';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const read = async f => JSON.parse(await readFile(join(CACHE, f), 'utf8'));
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };

const races = await read('races.json');
// real pole lap per season and track, from the qualifying traces (build-geometry.mjs)
const traces = await read('traces.json');
// a wet qualifying gives no dry reference: the race ratio is then left out (wear and slope still count)
const poleOf = (year, circuit) => { const t = traces.find(t => t.year === year && t.track === slug(circuit) && t.position === 1); return t && !t.weather?.rain ? t.lap_seconds : null; };

// pit loss: in-lap + out-lap minus two clean laps of the same driver
function pitLoss(race, clean) {
  const col = Object.fromEntries(race.columns.map((c, i) => [c, i])), losses = [];
  for (const [d, lap] of race.pits || []) {
    const laps = race.drivers[d]?.laps || [], inL = laps.find(l => l[col.lap] === lap), outL = laps.find(l => l[col.lap] === lap + 1);
    const ref = median(clean.filter(l => l.driver === String(d)).map(l => l.time));
    if (Number.isFinite(inL?.[col.time]) && Number.isFinite(outL?.[col.time]) && Number.isFinite(ref)) { const x = inL[col.time] + outL[col.time] - 2 * ref; if (x > 5 && x < 60) losses.push(x); }
  }
  return losses.length >= 3 ? median(losses) : null;
}

const fits = {};
const log = [];
for (const r of races.filter(x => x.session === 'Race').sort((a, b) => a.year - b.year)) {
  const race = await read(join('races', r.file));
  const {laps, wet, totalLaps} = cleanLaps(race);
  if (wet) { log.push(`${r.year} ${r.circuit}: wet, skipped`); continue; }
  const f = fitRace(laps);
  const pole = poleOf(r.year, r.circuit);
  if (!f) { log.push(`${r.year} ${r.circuit}: too few clean laps`); continue; }
  const id = slug(r.circuit);
  const fit = {...f, year: r.year, pole, raceRatio: pole ? f.ref / pole : null, pitLoss: pitLoss(race, laps), laps: totalLaps, cleanLaps: laps};
  (fits[id] ||= []).push(fit);
  log.push(`${r.year} ${r.circuit}: ${laps.length} clean laps, ratio ${fit.raceRatio?.toFixed(4) ?? '– (wet qualifying)'}, slope ${f.slope.toFixed(3)} s/lap, fit RMS ${f.rmsSec.toFixed(2)} s`);
}

const strip = f => { const {cleanLaps: _c, ...rest} = f; return rest; };
const latestYear = Math.max(...Object.values(fits).flat().map(f => f.year));

// Leave-out test: winner-pace laps of each latest-season race from earlier seasons + real pole
const errs = [], testRows = [];
for (const [id, list] of Object.entries(fits)) {
  const cur = list.find(f => f.year === latestYear), prev = list.filter(f => f.year < latestYear);
  if (!cur || !prev.length) continue;
  const P = poolTrack(prev);
  // scale for the new season's race ratio, learned from the other tracks already raced this season
  const k = median(Object.entries(fits).filter(([o]) => o !== id).map(([, l]) => { const c = l.find(f => f.year === latestYear), p = l.filter(f => f.year < latestYear); return c && p.length && c.raceRatio ? c.raceRatio / poolTrack(p).raceRatio : NaN; }).filter(Number.isFinite));
  const track = {...P, raceRatio: P.raceRatio * (Number.isFinite(k) ? k : 1)};
  if (!cur.pole || !Number.isFinite(track.raceRatio)) continue;
  // leading race pace at mid-race: start pace + fuel/track slope over half the race, predicted vs fitted
  const mid = (cur.laps - 1) / 2, pred = cur.pole * track.raceRatio + track.slope * mid, real = cur.ref + cur.slope * mid;
  const best = (pred - real) / real * 100;
  errs.push(best); testRows.push([id, cur.year, prev.map(f => f.year).join('+'), best]);
}
const rms = errs.length ? Math.sqrt(errs.reduce((s, v) => s + v * v, 0) / errs.length) : null;

// 2026 race ratio for tracks not raced yet this season: latest pooled ratio × this season's change
const kSeason = median(Object.values(fits).map(l => { const c = l.find(f => f.year === latestYear), p = l.filter(f => f.year < latestYear); return c && p.length && c.raceRatio ? c.raceRatio / poolTrack(p).raceRatio : NaN; }).filter(Number.isFinite));
const tracks = {};
for (const [id, list] of Object.entries(fits)) {
  const pooled = poolTrack(list.map(strip));
  const raced = list.some(f => f.year === latestYear && f.raceRatio);
  tracks[id] = {...pooled, raceRatio: raced ? list.find(f => f.year === latestYear && f.raceRatio).raceRatio : pooled.raceRatio * (Number.isFinite(kSeason) ? kSeason : 1), ratioBasis: raced ? latestYear : 'scaled'};
  for (const k of ['slope', 'raceRatio', 'pitLoss']) if (tracks[id][k] != null) tracks[id][k] = Math.round(tracks[id][k] * 1e5) / 1e5;
  for (const k of ['offset', 'wear']) for (const c of COMPOUNDS) if (tracks[id][k][c] != null) tracks[id][k][c] = Math.round(tracks[id][k][c] * 1e4) / 1e4;
}

const out = {generatedAt: new Date().toISOString(), season: latestYear, seasonRatioChange: kSeason, test: {rmsPct: rms, races: errs.length}, tracks};
await writeFile('worker/lapsim/race-data.js', `// Generated by scripts/sim/race-pace.mjs from OpenF1 race laps (fitted factors only). Do not edit by hand.\nexport const lapsimRace=${JSON.stringify(out)};\n`);

const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;
const report = ['# Race pace model', '', `Generated ${out.generatedAt}. Season ${latestYear}; race-ratio change vs earlier seasons ×${kSeason?.toFixed(4)}.`, '',
  `Leave-out test (leading race pace, earlier seasons + real pole): ${rms?.toFixed(2)}% RMS over ${errs.length} races.`, '',
  '| Track | Season | Fitted from | Error % |', '|---|---|---|---|', ...testRows.map(([id, y, f, e]) => `| ${id} | ${y} | ${f} | ${e.toFixed(2)} |`), '',
  '## Track factors', '', '| Track | Race ratio | Slope s/lap | Pit loss s | Wear S/M/H s/lap | Offset S/H s |', '|---|---|---|---|---|---|',
  ...Object.entries(tracks).map(([id, t]) => `| ${id} | ${t.raceRatio?.toFixed(4)} (${t.ratioBasis}) | ${t.slope?.toFixed(3)} | ${t.pitLoss?.toFixed(1) ?? '–'} | ${COMPOUNDS.map(c => t.wear[c]?.toFixed(3) ?? '–').join(' / ')} | ${t.offset.SOFT?.toFixed(2) ?? '–'} / ${t.offset.HARD?.toFixed(2) ?? '–'} |`), ''];
// Upcoming races: best strategies from the predicted pole (calibration) or the latest real pole
for (const id of ['las-vegas', 'lusail', 'yas-marina-circuit']) {
  const t = tracks[id]; if (!t) continue;
  const pole = lapsimCalibration?.seasons?.[2026]?.predictions?.[id]?.lap ?? fits[id].at(-1).pole;
  const s = strategies(t, pole).slice(0, 3);
  report.push(`## ${id}: pole ${fmt(pole)}, ${t.laps} laps`, '', '| Strategy | Race time | Gap |', '|---|---|---|',
    ...s.map(x => `| ${x.stints.map(([c, n]) => c[0] + n).join('-')} | ${fmt(x.total)} | +${(x.total - s[0].total).toFixed(1)} s |`), '');
  const L = raceLaps(t, pole, s[0].stints.map(([compound, laps]) => ({compound, laps})));
  report.push('Lap times (best strategy): ' + L.filter((l, i) => i % 5 === 0 || i === L.length - 1).map(l => `L${l.lap} ${l.time.toFixed(2)}`).join(', '), '');
}
report.push('## Fit log', '', ...log.map(l => '- ' + l), '');
await writeFile('docs/lapsim-race.md', report.join('\n'));
console.log(report.slice(0, 6 + testRows.length).join('\n'));
