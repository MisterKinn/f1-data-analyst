// I4 phase 1 (Project claude/gate-i4-covariates-prereg-2026-11-23.md): covariate table of the F1 tracks, one row per track and season
// (2025, 2026), every cell with its source; unknown cells stay null. Writes scripts/sim/data/i4-covariates.json.
// Usage: node scripts/sim/i4-covariates.mjs
import {writeFileSync} from 'node:fs';
import {simulationPage} from '../../worker/simulation.js';
import {lapsimCalibration as CAL} from '../../worker/lapsim/calibration-data.js';
import {lapsimCompounds} from '../../worker/lapsim/compounds-data.js';
import {lapsimEvolution} from '../../worker/lapsim/evolution-data.js';
import {lapsimSurfaceLearned} from '../../worker/lapsim/surface-learned-data.js';
import {lapsimTrackBumps} from '../../worker/lapsim/track-bumps-data.js';
import {lapsimTrackChanges} from '../../worker/lapsim/track-changes-data.js';
import {calendarEvents} from '../../worker/race-calendar-data.js';
import {tiTrack} from './ti-races.mjs';

// x1: last full-lap resurfacing, or opening of the current layout ('opening' = no later full resurfacing found). null = unknown.
// Rules: prereg amendment 1. Sources were read on 2026-11-23 (web search); FIA RD notes where they say it.
export const SURFACE = {
  melbourne: {year: 2022, kind: 'full', src: 'https://downergroup.com/The%20Australian%20Grand%20Prix%20Track%20gets%20a%20Downer%20Revamp'},
  shanghai: {year: 2024, kind: 'full', src: 'https://dynapac.com/en/news/dynapac-fleet-successful-completed-china-shanghai-f1-project-in-september-2'},
  suzuka: {year: {2025: null, 2026: 2026}, kind: 'full (T1–T8 2025, T7–T17 2026)', src: 'https://www.redbullracing.com/int-en/races/japanese-grand-prix-2026/japan-bulls-guide-2026'},
  sakhir: {year: 2004, kind: 'opening', src: 'https://en.wikipedia.org/wiki/Bahrain_International_Circuit'},
  jeddah: {year: 2021, kind: 'opening', src: 'https://en.wikipedia.org/wiki/Jeddah_Corniche_Circuit'},
  miami: {year: 2023, kind: 'full', src: 'https://tilke.de/portfolio/miami-international-autodrome-2/'},
  imola: {year: null, kind: 'unknown', src: null},
  'monte-carlo': {year: null, kind: 'unknown (partial every year, e.g. T19–T1 2026 in FIA notes)', src: null},
  catalunya: {year: 2018, kind: 'full', src: 'https://www.sorigue.com/en/asphalts/surfacing-circuit-barcelona-catalunya'},
  montreal: {year: 2024, kind: 'full (FIA RD notes 2024)', src: 'https://www.planetf1.com/news/fia-reveal-13-track-changes-canadian-grand-prix'},
  spielberg: {year: 2016, kind: 'full', src: 'https://www.motorsport.com/f1/news/analysis-hungaroring-track-changes-put-lap-records-in-sight-799805/799805/'},
  silverstone: {year: 2019, kind: 'full', src: 'https://www.motorsportweek.com/?p=23573'},
  'spa-francorchamps': {year: null, kind: 'unknown (about half resurfaced 2022)', src: 'https://racingnews365.com/circuit-designer-had-20-iterations-of-eau-rouge-in-spa-f1-track-revamp'},
  hungaroring: {year: 2016, kind: 'full', src: 'https://hungaroring.hu/site/en/about-us/history-of-the-track'},
  zandvoort: {year: 2020, kind: 'full', src: 'https://www.racefans.net/?p=422789'},
  monza: {year: 2024, kind: 'full', src: 'https://en.ilsole24ore.com/art/f1-monza-new-look-gp-ditalia-sticchi-damiani-state-of-the-art-track-AFxju8ZD'},
  madring: {year: 2026, kind: 'opening', src: 'FIA 2026 calendar (new circuit)'},
  baku: {year: 2016, kind: 'opening (no repave in 8 years, 2023)', src: 'https://www.conexpoconagg.com/news/las-vegas-strip-turns-racetrack-again-for-formula'},
  'kuala-lumpur': {year: 2016, kind: 'full', src: 'https://www.formula1.com/en/latest/features/2016/9/f1-malaysia-gp-preview-sepang-revamp.html'},
  singapore: {year: 2008, kind: 'opening', src: 'https://en.wikipedia.org/wiki/Marina_Bay_Street_Circuit'},
  austin: {year: 2012, kind: 'opening (partial patches only)', src: 'https://www.planetf1.com/features/new-mclaren-rear-wing-spotted-as-fia-ramp-up-flexing-investigations'},
  'mexico-city': {year: 2015, kind: 'full (rebuild)', src: 'https://tilke.de/?p=10517'},
  interlagos: {year: 2024, kind: 'full', src: 'https://fia.com/sites/default/files/2024_f1_gp_sao_paulo_media_kit_english.pdf'},
  'las-vegas': {year: 2023, kind: 'opening (no repave since, 2025)', src: 'https://www.fox5vegas.com/2025/11/13/f1-track-preparation-nears-completion-ahead-las-vegas-grand-prix/'},
  lusail: {year: 2023, kind: 'full', src: 'https://pirelli.com/global/en-ww/race/racingspot/formula-1/f1gp-five-fast-facts-about-the-qatar-gp-98804'},
  'yas-marina-circuit': {year: 2009, kind: 'opening (three sections relaid 2021)', src: 'https://www.arabnews.pk/node/1963761/sport'},
};
export const STREET = new Set(['jeddah', 'baku', 'miami', 'monte-carlo', 'singapore', 'las-vegas', 'melbourne', 'montreal', 'madring']);
// 2025 qualifying dates (FIA 2025 calendar, Friday of the event); 2026 from the repo calendar
const D2025 = {melbourne: '03-14', shanghai: '03-21', suzuka: '04-04', sakhir: '04-11', jeddah: '04-18', miami: '05-02', imola: '05-16',
  'monte-carlo': '05-23', catalunya: '05-30', montreal: '06-13', spielberg: '06-27', silverstone: '07-04', 'spa-francorchamps': '07-25',
  hungaroring: '08-01', zandvoort: '08-29', monza: '09-05', baku: '09-19', singapore: '10-03', austin: '10-17', 'mexico-city': '10-24',
  interlagos: '11-07', 'las-vegas': '11-20', lusail: '11-28', 'yas-marina-circuit': '12-05'};
