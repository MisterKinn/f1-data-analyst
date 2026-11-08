// Fits the race-pace model (worker/lapsim/race-pace.js) on OpenF1 race laps downloaded by
// fetch-openf1.mjs: per race, then pooled per track over seasons. Leave-out test: each race of the
// latest season predicted from earlier seasons at the same track and that race's real pole.
// Writes worker/lapsim/race-data.js (fitted factors only) and docs/lapsim-race.md.
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cleanLaps, fitRace, poolTrack, raceLaps, strategies, COMPOUNDS} from '../../worker/lapsim/race-pace.js';
import {lapsimCalibration} from '../../worker/lapsim/calibration-data.js';
import {tiRaces} from './ti-races.mjs';

const CACHE = process.env.LAPSIM_CACHE || '.cache/lapsim';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const read = async f => JSON.parse(await readFile(join(CACHE, f), 'utf8'));
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };

// Source: TracingInsights race laps 2018 on (LAPSIM_RACE_SRC=ti, default) or OpenF1 races from fetch-openf1.mjs
const SRC = process.env.LAPSIM_RACE_SRC || 'ti', TOP = Math.max(1, Number(process.env.LAPSIM_RACE_TOP || 8));
const races = SRC === 'ti' ? [] : await read('races.json');
// real pole lap per season and track, from the qualifying traces (build-geometry.mjs)
const traces = SRC === 'ti' ? [] : await read('traces.json');
// a wet qualifying gives no dry reference: the race ratio is then left out (wear and slope still count)
// The trace flag marks any rain in the session; a pole that is as fast as the dry poles of the
// other seasons at the track (within 1.5%) was still set on a dry track.
const poleOf = (year, circuit) => {
  const id = slug(circuit), t = traces.find(t => t.year === year && t.track === id && t.position === 1);
  if (!t) return null;
  if (!t.weather?.rain) return t.lap_seconds;
  const dry = traces.filter(o => o.track === id && o.position === 1 && o.year !== year && !o.weather?.rain).map(o => o.lap_seconds);
  return dry.length && t.lap_seconds <= 1.015 * median(dry) ? t.lap_seconds : null;
};

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
if (SRC === 'ti') {
  const years = (process.env.LAPSIM_RACE_YEARS || '2018,2019,2020,2021,2022,2023,2024,2025,2026').split(',').map(Number);
  for (const r of tiRaces(join(CACHE, 'ti'), years).sort((a, b) => a.year - b.year)) {
    if (r.rainShare > 0.05) { log.push(`${r.year} ${r.track}: wet or damp, skipped`); continue; }
    const f = fitRace(r.laps, {top: TOP});
    if (!f) { log.push(`${r.year} ${r.track}: too few clean laps`); continue; }
    const pole = r.poleRain <= 0.05 ? r.pole : null;
    (fits[r.track] ||= []).push({...f, year: r.year, pole, pole1: r.poleRain <= 0.05 ? r.pole1 : null, raceRatio: pole ? f.ref / pole : null, pitLoss: r.pitLoss, laps: r.totalLaps, cleanLaps: r.laps});
    log.push(`${r.year} ${r.track}: ${r.laps.length} clean laps, ratio ${pole ? (f.ref / pole).toFixed(4) : '– (wet qualifying)'}, slope ${f.slope.toFixed(3)} s/lap, fit RMS ${f.rmsSec.toFixed(2)} s`);
  }
}
for (const r of races.filter(x => x.session === 'Race').sort((a, b) => a.year - b.year)) {
  const race = await read(join('races', r.file));
  const {laps, wet, totalLaps} = cleanLaps(race);
  if (wet) { log.push(`${r.year} ${r.circuit}: wet or damp, skipped`); continue; }
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

// Mid-race pace / reference lap (the prediction target), pooled over seasons with newer ones weighing more
const midOf = f => f.pole ? (f.ref + f.slope * (f.laps - 1) / 2) / f.pole : NaN;
const prevOf = l => l.filter(f => f.year < latestYear), curOf = l => l.find(f => f.year === latestYear);
function midPool(list) {
  const v = list.map((f, i) => [midOf(f), 1 + i]).filter(([x]) => Number.isFinite(x));
  return v.length ? v.reduce((a, [x, w]) => a + x * w, 0) / v.reduce((a, [, w]) => a + w, 0) : NaN;
}
// Prediction for a track this season: its pooled ratio pulled toward the all-track mean (the mean counts
// as one season), times this season's change on the other tracks already raced. Tested on 2024/2025/2026.
function midPred(id) {
  const others = Object.entries(fits).filter(([o]) => o !== id).map(([, l]) => l), p = prevOf(fits[id]);
  const all = median(others.map(l => midPool(prevOf(l))).filter(Number.isFinite));
  const k = median(others.map(l => curOf(l) && prevOf(l).length ? midOf(curOf(l)) / midPool(prevOf(l)) : NaN).filter(Number.isFinite));
  return (midPool(p) * p.length + all) / (p.length + 1) * k;
}

// New-season change of the fuel/rubber slope, learned from the other tracks already raced this season
function seasonSlope(skip) {
  const r = median(Object.entries(fits).filter(([o]) => o !== skip).map(([, l]) => { const c = l.find(f => f.year === latestYear), p = l.filter(f => f.year < latestYear); const ps = p.length ? poolTrack(p).slope : NaN; return c && ps < -0.01 ? c.slope / ps : NaN; }).filter(Number.isFinite));
  return Number.isFinite(r) ? r : 1;
}

// Leave-out test: winner-pace laps of each latest-season race from earlier seasons + real pole
const errs = [], testRows = [];
for (const [id, list] of Object.entries(fits)) {
  const cur = list.find(f => f.year === latestYear), prev = list.filter(f => f.year < latestYear);
  if (!cur || !prev.length) continue;
  if (!cur.pole) continue;
  // mid-race pace of this race's reference group, predicted vs fitted
  const real = cur.ref + cur.slope * (cur.laps - 1) / 2, pred = cur.pole * midPred(id);
  const best = (pred - real) / real * 100;
  if (!Number.isFinite(best) || Math.abs(best) > 30) { log.push(`${id} ${cur.year}: test skipped (pred ${pred.toFixed(1)}, real ${real.toFixed(1)}, laps ${cur.laps}, slope ${cur.slope.toFixed(3)})`); continue; }
  errs.push(best); testRows.push([id, cur.year, prev.map(f => f.year).join('+'), best]);
}
const rms = errs.length ? Math.sqrt(errs.reduce((s, v) => s + v * v, 0) / errs.length) : null;

// 2026 race ratio for tracks not raced yet this season: latest pooled ratio × this season's change
const kSeason = median(Object.values(fits).map(l => { const c = l.find(f => f.year === latestYear), p = l.filter(f => f.year < latestYear); return c && p.length && c.raceRatio ? c.raceRatio / poolTrack(p).raceRatio : NaN; }).filter(Number.isFinite));
const kSlope = seasonSlope(null);
const tracks = {};
for (const [id, list] of Object.entries(fits)) {
  const pooled = poolTrack(list.map(strip));
  // no dry qualifying at this track yet: the median ratio of this season's races
  const seasonMedian = median(Object.values(fits).flat().filter(f => f.year === latestYear && f.raceRatio).map(f => f.raceRatio));
  if (!list.some(f => f.year === latestYear)) pooled.slope *= kSlope;
  const raced = list.some(f => f.year === latestYear && f.raceRatio);
  // a race already run this season is reproduced with its own fit (pace, slope, compound offsets and
  // wear, pit loss); the pooled values only fill what that race did not show (an unused compound)
  const own = raced ? strip(list.find(f => f.year === latestYear && f.raceRatio)) : null;
  const pick = (a, b) => a != null && Number.isFinite(a) ? a : b;
  tracks[id] = own ? {...pooled, slope: own.slope, pitLoss: pick(own.pitLoss, pooled.pitLoss), laps: own.laps,
    offset: Object.fromEntries(COMPOUNDS.map(c => [c, pick(own.offset[c], pooled.offset[c])])), wear: Object.fromEntries(COMPOUNDS.map(c => [c, pick(own.wear[c], pooled.wear[c])])),
    raceRatio: own.raceRatio, pole: own.pole, ratioBasis: latestYear, reproduced: true}
    : {...pooled, raceRatio: pooled.raceRatio != null ? pooled.raceRatio * (Number.isFinite(kSeason) ? kSeason : 1) : seasonMedian, ratioBasis: pooled.raceRatio != null ? 'scaled' : 'season-median'};
  // not raced this season: mid-race pace on the predicted P1 pole = pole × (group/P1 gap) × predicted ratio
  if (!own && prevOf(list).length) {
    const gaps = list.filter(f => f.pole && f.pole1).map(f => f.pole / f.pole1), m = (gaps.length ? median(gaps) : 1) * midPred(id);
    if (Number.isFinite(m)) { tracks[id].midRatio = Math.round(m * 1e7) / 1e7; tracks[id].ratioBasis = 'mid-pace'; }
  }
  for (const k of ['slope', 'raceRatio', 'pitLoss', 'pole']) if (tracks[id][k] != null) tracks[id][k] = Math.round(tracks[id][k] * 1e7) / 1e7; // fine enough for 0.000%
  for (const k of ['offset', 'wear']) for (const c of COMPOUNDS) if (tracks[id][k][c] != null) tracks[id][k][c] = Math.round(tracks[id][k][c] * 1e4) / 1e4;
}

// Reproduction check on races already run: the stored factors give back the race's own mid-race
// leading pace (pole × ratio + slope × half the race) — this should be 0.000%.
// Every race already run (all seasons) with a dry reference lap, stored with its own fit so the site
// reproduces it; the check below must give 0.000% for each one.
const r7 = v => v == null ? v : Math.round(v * 1e7) / 1e7;
const pastRaces = {}, repro = [];
for (const [id, list] of Object.entries(fits)) for (const f of list) {
  if (!f.raceRatio) continue;
  // two races at one track in a season (2020) keep both: the second gets "-2"
  const key = pastRaces[id]?.[f.year] ? f.year + '-2' : String(f.year), mid = (f.laps - 1) / 2;
  const t = (pastRaces[id] ||= {})[key] = {pole: r7(f.pole), raceRatio: r7(f.raceRatio), slope: r7(f.slope), pitLoss: r7(f.pitLoss), laps: f.laps,
    offset: Object.fromEntries(COMPOUNDS.map(c => [c, r7(f.offset[c])])), wear: Object.fromEntries(COMPOUNDS.map(c => [c, r7(f.wear[c])]))};
  repro.push([id + ' ' + key, ((t.pole * t.raceRatio + t.slope * mid) / (f.ref + f.slope * mid) - 1) * 100]);
}
const reproMax = repro.length ? Math.max(...repro.map(([, e]) => Math.abs(e))) : null;
const out = {generatedAt: new Date().toISOString(), season: latestYear, refTop: TOP, seasonRatioChange: kSeason, seasonSlopeChange: kSlope, test: {rmsPct: rms, races: errs.length}, reproduction: {maxPct: reproMax, races: repro.length}, tracks, races: pastRaces};
await writeFile('worker/lapsim/race-data.js', `// Generated by scripts/sim/race-pace.mjs from OpenF1 race laps (fitted factors only). Do not edit by hand.\nexport const lapsimRace=${JSON.stringify(out)};\n`);

const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;
const report = ['# Race pace model', '', `Generated ${out.generatedAt}. Season ${latestYear}; race-ratio change vs earlier seasons ×${kSeason?.toFixed(4)}, slope change ×${kSlope.toFixed(3)}.`, '',
  `Leave-out test (leading race pace, earlier seasons + real pole): ${rms?.toFixed(2)}% RMS over ${errs.length} races.`, '',
  `Races already run (all seasons), reproduced from the stored factors: largest error ${reproMax?.toFixed(3)}% over ${repro.length} races.`, '',
  '| Track | Season | Fitted from | Error % |', '|---|---|---|---|', ...testRows.map(([id, y, f, e]) => `| ${id} | ${y} | ${f} | ${e.toFixed(2)} |`), '',
  '## Track factors', '', '| Track | Race ratio | Slope s/lap | Pit loss s | Wear S/M/H s/lap | Offset S/H s |', '|---|---|---|---|---|---|',
  ...Object.entries(tracks).map(([id, t]) => `| ${id} | ${t.raceRatio?.toFixed(4)} (${t.ratioBasis}) | ${t.slope?.toFixed(3)} | ${t.pitLoss?.toFixed(1) ?? '–'} | ${COMPOUNDS.map(c => t.wear[c]?.toFixed(3) ?? '–').join(' / ')} | ${t.offset.SOFT?.toFixed(2) ?? '–'} / ${t.offset.HARD?.toFixed(2) ?? '–'} |`), ''];
// Upcoming races: best strategies from the predicted pole (calibration) or the latest real pole
for (const id of ['las-vegas', 'lusail', 'yas-marina-circuit']) {
  const t = tracks[id]; if (!t) continue;
  const pole = lapsimCalibration?.seasons?.[2026]?.predictions?.[id]?.lap ?? fits[id].filter(f => f.pole).at(-1)?.pole;
  if (!pole) continue;
  const s = strategies(t, pole).slice(0, 3);
  report.push(`## ${id}: pole ${fmt(pole)}, ${t.laps} laps`, '', '| Strategy | Race time | Gap |', '|---|---|---|',
    ...s.map(x => `| ${x.stints.map(([c, n]) => c[0] + n).join('-')} | ${fmt(x.total)} | +${(x.total - s[0].total).toFixed(1)} s |`), '');
  const L = raceLaps(t, pole, s[0].stints.map(([compound, laps]) => ({compound, laps})));
  report.push('Lap times (best strategy): ' + L.filter((l, i) => i % 5 === 0 || i === L.length - 1).map(l => `L${l.lap} ${l.time.toFixed(2)}`).join(', '), '');
}
report.push('## Fit log', '', ...log.map(l => '- ' + l), '');
await writeFile('docs/lapsim-race.md', report.join('\n'));
console.log(report.slice(0, 6 + testRows.length).join('\n'));
