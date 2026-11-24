// Step 5a track-state registry (Project claude/gate-track-state-prereg-2026-11-23.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lapsimTrackState as S} from '../worker/lapsim/track-state-data.js';
import {buildRegistry, yearPairs, isFullResurfacing, pickNotes, eventsOf, LAYOUT, FULL, clusterMedianCI} from '../scripts/sim/track-state.mjs';

const LABELS = ['fia-documented', 'hand-entered', 'no-history'];

test('registry shape: every track has a coverage label and typed year entries', () => {
  assert.ok(Object.keys(S.tracks).length >= 26);
  for (const [id, tr] of Object.entries(S.tracks)) {
    assert.ok(LABELS.includes(tr.coverage), id);
    for (const [y, e] of Object.entries(tr.years)) {
      assert.ok(+y >= 2019 && +y <= 2026, `${id} ${y}`);
      assert.equal(typeof e.layoutChange, 'boolean');
      assert.equal(typeof e.fullResurfacing, 'boolean');
      assert.ok(Array.isArray(e.partialChanges));
      assert.ok(LABELS.includes(e.coverage));
      if (e.layoutChange) assert.match(e.layoutSrc, /^https:\/\//, `${id} ${y} layout source`);
      if (e.fullResurfacing) assert.match(e.fullSrc, /^https:\/\//, `${id} ${y} resurfacing source`);
    }
  }
});

test('coverage labels follow the evidence', () => {
  for (const [id, tr] of Object.entries(S.tracks)) {
    const ys = Object.values(tr.years);
    if (tr.coverage === 'fia-documented') assert.ok(ys.some(e => e.coverage === 'fia-documented'), id);
    if (tr.coverage === 'no-history') assert.ok(!ys.some(e => e.layoutChange || e.fullResurfacing || e.partialChanges.length), id);
  }
  // hand-entered: an official page and no FIA section (Road America has no F1 notes)
  assert.equal(S.tracks['road-america'].coverage, 'hand-entered');
});

test('no year pair without evidence is selectable', () => {
  for (const p of S.selectablePairs) {
    const e = S.tracks[p.track].years[p.to];
    assert.ok(e.layoutChange || e.fullResurfacing, `${p.track} ${p.to}`);
    if (p.why.includes('layout')) assert.match(e.layoutSrc, /^https:\/\//);
    if (p.why.includes('full_resurfacing')) assert.match(e.fullSrc, /^https:\/\//);
  }
  // partial changes alone never make a pair selectable
  const reg = buildRegistry({ids: ['x'], stored: {x: {2025: {sectionFound: true, changes: [{type: 'kerb_lowered', corners: ['4'], text: 'Kerb at T4 lowered.'}]}}}, ti: {x: {2024: {laps: 5}, 2025: {laps: 5}}}});
  const pairs = yearPairs(reg);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].selectable, false);
  assert.equal(reg.x.coverage, 'fia-documented');
});

test('every hand-entered event has an official URL and a read date', () => {
  for (const list of [...Object.values(LAYOUT), ...Object.values(FULL)]) for (const e of list) {
    assert.match(e.url, /^https:\/\/(www\.)?(fia\.com|formula1\.com|grandprix\.com\.au|motogp\.com|imsa\.com|indycar\.com|midohio\.com)\//, e.url);
    assert.match(e.read, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('layout eras in the data match the hand-entered layout years (step 25: Jeddah 2023, Miami 2023)', () => {
  for (const [id, list] of Object.entries(LAYOUT)) {
    assert.deepEqual(S.tracks[id].layoutEras, list.map(e => e.year).sort((a, b) => a - b), id);
    for (const e of list) if (S.tracks[id].years[e.year]) assert.equal(S.tracks[id].years[e.year].layoutSrc, e.url, `${id} ${e.year}`);
  }
  for (const id of Object.keys(S.tracks)) if (!LAYOUT[id]) assert.deepEqual(S.tracks[id].layoutEras, [], id);
});

test('full resurfacing in FIA notes needs the whole circuit and no corner', () => {
  assert.ok(isFullResurfacing({type: 'resurfacing', corners: [], text: 'The entire circuit has been resurfaced.'}));
  assert.ok(!isFullResurfacing({type: 'resurfacing', corners: [], text: 'Resurfaced the main straight'}));
  assert.ok(!isFullResurfacing({type: 'resurfacing', corners: ['19', '1'], text: 'Track resurfaced from Turn 19 to Turn 1.'}));
});

test('FIA notes pick: the Race Director notes, not a summons or the Pirelli preview', () => {
  const docs = [{title: 'Summons - Car 4 (Failure to follow Race Director\'s Event Notes T13)'}, {title: 'Event Notes - Pirelli Preview V2'},
    {title: 'Race Directors\' Event Notes'}, {title: 'Doc 17 - Race Director\'s Event Notes V2'}];
  assert.equal(pickNotes(docs).title, 'Doc 17 - Race Director\'s Event Notes V2');
  assert.equal(pickNotes(docs.slice(0, 3)).title, 'Race Directors\' Event Notes');
  assert.deepEqual(eventsOf('catalunya', 2021), ['Spanish Grand Prix']);
  assert.deepEqual(eventsOf('madring', 2025), []);
});

test('cluster median interval is reproducible and brackets the median', () => {
  const rows = Array.from({length: 12}, (_, i) => ({id: 'c' + (i % 6), lnr: (i - 6) / 1000}));
  const a = clusterMedianCI(rows), b = clusterMedianCI(rows);
  assert.deepEqual(a, b);
  assert.ok(a.ci90[0] <= a.median && a.median <= a.ci90[1]);
});

test('covariate table: one row per track and season, unknown spelled out, sources on known cells', () => {
  const t = JSON.parse(readFileSync(new URL('../scripts/sim/data/track-covariates.json', import.meta.url)));
  const keys = new Set();
  for (const r of t.rows) {
    const k = r.track + r.season; assert.ok(!keys.has(k), k); keys.add(k);
    for (const [cell, s] of [['surfaceAgeYears', 'surfaceSrc'], ['street', 'streetSrc'], ['altitudeM', 'altitudeSrc']]) {
      assert.ok(r[cell] !== null && r[cell] !== undefined, `${k} ${cell}`);
      if (r[cell] !== 'unknown') assert.ok(r[s], `${k} ${cell} source`);
    }
  }
});