const D2026 = {};
for (const e of calendarEvents) if (e.series === 'f1' && e.start.startsWith('2026')) { const t = tiTrack(e.nameEn, 2026); if (t) D2026[t] = e.start; }
D2026['kuala-lumpur'] = D2026['bahrain-grand-prix-in-malaysia'];

const softness = c => c ? +(c.reduce((s, x) => s + +x.slice(1), 0) / c.length).toFixed(3) : null;
const evo60 = id => { const c = lapsimEvolution.series.f1.tracks[id]?.qualifying?.curve; if (!c) return null;
  if (60 >= c.at(-1)[0]) return +(-c.at(-1)[1]).toFixed(4);
  const i = c.findIndex(p => p[0] >= 60), [a, b] = [c[i - 1], c[i]]; return +(-(a[1] + (b[1] - a[1]) * (60 - a[0]) / (b[0] - a[0]))).toFixed(4); };
const bumpIdx = id => { const x = lapsimTrackBumps.tracks[id]?.idx; return x ? +(x.reduce((s, v) => s + v, 0) / x.length).toFixed(2) : null; };
const conds = (id, y) => { try { const d = JSON.parse(simulationPage({track: id, car: y}, 'en').match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]); return d.carId === y ? d.conds[y] : null; } catch { return null; } };

export function buildTable() {
  const rows = [];
  for (const y of ['2025', '2026']) for (const [id, f] of Object.entries(CAL.seasons[y].tracks)) {
    if (f.grip == null) continue;
    const s = SURFACE[id], sy = s?.year && typeof s.year === 'object' ? s.year[y] : s?.year, c = conds(id, y);
    const ch = lapsimTrackChanges[id]?.[y];
    rows.push({track: id, season: +y, date: y === '2025' ? (D2025[id] ? `2025-${D2025[id]}` : null) : D2026[id] || null,
      grip: f.grip, drag: f.drag ?? 1,
      surfaceAge: sy == null ? null : Math.min(15, Math.max(0, +y - sy)), surfaceKind: s?.kind ?? 'unknown', surfaceSrc: s?.src ?? null,
      street: STREET.has(id) ? 1 : 0, streetSrc: 'prereg definition (circuit descriptions)',
      softness: softness(lapsimCompounds[id]?.[y]), softnessSrc: lapsimCompounds[id]?.[y] ? 'compounds-data.js (FIA / Pirelli nominations)' : null,
      evolution60: evo60(id), evolutionSrc: evo60(id) == null ? null : `evolution-data.js (qualifying ${lapsimEvolution.series.f1.tracks[id].qualifying.year} ${lapsimEvolution.series.f1.tracks[id].qualifying.session})`,
      trackTempC: c?.trackTempC != null ? +c.trackTempC.toFixed(1) : null, pressureHpa: c?.pressureHpa != null ? +c.pressureHpa.toFixed(1) : null,
      weatherSrc: c ? 'page session weather (conds)' : null, rain: c?.rain ?? null,
      roughIracing: lapsimSurfaceLearned.tracks[id]?.rough ?? null, bumpIdxIracing: bumpIdx(id),
      fiaResurfaceNotes: ch ? ch.changes.filter(x => x.type === 'resurfacing').length : null, fiaDoc: ch?.document?.url ?? null,
      pirelliRatings: null, pirelliRatingsNote: 'not collected in phase 1 (per-GP Pirelli infographics; not used by the model)'});
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = buildTable();
  const cover = k => rows.filter(r => r[k] != null).length;
  console.log('rows', rows.length, 'coverage', Object.fromEntries(['surfaceAge', 'softness', 'evolution60', 'trackTempC', 'date'].map(k => [k, cover(k)])));
  writeFileSync(new URL('./data/i4-covariates.json', import.meta.url), JSON.stringify({generated: new Date().toISOString().slice(0, 10),
    prereg: 'Project claude/gate-i4-covariates-prereg-2026-11-23.md', rows}, null, 1));
}
